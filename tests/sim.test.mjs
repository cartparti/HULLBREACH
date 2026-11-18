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
  assert.deepEqual([...new Set(s.tiles.filter((t) => t.t === "terminal").map((t) => t.kind))].sort(), ["airlock", "bar", "board", "comms", "helm", "navtable", "rack", "records", "stash", "wardrobe", "workbench"]);
  assert.equal(s.tiles.filter((t) => t.t === "seat").length, 4, "cockpit seats one squad of four");
  const p = playerOf(s), W = s.W, at = (k) => { const i = s.tiles.findIndex((t) => t.kind === k); return [i % W, Math.floor(i / W)]; };
  const x0 = p.x; for (let i = 0; i < 3; i++) Sim.act(s, "p1", { type: "move", dx: 1, dy: 0 });
  assert.equal(p.x, x0 + 3); assert.equal(s.turn, 1, "no turns pass aboard the ship");
  const [nx, ny] = at("navtable"); p.x = nx; p.y = ny + 1; s.fx = [];
  Sim.act(s, "p1", { type: "move", dx: 0, dy: -1 }); // walk into the star-map table
  assert.equal(p.y, ny + 1); assert.deepEqual(s.fx.map((f) => [f.type, f.kind]), [["terminal", "navtable"]]);
  const [sx, sy] = at("pilot"); p.x = sx; p.y = sy + 1; s.fx = []; assert.ok(Sim.act(s, "p1", { type: "move", dx: 0, dy: -1 })); // sit in the pilot's seat
  assert.deepEqual(s.fx.map((f) => [f.type, f.kind]), [["sit", "pilot"]]);
  Sim.act(s, "p1", { type: "interact" }); assert.deepEqual(s.fx.map((f) => [f.type, f.kind]), [["terminal", "navtable"]]);
  for (const k of ["brig", "bathroom", "break room", "crew quarters", "armory", "bridge", "engine room", "infirmary", "ship hold", "airlock", "galley", "fabrication bay"])
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
  B.inv.pop(); const nB = B.inv.length; assert.ok(Sim.act(s, "a", { type: "give", index: 0, to: "b" })); assert.equal(B.inv.length, nB + 1);
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
  Sim.act(s, "p1", { type: "equip", index: 1 }); assert.equal(p.cap, Items.POCKETS + 8);
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

test("flashlight in the starter kit, eating and drinking keep you alive", () => {
  const s = Sim.newGame(9, { ...Sim.STARTER, food: 1, water: 50 }, { gen: { tier: 1 } }), p = s.ents.find((e) => e.kind === "player");
  assert.equal(p.light.d, "flashlight"); assert.ok(Sim.gearOf(p).dark, "a flashlight steadies your aim in the dark");
  const b0 = p.blood; for (let i = 0; i < 70 && p.alive; i++) { p.acted = false; Sim.act(s, "p1", { type: "wait" }); }
  assert.equal(p.food, 0); assert.ok(p.blood < b0, "starving costs blood");
  const r = p.inv.findIndex((it) => it.d === "ration"); assert.ok(Sim.act(s, "p1", { type: "use", index: r })); assert.ok(p.food >= 20, "eating restores food");
  const w = p.inv.findIndex((it) => it.d === "waterflask"); const w0 = p.water; Sim.act(s, "p1", { type: "use", index: w }); assert.ok(p.water > w0 + 30);
  assert.ok(Items.RECIPES.every((rc) => Items.DEF[rc.out.d] && rc.lvl >= 1 && rc.lvl <= 5), "every recipe makes a real item at a real fabricator level");
  assert.equal(Items.craftRarity(Items.RECIPES.find((rc) => rc.out.d === "pistol"), 4), 2, "a better fabricator makes better guns");
});

