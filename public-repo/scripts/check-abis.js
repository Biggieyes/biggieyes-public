import fs from "fs";
import path from "path";
import process from "process";
import { globSync } from "glob";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const SRC_DIR = process.argv[2] || "src";
const ABI_DIRS = ["src/config/abi", "src/abis"];
const FILE_GLOBS = [
  `${SRC_DIR}/**/*.js`,
  `${SRC_DIR}/**/*.jsx`,
  `${SRC_DIR}/**/*.ts`,
  `${SRC_DIR}/**/*.tsx`,
];

const IGNORE_METHODS = new Set([
  "then",
  "catch",
  "finally",
  "map",
  "filter",
  "reduce",
  "forEach",
  "some",
  "every",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "sort",
  "slice",
  "concat",
  "join",
  "push",
  "pop",
  "shift",
  "unshift",
  "includes",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "bind",
  "call",
  "apply",
  "on",
  "off",
  "once",
  "addListener",
  "removeListener",
  "removeAllListeners",
  "listenerCount",
  "getBalance",
  "getAddress",
  "getNetwork",
  "getSigner",
  "listAccounts",
  "send",
  "getBlockNumber",
  "trim",
  "replace",
  "startsWith",
  "endsWith",
  "toLowerCase",
  "toUpperCase",
  "substring",
  "substr",
]);

// Runtime helpers injected in src/shared/utils/contract.js (_attachHelpers).
// They are valid call targets on merged helper contracts, but not ABI methods.
const RUNTIME_HELPER_METHODS = new Set([
  "claimStatus",
  "routerInfo",
  "getSwapPath",
  "liquidityPreview",
  "tokensOfOwner",
  "walletOfOwner",
  "tokenOfOwnerByIndex",
]);

const CONTRACT_FACTORY_RE =
  /^(get|create)[A-Z].*(Contract|Contracts|Reader|RO|RW)$/;
const CONTRACT_FACTORY_HINTS =
  /(Token|BUYBACK|Drip|DRIP|Reserve|Treasury|Policy|Liquidity|Vault|LM|Distributor|Router|Factory|Pair|Rewards|REWARDS|Vrf|VRF|NFT|Main)/;
const FACTORY_SKIP_RE = /(Provider|Signer|Rpc|Url|Config|Service)/;
const PROVIDER_FACTORY_NAMES = new Set([
  "getROProvider",
  "getSignerProvider",
  "getProvider",
  "getSharedFallbackProvider",
  "createFallbackProvider",
  "createJsonRpcProvider",
  "getRpcUrls",
  "getRpcUrl",
]);

function isContractFactoryName(name) {
  if (!name) return false;
  if (FACTORY_SKIP_RE.test(name)) return false;
  if (PROVIDER_FACTORY_NAMES.has(name)) return false;
  if (CONTRACT_FACTORY_RE.test(name)) return true;
  if (name.startsWith("get") && CONTRACT_FACTORY_HINTS.test(name)) return true;
  return false;
}

function shouldTrackFactoryImport(name) {
  if (!name) return false;
  if (FACTORY_SKIP_RE.test(name)) return false;
  if (PROVIDER_FACTORY_NAMES.has(name)) return false;
  return true;
}

function shouldSkipFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  if (
    lower.includes("mainheader") &&
    lower.includes("ecosystem") &&
    (lower.endsWith("/biggitokeninner.jsx") ||
      lower.endsWith("/biggitoken.jsx"))
  ) {
    return true;
  }
  return false;
}

function unwrapExpression(node) {
  if (!node) return node;
  if (node.type === "AwaitExpression") return unwrapExpression(node.argument);
  if (node.type === "TSAsExpression") return unwrapExpression(node.expression);
  if (node.type === "TSNonNullExpression")
    return unwrapExpression(node.expression);
  if (node.type === "TypeCastExpression")
    return unwrapExpression(node.expression);
  if (node.type === "ParenthesizedExpression")
    return unwrapExpression(node.expression);
  return node;
}

