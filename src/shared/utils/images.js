import { ROWS_BY_BLOCK } from "../blocks";
import BLOCK_IMAGES from "./blockImages";

const PUBLIC_URL =
  (typeof process !== "undefined" && process.env && process.env.PUBLIC_URL) ||
  "";

export function addBase(path) {
  const p = String(path ?? "");
  if (!PUBLIC_URL) return p;
  return `${String(PUBLIC_URL).replace(/\/+$/, "")}/${p.replace(/^\/+/, "")}`;
}

export function safeBlockFolder(name) {
  return String(name ?? "")
    .trim()
    .toUpperCase();
}

const PLACEHOLDER = addBase("/images/Biggi.png");

export function handleImageError(e) {
  const img = e?.currentTarget;
  if (!img) return;

  const explicitFallback = img.dataset.fallbackSrc;
  if (explicitFallback && img.dataset.fallbackTried !== "1") {
    img.dataset.fallbackTried = "1";
    img.src = explicitFallback;
    return;
  }

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
    const two = String(idNum).padStart(2, "0");
    img.dataset.triedVariant = "2";
    img.src = img.src.replace(
      new RegExp(`Biggi_${idStr}${mid}${bg}${tail}$`),
      `${head}${two}${mid}${bg}${tail}`,
    );
    return;
  }

  if (tried === "2") {
    const three = String(idNum).padStart(3, "0");
    img.dataset.triedVariant = "3";
    img.src = img.src.replace(
      new RegExp(`Biggi_\\d{2}${mid}${bg}${tail}$`),
      `${head}${three}${mid}${bg}${tail}`,
    );
    return;
  }

  img.src = PLACEHOLDER;
}

export function getBlockThumb(name) {
  const block = safeBlockFolder(name);
  if (!block) return PLACEHOLDER;
  return addBase(`/images/blocks/${block}/thumb.jpg`);
}

const toJpgName = (fileName) => String(fileName ?? "").replace(/\.\w+$/, ".jpg");

export function buildBlockThumbPath(blockOrFile, file) {
  if (file == null) {
    const fileName = String(blockOrFile ?? "");
    if (!fileName) return PLACEHOLDER;
    const match = fileName.match(/^Biggi_\d+_([A-Z]+)_[A-Z]+\.png$/);
    const folder = match ? match[1] : "";
    const jpgName = toJpgName(fileName);
    return folder
      ? addBase(`/images/blocks-thumb/${folder}/${jpgName}`)
      : addBase(`/images/blocks-thumb/${jpgName}`);
  }

  return addBase(
    `/images/blocks-thumb/${safeBlockFolder(blockOrFile)}/${toJpgName(file)}`,
  );
}

export function buildBlockImagePath(blockOrFile, file) {
  if (file == null) {
    const fileName = String(blockOrFile ?? "");
    if (!fileName) return PLACEHOLDER;
    const match = fileName.match(/^Biggi_\d+_([A-Z]+)_[A-Z]+\.png$/);
    const folder = match ? match[1] : "";
    return folder
      ? addBase(`/images/blocks/${folder}/${fileName}`)
      : addBase(`/images/blocks/${fileName}`);
  }

  return addBase(
    `/images/blocks/${safeBlockFolder(blockOrFile)}/${String(file ?? "")}`,
  );
}

const BG_ORDER = ["O", "B", "W", "BR", "BL", "G", "V", "R", "P", "RB"];

export function getBlockImages(block) {
  const BLOCK = safeBlockFolder(block);
  const mapped = BLOCK_IMAGES?.[BLOCK];
  if (Array.isArray(mapped) && mapped.length) return mapped.slice();

  const rows = ROWS_BY_BLOCK[BLOCK] || 10;
  const bgs = BG_ORDER.slice(0, rows);
  const files = [];

  for (let col = 1; col <= 10; col++) {
    for (let r = 1; r <= bgs.length; r++) {
      const id = (col - 1) * 10 + r;
      files.push(`Biggi_${id}_${BLOCK}_${bgs[r - 1]}.png`);
    }
  }
  return files;
}

export function rewardImageFor(type, idx) {
  return addBase(
    `/images/rewards/${String(type ?? "")}/${String(idx ?? "")}.png`,
  );
}
