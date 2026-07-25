import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(scriptDir, "..");
const prismaSchemaPath = resolve(serverRoot, "prisma", "schema.prisma");
const migrationsDir = resolve(serverRoot, "prisma", "migrations");

function runPrismaCommand(args) {
  const result = spawnSync("npx", ["prisma", ...args, "--schema", prismaSchemaPath], {
    cwd: serverRoot,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function getMigrationDirectories() {
  try {
    return readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function getExpectedPrismaTables() {
  const schema = readFileSync(prismaSchemaPath, "utf8");
  return Array.from(schema.matchAll(/^\s*model\s+([A-Za-z0-9_]+)/gm), (match) => match[1]);
}

async function verifyTables() {
  const prisma = new PrismaClient({
    log: ["error"],
  });

  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const existingTables = new Set(rows.map((row) => row.table_name));
    const expectedTables = getExpectedPrismaTables();
    const missingTables = expectedTables.filter((tableName) => !existingTables.has(tableName));

    if (missingTables.length > 0) {
      throw new Error(`Missing Prisma tables after initialization: ${missingTables.join(", ")}`);
    }

    return {
      expectedTableCount: expectedTables.length,
      notificationChannelVerified: existingTables.has("NotificationChannel"),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const migrations = getMigrationDirectories();

  if (migrations.length > 0) {
    console.info(`Applying Prisma migrations (${migrations.length}) before startup...`);
    runPrismaCommand(["migrate", "deploy"]);
  } else {
    console.info("No Prisma migrations found. Running prisma db push before startup...");
    runPrismaCommand(["db", "push"]);
  }

  const verification = await verifyTables();
  console.info(
    `Prisma schema verified before startup. ${verification.expectedTableCount} tables confirmed${verification.notificationChannelVerified ? ", including NotificationChannel" : ""}.`,
  );
}

await main();
