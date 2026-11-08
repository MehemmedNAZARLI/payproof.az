// Renders the SVG app icons (assets/icons, kept out of public/ so they are not precached) to the
// PNG sizes the manifest and iOS need, and copies the favicon. Run after editing the SVGs:
// `node scripts/generate-icons.mjs`
import { copyFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputs = [
  { src: "assets/icons/icon.svg", out: "public/icons/icon-192.png", size: 192 },
  { src: "assets/icons/icon.svg", out: "public/icons/icon-512.png", size: 512 },
  { src: "assets/icons/icon-maskable.svg", out: "public/icons/icon-maskable-512.png", size: 512 },
  // iOS rounds the corners itself, so the apple icon is full-bleed.
  { src: "assets/icons/icon-maskable.svg", out: "src/app/apple-icon.png", size: 180 },
];

await copyFile(`${root}assets/icons/icon.svg`, `${root}src/app/icon.svg`);
console.log("✓ src/app/icon.svg");

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { src, out, size } of outputs) {
  const svg = await readFile(new URL(src, `file://${root}`), "utf8");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: `${root}${out}`, omitBackground: true });
  console.log(`✓ ${out}`);
}
await browser.close();
