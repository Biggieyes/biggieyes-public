import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const tsconfigPath = path.join(projectRoot, "tsconfig.json");

if (!fs.existsSync(tsconfigPath)) {
  console.log("typecheck: tsconfig.json not found, skipping.");
  process.exit(0);
}

const tscEntrypoint = path.join(
  projectRoot,
  "node_modules",
  "typescript",
  "bin",
  "tsc",
);
const run = spawnSync(
  process.execPath,
  [tscEntrypoint, "--noEmit", "-p", tsconfigPath],
  { stdio: "inherit" },
);

if (run.error) {
  console.error("typecheck: failed to execute tsc", run.error);
  process.exit(1);
}

process.exit(run.status ?? 1);
