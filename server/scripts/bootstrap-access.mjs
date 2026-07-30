import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const compiledBootstrapScript = resolve(scriptDir, "..", "dist", "src", "scripts", "bootstrap-access.js");

await import(pathToFileURL(compiledBootstrapScript).href);
