import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "dist");
const htmlFiles = [
  path.join(outputDir, "index.html"),
  path.join(outputDir, "app", "index.html"),
];

function inlineScriptHashes(html) {
  const hashes = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const attributes = match[1] || "";
    const source = match[2] || "";
    if (/\bsrc\s*=/i.test(attributes) || !source.trim()) continue;
    const digest = createHash("sha256").update(source, "utf8").digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

const scriptHashes = new Set();
for (const file of htmlFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing built HTML file: ${path.relative(root, file)}`);
  }
  const html = fs.readFileSync(file, "utf8");
  for (const hash of inlineScriptHashes(html)) scriptHashes.add(hash);
}

const policy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com ${[
    ...scriptHashes,
  ].join(" ")}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https: wss:",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "frame-src 'self' https:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const headersFile = [
  "/*",
  `  Content-Security-Policy: ${policy}`,
  "",
].join("\n");

fs.writeFileSync(path.join(outputDir, "_headers"), headersFile, "utf8");
console.log(
  `Generated dist/_headers with ${scriptHashes.size} inline-script CSP hash(es).`,
);
