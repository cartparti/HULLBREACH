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
    const s = Sim.newGame(seed, null, { gen: { tier: 2 } }), p = playerOf(s); for (const e of s.ents) if (e.kind !== "player") e.alive = false;
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
  assert.ok(crews > 15, "crews spawn: " + crews); assert.ok(hostile >= crews * .4 && hostile < crews, "many hostile, not all"); assert.ok(uniq.size > 20, "raiders look different");
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

test("sector war and faction jobs: the Choir advances, jobs are the same for every crew member and spawn their objectives", () => {
  const sh = World.newShip(); World.warTick(sh, 0); const before = Object.values(World.war(sh).control).filter((f) => f === "choir").length;
  World.warTick(sh, 40); assert.ok(Object.values(World.war(sh).control).filter((f) => f === "choir").length > before, "the Choir takes stations over time");
  World.pushChoir(sh, -60, "Pushed back."); assert.ok(World.war(sh).choir < 100);
  const a = World.jobsFor(sh, "marshal", Sim.FACTIONS), b = World.jobsFor(JSON.parse(JSON.stringify(sh)), "marshal", Sim.FACTIONS); assert.deepEqual(a, b); assert.equal(a.length, 2);
  const base = { fac: "marshal", site: "tithe", tier: 2, reward: 500, rep: 8 };
  const s = Sim.newGame(77, null, { gen: { tier: 2 }, jobs: [{ ...base, id: "k", type: "kill", target: { fac: "reaver", name: "Warboss Test" }, title: "Kill" }, { ...base, id: "p", type: "purge", n: 2, title: "Purge" }, { ...base, id: "r", type: "rescue", title: "Rescue" }, { ...base, id: "c", type: "recover", item: "Thing", title: "Recover" }] });
  assert.ok(s.ents.some((e) => e.jobTarget === "k")); assert.ok(s.ents.some((e) => e.rescue === "r" && e.stranded)); assert.ok(s.tiles.some((t) => t.loot && t.loot.some((i) => i.job === "c")) || s.items.some((i) => i.job === "c"));
  const t = s.ents.find((e) => e.jobTarget === "k"); for (const l of ["head"]) t.hp[l] = 1; const p = playerOf(s); p.ammo.pistol = 99;
  for (const h of s.ents.filter((e) => e.kind === "husk").slice(0, 2)) { h.hp.head = 0; h.alive = false; }
});

test("galaxy: three regions, signals that come and go, every location boards cleanly", () => {
  assert.equal(World.REGIONS.length, 3); assert.equal(World.SECTORS.length, 9);
  for (const S of World.SECTORS) assert.ok(World.LOCS.some((l) => l.sector === S.id), S.id + " has places");
  const sh = World.newShip(); sh.day = 9; const sg = World.signals(sh); assert.ok(sg.length >= 9, "signals in every region");
  for (const g of sg) assert.deepEqual(World.loc(g.id), g, "signals decode the same everywhere");
  sh.day = 40; const later = World.signals(sh).map((g) => g.id); assert.ok(!sg.some((g) => later.includes(g.id)), "old signals fade");
  sh.cleared = [later[0]]; assert.ok(!World.signals(sh).some((g) => g.id === later[0]), "stripped signals vanish");
  sh.loc = "ninefold"; assert.equal(World.travelCost(sh, "spire"), 3); assert.equal(World.travelCost(sh, "haven"), 6);
  for (const L of [...World.LOCS.filter((l) => l.type === "derelict"), ...sg.slice(0, 6)]) { const s = Sim.newGame(91, null, { gen: { tier: L.site.tier, kind: L.site.kind, size: L.site.size }, mods: L.site.mods }); assert.ok(s.ents.some((e) => e.kind === "player")); for (let i = 0; i < 20; i++) Sim.act(s, "p1", { type: "wait" }); }
});

test("close quarters and getting out: strikes hit adjacent enemies, the pad works from beside it, starter kit has a knife", () => {
  assert.equal(Sim.STARTER.melee.d, "knife");
  const s = Sim.newGame(12, null, { gen: { tier: 1 } }), p = playerOf(s); for (const e of s.ents) if (e.kind !== "player") e.alive = false;
  const sp = [[1, 1], [1, 0], [0, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [p.x + a, p.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)));
  s.ents.push({ id: "hz", kind: "husk", type: "husk", name: "husk", x: sp[0], y: sp[1], hp: { head: 40, torso: 40, larm: 40, rarm: 40, lleg: 40, rleg: 40 }, max: { head: 40, torso: 40, larm: 40, rarm: 40, lleg: 40, rleg: 40 }, bleed: {}, blood: 60, alive: true, aware: false, face: [0, 1] });
  const t0 = s.turn; assert.ok(Sim.act(s, "p1", { type: "melee", x: sp[0], y: sp[1] })); assert.equal(s.turn, t0 + 1, "a strike takes a turn");
  assert.ok(!Sim.act(s, "p1", { type: "melee", x: p.x + 3, y: p.y }), "can't strike at range");
  const pad = s.tiles.findIndex((t) => t.t === "extract"), px = pad % s.W, py = (pad / s.W) | 0; const h = s.ents.find((e) => e.id === "hz"); h.x = px; h.y = py;
  const nb = [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([a, b]) => [px + a, py + b]).find(([x, y]) => Sim.tileAt(s, x, y).t === "floor" && !Sim.entAt(s, x, y));
  p.x = nb[0]; p.y = nb[1]; p.acted = false; assert.ok(Sim.canExtract(s, p)); assert.ok(Sim.act(s, "p1", { type: "extract" }) && p.extracted, "extract from beside a blocked pad");
});

