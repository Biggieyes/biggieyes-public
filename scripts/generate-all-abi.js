// generate-all-abi.js
// Node.js skript pro generování ABI ze všech .sol souborů (kromě SETTER* a BiggiMain) ve složce BIGGIEYESOFFICIALTESTNET
// Vyžaduje: npm install solc glob


import fs from "fs";
import path from "path";
import { globSync } from "glob";
import solc from "solc";


const SOL_DIRS = [
  "biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGIEYESOFFICIALTESTNET",
];
const ABI_DIR = "src/utils/abi";
const REPORT_PATH = "abi_diff_report.md";

// Seznam kontraktů, pro které se má generovat ABI
const CONTRACT_WHITELIST = [
  "BIGGIEYESMAIN2",
  "BIGGIEYESMAIN",
  "BIGGICOLLECTIONREWARDS",
  "BIGGICOMMUNITYCENTER",
  "MULTICOLLECTIONDISTRIBUTOR",
  "DRIPDISTRIBUTOR",
  "DRIPKEEPERPROXY",
  "BIGGIDRIPLIQUIDITYMANAGER",
  "FACTORYWRAPPER",
  "LIQUIDITYAUTOMATION",
  "BIGGINFTREWARDS",
  "UNISWAPV2PAIR",
  "BIGGIPOLICY",
  "BIGGIRESEVE",
  "ROUTERWRAPPER",
  "BIGGITREASURY",
  "WETH9",
  "LIQUIDITYVAULT",
  "BIGGICOMPUTE",
  "BIGGITOKEN",
  "BIGGIBUYBACKAGENT",
  "BIGGILIQUIDITYMANAGER",
  "BIGGITOKENREWARDS",
  "BIGGITOKENOMIKREADER",
  "BIGGIREADER",
  "BIGGIVRFROUTER",
  "KEEPERPROXY",
  "BIGGIBUYBACKKEEPERPROXY",
  "BIGGIBUYBACKDRIPSETUP",
  "LIQUIDITYSETUP",
  "BIGGILPPRICEFEED",
  "BIGGIREWARDSREADER",
  "BIGGITREASURYREADER",
  "BIGGIVRFREADER",
  "BIGGIBUYBACKREADER",
  "BIGGIDRIPREADER",
  "BIGGILIQUIDITYVAULTREADER",
  "BIGGIMULTICOLLECTIONDISTRIBUTORREADER",
  "MODERATORCENTER"
];

function isExcluded(file) {
  const rel = file.replace(/\\/g, "/");
  // Vyloučí všechny soubory ve složce SETTERSCRYPT
  if (/\/SETTERSCRYPT\//i.test(rel)) {
    console.log(`[EXCLUDE] ${rel} — složka SETTERSCRYPT`);
    return true;
  }
  // Vyloučí pouze přesně BiggiMain.sol
  if (/\/BiggiMain\.sol$/i.test(rel)) {
    console.log(`[EXCLUDE] ${rel} — přesně BiggiMain.sol`);
    return true;
  }
  return false;
}

function getContractName(file) {
  return path.basename(file, ".sol");
}

function getMainContractName(source, fallback) {
  // Najde první contract <Name> v souboru, jinak použije fallback
  const m = source.match(/contract\s+(\w+)/);
  return m ? m[1] : fallback;
}


