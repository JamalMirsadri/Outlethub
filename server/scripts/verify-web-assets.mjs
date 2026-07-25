import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serviceMode = process.env.SERVICE_MODE ?? "all";

if (serviceMode === "worker") {
  process.exit(0);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientIndexPath = resolve(scriptDir, "..", "dist", "client", "index.html");

if (!existsSync(clientIndexPath)) {
  console.error(
    `Client bundle missing before startup at ${clientIndexPath}. Build the web service with "npm install && npm run build".`,
  );
  process.exit(1);
}

console.info(`Verified client bundle at ${clientIndexPath}`);
