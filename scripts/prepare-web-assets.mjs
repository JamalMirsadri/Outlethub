import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(rootDir, "..");
const clientDistDir = resolve(workspaceRoot, "client", "dist");
const serverDistClientDir = resolve(workspaceRoot, "server", "dist", "client");
const clientIndexPath = resolve(clientDistDir, "index.html");

if (!existsSync(clientIndexPath)) {
  console.error(`Client bundle is missing at ${clientDistDir}. Run "npm run build --workspace client" first.`);
  process.exit(1);
}

mkdirSync(resolve(workspaceRoot, "server", "dist"), { recursive: true });
rmSync(serverDistClientDir, { recursive: true, force: true });
cpSync(clientDistDir, serverDistClientDir, { recursive: true });

console.info(`Copied client bundle to ${serverDistClientDir}`);
