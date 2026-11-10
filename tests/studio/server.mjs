import { createServer } from "vite";
import path from "node:path";

const root = process.cwd();
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
  plugins: [
    {
      name: "mock-studio-server-actions",
      enforce: "pre",
      resolveId(source, importer) {
        if (
          source === "./actions" &&
          importer?.endsWith("/design/DesignEditor.tsx")
        )
          return "\0mock-studio-actions";
      },
      load(id) {
        if (id !== "\0mock-studio-actions") return;
        return `export async function saveCandyDesign(design, copy) {
        const { parseCandyDesign } = await import('/@fs/${root}/src/lib/candyDesign.ts');
        return {ok:true,design:{...parseCandyDesign(design),source:{id:copy?'88888888-8888-4888-8888-888888888888':'77777777-7777-4777-8777-777777777777',revision:(design.source?.revision||0)+1}}};
      }`;
      },
    },
  ],
});
await server.listen();
console.log("Admin Studio component harness ready at http://127.0.0.1:4317");