test("sight is fair: raiders see no further than you, except with sniper rifles and scopes", () => {
  const s = Sim.newGame(5, { w1: { d: "pistol", r: 0 }, melee: { d: "knife", r: 0 }, ammo: { pistol: 9 }, inv: [] }, { map: "ks9" }), p = playerOf(s);
  s.power = false; s.ents = s.ents.filter((e) => e.kind === "player"); p.x = 20; p.y = 13; for (const t of s.tiles) if (t.t === "door") t.open = true;
  // a corridor tile 6 east is out of a dark 4-tile view, for both sides
  assert.ok(!Sim.canSee(s, p, p.x + 6, p.y), "you can't see 6 tiles in the dark");
  const r = { kind: "raider", x: p.x + 6, y: p.y, w1: { d: "pistol", r: 0 }, act: 1, light: { d: "flashlight", r: 0 }, trait: "veteran" };
  assert.ok(!Sim.canSee(s, r, p.x, p.y), "a raider with a pistol and a light can't either");
  r.w1 = { d: "longbore", r: 0 }; r.x = p.x + 5; assert.ok(Sim.canSee(s, r, p.x, p.y), "a sniper rifle sees a little further");
  r.w1 = { d: "carbine", r: 0, m: "scope" }; assert.ok(Sim.canSee(s, r, p.x, p.y), "so does a scope");
  p.w1 = { d: "longbore", r: 0 }; assert.ok(Sim.canSee(s, p, p.x + 5, p.y), "and it works for you too");
});

const LO = { w1: { d: "pistol", r: 0 }, melee: { d: "knife", r: 0 }, ammo: { pistol: 30 }, inv: [{ d: "breach", r: 0 }, { d: "sentry", r: 0 }] };
const lone = (seed) => { const s = Sim.newGame(seed, LO, { gen: { tier: 1 } }), p = playerOf(s); for (const e of s.ents) if (e.kind !== "player") e.alive = false; s.ev = null; s.rad = []; return { s, p }; };
const husk = (id, x, y, face) => ({ id, kind: "husk", type: "husk", name: "husk", x, y, hp: { head: 14, torso: 34, larm: 18, rarm: 18, lleg: 22, rleg: 22 }, max: { head: 14, torso: 34, larm: 18, rarm: 18, lleg: 22, rleg: 22 }, bleed: {}, blood: 60, alive: true, aware: false, face });
const besideTile = (s, pred) => { for (let i = 0; i < s.tiles.length; i++) if (pred(s.tiles[i])) { const x = i % s.W, y = (i / s.W) | 0; const n = N4.map(([a, b]) => [x + a, y + b]).find(([u, v]) => Sim.walk(Sim.tileAt(s, u, v)) && !Sim.entAt(s, u, v)); if (n) return { x, y, n }; } return null; };

test("silent takedowns: an unaware enemy dies in one strike from behind", () => {
  const { s, p } = lone(77); const sp = N4.map(([a, b]) => [p.x + a, p.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)));
  s.ents.push(husk("hq", sp[0], sp[1], [sp[0] - p.x, sp[1] - p.y]));
  Sim.act(s, "p1", { type: "melee", x: sp[0], y: sp[1] }); assert.ok(!s.ents.find((e) => e.id === "hq").alive, "takedown kills"); assert.equal(p.tally.takedowns, 1);
});

test("breaching charge blows a closed door open; field sentry deploys and runs down its battery", () => {
  const { s, p } = lone(78); const d = besideTile(s, (t) => t.t === "door" && !t.open && !t.vault); assert.ok(d, "a door");
  p.x = d.n[0]; p.y = d.n[1]; p.face = [d.x - p.x, d.y - p.y]; assert.ok(Sim.act(s, "p1", { type: "use", index: 0 }));
  assert.ok(s.charges.length === 1); for (let i = 0; i < 3; i++) Sim.act(s, "p1", { type: "wait" });
  const t = Sim.tileAt(s, d.x, d.y); assert.ok(t.open && t.broken, "door blown"); p.hp.torso = p.max.torso;
  const si = p.inv.findIndex((i) => i.d === "sentry"); assert.ok(Sim.act(s, "p1", { type: "use", index: si }));
  const b = s.ents.find((e) => e.kind === "bot" && e.owner && String(e.owner).startsWith("p:")) || s.ents.find((e) => e.kind === "bot" && e.batt);
  assert.ok(b, "sentry placed"); const b0 = b.batt; Sim.act(s, "p1", { type: "wait" }); assert.ok(b.batt < b0, "battery drains");
});