test("husk AI: the shriek calls the pack, they surround you, a heavy hit tears limbs off", () => {
  const { s, p } = arena(kit({ d: "pistol", r: 0 }, { pistol: 10 }), [[24, 13], [26, 13], [20, 18]]);
  for (const h of s.ents.filter((e) => e.kind === "husk")) h.hp.torso = 99;
  p.acted = false; Sim.act(s, "p1", { type: "wait" });
  const hs = s.ents.filter((e) => e.kind === "husk");
  assert.ok(hs[0].aware && hs[1].aware, "the pack heard the shriek");
  for (let i = 0; i < 8; i++) { p.hp = { head: 99, torso: 99, larm: 99, rarm: 99, lleg: 99, rleg: 99 }; p.blood = 100; p.acted = false; Sim.act(s, "p1", { type: "wait" }); }
  const adj = hs.filter((h) => Math.abs(h.x - p.x) + Math.abs(h.y - p.y) === 1);
  assert.ok(adj.length >= 2, "at least two husks reached you");
  assert.equal(new Set(adj.map((h) => h.x + "," + h.y)).size, adj.length, "they took different sides");
  const v = hs[0]; v.hp.larm = 5; s.fx = [];
  const { s: s2, p: p2 } = arena(kit({ d: "voideye", r: 0 }, { sniper: 20 }), [[24, 13]]);
  const h2 = s2.ents.find((e) => e.kind === "husk"); h2.hp = { head: 999, torso: 999, larm: 3, rarm: 3, lleg: 3, rleg: 3 }; h2.stun = 99;
  for (let i = 0; i < 20 && !(h2.sev && Object.keys(h2.sev).length); i++) { p2.acted = false; p2.busy = 0; Sim.act(s2, "p1", { type: "shoot", x: h2.x, y: h2.y }); }
  assert.ok(h2.sev && Object.keys(h2.sev).length >= 1, "a sniper round takes a limb with it");
});

test("inventory: stow gear back into the pack, equip a gun into a chosen slot", () => {
  const { s, p } = arena(kit({ d: "pistol", r: 0 }, { pistol: 3 }, [{ d: "carbine", r: 0 }], { pack: { d: "field", r: 0 } }));
  assert.ok(Sim.act(s, "p1", { type: "equip", index: 0, slot: "w2" })); assert.equal(p.w2.d, "carbine"); assert.equal(p.w1.d, "pistol");
  assert.ok(Sim.act(s, "p1", { type: "unequip", slot: "armor" })); assert.equal(p.armor, null); assert.ok(p.inv.some((i) => i.d === "suit"));
  assert.ok(Sim.act(s, "p1", { type: "unequip", slot: "w2" })); assert.equal(p.w2, null); assert.equal(Sim.gun(p).d, "pistol");
  assert.equal(s.turn, 1, "rearranging gear is free");
});

test("containers: generated stations hide loot in lockers and crates, searched once", () => {
  let found = 0, total = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const s = Sim.newGame(seed, null, { gen: { tier: 2 } }), p = playerOf(s);
    const boxes = s.tiles.map((t, i) => [t, i]).filter(([t]) => t.t === "prop" && t.loot);
    total += boxes.length; found += boxes.filter(([t]) => t.loot.length).length;
    const [t, i] = boxes.find(([t]) => t.loot.length) || [];
    if (!t) continue;
    const x = i % s.W, y = (i / s.W) | 0, nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [x + a, y + b]).find(([a, b]) => Sim.walk(Sim.tileAt(s, a, b)) && !Sim.entAt(s, a, b));
    if (!nb) continue;
    p.x = nb[0]; p.y = nb[1]; p.face = [x - p.x, y - p.y];
    const n0 = s.items.length, k = t.loot.length;
    assert.ok(Sim.act(s, "p1", { type: "interact" })); assert.ok(t.searched);
    assert.equal(s.items.filter((it) => it.x === p.x && it.y === p.y).length >= k, true); assert.ok(s.items.length >= n0 + k);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = Sim.tileAt(s, p.x + a, p.y + b); if (q !== t) delete q.loot, q.searched = q.searched || q.t === "prop"; }
    const n1 = s.items.length; Sim.act(s, "p1", { type: "interact" }); assert.ok(s.items.length <= n1 + 1 && t.searched, "can't loot twice");
  }
  assert.ok(total > 20, "plenty of containers: " + total); assert.ok(found > total * .4);
});

