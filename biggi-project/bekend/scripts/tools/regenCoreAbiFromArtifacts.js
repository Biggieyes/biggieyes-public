const fs = require('fs');
const path = require('path');

const baseAbiDir = path.join(__dirname, '..', '..', 'contracts', 'default_workspace (10)', 'contracts', 'BIGGI_MASTER', 'CORE', 'CORE_ABI');
const indexFile = path.join(baseAbiDir, 'index.json');

if (!fs.existsSync(indexFile)) {
  console.error('index.json not found in CORE_ABI:', indexFile);
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
let updated = 0;
let skipped = 0;
const details = [];

for (const entry of index) {
  const outName = entry.output;
  const artifactPath = entry.artifact;
  // resolve artifact path relative to workspace root (script may run from subfolder)
  const workspaceRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const absArtifact = path.resolve(workspaceRoot, artifactPath);
  const outPath = path.join(baseAbiDir, outName);

  if (!fs.existsSync(absArtifact)) {
    // try fallback: search for the artifact filename under known artifacts dirs
    const artifactBasename = path.basename(artifactPath);
    const searchRoots = [
      path.join(workspaceRoot, 'biggi-project', 'bekend', 'artifacts'),
      path.join(workspaceRoot, 'biggi-project', 'bekend', 'artifacts-master')
    ];
    let found = null;
    for (const root of searchRoots) {
      try {
        const walk = (dir) => {
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const it of items) {
            const p = path.join(dir, it.name);
            if (it.isDirectory()) {
              const res = walk(p);
              if (res) return res;
            } else if (it.isFile() && it.name === artifactBasename) {
              return p;
            }
          }
          return null;
        };
        if (fs.existsSync(root)) {
          const res = walk(root);
          if (res) { found = res; break; }
        }
      } catch (e) {
        // ignore
      }
    }
    if (!found) {
      details.push({ name: outName, status: 'artifact-missing', artifact: artifactPath });
      skipped++;
      continue;
    }
    // use found path
    console.log('Fallback artifact found for', outName, '->', found);
    try {
      const art = JSON.parse(fs.readFileSync(found, 'utf8'));
      const abi = art.abi || art.output && art.output.abi || null;
      if (!abi) {
        details.push({ name: outName, status: 'no-abi-in-artifact', artifact: found });
        skipped++;
        continue;
      }
      fs.writeFileSync(outPath, JSON.stringify(abi, null, 2) + '\n');
      updated++;
      details.push({ name: outName, status: 'updated-fallback', artifact: found });
      continue;
    } catch (e) {
      details.push({ name: outName, status: 'error', error: String(e) });
      skipped++;
      continue;
    }
  }

  try {
    const art = JSON.parse(fs.readFileSync(absArtifact, 'utf8'));
    const abi = art.abi || art.output && art.output.abi || null;
    if (!abi) {
      details.push({ name: outName, status: 'no-abi-in-artifact', artifact: artifactPath });
      skipped++;
      continue;
    }
    fs.writeFileSync(outPath, JSON.stringify(abi, null, 2) + '\n');
    updated++;
    details.push({ name: outName, status: 'updated', artifact: artifactPath });
  } catch (e) {
    details.push({ name: outName, status: 'error', error: String(e) });
    skipped++;
  }
}

const report = { updated, skipped, total: index.length, details };
const outReport = path.join(__dirname, 'reports', 'regenCoreAbi.report.json');
if (!fs.existsSync(path.dirname(outReport))) fs.mkdirSync(path.dirname(outReport), { recursive: true });
fs.writeFileSync(outReport, JSON.stringify(report, null, 2));
console.log('Regen complete:', report);
console.log('Report:', outReport);
