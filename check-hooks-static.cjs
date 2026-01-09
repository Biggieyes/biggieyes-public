// Usage: node check-hooks-static.js [srcDir]
// Scans use*.{js,ts,jsx,tsx} files and checks basic hook patterns.

const fs = require("fs");
const path = require("path");
const glob = require("glob");
const chalkModule = require("chalk");
const chalk = chalkModule.default || chalkModule;
const babelParser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const src = process.argv[2] || "src";
const patterns = [
  `${src}/**/use*.js`,
  `${src}/**/use*.jsx`,
  `${src}/**/use*.ts`,
  `${src}/**/use*.tsx`,
];

function parseCode(code, file) {
  try {
    return babelParser.parse(code, {
      sourceType: "module",
      plugins: [
        "jsx",
        "typescript",
        "classProperties",
        "optionalChaining",
        "nullishCoalescingOperator",
        "objectRestSpread",
      ],
    });
  } catch (e) {
    console.error(chalk.red(`[PARSE ERROR] ${file}: ${e.message}`));
    return null;
  }
}

function analyzeFile(file) {
  const code = fs.readFileSync(file, "utf8");
  const ast = parseCode(code, file);
  if (!ast) return { file, error: "parse error" };

  const info = {
    file,
    exportsFunction: false,
    usesUseEffect: false,
    usesUseState: false,
    usesUseMemo: false,
    usesProvider: false,
    usesEthersContract: false,
    importsAbiOrAddr: false,
    notes: [],
  };

  traverse(ast, {
    ExportDefaultDeclaration(pathNode) {
      const decl = pathNode.node.declaration;
      if (
        decl.type === "FunctionDeclaration" ||
        decl.type === "ArrowFunctionExpression"
      ) {
        info.exportsFunction = true;
      } else if (decl.type === "Identifier") {
        info.exportsFunction = true;
      }
    },
    ExportNamedDeclaration(pathNode) {
      if (
        pathNode.node.declaration &&
        pathNode.node.declaration.type === "FunctionDeclaration"
      ) {
        info.exportsFunction = true;
      }
      if (
        pathNode.node.specifiers &&
        pathNode.node.specifiers.length > 0 &&
        pathNode.node.source
      ) {
        info.exportsFunction = true;
        info.notes.push("re-export detected");
      }
    },
    CallExpression(pathNode) {
      const callee = pathNode.node.callee;
      if (callee.type === "Identifier" && callee.name === "useEffect") {
        info.usesUseEffect = true;
      }
      if (callee.type === "Identifier" && callee.name === "useState") {
        info.usesUseState = true;
      }
      if (callee.type === "Identifier" && callee.name === "useMemo") {
        info.usesUseMemo = true;
      }
      if (
        callee.type === "MemberExpression" &&
        callee.object &&
        callee.object.type === "Identifier" &&
        callee.object.name === "React" &&
        callee.property &&
        callee.property.type === "Identifier"
      ) {
        if (callee.property.name === "useEffect") info.usesUseEffect = true;
        if (callee.property.name === "useState") info.usesUseState = true;
        if (callee.property.name === "useMemo") info.usesUseMemo = true;
      }
      if (
        (callee.type === "MemberExpression" &&
          callee.object.name === "ethers" &&
          callee.property.name === "Contract") ||
        (callee.type === "Identifier" && callee.name === "Contract")
      ) {
        info.usesEthersContract = true;
      }
    },
    ImportDeclaration(pathNode) {
      const srcVal = pathNode.node.source.value;
      if (/ethers|web3|@web3modal|wagmi|web3modal|@walletconnect|viem/.test(srcVal)) {
        info.usesProvider = true;
      }
      if (/\.(json)$/.test(srcVal) || /abi/i.test(srcVal)) {
        info.importsAbiOrAddr = true;
      }
      if (/addresses|contract|abi|utils\/contract/i.test(srcVal)) {
        info.importsAbiOrAddr = true;
      }
    },
    Identifier(pathNode) {
      if (
        pathNode.node.name === "provider" ||
        pathNode.node.name === "getProvider" ||
        (pathNode.node.name === "window" &&
          pathNode.parent &&
          pathNode.parent.property &&
          pathNode.parent.property.name === "ethereum")
      ) {
        info.usesProvider = true;
      }
      if (
        pathNode.node.name === "window" &&
        pathNode.parent &&
        pathNode.parent.property &&
        pathNode.parent.property.name === "ethereum"
      ) {
        info.usesProvider = true;
      }
    },
  });

  traverse(ast, {
    VariableDeclarator(pathNode) {
      if (
        pathNode.node.id &&
        pathNode.node.id.name &&
        /^use[A-Z0-9].*/.test(pathNode.node.id.name)
      ) {
        if (
          pathNode.node.init &&
          (pathNode.node.init.type === "ArrowFunctionExpression" ||
            pathNode.node.init.type === "FunctionExpression")
        ) {
          info.exportsFunction = info.exportsFunction || false;
          info.notes.push(`has hook declaration ${pathNode.node.id.name}`);
        }
      }
    },
  });

  if (!info.exportsFunction)
    info.notes.push(
      "nenalezen export funkce; zkontroluj, zda je hook exportovan",
    );
  if (!info.usesUseEffect && !info.usesUseState)
    info.notes.push(
      "nepouzit useEffect/useState - neni to typicky React hook?",
    );
  if (!info.usesProvider && !info.importsAbiOrAddr)
    info.notes.push(
      "neobsahuje zjevne volani provider/ABI - muze jit o UI-only hook",
    );

  return info;
}

async function main() {
  console.log(chalk.blue(`Scanning for hooks in ${src} ...`));
  const files = patterns.flatMap((p) => glob.sync(p, { nodir: true }));
  if (files.length === 0) {
    console.log(
      chalk.yellow("Nenalezeny hooky (use*). Prekontroluj pattern / path."),
    );
    return;
  }
  const results = [];
  for (const f of files) {
    try {
      const r = analyzeFile(f);
      results.push(r);
    } catch (e) {
      console.error(chalk.red(`Chyba pri analyzovani ${f}: ${e.message}`));
    }
  }

  for (const r of results) {
    console.log("--------------------------------------------");
    console.log(chalk.cyan(r.file));
    if (r.error) {
      console.log(chalk.red(`  ERROR: ${r.error}`));
      continue;
    }
    console.log(
      `  exportsHookFunction: ${r.exportsFunction ? chalk.green("OK") : chalk.red("NO")}`,
    );
    console.log(
      `  usesUseEffect: ${r.usesUseEffect ? chalk.green("OK") : chalk.yellow("NO")}`,
    );
    console.log(
      `  usesUseState: ${r.usesUseState ? chalk.green("OK") : chalk.yellow("NO")}`,
    );
    console.log(
      `  usesProvider/ethers: ${
        r.usesProvider || r.usesEthersContract
          ? chalk.green("OK")
          : chalk.yellow("NO")
      }`,
    );
    console.log(
      `  imports ABI/addresses: ${
        r.importsAbiOrAddr ? chalk.green("OK") : chalk.yellow("NO")
      }`,
    );
    if (r.notes && r.notes.length) {
      console.log("  NOTES:");
      for (const n of r.notes) console.log("   -", n);
    }
  }
  console.log("--------------------------------------------");
  console.log(chalk.green("Static scan done."));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
