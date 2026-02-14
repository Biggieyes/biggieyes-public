// usage-report.mjs
// Node.js script to analyze used/unused frontend files in a Vite + React project
// Usage: node scripts/usage-report.mjs
// No heavy dependencies. Uses built-in modules and 'fast-glob' for file matching.
// If 'fast-glob' is not present, instruct user to install it (tiny, fast, MIT).

import fs from 'fs';
import path from 'path';

let fg;
try {
  fg = (await import('fast-glob')).default;
} catch {
  console.error('Please install fast-glob: npm i fast-glob');
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(''));
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}
const REPORT_DIR = path.join(ROOT, 'reports');
const ENTRY_CANDIDATES = [
  'src/main.jsx',
  'src/index.jsx',
  'src/main.tsx',
  'src/index.tsx',
];

const IGNORED_DIRS = [
  'node_modules', 'dist', 'build', '.netlify', 'coverage', 'reports', 'public',
];
const IGNORED_FILES = [/vite-env\.d\.ts$/, /\.d\.ts$/];
const TEST_PATTERNS = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/];

function isIgnored(file) {
  return IGNORED_DIRS.some(dir => file.includes(path.sep + dir + path.sep)) ||
    IGNORED_FILES.some(re => re.test(file));
}

function isTestFile(file) {
  return TEST_PATTERNS.some(re => re.test(file));
}

