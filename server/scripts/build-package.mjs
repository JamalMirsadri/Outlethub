import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(serverRoot, "..");
const clientRoot = resolve(workspaceRoot, "client");
const prepareWebAssetsScript = resolve(workspaceRoot, "scripts", "prepare-web-assets.mjs");
const serviceMode = process.env.SERVICE_MODE ?? "all";
const shouldBundleClient = serviceMode !== "worker";

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (shouldBundleClient) {
  console.info("Building client bundle for web service...");
  runCommand("npm", ["run", "build"], clientRoot);
}

console.info("Building server bundle...");
runCommand("npx", ["prisma", "generate"], serverRoot);
runCommand("npx", ["tsc", "-p", "tsconfig.json"], serverRoot);

if (shouldBundleClient) {
  console.info("Copying client bundle into server dist...");
  runCommand("node", [prepareWebAssetsScript], workspaceRoot);
}
