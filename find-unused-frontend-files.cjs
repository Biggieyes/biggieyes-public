// Skript pro výpis nepoužívaných frontendových souborů ve složce src/
// Ulož jako find-unused-frontend-files.js do kořene projektu
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "src");
const ENTRY_FILES = [
  "main.jsx",
  "App.jsx",
  "app/AppCore.jsx",
  "app/App.jsx",
  "index.jsx",
].map(f => path.join(SRC_DIR, f)).filter(f => fs.existsSync(f));

const exts = [".js", ".jsx", ".ts", ".tsx"];
const allFiles = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (exts.includes(path.extname(f))) allFiles.push(p);
  }
}
walk(SRC_DIR);

const used = new Set();
function scan(file) {
  if (used.has(file)) return;
  used.add(file);
  const src = fs.readFileSync(file, "utf8");
  const importRegex = /import\s+(?:[^'\"]+from\s+)?['\"](.+?)['\"]/g;
  let m;
  while ((m = importRegex.exec(src))) {
    let imp = m[1];
    if (imp.startsWith(".")) {
      let resolved = path.resolve(path.dirname(file), imp);
      for (const ext of exts) {
        if (fs.existsSync(resolved + ext)) {
          scan(resolved + ext);
        }
      }
      if (fs.existsSync(resolved)) scan(resolved);
    }
  }
}
ENTRY_FILES.forEach(scan);

const unused = allFiles.filter(f => !used.has(f));
console.log("Nepoužívané soubory ve src/:");
unused.forEach(f => console.log(path.relative(SRC_DIR, f)));
