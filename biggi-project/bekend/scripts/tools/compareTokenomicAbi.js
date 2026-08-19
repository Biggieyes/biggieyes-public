#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readJson(file){ return JSON.parse(fs.readFileSync(file,'utf8')); }
function walk(dir, list = []){
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for(const e of entries){
    const p = path.join(dir, e.name);
    if(e.isDirectory()) walk(p, list);
    else if(e.isFile() && p.endsWith('.sol')) list.push(p);
  }
  return list;
}
function stripComments(src){ return src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,''); }
function extractFromSource(src){
  const cleaned = stripComments(src);
  const funcs = [];
  const events = [];
  const varNames = [];

  const funcRe = /function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*([^;{\n]*)/g;
  let m;
  while((m = funcRe.exec(cleaned)) !== null){
    const name = m[1];
    const params = m[2].trim();
    const tail = (m[3]||'').toLowerCase();
    const arity = params === '' ? 0 : params.split(',').filter(p=>p.trim()!=='').length;
    if(tail.includes('public') || tail.includes('external')) funcs.push({name,arity});
  }

  const eventRe = /event\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g;
  while((m = eventRe.exec(cleaned)) !== null){
    const name = m[1];
    const params = m[2].trim();
    const arity = params === '' ? 0 : params.split(',').filter(p=>p.trim()!=='').length;
    events.push({name,arity});
  }

  // match patterns like: 'uint256 public name;', 'IERC20 public immutable NAME = ...;',
  // and mapping types: 'mapping(uint256 => mapping(uint8 => uint256)) public weekUniqueCount;'
  const varRe = /([A-Za-z0-9_\(\)\[\]>=>,<\s]+)\s+(public|internal|private|external)\b[^;=\n]*\s([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|;)/g;
  while((m = varRe.exec(cleaned)) !== null){
    varNames.push(m[3]);
  }

  return {funcs, events, varNames};
}

async function main(){
  const base = path.join(__dirname, '..', '..', 'contracts', 'default_workspace (10)', 'contracts', 'BIGGI_MASTER', 'TOKENOMICMAINNET');
  const abiDir = path.join(base, 'ABI');
  const indexFile = path.join(abiDir, 'index.json');
  if(!fs.existsSync(abiDir) || !fs.existsSync(indexFile)){
    console.error('ABI dir or index.json not found at', abiDir);
    process.exit(1);
  }
  const index = readJson(indexFile);
  // search Solidity files across the repository 'contracts' folder so OZ and shared helpers are found
  const contractsRoot = path.join(__dirname, '..', '..', 'contracts');
  const solFiles = walk(contractsRoot);

  const report = { summary:{}, contracts: {} };

  // common inherited / standard functions and events we should not treat as missing
  const ozFunctions = new Set([
    'approve','getApproved','setApprovalForAll','isApprovedForAll','transferFrom','safeTransferFrom','balanceOf','ownerOf',
    'name','symbol','decimals','totalSupply','allowance','transfer','approve','renounceOwnership','transferOwnership','owner','paused',
    // ERC2612 / EIP-712 related
    'permit','nonces','DOMAIN_SEPARATOR','eip712Domain',
    // burn helpers and ownership helpers
    'burn','burnFrom','acceptOwnership','pendingOwner'
  ]);
  const ozEvents = new Set(['Approval','ApprovalForAll','Transfer','OwnershipTransferred','Paused','Unpaused','EIP712DomainChanged','InitialDistribution','RescueERC20','OwnershipTransferStarted']);

  // manual allow-list for known project-specific getters / inherited helpers
  const manualAllow = new Set([
    'acceptOwnership','pendingOwner','burn','burnFrom',
    // ModeratorCenter mapping getters and related
    'milestonePaid','reporters','usedThisWeekForSlot','usedThisWeekGlobally','weekAllocated','weekDistributed','weekTicketCount','weekUniqueCount'
  ]);

  // build map from solidity file content to declared symbols for quick lookup
  const solByName = new Map();
  for (const sf of solFiles) {
    try {
      const txt = fs.readFileSync(sf, 'utf8');
      const declRe = /\b(?:contract|library|interface)\s+([A-Za-z0-9_]+)/g;
      let mm;
      while ((mm = declRe.exec(txt)) !== null) {
        const name = mm[1];
        if (!solByName.has(name)) solByName.set(name, sf);
      }
    } catch (e) { /* ignore */ }
  }

  function mergeParts(target, add) {
    // merge funcs by name/arity
    const fnSet = new Set(target.funcs.map(f => f.name + '/' + f.arity));
    for (const f of add.funcs) {
      const key = f.name + '/' + f.arity;
      if (!fnSet.has(key)) { target.funcs.push(f); fnSet.add(key); }
    }
    const evSet = new Set(target.events.map(e => e.name + '/' + e.arity));
    for (const e of add.events) {
      const key = e.name + '/' + e.arity;
      if (!evSet.has(key)) { target.events.push(e); evSet.add(key); }
    }
    const varSet = new Set(target.varNames);
    for (const v of add.varNames) if (!varSet.has(v)) { target.varNames.push(v); varSet.add(v); }
  }

  function gatherPartsForSymbol(symName, visited = new Set()) {
    if (visited.has(symName)) return {funcs:[], events:[], varNames:[]};
    visited.add(symName);
    const file = solByName.get(symName);
    if (!file) return {funcs:[], events:[], varNames:[]};
    const content = fs.readFileSync(file, 'utf8');
    // find declaration for this symbol
    const declRe = new RegExp('\\b(?:contract|library|interface)\\s+' + symName + '\\b([^\n{]*){');
    const m = declRe.exec(content);
    let body = content;
    if (m) {
      const startIdx = content.indexOf('{', m.index);
      if (startIdx !== -1) {
        let i = startIdx + 1, depth = 1;
        while (i < content.length && depth > 0) {
          const ch = content[i];
          if (ch === '{') depth++; else if (ch === '}') depth--;
          i++;
        }
        body = content.slice(startIdx + 1, i - 1);
      }
    }
    const parts = extractFromSource(body);
    // parse inheritance from the declaration line
    const inhRe = new RegExp('\\b(?:contract|library|interface)\\s+' + symName + '\\s+is\\s+([^\{\\n]+)');
    const inh = inhRe.exec(content);
    if (inh) {
      const bases = inh[1].split(',').map(s=>s.trim().replace(/[,\s]+/g,'')).filter(Boolean);
      for (const b of bases) {
        const baseParts = gatherPartsForSymbol(b, visited);
        mergeParts(parts, baseParts);
      }
    }
    return parts;
  }

  const backendRoot = path.resolve(__dirname, '..', '..');
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  function resolveArtifactPath(artifactRel) {
    if (path.isAbsolute(artifactRel)) return artifactRel;
    let normalized = artifactRel.replace(/\\/g, '/');
    const repoName = path.basename(repoRoot);
    const repoParent = path.basename(path.dirname(repoRoot));
    const prefix1 = `${repoName}/`;
    const prefix2 = `${repoParent}/${repoName}/`;
    if (normalized.startsWith(prefix1)) normalized = normalized.slice(prefix1.length);
    else if (normalized.startsWith(prefix2)) normalized = normalized.slice(prefix2.length);
    return path.join(repoRoot, normalized);
  }

  function resolveSourcePath(sourceName) {
    if (!sourceName) return null;
    if (path.isAbsolute(sourceName) && fs.existsSync(sourceName) && fs.statSync(sourceName).isFile()) return sourceName;
    const normalized = sourceName.replace(/\\/g, '/');
    const candidates = [
      path.join(backendRoot, normalized),
      path.join(repoRoot, normalized),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
  }

  let processingErrors = 0;

  for(const entry of index){
    try{
      const abiPath = path.join(abiDir, entry.output);
      const abi = readJson(abiPath);
      const contractName = entry.contract;
      const artifactPath = resolveArtifactPath(entry.artifact || '');
      let src = null;
      let artifact = null;
      if (artifactPath && fs.existsSync(artifactPath)) {
        artifact = readJson(artifactPath);
        src = resolveSourcePath(artifact.sourceName);
      }
      if (!src) {
        src = solFiles.find(sf => {
          const c = fs.readFileSync(sf,'utf8');
          return new RegExp('\\b(?:contract|library|interface)\\s+' + contractName + '\\b').test(c);
        });
      }
      if (src) solByName.set(contractName, src);
      let srcContent = src ? fs.readFileSync(src,'utf8') : null;
      const abiFuncs = abi.filter(x=>x.type==='function').map(f=>({name:f.name,arity:(f.inputs||[]).length}));
      const abiEvents = abi.filter(x=>x.type==='event').map(e=>({name:e.name,arity:(e.inputs||[]).length}));

      // gather parts including inherited members
      let srcParts = {funcs:[], events:[], varNames:[]};
      if (srcContent) {
        srcParts = gatherPartsForSymbol(contractName);
      } else if (solByName.has(contractName)) {
        srcParts = gatherPartsForSymbol(contractName);
      }

      const missingInAbi = srcParts.funcs.filter(sf => !abiFuncs.some(af => af.name===sf.name && af.arity===sf.arity) && !ozFunctions.has(sf.name));
      const missingInSource = abiFuncs.filter(af => !srcParts.funcs.some(sf => sf.name===af.name && sf.arity===af.arity) && !ozFunctions.has(af.name));
      const missingEventsInAbi = srcParts.events.filter(se => !abiEvents.some(ae=>ae.name===se.name && ae.arity===se.arity) && !ozEvents.has(se.name));
      const missingEventsInSource = abiEvents.filter(ae => !srcParts.events.some(se=>se.name===ae.name && se.arity===ae.arity) && !ozEvents.has(ae.name));

      // filter out getters for public vars
      // consider ABI functions satisfied if a matching function exists anywhere in the repo (interfaces / shared defs)
      function existsInAnySol(name, arity) {
        for (const sf of solFiles) {
          try {
            const txt = fs.readFileSync(sf,'utf8');
            const parts = extractFromSource(txt);
            if (parts.funcs.some(f=>f.name===name && f.arity===arity)) return true;
            if (parts.events.some(e=>e.name===name && e.arity===arity)) return true;
            if ((parts.varNames||[]).includes(name)) return true;
          } catch (e) { }
        }
        return false;
      }

      let filteredMissingInSource = missingInSource.filter(m=> !(srcParts.varNames||[]).includes(m.name));
      filteredMissingInSource = filteredMissingInSource.filter(m => !existsInAnySol(m.name, m.arity));
      // allow manual project-specific names (ownership helpers, burn, mapping getters)
      filteredMissingInSource = filteredMissingInSource.filter(m => !manualAllow.has(m.name));

      report.contracts[contractName] = {
        contract: contractName,
        abiFile: path.relative(process.cwd(), abiPath),
        sourceFile: src ? path.relative(process.cwd(), src) : null,
        abiFunctionCount: abiFuncs.length,
        srcFunctionCount: srcParts.funcs.length,
        missingInAbi,
        missingInSource: filteredMissingInSource,
        abiEventCount: abiEvents.length,
        srcEventCount: srcParts.events.length,
        missingEventsInAbi,
        missingEventsInSource,
        publicVars: srcParts.varNames
      };
    }catch(e){
      processingErrors++;
      console.error('error processing', entry.contract, e.stack||e);
    }
  }

  // also find ABI files not listed in index
  const abiFiles = fs.readdirSync(abiDir).filter(f=>f.endsWith('.abi.json'));
  for(const f of abiFiles){
    const name = f.replace(/\.abi\.json$/,'');
    if(!index.some(i=>i.contract===name)){
      report.contracts[name] = report.contracts[name] || { contract: name, abiFile: path.relative(process.cwd(), path.join(abiDir,f)), sourceFile: null, note: 'present in ABI dir but not in index.json' };
    }
  }

  // summary
  let total = 0, issues = 0;
  for(const k of Object.keys(report.contracts)){
    total++;
    const c = report.contracts[k];
    const hasIssues = (c.missingInAbi && c.missingInAbi.length) || (c.missingInSource && c.missingInSource.length) || (c.missingEventsInAbi && c.missingEventsInAbi.length) || (c.missingEventsInSource && c.missingEventsInSource.length) || (c.note);
    if(hasIssues) issues++;
  }
  report.summary.totalContracts = total;
  report.summary.contractsWithIssues = issues;
  report.summary.processingErrors = processingErrors;

  const outDir = path.join(__dirname, 'reports');
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive:true});
  const outFile = path.join(outDir, 'compareTokenomicAbi.report.json');
  fs.writeFileSync(outFile, JSON.stringify(report,null,2));
  console.log('Report written to', outFile);
  console.log('Summary:', report.summary);
  if (processingErrors > 0 || total === 0) {
    process.exitCode = 1;
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
