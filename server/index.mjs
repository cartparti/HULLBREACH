// Hullbreach squad relay.
// A tiny WebSocket server that gives the standalone app the same room model
// the game uses on claude.ai: one lobby (room ""), named squad rooms,
// per-room presence and broadcast messages. It never runs game rules:
// the squad leader's page sequences raids (lockstep) exactly as on claude.ai.
//
//   PORT=8787 node server/index.mjs
//
// Protocol (JSON text frames)
//   client -> server  {op:"hello", id, name} | {op:"join", room} | {op:"leave", room}
//                     {op:"presence", room, patch} | {op:"emit", room, topic, data}
//   server -> client  {op:"welcome", peer} | {op:"peers", room, peers:[{peer, by, presence}]}
//                     {op:"msg", room, msg:{topic, data, peer, by}} | {op:"error", reason}
import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);
const MAX_FRAME = 8 * 1024;          // bytes per incoming frame
const MAX_DATA = 4 * 1024;           // emit payload / merged presence, like claude.ai rooms
const MAX_ROOMS_PER_PEER = 16;
const RATE = 40, BURST = 80;         // messages per second per connection
const ROOM_RE = /^[a-z0-9._-]{0,48}$/;
const TOPIC_RE = /^[a-z][a-z0-9_.-]{0,47}$/;

const rooms = new Map();             // room name -> Map(peer -> member)
let nextPeer = 0;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*" });
  let n = 0; for (const r of rooms.values()) n += r.size;
  res.end(`hullbreach relay ok · ${wss.clients.size} connected · ${rooms.size} rooms · ${n} memberships\n`);
});
const wss = new WebSocketServer({ server, maxPayload: MAX_FRAME });

const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const bytes = (v) => Buffer.byteLength(JSON.stringify(v ?? null));

function peersOf(room) {
  return [...(rooms.get(room) || new Map()).values()].map((m) => ({ peer: m.peer, by: m.by, presence: m.presence }));
}
function broadcastPeers(room) {
  const r = rooms.get(room); if (!r) return;
  const msg = JSON.stringify({ op: "peers", room, peers: peersOf(room) });
  for (const m of r.values()) if (m.ws.readyState === 1) m.ws.send(msg);
}
function leave(room, peer) {
  const r = rooms.get(room); if (!r || !r.delete(peer)) return;
  if (r.size === 0) rooms.delete(room); else broadcastPeers(room);
}

wss.on("connection", (ws) => {
  const peer = "p" + (++nextPeer).toString(36) + Math.random().toString(36).slice(2, 7);
  const joined = new Set();
  let by = null, tokens = BURST, last = Date.now();
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (raw, isBinary) => {
    if (isBinary) return;
    const now = Date.now(); tokens = Math.min(BURST, tokens + ((now - last) / 1000) * RATE); last = now;
    if (tokens < 1) return send(ws, { op: "error", reason: "rate_limited" });
    tokens -= 1;
    let m; try { m = JSON.parse(raw.toString("utf8")); } catch { return; }
    if (!m || typeof m !== "object") return;

    if (m.op === "hello") {
      by = typeof m.id === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(m.id) ? m.id : peer;
      return send(ws, { op: "welcome", peer });
    }
    if (!by) return send(ws, { op: "error", reason: "say_hello_first" });
    const room = m.room;
    if (typeof room !== "string" || !ROOM_RE.test(room)) return send(ws, { op: "error", reason: "bad_room" });

    switch (m.op) {
      case "join": {
        if (joined.has(room)) return broadcastPeers(room);
        if (joined.size >= MAX_ROOMS_PER_PEER) return send(ws, { op: "error", reason: "limit_reached" });
        if (!rooms.has(room)) rooms.set(room, new Map());
        rooms.get(room).set(peer, { ws, peer, by, presence: {} });
        joined.add(room); return broadcastPeers(room);
      }
      case "leave": joined.delete(room); return leave(room, peer);
      case "presence": {
        const me = rooms.get(room)?.get(peer); if (!me || !m.patch || typeof m.patch !== "object") return;
        const next = { ...me.presence };
        for (const [k, v] of Object.entries(m.patch)) { if (v === null) delete next[k]; else next[k] = v; }
        if (bytes(next) > MAX_DATA) return send(ws, { op: "error", reason: "presence_too_large" });
        me.presence = next; return broadcastPeers(room);
      }
      case "emit": {
        const r = rooms.get(room); if (!r || !r.has(peer)) return;
        if (typeof m.topic !== "string" || !TOPIC_RE.test(m.topic) || bytes(m.data) > MAX_DATA) return send(ws, { op: "error", reason: "invalid_argument" });
        const msg = JSON.stringify({ op: "msg", room, msg: { topic: m.topic, data: m.data, peer, by } });
        for (const mem of r.values()) if (mem.ws.readyState === 1) mem.ws.send(msg);
        return;
      }
    }
  });

  ws.on("close", () => { for (const room of joined) leave(room, peer); joined.clear(); });
});

// drop connections that stopped answering
const beat = setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); }
}, 30000);
wss.on("close", () => clearInterval(beat));

server.listen(PORT, () => console.log(`hullbreach relay listening on :${PORT}`));
