// Builds Hullbreach from src/ into:
//   dist/app/        installable web app (GitHub Pages, phones, Capacitor)
//   dist/artifact.html  page body for claude.ai Artifacts (squads + cloud saves)
// No dependencies: plain Node 18+.
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const MODULES = ["items","gen","sim", "world", "client", "base", "transport", "net", "squadui", "boot"];

const body = read("src/head.html");
const js = MODULES.map((m) => `// ---- src/${m}.js ----\n${read(`src/${m}.js`)}`).join("\n");
const pkg = JSON.parse(read("package.json"));
// Default squad server for the app: HB_SERVER env var (CI) or package.json "config.server".
const SERVER = process.env.HB_SERVER || (pkg.config && pkg.config.server) || "";

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(join(root, "dist/app"), { recursive: true });

// claude.ai Artifact: the platform wraps this in its own document skeleton.
writeFileSync(join(root, "dist/artifact.html"), `${body}\n<script>\n${js}\n</script>\n`);

// Standalone app: a full document with the manifest, icons and offline cache.
const app = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#050606">
<meta name="color-scheme" content="dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Hullbreach">
<meta name="description" content="Grimdark co-op pixel-art extraction game. Board burning derelicts, vent rooms into space, get the black box out.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<script>window.HB_SERVER=${JSON.stringify(SERVER)};</script>
<style>html,body{margin:0;height:100%;background:#050606}img{max-width:100%}[hidden]{display:none!important}body{-webkit-tap-highlight-color:transparent;overscroll-behavior:none}</style>
</head>
<body>
${body}
<script>
${js}
</script>
<script>
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
</script>
</body>
</html>
`;
writeFileSync(join(root, "dist/app/index.html"), app);
writeFileSync(join(root, "dist/app/sw.js"), read("web/sw.js").replace("__VERSION__", `${pkg.version}-${Date.now().toString(36)}`));
cpSync(join(root, "web/manifest.webmanifest"), join(root, "dist/app/manifest.webmanifest"));
if (existsSync(join(root, "web/icons"))) cpSync(join(root, "web/icons"), join(root, "dist/app/icons"), { recursive: true });
writeFileSync(join(root, "dist/app/.nojekyll"), "");

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + " KB";
console.log(`built dist/app/index.html (${kb(app)}) and dist/artifact.html`);