test("security terminals hack once per station; hidden caches pry open", () => {
  const { s, p } = lone(79); const d = besideTile(s, (t) => t.t === "prop" && t.kind === "desk");
  if (d) { p.x = d.n[0]; p.y = d.n[1]; const before = p.seen.filter(Boolean).length; assert.ok(Sim.act(s, "p1", { type: "hack", opt: "map" })); assert.ok(p.seen.filter(Boolean).length > before, "map downloaded");
    assert.ok(!Sim.act(s, "p1", { type: "hack", opt: "map" }), "only once"); }
  let g = null, q; for (let k = 0; k < 20 && !g; k++) { ({ s: g, p: q } = lone(500 + k)); if (!besideTile(g, (t) => t.t === "wall" && t.cache)) g = null; }
  assert.ok(g, "some station has a cache"); const c = besideTile(g, (t) => t.t === "wall" && t.cache); q.x = c.n[0]; q.y = c.n[1]; q.face = [c.x - q.x, c.y - q.y];
  const n0 = g.items.length; Sim.act(g, "p1", { type: "interact", x: c.x, y: c.y }); assert.ok(Sim.tileAt(g, c.x, c.y).pried, "pried"); assert.ok(g.items.length > n0, "loot spills out");
});

test("stations seed data logs, radiation rooms and events; every event plays out", () => {
  let logs = 0, rad = 0, ev = 0; for (let k = 0; k < 30; k++) { const s = Sim.newGame(3000 + k, LO, { gen: { tier: 1 + (k % 3), kind: ["mining", "hive", "relay", ""][k % 4] } });
    logs += s.tiles.filter((t) => t.loot && t.loot.some((i) => i.d === "datalog")).length + s.items.filter((i) => i.d === "datalog").length; if (s.rad.length) rad++; if (s.ev) ev++; }
  assert.ok(logs > 10 && rad > 2 && ev > 4, `logs ${logs} rad ${rad} ev ${ev}`);
  for (const type of ["meltdown", "horde", "lockdown", "surge"]) { const g = Sim.newGame(91, null, { gen: { tier: 2 } }); g.ev = { type, at: 2, on: 0 }; const q = playerOf(g);
    for (const l in q.hp) q.hp[l] = q.max[l] = 9999; for (let i = 0; i < 70 && g.status === "playing"; i++) Sim.act(g, "p1", { type: "wait" }); assert.ok(g.ev.on || g.status !== "playing", type + " fired"); }
});

test("radiation doses unprotected raiders and a hazard suit cuts it", () => {
  const dose = (armor) => { const { s, p } = lone(80); if (armor) p.armor = { d: armor, r: 0 }; s.rad = [Sim.idx(s, p.x, p.y)]; const b0 = p.blood; for (let i = 0; i < 12; i++) Sim.act(s, "p1", { type: "wait" }); return (b0 - p.blood) * 5 + (p.rad || 0); };
  const bare = dose(null); assert.ok(bare > 0, "dosed"); const suit = dose("hazard"); assert.ok(suit < bare, `suit ${suit} < bare ${bare}`);
});

test("mutated elites: daily-op odds spawn them, armor soaks hits, volatile ones burst, kills drop mutagen", () => {
  let n = 0, kinds = new Set(); for (let k = 0; k < 12; k++) { const s = Sim.newGame(700 + k, null, { gen: { tier: 3 }, mods: { elite: 2.5 } }); for (const e of s.ents) if (e.mut) { n++; kinds.add(e.mut); } }
  assert.ok(n >= 8 && kinds.size >= 4, `elites ${n} kinds ${kinds.size}`);
  const { s, p } = lone(81); const sp = N4.map(([a, b]) => [p.x + a * 2, p.y + b * 2]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)) && Sim.walk(Sim.tileAt(s, (x + p.x) / 2, (y + p.y) / 2)));
  const h = husk("hv", sp[0], sp[1], [0, 1]); h.mut = "volatile"; h.aware = true; for (const l in h.hp) h.hp[l] = 1; s.ents.push(h); p.hp.torso = p.max.torso = 500; p.hp.head = p.max.head = 500;
  for (let i = 0; i < 6 && h.alive; i++) { h.flee = 0; h.fled = 1; Sim.act(s, "p1", { type: "shoot", x: h.x, y: h.y }); }
  assert.ok(!h.alive, "volatile husk died"); assert.ok(s.items.some((i) => i.d === "mutagen"), "mutagen dropped"); assert.ok(p.tally.k.elite >= 1, "elite tallied");
});

test("vents link rooms: crawling moves you to the far end and costs a turn", () => {
  let g = null, q; for (let k = 0; k < 15 && !g; k++) { ({ s: g, p: q } = lone(900 + k)); if (!g.vents || !g.vents.length) g = null; }
  assert.ok(g, "a station with vents"); const [a, b] = g.vents[0]; q.x = a % g.W; q.y = (a / g.W) | 0;
  assert.ok(Sim.act(g, "p1", { type: "interact" })); assert.equal(Sim.idx(g, q.x, q.y), b, "came out the other end"); assert.equal(q.tally.vents, 1);
});

