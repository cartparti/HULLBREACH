// Renders the app icons from the game's own pixel-art contractor sprite.
// Needs Playwright with a Chromium browser (npx playwright install chromium).
// Usage: npm run icons
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const html = readFileSync(join(root, "dist/app/index.html"), "utf8");
const out = join(root, "web/icons");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route("http://icons.local/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: html }));
await page.goto("http://icons.local/");
await page.waitForTimeout(500);

const icons = [
  ["icon-192.png", 192, 0.78],
  ["icon-512.png", 512, 0.78],
  ["icon-maskable-512.png", 512, 0.58],
  ["apple-touch-icon.png", 180, 0.74],
];
for (const [name, size, fill] of icons) {
  const data = await page.evaluate(([size, fill]) => {
    const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d");
    g.fillStyle = "#050606"; g.fillRect(0, 0, size, size);
    const gr = g.createRadialGradient(size * 0.5, size * 0.42, 0, size * 0.5, size * 0.5, size * 0.62);
    gr.addColorStop(0, "#1d3a33"); gr.addColorStop(1, "#050606"); g.fillStyle = gr; g.fillRect(0, 0, size, size);
    // red hull-breach slash behind the contractor
    g.save(); g.translate(size * 0.5, size * 0.5); g.rotate(-0.5); const bw = size * 0.035;
    g.fillStyle = "rgba(224,72,47,.85)"; g.fillRect(-size * 0.42, -bw / 2, size * 0.84, bw);
    g.fillStyle = "rgba(255,180,120,.9)"; g.fillRect(-size * 0.3, -bw / 6, size * 0.6, bw / 3); g.restore();
    const spr = playerFrames("flak", "rifle").idle0; // 24x32
    const scale = Math.floor((size * fill) / 32);
    const w = 24 * scale, h = 32 * scale;
    g.imageSmoothingEnabled = false;
    g.drawImage(spr, Math.round((size - w) / 2), Math.round((size - h) / 2 + size * 0.02), w, h);
    return c.toDataURL("image/png");
  }, [size, fill]);
  writeFileSync(join(out, name), Buffer.from(data.split(",")[1], "base64"));
  console.log("wrote web/icons/" + name);
}
await browser.close();
