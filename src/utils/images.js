// src/utils/images.js
// Import rows config from TS/JS (Vite handles TS import from JS)
import { ROWS_BY_BLOCK, DEFAULT_BLOCKS } from "../constants/blocks";

/** BASE URL (funguje v CRA i Vite; když nic, použije kořen) */
const PUBLIC_URL =
  (typeof process !== "undefined" && process.env && process.env.PUBLIC_URL) ||
  "";

/** Přidá base prefix, ale nezdvojí lomítka */
export function addBase(path) {
  const p = String(path ?? "");
  if (!PUBLIC_URL) return p;
  return `${String(PUBLIC_URL).replace(/\/+$/, "")}/${p.replace(/^\/+/, "")}`;
}

/** Normalizace názvu bloku na VELKÁ písmena */
export function safeBlockFolder(name) {
  return String(name ?? "")
    .trim()
    .toUpperCase();
}

/** Placeholder */
const PLACEHOLDER = addBase("/images/Biggi.png");

/** Jednodušší error handling */
export function handleImageError(e) {
  const img = e?.currentTarget;
  if (!img) return;
  img.src = PLACEHOLDER;
}

/** Thumbnail bloku - použije první obrázek z daného bloku */
export function getBlockThumb(name) {
  const BLOCK = safeBlockFolder(name);
  const order = Array.isArray(DEFAULT_BLOCKS)
    ? DEFAULT_BLOCKS
    : [
        "ORANGE",
        "BLACK",
        "WHITE",
        "BROWN",
        "BLUE",
        "GREEN",
        "VIOLET",
        "RED",
        "PINK",
        "RAINBOW",
      ];
  const idx = Math.max(0, order.indexOf(BLOCK));
  const baseId = idx * 10 + 1; // 1,11,21,...,91
  return addBase(`/images/blocks/${BLOCK}/Biggi_${baseId}_${BLOCK}_O.png`);
}

/** Cesta k obrázku */
export function buildBlockImagePath(fileName) {
  if (!fileName) return PLACEHOLDER;
  const m = String(fileName).match(/^Biggi_\d+_([A-Z]+)_[A-Z]+\.png$/);
  const folder = m ? m[1] : "";
  if (folder) return addBase(`/images/blocks/${folder}/${String(fileName)}`);
  return addBase(`/images/blocks/${String(fileName)}`);
}

/** Pořadí backgroundShort */
const BG_ORDER = ["O", "B", "W", "BR", "BL", "G", "V", "R", "P", "RB"];

/**
 * Vygeneruje seznam souborů pro fullscreen grid
 */
export function getBlockImages(block) {
  const BLOCK = safeBlockFolder(block);
  const rows = ROWS_BY_BLOCK[BLOCK] || 10;
  const bgs = BG_ORDER.slice(0, rows);
  const order = Array.isArray(DEFAULT_BLOCKS)
    ? DEFAULT_BLOCKS
    : [
        "ORANGE",
        "BLACK",
        "WHITE",
        "BROWN",
        "BLUE",
        "GREEN",
        "VIOLET",
        "RED",
        "PINK",
        "RAINBOW",
      ];
  const idx = Math.max(0, order.indexOf(BLOCK));
  const base = idx * 10; // 0,10,20,...,90

  const files = [];
  for (let col = 1; col <= 10; col++) {
    const id = base + col; // 1..10, 11..20, ..., 91..100
    for (let r = 0; r < bgs.length; r++) {
      files.push(`Biggi_${id}_${BLOCK}_${bgs[r]}.png`);
    }
  }
  return files;
}

/** REWARDS */
export function rewardImageFor(type, idx) {
  return addBase(
    `/images/REWARDS/${String(type ?? "")}/${String(idx ?? "")}.png`,
  );
}