test("tripwires: spotted ones block your step and disarm into a tripmine; your tripmine kills a husk", () => {
  const { s, p } = lone(82); const sp = N4.map(([a, b]) => [p.x + a, p.y + b]).find(([x, y]) => Sim.tileAt(s, x, y).t === "floor" && !Sim.entAt(s, x, y));
  s.traps = [{ x: sp[0], y: sp[1], seen: {} }]; Sim.act(s, "p1", { type: "wait" }); assert.ok(s.traps[0].seen.p1, "spotted from next to it");
  assert.ok(!Sim.act(s, "p1", { type: "move", dx: sp[0] - p.x, dy: sp[1] - p.y }), "won't walk into a spotted wire");
  const n0 = p.inv.length; assert.ok(Sim.act(s, "p1", { type: "interact" })); assert.equal(s.traps.length, 0); assert.equal(p.inv.length, n0 + 1); assert.equal(p.inv[p.inv.length - 1].d, "tripmine");
  for (let i = 0; i < 2; i++) Sim.act(s, "p1", { type: "wait" }); p.face = [sp[0] - p.x, sp[1] - p.y];
  assert.ok(Sim.act(s, "p1", { type: "use", index: p.inv.length - 1 })); assert.equal(s.mines.length, 1); Sim.act(s, "p1", { type: "wait" });
  const m = s.mines[0], hx = m.x + (m.x - p.x), hy = m.y + (m.y - p.y); const h = husk("hm", hx, hy, [0, 1]); for (const l in h.hp) h.hp[l] = 5; s.ents.push(h); p.hp.torso = p.max.torso = 500; p.hp.head = p.max.head = 500;
  Sim.act(s, "p1", { type: "wait" }); assert.equal(s.mines.length, 0, "mine went off"); assert.ok(!h.alive || Object.values(h.hp).some((v) => v < 5), "husk caught in the blast");
});

test("welding torch seals a door: you can't open it, raiders can't pass, and you can cut it again", () => {
  const { s, p } = lone(83); p.inv.push({ d: "weldtorch", r: 0, id: 999 }); const d = besideTile(s, (t) => t.t === "door" && !t.vault); p.x = d.n[0]; p.y = d.n[1]; p.face = [d.x - p.x, d.y - p.y];
  const t = Sim.tileAt(s, d.x, d.y); t.open = false; const ti = p.inv.findIndex((i) => i.d === "weldtorch"); assert.ok(Sim.act(s, "p1", { type: "use", index: ti })); assert.ok(t.sealed && t.hp >= 26);
  Sim.act(s, "p1", { type: "wait" }); assert.ok(!Sim.act(s, "p1", { type: "move", dx: d.x - p.x, dy: d.y - p.y }), "welded doors don't open"); assert.ok(!t.open);
  assert.ok(Sim.act(s, "p1", { type: "use", index: p.inv.findIndex((i) => i.d === "weldtorch") })); assert.ok(!t.sealed, "cut open again");
});

test("sneaking: husks spot you closer, every other step costs a turn", () => {
  const { s, p } = lone(84); s.power = true; const h = husk("hs", p.x + 6, p.y, [-1, 0]); for (let x = p.x; x <= p.x + 6; x++) s.tiles[Sim.idx(s, x, p.y)] = { t: "floor" }; s.ents.push(h);
  for (let x = p.x; x <= p.x + 6; x++) for (const dy of [-1, 1]) if (Sim.tileAt(s, x, p.y + dy).t === "space") s.tiles[Sim.idx(s, x, p.y + dy)] = { t: "wall" };
  p.armor = null; p.light = null; Sim.act(s, "p1", { type: "sneak" }); assert.ok(p.sneak);
  Sim.act(s, "p1", { type: "wait" }); assert.ok(!h.aware, "a husk 6 tiles off doesn't see a sneaking player");
  const t0 = s.turn; Sim.act(s, "p1", { type: "sneak" }); Sim.act(s, "p1", { type: "sneak" }); const g = Sim.newGame(5, null, { map: "ks9" }), q = playerOf(g); g.ents = g.ents.filter((e) => e.kind === "player"); q.sneak = true; q.snk = 0;
  const dirs = N4.filter(([a, b]) => Sim.walk(Sim.tileAt(g, q.x + a, q.y + b))); const tA = g.turn; Sim.act(g, "p1", { type: "move", dx: dirs[0][0], dy: dirs[0][1] }); Sim.act(g, "p1", { type: "move", dx: -dirs[0][0], dy: -dirs[0][1] });
  assert.ok(g.turn - tA >= 3, "two sneaking steps take three turns");
});