function getCalleeName(callee) {
  if (!callee) return null;
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && callee.property) {
    if (callee.property.type === "Identifier") return callee.property.name;
    if (callee.property.type === "StringLiteral") return callee.property.value;
  }
  return null;
}

function getPropertyName(node) {
  if (!node || !node.property || node.computed) return null;
  if (node.property.type === "Identifier") return node.property.name;
  if (node.property.type === "StringLiteral") return node.property.value;
  return null;
}

function getBaseIdentifier(node) {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (
    node.type === "MemberExpression" ||
    node.type === "OptionalMemberExpression"
  ) {
    return getBaseIdentifier(node.object);
  }
  return null;
}

function getContractBaseForCalleeObject(node, contractVars) {
  if (!node) return null;
  if (node.type === "Identifier" && contractVars.has(node.name)) {
    return node.name;
  }
  if (
    (node.type === "MemberExpression" ||
      node.type === "OptionalMemberExpression") &&
    node.property &&
    node.property.type === "Identifier" &&
    node.property.name === "current" &&
    node.object &&
    node.object.type === "Identifier" &&
    contractVars.has(node.object.name)
  ) {
    return node.object.name;
  }
  return null;
}

function resolveAbiSetFromArg(arg, abiImportMap, abiByFile) {
  if (!arg) return null;
  if (arg.type === "Identifier") {
    const importedPath = abiImportMap.get(arg.name);
    if (importedPath && abiByFile.has(importedPath)) {
      return abiByFile.get(importedPath);
    }
  }
  return null;
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeAbi(json) {
  if (!json) return null;
  if (Array.isArray(json)) {
    if (json.some((entry) => entry && entry.type)) return json;
    return null;
  }
  if (Array.isArray(json.abi)) return json.abi;
  if (Array.isArray(json.ABI)) return json.ABI;
  return null;
}

function loadAbiFunctions() {
  const abiByFile = new Map();
  const allFunctions = new Set();
  let abiFileCount = 0;

  const abiFiles = ABI_DIRS.flatMap((dir) =>
    globSync(`${dir}/**/*.json`, { nodir: true }),
  );

  for (const file of abiFiles) {
    const abs = path.resolve(file);
    const json = readJsonSafe(abs);
    const abi = normalizeAbi(json);
    if (!abi) continue;

    const fnSet = new Set();
    for (const entry of abi) {
      if (entry && entry.type === "function" && entry.name) {
        fnSet.add(entry.name);
        allFunctions.add(entry.name);
      }
    }
    if (fnSet.size) {
      abiByFile.set(abs, fnSet);
      abiFileCount += 1;
    }
  }

  return { abiByFile, allFunctions, abiFileCount };
}

function parseFile(filePath, abiByFile, allFunctions) {
  if (shouldSkipFile(filePath)) {
    return { file: filePath, parseError: null, missing: [] };
  }
  const code = fs.readFileSync(filePath, "utf8");
  let ast;
  try {
    ast = parse(code, {
      sourceType: "module",
      plugins: [
        "jsx",
        "typescript",
        "classProperties",
        "optionalChaining",
        "nullishCoalescingOperator",
        "objectRestSpread",
        "dynamicImport",
      ],
    });
  } catch (err) {
    return {
      file: filePath,
      parseError: err?.message || String(err),
      missing: [],
    };
  }

  const abiImportMap = new Map();
  const contractFactoryImports = new Set();
  const contractVars = new Map();
  const serviceVars = new Set();
  const missing = [];

  function markContractVar(name, abiSet = null, source = "unknown") {
    if (!name) return;
    const existing = contractVars.get(name);
    if (existing) {
      if (!existing.abiSet && abiSet) {
        contractVars.set(name, { abiSet, source });
      }
      return;
    }
    contractVars.set(name, { abiSet, source });
  }

  const traverseFn = traverseModule.default || traverseModule;
  traverseFn(ast, {
    ImportDeclaration(pathNode) {
      const source = pathNode.node.source.value;
      if (typeof source !== "string") return;
      if (source.endsWith(".json")) {
        for (const spec of pathNode.node.specifiers) {
          if (spec.type === "ImportDefaultSpecifier") {
            const abs = path.resolve(path.dirname(filePath), source);
            abiImportMap.set(spec.local.name, abs);
          }
        }
      }
      if (/utils\/contract|web3\/contracts/i.test(source)) {
        for (const spec of pathNode.node.specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            spec.imported &&
            spec.local
          ) {
            if (shouldTrackFactoryImport(spec.local.name)) {
              contractFactoryImports.add(spec.local.name);
            }
          }
        }
      }
    },
    VariableDeclarator(pathNode) {
      const id = pathNode.node.id;
      const initRaw = pathNode.node.init;
      const init = unwrapExpression(initRaw);
      if (!init) return;

      const handleIdentifier = (name) => {
        if (!name) return;
        if (init.type === "NewExpression") {
          const calleeName = getCalleeName(init.callee);
          if (calleeName !== "Contract") return;
          const abiSet = resolveAbiSetFromArg(
            init.arguments?.[1],
            abiImportMap,
            abiByFile,
          );
          markContractVar(name, abiSet, "new Contract");
          return;
        }

        if (init.type === "CallExpression") {
          const calleeName = getCalleeName(init.callee);
          if (calleeName && /Service$/.test(calleeName)) {
            serviceVars.add(name);
            return;
          }
          if (
            (calleeName &&
              (contractFactoryImports.has(calleeName) ||
                isContractFactoryName(calleeName))) ||
            (calleeName &&
              /Contracts$/.test(calleeName) &&
              !/^use[A-Z]/.test(calleeName))
          ) {
            markContractVar(name, null, calleeName);
            return;
          }
        }

        if (
          init.type === "MemberExpression" &&
          init.property &&
          init.property.type === "Identifier" &&
          init.property.name === "current"
        ) {
          const base = getBaseIdentifier(init.object);
          if (base && contractVars.has(base)) {
            const baseMeta = contractVars.get(base);
            markContractVar(name, baseMeta?.abiSet || null, "ref.current");
          }
        }

        if (init.type === "Identifier" && contractVars.has(init.name)) {
          const baseMeta = contractVars.get(init.name);
          markContractVar(name, baseMeta?.abiSet || null, "alias");
        }
      };

      if (id.type === "Identifier") {
        handleIdentifier(id.name);
        return;
      }

      if (id.type === "ObjectPattern") {
        if (init.type === "CallExpression") {
          const calleeName = getCalleeName(init.callee);
          if (
            calleeName &&
            (/Contracts$/.test(calleeName) ||
              contractFactoryImports.has(calleeName) ||
              isContractFactoryName(calleeName))
          ) {
            for (const prop of id.properties) {
              if (prop.type === "ObjectProperty") {
                if (prop.value.type === "Identifier") {
                  markContractVar(prop.value.name, null, calleeName);
                }
              } else if (prop.type === "RestElement") {
                if (prop.argument.type === "Identifier") {
                  markContractVar(prop.argument.name, null, calleeName);
                }
              }
            }
          }
        }
      }
    },
    AssignmentExpression(pathNode) {
      const left = pathNode.node.left;
      const right = unwrapExpression(pathNode.node.right);
      if (
        left &&
        (left.type === "MemberExpression" ||
          left.type === "OptionalMemberExpression") &&
        left.property &&
        left.property.type === "Identifier" &&
        left.property.name === "current"
      ) {
        const base = getBaseIdentifier(left.object);
        if (!base) return;
        if (!right) return;
        if (right.type === "NewExpression") {
          const calleeName = getCalleeName(right.callee);
          if (calleeName !== "Contract") return;
          const abiSet = resolveAbiSetFromArg(
            right.arguments?.[1],
            abiImportMap,
            abiByFile,
          );
          markContractVar(base, abiSet, "assign new Contract");
        } else if (right.type === "CallExpression") {
          const calleeName = getCalleeName(right.callee);
          if (calleeName && /Service$/.test(calleeName)) {
            serviceVars.add(base);
            return;
          }
          if (
            calleeName &&
            (contractFactoryImports.has(calleeName) ||
              isContractFactoryName(calleeName))
          ) {
            markContractVar(base, null, calleeName);
          }
        }
      }
    },
    CallExpression(pathNode) {
      const callee = pathNode.node.callee;
      if (
        callee.type !== "MemberExpression" &&
        callee.type !== "OptionalMemberExpression"
      ) {
        return;
      }
      const methodName = getPropertyName(callee);
      if (!methodName || IGNORE_METHODS.has(methodName)) return;
      if (RUNTIME_HELPER_METHODS.has(methodName)) return;

      const base = getContractBaseForCalleeObject(
        callee.object,
        contractVars,
      );
      if (!base) return;
      if (serviceVars.has(base)) return;

      const meta = contractVars.get(base);
      const abiSet = meta?.abiSet || null;
      const inAbi = abiSet
        ? abiSet.has(methodName)
        : allFunctions.has(methodName);
      if (!inAbi) {
        const loc = pathNode.node.loc?.start;
        missing.push({
          file: filePath,
          line: loc?.line || null,
          column: loc?.column || null,
          base,
          method: methodName,
          abiHint: meta?.source || "global",
        });
      }
    },
    OptionalCallExpression(pathNode) {
      const callee = pathNode.node.callee;
      if (
        callee.type !== "MemberExpression" &&
        callee.type !== "OptionalMemberExpression"
      ) {
        return;
      }
      const methodName = getPropertyName(callee);
      if (!methodName || IGNORE_METHODS.has(methodName)) return;
      if (RUNTIME_HELPER_METHODS.has(methodName)) return;

      const base = getContractBaseForCalleeObject(
        callee.object,
        contractVars,
      );
      if (!base) return;
      if (serviceVars.has(base)) return;

      const meta = contractVars.get(base);
      const abiSet = meta?.abiSet || null;
      const inAbi = abiSet
        ? abiSet.has(methodName)
        : allFunctions.has(methodName);
      if (!inAbi) {
        const loc = pathNode.node.loc?.start;
        missing.push({
          file: filePath,
          line: loc?.line || null,
          column: loc?.column || null,
          base,
          method: methodName,
          abiHint: meta?.source || "global",
        });
      }
    },
  });

  return { file: filePath, parseError: null, missing };
}

