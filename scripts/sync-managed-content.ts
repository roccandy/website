import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

async function loadLocalEnvFile(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing local env files.
  }
}

async function loadLocalEnv() {
  const cwd = process.cwd();
  await loadLocalEnvFile(path.join(cwd, ".env.local"));
  await loadLocalEnvFile(path.join(cwd, ".env"));
}

async function main() {
  await loadLocalEnv();
  const { syncManagedContent } = await import("../src/lib/managedContentSync");
  const summary = await syncManagedContent();
  console.log("Managed content sync complete.");
  console.log(`- Site pages: ${summary.pagesSynced}`);
  console.log(`- FAQ items: ${summary.faqItemsSynced}`);
  console.log(`- Terms items: ${summary.termsItemsSynced}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