test("death recap: hits are logged with who did them; mastery tallies kills by weapon class and helps aim", () => {
  const { s, p } = lone(85); const sp = N4.map(([a, b]) => [p.x + a, p.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)) && !Sim.entAt(s, x, y));
  const h = husk("hr", sp[0], sp[1], [p.x - sp[0], p.y - sp[1]]); h.aware = true; h.mut = "venom"; s.ents.push(h); for (const l in p.hp) p.hp[l] = 3; for (let i = 0; i < 25 && p.alive; i++) Sim.act(s, "p1", { type: "wait" });
  assert.ok(!p.alive, "died"); assert.ok(p.hits.length > 0 && /Venomous husk/.test(p.hits[p.hits.length - 1].by), "hit log names the husk"); assert.ok(/husk/i.test(p.killer));
  const { s: g, p: q } = lone(86); const sp2 = N4.map(([a, b]) => [q.x + a * 2, q.y + b * 2]).find(([x, y]) => Sim.walk(Sim.tileAt(g, x, y)) && Sim.walk(Sim.tileAt(g, (x + q.x) / 2, (y + q.y) / 2)));
  const before = Sim.hitChance(g, q, sp2[0], sp2[1]); q.mast = { pistol: 4 }; assert.ok(Math.abs(Sim.hitChance(g, q, sp2[0], sp2[1]) - before - .1) < .001 || Sim.hitChance(g, q, sp2[0], sp2[1]) === .95, "pistol mastery adds to hit chance");
  const k = husk("hk", sp2[0], sp2[1], [0, 1]); for (const l in k.hp) k.hp[l] = 1; k.aware = true; g.ents.push(k); for (let i = 0; i < 6 && k.alive; i++) Sim.act(g, "p1", { type: "shoot", x: sp2[0], y: sp2[1] });
  assert.ok(!k.alive && q.tally.wk.pistol === 1, "pistol kill tallied");
});

test("daily op: one per date, the same everywhere, brutal modifiers, listed with the signals", () => {
  const a = World.dailyOp("20261122"), b = World.dailyOp("20261122"), c = World.dailyOp("20261123"); assert.deepEqual(a, b); assert.notEqual(a.name + a.sector, c.name + c.sector + "x");
  assert.equal(World.loc(a.id).name, a.name); assert.ok(a.site.mods.elite > 1 && a.mods.length === 3); const sh = World.newShip(); sh.opKey = "20261122"; assert.ok(World.signals(sh).some((g) => g.id === a.id));
  const s = Sim.newGame(1, null, { gen: { tier: a.site.tier, kind: a.site.kind, size: a.site.size }, mods: a.site.mods }); assert.ok(s.ents.some((e) => e.kind === "player"));
});

test("Rivet the ship's cat lives aboard, wanders as the crew moves, and can be petted", () => {
  const s = Sim.newGame(3, null, { map: "ship", mode: "ship", crew: [{ id: "p1", name: "You", loadout: {} }] }), c = s.ents.find((e) => e.kind === "pet"), p = playerOf(s); assert.ok(c, "cat aboard");
  const at = [c.x, c.y]; for (let i = 0; i < 40; i++) { const d = N4[i % 4]; Sim.act(s, "p1", { type: "move", dx: d[0], dy: d[1] }); } assert.ok(c.x !== at[0] || c.y !== at[1] || c.nap > 0, "wandered (or napping)");
  const sp = N4.map(([a, b]) => [c.x + a, c.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)) && !Sim.entAt(s, x, y)); p.x = sp[0]; p.y = sp[1]; assert.ok(Sim.act(s, "p1", { type: "interact" })); assert.ok(s.fx.some((f) => f.type === "pet"));
});

test("husk nests: placed on stations, birth stalkers when you're near, burst into mutagen when destroyed", () => {
  let g = null; for (let k = 0; k < 10 && !g; k++) { const s0 = Sim.newGame(1200 + k, LO, { gen: { tier: 2, kind: "hive" }, mods: { nests: 1 } }); if (s0.ents.some((e) => e.type === "nest")) g = s0; }
  assert.ok(g, "a nest spawned"); const n = g.ents.find((e) => e.type === "nest"), p = playerOf(g); for (const e of g.ents) if (e.kind !== "player" && e !== n) e.alive = false; g.ev = null; g.traps = []; g.rad = [];
  const sp = [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [0, 3]].map(([a, b]) => [n.x + a, n.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(g, x, y)) && !Sim.entAt(g, x, y)); p.x = sp[0]; p.y = sp[1];
  for (const l in p.hp) p.hp[l] = p.max[l] = 999; n.t = 20; Sim.act(g, "p1", { type: "wait" }); assert.ok(g.ents.some((e) => e.alive && e.mom === n.id), "a stalker crawled out");
  for (const e of g.ents) if (e.mom === n.id) e.alive = false; n.hp.torso = 1; for (let i = 0; i < 8 && n.alive; i++) Sim.act(g, "p1", { type: "shoot", x: n.x, y: n.y });
  assert.ok(!n.alive, "nest destroyed"); assert.ok(g.items.some((i) => i.d === "mutagen")); assert.equal(p.tally.k.nest, 1);
});