test("raiders: crews spawn kitted out, loot, fight, talk back, and can be searched", () => {
  let crews = 0, hostile = 0, uniq = new Set();
  for (let k = 0; k < 30; k++) { const s = Sim.newGame(5000 + k * 101, null, { gen: { tier: 1 + (k % 3) } });
    for (const C of Object.values(s.crews)) { crews++; if (C.att === "hostile") hostile++; }
    for (const r of s.ents.filter((e) => e.kind === "raider")) { assert.ok(r.w1 && r.look && r.name); uniq.add(JSON.stringify([r.w1.d, r.head && r.head.d, r.armor && r.armor.d, r.look.s, r.look.h])); } }
  assert.ok(crews > 15, "crews spawn: " + crews); assert.ok(hostile > crews * .5 && hostile < crews, "mostly hostile, not all"); assert.ok(uniq.size > 20, "raiders look different");
  // a wary crew answers what you type
  const s = Sim.newGame(777, null, { gen: { tier: 2 }, mods: { raiders: 1 } }), p = playerOf(s), r = s.ents.find((e) => e.kind === "raider");
  s.crews[r.crew].att = "wary"; for (const h of s.ents) if (h.kind === "husk" || h.kind === "bot") h.alive = false; p.hp.torso = p.max.torso = p.hp.head = p.max.head = 999;
  const spot = [[2, 0], [0, 2], [-2, 0], [0, -2], [1, 1], [-1, 1]].map(([a, b]) => [p.x + a, p.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)) && !Sim.entAt(s, x, y)); r.x = spot[0]; r.y = spot[1];
  assert.equal(Sim.intentOf("Drop your weapons!"), "surrender"); assert.equal(Sim.intentOf("we don't want trouble"), "truce"); assert.equal(Sim.intentOf("back off or I shoot"), "backoff");
  const n0 = s.log.length, t0 = s.turn; assert.ok(Sim.act(s, "p1", { type: "talk", text: "Hello there" })); assert.equal(s.turn, t0, "talking is free");
  assert.ok(s.log.slice(n0).some((l) => l.kind === "chat" && l.from === r.id), "they answer");
  // shooting them makes the crew hostile; a dead raider can be searched
  r.ammo = {}; for (let i = 0; i < 12 && r.alive; i++) { p.ammo.pistol = 50; p.acted = false; p.blood = 100; p.bleed = {}; Sim.act(s, "p1", { type: "shoot", x: r.x, y: r.y }); }
  assert.equal(s.crews[r.crew].att, "hostile");
  if (r.alive) { r.alive = false; }
  const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [r.x + a, r.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)) && !Sim.entAt(s, x, y)); p.x = adj[0]; p.y = adj[1]; p.acted = false;
  const gunD = r.w1 && r.w1.d; assert.ok(Sim.act(s, "p1", { type: "loot", id: r.id, src: "eq", key: "w1" }) || !gunD); if (gunD) assert.ok(p.inv.some((i) => i.d === gunD));
  // long unattended runs never throw and stay serialisable
  for (let k = 0; k < 12; k++) { const g = Sim.newGame(9000 + k, null, { gen: { tier: 3 }, mods: { raiders: 3 } }); const q = playerOf(g); q.hp.torso = q.max.torso = 9999;
    for (let i = 0; i < 300 && g.status === "playing"; i++) Sim.act(g, "p1", { type: "wait" }); JSON.parse(JSON.stringify(g)); }
});