function formatLoc(entry) {
  const rel = path.relative(process.cwd(), entry.file);
  if (entry.line != null) return `${rel}:${entry.line}:${entry.column || 0}`;
  return rel;
}

function main() {
  const { abiByFile, allFunctions, abiFileCount } = loadAbiFunctions();
  const files = FILE_GLOBS.flatMap((pattern) =>
    globSync(pattern, { nodir: true }),
  ).filter((file) => !file.includes(`${path.sep}config${path.sep}abi`));

  let parseErrors = 0;
  const missingAll = [];

  for (const file of files) {
    const result = parseFile(file, abiByFile, allFunctions);
    if (result.parseError) {
      parseErrors += 1;
       
      console.warn(`[PARSE ERROR] ${file}: ${result.parseError}`);
      continue;
    }
    missingAll.push(...result.missing);
  }

   
  console.log(
    `ABI audit: ${files.length} files, ${abiFileCount} ABI files, ${allFunctions.size} functions`,
  );
  if (parseErrors) {
     
    console.log(`Parse errors: ${parseErrors}`);
  }

  if (!missingAll.length) {
     
    console.log("No missing ABI methods found (heuristic).");
    if (parseErrors) process.exitCode = 1;
    return;
  }

  missingAll.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if ((a.line || 0) !== (b.line || 0)) return (a.line || 0) - (b.line || 0);
    return (a.column || 0) - (b.column || 0);
  });

   
  console.log(`Missing ABI methods: ${missingAll.length}`);
  for (const entry of missingAll) {
     
    console.log(
      `- ${formatLoc(entry)} ${entry.base}.${entry.method} (hint: ${entry.abiHint})`,
    );
  }
  process.exitCode = 1;
}

main();
