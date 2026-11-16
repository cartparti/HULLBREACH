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
  const MATS = { scrap: "Scrap metal", prop: "Propellant", circ: "Circuitry", org: "Organics", parts: "Ship parts", core: "Tech cores" };
  // k: weapon | armor | pack | throw | med | key | val | box | mat | ammo | dye
  const DEF = {
    // ---- pistols ----
    pistol:   { k: "weapon", cls: "pistol", name: "Service pistol", ammo: "pistol", dmg: [11, 17], acc: 0, fall: .035, value: 120, desc: "Reliable sidearm." },
    cannon:   { k: "weapon", cls: "pistol", name: "Hand cannon", ammo: "pistol", dmg: [17, 25], acc: -.06, fall: .04, value: 260, desc: "Kicks like a mule. Hits like one too." },
    hornet:   { k: "weapon", cls: "pistol", name: "Hornet machine pistol", ammo: "pistol", dmg: [6, 10], acc: -.05, fall: .045, burst: 3, value: 300, desc: "A stubby spray-gun. Three-round bursts, eats ammo." },
    sixgun:   { k: "weapon", cls: "pistol", name: "Drover revolver", ammo: "pistol", dmg: [15, 22], acc: .05, fall: .03, value: 240, desc: "Six chambers, heavy rounds, never jams." },
    widow:    { k: "weapon", cls: "pistol", name: "Widow's Kiss", ammo: "pistol", dmg: [15, 21], acc: .08, fall: .03, bleed: 1, rar: 3, value: 900, desc: "Every hit opens a wound that won't close." },
    lastword: { k: "weapon", cls: "pistol", name: "The Last Word", ammo: "pistol", dmg: [22, 30], acc: .1, fall: .025, head: .35, rar: 4, value: 2200, desc: "Engraved with a prayer nobody finished. Finds the head." },
    // ---- rifles ----
    carbine:  { k: "weapon", cls: "rifle", name: "Autocarbine", ammo: "rifle", dmg: [9, 14], acc: .05, fall: .025, burst: 2, value: 380, desc: "Fires two-round bursts." },
    rivet:    { k: "weapon", cls: "rifle", name: "Rivet rifle", ammo: "rifle", dmg: [13, 20], acc: .12, fall: .018, value: 420, desc: "Accurate at long range." },
    wasp:     { k: "weapon", cls: "smg", name: "Wasp SMG", ammo: "pistol", dmg: [8, 12], acc: .04, fall: .035, burst: 2, value: 340, desc: "Folding-stock submachine gun. Pistol rounds, two-round bursts." },
    bullpup:  { k: "weapon", cls: "rifle", name: "Kessler bullpup", ammo: "rifle", dmg: [8, 13], acc: .06, fall: .022, burst: 3, value: 520, desc: "Compact assault rifle. Three-round bursts." },
    warden:   { k: "weapon", cls: "rifle", name: "Warden battle rifle", ammo: "rifle", dmg: [18, 26], acc: .14, fall: .016, value: 560, desc: "Semi-auto, full-power rounds. One shot, one problem solved." },
    lament:   { k: "weapon", cls: "rifle", name: "Saint Orrin's Lament", ammo: "rifle", dmg: [15, 22], acc: .18, fall: .012, burst: 2, rar: 3, value: 1400, desc: "A pilgrim's rifle, censer still smoking." },
    hymn:     { k: "weapon", cls: "rifle", name: "Hymn of Iron", ammo: "rifle", dmg: [14, 20], acc: .16, fall: .012, burst: 3, rar: 4, value: 2600, desc: "Three barrels, one voice. Three-round bursts." },
    // ---- shotguns ----
    scatter:  { k: "weapon", cls: "shotgun", name: "Breach scattergun", ammo: "shell", dmg: [6, 10], pellets: 4, acc: .08, fall: .11, value: 420, desc: "Four pellets. Brutal up close." },
    pump:     { k: "weapon", cls: "shotgun", name: "Pump gun", ammo: "shell", dmg: [7, 11], pellets: 3, acc: .12, fall: .09, value: 360, desc: "Three heavy pellets, steadier reach." },
    hound:    { k: "weapon", cls: "shotgun", name: "Hound auto-shotgun", ammo: "shell", dmg: [5, 9], pellets: 3, burst: 2, acc: .06, fall: .1, value: 640, desc: "Drum-fed automatic shotgun. Two shells per trigger pull." },
    coachgun: { k: "weapon", cls: "shotgun", name: "Double-barrel coach gun", ammo: "shell", dmg: [7, 12], pellets: 4, burst: 2, acc: .04, fall: .14, value: 380, desc: "Both barrels at once. Terrifying at arm's length, useless past it." },
    pipe:     { k: "weapon", cls: "shotgun", name: "Pipe shotgun", ammo: "shell", dmg: [4, 8], pellets: 3, acc: 0, fall: .12, value: 70, desc: "Welded from plumbing. It mostly fires forwards." },
    gravedigger: { k: "weapon", cls: "shotgun", name: "Gravedigger", ammo: "shell", dmg: [8, 13], pellets: 5, acc: .12, fall: .08, bleed: .7, rar: 3, value: 1300, desc: "Its stock is a sharpened spade." },
    sweeper:  { k: "weapon", cls: "shotgun", name: "Deck Sweeper", ammo: "shell", dmg: [9, 14], pellets: 6, acc: .15, fall: .07, knock: 1, rar: 4, value: 2500, desc: "Six pellets. Throws husks across the room." },
    // ---- snipers ----
    longbore: { k: "weapon", cls: "sniper", name: "Longbore", ammo: "sniper", dmg: [26, 38], acc: .2, fall: .006, close: .25, value: 640, desc: "Devastating at range, clumsy up close." },
    kestrel:  { k: "weapon", cls: "sniper", name: "Kestrel bolt-action", ammo: "sniper", dmg: [32, 46], acc: .24, fall: .005, close: .2, bolt: 1, value: 760, desc: "Hits like a hammer. You lose a turn working the bolt." },
    rook:     { k: "weapon", cls: "sniper", name: "Rook marksman rifle", ammo: "sniper", dmg: [20, 29], acc: .2, fall: .008, close: .1, value: 700, desc: "Semi-automatic marksman rifle. Lighter hits, no bolt to work." },
    goodbye:  { k: "weapon", cls: "sniper", name: "Long Goodbye", ammo: "sniper", dmg: [32, 44], acc: .26, fall: .004, close: .2, head: .25, rar: 3, value: 1800, desc: "Ivory stock, never missed a funeral." },
    voideye:  { k: "weapon", cls: "sniper", name: "Eye of the Void", ammo: "sniper", dmg: [38, 52], acc: .3, fall: .003, close: .1, pierce: 1, dark: 1, rar: 4, value: 3200, desc: "Sees in the dark. Rounds pass through the first target." },
    // ---- launchers ----
    launcher: { k: "weapon", cls: "launcher", name: "Breaching launcher", ammo: "rocket", dmg: [14, 24], blast: 1.6, acc: .1, fall: .02, value: 900, desc: "Explosive rockets. Mind the windows." },
    thumper:  { k: "weapon", cls: "launcher", name: "Thumper grenade launcher", ammo: "rocket", dmg: [10, 18], blast: 1.4, acc: .1, fall: .02, value: 700, desc: "Break-action, lobs smaller grenades. Easier to live next to." },
    hullbreaker: { k: "weapon", cls: "launcher", name: "Hullbreaker", ammo: "rocket", dmg: [18, 28], blast: 2.2, acc: .14, fall: .015, rar: 3, value: 2000, desc: "Built to open ships. It does." },
    judgement: { k: "weapon", cls: "launcher", name: "Judgement", ammo: "rocket", dmg: [24, 36], blast: 2.8, fire: 1, acc: .16, fall: .012, rar: 4, value: 3600, desc: "Gilded. Its rockets leave fire behind." },
    // ---- melee ----
    knife:    { k: "weapon", cls: "melee", name: "Combat knife", dmg: [7, 11], acc: .1, bleed: .5, value: 60, desc: "Quick and quiet." },
    axe:      { k: "weapon", cls: "melee", name: "Fire axe", dmg: [11, 17], acc: 0, pry: 1, value: 180, desc: "Opens dead doors in one swing." },
    machete:  { k: "weapon", cls: "melee", name: "Machete", dmg: [9, 14], acc: .06, bleed: .6, value: 110, desc: "Long, cheap and nasty." },
    crowbar:  { k: "weapon", cls: "melee", name: "Crowbar", dmg: [8, 13], acc: .02, pry: 1, value: 60, desc: "Pries dead doors. Dents heads." },
    ripsaw:   { k: "weapon", cls: "melee", name: "Ripsaw blade", dmg: [13, 19], acc: .04, bleed: .85, value: 420, desc: "A motorised chain-blade. Loud, and very final." },
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
    // ---- armour: part = head | body | legs | acc. Every piece is drawn on your character ----
    // helmets
    visor:    { k: "armor", part: "head", name: "Contractor helm", dr: .06, o2: 20, value: 70, desc: "Sealed dome helmet with a tinted visor. Takes a crest." },
    welder:   { k: "armor", part: "head", name: "Welder's mask", dr: .14, fire: .15, value: 50, desc: "A flip-down face shield. Unsealed." },
    flakhelm: { k: "armor", part: "head", name: "Flak helmet", dr: .24, value: 220, desc: "Steel pot, brim and goggles. Unsealed." },
    gasmask:  { k: "armor", part: "head", name: "Gas-mask hood", dr: .06, fire: .2, o2: 25, value: 200, desc: "Rubber hood, twin lenses, filter can." },
    sallet:   { k: "armor", part: "head", name: "Sallet helm", dr: .3, o2: 15, value: 460, desc: "Knightly steel with a vision slit. Takes a crest." },
    deathmask:{ k: "armor", part: "head", name: "Ossuary Death Mask", dr: .36, fire: .1, o2: 25, rar: 3, value: 1300, desc: "A pilgrim's skull, worn as a faceplate." },
    cowl:     { k: "armor", part: "head", name: "Void Cowl", dr: .16, o2: 25, stealth: 2, rar: 3, value: 1200, desc: "Nothing inside but two lights. Husks notice you later." },
    halohelm: { k: "armor", part: "head", name: "Saint's Halo Helm", dr: .45, fire: .3, o2: 35, rar: 4, value: 3000, desc: "Gilded, plumed and crowned with a burning halo." },
    // chest
    suit:     { k: "armor", part: "body", name: "Contractor suit", dr: .05, o2: 20, value: 60, desc: "Sealed work suit with an air line." },
    scrapvest:{ k: "armor", part: "body", name: "Scrap plate vest", dr: .15, value: 60, desc: "Riveted hull plate over your clothes. Not sealed." },
    brigandine:{ k: "armor", part: "body", name: "Riveted brigandine", dr: .2, value: 300, desc: "Leather coat over hundreds of little plates." },
    flak:     { k: "armor", part: "body", name: "Flak carapace", dr: .26, fire: .1, o2: 10, value: 400, desc: "Heavy plates and a big pauldron." },
    hazard:   { k: "armor", part: "body", name: "Hazard suit", dr: .08, fire: .5, o2: 40, value: 360, desc: "Shrugs off fire. Big oxygen tank on the back." },
    exo:      { k: "armor", part: "body", name: "Exo-rig", dr: .18, slots: 2, value: 650, desc: "Powered spine frame. Carry two more items." },
    ossuary:  { k: "armor", part: "body", name: "Ossuary Plate", dr: .4, fire: .2, o2: 30, rar: 3, value: 1600, desc: "Bone-white ribs taken from a pilgrim ship." },
    shroud:   { k: "armor", part: "body", name: "Void Shroud", dr: .18, fire: .1, o2: 30, stealth: 2, rar: 3, value: 1500, desc: "A robe of black that eats the light." },
    aegis:    { k: "armor", part: "body", name: "Saint's Aegis", dr: .5, fire: .4, o2: 40, rar: 4, value: 3400, desc: "Gilded breastplate and a crimson tabard." },
    // legs
    cargo:    { k: "armor", part: "legs", name: "Cargo trousers", dr: .03, slots: 1, value: 50, desc: "Thigh pockets. One more slot." },
    kneepads: { k: "armor", part: "legs", name: "Padded combat trousers", dr: .12, value: 140, desc: "Armoured knees and heavy boots." },
    hazlegs:  { k: "armor", part: "legs", name: "Hazard leggings", dr: .06, fire: .2, value: 160, desc: "Rubberised, striped, fireproof." },
    greaves:  { k: "armor", part: "legs", name: "Steel greaves", dr: .24, value: 380, desc: "Plate shins and pointed sabatons." },
    bonegreaves:{ k: "armor", part: "legs", name: "Ossuary Greaves", dr: .32, fire: .1, rar: 3, value: 1100, desc: "Shinbones bound over shinbones." },
    strider:  { k: "armor", part: "legs", name: "Strider Exo-legs", dr: .16, nolimp: 1, rar: 3, value: 1400, desc: "Pistoned legs. A ruined leg won't slow you." },
    aegislegs:{ k: "armor", part: "legs", name: "Saint's Greaves", dr: .4, fire: .3, rar: 4, value: 2600, desc: "Gold plate with crimson tassets." },
    // accessories
    scarf:    { k: "armor", part: "acc", name: "Long scarf", value: 40, desc: "Keeps the dust out. Looks good doing it." },
    cape:     { k: "armor", part: "acc", name: "Tattered cape", value: 90, desc: "Takes your cloak dye in the wardrobe." },
    bandolier:{ k: "armor", part: "acc", name: "Bandolier", slots: 1, value: 150, desc: "Shell loops across the chest. One more slot." },
    pauldron: { k: "armor", part: "acc", name: "Spiked pauldron", tdr: .06, value: 220, desc: "A single heavy shoulder. +6% torso armour." },
    lamp:     { k: "armor", part: "acc", name: "Shoulder lamp", dark: 1, value: 260, desc: "No aim penalty in the dark." },
    seals:    { k: "armor", part: "acc", name: "Litany seals", acc: .05, value: 300, desc: "Wax seals and prayer strips. +5% to hit." },
    charm:    { k: "armor", part: "acc", name: "Skull charm", value: 120, desc: "A little brass skull on a chain. Lucky, probably." },
    censer:   { k: "armor", part: "acc", name: "Censer of Orrin", fire: .2, acc: .03, rar: 3, value: 1200, desc: "Smoking at your belt. +20% fire resistance, +3% to hit." },
    drone:    { k: "armor", part: "acc", name: "Seraph Drone", acc: .08, dark: 1, rar: 4, value: 2600, desc: "A skull-faced drone that spots for you. +8% to hit, sees in the dark." },
    // ---- backpacks ----
    sling:    { k: "pack", name: "Sling pack", slots: 4, value: 30, desc: "Small and light. Four more slots." },
    field:    { k: "pack", name: "Field pack", slots: 6, value: 220, desc: "A proper rucksack. Six more slots." },
    hauler:   { k: "pack", name: "Hauler pack", slots: 8, value: 480, desc: "Big frame pack. Eight more slots." },
    mule:     { k: "pack", name: "Mule Frame", slots: 10, rar: 3, value: 1200, desc: "Exo-assisted cargo frame." },
    bottomless: { k: "pack", name: "Bottomless Satchel", slots: 12, rar: 4, value: 2600, desc: "It shouldn't hold this much. It does." },
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
    org:      { k: "mat", name: "Organics", value: 8, desc: "Vat protein, seeds, water filters. Cook it at the fabricator." },
    parts:    { k: "mat", name: "Ship parts", value: 40, desc: "Salvaged components. Upgrade your ship's fabricator with them." },
    core:     { k: "mat", name: "Tech core", value: 160, desc: "A rare machine-heart. Top-tier fabricator upgrades need these." },
    // ---- lights: your flashlight sets how far and how wide you can see in the dark ----
    flashlight: { k: "light", name: "Flashlight", range: 9, cone: .72, value: 40, desc: "A battered torch. Lights a cone ahead of you and steadies your aim in the dark." },
    floodlamp:  { k: "light", name: "Flood lamp", range: 7.5, cone: .45, value: 160, desc: "A wide, short beam. Lights up a whole room." },
    lumen:      { k: "light", name: "Lumen beam", range: 12, cone: .82, value: 260, desc: "A tight, long-reaching beam." },
    seraphlight:{ k: "light", name: "Lantern of the Seraph", range: 14, cone: .5, acc: .04, rar: 4, value: 2400, desc: "Holy light, wide and far. +4% to hit." },
    // ---- food and drink: keep your strength up ----
    ration:   { k: "food", name: "Ration bar", food: 25, water: -3, value: 15, desc: "Grey, dense, filling." },
    paste:    { k: "food", name: "Nutrient paste", food: 30, water: 5, value: 18, desc: "Squeezed from a tube. Tastes of nothing." },
    stew:     { k: "food", name: "Tinned stew", food: 40, water: 8, value: 30, desc: "Mystery meat in gravy. Hot if you're lucky." },
    jerky:    { k: "food", name: "Vat jerky", food: 22, water: -6, value: 14, desc: "Salty strips of something grown in a tank." },
    feast:    { k: "food", name: "Officer's rations", food: 60, water: 20, rar: 1, value: 90, desc: "Real food. Somebody important went hungry." },
    waterflask:{ k: "food", name: "Water flask", water: 35, value: 12, desc: "Recycled, mostly." },
    purewater:{ k: "food", name: "Purified water", water: 55, value: 25, desc: "Clean and cold." },
    recaf:    { k: "food", name: "Black recaf", water: 20, food: 2, value: 16, desc: "Bitter, hot, keeps you sharp." },
    amber:    { k: "food", name: "Amber spirits", water: 12, food: 6, heal: 5, rar: 1, value: 60, desc: "Burns going down. Restores a little blood." },
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

  const BASE_WEAPONS = ["pistol", "cannon", "hornet", "sixgun", "wasp", "carbine", "rivet", "bullpup", "warden", "scatter", "pump", "hound", "coachgun", "pipe", "longbore", "kestrel", "rook", "launcher", "thumper", "knife", "axe", "maul", "machete", "crowbar", "ripsaw"];
  const UNIQ = Object.keys(DEF).filter((d) => DEF[d].rar >= 3);
  const def = (d) => DEF[d] || null;
  const rarOf = (it) => { const D = def(it.d); return D && (D.rar >= 3 || D.k === "dye") ? D.rar : it.r | 0; };
  const MULT = [1, 1.12, 1.25];

  function stats(it) {
    const D = def(it.d); if (!D) return null; const r = rarOf(it), s = { ...D, rar: r };
    if (D.rar >= 3) return s;
    if (D.k === "weapon" || D.k === "throw") { const m = MULT[r] || 1; if (D.dmg) s.dmg = [Math.round(D.dmg[0] * m), Math.round(D.dmg[1] * m)]; s.acc = (D.acc || 0) + r * .03; }
    if (D.k === "armor") { s.dr = D.dr ? Math.min(.5, D.dr + r * .04) : 0; s.o2 = D.o2 ? D.o2 + r * 5 : 0; s.fire = D.fire ? Math.min(.8, D.fire + r * .05) : 0; if (D.acc) s.acc = D.acc + r * .01; if (D.tdr) s.tdr = D.tdr + r * .02; }
    if (D.k === "pack") s.slots = D.slots + (it.l | 0);
    if (D.k === "light") s.range = D.range + r * 1.2;
    return s;
  }
  function name(it) { const D = def(it.d); if (!D) return "Unknown"; if (D.k === "ammo") return `${D.name} ×${it.n | 0}`; if (D.k === "mat") return it.n > 1 ? `${D.name} ×${it.n}` : D.name; const r = rarOf(it); return D.name + (D.rar >= 3 || ["weapon", "armor", "throw", "light"].indexOf(D.k) < 0 ? "" : RAR[r].tag) + (it.l ? ` +${it.l}` : ""); }
  function value(it) { const D = def(it.d); if (!D) return 0; if (D.k === "val") return it.v || D.value; if (D.k === "ammo" || D.k === "mat") return D.value * (it.n || 1); if (D.k === "dye") return D.value; const r = rarOf(it); return Math.round(D.value * (D.rar >= 3 ? 1 : [1, 1.7, 2.8][r]) * (1 + (it.l | 0) * .25)); }
  const make = (d, r = 0, extra) => ({ d, r: def(d) && def(d).rar >= 3 ? def(d).rar : r, ...(extra || {}) });
  const kind = (it) => (def(it.d) ? def(it.d).k : null);
  const PART_SLOT = { head: "head", body: "armor", legs: "legs", acc: "acc" };
  const slotOf = (it) => { const k = kind(it); if (k === "weapon") return def(it.d).cls === "melee" ? "melee" : "gun"; return k === "armor" ? PART_SLOT[def(it.d).part || "body"] : k === "pack" ? "pack" : k === "light" ? "light" : null; };
  // rarity roll for a loot tier (1 easy - 3 hard); rng() -> [0,1)
  function rollRar(rng, tier) {
    const w = [[62, 26, 9, 2.4, .6], [50, 30, 14, 4.5, 1.5], [40, 32, 18, 7, 3]][Math.max(0, Math.min(2, tier - 1))];
    let x = rng() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < 5; i++) { if ((x -= w[i]) < 0) return i; } return 0;
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  // one random loot item of a category ("any" picks by weight)
  function roll(rng, tier, cat = "any") {
    if (cat === "any") { const c = rng(); cat = c < .17 ? "ammo" : c < .28 ? "med" : c < .36 ? "food" : c < .5 ? "mat" : c < .66 ? "val" : c < .8 ? "weapon" : c < .86 ? "throw" : c < .92 ? "armor" : c < .96 ? "pack" : "dye"; }
    const r = rollRar(rng, tier);
    if (cat === "ammo") { const a = pick(rng, ["pistol", "pistol", "rifle", "rifle", "shell", "shell", "sniper", "rocket"]); return { d: "ammo_" + a, r: 0, n: Math.max(1, Math.round(AMMO[a].stack * (.6 + rng() * .8))) }; }
    if (cat === "mat") { const m = pick(rng, ["scrap", "scrap", "scrap", "prop", "prop", "circ", "org", "parts"]); return { d: m, r: 0, n: 1 + Math.floor(rng() * (m === "parts" ? 2 : 3)) }; }
    if (cat === "part") { return rng() < .1 + tier * .06 ? { d: "core", r: 0, n: 1 } : { d: "parts", r: 0, n: 1 + Math.floor(rng() * (1 + tier)) }; }
    if (cat === "food") return make(pick(rng, ["ration", "ration", "paste", "stew", "jerky", "waterflask", "waterflask", "purewater", "recaf", rng() < .3 ? "amber" : "stew", rng() < .2 ? "feast" : "ration"]), 0);
    if (cat === "light") return rng() < .1 * tier ? make("lumen") : rng() < .3 ? make("floodlamp") : make("flashlight", Math.min(2, r));
    if (cat === "val") { const i = Math.floor(rng() * VALS.length); return { d: "val" + i, r: 0, v: Math.round(VALS[i][1] * (.85 + rng() * .4) * (1 + (tier - 1) * .2)) }; }
    if (cat === "med") return make(pick(rng, ["bandage", "bandage", "bandage", "o2", "o2", "medkit", "medkit", "stim"]), 0);
    if (cat === "dye") { const ds = Object.keys(DEF).filter((d) => DEF[d].k === "dye" && DEF[d].rar <= Math.max(1, r)); return make(pick(rng, ds), 0); }
    if (r >= 3) { const pool = UNIQ.filter((d) => DEF[d].rar === r && (cat === "weapon" ? DEF[d].k === "weapon" : DEF[d].k === cat)); if (pool.length) return make(pick(rng, pool)); }
    const base = cat === "weapon" ? BASE_WEAPONS : Object.keys(DEF).filter((d) => DEF[d].k === cat && !(DEF[d].rar >= 3));
    if (cat === "pack") { const p = r >= 2 ? "hauler" : r === 1 ? "field" : pick(rng, ["sling", "field"]); return make(p, 0); }
    return make(pick(rng, base), Math.min(2, r));
  }
  function info(it) { const D = def(it.d) || { k: "?", name: "Unknown", desc: "" }, r = rarOf(it); return { name: name(it), desc: D.desc || "", sell: Math.round(value(it) * .5), value: value(it), rar: r, rarName: RAR[r].name, col: RAR[r].col, kind: D.k, cat: { weapon: "gear", armor: "gear", pack: "gear", light: "gear", throw: "supplies", med: "supplies", food: "supplies", mat: "materials", ammo: "materials", val: "salvage", box: "salvage", key: "salvage", dye: "salvage" }[D.k] || "salvage" }; }
  function statLine(it) {
    const s = stats(it); if (!s) return "";
    if (s.k === "weapon") { const parts = [`${s.dmg[0]}–${s.dmg[1]} dmg`]; if (s.pellets) parts[0] = `${s.pellets}×${s.dmg[0]}–${s.dmg[1]}`; if (s.burst) parts.push(`burst ${s.burst}`); if (s.ammo) parts.push(AMMO[s.ammo].name.toLowerCase()); else parts.push("melee"); if (s.blast) parts.push(`blast ${s.blast}`); if (s.stun) parts.push(`stun ${s.stun}`); if (s.bleed >= .7) parts.push("bleeds"); if (s.bolt) parts.push("bolt-action"); if (s.pierce) parts.push("pierces"); if (s.knock) parts.push("knockback"); if (s.cleave) parts.push("cleaves"); return parts.join(" · "); }
    if (s.k === "armor") { const where = { head: "head", body: "torso", legs: "leg", acc: "" }[s.part || "body"]; return [s.dr ? `${Math.round(s.dr * 100)}% ${where} armour` : "", s.tdr ? `+${Math.round(s.tdr * 100)}% torso armour` : "", s.fire ? `${Math.round(s.fire * 100)}% fire` : "", s.o2 ? `${s.o2} O₂` : "", s.slots ? `+${s.slots} slot${s.slots > 1 ? "s" : ""}` : "", s.acc ? `+${Math.round(s.acc * 100)}% to hit` : "", s.dark ? "sees in the dark" : "", s.stealth ? "stealth" : "", s.nolimp ? "no limp" : ""].filter(Boolean).join(" · ") || "Cosmetic"; }
    if (s.k === "pack") return `+${s.slots} slots`;
    if (s.k === "light") return `${Math.round(s.range)} tile beam · ${s.cone < .6 ? "wide" : s.cone > .78 ? "narrow" : "medium"}${s.acc ? ` · +${Math.round(s.acc * 100)}% to hit` : ""}`;
    if (s.k === "food") return [s.food ? `${s.food > 0 ? "+" : ""}${s.food} food` : "", s.water ? `${s.water > 0 ? "+" : ""}${s.water} water` : "", s.heal ? `+${s.heal} blood` : ""].filter(Boolean).join(" · ");
    if (s.k === "throw") return [s.dmg ? `${s.dmg[0]}–${s.dmg[1]} dmg` : "", s.blast ? `blast ${s.blast}` : "", s.fire ? "fire" : "", s.stun ? `stun ${s.stun}` : "", s.noise ? "lure" : ""].filter(Boolean).join(" · ");
    return s.desc || "";
  }
  // cat: ammo | weapon | armor | gear | meds | food. lvl: fabricator level needed. Gear made on a better
  // fabricator comes out better: Mk II at level 3, Mk III at level 4 and up (see craftRarity).
  const R_ = (id, cat, lvl, d, cost, extra) => ({ id, cat, lvl, out: { d, r: 0, ...(extra || {}) }, cost });
  const RECIPES = [
    R_("a_pistol", "ammo", 1, "ammo_pistol", { scrap: 2, prop: 1 }, { n: 12 }), R_("a_shell", "ammo", 1, "ammo_shell", { scrap: 3, prop: 1 }, { n: 6 }),
    R_("a_rifle", "ammo", 2, "ammo_rifle", { scrap: 2, prop: 2 }, { n: 10 }), R_("a_sniper", "ammo", 3, "ammo_sniper", { scrap: 2, prop: 2, circ: 1 }, { n: 4 }),
    R_("a_rocket", "ammo", 4, "ammo_rocket", { scrap: 3, prop: 3, circ: 2 }, { n: 1 }),
    R_("f_paste", "food", 1, "paste", { org: 2 }), R_("f_water", "food", 1, "waterflask", { org: 1, scrap: 1 }), R_("f_stew", "food", 2, "stew", { org: 3 }),
    R_("f_pure", "food", 2, "purewater", { org: 1, circ: 1 }), R_("f_recaf", "food", 2, "recaf", { org: 2 }), R_("f_amber", "food", 4, "amber", { org: 4, prop: 1 }), R_("f_feast", "food", 5, "feast", { org: 6 }),
    R_("m_bandage", "meds", 1, "bandage", { scrap: 1, org: 1 }), R_("m_o2", "meds", 2, "o2", { scrap: 2, circ: 1 }), R_("m_medkit", "meds", 2, "medkit", { scrap: 2, circ: 2, org: 1 }, { r: 1 }),
    R_("m_stim", "meds", 3, "stim", { circ: 2, org: 3 }, { r: 2 }),
    R_("t_decoy", "meds", 2, "decoy", { scrap: 2, circ: 1 }), R_("t_frag", "weapon", 2, "frag", { scrap: 2, prop: 2 }), R_("t_inc", "weapon", 2, "incendiary", { scrap: 1, prop: 3 }), R_("t_stun", "weapon", 3, "stun", { scrap: 2, circ: 2 }),
    R_("w_crowbar", "weapon", 1, "crowbar", { scrap: 3 }), R_("w_knife", "weapon", 1, "knife", { scrap: 3 }), R_("w_pipe", "weapon", 1, "pipe", { scrap: 5, prop: 1 }),
    R_("w_pistol", "weapon", 2, "pistol", { scrap: 6, prop: 1, circ: 1 }), R_("w_sixgun", "weapon", 2, "sixgun", { scrap: 7, circ: 1 }), R_("w_coach", "weapon", 2, "coachgun", { scrap: 7, prop: 2 }), R_("w_machete", "weapon", 2, "machete", { scrap: 5 }),
    R_("w_hornet", "weapon", 3, "hornet", { scrap: 8, circ: 2 }), R_("w_wasp", "weapon", 3, "wasp", { scrap: 9, circ: 2, parts: 1 }), R_("w_carbine", "weapon", 3, "carbine", { scrap: 10, circ: 2, parts: 1 }), R_("w_pump", "weapon", 3, "pump", { scrap: 9, prop: 1, parts: 1 }), R_("w_axe", "weapon", 3, "axe", { scrap: 6, parts: 1 }),
    R_("w_bullpup", "weapon", 4, "bullpup", { scrap: 12, circ: 3, parts: 2 }), R_("w_warden", "weapon", 4, "warden", { scrap: 12, circ: 2, parts: 2 }), R_("w_hound", "weapon", 4, "hound", { scrap: 12, circ: 3, parts: 2 }), R_("w_kestrel", "weapon", 4, "kestrel", { scrap: 12, circ: 3, parts: 3 }),
    R_("w_maul", "weapon", 4, "maul", { scrap: 8, circ: 3, parts: 1 }), R_("w_ripsaw", "weapon", 4, "ripsaw", { scrap: 10, circ: 2, parts: 2 }), R_("w_thumper", "weapon", 4, "thumper", { scrap: 12, prop: 4, parts: 3 }),
    R_("w_launcher", "weapon", 5, "launcher", { scrap: 16, prop: 5, circ: 4, parts: 4 }), R_("w_widow", "weapon", 5, "widow", { scrap: 12, circ: 4, parts: 4, core: 1 }), R_("w_gravedigger", "weapon", 5, "gravedigger", { scrap: 16, parts: 5, core: 1 }),
    R_("r_welder", "armor", 1, "welder", { scrap: 4, circ: 1 }), R_("r_vest", "armor", 1, "scrapvest", { scrap: 8 }), R_("r_cargo", "armor", 1, "cargo", { scrap: 3, org: 1 }), R_("r_scarf", "armor", 1, "scarf", { org: 1 }),
    R_("r_visor", "armor", 2, "visor", { scrap: 4, circ: 3 }), R_("r_suit", "armor", 2, "suit", { scrap: 5, circ: 2 }), R_("r_knee", "armor", 2, "kneepads", { scrap: 5, org: 1 }), R_("r_cape", "armor", 2, "cape", { org: 3 }),
    R_("r_flakhelm", "armor", 3, "flakhelm", { scrap: 8, parts: 1 }), R_("r_gasmask", "armor", 3, "gasmask", { scrap: 4, circ: 3, org: 2 }), R_("r_brig", "armor", 3, "brigandine", { scrap: 10, org: 2, parts: 1 }), R_("r_hazard", "armor", 3, "hazard", { scrap: 6, circ: 3, parts: 1 }), R_("r_hazlegs", "armor", 3, "hazlegs", { scrap: 4, org: 2 }),
    R_("r_sallet", "armor", 4, "sallet", { scrap: 12, parts: 2 }), R_("r_flak", "armor", 4, "flak", { scrap: 14, circ: 2, parts: 2 }), R_("r_greaves", "armor", 4, "greaves", { scrap: 12, parts: 2 }), R_("r_exo", "armor", 4, "exo", { scrap: 12, circ: 5, parts: 4 }), R_("r_pauldron", "armor", 4, "pauldron", { scrap: 8, parts: 1 }),
    R_("r_deathmask", "armor", 5, "deathmask", { scrap: 10, org: 4, parts: 4, core: 1 }), R_("r_cowl", "armor", 5, "cowl", { org: 6, circ: 4, parts: 3, core: 1 }), R_("r_strider", "armor", 5, "strider", { scrap: 14, circ: 6, parts: 5, core: 2 }), R_("r_censer", "armor", 5, "censer", { scrap: 6, org: 6, parts: 3, core: 1 }),
    R_("g_flash", "gear", 1, "flashlight", { scrap: 2, circ: 1 }), R_("g_sling", "gear", 1, "sling", { scrap: 4 }), R_("g_flood", "gear", 2, "floodlamp", { scrap: 3, circ: 2 }), R_("g_field", "gear", 2, "field", { scrap: 8, circ: 2 }),
    R_("g_bando", "gear", 3, "bandolier", { scrap: 4, org: 2 }), R_("g_lamp", "gear", 3, "lamp", { scrap: 3, circ: 3 }), R_("g_lumen", "gear", 4, "lumen", { scrap: 4, circ: 4, parts: 1 }), R_("g_hauler", "gear", 4, "hauler", { scrap: 12, circ: 2, parts: 2 }), R_("g_seals", "gear", 4, "seals", { org: 4, parts: 2 }),
    R_("g_mule", "gear", 5, "mule", { scrap: 18, circ: 4, parts: 5, core: 1 }),
  ];
  const craftRarity = (rec, fab) => { const D = DEF[rec.out.d]; if (rec.out.r || !D || D.rar >= 3 || !["weapon", "armor", "light"].includes(D.k)) return rec.out.r | 0; return Math.max(0, Math.min(2, fab - 2)); };
  // fabricator upgrades: level n -> n+1
  const FAB_UP = [null, { parts: 4, credits: 250 }, { parts: 8, circ: 4, credits: 600 }, { parts: 14, core: 1, credits: 1200 }, { parts: 22, core: 3, credits: 2400 }];
  const FAB_NAME = ["", "Scrap press", "Machine shop", "Forge-fabricator", "Manufactorum", "Sanctified forge"];
  // the ship's galley bar: eat and drink here, or take it to go
  const BAR = [{ id: "meal", name: "Hot meal", food: 45, water: 10, price: 30 }, { id: "soup", name: "Bowl of soup", food: 25, water: 20, price: 18 }, { id: "drink", name: "Water from the tap", water: 30, price: 0 },
    { id: "recafcup", name: "Cup of recaf", water: 20, food: 2, price: 6 }, { id: "ale", name: "Mug of engine-room ale", water: 25, food: 5, price: 12 }, { id: "feastplate", name: "Captain's plate", food: 70, water: 25, price: 80 }];
  const BAR_TOGO = [["ration", 18], ["paste", 20], ["stew", 32], ["waterflask", 14], ["purewater", 28], ["recaf", 18], ["amber", 70]];
  // character styles: free to change in the wardrobe
  const STYLE = {
    skin: ["#f1c9a5", "#d9a77e", "#b07a52", "#8a5634", "#5e3a22", "#3e2616", "#a8b0a0"],
    hair: ["none", "buzz", "short", "long", "mohawk", "topknot", "braid"],
    hairCol: ["#1a1410", "#3a2414", "#6a4020", "#a0682e", "#d8b060", "#c8c8c0", "#8a2a1c", "#3a6a8a"],
    face: ["clean", "stubble", "beard", "moustache", "scar", "tattoo"],
    eyes: ["#2a1e14", "#3a5a8a", "#4a7a3a", "#8a6a2a", "#7a1a12"],
    top: ["tee", "long", "tank"],
    bottom: ["pants", "shorts"],
    cloth: ["#3a4448", "#56603c", "#5e1a12", "#1c2a44", "#2a2826", "#8a7a5a", "#cfc2a6", "#7a5a1a", "#3e1e52", "#46504a"],
  };
  const CLOTHES_O2 = 20, POCKETS = 10;
  const UPGRADE_COST = (lvl) => ({ scrap: 4 + lvl * 2, circ: 2 + lvl });
  return { RAR, AMMO, MATS, DEF, DYES, VALS, STYLE, CLOTHES_O2, POCKETS, RECIPES, craftRarity, FAB_UP, FAB_NAME, BAR, BAR_TOGO, UPGRADE_COST, def, stats, name, value, make, kind, slotOf, rarOf, roll, rollRar, info, statLine };
})();
