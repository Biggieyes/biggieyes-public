// Simple secret scanning script for CI
// DO NOT print secret values. This script searches for suspicious hardcoded keys or env-like assignments.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORE = ['node_modules', '.git', '.next', 'dist', 'build'];

const SUSPICIOUS_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*/i,
  /PINATA_SECRET_API_KEY\s*=\s*/i,
  /PINATA_API_KEY\s*=\s*/i,
  /NFT_STORAGE_KEY\s*=\s*/i,
  /PRIVATE_KEY\s*=\s*/i,
  /0x[a-fA-F0-9]{64}/, // potential private key
];

function walk(dir, cb) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (IGNORE.includes(name)) continue;
      walk(full, cb);
    } else if (stat.isFile()) {
      cb(full);
    }
  }
}

const matches = [];
walk(ROOT, (file) => {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    for (const re of SUSPICIOUS_PATTERNS) {
      if (re.test(txt)) {
        matches.push({ file, pattern: re.toString() });
        break;
      }
    }
  } catch (e) {
    // ignore binary or unreadable
  }
});

if (matches.length) {
  console.error('Potential secrets found:');
  matches.forEach((m) => console.error(` - ${m.file} matches ${m.pattern}`));
  process.exit(2);
} else {
  console.log('No obvious secrets found.');
  process.exit(0);
}