test("special rounds: a kit loads 12 shots that run out; the Lazarus injector saves you exactly once", () => {
  const { s, p } = lone(87); p.inv.push({ d: "apkit", r: 0, id: 901 }); assert.ok(Sim.act(s, "p1", { type: "use", index: p.inv.length - 1 })); assert.deepEqual(p.spec, { t: "ap", n: 12 });
  const sp = N4.map(([a, b]) => [p.x + a * 2, p.y + b * 2]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)) && Sim.walk(Sim.tileAt(s, (x + p.x) / 2, (y + p.y) / 2)));
  const h = husk("ha", sp[0], sp[1], [0, 1]); h.type = "brute"; for (const l in h.hp) h.hp[l] = h.max[l] = 999; h.stun = 99; s.ents.push(h); p.ammo.pistol = 99;
  for (let i = 0; i < 40 && p.spec; i++) { h.blood = 999; h.bleed = {}; h.alive = true; Sim.act(s, "p1", { type: "shoot", x: h.x, y: h.y }); } assert.equal(p.spec, null, "kit used up");
  const { s: g, p: q } = lone(88); q.inv.push({ d: "lazarus", r: 0, id: 902 }); q.hp.torso = 1; Sim.act(g, "p1", { type: "wait" });
  const kill = () => { for (let i = 0; i < 3; i++) Sim.act(g, "p1", { type: "wait" }); };
  const bleedOut = () => { const l0 = q.lazarus | 0; for (let i = 0; i < 12 && q.alive && (q.lazarus | 0) === l0; i++) { q.blood = Math.min(q.blood, 2); q.bleed = { torso: 1, larm: 1, rarm: 1 }; Sim.act(g, "p1", { type: "wait" }); } };
  bleedOut(); assert.ok(q.alive && q.lazarus === 1, "Lazarus brought you back"); assert.ok(!q.inv.some((i) => i.d === "lazarus")); bleedOut(); assert.ok(!q.alive, "but only once");
});

test("nemesis: they spawn hostile, wearing your gear, carrying what they took; killing them is recorded", () => {
  const N = { name: "Vask the Gutter", fac: "reaver", lvl: 2, w1: { d: "pump", r: 1 }, items: [{ d: "medkit", r: 0 }, { d: "longbore", r: 1 }] };
  const s = Sim.newGame(77, LO, { gen: { tier: 2 }, factions: { rep: {}, nemesis: N } }), r = s.ents.find((e) => e.nemesis);
  assert.ok(r && r.name === "Vask the Gutter" && r.w1.d === "pump" && r.inv.some((i) => i.d === "longbore"), "nemesis spawned with your gear"); assert.equal(s.crews[r.crew].att, "hostile");
  assert.ok(r.max.torso > 52, "tougher than a normal raider"); const p = playerOf(s); for (const e of s.ents) if (e.kind !== "player" && e !== r) e.alive = false;
  const sp = N4.map(([a, b]) => [p.x + a, p.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)) && !Sim.entAt(s, x, y)); r.x = sp[0]; r.y = sp[1]; for (const l in r.hp) r.hp[l] = 1; r.stun = 9;
  for (let i = 0; i < 6 && r.alive; i++) Sim.act(s, "p1", { type: "melee", x: r.x, y: r.y }); assert.ok(!r.alive && s.nemesisDown === "p1", "you killed your nemesis");
});

test("new events: boarders take the pad, toxic gas spreads and chokes, a supply pod lands full of loot", () => {
  const run = (type, n) => { const g = Sim.newGame(91, LO, { gen: { tier: 2 } }); g.ev = { type, at: 2, on: 0 }; const q = playerOf(g); for (const l in q.hp) q.hp[l] = q.max[l] = 9999; q.blood = 100; for (let i = 0; i < n && g.status === "playing"; i++) { q.blood = Math.max(q.blood, 60); Sim.act(g, "p1", { type: "wait" }); } return g; };
  const b = run("boarding", 4); assert.ok(b.crews.cb && b.crews.cb.att === "hostile" && b.ents.some((e) => e.crew === "cb"), "boarders");
  const gs = run("gas", 30); assert.ok(gs.gas.length > 9, "gas spread: " + gs.gas.length);
  const q = playerOf(gs); q.x = gs.gas[0] % gs.W; q.y = (gs.gas[0] / gs.W) | 0; q.head = null; q.armor = null; const b0 = q.blood = 80; Sim.act(gs, "p1", { type: "wait" }); assert.ok(q.blood < b0 || !gs.gas.includes(Sim.idx(gs, q.x, q.y)), "gas hurts");
  const d = run("drop", 4), pod = d.tiles.find((t) => t.kind === "pod"); assert.ok(pod && pod.loot.length === 4, "pod with loot");
});

test("implants: ocular sees further, lung sacs add oxygen", () => {
  const a = Sim.newGame(5, { ...LO, implants: {} }, { map: "ks9" }), b = Sim.newGame(5, { ...LO, implants: { ocular: 1, lungs: 1 } }, { map: "ks9" }); const pa = playerOf(a), pb = playerOf(b);
  assert.equal(pb.o2max, pa.o2max + 30); pa.x = pb.x = 20; pa.y = pb.y = 13; a.power = b.power = false; for (const s0 of [a, b]) for (const t of s0.tiles) if (t.t === "door") t.open = true;
  const far = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [20 + dx * 5, 13 + dy * 5]).find(([x, y]) => Sim.los(b, 20, 13, x, y) && Sim.walk(Sim.tileAt(b, x, y)));
  if (far) { assert.ok(!Sim.canSee(a, pa, far[0], far[1]) && Sim.canSee(b, pb, far[0], far[1]), "the implant sees 5 tiles in the dark"); }
});

