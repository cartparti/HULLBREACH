// Rules tests: run with `npm test` (plain Node, no browser).
// Loads the pure modules (Sim + World) exactly as the game ships them.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = ["items", "gen", "sim", "world"].map((m) => readFileSync(join(root, `src/${m}.js`), "utf8")).join("\n");
const { Sim, World, Items, Gen } = new Function(`${src}\nreturn {Sim, World, Items, Gen};`)();

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
  assert.deepEqual([...new Set(s.tiles.filter((t) => t.t === "terminal").map((t) => t.kind))].sort(), ["airlock", "board", "helm", "navtable", "rack", "records", "stash", "wardrobe", "workbench"]);
  assert.equal(s.tiles.filter((t) => t.t === "seat").length, 4, "cockpit seats one squad of four");
  const p = playerOf(s); for (let i = 0; i < 3; i++) Sim.act(s, "p1", { type: "move", dx: 0, dy: -1 });
  assert.equal(p.y, 6); assert.equal(s.turn, 1, "no turns pass aboard the ship");
  Sim.act(s, "p1", { type: "move", dx: 0, dy: -1 }); // walk into the star-map table
  assert.equal(p.y, 6); assert.deepEqual(s.fx.map((f) => [f.type, f.kind]), [["terminal", "navtable"]]);
  p.x = 19; p.y = 4; assert.ok(Sim.act(s, "p1", { type: "move", dx: 0, dy: -1 })); // sit in the pilot's seat
  assert.deepEqual(s.fx.map((f) => [f.type, f.kind]), [["sit", "pilot"]]);
  Sim.act(s, "p1", { type: "interact" }); assert.deepEqual(s.fx.map((f) => [f.type, f.kind]), [["terminal", "navtable"]]);
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
  const nB = B.inv.length; assert.ok(Sim.act(s, "a", { type: "give", index: 0, to: "b" })); assert.equal(B.inv.length, nB + 1);
  Sim.act(s, "b", { type: "wait" });
  B.downed = true; B.downT = 8; B.hp.torso = 0;
  assert.equal(Sim.act(s, "b", { type: "wait" }), false, "downed players cannot act");
  assert.ok(Sim.act(s, "a", { type: "interact" })); assert.equal(B.downed, false); assert.ok(B.hp.torso > 0);
});

test("world: travel costs fuel, contracts pay the whole crew", () => {
  const ship = World.newShip(), P = { credits: 0, ammo: {}, mats: {}, stash: [] }, Q = { credits: 0, ammo: {}, mats: {}, stash: [] };
  assert.ok(World.act(ship, { id: "a", profile: P }, { type: "accept", id: "c_ks9" }).ok);
  assert.ok(World.act(ship, { id: "a", profile: P }, { type: "travel", to: "ks9" }).ok); assert.equal(ship.fuel, 5);
  assert.equal(World.act(ship, { id: "a", profile: P }, { type: "travel", to: "pyre" }).ok, true); assert.equal(ship.fuel, 2);
  ship.loc = "ks9"; const out = World.settleRaid(ship, [P, Q], { status: "extracted", blackbox: true }, "ks9");
  assert.equal(out.contract.reward, 600); assert.equal(P.credits, 600); assert.equal(Q.credits, 600); assert.deepEqual(ship.done, ["c_ks9"]);
});


test("procedural stations: 150 seeds are sealed, reachable and complete", () => {
  for (let k = 0; k < 150; k++) {
    const s = Sim.newGame(k * 104729 + 7, null, { gen: { tier: 1 + (k % 3), fireStart: k % 2 === 0 }, site: "Test" }), p = playerOf(s), W = s.W;
    const seen = new Set([p.y * W + p.x]), q = [p.y * W + p.x];
    while (q.length) { const c = q.pop(), x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of N4) { const j = (y + dy) * W + x + dx, t = s.tiles[j]; if (!t || seen.has(j)) continue; assert.notEqual(t.t, "space", `seed ${k}: hull leak`); if (["floor", "extract", "door"].includes(t.t)) { seen.add(j); q.push(j); } } }
    assert.ok(s.items.some((i) => i.d === "blackbox"), `seed ${k}: no black box`);
    assert.ok(s.items.some((i) => i.d === "keycard"), `seed ${k}: no keycard`);
    assert.ok(s.tiles.some((t) => t.t === "console"), `seed ${k}: no power relay`);
    assert.ok(s.tiles.some((t) => t.t === "door" && t.locked), `seed ${k}: no vault`);
    for (const it of s.items) assert.ok(seen.has(it.y * W + it.x), `seed ${k}: ${Items.name(it)} unreachable`);
  }
});

