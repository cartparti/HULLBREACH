// Rules tests: run with `npm test` (plain Node, no browser).
// Loads the pure modules (Sim + World) exactly as the game ships them.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = ["sim", "world"].map((m) => readFileSync(join(root, `src/${m}.js`), "utf8")).join("\n");
const { Sim, World } = new Function(`${src}\nreturn {Sim, World};`)();

let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log("ok   " + name); } catch (e) { console.error("FAIL " + name + "\n     " + e.message); process.exitCode = 1; } };
const playerOf = (s, id = "p1") => s.ents.find((e) => e.id === id);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

test("station hull has no gaps to space", () => {
  const s = Sim.newGame(1), p = playerOf(s), W = s.W, seen = new Set([p.y * W + p.x]), q = [p.y * W + p.x];
  while (q.length) { const c = q.pop(), x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of N4) { const j = (y + dy) * W + x + dx, t = s.tiles[j]; if (!t || seen.has(j)) continue;
      assert.notEqual(t.t, "space", `leak at ${x + dx},${y + dy}`); if (["wall", "window", "console"].includes(t.t)) continue; seen.add(j); q.push(j); } }
});

test("every item and husk is reachable on foot", () => {
  const s = Sim.newGame(9), p = playerOf(s), W = s.W, seen = new Set([p.y * W + p.x]), q = [p.y * W + p.x];
  while (q.length) { const c = q.pop(), x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of N4) { const j = (y + dy) * W + x + dx, t = s.tiles[j]; if (!t || seen.has(j)) continue; if (["floor", "extract", "door"].includes(t.t)) { seen.add(j); q.push(j); } } }
  for (const it of s.items) assert.ok(seen.has(it.y * W + it.x), `${it.name} unreachable`);
  for (const h of s.ents.filter((e) => e.kind === "husk")) assert.ok(seen.has(h.y * W + h.x), "husk unreachable");
});

test("200 random runs never throw and stay serialisable", () => {
  for (let g = 0; g < 200; g++) {
    const s = Sim.newGame(g * 7919 + 1); let n = 0; let r = g * 31 + 7; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    while (s.status === "playing" && n++ < 400) {
      const v = rnd(), d = N4[(rnd() * 4) | 0], h = s.ents.find((e) => e.kind === "husk" && e.alive);
      const a = v < .6 ? { type: "move", dx: d[0], dy: d[1] } : v < .7 && h ? { type: "shoot", x: h.x, y: h.y } : v < .8 ? { type: "interact" } : v < .9 ? { type: "pickup" } : v < .95 ? { type: "use", index: 0 } : { type: "wait" };
      if (!Sim.act(s, "p1", a)) Sim.act(s, "p1", { type: "wait" });
    }
    JSON.stringify(s);
  }
});

test("fire burns, eats oxygen and dies out", () => {
  const s = Sim.newGame(42); assert.ok(Object.keys(s.fire).length > 0);
  for (let t = 0; t < 120; t++) Sim.act(s, "p1", { type: "wait" });
  assert.equal(Object.keys(s.fire).length, 0);
});

test("shooting a fuel drum chain-detonates its neighbours", () => {
  const s = Sim.newGame(7), p = playerOf(s); for (const t of s.tiles) if (t.t === "door") t.open = true;
  p.x = 27; p.y = 18; Sim.fov(s, p);
  const before = s.tiles.filter((t) => t.t === "prop" && t.kind === "barrel").length;
  assert.ok(Sim.act(s, "p1", { type: "shoot", x: 26, y: 16 }));
  const after = s.tiles.filter((t) => t.t === "prop" && t.kind === "barrel").length;
  assert.ok(before - after >= 2, `only ${before - after} drums went up`);
  assert.ok(Object.keys(s.fire).length > 5);
});

