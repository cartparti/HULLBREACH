// =====================================================================
// ITEMS — the gear catalogue. Pure and shared by every page.
// An item instance is tiny so it fits in squad messages:
//   {d: defId, r: rarity 0-4, l?: upgrade level, v?: value (salvage), n?: stack}
// Everything else (name, stats, value) is derived here, identically everywhere.
// Rarity 0-2 are base models (Mk I-III); 3 (Extremely rare) and 4 (Legendary)
// are named uniques with their own art and effects.
// =====================================================================
const Items = (() => {
  const RAR = [
    { name: "Common", col: "#a8a89c", tag: "" },
    { name: "Uncommon", col: "#6fbf5a", tag: " Mk II" },
    { name: "Rare", col: "#4f8fe0", tag: " Mk III" },
    { name: "Extremely rare", col: "#b061e8", tag: "" },
    { name: "Legendary", col: "#f0a43a", tag: "" },
  ];
  const AMMO = {
    pistol: { name: "Pistol rounds", short: "PST", stack: 12, col: "#c9a24a" },
    rifle:  { name: "Rifle rounds", short: "RFL", stack: 10, col: "#a8b06a" },
    shell:  { name: "Shotgun shells", short: "SHL", stack: 6, col: "#c0503a" },
    sniper: { name: "Sniper rounds", short: "SNP", stack: 4, col: "#7ab0c0" },
    rocket: { name: "Rockets", short: "RKT", stack: 2, col: "#d0703a" },
  };
  const MATS = { scrap: "Scrap metal", prop: "Propellant", circ: "Circuitry" };
  // k: weapon | armor | pack | throw | med | key | val | box | mat | ammo | dye
  const DEF = {
    // ---- pistols ----
    pistol:   { k: "weapon", cls: "pistol", name: "Service pistol", ammo: "pistol", dmg: [11, 17], acc: 0, fall: .035, value: 120, desc: "Reliable sidearm." },
    cannon:   { k: "weapon", cls: "pistol", name: "Hand cannon", ammo: "pistol", dmg: [17, 25], acc: -.06, fall: .04, value: 260, desc: "Kicks like a mule. Hits like one too." },
    widow:    { k: "weapon", cls: "pistol", name: "Widow's Kiss", ammo: "pistol", dmg: [15, 21], acc: .08, fall: .03, bleed: 1, rar: 3, value: 900, desc: "Every hit opens a wound that won't close." },
    lastword: { k: "weapon", cls: "pistol", name: "The Last Word", ammo: "pistol", dmg: [22, 30], acc: .1, fall: .025, head: .35, rar: 4, value: 2200, desc: "Engraved with a prayer nobody finished. Finds the head." },
    // ---- rifles ----
    carbine:  { k: "weapon", cls: "rifle", name: "Autocarbine", ammo: "rifle", dmg: [9, 14], acc: .05, fall: .025, burst: 2, value: 380, desc: "Fires two-round bursts." },
    rivet:    { k: "weapon", cls: "rifle", name: "Rivet rifle", ammo: "rifle", dmg: [13, 20], acc: .12, fall: .018, value: 420, desc: "Accurate at long range." },
    lament:   { k: "weapon", cls: "rifle", name: "Saint Orrin's Lament", ammo: "rifle", dmg: [15, 22], acc: .18, fall: .012, burst: 2, rar: 3, value: 1400, desc: "A pilgrim's rifle, censer still smoking." },
    hymn:     { k: "weapon", cls: "rifle", name: "Hymn of Iron", ammo: "rifle", dmg: [14, 20], acc: .16, fall: .012, burst: 3, rar: 4, value: 2600, desc: "Three barrels, one voice. Three-round bursts." },
    // ---- shotguns ----
    scatter:  { k: "weapon", cls: "shotgun", name: "Breach scattergun", ammo: "shell", dmg: [6, 10], pellets: 4, acc: .08, fall: .11, value: 420, desc: "Four pellets. Brutal up close." },
    pump:     { k: "weapon", cls: "shotgun", name: "Pump gun", ammo: "shell", dmg: [7, 11], pellets: 3, acc: .12, fall: .09, value: 360, desc: "Three heavy pellets, steadier reach." },
    gravedigger: { k: "weapon", cls: "shotgun", name: "Gravedigger", ammo: "shell", dmg: [8, 13], pellets: 5, acc: .12, fall: .08, bleed: .7, rar: 3, value: 1300, desc: "Its stock is a sharpened spade." },
    sweeper:  { k: "weapon", cls: "shotgun", name: "Deck Sweeper", ammo: "shell", dmg: [9, 14], pellets: 6, acc: .15, fall: .07, knock: 1, rar: 4, value: 2500, desc: "Six pellets. Throws husks across the room." },
    // ---- snipers ----
    longbore: { k: "weapon", cls: "sniper", name: "Longbore", ammo: "sniper", dmg: [26, 38], acc: .2, fall: .006, close: .25, value: 640, desc: "Devastating at range, clumsy up close." },
    goodbye:  { k: "weapon", cls: "sniper", name: "Long Goodbye", ammo: "sniper", dmg: [32, 44], acc: .26, fall: .004, close: .2, head: .25, rar: 3, value: 1800, desc: "Ivory stock, never missed a funeral." },
    voideye:  { k: "weapon", cls: "sniper", name: "Eye of the Void", ammo: "sniper", dmg: [38, 52], acc: .3, fall: .003, close: .1, pierce: 1, dark: 1, rar: 4, value: 3200, desc: "Sees in the dark. Rounds pass through the first target." },
    // ---- launchers ----
    launcher: { k: "weapon", cls: "launcher", name: "Breaching launcher", ammo: "rocket", dmg: [14, 24], blast: 1.6, acc: .1, fall: .02, value: 900, desc: "Explosive rockets. Mind the windows." },
    hullbreaker: { k: "weapon", cls: "launcher", name: "Hullbreaker", ammo: "rocket", dmg: [18, 28], blast: 2.2, acc: .14, fall: .015, rar: 3, value: 2000, desc: "Built to open ships. It does." },
    judgement: { k: "weapon", cls: "launcher", name: "Judgement", ammo: "rocket", dmg: [24, 36], blast: 2.8, fire: 1, acc: .16, fall: .012, rar: 4, value: 3600, desc: "Gilded. Its rockets leave fire behind." },
    // ---- melee ----
    knife:    { k: "weapon", cls: "melee", name: "Combat knife", dmg: [7, 11], acc: .1, bleed: .5, value: 60, desc: "Quick and quiet." },
    axe:      { k: "weapon", cls: "melee", name: "Fire axe", dmg: [11, 17], acc: 0, pry: 1, value: 180, desc: "Opens dead doors in one swing." },
    maul:     { k: "weapon", cls: "melee", name: "Shock maul", dmg: [14, 20], acc: -.05, stun: 1, value: 320, desc: "Stuns what it hits for a turn." },
    butcher:  { k: "weapon", cls: "melee", name: "Butcher's Hymn", dmg: [16, 24], acc: .08, bleed: .9, rar: 3, value: 1100, desc: "A cleaver that sings when it bites." },
    splitter: { k: "weapon", cls: "melee", name: "Voidsplitter", dmg: [22, 32], acc: .05, stun: 2, cleave: 1, rar: 4, value: 2800, desc: "Hits everything next to you and stuns it." },
    // ---- throwables ----
    frag:     { k: "throw", cls: "throw", name: "Frag grenade", dmg: [14, 22], blast: 1.6, value: 80, desc: "Blast radius 1-2 tiles." },
    incendiary: { k: "throw", cls: "throw", name: "Incendiary", dmg: [3, 6], fire: 1.6, value: 90, desc: "Sets the area on fire." },
    stun:     { k: "throw", cls: "throw", name: "Stun charge", stunr: 2.2, stun: 3, value: 70, desc: "Stuns husks nearby for three turns." },
    decoy:    { k: "throw", cls: "throw", name: "Noisemaker", noise: 13, value: 40, desc: "Every husk in earshot goes to look." },
    sunburst: { k: "throw", cls: "throw", name: "Sunburst Charge", dmg: [20, 30], blast: 2.4, fire: 1.2, rar: 3, value: 600, desc: "A blinding blast that leaves fire." },
    halo:     { k: "throw", cls: "throw", name: "Black Halo", dmg: [26, 40], blast: 2.8, pull: 1, stun: 2, rar: 4, value: 1500, desc: "Drags everything in, then detonates." },
    // ---- armor (defines your silhouette) ----
    suit:     { k: "armor", name: "Contractor suit", dr: 0, fire: 0, o2: 60, value: 40, pal: "suit", desc: "Standard sealed suit." },
    flak:     { k: "armor", name: "Flak carapace", dr: .25, fire: .1, o2: 50, value: 380, pal: "flak", desc: "Plated against claws and shrapnel." },
    hazard:   { k: "armor", name: "Hazard suit", dr: .08, fire: .6, o2: 100, value: 340, pal: "hazard", desc: "Shrugs off fire. Big oxygen tank." },
    ossuary:  { k: "armor", name: "Ossuary Plate", dr: .4, fire: .25, o2: 70, rar: 3, value: 1600, pal: "ossuary", desc: "Bone-white plate taken from a pilgrim ship." },
    shroud:   { k: "armor", name: "Void Shroud", dr: .18, fire: .1, o2: 80, stealth: 3, rar: 3, value: 1500, pal: "shroud", desc: "Husks notice you three tiles later." },
    aegis:    { k: "armor", name: "Saint's Aegis", dr: .5, fire: .5, o2: 90, rar: 4, value: 3400, pal: "aegis", desc: "Gilded, haloed and nearly impossible to kill." },
    // ---- backpacks ----
    sling:    { k: "pack", name: "Sling pack", slots: 6, value: 30, desc: "Small and light." },
    field:    { k: "pack", name: "Field pack", slots: 8, value: 220, desc: "A proper rucksack." },
    hauler:   { k: "pack", name: "Hauler pack", slots: 10, value: 480, desc: "Big frame pack." },
    mule:     { k: "pack", name: "Mule Frame", slots: 12, rar: 3, value: 1200, desc: "Exo-assisted cargo frame." },
    bottomless: { k: "pack", name: "Bottomless Satchel", slots: 14, rar: 4, value: 2600, desc: "It shouldn't hold this much. It does." },
    // ---- consumables & misc ----
    bandage:  { k: "med", name: "Bandage roll", value: 15, desc: "Stops bleeding on one limb." },
    medkit:   { k: "med", name: "Trauma kit", value: 55, rar: 1, desc: "Stops all bleeding and patches every limb." },
    o2:       { k: "med", name: "Oxygen canister", value: 25, desc: "Refills 50 suit O₂." },
    stim:     { k: "med", name: "Combat stim", value: 140, rar: 2, desc: "Restores 25 blood and numbs crippled legs for 10 turns." },
    keycard:  { k: "key", name: "Captain's keycard", value: 20, desc: "Opens the vault while station power is on." },
    blackbox: { k: "box", name: "Black box recorder", value: 150, desc: "A flight recorder. Worth far more to whoever hired you." },
    scrap:    { k: "mat", name: "Scrap metal", value: 6, desc: "Crafting material." },
    prop:     { k: "mat", name: "Propellant", value: 10, desc: "Crafting material." },
    circ:     { k: "mat", name: "Circuitry", value: 16, desc: "Crafting material." },
  };
  for (const a of Object.keys(AMMO)) DEF["ammo_" + a] = { k: "ammo", ammo: a, name: AMMO[a].name, value: 2, desc: "Ammunition." };
  const VALS = [["Encrypted data shard", 120], ["Gold-plated relay", 90], ["Sealed biosample", 150], ["Officer's signet", 70], ["Quantum coolant cell", 110], ["Unmarked credit chit", 80], ["Reliquary bone", 130], ["Navigator's astrolabe", 160]];
  VALS.forEach(([n, v], i) => { DEF["val" + i] = { k: "val", name: n, value: v, desc: "Salvage. Any trader will buy it." }; });
  // dyes: cosmetic unlocks for the wardrobe
  const DYES = {
    cloak: { red: ["#5e1a12", "#8a2a1c", 0], black: ["#1e1c1e", "#38343a", 0], olive: ["#3a4428", "#56603c", 0], navy: ["#1c2a44", "#2e4466", 1], bone: ["#a89a80", "#cfc2a6", 2], violet: ["#3e1e52", "#62307e", 3], gold: ["#8a6a1e", "#c9a24a", 4] },
    visor: { amber: ["#f2b648", 0], cyan: ["#5ad0d0", 0], red: ["#ff4a30", 1], green: ["#7cff7a", 2], white: ["#f4f4ff", 3], void: ["#c070ff", 4] },
    crest: { plume: ["Red plume", 0], none: ["Bare helm", 0], antenna: ["Antenna", 0], fin: ["Steel fin", 1], horns: ["Horns", 2], halo: ["Halo", 4] },
  };
  for (const [slot, opts] of Object.entries(DYES)) for (const [id, o] of Object.entries(opts)) { const r = slot === "crest" ? o[1] : slot === "visor" ? o[1] : o[2]; if (r > 0) DEF[`dye_${slot}_${id}`] = { k: "dye", slot, dye: id, rar: r, name: `${slot === "crest" ? o[0] : id[0].toUpperCase() + id.slice(1) + (slot === "cloak" ? " cloak dye" : " visor tint")}`, value: 60 * (r + 1), desc: "Unlocks a new look in the wardrobe." }; }

  const BASE_WEAPONS = ["pistol", "cannon", "carbine", "rivet", "scatter", "pump", "longbore", "launcher", "knife", "axe", "maul"];
  const UNIQ = Object.keys(DEF).filter((d) => DEF[d].rar >= 3);
  const def = (d) => DEF[d] || null;
  const rarOf = (it) => { const D = def(it.d); return D && (D.rar >= 3 || D.k === "dye") ? D.rar : it.r | 0; };
  const MULT = [1, 1.12, 1.25];

  function stats(it) {
    const D = def(it.d); if (!D) return null; const r = rarOf(it), s = { ...D, rar: r };
    if (D.rar >= 3) return s;
    if (D.k === "weapon" || D.k === "throw") { const m = MULT[r] || 1; if (D.dmg) s.dmg = [Math.round(D.dmg[0] * m), Math.round(D.dmg[1] * m)]; s.acc = (D.acc || 0) + r * .03; }
    if (D.k === "armor") { s.dr = Math.min(.45, (D.dr || 0) + r * .05); s.o2 = D.o2 + r * 10; s.fire = Math.min(.8, (D.fire || 0) + r * .05); }
    if (D.k === "pack") s.slots = D.slots + (it.l | 0);
    return s;
  }
  function name(it) { const D = def(it.d); if (!D) return "Unknown"; if (D.k === "ammo") return `${D.name} ×${it.n | 0}`; if (D.k === "mat") return it.n > 1 ? `${D.name} ×${it.n}` : D.name; const r = rarOf(it); return D.name + (D.rar >= 3 || ["weapon", "armor", "throw"].indexOf(D.k) < 0 ? "" : RAR[r].tag) + (it.l ? ` +${it.l}` : ""); }
  function value(it) { const D = def(it.d); if (!D) return 0; if (D.k === "val") return it.v || D.value; if (D.k === "ammo" || D.k === "mat") return D.value * (it.n || 1); if (D.k === "dye") return D.value; const r = rarOf(it); return Math.round(D.value * (D.rar >= 3 ? 1 : [1, 1.7, 2.8][r]) * (1 + (it.l | 0) * .25)); }
  const make = (d, r = 0, extra) => ({ d, r: def(d) && def(d).rar >= 3 ? def(d).rar : r, ...(extra || {}) });
  const kind = (it) => (def(it.d) ? def(it.d).k : null);
  const slotOf = (it) => { const k = kind(it); if (k === "weapon") return def(it.d).cls === "melee" ? "melee" : "gun"; return k === "armor" ? "armor" : k === "pack" ? "pack" : null; };
  // rarity roll for a loot tier (1 easy - 3 hard); rng() -> [0,1)
  function rollRar(rng, tier) {
    const w = [[62, 26, 9, 2.4, .6], [50, 30, 14, 4.5, 1.5], [40, 32, 18, 7, 3]][Math.max(0, Math.min(2, tier - 1))];
    let x = rng() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < 5; i++) { if ((x -= w[i]) < 0) return i; } return 0;
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  // one random loot item of a category ("any" picks by weight)
  function roll(rng, tier, cat = "any") {
    if (cat === "any") { const c = rng(); cat = c < .2 ? "ammo" : c < .34 ? "med" : c < .5 ? "mat" : c < .66 ? "val" : c < .8 ? "weapon" : c < .86 ? "throw" : c < .92 ? "armor" : c < .96 ? "pack" : "dye"; }
    const r = rollRar(rng, tier);
    if (cat === "ammo") { const a = pick(rng, ["pistol", "pistol", "rifle", "rifle", "shell", "shell", "sniper", "rocket"]); return { d: "ammo_" + a, r: 0, n: Math.max(1, Math.round(AMMO[a].stack * (.6 + rng() * .8))) }; }
    if (cat === "mat") { const m = pick(rng, ["scrap", "scrap", "scrap", "prop", "prop", "circ"]); return { d: m, r: 0, n: 1 + Math.floor(rng() * 3) }; }
    if (cat === "val") { const i = Math.floor(rng() * VALS.length); return { d: "val" + i, r: 0, v: Math.round(VALS[i][1] * (.85 + rng() * .4) * (1 + (tier - 1) * .2)) }; }
    if (cat === "med") return make(pick(rng, ["bandage", "bandage", "bandage", "o2", "o2", "medkit", "medkit", "stim"]), 0);
    if (cat === "dye") { const ds = Object.keys(DEF).filter((d) => DEF[d].k === "dye" && DEF[d].rar <= Math.max(1, r)); return make(pick(rng, ds), 0); }
    if (r >= 3) { const pool = UNIQ.filter((d) => DEF[d].rar === r && (cat === "weapon" ? DEF[d].k === "weapon" : DEF[d].k === cat)); if (pool.length) return make(pick(rng, pool)); }
    const base = cat === "weapon" ? BASE_WEAPONS : Object.keys(DEF).filter((d) => DEF[d].k === cat && !(DEF[d].rar >= 3));
    if (cat === "pack") { const p = r >= 2 ? "hauler" : r === 1 ? "field" : pick(rng, ["sling", "field"]); return make(p, 0); }
    return make(pick(rng, base), Math.min(2, r));
  }
  function info(it) { const D = def(it.d) || { k: "?", name: "Unknown", desc: "" }, r = rarOf(it); return { name: name(it), desc: D.desc || "", sell: Math.round(value(it) * .5), value: value(it), rar: r, rarName: RAR[r].name, col: RAR[r].col, kind: D.k, cat: { weapon: "gear", armor: "gear", pack: "gear", throw: "supplies", med: "supplies", mat: "materials", ammo: "materials", val: "salvage", box: "salvage", key: "salvage", dye: "salvage" }[D.k] || "salvage" }; }
  function statLine(it) {
    const s = stats(it); if (!s) return "";
    if (s.k === "weapon") { const parts = [`${s.dmg[0]}–${s.dmg[1]} dmg`]; if (s.pellets) parts[0] = `${s.pellets}×${s.dmg[0]}–${s.dmg[1]}`; if (s.burst) parts.push(`burst ${s.burst}`); if (s.ammo) parts.push(AMMO[s.ammo].name.toLowerCase()); else parts.push("melee"); if (s.blast) parts.push(`blast ${s.blast}`); if (s.stun) parts.push(`stun ${s.stun}`); if (s.bleed >= .7) parts.push("bleeds"); if (s.pierce) parts.push("pierces"); if (s.knock) parts.push("knockback"); if (s.cleave) parts.push("cleaves"); return parts.join(" · "); }
    if (s.k === "armor") return `${Math.round(s.dr * 100)}% head/torso armour · ${Math.round(s.fire * 100)}% fire · ${s.o2} O₂${s.stealth ? " · stealth" : ""}`;
    if (s.k === "pack") return `${s.slots} slots`;
    if (s.k === "throw") return [s.dmg ? `${s.dmg[0]}–${s.dmg[1]} dmg` : "", s.blast ? `blast ${s.blast}` : "", s.fire ? "fire" : "", s.stun ? `stun ${s.stun}` : "", s.noise ? "lure" : ""].filter(Boolean).join(" · ");
    return s.desc || "";
  }
  const RECIPES = [
    { id: "r_pistol", out: { d: "ammo_pistol", n: 12 }, cost: { scrap: 2, prop: 1 } },
    { id: "r_rifle", out: { d: "ammo_rifle", n: 10 }, cost: { scrap: 2, prop: 2 } },
    { id: "r_shell", out: { d: "ammo_shell", n: 6 }, cost: { scrap: 3, prop: 1 } },
    { id: "r_sniper", out: { d: "ammo_sniper", n: 4 }, cost: { scrap: 2, prop: 2, circ: 1 } },
    { id: "r_rocket", out: { d: "ammo_rocket", n: 1 }, cost: { scrap: 3, prop: 3, circ: 2 } },
    { id: "r_frag", out: { d: "frag", r: 0 }, cost: { scrap: 2, prop: 2 } },
    { id: "r_incendiary", out: { d: "incendiary", r: 0 }, cost: { scrap: 1, prop: 3 } },
    { id: "r_bandage", out: { d: "bandage", r: 0 }, cost: { scrap: 1 } },
    { id: "r_medkit", out: { d: "medkit", r: 1 }, cost: { scrap: 2, circ: 2 } },
  ];
  const UPGRADE_COST = (lvl) => ({ scrap: 4 + lvl * 2, circ: 2 + lvl });
  return { RAR, AMMO, MATS, DEF, DYES, VALS, RECIPES, UPGRADE_COST, def, stats, name, value, make, kind, slotOf, rarOf, roll, rollRar, info, statLine };
})();
