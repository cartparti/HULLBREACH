// Relay smoke test: starts server/index.mjs and drives it with real WebSocket
// clients. Run with `npm run test:relay` (needs `npm install --prefix server`).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WebSocket = createRequire(join(root, "server/package.json"))("ws");
const PORT = 18787 + Math.floor(Math.random() * 1000);
const srv = spawn(process.execPath, [join(root, "server/index.mjs")], { env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((res) => srv.stdout.on("data", (d) => String(d).includes("listening") && res()));

function client(id, name) {
  const ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [];
  ws.on("message", (d) => inbox.push(JSON.parse(String(d))));
  const send = (o) => ws.send(JSON.stringify(o));
  const until = async (pred, ms = 2000) => { const t0 = Date.now(); for (;;) { const hit = inbox.find(pred); if (hit) return hit; if (Date.now() - t0 > ms) throw new Error("timed out waiting"); await new Promise((r) => setTimeout(r, 20)); } };
  return new Promise((res) => ws.on("open", () => { send({ op: "hello", id, name }); res({ ws, inbox, send, until }); }));
}

let ok = 0;
try {
  const a = await client("a_leader01", "Vex"), b = await client("a_crew0002", "Mara");
  const wa = await a.until((m) => m.op === "welcome"), wb = await b.until((m) => m.op === "welcome");
  assert.notEqual(wa.peer, wb.peer); ok++;

  a.send({ op: "join", room: "sq-test" }); b.send({ op: "join", room: "sq-test" });
  a.send({ op: "presence", room: "sq-test", patch: { k: "a_leader01", nm: "Vex", x: 19, y: 9 } });
  const seen = await b.until((m) => m.op === "peers" && m.room === "sq-test" && m.peers.some((p) => p.presence.nm === "Vex"));
  assert.equal(seen.peers.find((p) => p.presence.nm === "Vex").by, "a_leader01"); ok++;

  a.send({ op: "emit", room: "sq-test", topic: "hb", data: { t: "seq", n: 1, k: "a_leader01", a: { type: "wait" } } });
  const msg = await b.until((m) => m.op === "msg" && m.msg.data && m.msg.data.t === "seq");
  assert.equal(msg.msg.by, "a_leader01"); assert.equal(msg.msg.peer, wa.peer); ok++;

  a.send({ op: "emit", room: "sq-test", topic: "hb", data: { blob: "x".repeat(5000) } });
  await a.until((m) => m.op === "error" && m.reason === "invalid_argument"); ok++;

  b.ws.close();
  await a.until((m) => m.op === "peers" && m.room === "sq-test" && m.peers.length === 1); ok++;
  a.ws.close();
  console.log(`relay: ${ok} checks passed`);
} catch (e) { console.error("relay test FAILED:", e.message); process.exitCode = 1; }
finally { srv.kill(); }