test("procedural stations differ per seed and match across pages", () => {
  const a = Sim.newGame(11, null, { gen: { tier: 2 } }), b = Sim.newGame(11, null, { gen: { tier: 2 } }), c = Sim.newGame(12, null, { gen: { tier: 2 } });
  assert.equal(Sim.hash(a), Sim.hash(b)); assert.notEqual(JSON.stringify(a.tiles), JSON.stringify(c.tiles));
  for (let k = 0; k < 40; k++) { const s = Sim.newGame(k + 900, null, { gen: { tier: 3 } }); let n = 0;
    while (s.status === "playing" && n++ < 250) { const d = N4[n % 4]; if (!Sim.act(s, "p1", { type: "move", dx: d[0], dy: d[1] })) Sim.act(s, "p1", { type: "wait" }); } JSON.stringify(s); }
});

const arena = (lo, husks = []) => { const s = Sim.newGame(5, lo, { map: "ks9" }); s.ents = s.ents.filter((e) => e.kind === "player"); const p = playerOf(s); p.x = 20; p.y = 13; for (const t of s.tiles) if (t.t === "door") t.open = true;
  for (const [x, y] of husks) s.ents.push({ id: "h" + x + y, kind: "husk", name: "husk", x, y, hp: { head: 99, torso: 99, larm: 99, rarm: 99, lleg: 99, rleg: 99 }, max: { head: 99, torso: 99, larm: 99, rarm: 99, lleg: 99, rleg: 99 }, bleed: {}, blood: 99, alive: true, aware: false, last: null, face: [0, 1] });
  Sim.fov(s, p); return { s, p }; };
const kit = (w1, ammo, inv = [], extra = {}) => ({ w1, w2: null, melee: { d: "knife", r: 0 }, armor: { d: "suit", r: 0 }, pack: { d: "sling", r: 0 }, ammo, inv, ...extra });

test("weapons: bursts spend ammo, shotguns fire pellets, guns run dry", () => {
  let { s, p } = arena(kit({ d: "hymn" }, { rifle: 5 }), [[25, 13]]);
  assert.ok(Sim.act(s, "p1", { type: "shoot", x: 25, y: 13 })); assert.equal(p.ammo.rifle, 2, "Hymn of Iron fires 3-round bursts");
  Sim.act(s, "p1", { type: "wait" }); const h = s.ents[1]; s.ents[1].stun = 5; Sim.fov(s, p);
  assert.ok(Sim.act(s, "p1", { type: "shoot", x: h.x, y: h.y })); assert.equal(p.ammo.rifle, 0, "burst clamps to the ammo left");
  Sim.act(s, "p1", { type: "wait" }); assert.equal(Sim.act(s, "p1", { type: "shoot", x: h.x, y: h.y }), false, "empty gun refuses to fire");
  ({ s, p } = arena(kit({ d: "scatter", r: 0 }, { shell: 1 }), [[21, 13]]));
  Sim.act(s, "p1", { type: "shoot", x: 21, y: 13 }); assert.ok(/pellets|misses/.test(s.log.map((l) => l.msg).join(" ")));
});

test("weapons: launchers and frags explode, stun charges stun, noisemakers lure", () => {
  let { s, p } = arena(kit({ d: "launcher", r: 0 }, { rocket: 1 }), [[24, 13]]);
  const hp0 = s.ents[1].hp.torso + s.ents[1].hp.head + s.ents[1].hp.larm + s.ents[1].hp.rarm + s.ents[1].hp.lleg + s.ents[1].hp.rleg;
  assert.ok(Sim.act(s, "p1", { type: "shoot", x: 24, y: 13 })); assert.equal(p.ammo.rocket, 0);
  assert.ok(Object.values(s.ents[1].hp).reduce((a, b) => a + b, 0) < hp0, "rocket damaged the husk");
  ({ s, p } = arena(kit(null, {}, [{ d: "stun", r: 0 }, { d: "decoy", r: 0 }, { d: "frag", r: 0 }]), [[23, 13], [30, 13]]));
  assert.ok(Sim.act(s, "p1", { type: "throw", index: 0, x: 23, y: 13 })); assert.ok(s.ents[1].stun >= 2, "stunned");
  Sim.act(s, "p1", { type: "throw", index: 0, x: 26, y: 13 }); assert.deepEqual(s.ents[2].last, { x: 26, y: 13 }, "lured by the noisemaker");
  assert.equal(Sim.act(s, "p1", { type: "throw", index: 0, x: 40, y: 13 }), false, "too far to throw");
});