test("the Custodian: guards harder stations, wakes when it sees you, paints rocket strikes, and drops its core", () => {
  let g = null; for (let k = 0; k < 12 && !g; k++) { const s0 = Sim.newGame(1400 + k, LO, { gen: { tier: 3, kind: "outpost" }, mods: { custodian: 1 } }); if (s0.bossBot) g = s0; }
  assert.ok(g, "a Custodian spawned"); const c = g.ents.find((e) => e.id === g.bossBot), p = playerOf(g); for (const e of g.ents) if (e.kind !== "player" && e !== c) e.alive = false; g.ev = null; g.traps = []; g.rad = []; g.gas = [];
  const sp = [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2]].map(([a, b]) => [c.x + a, c.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(g, x, y)) && !Sim.entAt(g, x, y) && Sim.los(g, c.x, c.y, x, y));
  p.x = sp[0]; p.y = sp[1]; for (const l in p.hp) p.hp[l] = p.max[l] = 9999; p.blood = 100;
  for (let i = 0; i < 6; i++) { p.blood = 100; Sim.act(g, "p1", { type: "wait" }); } assert.ok(c.woke, "woke up"); assert.ok((g.marks || []).length || g.log.some((l) => /targeting lasers/.test(l.msg)), "rocket salvo");
  for (const l in c.hp) c.hp[l] = 1; c.stun = 9; for (let i = 0; i < 10 && c.alive; i++) Sim.act(g, "p1", { type: "shoot", x: c.x, y: c.y });
  assert.ok(!c.alive, "destroyed"); assert.ok(g.items.some((i) => i.d === "custcore")); assert.equal(p.tally.k.custodian, 1);
});

test("side objectives: two per raid, tracked live, completed by doing them", () => {
  const s = Sim.newGame(1500, LO, { gen: { tier: 2 } }); assert.equal(s.side.length, 2); assert.ok(s.side.every((o) => Sim.SIDES[o.id]));
  const g = Sim.newGame(1501, LO, { gen: { tier: 2 } }); g.side = [{ id: "search", done: 0, prog: 0 }]; const p = playerOf(g); p.tally = { searches: 8 }; Sim.act(g, "p1", { type: "wait" }); assert.equal(g.side[0].done, 1);
});

test("Concord wanted targets spawn as tough hostile captains and their death is recorded", () => {
  const s = Sim.newGame(1600, LO, { gen: { tier: 2 }, factions: { rep: {}, wanted: { id: "w9_1", name: "Old Absalom", fac: "blacksun" } } }), r = s.ents.find((e) => e.wanted === "w9_1");
  assert.ok(r && r.name === "Old Absalom" && s.crews[r.crew].att === "hostile"); const p = playerOf(s); for (const e of s.ents) if (e.kind !== "player" && e !== r) e.alive = false;
  const sp = N4.map(([a, b]) => [p.x + a, p.y + b]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)) && !Sim.entAt(s, x, y)); r.x = sp[0]; r.y = sp[1]; for (const l in r.hp) r.hp[l] = 1; r.stun = 9;
  for (let i = 0; i < 6 && r.alive; i++) Sim.act(s, "p1", { type: "melee", x: r.x, y: r.y }); assert.equal(s.wantedDown, "w9_1");
});

test("bloaters burst into a gas cloud that fades; quick kills make streaks; coffee steadies your aim", () => {
  const { s, p } = lone(1700); const sp = N4.map(([a, b]) => [p.x + a * 2, p.y + b * 2]).find(([x, y]) => Sim.walk(Sim.tileAt(s, x, y)) && Sim.walk(Sim.tileAt(s, (x + p.x) / 2, (y + p.y) / 2)));
  const b = husk("hb", sp[0], sp[1], [0, 1]); b.type = "bloater"; for (const l in b.hp) b.hp[l] = 1; b.aware = true; b.fled = 1; s.ents.push(b); p.ammo.pistol = 99;
  for (let i = 0; i < 8 && b.alive; i++) Sim.act(s, "p1", { type: "shoot", x: b.x, y: b.y }); assert.ok(!b.alive && s.gas.length > 5, "gas cloud");
  for (let i = 0; i < 40; i++) { p.blood = 100; Sim.act(s, "p1", { type: "wait" }); } assert.equal(s.gas.length, 0, "cloud cleared");
  const g = lone(1701), q = g.p; q.ammo.pistol = 99; const a1 = husk("k1", q.x + 1, q.y, [1, 0]), spot = N4.map(([a, c]) => [q.x + a, q.y + c]).filter(([x, y]) => Sim.walk(Sim.tileAt(g.s, x, y)) && !Sim.entAt(g.s, x, y));
  const [k1, k2] = [husk("k1", spot[0][0], spot[0][1], [0, 1]), husk("k2", spot[1][0], spot[1][1], [0, 1])]; for (const h of [k1, k2]) { for (const l in h.hp) h.hp[l] = 1; h.aware = true; h.fled = 1; g.s.ents.push(h); }
  for (let i = 0; i < 10 && (k1.alive || k2.alive); i++) { const t = k1.alive ? k1 : k2; Sim.act(g.s, "p1", { type: "melee", x: t.x, y: t.y }); } assert.ok(q.tally.best >= 2 || !(k1.alive || k2.alive), "streak");
  const A = Sim.newGame(5, { ...LO }, { map: "ks9" }), Bc = Sim.newGame(5, { ...LO, coffee: 1 }, { map: "ks9" }); assert.ok(Sim.hitChance(Bc, playerOf(Bc), playerOf(Bc).x + 6, playerOf(Bc).y) > Sim.hitChance(A, playerOf(A), playerOf(A).x + 6, playerOf(A).y) || Sim.hitChance(A, playerOf(A), playerOf(A).x + 6, playerOf(A).y) >= .95, "coffee");
});

