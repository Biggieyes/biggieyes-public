// src/utils/images.js

import { ROWS_BY_BLOCK } from "../constants/blocks";

/** BASE URL (funguje v CRA i Vite; když nic, použije kořen) */
const PUBLIC_URL =
  (typeof process !== "undefined" && process.env && process.env.PUBLIC_URL) ||
  "";

/** Přidá base prefix, ale nezdvojí lomítka */
export function addBase(path?: unknown): string {
  const p = String(path ?? "");
  if (!PUBLIC_URL) return p;
  return `${String(PUBLIC_URL).replace(/\/+$/, "")}/${p.replace(/^\/+/, "")}`;
}

/** Normalizace názvu bloku na VELKÁ písmena (složky: ORANGE…RAINBOW) */
export function safeBlockFolder(name?: unknown): string {
  return String(name ?? "")
    .trim()
    .toUpperCase();
}

/** Placeholder */
const PLACEHOLDER = addBase("/images/Biggi.png");

/** Chytrý fallback při 404: zkusí 2-místné a 3-místné ID, pak placeholder */
export function handleImageError(e: Event): void {
  const img = e?.currentTarget as HTMLImageElement | null;
  if (!img) return;

  const tried = img.dataset.triedVariant || "none";
  const m = img.src.match(
    /(Biggi_)(\d{1,3})(_[A-Z]+_)(O|B|W|BR|BL|G|V|R|P|RB)(\.png)$/,
  );
  if (!m) {
    img.src = PLACEHOLDER;
    return;
  }

  const [, head, idStr, mid, bg, tail] = m;
  const idNum = Number(idStr);

  if (tried === "none") {
    // 2-místné: 01..99
    const two = String(idNum).padStart(2, "0");
    img.dataset.triedVariant = "2";
    img.src = img.src.replace(
      new RegExp(`Biggi_${idStr}${mid}${bg}${tail}$`),
      `${head}${two}${mid}${bg}${tail}`,
    );
    return;
  }

  if (tried === "2") {
    // 3-místné: 001..100
    const three = String(idNum).padStart(3, "0");
    img.dataset.triedVariant = "3";
    img.src = img.src.replace(
      new RegExp(`Biggi_\\d{2}${mid}${bg}${tail}$`),
      `${head}${three}${mid}${bg}${tail}`,
    );
    return;
  }

  // poslední fallback
  img.src = PLACEHOLDER;
}

/** Thumbnail bloku */
export function getBlockThumb(name?: unknown): string {
  return addBase(`/images/blocks/${safeBlockFolder(name)}/thumb.png`);
}

/** Cesta k jednomu obrázku v bloku */
export function buildBlockImagePath(block?: unknown, file?: unknown): string {
  return addBase(
    `/images/blocks/${safeBlockFolder(block)}/${String(file ?? "")}`,
  );
}

/** Pořadí backgroundShort přesně dle BiggiNamesLib */
const BG_ORDER = ["O", "B", "W", "BR", "BL", "G", "V", "R", "P", "RB"];

/**
 * Vygeneruje seznam souborů pro fullscreen grid:
 * - sloupce = main IDs 1..10
 * - řádků = ROWS_BY_BLOCK[BLOCK] (např. ORANGE=10, RAINBOW=1)
 * - ID ve jménu: (col-1)*10 + row  => 1..100 (bez paddingu, ORANGE ti tak funguje)
 * - pořadí column-major (co očekává CSS grid v komponentě)
 */
export function getBlockImages(block?: unknown): string[] {
  const BLOCK = safeBlockFolder(block);
  const rows = ROWS_BY_BLOCK[BLOCK] || 10;
  const bgs = BG_ORDER.slice(0, rows);

  const files: string[] = [];
  for (let col = 1; col <= 10; col++) {
    for (let r = 1; r <= bgs.length; r++) {
      const id = (col - 1) * 10 + r; // 1..100
      files.push(`Biggi_${id}_${BLOCK}_${bgs[r - 1]}.png`);
    }
  }
  return files;
}

/** Rewards (ponecháno podle použití v komponentě) */
export function rewardImageFor(type?: unknown, idx?: unknown): string {
  return addBase(
    `/images/rewards/${String(type ?? "")}/${String(idx ?? "")}.png`,
  );
}
