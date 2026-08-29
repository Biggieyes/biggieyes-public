#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function walk(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, list);
    else if (e.isFile() && p.endsWith('.sol')) list.push(p);
  }
  return list;
}

function extractFunctionsAndEvents(src) {
  const functions = [];
  const events = [];

  // crude function regex: name + params + optional visibility (we only care about public/external)
  const funcRe = /function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*([^;{\n]*)/g;
  let m;
  while ((m = funcRe.exec(src)) !== null) {
    const name = m[1];
    const params = m[2].trim();
    const suffix = (m[3] || '').toLowerCase();
    const arity = params === '' ? 0 : params.split(',').filter(p => p.trim() !== '').length;

    // detect whether this is a prototype/declaration (ends with ';') vs an implementation (has '{')
    const after = src.slice(m.index + m[0].length).trimStart();
    const isDeclaration = after.startsWith(';');

    // only include functions declared public or external in the source (ignore internal/private helpers)
    // and skip prototype declarations (interface stubs) because they belong to external contracts
    if ((suffix.includes('public') || suffix.includes('external')) && !isDeclaration) {
      functions.push({ name, arity });
    }
  }

  const eventRe = /event\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g;
  while ((m = eventRe.exec(src)) !== null) {
    const name = m[1];
    const params = m[2].trim();
    const arity = params === '' ? 0 : params.split(',').filter(p => p.trim() !== '').length;
    events.push({ name, arity });
  }

  return { functions, events };
}

async function main() {
  const base = path.join(__dirname, '..', '..', 'contracts', 'default_workspace (10)', 'contracts', 'BIGGI_MASTER', 'CORE');
  const abiDir = path.join(base, 'CORE_ABI');
  const indexFile = path.join(abiDir, 'index.json');

  if (!fs.existsSync(abiDir)) {
    console.error('CORE_ABI directory not found:', abiDir);
    process.exit(1);
  }

  const abiIndex = fs.existsSync(indexFile) ? readJson(indexFile) : null;
  const abiFiles = fs.readdirSync(abiDir).filter(f => f.endsWith('.abi.json'));

  // search CORE sources first, then fallback to all contracts if no direct CORE match exists
  const contractsRoot = path.join(__dirname, '..', '..', 'contracts', 'default_workspace (10)', 'contracts');
  const solFilesCore = walk(base);
  const solFilesAll = walk(contractsRoot);
  const solFiles = [...solFilesCore, ...solFilesAll.filter(p => !solFilesCore.includes(p))];

  const report = { summary: {}, contracts: {} };

  // common OpenZeppelin/Ecosystem methods and events to ignore in "missingInSource"
  const ozFunctions = new Set([
    'approve','getApproved','setApprovalForAll','isApprovedForAll','transferFrom','safeTransferFrom','balanceOf','ownerOf','name','symbol','supportsInterface',
    'approve','renounceOwnership','transferOwnership','acceptOwnership','pendingOwner', 'owner', 'paused'
  ]);
  const ozEvents = new Set(['Approval','ApprovalForAll','Transfer','OwnershipTransferred','Paused','Unpaused']);

  // build global ABI function set to account for interface/aux contracts (reduce false positives)
  const globalAbiFuncs = new Set();
  for (const af of abiFiles) {
    try {
      const abiPath = path.join(abiDir, af);
      const ai = readJson(abiPath);
      for (const fn of ai.filter(x => x.type === 'function')) {
        globalAbiFuncs.add(`${fn.name}/${(fn.inputs||[]).length}`);
      }
    } catch (e) {
      // ignore
    }
  }

  const inheritedMissing = {
    BiggiVRFRouter: {
      functions: new Set(['rawFulfillRandomWords']),
      events: new Set(['CoordinatorSet'])
    }
  };

  for (const abiF of abiFiles) {
    try {
      const abiPath = path.join(abiDir, abiF);
      const abi = readJson(abiPath);
      const contractName = abiF.replace(/\.abi\.json$/, '');

      // find source file containing the contract declaration
      let srcPath = solFiles.find(sf => {
        const c = fs.readFileSync(sf, 'utf8');
        return new RegExp('\\b(?:contract|library|interface)\\s+' + contractName + '\\b').test(c);
      });

      let srcContent = '';
      if (srcPath) srcContent = fs.readFileSync(srcPath, 'utf8');

      const abiFuncs = abi.filter(x => x.type === 'function').map(f => ({ name: f.name, arity: (f.inputs || []).length }));
      const abiEvents = abi.filter(x => x.type === 'event').map(e => ({ name: e.name, arity: (e.inputs || []).length }));

      const srcParts = srcContent ? extractFunctionsAndEvents(srcContent) : { functions: [], events: [] };

      const srcFuncs = srcParts.functions;
      const srcEvents = srcParts.events;

      // if function exists in any ABI (interface/aux), consider it satisfied to avoid false positives
      const missingInAbi = srcFuncs.filter(sf => !abiFuncs.some(af => af.name === sf.name && af.arity === sf.arity) && !globalAbiFuncs.has(`${sf.name}/${sf.arity}`));
      const missingInSource = abiFuncs.filter(af => {
        if (srcFuncs.some(sf => sf.name === af.name && sf.arity === af.arity)) return false;
        if (ozFunctions.has(af.name)) return false;
        if (inheritedMissing[contractName]?.functions.has(af.name)) return false;
        return true;
      });
      const missingEventsInAbi = srcEvents.filter(se => !abiEvents.some(ae => ae.name === se.name && ae.arity === se.arity));
      const missingEventsInSource = abiEvents.filter(ae => {
        if (srcEvents.some(se => se.name === ae.name && se.arity === ae.arity)) return false;
        if (ozEvents.has(ae.name)) return false;
        if (inheritedMissing[contractName]?.events.has(ae.name)) return false;
        return true;
      });

      // detect public state variables (and constants/arrays/mappings) in source and treat them as present in source
      const publicVars = [];
      if (srcContent) {
        // match patterns like: 'uint256 public name;', 'uint256 public constant NAME = 1;', 'uint16[10] public immutable arr;'
        const varRe = /public(?:\s+[A-Za-z_][A-Za-z0-9_]*)*\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|;)/g;
        let v;
        while ((v = varRe.exec(srcContent)) !== null) {
          publicVars.push(v[1]);
        }
      }
      // attach detected publicVars to report for later filtering
      const prev = report.contracts[contractName] || {};
      report.contracts[contractName] = Object.assign(prev, {
        abiFile: path.relative(process.cwd(), abiPath),
        sourceFile: srcPath ? path.relative(process.cwd(), srcPath) : null,
        abiFunctionCount: abiFuncs.length,
        srcFunctionCount: srcFuncs.length,
        missingInAbi,
        missingInSource,
        abiEventCount: abiEvents.length,
        srcEventCount: srcEvents.length,
        missingEventsInAbi,
        missingEventsInSource
      , publicVars });

    } catch (err) {
      console.error('Error processing', abiF, err);
    }
  }

  // summary
  let total = 0, issues = 0;
  for (const k of Object.keys(report.contracts)) {
    total++;
    const c = report.contracts[k];
    const hasIssues = (c.missingInAbi && c.missingInAbi.length) || (c.missingInSource && c.missingInSource.length) || (c.missingEventsInAbi && c.missingEventsInAbi.length) || (c.missingEventsInSource && c.missingEventsInSource.length);
    if (hasIssues) {
      // filter out ABI getters that match publicVars
      if (c.missingInSource && c.publicVars && c.publicVars.length) {
        c.missingInSource = c.missingInSource.filter(m => !c.publicVars.includes(m.name));
      }
      if (c.missingInSource && c.missingInSource.length) issues++;
      else report.contracts[k] = c; // no remaining issues after filtering
    }
  }
  report.summary.totalContracts = total;
  report.summary.contractsWithIssues = issues;

  const outDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'compareAbiToSource.report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log('Report written to', outFile);
  console.log('Summary:', report.summary);
}

main().catch(e => { console.error(e); process.exit(1); });