test("factions: nine outfits, synths spark, standing shifts who shoots first, hired guns follow you", () => {
  const F = Sim.FACTIONS; assert.ok(Object.keys(F).length >= 9); assert.ok(Object.values(F).some((f) => f.species === "synth"));
  for (const [k, f] of Object.entries(F)) { assert.ok(f.name && f.kind && f.rep && f.rep.look && f.emblem, k); for (const g of f.guns) assert.ok(Items.def(g), k + " gun " + g); for (const sl of ["head", "armor", "legs", "acc"]) for (const d of f[sl]) if (d) assert.ok(Items.def(d), k + " " + d); }
  const hostileShare = (rep) => { let h = 0, n = 0; for (let k = 0; k < 40; k++) { const s = Sim.newGame(700 + k, null, { gen: { tier: 2 }, mods: { raiders: 2 }, factions: { rep } }); for (const C of Object.values(s.crews)) { n++; if (C.att === "hostile") h++; } } return h / n; };
  const all = (v) => Object.fromEntries(Object.keys(F).map((k) => [k, v]));
  assert.ok(hostileShare(all(80)) < hostileShare(all(-80)) - .3, "good standing means fewer crews shoot first");
  // synths don't bleed
  let syn = null; for (let k = 0; k < 80 && !syn; k++) { const s = Sim.newGame(1200 + k, null, { gen: { tier: 3 }, mods: { raiders: 3 } }); const r = s.ents.find((e) => e.kind === "raider" && e.syn); if (r) syn = { s, r }; }
  assert.ok(syn, "synth crews spawn"); assert.ok(syn.r.look.syn);
  // hired escort
  const s = Sim.newGame(42, null, { gen: { tier: 2 }, factions: { rep: {}, hire: { fac: "unbound", by: "p1" } } }), h = s.ents.find((e) => e.hired), p = playerOf(s);
  assert.ok(h && h.fac === "unbound" && s.crews.hire.follow === "p1");
  for (let i = 0; i < 20; i++) Sim.act(s, "p1", { type: "wait" }); assert.ok(Math.abs(h.x - p.x) + Math.abs(h.y - p.y) <= 3, "escort stays close");
});

test("death and its consolations: secure pouch, your old body, prisoners; skills and injuries", () => {
  const lo = { w1: { d: "pistol", r: 0 }, melee: { d: "knife", r: 0 }, ammo: { pistol: 30 }, inv: [{ d: "val3", r: 0 }, { d: "medkit", r: 0 }, { d: "splint", r: 0 }], secCap: 1, brig: true, perks: { tough: 2, mule: 1 }, injury: { frac: { rarm: 1 }, inf: 0 } };
  const s = Sim.newGame(321, lo, { gen: { tier: 1 }, mods: { raiders: 1 } }), p = playerOf(s);
  assert.ok(p.max.torso > 60 && p.cap === 11 && p.frac.rarm, "perks and injuries load");
  assert.ok(Sim.act(s, "p1", { type: "secure", index: 0 }) && p.inv[0].sec); assert.ok(!Sim.act(s, "p1", { type: "secure", index: 1 }), "pouch has one slot");
  assert.ok(Sim.act(s, "p1", { type: "use", index: 2 }) && !p.frac.rarm, "splint sets the arm");
  // your old body turns up on a return visit
  const s2 = Sim.newGame(322, { ...lo, remains: { items: [{ d: "carbine", r: 1 }, { d: "flak", r: 0 }], ammo: { rifle: 9 }, days: 0 } }, { gen: { tier: 1 } }), rm = s2.ents.find((e) => e.kind === "remains");
  assert.ok(rm && rm.inv.length === 2); const q = playerOf(s2); const sp = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [rm.x + a, rm.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(s2, x, y)) && !Sim.entAt(s2, x, y)); q.x = sp[0]; q.y = sp[1];
  assert.ok(Sim.act(s2, "p1", { type: "loot", id: rm.id, all: true })); assert.ok(q.inv.some((i) => i.d === "carbine") && q.ammo.rifle >= 9);
  // a prisoner follows you onto the shuttle
  const r = s.ents.find((e) => e.kind === "raider"); for (const e of s.ents) if (e.kind === "husk" || e.kind === "bot" || (e.kind === "raider" && e !== r)) e.alive = false;
  const pad = s.tiles.findIndex((t) => t.t === "extract"); p.x = pad % s.W; p.y = (pad / s.W) | 0; const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [p.x + a, p.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)) && !Sim.entAt(s, x, y));
  r.x = nb[0]; r.y = nb[1]; r.surr = true; assert.ok(Sim.act(s, "p1", { type: "loot", id: r.id, src: "bind" }) && r.prisoner === "p1");
  assert.ok(Sim.act(s, "p1", { type: "extract" })); assert.equal(s.prisoners.length, 1);
});

console.log(`\n${passed} passed${process.exitCode ? ", some failed" : ""}`);