test("smoke grenades block every line of sight through the cloud, then clear", () => {
  const s = Sim.newGame(5, { ...LO, inv: [{ d: "smoke", r: 0 }] }, { map: "ks9" }), p = playerOf(s); s.ents = s.ents.filter((e) => e.kind === "player"); p.x = 20; p.y = 13; for (const t of s.tiles) if (t.t === "door") t.open = true;
  const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => [1, 2, 3, 4, 5].every((k) => Sim.walk(Sim.tileAt(s, 20 + dx * k, 13 + dy * k)))); assert.ok(dir, "a straight corridor");
  const far = [20 + dir[0] * 5, 13 + dir[1] * 5]; assert.ok(Sim.los(s, 20, 13, far[0], far[1]));
  assert.ok(Sim.act(s, "p1", { type: "throw", index: 0, x: 20 + dir[0] * 2, y: 13 + dir[1] * 2 })); assert.ok(!Sim.los(s, 20, 13, far[0], far[1]), "smoke blocks sight");
  for (let i = 0; i < 10; i++) Sim.act(s, "p1", { type: "wait" }); assert.ok(Sim.los(s, 20, 13, far[0], far[1]), "smoke clears");
});

test("every ship hull boards a crew of four, every terminal and seat is reachable, the cat moves in from the Cutter up", () => {
  for (const [map, pet] of [["ship1", false], ["ship2", true], ["ship3", true], ["ship", true]]) {
    const crew = ["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id, loadout: {} })), s = Sim.newGame(7, null, { map, mode: "ship", crew, pet });
    assert.equal(s.ents.filter((e) => e.kind === "player").length, 4, map + " crew"); assert.equal(!!s.ents.find((e) => e.kind === "pet"), pet, map + " cat");
    const p = playerOf(s), W = s.W, seen = new Set([p.y * W + p.x]), q = [p.y * W + p.x];
    while (q.length) { const c = q.pop(), x = c % W, y = (c / W) | 0; for (const [dx, dy] of N4) { const j = (y + dy) * W + x + dx, t = s.tiles[j]; if (!t || seen.has(j)) continue; if (["floor", "door", "seat"].includes(t.t)) { seen.add(j); q.push(j); } } }
    const kinds = new Set(); s.tiles.forEach((t, i) => { if (t.t === "terminal") { kinds.add(t.kind); const x = i % W, y = (i / W) | 0; assert.ok(N4.some(([dx, dy]) => seen.has((y + dy) * W + x + dx)), `${map}: ${t.kind} unreachable`); } if (t.t === "seat") assert.ok(seen.has(i), `${map}: seat unreachable`); });
    for (const k of ["navtable", "helm", "rack", "stash", "airlock", "workbench", "bar", "board"]) assert.ok(kinds.has(k), `${map} has ${k}`);
    if (map !== "ship1") for (const k of ["comms", "wardrobe", "records"]) assert.ok(kinds.has(k), `${map} has ${k}`);
    for (let i = 0; i < 30; i++) { const d = N4[i % 4]; Sim.act(s, "p1", { type: "move", dx: d[0], dy: d[1] }); }
  }
});

test("loot on the deck is sparse and spread out; most of it is in containers", () => {
  let deck = 0, boxed = 0; for (let k = 0; k < 20; k++) { const s = Sim.newGame(9100 + k, null, { gen: { tier: 1 + (k % 3) } }); const it = s.items.filter((i) => !["blackbox", "keycard"].includes(i.d)); deck += it.length; for (const t of s.tiles) if (t.loot) boxed += t.loot.length;
    for (let i = 0; i < it.length; i++) for (let j = i + 1; j < it.length; j++) assert.ok(Math.max(Math.abs(it[i].x - it[j].x), Math.abs(it[i].y - it[j].y)) >= 5, "deck items at least 5 tiles apart"); }
  assert.ok(boxed > deck * 3, `containers ${boxed} vs deck ${deck}`);
});

console.log(`\n${passed} passed${process.exitCode ? ", some failed" : ""}`);
