import { createServer } from "vite";
import path from "node:path";
import { randomUUID } from "node:crypto";

const root = process.cwd(),
  assets = new Map(),
  designs = new Map();
// Only auth, Supabase persistence and external side effects are mocked. Routes,
// font layout, asset validation, library actions and exporters are the real modules.
globalThis.__studioHarnessBackend = {
  storage: {
    from: () => ({
      download: async (key) => ({
        data: assets.has(key)
          ? new Blob([assets.get(key).bytes], { type: assets.get(key).type })
          : null,
        error: assets.has(key) ? null : { message: "Missing artwork" },
      }),
      upload: async (key, bytes, options) => {
        if (assets.has(key))
          return { error: { statusCode: "409", message: "Already exists" } };
        assets.set(key, {
          bytes: Buffer.from(bytes),
          type: options.contentType,
        });
        return { error: null };
      },
      createSignedUploadUrl: async (key) => ({
        data: {
          signedUrl: `http://127.0.0.1:4317/__test/upload?key=${encodeURIComponent(key)}`,
          path: key,
          token: "test-only",
        },
        error: null,
      }),
      remove: async (keys) => {
        keys.forEach((key) => assets.delete(key));
        return { error: null };
      },
    }),
  },
  rpc: async (name, args) => {
    if (name !== "save_candy_design") throw new Error("Unexpected test RPC");
    const id = args.p_id || randomUUID(),
      existing = designs.get(id);
    if (args.p_id && existing?.revision !== args.p_revision)
      return {
        data: null,
        error: {
          message: "This design has changed in another tab. Save a copy.",
        },
      };
    const saved = {
      id,
      revision: (existing?.revision || 0) + 1,
      document: structuredClone(args.p_document),
    };
    designs.set(id, saved);
    return { data: saved, error: null };
  },
};
const virtual = {
  "@/lib/adminAuth": `const session={user:{email:'studio-test@example.test',role:'admin',canWrite:true}}; export async function getAdminSession(){return session}; export async function requireAdminSession(){return session}; export async function requireAdminWriteAccess(){return session};`,
  "@/lib/supabase/admin": `export const supabaseAdminClient=globalThis.__studioHarnessBackend;`,
  "@/lib/adminActivity": `export async function logAdminActivity(){};`,
  "next/cache": `export function revalidatePath(){};`,
};
const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/studio"),
  publicDir: path.join(root, "public"),
  resolve: { alias: { "@": path.join(root, "src") } },
  oxc: { jsx: { runtime: "automatic" } },
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
      "https://storage.example.test",
    ),
  },
  css: { postcss: path.join(root, "postcss.config.mjs") },
  server: {
    host: "127.0.0.1",
    port: 4317,
    strictPort: true,
    fs: { allow: [root] },
  },
  ssr: { noExternal: ["next"] },
  plugins: [
    {
      name: "isolated-studio-backend",
      enforce: "pre",
      resolveId(source, importer, options) {
        if (
          source === "next/cache" ||
          source === path.join(root, "node_modules/next/cache.js")
        )
          return "\0studio:next/cache";
        const key = Object.keys(virtual).find(
          (key) =>
            source === key ||
            source === path.join(root, "src", key.slice(2)) + ".ts",
        );
        if (key) return `\0studio:${key}`;
        if (
          !options?.ssr &&
          source === "./actions" &&
          importer?.endsWith("/design/DesignEditor.tsx")
        )
          return "\0studio:client-actions";
      },
      load(id) {
        const stub = Object.keys(virtual).find(
          (key) =>
            key.startsWith("@/") &&
            (id === path.join(root, "src", key.slice(2)) + ".ts" ||
              id === path.join(root, "src", key.slice(2))),
        );
        if (stub) return virtual[stub];
        if (id === "\0studio:client-actions")
          return `export async function saveCandyDesign(design,copy){return (await fetch('/__test/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({design,copy})})).json()}`;
        if (id.startsWith("\0studio:")) return virtual[id.slice(8)];
      },
      configureServer(instance) {
        instance.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url, "http://127.0.0.1:4317");
          if (
            !url.pathname.startsWith("/api/admin/design/") &&
            !url.pathname.startsWith("/__test/")
          )
            return next();
          try {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const body = Buffer.concat(chunks);
            if (url.pathname === "/__test/upload") {
              assets.set(url.searchParams.get("key"), {
                bytes: body,
                type: req.headers["content-type"],
              });
              res.end("{}");
              return;
            }
            if (url.pathname === "/__test/save") {
              const input = JSON.parse(body);
              const { saveCandyDesign } = await instance.ssrLoadModule(
                path.join(root, "src/app/admin/design/actions.ts"),
              );
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify(await saveCandyDesign(input.design, input.copy)),
              );
              return;
            }
            const route = url.pathname.startsWith("/api/admin/design/assets/")
              ? "assets/[key]"
              : url.pathname.split("/").at(-1);
            const routeModule = await instance.ssrLoadModule(
              path.join(root, `src/app/api/admin/design/${route}/route.ts`),
            );
            const request = new Request(url, {
              method: req.method,
              headers: req.headers,
              body: req.method === "GET" ? undefined : body,
            });
            if (typeof routeModule[req.method] !== "function") {
              res.statusCode = 405;
              res.end("Method not allowed");
              return;
            }
            const response = await routeModule[req.method](request, {
              params: Promise.resolve({ key: url.pathname.split("/").at(-1) }),
            });
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch (error) {
            console.error(error);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: String(error) }));
          }
        });
      },
    },
  ],
});
await server.listen();
console.log(
  "Admin Studio isolated integration harness ready at http://127.0.0.1:4317",
);
