import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const binaryExtensions = new Set([
  ".7z",
  ".apk",
  ".avif",
  ".bin",
  ".dll",
  ".eot",
  ".exe",
  ".gif",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".keystore",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".so",
  ".ttf",
  ".wasm",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const signaturePatterns = [
  ["private-key PEM", /-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Netlify token", /\bnfp_[A-Za-z0-9_-]{20,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["Stripe live key", /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/],
];

const secretAssignment =
  /["']?([A-Za-z][A-Za-z0-9_.-]*(?:PRIVATE_KEY|SECRET_KEY|SERVICE_ROLE_KEY|API_SECRET|AUTH_TOKEN|ACCESS_TOKEN|PINATA_JWT|NETLIFY_AUTH_TOKEN|JWT_SECRET|PASSWORD|MNEMONIC|SEED_PHRASE))["']?\s*[:=]\s*(.+)$/i;

function listCandidateFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return [...new Set(output.split("\0").filter(Boolean))].sort();
}

function normalizeAssignedValue(raw) {
  return String(raw || "")
    .replace(/\s+(?:#|\/\/).*$/, "")
    .replace(/[;,]\s*$/, "")
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .trim();
}

function isPlaceholder(value) {
  if (!value) return true;
  const lower = value.toLowerCase();
  return (
    lower === "null" ||
    lower === "undefined" ||
    lower === "true" ||
    lower === "false" ||
    lower.includes("process.env") ||
    lower.includes("import.meta.env") ||
    lower.includes("deno.env") ||
    lower.endsWith("(") ||
    lower.startsWith("${") ||
    lower.startsWith("test-") ||
    lower.includes("placeholder") ||
    lower.includes("changeme") ||
    lower.includes("replace_me") ||
    lower.includes("replace-with") ||
    lower.includes("your_") ||
    lower.includes("your-") ||
    /^<[^>]+>$/.test(value) ||
    /^\.{3,}$/.test(value) ||
    /^\*+$/.test(value) ||
    /^0x0+$/.test(lower)
  );
}

function scanFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  let stat;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    return [];
  }
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return [];
  if (binaryExtensions.has(path.extname(relativePath).toLowerCase())) return [];

  const content = fs.readFileSync(absolutePath, "utf8");
  if (content.includes("\0")) return [];

  const findings = [];
  content.split(/\r?\n/).forEach((line, index) => {
    for (const [name, pattern] of signaturePatterns) {
      if (pattern.test(line)) {
        findings.push({ file: relativePath, line: index + 1, type: name });
      }
    }

    const assignment = line.match(secretAssignment);
    if (!assignment) return;
    const value = normalizeAssignedValue(assignment[2]);
    if (!isPlaceholder(value)) {
      findings.push({
        file: relativePath,
        line: index + 1,
        type: `non-placeholder ${assignment[1]}`,
      });
    }
  });
  return findings;
}

const findings = listCandidateFiles().flatMap(scanFile);
if (findings.length) {
  console.error(`Secret scan failed with ${findings.length} finding(s):`);
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} [${finding.type}]`);
  }
  process.exit(1);
}

console.log("Secret scan passed: no credential-like values found in tracked or pending files.");