function readConfigAliases() {
  // Try to read aliases from vite.config.js, jsconfig.json, tsconfig.json
  // Only basic support (no full parsing)
  const aliases = [];
  const viteConfig = path.join(ROOT, 'vite.config.js');
  if (fs.existsSync(viteConfig)) {
    const txt = fs.readFileSync(viteConfig, 'utf8');
    // Match all alias objects: { find: ..., replacement: ... }
    const aliasArrayMatch = txt.match(/alias:\s*\[([\s\S]*?)\]/);
    if (aliasArrayMatch) {
      // Match both regex and string find
      for (const m of aliasArrayMatch[1].matchAll(/\{\s*find:\s*([^,]+),\s*replacement:\s*([^}]+)\}/g)) {
        let findRaw = m[1].trim();
        let replacementRaw = m[2].trim();
        // Parse find (regex or string)
        let find;
        if (/^\//.test(findRaw)) {
          // Regex, e.g. /^foo$/
          const regexMatch = findRaw.match(/^\/(.*)\/(\w*)$/);
          if (regexMatch) {
            find = new RegExp(regexMatch[1], regexMatch[2]);
          } else {
            find = findRaw;
          }
        } else {
          // String, e.g. 'foo'
          find = findRaw.replace(/^['"]|['"]$/g, '');
        }
        // Parse replacement (string or path)
        let replacement = replacementRaw.replace(/^['"]|['"]$/g, '');
        aliases.push({ find, replacement });
      }
    }
  }
  for (const cfg of ['jsconfig.json', 'tsconfig.json']) {
    const cfgPath = path.join(ROOT, cfg);
    if (fs.existsSync(cfgPath)) {
      try {
        const json = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        const paths = json.compilerOptions?.paths || json.paths;
        if (paths) {
          for (const [k, v] of Object.entries(paths)) {
            aliases.push({ find: k.replace(/\*$/, ''), replacement: v[0].replace(/\*$/, '') });
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }
  return aliases;
}

function resolveImport(importPath, fromFile, aliases) {
  if (!importPath) return null;
  // Remove query/hash (e.g. ?v=123)
  importPath = importPath.replace(/[?#].*$/, '');
  // Try all possible extensions
  const tryExtensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'];
  if (importPath.startsWith('.')) {
    // relative
    for (const ext of tryExtensions) {
      const abs = path.resolve(path.dirname(fromFile), importPath + ext);
      if (fs.existsSync(abs)) return abs.replace(/\\/g, '/');
    }
    return null;
  }
  for (const alias of aliases) {
    if (typeof alias.find === 'string') {
      if (importPath.startsWith(alias.find)) {
        for (const ext of tryExtensions) {
          const abs = path.resolve(ROOT, alias.replacement + importPath.slice(alias.find.length) + ext);
          if (fs.existsSync(abs)) return abs.replace(/\\/g, '/');
        }
      }
    } else if (alias.find instanceof RegExp) {
      if (alias.find.test(importPath)) {
        // Replace using regex
        const replaced = importPath.replace(alias.find, alias.replacement);
        for (const ext of tryExtensions) {
          const abs = path.resolve(ROOT, replaced + ext);
          if (fs.existsSync(abs)) return abs.replace(/\\/g, '/');
        }
      }
    }
  }
  // Try node_modules (not tracked as used file)
  try {
    require.resolve(importPath, { paths: [ROOT] });
    return null; // node_modules, skip
  } catch {}
  // Unresolved
  return null;
}

async function main() {
  // 1. Find all candidate files

  let files = await fg([
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__*__/**',
    '!src/**/test/**',
    '!src/**/tests/**',
    '!src/**/spec/**',
    '!src/**/stories/**',
    '!src/**/mocks/**',
    '!src/**/mock/**',
    '!src/**/fixtures/**',
    '!src/**/setupTests.*',
  ], { dot: true, absolute: true });
  files = files.map(normalizePath);

  const aliases = readConfigAliases();

  // 2. Find entrypoints
  let entrypoints = ENTRY_CANDIDATES
    .map(f => normalizePath(path.join(ROOT, f)))
    .filter(f => fs.existsSync(f));
  // Also check vite.config.js for custom entry
  const viteConfig = path.join(ROOT, 'vite.config.js');
  if (fs.existsSync(viteConfig)) {
    const txt = fs.readFileSync(viteConfig, 'utf8');
    const match = txt.match(/input:\s*['"](.+?)['"]/);
    if (match) {
      const customEntry = normalizePath(path.resolve(ROOT, match[1]));
      if (fs.existsSync(customEntry)) entrypoints.push(customEntry);
    }
  }

  // 3. Build import graph
  const importGraph = {};
  const unresolvedImports = new Set();
  for (const file of files) {
    if (isIgnored(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const imports = [];
    // static imports
    for (const m of content.matchAll(/import\s+(?:[^'"()]+from\s+)?['"]([^'"]+)['"]/g)) {
      imports.push(m[1]);
    }
    // dynamic imports
    for (const m of content.matchAll(/import\((['"])([^'"]+)\1\)/g)) {
      imports.push(m[2]);
    }
    // React.lazy(() => import(...))
    for (const m of content.matchAll(/React\.lazy\(\(\)\s*=>\s*import\((['"])([^'"]+)\1\)\)/g)) {
      imports.push(m[2]);
    }
    // dynamic (unresolved) imports
    for (const m of content.matchAll(/import\(([^)]+)\)/g)) {
      if (!/^['"]/.test(m[1])) unresolvedImports.add(m[1]);
    }
    importGraph[file] = imports.map(imp => {
      const resolved = resolveImport(imp, file, aliases);
      return resolved ? normalizePath(resolved) : null;
    }).filter(Boolean);
  }

  // 4. Traverse from entrypoints
  const used = new Set();
  const stack = [...entrypoints];
  while (stack.length) {
    const f = normalizePath(stack.pop());
    if (!f || used.has(f)) continue;
    used.add(f);
    for (const dep of importGraph[f] || []) {
      if (!used.has(dep)) stack.push(dep);
    }
  }

  // 5. Classify files
  const usedFiles = Array.from(used).filter(f => files.includes(f));
  const unusedFiles = files.filter(f => !used.has(f) && !isTestFile(f));
  const notes = [];
  // test files not imported
  const testFiles = files.filter(isTestFile).filter(f => !used.has(f));
  if (testFiles.length) notes.push('Test files not imported at runtime: ' + testFiles.length);

  // 6. Write JSON report
  const report = {
    entrypoints,
    usedFiles,
    unusedFiles,
    unresolvedImports: Array.from(unresolvedImports),
    notes,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'usage-report.json'), JSON.stringify(report, null, 2));

  // 7. Write Markdown report
  let md = '# Usage Report\n\n';
  md += '## USED FILES\n';
  md += usedFiles.map(f => '- ' + path.relative(ROOT, f)).join('\n') + '\n\n';
  md += '## UNUSED FILES\n';
  md += unusedFiles.map(f => '- ' + path.relative(ROOT, f)).join('\n') + '\n\n';
  md += '## UNRESOLVED IMPORTS\n';
  md += report.unresolvedImports.map(f => '- ' + f).join('\n') + '\n\n';
  if (notes.length) {
    md += '## NOTES\n' + notes.join('\n') + '\n';
  }
  fs.writeFileSync(path.join(REPORT_DIR, 'usage-report.md'), md);
}

main();
