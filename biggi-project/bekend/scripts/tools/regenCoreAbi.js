#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "../..");
const repositoryRoot = path.resolve(backendRoot, "../..");
const abiDir = path.join(
  backendRoot,
  "contracts",
  "default_workspace (10)",
  "contracts",
  "BIGGI_MASTER",
  "CORE",
  "CORE_ABI"
);
const indexPath = path.join(abiDir, "index.json");
const reportPath = path.join(__dirname, "reports", "regenCoreAbi.report.json");

function main() {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const report = { updated: 0, skipped: 0, total: index.length, details: [] };

  for (const entry of index) {
    const artifactPath = path.resolve(repositoryRoot, entry.artifact);
    const outputPath = path.join(abiDir, entry.output);
    if (!fs.existsSync(artifactPath)) {
      report.skipped += 1;
      report.details.push({ name: entry.output, status: "skipped", artifact: entry.artifact });
      continue;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    if (!Array.isArray(artifact.abi)) {
      throw new Error(`Artifact ABI is missing: ${artifactPath}`);
    }
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact.abi, null, 2)}\n`);
    entry.abiLength = artifact.abi.length;
    report.updated += 1;
    report.details.push({ name: entry.output, status: "updated", artifact: entry.artifact });
  }

  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`CORE ABI export: ${report.updated} updated, ${report.skipped} skipped`);
  if (report.skipped > 0) process.exitCode = 1;
}

main();
