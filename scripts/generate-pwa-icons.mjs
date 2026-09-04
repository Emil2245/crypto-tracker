// Regenerate the PWA raster icons from public/favicon.svg.
// Run with: bun scripts/generate-pwa-icons.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const svgPath = path.join(root, "public", "favicon.svg");
const svg = readFileSync(svgPath);

const targets = [
  { size: 192, out: "pwa-192x192.png" },
  { size: 512, out: "pwa-512x512.png" },
];

for (const { size, out } of targets) {
  const outPath = path.join(root, "public", out);
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`wrote ${out} (${size}×${size})`);
}