test("ship interior: terminals and free movement", () => {
  const s = Sim.newGame(1, null, { map: "ship", mode: "ship" });
  assert.deepEqual(s.tiles.filter((t) => t.t === "terminal").map((t) => t.kind).sort(), ["airlock", "board", "helm", "rack", "records", "stash"]);
  const p = playerOf(s); for (let i = 0; i < 3; i++) Sim.act(s, "p1", { type: "move", dx: 0, dy: -1 });
  assert.equal(p.y, 6); assert.equal(s.turn, 1, "no turns pass aboard the ship");
  Sim.act(s, "p1", { type: "move", dx: 0, dy: -1 }); // bump the captain's chair
  assert.equal(p.y, 6); assert.deepEqual(s.fx.map((f) => [f.type, f.kind]), [["flavor", "captchair"]]);
  for (const k of ["brig", "bathroom", "break room", "crew quarters", "armory", "bridge"])
    assert.ok(Sim.MAPS.ship.rooms.some((r) => r[0].toLowerCase() === k), `ship is missing its ${k}`);
});

test("site modifiers change the station", () => {
  const dark = Sim.newGame(5, null, { site: "Mercy", mods: { power: false, huskAdd: 5 } });
  assert.equal(dark.power, false); assert.ok(dark.ents.filter((e) => e.kind === "husk").length >= 15);
  const pyre = Sim.newGame(5, null, { site: "Pyre", mods: { fires: 7 } }); assert.ok(Object.keys(pyre.fire).length >= 7);
});

test("lockstep: two pages replaying the same actions stay identical", () => {
  const crew = [{ id: "u_a", name: "", loadout: Sim.STARTER }, { id: "u_b", name: "", loadout: Sim.STARTER }];
  const host = Sim.newGame(1234, null, { crew }), peer = Sim.newGame(1234, null, { crew });
  let r = 99; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 300 && host.status === "playing"; i++) {
    const who = crew[(rnd() * 2) | 0].id, d = N4[(rnd() * 4) | 0], a = rnd() < .8 ? { type: "move", dx: d[0], dy: d[1] } : { type: "wait" };
    if (Sim.act(host, who, a)) Sim.act(peer, who, a);
    assert.equal(Sim.hash(host), Sim.hash(peer), `diverged at step ${i}`);
  }
});

test("squads: downed crew can be revived, items can be handed over", () => {
  const crew = [{ id: "a", name: "", loadout: Sim.STARTER }, { id: "b", name: "", loadout: Sim.STARTER }];
  const s = Sim.newGame(3, null, { crew }), A = playerOf(s, "a"), B = playerOf(s, "b");
  assert.equal(Math.abs(A.x - B.x) + Math.abs(A.y - B.y), 1);
  assert.ok(Sim.act(s, "a", { type: "give", index: 0, to: "b" })); assert.equal(B.inv.length, 3);
  Sim.act(s, "b", { type: "wait" });
  B.downed = true; B.downT = 8; B.hp.torso = 0;
  assert.equal(Sim.act(s, "b", { type: "wait" }), false, "downed players cannot act");
  assert.ok(Sim.act(s, "a", { type: "interact" })); assert.equal(B.downed, false); assert.ok(B.hp.torso > 0);
});

test("world: travel costs fuel, contracts pay the whole crew", () => {
  const ship = World.newShip(), P = { credits: 0, rounds: 0, stash: [] }, Q = { credits: 0, rounds: 0, stash: [] };
  assert.ok(World.act(ship, { id: "a", profile: P }, { type: "accept", id: "c_ks9" }).ok);
  assert.ok(World.act(ship, { id: "a", profile: P }, { type: "travel", to: "ks9" }).ok); assert.equal(ship.fuel, 5);
  assert.equal(World.act(ship, { id: "a", profile: P }, { type: "travel", to: "pyre" }).ok, true); assert.equal(ship.fuel, 2);
  ship.loc = "ks9"; const out = World.settleRaid(ship, [P, Q], { status: "extracted", blackbox: true }, "ks9");
  assert.equal(out.contract.reward, 600); assert.equal(P.credits, 600); assert.equal(Q.credits, 600); assert.deepEqual(ship.done, ["c_ks9"]);
});

console.log(`\n${passed} passed${process.exitCode ? ", some failed" : ""}`);