function compileAndWriteAllABIs(solPath, outDir) {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const source = fs.readFileSync(solPath, "utf8");
  const input = {
    language: "Solidity",
    sources: { [path.basename(solPath)]: { content: source } },
    settings: { outputSelection: { "*": { "*": ["abi"] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (!output.contracts) {
    console.error(`Chyba při kompilaci ${solPath}`);
    return [];
  }
  const fileContracts = output.contracts[path.basename(solPath)];
  const results = [];
  for (const contractName in fileContracts) {
    const abiObj = fileContracts[contractName];
    if (!abiObj || !abiObj.abi) {
      console.error(`Nenalezen kontrakt ${contractName} v ${solPath}`);
      continue;
    }
    const abi = abiObj.abi;
    const abiFile = path.join(outDir, `${contractName}.json`);
    fs.writeFileSync(abiFile, JSON.stringify(abi, null, 2));
    console.log(`ABI vygenerováno: ${abiFile}`);
    results.push({ name: contractName, abi, abiFile });
  }
  return results;
}

function removeStaleAbi(solFiles, abiDir) {
  const solNames = new Set(solFiles.map(f => getMainContractName(fs.readFileSync(f, "utf8"), getContractName(f))));
  const abiFiles = globSync(`${abiDir}/*.json`, { nodir: true });
  for (const abiFile of abiFiles) {
    const base = path.basename(abiFile, ".json");
    if (!solNames.has(base)) {
      fs.unlinkSync(abiFile);
      console.log(`Smazáno staré ABI: ${abiFile}`);
    }
  }
}

function abiDiff(abiA, abiB) {
  // Vrací {missing:[], extra:[]} podle jmen funkcí
  const fnsA = new Set((abiA||[]).filter(e=>e.type==="function").map(e=>e.name));
  const fnsB = new Set((abiB||[]).filter(e=>e.type==="function").map(e=>e.name));
  return {
    missing: [...fnsA].filter(x=>!fnsB.has(x)),
    extra: [...fnsB].filter(x=>!fnsA.has(x)),
  };
}



function main() {
  let allSolFiles = [];
  for (const dir of SOL_DIRS) {
    allSolFiles = allSolFiles.concat(globSync(`${dir}/**/*.sol`, { nodir: true }));
  }
  // Přidej všechny interface .sol soubory
  const interfaceFiles = globSync("biggi-project/bekend/contracts/default_workspace (10)/contracts/**/*.sol", { nodir: true }).filter(f => /\/I[^/]+\.sol$/i.test(f));
  allSolFiles = allSolFiles.concat(interfaceFiles);
  console.log(`Nalezeno .sol souborů: ${allSolFiles.length}`);
  const solFiles = [];
  // Prepare lowercase whitelist for case-insensitive comparison
  const whitelistLower = CONTRACT_WHITELIST.map(n => n.toLowerCase());
  for (const f of allSolFiles) {
    if (!isExcluded(f)) {
      // Zjisti názvy kontraktů v souboru
      const source = fs.readFileSync(f, "utf8");
      const contractNames = [];
      const regex = /contract\s+(\w+)/g;
      let match;
      while ((match = regex.exec(source)) !== null) {
        contractNames.push(match[1]);
      }
      // Pokud alespoň jeden kontrakt v souboru je v whitelistu (case-insensitive), přidej soubor
      if (contractNames.some(name => whitelistLower.includes(name.toLowerCase()))) {
        const includedNames = contractNames.filter(n => whitelistLower.includes(n.toLowerCase()));
        console.log(`[INCLUDE] ${f} (kontrakty: ${includedNames.join(", ")})`);
        solFiles.push(f);
      }
    }
  }
  console.log(`Vybráno pro ABI: ${solFiles.length} souborů.`);
  removeStaleAbi(solFiles, ABI_DIR);
  const report = [];
  for (const file of solFiles) {
    console.log(`[KOMPILUJI] ${file}`);
    const results = compileAndWriteAllABIs(file, ABI_DIR);
    if (!results.length) {
      console.log(`[CHYBA] Kompilace selhala nebo nenalezen žádný kontrakt: ${file}`);
      continue;
    }
    for (const result of results) {
      // Generuj ABI pouze pro kontrakty z whitelistu (case-insensitive)
      if (!whitelistLower.includes(result.name.toLowerCase())) continue;
      const abiPath = path.join(ABI_DIR, `${result.name}.json`);
      let oldAbi = null;
      try { oldAbi = JSON.parse(fs.readFileSync(abiPath+".bak", "utf8")); } catch { /* ignore if backup does not exist */ }
      if (oldAbi) {
        const diff = abiDiff(result.abi, oldAbi);
        if (diff.missing.length || diff.extra.length) {
          report.push(`### ${result.name}\n- missing: ${diff.missing.join(", ")}`);
          report.push(`- extra: ${diff.extra.join(", ")}`);
        }
      }
      // Záloha starého ABI
      if (fs.existsSync(abiPath)) {
        fs.copyFileSync(abiPath, abiPath+".bak");
      }
      fs.writeFileSync(abiPath, JSON.stringify(result.abi, null, 2));
    }
  }
  if (report.length) {
    fs.writeFileSync(REPORT_PATH, report.join("\n"));
    console.log(`\nReport rozdílů uložen do ${REPORT_PATH}`);
  } else {
    fs.writeFileSync(REPORT_PATH, "Všechny ABI odpovídají hlavním kontraktům.");
    console.log("\nVšechny ABI odpovídají hlavním kontraktům.");
  }
}

main();
