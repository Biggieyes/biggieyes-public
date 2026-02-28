import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const toPosix = (v) => String(v || "").split(path.sep).join("/");

const parseArgs = (argv) => {
  const out = {
    dryRun: false,
    workflow: "biggieeyes/biggieyes-vrf-postredeem/workflow.yaml",
    projectRoot: "biggieeyes",
    outDir: "evidence/cre-simulation",
    creBin: "",
    triggerIndex: "0",
    evmTxHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    evmEventIndex: "0",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--workflow" && argv[i + 1]) out.workflow = argv[++i];
    else if (arg === "--project-root" && argv[i + 1])
      out.projectRoot = argv[++i];
    else if (arg === "--out-dir" && argv[i + 1]) out.outDir = argv[++i];
    else if (arg === "--cre-bin" && argv[i + 1]) out.creBin = argv[++i];
    else if (arg === "--trigger-index" && argv[i + 1])
      out.triggerIndex = argv[++i];
    else if (arg === "--evm-tx-hash" && argv[i + 1]) out.evmTxHash = argv[++i];
    else if (arg === "--evm-event-index" && argv[i + 1])
      out.evmEventIndex = argv[++i];
  }
  return out;
};

const opts = parseArgs(process.argv.slice(2));
const workflowPath = path.resolve(projectRoot, opts.workflow);
const workflowFolderPath = path.dirname(workflowPath);
const creProjectRoot = path.resolve(projectRoot, opts.projectRoot);
const outDir = path.resolve(projectRoot, opts.outDir);
mkdirSync(outDir, { recursive: true });

let workflowRaw = "";
let workflowHash = "";
try {
  workflowRaw = readFileSync(workflowPath, "utf8");
  workflowHash = createHash("sha256").update(workflowRaw).digest("hex");
} catch (err) {
  console.error(`Workflow file not readable: ${workflowPath}`);
  console.error(err?.message || err);
  process.exit(1);
}

const timestamp = new Date().toISOString();
const stampSafe = timestamp.replace(/[:]/g, "-");

const report = {
  timestamp,
  mode: opts.dryRun ? "dry-run" : "cli",
  workflowPath: toPosix(path.relative(projectRoot, workflowPath)),
  workflowSha256: workflowHash,
  status: "pending",
  commandTried: null,
  exitCode: null,
  stdout: "",
  stderr: "",
  notes: [],
};

const tryCommand = (cmd, args) => {
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120000,
    env: { ...process.env, CI: "1" },
  });
  return {
    cmd,
    args,
    error: result.error || null,
    status: typeof result.status === "number" ? result.status : null,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
};

if (opts.dryRun) {
  report.status = "dry_run_completed";
  report.notes.push(
    "No CRE CLI was executed. This run validates workflow file presence and records a reproducible evidence artifact.",
  );
  } else {
    const candidates = [];
    const projectFlag = existsSync(path.join(creProjectRoot, "project.yaml"))
      ? ["--project-root", creProjectRoot]
      : [];
    if (!projectFlag.length) {
      report.notes.push(
        `CRE project settings not found at ${toPosix(path.join(creProjectRoot, "project.yaml"))}`,
      );
    }
    if (opts.creBin) {
      candidates.push({
        cmd: opts.creBin,
        args: [
          "workflow",
          "simulate",
          workflowFolderPath,
          ...projectFlag,
          "--non-interactive",
          "--trigger-index",
          String(opts.triggerIndex),
          "--evm-tx-hash",
          String(opts.evmTxHash),
          "--evm-event-index",
          String(opts.evmEventIndex),
        ],
      });
    } else {
      candidates.push({
        cmd: "cre",
        args: [
          "workflow",
          "simulate",
          workflowFolderPath,
          ...projectFlag,
          "--non-interactive",
          "--trigger-index",
          String(opts.triggerIndex),
          "--evm-tx-hash",
          String(opts.evmTxHash),
          "--evm-event-index",
          String(opts.evmEventIndex),
        ],
      });
      candidates.push({
        cmd: "chainlink",
        args: [
          "cre",
          "workflow",
          "simulate",
          workflowFolderPath,
          ...projectFlag,
          "--non-interactive",
          "--trigger-index",
          String(opts.triggerIndex),
          "--evm-tx-hash",
          String(opts.evmTxHash),
          "--evm-event-index",
          String(opts.evmEventIndex),
        ],
      });
    }

  let executed = false;
  let missingAll = true;

  for (const candidate of candidates) {
    const res = tryCommand(candidate.cmd, candidate.args);

    if (res.error && res.error.code === "ENOENT") {
      report.notes.push(`Command not found: ${candidate.cmd}`);
      continue;
    }

    missingAll = false;
    executed = true;
    report.commandTried = [candidate.cmd, ...candidate.args].join(" ");
    report.exitCode = res.status;
    report.stdout = res.stdout;
    report.stderr = res.stderr || (res.error ? String(res.error.message || res.error) : "");

    if (res.status === 0) {
      report.status = "cli_simulation_success";
      break;
    }

    report.status = "cli_simulation_failed";
    break;
  }

  if (!executed && missingAll) {
    report.status = "cli_not_found";
    report.notes.push(
      "Install CRE CLI and rerun without --dry-run to produce an executable simulation record.",
    );
  }
}

const jsonPath = path.join(outDir, `cre-sim-${stampSafe}.json`);
const mdPath = path.join(outDir, `cre-sim-${stampSafe}.md`);
const latestJsonPath = path.join(outDir, "latest.json");
const latestMdPath = path.join(outDir, "latest.md");

const markdown = [
  "# CRE Simulation Evidence",
  "",
  `- Timestamp: ${report.timestamp}`,
  `- Mode: ${report.mode}`,
  `- Workflow: ${report.workflowPath}`,
  `- Workflow SHA256: ${report.workflowSha256}`,
  `- Status: ${report.status}`,
  `- Command: ${report.commandTried || "(none)"}`,
  `- Exit code: ${report.exitCode == null ? "(none)" : report.exitCode}`,
  "",
  "## Notes",
  ...(report.notes.length ? report.notes.map((n) => `- ${n}`) : ["- (none)"]),
  "",
  "## Stdout",
  "```text",
  (report.stdout || "").trim() || "(empty)",
  "```",
  "",
  "## Stderr",
  "```text",
  (report.stderr || "").trim() || "(empty)",
  "```",
  "",
].join("\n");

writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, markdown, "utf8");
writeFileSync(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(latestMdPath, markdown, "utf8");

console.log(`CRE evidence JSON: ${toPosix(path.relative(projectRoot, jsonPath))}`);
console.log(`CRE evidence MD:   ${toPosix(path.relative(projectRoot, mdPath))}`);
console.log(`Status: ${report.status}`);

if (report.status === "cli_simulation_failed") process.exit(1);
