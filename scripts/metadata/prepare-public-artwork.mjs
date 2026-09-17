import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// Stages byte-identical artwork for review. Never renames or writes source files.
const [sourceArg, outputArg] = process.argv.slice(2);
assert(
  sourceArg && outputArg,
  "Usage: node prepare-public-artwork.mjs SOURCE OUTPUT",
);
const source = await fs.realpath(sourceArg);
const output = path.resolve(outputArg);
assert(!output.toLowerCase().startsWith(source.toLowerCase() + path.sep));
assert.notEqual(output.toLowerCase(), source.toLowerCase());
await fs.mkdir(output, { recursive: true });
assert.equal((await fs.readdir(output)).length, 0, "Output must be empty");
const colors = [
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
const imagesDir = path.join(output, "images");
const reviewDir = path.join(output, "review");
await fs.mkdir(imagesDir);
await fs.mkdir(reviewDir);
const seenHashes = new Set();
const items = [];
const missing = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 850 },
  });
  for (const [blockIndex, color] of colors.entries()) {
    const directory = color === "BLACK" ? "BLCK_EYES_NFT" : `${color}_EYES_NFT`;
    const files = (
      await fs.readdir(path.join(source, directory), { withFileTypes: true })
    )
      .filter((file) => file.isFile() && /\.(png|webp|jpe?g)$/i.test(file.name))
      .map((file) => file.name)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    assert(
      files.length <= 10,
      `${color}: more than ten images, select explicitly`,
    );
    const existingIds = files.flatMap((file) => {
      const match = file.match(
        /^Biggi_(\d+)_([A-Z]+)_PUBLIC\.(png|webp|jpe?g)$/,
      );
      if (!match) return [];
      const id = Number(match[1]);
      assert.equal(match[2], color);
      assert(id > blockIndex * 10 && id <= (blockIndex + 1) * 10);
      return [id];
    });
    const reserved = new Set(existingIds);
    assert.equal(
      reserved.size,
      existingIds.length,
      `${color}: duplicate canonical ID`,
    );
    const group = [];
    for (const name of files) {
      const existing = name.match(
        /^Biggi_(\d+)_[A-Z]+_PUBLIC\.(png|webp|jpe?g)$/,
      );
      assert(
        existing || !/^Biggi_/i.test(name),
        `Unrecognized previous ID: ${name}`,
      );
      let id = existing ? Number(existing[1]) : blockIndex * 10 + 1;
      if (!existing) while (reserved.has(id)) id++;
      assert(id <= (blockIndex + 1) * 10);
      reserved.add(id);
      const ext = path.extname(name).toLowerCase();
      const newName = `Biggi_${id}_${color}_PUBLIC${ext}`;
      const bytes = await fs.readFile(path.join(source, directory, name));
      const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      assert(
        !seenHashes.has(sha256),
        `Duplicate image bytes: ${directory}/${name}`,
      );
      seenHashes.add(sha256);
      await fs.writeFile(path.join(imagesDir, newName), bytes, { flag: "wx" });
      const item = {
        id,
        blockIndex: blockIndex + 1,
        color,
        source: `${directory}/${name}`,
        renamed: `${directory}/${newName}`,
        filename: newName,
        metadataFile: `Biggi_${id}_${color}_PUBLIC.json`,
        sha256,
        bytes: bytes.length,
      };
      items.push(item);
      group.push({
        id,
        data: `data:image/${
          ext === ".jpg" ? "jpeg" : ext.slice(1)
        };base64,${bytes.toString("base64")}`,
      });
    }
    for (let id = blockIndex * 10 + 1; id <= (blockIndex + 1) * 10; id++) {
      if (!reserved.has(id))
        missing.push({ id, color, filename: `Biggi_${id}_${color}_PUBLIC` });
    }
    await page.setContent(
      '<html><body style="margin:0;background:#171717;color:white;font-family:Arial"><h1></h1><main style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px"></main></body></html>',
    );
    await page.evaluate(
      async ({ color, group }) => {
        document.querySelector("h1").textContent = color;
        for (const { id, data } of group) {
          const figure = document.createElement("figure");
          figure.style.margin = "0";
          const caption = document.createElement("figcaption");
          caption.textContent = `#${id}`;
          const image = new Image();
          image.style.cssText = "width:270px;height:350px;object-fit:contain";
          image.src = data;
          await image.decode();
          figure.append(caption, image);
          document.querySelector("main").append(figure);
        }
      },
      { color, group },
    );
    await page.screenshot({
      path: path.join(reviewDir, `${color}.png`),
      fullPage: true,
    });
    console.log(`${color}: ${files.length}/10, decoded and hashed`);
  }
} finally {
  await browser.close();
}
await fs.writeFile(
  path.join(output, "rename-plan.json"),
  JSON.stringify(
    {
      source,
      assignedBy:
        "Existing canonical ID first, then ordinal filename order within each eye-color folder",
      items,
      missing,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(
  `Prepared ${items.length}/100; missing: ${missing
    .map((item) => item.id)
    .join(", ")}`,
);
