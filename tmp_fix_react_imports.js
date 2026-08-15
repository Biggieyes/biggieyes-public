import fs from "fs";
import path from "path";

const root = path.resolve("src");
const exts = new Set([".js", ".jsx", ".ts", ".tsx"]);
const reactNames = [
  "useState",
  "useEffect",
  "useMemo",
  "useCallback",
  "useRef",
  "useContext",
  "useReducer",
  "useLayoutEffect",
  "useImperativeHandle",
  "useTransition",
  "useDeferredValue",
  "useId",
  "useInsertionEffect",
  "useSyncExternalStore",
  "useDebugValue",
  "lazy",
  "Suspense",
  "StrictMode",
  "Fragment",
  "memo",
  "forwardRef",
  "startTransition",
  "createContext",
  "createElement",
  "cloneElement",
  "isValidElement",
  "Children",
  "Profiler",
  "PureComponent",
];
const reactDOMNames = ["createRoot", "hydrateRoot"];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (exts.has(path.extname(entry.name))) processFile(full);
  }
}

function replaceImportReact(src) {
  let changed = false;
  const patterns = [
    /import\s+React\s*,\s*\{[^}]*\}\s*from\s+["']react["'];?/g,
    /import\s+\{[^}]*\}\s*from\s+["']react["'];?/g,
    /import\s+React\s+from\s+["']react["'];?/g,
  ];
  for (const pat of patterns) {
    if (pat.test(src)) {
      src = src.replace(pat, 'import * as React from "react";');
      changed = true;
    }
  }
  return { src, changed };
}

function prefixNames(src, names) {
  for (const name of names) {
    const re = new RegExp(`(?<!React\\.)\\b${name}\\b`, "g");
    src = src.replace(re, `React.${name}`);
  }
  return src;
}

function replaceReactDOM(src) {
  let changed = false;
  const pat = /import\s+\{\s*([\w\s,]+)\s*\}\s*from\s+["']react-dom\/client["'];?/g;
  if (pat.test(src)) {
    src = src.replace(pat, 'import * as ReactDOM from "react-dom/client";');
    changed = true;
  }
  for (const name of reactDOMNames) {
    const re = new RegExp(`(?<!ReactDOM\\.)\\b${name}\\b`, "g");
    src = src.replace(re, `ReactDOM.${name}`);
  }
  return { src, changed };
}

function processFile(file) {
  let text = fs.readFileSync(file, "utf8");
  let touched = false;
  const r1 = replaceImportReact(text);
  text = r1.src;
  touched = touched || r1.changed;
  if (r1.changed) text = prefixNames(text, reactNames);
  const r2 = replaceReactDOM(text);
  text = r2.src;
  touched = touched || r2.changed;
  if (touched) fs.writeFileSync(file, text);
}

walk(root);