test("gear: equip, swap guns, drop, typed ammo pickup, rarity scaling", () => {
  const { s, p } = arena(kit({ d: "pistol", r: 0 }, { pistol: 3 }, [{ d: "longbore", r: 2 }, { d: "flak", r: 1 }, { d: "hauler", r: 0 }]));
  assert.ok(Sim.act(s, "p1", { type: "equip", index: 0 })); assert.equal(p.w2.d, "longbore"); assert.equal(Sim.gun(p).d, "longbore");
  assert.ok(Sim.act(s, "p1", { type: "swap" })); assert.equal(Sim.gun(p).d, "pistol");
  Sim.act(s, "p1", { type: "equip", index: 0 }); assert.equal(p.armor.d, "flak"); assert.equal(p.o2max, Items.CLOTHES_O2 + Items.stats({ d: "flak", r: 1 }).o2);
  Sim.act(s, "p1", { type: "equip", index: 1 }); assert.equal(p.cap, 10);
  assert.equal(s.turn, 1, "swapping and equipping cost no turn");
  s.items.push({ id: 999, d: "ammo_sniper", r: 0, n: 4, x: p.x, y: p.y }); Sim.act(s, "p1", { type: "pickup" }); assert.equal(p.ammo.sniper, 4);
  const n = p.inv.length; Sim.act(s, "p1", { type: "drop", index: 0 }); assert.equal(p.inv.length, n - 1); assert.ok(s.items.some((i) => i.x === p.x && i.y === p.y));
  const c = Items.stats({ d: "rivet", r: 0 }), r = Items.stats({ d: "rivet", r: 2 }); assert.ok(r.dmg[1] > c.dmg[1] && r.acc > c.acc, "rarer is better");
  assert.equal(Items.name({ d: "rivet", r: 2 }), "Rivet rifle Mk III"); assert.equal(Items.name({ d: "voideye", r: 0 }), "Eye of the Void"); assert.equal(Items.rarOf({ d: "voideye", r: 0 }), 4);
});

test("clothes start: no armour or pack, weapon variants, bolt-action costs a turn", () => {
  const s0 = Sim.newGame(5, Sim.STARTER, { gen: { tier: 1 } }), p0 = s0.ents.find((e) => e.kind === "player");
  assert.equal(p0.armor, null); assert.equal(p0.pack, null); assert.equal(p0.o2max, Items.CLOTHES_O2); assert.equal(p0.cap, Items.POCKETS);
  for (const d of ["hornet", "sixgun", "wasp", "bullpup", "warden", "hound", "coachgun", "pipe", "kestrel", "rook", "thumper", "machete", "crowbar", "ripsaw", "scrapvest"]) assert.ok(Items.def(d), d);
  assert.ok(Items.RECIPES.some((r) => r.out.d === "suit") && Items.RECIPES.some((r) => r.out.d === "scrapvest"), "armour can be crafted");
  const { s, p } = arena(kit({ d: "kestrel", r: 0 }, { sniper: 3 }), [[24, 13]]);
  const t0 = s.turn; assert.ok(Sim.act(s, "p1", { type: "shoot", x: 24, y: 13 })); assert.equal(s.turn, t0 + 2, "the station gets a free turn while you work the bolt");
  assert.equal(p.busy, 0); assert.ok(/work the bolt/.test(s.log.map((l) => l.msg).join(" ")));
});

test("armour pieces: helmet, chest, legs and accessory stack, each protects its own limbs", () => {
  const { s, p } = arena(kit({ d: "pistol", r: 0 }, { pistol: 6 }, [{ d: "sallet", r: 0 }, { d: "greaves", r: 0 }, { d: "bandolier", r: 0 }, { d: "strider", r: 0 }, { d: "seals", r: 0 }], { armor: null, pack: { d: "hauler", r: 0 } }));
  const c0 = p.cap, h0 = Sim.hitChance(s, p, p.x + 4, p.y);
  Sim.act(s, "p1", { type: "equip", index: 0 }); assert.equal(p.head.d, "sallet");
  Sim.act(s, "p1", { type: "equip", index: 0 }); assert.equal(p.legs.d, "greaves");
  Sim.act(s, "p1", { type: "equip", index: 0 }); assert.equal(p.acc.d, "bandolier"); assert.equal(p.cap, c0 + 1, "bandolier adds a slot");
  const G = Sim.gearOf(p); assert.ok(G.head >= .3 && G.legs >= .24 && G.torso === 0); assert.equal(p.o2max, Items.CLOTHES_O2 + 15);
  p.hp.lleg = 0; assert.equal(p.legs.d, "greaves");
  const i = p.inv.findIndex((x) => x.d === "strider"); Sim.act(s, "p1", { type: "equip", index: i }); assert.ok(Sim.gearOf(p).nolimp, "strider legs stop the limp");
  const j = p.inv.findIndex((x) => x.d === "seals"); Sim.act(s, "p1", { type: "equip", index: j }); assert.ok(Sim.hitChance(s, p, p.x + 4, p.y) > h0, "seals help aim");
  assert.equal(s.turn, 1, "dressing costs no turn");
});

console.log(`\n${passed} passed${process.exitCode ? ", some failed" : ""}`);
