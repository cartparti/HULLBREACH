// =====================================================================
// SIM START — pure game logic. No DOM. State is plain JSON so it can be
// sent over the wire; a server can run this same module authoritatively.
// Turn model: each living player submits one action (Sim.act). When every
// player has acted, the world resolves (endTurn). Solo play = 1 player.
// =====================================================================
const Sim = (() => {
  const KS9 = [
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~###==##==######==##=###~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~#B..B..B..B#lll......B#~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~#..........#..........###==########==###~~",
    "~~~~~~~~~~~~~#..........#.........B#tt....ll#.......#~~",
    "~~~~~~~~~~~~~#.b........#......h...#.....R..#....kt.#~~",
    "~~~~~~~~~~~~~#..........+.........B#........#.......=~~",
    "~~~~~~~~~~~~~#.....h....#.....v....#....h...+.......=~~",
    "~~~~~~~~~~~~~#........m.#..........#........#.......#~~",
    "~#############..........#t.........#..v.....#.v....B#~~",
    "~#cc....o..r##S........S#..........#.......a#.......#~~",
    "~#..........######+##########+#########+#######+#####~~",
    "~=..........+..............h........................=~~",
    "~=.EE.......+...........................a...........=~~",
    "~#.EE.......######+#######+###..######+#########+####~~",
    "~#..........##..........#r..r#..#cc......ccc#lll.lll#~~",
    "~=....@.....##.P....gg..#.r..#..#c.........c#.......#~~",
    "~#..........##..........#....#..#...H.h.....#..W....#~~",
    "~#c.......cc##..........#....#..#..v........#....h..=~~",
    "~#############..........+....+..+...........+.a...Y.#~~",
    "~~~~~~~~~~~~~#.......h..#.a..#..#...........#.......#~~",
    "~~~~~~~~~~~~~#.....b....#....#..#.h.....v...#.....a.#~~",
    "~~~~~~~~~~~~~#...Z......#..o.#..#...cc...F..#...m...#~~",
    "~~~~~~~~~~~~~#rr.......r#r..r#..#.........cc#.......#~~",
    "~~~~~~~~~~~~######+###########..########+############~~",
    "~~~~~~~~~~~~=...............................h.......=~~",
    "~~~~~~~~~~~~=...b...................................=~~",
    "~~~~~~~~~~~~########+#############+###########L######~~",
    "~~~~~~~~~~~~~#S.S.S...S.S.S.#.f.......f.#..........v#~~",
    "~~~~~~~~~~~~~#.........h....#...........#...v.......#~~",
    "~~~~~~~~~~~~~#...o.h.....v..#..v....h...#.v.......X.#~~",
    "~~~~~~~~~~~~~#.t............#.f.......f.#.......v...#~~",
    "~~~~~~~~~~~~~###==#####==########=#=#################~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  ];
  const KS9_ROOMS = [ // [name, x0,y0,x1,y1]
    ["Docking bay",2,10,11,18],
    ["Medbay",14,2,23,10],
    ["Crew quarters",25,2,34,10],
    ["Security office",36,4,43,10],
    ["Captain's cabin",45,4,51,10],
    ["Main corridor",13,12,51,13],
    ["Engineering",14,15,23,23],
    ["Fuel storage",25,15,28,23],
    ["Service shaft",30,14,31,24],
    ["Cargo hold",33,15,43,23],
    ["Armory",45,15,51,23],
    ["Lower corridor",13,25,51,26],
    ["Xenolab",14,28,27,31],
    ["Shrine",29,28,39,31],
    ["Vault",41,28,51,31],
  ];
  const MAPS={
    ks9:{rows:KS9,rooms:KS9_ROOMS},
    ship:{rows:[
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~#######~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~#######~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~############=######=####=#####=##=#####=##=######=~~~~~~",
      "~#..D.D.D9#Kjj..Ul#DU.O.Ue$#B..B..B.&#qV.C...G#ep..=#~~~~",
      "~#*.......#.......#........#y..y..y..#.......p#....e#~~~~",
      "~#........#......l#.......$#.........#..nn....#......=~~~",
      "~#.......e#.......#........#........J#..TT....#e.....#~~~",
      "~#*.......#.......#........#.........#..nn....#e.t....#~~",
      "~#........#00....c#^.....c%#ll......p#.....uu.#..3....#~~",
      "~#........####+#######+#########+########+#####.......=~~",
      "~#...(D...+....................@..............+.dMM.1N#~~",
      "~#..D.....#...................................+.....2e#~~",
      "~#........####+#######+######+###+####+####+###.......=~~",
      "~#........#Q.%.%%.#-_..?__-#A.8#w.w#t....#!.!.#...4...#~~",
      "~#*.......#......c#.n...nn.#...#...#n....#....#e..t...#~~",
      "~#.......8#.......#........#...#...#.....#...5#e..`..#~~~",
      "~#........#.......#.nn....s#...#...#IIIII#.i..#......=~~~",
      "~#*.......#.......#.TT.....#...#...#.....#....#....e#~~~~",
      "~#.rrg.g.9#rr...cc#.nn....p#..l#s.x#..z.;#...S#e...=#~~~~",
      "~############=#######=##=####=#######=######=#####=~~~~~~",
      "~~#######~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~#######~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"],
      rooms:[["Engine room", 2, 4, 9, 19], ["Armory", 11, 4, 17, 9], ["Crew quarters", 28, 4, 36, 9], ["Fabrication bay", 19, 4, 26, 9], ["Galley", 19, 14, 26, 19], ["Break room", 38, 4, 45, 9], ["Ship hold", 11, 14, 17, 19], ["Airlock", 28, 14, 30, 19], ["Bathroom", 32, 14, 34, 19], ["Brig", 36, 14, 40, 19], ["Infirmary", 42, 14, 45, 19], ["Main hall", 11, 11, 45, 12], ["Bridge", 47, 4, 53, 19]]},
    // smaller hulls you start on and upgrade through: Skiff (1), Cutter (2), Corvette (3); "ship" is the full Lark (4)
    ship1:{rows:["~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", "~~~###=###=###=#######=###=####~~~", "~~~#*.9#By.K#C...A#O.?-q#MM.1N#~~~", "~~~#*..#....#..@..#.....#...2.=~~~", "~~~#...+....+.....+.....+....e#~~~", "~~~#e.D#p..Q#c...8#.Tn..#d....#~~~", "~~~###=###=###=#######=###=####~~~", "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"],
      rooms:[["Engine room", 4, 2, 6, 5], ["Bridge", 25, 2, 29, 5], ["Crew quarters", 8, 2, 11, 5], ["Ship hold", 13, 2, 17, 5], ["Galley", 19, 2, 23, 5]]},
    ship2:{rows:["~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", "~~~###=####=####=####=####=####=####~~~", "~~~#*..9#By.By&#O.U8.$#K...Q#`....p#~~~", "~~~#*...#......#......#.....#......=~~~", "~~~#....#......#......#.....#......#~~~", "~~~#....#p....J#.....c#C...c#MM.1N.#~~~", "~~~#....####+######+#####+###......=~~~", "~~~#..(.+......@............+......#~~~", "~~~#....+...................+......#~~~", "~~~#....####+######+####+####......=~~~", "~~~#....#.......#....#....$##.3.2..#~~~", "~~~#....#....TT.#....#.....##.....e#~~~", "~~~#*...#....nn.#....#.....##......=~~~", "~~~#*.D9#?-q...p#lA.8#cc..%##e....p#~~~", "~~~###=####=##############=####=####~~~", "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"],
      rooms:[["Engine room", 4, 2, 7, 13], ["Bridge", 29, 2, 34, 13], ["Main hall", 9, 7, 27, 8], ["Crew quarters", 9, 2, 14, 5], ["Fabrication bay", 16, 2, 21, 5], ["Ship hold", 23, 2, 27, 5], ["Galley", 9, 10, 15, 13], ["Airlock", 17, 10, 20, 13], ["Storage", 22, 10, 26, 13]]},
    ship3:{rows:["~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", "~~~###=####=####=####=#########=####=####=####=######~~~", "~~~#..D.9#By.By.By#O.U.8.$#Kjj..Q#C.G.V.q.uu#`.....p#~~~", "~~~#*....#........#.......#......#...n......#.......=~~~", "~~~#*....#........#.......#......#...TT.....#d......#~~~", "~~~#.....#........#.......#......#....n.....#.......#~~~", "~~~#.....#J......&#^.....c#0....0#.........p#.......=~~~", "~~~#.....#####+#######+#######+########+#####.MM.1N.#~~~", "~~~#..(..+..........@.......................+.......#~~~", "~~~#.....+..................................+.......=~~~", "~~~#.....####+#######+####+###+####+#####+###....2..#~~~", "~~~#.....#.......#$....%#...#...#.....#....5#......e#~~~", "~~~#*....#....n..#......#...#...#.....#.....#..3.4..=~~~", "~~~#*....#....TT.#......#...#s..#.....#.....#.......#~~~", "~~~#.....#.....n.#......#...#...#IIIII#.....#.......#~~~", "~~~#.g.g9#?-_...p#cc...%#8A.#w.x#..z..#!.i.!#e.....p#~~~", "~~~###=####=####=####=####=####=####=####=####=######~~~", "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"],
      rooms:[["Engine room", 4, 2, 8, 15], ["Bridge", 45, 2, 51, 15], ["Main hall", 10, 8, 43, 9], ["Crew quarters", 10, 2, 17, 6], ["Fabrication bay", 19, 2, 25, 6], ["Armory", 27, 2, 32, 6], ["Break room", 34, 2, 43, 6], ["Galley", 10, 11, 16, 15], ["Ship hold", 18, 11, 23, 15], ["Airlock", 25, 11, 27, 15], ["Bathroom", 29, 11, 31, 15], ["Brig", 33, 11, 37, 15], ["Infirmary", 39, 11, 43, 15]]},
  };
  let ROOMS=KS9_ROOMS;
  function bind(s){ ROOMS=s.rooms||(MAPS[s.map]||MAPS.ks9).rooms; }

  const LIMBS = ["head","torso","larm","rarm","lleg","rleg"];
  const LNAME = {head:"head",torso:"torso",larm:"left arm",rarm:"right arm",lleg:"left leg",rleg:"right leg"};
  const PLAYER_HP = {head:30,torso:60,larm:35,rarm:35,lleg:40,rleg:40};
  const HUSK_HP   = {head:14,torso:34,larm:18,rarm:18,lleg:22,rleg:22};
  // what the dead turn into: hit points multiplier, armour, speed (moves per turn), claws, extras
  const HTYPES={
    husk:{name:"husk",hp:1,dr:0,spd:1,dmg:[4,9],acc:.68,infect:.15},
    stalker:{name:"stalker",hp:.55,dr:0,spd:2,dmg:[3,6],acc:.74,infect:.3},
    brute:{name:"brute",hp:2.3,dr:.3,spd:.5,dmg:[9,16],acc:.62,door:3,stun:.45,frac:.4},
    spitter:{name:"spitter",hp:.8,dr:0,spd:1,dmg:[2,5],acc:.55,range:6,acid:[3,6]},
    bloater:{name:"bloater",hp:1.7,dr:0,spd:.5,dmg:[5,9],acc:.6,infect:.2},
    nest:{name:"nest",hp:1.6,dr:0,spd:0,dmg:[0,0],acc:0,nest:1},
    matriarch:{name:"Matriarch",hp:5,dr:.25,spd:1,dmg:[10,18],acc:.72,door:4,boss:1,frac:.3,infect:.3},
  };
  const HT=e=>HTYPES[e.type||"husk"]||HTYPES.husk;
  // mutated elites: a husk that's gone wrong in a worse way than the rest
  const MUTS={armored:{n:"Armored",d:"bone plating: takes a quarter less damage, far more health"},volatile:{n:"Volatile",d:"swollen with gas: bursts when it dies"},swift:{n:"Swift",d:"moves twice as fast"},regen:{n:"Regenerating",d:"its wounds close as you watch"},venom:{n:"Venomous",d:"every hit starts an infection"},shrieker:{n:"Shrieking",d:"its scream wakes the whole station"}};
  // station security: run on station power
  const BTYPES={custodian:{name:"Custodian",hp:{head:70,torso:200,larm:80,rarm:80,lleg:90,rleg:90},dmg:[7,12],range:8,acc:.62,burst:2,boss:1},turret:{name:"turret",hp:{head:12,torso:30,larm:14,rarm:14,lleg:14,rleg:14},dmg:[5,9],range:7,acc:.72,still:1},
    drone:{name:"security drone",hp:{head:8,torso:16,larm:8,rarm:8,lleg:8,rleg:8},dmg:[3,6],range:5,acc:.65}};
  const HIT_W = [["head",9],["torso",41],["larm",13],["rarm",13],["lleg",12],["rleg",12]];
  const FULL = 101; // kPa
  const VALUABLES = Items.VALS;
  // legacy hand-built KS-9 map characters -> items (procedural stations place items directly)
  const ITEM = { W:{d:"scatter",r:1}, R:{d:"rivet",r:2}, Y:{d:"flak",r:0}, Z:{d:"hazard",r:0}, H:{d:"hauler",r:0},
    a:{d:"ammo_pistol",r:0,n:12}, b:{d:"bandage",r:0}, m:{d:"medkit",r:1}, o:{d:"o2",r:0}, k:{d:"keycard",r:0}, v:"val", X:{d:"blackbox",r:0} };
  const AMMO_TYPES = Object.keys(Items.AMMO);
  const K = it => Items.kind(it);
  const nm = it => Items.name(it);
  const ST = it => it ? Items.stats(it) : null;
  const WRENCH = { name:"wrench", cls:"melee", dmg:[5,9], acc:0 };
  const gun = p => p.act===2 ? (p.w2||p.w1) : (p.w1||p.w2);
  const GEAR = ["head","armor","legs","acc","light"];
  // combined armour from helmet, chest, legs and accessory
  function gearOf(e){ const g={head:0,torso:0,legs:0,fire:0,stealth:0,o2:Items.CLOTHES_O2,slots:0,acc:0,dark:0,nolimp:0};
    for(const k of GEAR){ const it=e[k]; if(!it) continue; if(k==="light"&&e.lightOff) continue; const st=ST(it); if(!st) continue;
      const dr=st.dr||0; if(st.part==="head") g.head+=dr; else if(st.part==="legs") g.legs+=dr; else g.torso+=dr;
      g.torso+=st.tdr||0; g.fire+=st.fire||0; g.stealth+=st.stealth||0; g.o2+=st.o2||0; g.slots+=st.slots||0; g.acc+=st.acc||0; if(st.dark||st.k==="light") g.dark=1; if(st.k==="light") g.lit=1; if(st.nolimp) g.nolimp=1; }
    if(e.perks){ g.stealth+=e.perks.ghost|0; g.slots+=e.perks.mule|0; }
    g.fire=Math.min(.8,g.fire); g.head=Math.min(.6,g.head); g.torso=Math.min(.6,g.torso); g.legs=Math.min(.6,g.legs); return g; }
  const capOf = e => Items.POCKETS+(e.pack?ST(e.pack).slots:0)+gearOf(e).slots;

  // ---------- RNG (mulberry32, state lives in game state) ----------
  function rand(s){ s.rng=(s.rng+0x6D2B79F5)|0; let t=s.rng; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
  const ri=(s,a,b)=>a+Math.floor(rand(s)*(b-a+1));
  const chance=(s,p)=>rand(s)<p;

  // ---------- tile predicates ----------
  const PROPS={c:"crate",B:"bed",t:"desk",l:"locker",r:"barrel",f:"brazier",g:"generator",S:"tank",
    u:"couch",T:"table",n:"chair",q:"coffee",V:"vending",G:"arcade",w:"toilet",s:"sink",x:"shower",I:"bars",z:"captive",j:"gunrack",p:"plant",d:"captchair",y:"footlocker",U:"workbench",e:"cogitator","!":"medcab",i:"surgery",D:"pipes","%":"pallet","5":"stasis","6":"altar","7":"pew","8":"o2rack","9":"pump","0":"ammocrate","$":"shelf",";":"cot","*":"drive","(":"reactor","^":"loader",_:"counter","-":"fridge","[":"strongbox"};
  const CONTAINERS=new Set(["pod","locker","crate","footlocker","ammocrate","medcab","shelf","strongbox","pallet","gunrack","fridge"]);
  const TERMS={"`":"comms",N:"helm",M:"navtable",K:"rack",Q:"stash",J:"records",C:"board",A:"airlock",O:"workbench","&":"wardrobe","?":"bar"};
  const SEATS={"1":"pilot","2":"copilot","3":"nav","4":"eng"};
  const gas  = t => t.t==="floor"||t.t==="extract"||t.t==="breach"||t.t==="prop"||t.t==="terminal"||t.t==="seat"||(t.t==="door"&&t.open);
  const walk = t => t.t==="floor"||t.t==="extract"||t.t==="seat"||(t.t==="door"&&t.open);
  const clear= t => !(t.t==="wall"||t.t==="console"||(t.t==="door"&&!t.open));

  const STARTER={w1:{d:"pistol",r:0},w2:null,melee:{d:"knife",r:0},armor:null,pack:null,light:{d:"flashlight",r:0},ammo:{pistol:12},inv:[{d:"bandage",r:0},{d:"ration",r:0},{d:"waterflask",r:0}]};
  // accept old saves' loadouts too
  const OLD={pistol:"pistol",scatter:"scatter",rifle:"rivet",suit:"suit",flak:"flak",hazard:"hazard",sling:"sling",hauler:"hauler"};
  function normLo(lo){
    if(!lo) return STARTER; if(lo.w1!==undefined||lo.melee!==undefined) return lo;
    const g=v=>v&&OLD[v]?{d:OLD[v],r:0}:null;
    return {w1:g(lo.weapon),w2:null,melee:{d:"knife",r:0},armor:g(lo.armor)||{d:"suit",r:0},pack:g(lo.pack)||{d:"sling",r:0},ammo:{pistol:lo.rounds|0},
      inv:(lo.inv||[]).map(i=>i.d?i:Items.DEF[i.kind]?{d:i.kind,r:0}:null).filter(Boolean),look:lo.look||null};
  }
  // opts: {map:"ks9"|"ship", mode:"raid"|"ship", site:"Relay KS-9", crew:[{id,name,loadout}],
  //        mods:{power:bool, fires:n, huskAdd:n, huskDrop:p, loot:x}}
  function newGame(seed,loadout,opts={}){
    const G=opts.gen?Gen.station(seed,opts.gen):null;
    const mapId=G?"gen":(opts.map||"ks9"), MAP=G?G.rows:MAPS[mapId].rows; ROOMS=G?G.rooms:MAPS[mapId].rooms;
    const W=Math.max(...MAP.map(r=>r.length)), H=MAP.length;
    const s={v:1,seed:seed>>>0,rng:seed|0,turn:1,W,H,tiles:[],P:[],wind:[],blood:{},items:[],ents:[],
      log:[],fx:[],fire:{},fuel:[],scorch:{},power:true,map:mapId,kind:(opts.gen&&opts.gen.kind)||"",rooms:G?G.rooms:null,decals:G?G.decals:(mapId==="ks9"?[{type:"ritual",x:33,y:29}]:[]),mode:opts.mode||"raid",site:opts.site||"Relay KS-9",status:"playing",nextId:1,cause:null,crews:{}};
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const c=MAP[y][x]||"~"; let t;
      switch(c){
        case "~": t={t:"space"};break;
        case "#": t={t:"wall"};break;
        case "+": t={t:"door",open:false,locked:false,hp:8,pry:0};break;
        case "L": t={t:"door",open:false,locked:true,hp:99,pry:0,vault:true};break;
        case "=": t={t:"window",hp:2};break;
        case "P": t={t:"console"};break;
        case "E": t={t:"extract"};break;
        case "c": case "B": case "t": case "l": case "r": case "f": case "g": case "S":
        case "u": case "T": case "n": case "q": case "V": case "G": case "w": case "s": case "x": case "I": case "z": case "j": case "p": case "d": case "y": case "U":
        case "e": case "!": case "i": case "D": case "%": case "5": case "6": case "7": case "8": case "9": case "0": case "$": case ";": case "*": case "(": case "^": case "_": case "-": case "[": t={t:"prop",kind:PROPS[c]};break;
        case "`": case "N": case "M": case "K": case "Q": case "J": case "C": case "A": case "O": case "&": case "?": t={t:"terminal",kind:TERMS[c]};break;
        case "1": case "2": case "3": case "4": t={t:"seat",kind:SEATS[c]};break;
        default: t={t:"floor"};
      }
      s.tiles.push(t); s.P.push(t.t==="space"||t.t==="wall"||t.t==="window"?0:FULL); s.wind.push(-1);
      s.fuel.push(fuelFor(t,x,y)); if(c==="F"){ s.fire[s.tiles.length-1]=2; s.fuel[s.tiles.length-1]=14; }
      if(c==="@"){ const crew=opts.crew||[{id:"p1",name:"You",loadout:loadout||STARTER}];
        crew.forEach((m,k)=>{ const sp=[[0,0],[1,0],[-1,0],[0,1]][k]||[0,0]; addPlayer(s,m.id,m.name,x+sp[0],y+sp[1],m.loadout||STARTER); }); }
      if(c==="h") addHusk(s,x,y);
      if(ITEM[c]) addItem(s,c,x,y);
    }
    if(G){ populate(s,G,(opts.gen&&opts.gen.tier)||1,(opts.gen&&opts.gen.kind)||""); for(const l of G.loot) spawnItem(s,l.item,l.x,l.y); for(const c of G.caches||[]){ const t=s.tiles[idx(s,c.x,c.y)]; if(t&&t.t==="prop") t.loot=c.items.map(i=>({...i})); }
      for(const [x,y] of G.fires){ const i=idx(s,x,y); s.fire[i]=2; s.fuel[i]=14; } }
    if(s.mode==="ship"){ for(const p of players(s)) p.seen.fill(1); for(const t of s.tiles) if(t.t==="door") t.open=true; if(opts.pet!==false) addPet(s); return s; }
    s.mods=opts.mods||{}; applyMods(s,s.mods);
    if(G) mutate(s,(opts.gen&&opts.gen.tier)||1,s.mods);
    if(G) furnishExtras(s,(opts.gen&&opts.gen.tier)||1,(opts.gen&&opts.gen.kind)||"");
    spawnRemains(s); s.prisoners=[]; s.huskKills=0; if(G) setupJobs(s,opts.jobs||[],(opts.gen&&opts.gen.tier)||1);
    s.repd={}; s.kills={}; s.factionRep=(opts.factions&&opts.factions.rep)||{};
    s.tierN=(opts.gen&&opts.gen.tier)||1;
    if(G) placeSecurity(s,opts.gen.tier||1,opts.gen.kind||"",opts.gen.kind==="hive"?"choir":opts.gen.kind==="outpost"?"marshal":null);
    if(G&&opts.factions&&opts.factions.nemesis) spawnNemesis(s,opts.gen.tier||1,opts.factions.nemesis);
    if(G&&opts.factions&&opts.factions.wanted) spawnNemesis(s,opts.gen.tier||1,{...opts.factions.wanted,lvl:2},opts.factions.wanted.id);
    if(G){ spawnRaiders(s,opts.gen.tier||1,opts.mods||{},opts.factions); if(opts.factions&&opts.factions.hire) spawnHire(s,opts.gen.tier||1,opts.factions.hire); }
    if(G) setupSides(s);
    say(s,`Shuttle docked at ${s.site}. Station is silent. ${s.power?"Lights are on.":"No power. Emergency lights only."}`,"info");
    say(s,"Your suit reads a full atmosphere outside the visor. Magboots engaged.","air");
    return s;
  }
  const PROP_FUEL={crate:7,desk:7,bed:8,locker:4,generator:4,barrel:3,tank:0,brazier:0};
  function fuelFor(t,x,y){
    if(t.t==="prop") return PROP_FUEL[t.kind]??3;
    if(t.t==="door") return 1;
    if(t.t==="floor"||t.t==="extract"){ const r=roomName(x,y); return r==="Captain's cabin"||r==="Crew quarters"?5:r==="Shrine"||r==="Cargo hold"||r==="Fuel storage"?4:2; }
    return 0;
  }
  function applyMods(s,m){
    if(m.power===false) s.power=false;
    const floors=[]; for(let i=0;i<s.tiles.length;i++){ const t=s.tiles[i]; if(t.t==="floor"&&!s.items.some(q=>idx(s,q.x,q.y)===i)) floors.push(i); }
    const p0=players(s)[0], far=floors.filter(i=>Math.hypot(i%s.W-p0.x,((i/s.W)|0)-p0.y)>14);
    if(m.huskDrop) s.ents=s.ents.filter(e=>e.kind!=="husk"||!chance(s,m.huskDrop));
    for(let k=0;k<(m.huskAdd|0)&&far.length;k++){ const i=far.splice(ri(s,0,far.length-1),1)[0]; if(!entAt(s,i%s.W,(i/s.W)|0)) addHusk(s,i%s.W,(i/s.W)|0); }
    for(let k=0;k<(m.fires|0)&&far.length;k++){ const i=far.splice(ri(s,0,far.length-1),1)[0]; s.fire[i]=2; s.fuel[i]=Math.max(s.fuel[i],10); }
    if(m.loot) for(const it of s.items) if(K(it)==="val") it.v=Math.round(Items.value(it)*m.loot);
  }
  function addPlayer(s,id,name,x,y,lo){
    lo=normLo(lo); const cp=v=>v&&Items.def(v.d)?{d:v.d,r:v.r|0,...(v.l?{l:v.l}:{}),...(v.v?{v:v.v}:{}),...(v.m?{m:v.m}:{}),...(v.iss?{iss:1}:{})}:null;
    const armor=cp(lo.armor), pack=cp(lo.pack), G0={head:cp(lo.head),armor,legs:cp(lo.legs),acc:cp(lo.acc),light:cp(lo.light),pack}, A=gearOf(G0), cap=capOf(G0);
    const ammo={}; for(const t of AMMO_TYPES) ammo[t]=Math.max(0,(lo.ammo&&lo.ammo[t])|0);
    const PK=lo.perks&&typeof lo.perks==="object"?{...lo.perks}:{}, HPX={}; for(const l of LIMBS) HPX[l]=Math.round(PLAYER_HP[l]*(1+.12*(PK.tough|0)));
    s.ents.push({id,kind:"player",name,x,y,hp:{...HPX},max:{...HPX},perks:PK,xp:0,frac:{...((lo.injury&&lo.injury.frac)||{})},inf:(lo.injury&&lo.injury.inf)|0,bleed:{},blood:100,o2:A.o2,o2max:A.o2,
      w1:cp(lo.w1),w2:cp(lo.w2),melee:cp(lo.melee),head:G0.head,armor,legs:G0.legs,acc:G0.acc,light:G0.light,pack,act:1,ammo,mats:Object.fromEntries(Object.keys(Items.MATS).map(k=>[k,0])),cap,look:lo.look||null,stimT:0,
      food:lo.food==null?80:Math.max(0,Math.min(100,+lo.food)),water:lo.water==null?80:Math.max(0,Math.min(100,+lo.water)),
      inv:(lo.inv||[]).slice(0,cap+((lo.perks&&lo.perks.mule)|0)).map(it=>({...it,id:s.nextId++})),alive:true,acted:false,busy:0,face:[1,0],seen:new Array(s.W*s.H).fill(0),flags:{}});
    const P=s.ents[s.ents.length-1]; P.cap=capOf(P); P.secCap=Math.max(0,lo.secCap==null?2:lo.secCap|0); P.brig=!!lo.brig; P.mast=lo.mast&&typeof lo.mast==="object"?{...lo.mast}:{}; P.imp=lo.implants&&typeof lo.implants==="object"?{...lo.implants}:{}; if(P.imp.lungs){ P.o2max+=30; P.o2+=30; } if(lo.morale) P.morale=1; if(lo.coffee) P.coffee=1; if(lo.remains&&lo.remains.items) P.remainsLo=lo.remains;
  }
  // ---- extras that make each station worth exploring: hidden caches, lore, radiation, and something going wrong ----
  function furnishExtras(s,tier,kind){
    const rooms=(s.rooms||[]).filter(r=>r[0]&&!/Docking|corridor|shaft|hall/i.test(r[0]));
    // loose wall panels on a room's back wall, hiding a stash
    const walls=[]; for(const r of rooms){ const y=r[2]-1; for(let x=r[1];x<=r[3];x++){ const t=tileAt(s,x,y), b=tileAt(s,x,y+1); if(t.t==="wall"&&walk(b)) walls.push([x,y]); } }
    for(let k=ri(s,1,2)+(tier>=3?1:0);k>0&&walls.length;k--){ const [x,y]=walls.splice(ri(s,0,walls.length-1),1)[0], items=[]; for(let n=ri(s,2,3);n>0;n--) items.push(Items.roll(()=>rand(s),tier+1,pickS(s,["val","val","weapon","armor","med","ammo"]))); s.tiles[idx(s,x,y)].cache=items; }
    // data logs: lore from whoever was here, tucked in lockers and shelves (or left on the deck)
    const pool=Items.LOGS.filter(l=>l.k.includes(kind)||l.k.includes("")), boxes=[]; for(let i=0;i<s.tiles.length;i++){ const t=s.tiles[i]; if(t.t==="prop"&&["locker","shelf","footlocker","crate"].includes(t.kind)) boxes.push(t); }
    for(let k=ri(s,1,2);k>0&&pool.length;k--){ const L=pool.splice(ri(s,0,pool.length-1),1)[0], it={d:"datalog",r:0,lg:L.id,jn:"Data log: "+L.t}; if(boxes.length){ const t=boxes[ri(s,0,boxes.length-1)]; t.loot=t.loot||[]; t.loot.push(it); } else { const T=farTiles(s,6); if(T.length){ const [x,y]=T[ri(s,0,T.length-1)]; spawnItem(s,it,x,y); } } }
    // radiation: a leaking reactor or fuel store floods one room
    const hot=rooms.filter(r=>/Engineering|Fuel storage/.test(r[0])); s.rad=[];
    if(hot.length&&chance(s,kind==="mining"||kind==="hive"?.6:.3)){ const r=hot[ri(s,0,hot.length-1)]; for(let y=r[2];y<=r[4];y++)for(let x=r[1];x<=r[3];x++){ const i=idx(s,x,y); if(s.tiles[i].t!=="wall"&&s.tiles[i].t!=="space") s.rad.push(i); } }
    // husk nests
    { const want=(kind==="hive"||kind==="research"||kind==="hospital"?ri(s,1,2):chance(s,.35)?1:0)+(tier>=3&&chance(s,.5)?1:0)+((s.mods&&s.mods.nests)|0); const T=farTiles(s,12).filter(([x,y])=>{ const t=tileAt(s,x,y); return t.t==="floor"&&!entAt(s,x,y)&&N4.filter(([a,b])=>walk(tileAt(s,x+a,y+b))).length>=3&&roomName(x,y)&&!/corridor|Docking/i.test(roomName(x,y)); });
      for(let k=0;k<want&&T.length;k++){ const [x,y]=T.splice(ri(s,0,T.length-1),1)[0]; if(s.ents.some(e=>e.type==="nest"&&Math.hypot(e.x-x,e.y-y)<8)) continue; const n=addHusk(s,x,y,"nest"); n.t=ri(s,0,8); } }
    // maintenance vents: crawlspaces linking two rooms (stalkers use them too)
    s.vents=[]; { const cand=[]; for(const r of rooms){ const opts=[]; for(let y=r[2];y<=r[4];y++)for(let x=r[1];x<=r[3];x++){ const t=tileAt(s,x,y); if(t.t!=="floor"||s.items.some(q=>q.x===x&&q.y===y)||entAt(s,x,y)) continue;
          if([[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].some(([a,b])=>{ const q=tileAt(s,x+a,y+b); return q.t==="prop"||q.t==="door"||q.t==="terminal"||q.t==="extract"; })) continue; opts.push([x,y]); }
        if(opts.length) cand.push({r,o:opts}); }
      for(let k=ri(s,1,2)+((s.W*s.H)>3000?1:0);k>0&&cand.length>=2;k--){ const A=cand.splice(ri(s,0,cand.length-1),1)[0]; let bi=-1,bd=-1; for(let j=0;j<cand.length;j++){ const B=cand[j], d=Math.hypot(A.r[1]-B.r[1],A.r[2]-B.r[2]); if(d>bd&&d<40){ bd=d; bi=j; } } if(bi<0) break; const B=cand.splice(bi,1)[0];
        const a=A.o[ri(s,0,A.o.length-1)], b=B.o[ri(s,0,B.o.length-1)]; const n=s.vents.length; s.vents.push([idx(s,a[0],a[1]),idx(s,b[0],b[1])]); s.tiles[idx(s,a[0],a[1])].vent=n+1; s.tiles[idx(s,b[0],b[1])].vent=n+1; } }
    // booby traps: tripwires left by scavengers in corridors and doorways
    s.traps=[]; s.mines=[]; { const T=farTiles(s,9).filter(([x,y])=>{ const t=tileAt(s,x,y); if(t.t!=="floor"||t.vent||s.items.some(q=>q.x===x&&q.y===y)) return false; const wl=N4.filter(([a,b])=>!walk(tileAt(s,x+a,y+b))&&tileAt(s,x+a,y+b).t!=="door").length; return wl>=2||N4.some(([a,b])=>tileAt(s,x+a,y+b).t==="door"); });
      for(let k=tier+ri(s,0,1);k>0&&T.length;k--){ const [x,y]=T.splice(ri(s,0,T.length-1),1)[0]; if(!s.traps.some(q=>Math.abs(q.x-x)+Math.abs(q.y-y)<4)) s.traps.push({x,y,seen:{}}); } }
    if(s.mods&&s.mods.ev){ s.ev={type:s.mods.ev,at:ri(s,35,70),on:0}; return; }
    // a station event, some time into the raid
    if(chance(s,.45)){ const opts=s.power?[["meltdown",3],["horde",4],["lockdown",2],["surge",2],["boarding",3],["gas",2],["drop",3]]:[["meltdown",2],["horde",5],["boarding",3],["gas",2],["drop",3]]; let t=opts.reduce((a,o)=>a+o[1],0)*rand(s), type="horde"; for(const [k,w] of opts){ if((t-=w)<0){ type=k; break; } } s.ev={type,at:ri(s,30,100),on:0}; } }
  // husk nests: pulsing egg sacs that birth stalkers while anyone living is near. Burn them or shoot them
  function nestTick(s,h){ h.t=(h.t|0)+1; const near=players(s).some(q=>q.alive&&Math.hypot(q.x-h.x,q.y-h.y)<=10)||s.ents.some(q=>q.alive&&q.kind==="raider"&&Math.hypot(q.x-h.x,q.y-h.y)<=7);
    if(!near||h.t<9) return; const kids=s.ents.filter(q=>q.alive&&q.mom===h.id).length; if(kids>=4) return; const sp=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].map(([dx,dy])=>[h.x+dx,h.y+dy]).find(([x,y])=>free(s,x,y)); if(!sp) return;
    h.t=0; const c=addHusk(s,sp[0],sp[1],chance(s,.7)?"stalker":"husk"); c.mom=h.id; c.aware=true; const q=players(s).filter(z=>z.alive).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0]; if(q) c.last={x:q.x,y:q.y};
    fx(s,{type:"shriek",x:h.x,y:h.y,id:h.id}); if(anyPlayerSees(s,h.x,h.y)) say(s,"The nest splits along a seam and something wet crawls out, already hunting.","bad"); else if(q&&Math.hypot(q.x-h.x,q.y-h.y)<8) say(s,"Something tears and squelches nearby. Then claws on the deck.","warn"); }
  // side objectives: two optional jobs per raid that pay a bonus if you get out
  const SIDES={power:{t:"Get the lights back on",d:"Restore main power at the relay console.",cr:150,xp:30},search:{t:"Leave nothing behind",d:"Search 8 containers.",n:8,cr:120,xp:25},elite:{t:"Mutant sample",d:"Kill a mutated husk.",cr:200,xp:40},
    nest:{t:"Burn the nest",d:"Destroy a husk nest.",cr:220,xp:45},hack:{t:"Pull the logs",d:"Hack the station's security network.",cr:140,xp:30},cache:{t:"Treasure hunter",d:"Find a hidden wall cache.",cr:160,xp:30},
    quiet:{t:"In and out",d:"Make 2 silent takedowns.",n:2,cr:180,xp:40},custodian:{t:"Scrap the Custodian",d:"Destroy the security mech.",cr:600,xp:120},disarm:{t:"Clear the wires",d:"Disarm a tripwire.",cr:130,xp:30}};
  function setupSides(s){ const pool=[]; if(!s.power&&s.tiles.some(t=>t.t==="console")) pool.push("power"); pool.push("search","quiet"); if(s.ents.some(e=>e.mut)) pool.push("elite"); if(s.ents.some(e=>e.type==="nest")) pool.push("nest"); if(s.tiles.some(t=>t.t==="prop"&&t.kind==="desk")) pool.push("hack"); if(s.tiles.some(t=>t.cache)) pool.push("cache"); if(s.bossBot) pool.push("custodian","custodian"); if((s.traps||[]).length) pool.push("disarm");
    s.side=[]; for(let k=0;k<2&&pool.length;k++){ const id=pool.splice(ri(s,0,pool.length-1),1)[0]; for(let j=pool.length-1;j>=0;j--) if(pool[j]===id) pool.splice(j,1); s.side.push({id,done:0,prog:0}); } }
  function sideTick(s){ if(!s.side) return; const ps=players(s), T=k=>ps.reduce((a,q)=>a+((q.tally&&q.tally[k])|0),0), K=k=>ps.reduce((a,q)=>a+((q.tally&&q.tally.k&&q.tally.k[k])|0),0);
    for(const o of s.side){ if(o.done) continue; const D=SIDES[o.id]; let v=0;
      if(o.id==="power") v=s.power?1:0; if(o.id==="search") v=T("searches"); if(o.id==="elite") v=K("elite"); if(o.id==="nest") v=K("nest"); if(o.id==="hack") v=T("hacks"); if(o.id==="cache") v=T("caches"); if(o.id==="quiet") v=T("takedowns"); if(o.id==="custodian") v=K("custodian"); if(o.id==="disarm") v=T("disarms");
      o.prog=v; if(v>=(D.n||1)){ o.done=1; say(s,`Side objective done: ${D.t}. +${D.cr} cr if you get out.`,"good"); fx(s,{type:"levelup"}); } } }
  function mutate(s,tier,mods){ const P=(tier>=3?.18:tier===2?.11:.06)*((mods&&mods.elite)||1), keys=Object.keys(MUTS);
    for(const h of s.ents){ if(h.kind!=="husk"||h.type==="matriarch"||h.type==="nest"||h.mut||!chance(s,P)) continue; h.mut=keys[ri(s,0,keys.length-1)];
      if(h.mut==="armored") for(const l of LIMBS){ h.hp[l]=Math.round(h.hp[l]*1.6); h.max[l]=h.hp[l]; } } }
  const ventOf=(s,x,y)=>{ const t=tileAt(s,x,y); return t.vent?s.vents[t.vent-1]:null; };
  function ventExit(s,e){ const V=ventOf(s,e.x,e.y); if(!V) return null; const o=V[0]===idx(s,e.x,e.y)?V[1]:V[0], ox=o%s.W, oy=(o/s.W)|0;
    if(!entAt(s,ox,oy)) return [ox,oy]; return [[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>[ox+a,oy+b]).find(([x,y])=>free(s,x,y))||null; }
  function crawl(s,p){ const to=ventExit(s,p); if(!to){ say(s,"Something is wedged in the far end of the vent. It won't budge.","warn"); return false; }
    const x0=p.x,y0=p.y; p.x=to[0]; p.y=to[1]; p.busy=Math.max(p.busy,1); fx(s,{type:"vent",x0,y0,x:p.x,y:p.y,id:p.id}); noise(s,p.x,p.y,3);
    for(const h of s.ents) if(h.kind==="husk"&&h.alive&&h.last&&Math.hypot(h.last.x-x0,h.last.y-y0)<=3&&!huskSees(s,h,p)){ h.last=null; h.search=4; }
    p.tally=p.tally||{}; p.tally.vents=(p.tally.vents|0)+1; const rn=roomName(p.x,p.y);
    say(s,`You haul yourself through the crawlspace on your elbows and drop out${rn?` in ${rn}`:""}. Anything tracking you just lost the trail.`,"good"); return true; }
  const trapAt=(s,x,y)=>(s.traps||[]).find(t=>t.x===x&&t.y===y), mineAt=(s,x,y)=>(s.mines||[]).find(t=>t.x===x&&t.y===y);
  function springTrap(s,T,byMine){ if(byMine) s.mines=s.mines.filter(q=>q!==T); else s.traps=s.traps.filter(q=>q!==T); const a0=ATK, k0=KCLS; ATK=byMine?T.by:null; KCLS="explosive";
    fx(s,{type:"explode",x:T.x,y:T.y,small:1}); if(anyPlayerSees(s,T.x,T.y)) say(s,byMine?"*click* A tripmine goes off!":"*click* A tripwire snaps. The charge goes off!","warn"); blast(s,T.x,T.y,{r:1.5,dmg:byMine?[14,24]:[10,18]}); ATK=a0; KCLS=k0; }
  const mineFoe=(s,e,T)=>e.alive&&(e.kind==="husk"||(e.kind==="bot"&&!String(e.owner||"").startsWith("p:"))||(e.kind==="raider"&&crewOf(s,e)&&crewOf(s,e).att==="hostile"));
  function trapTick(s){
    for(const T of (s.traps||[]).slice()){ const e=entAt(s,T.x,T.y); if(e&&e.alive&&(e.kind==="husk"||e.kind==="player")) springTrap(s,T,false); }
    for(const T of (s.mines||[]).slice()){ if(T.t>=s.turn) continue; if(s.ents.some(e=>mineFoe(s,e,T)&&Math.max(Math.abs(e.x-T.x),Math.abs(e.y-T.y))<=1)) springTrap(s,T,true); }
    for(const p of players(s)){ if(!p.alive) continue; const G=gearOf(p), r=s.power||G.lit?2:1;
      for(const T of s.traps||[]){ if(T.seen[p.id]) continue; if(Math.max(Math.abs(T.x-p.x),Math.abs(T.y-p.y))<=r&&los(s,p.x,p.y,T.x,T.y)){ T.seen[p.id]=1; const c0=CTX; CTX=p.id; say(s,"You freeze. A tripwire is strung across the deck ahead, wired to a charge.","warn"); CTX=c0; fx(s,{type:"spot",x:T.x,y:T.y,pid:p.id}); } } } }
  // Rivet, the ship's cat: wanders the decks, follows whoever fed it last, sleeps in warm corners
  function addPet(s){ const fl=[]; for(let i=0;i<s.tiles.length;i++){ const x=i%s.W,y=(i/s.W)|0; if(s.tiles[i].t==="floor"&&!entAt(s,x,y)&&N4.every(([a,b])=>walk(tileAt(s,x+a,y+b))||tileAt(s,x+a,y+b).t!=="space")) fl.push(i); }
    const p0=players(s)[0]; const near=fl.filter(i=>p0&&Math.hypot(i%s.W-p0.x,((i/s.W)|0)-p0.y)<12&&Math.hypot(i%s.W-p0.x,((i/s.W)|0)-p0.y)>2); const pool=near.length?near:fl; if(!pool.length) return;
    const i=pool[ri(s,0,pool.length-1)]; s.ents.push({id:"cat",kind:"pet",name:"Rivet",x:i%s.W,y:(i/s.W)|0,alive:true,hp:{},max:{},bleed:{},face:[1,0],sit:0,nap:0}); }
  function petTick(s){ const c=s.ents.find(e=>e.kind==="pet"); if(!c) return; if(c.sit>0){ c.sit--; return; } if(c.nap>0){ c.nap--; return; }
    const r=rand(s); if(r<.06){ c.nap=ri(s,6,14); return; } if(r<.5) return;
    const ps=players(s); const tgt=ps.length&&rand(s)<.45?ps[ri(s,0,ps.length-1)]:null; let opts=N4.map(([dx,dy])=>[c.x+dx,c.y+dy]).filter(([x,y])=>walk(tileAt(s,x,y))&&!entAt(s,x,y)&&tileAt(s,x,y).t!=="seat");
    if(tgt&&Math.abs(tgt.x-c.x)+Math.abs(tgt.y-c.y)>2) opts.sort((a,b)=>Math.hypot(a[0]-tgt.x,a[1]-tgt.y)-Math.hypot(b[0]-tgt.x,b[1]-tgt.y)); else if(opts.length>1) opts=[opts[ri(s,0,opts.length-1)]];
    if(opts.length){ face(c,opts[0][0]-c.x,opts[0][1]-c.y); c.x=opts[0][0]; c.y=opts[0][1]; } }
  function eventTick(s){ const E=s.ev; if(!E) return;
    if(!E.on&&s.turn>=E.at){ E.on=1; fx(s,{type:"alarm",kind:E.type});
      if(E.type==="meltdown"){ E.end=s.turn+55; say(s,"KLAXONS. \"Reactor scram failure. Core breach in 55 turns. All personnel evacuate.\" Get to the shuttle.","bad"); }
      if(E.type==="horde"){ const ps=players(s).filter(q=>q.alive); const T=farTiles(s,14).filter(([x,y])=>ps.every(q=>Math.hypot(q.x-x,q.y-y)>14)); const n=6+(s.tierN|0)*2;
        for(let k=0;k<n&&T.length;k++){ const [x,y]=T.splice(ri(s,0,T.length-1),1)[0], h=addHusk(s,x,y,chance(s,.3)?"stalker":"husk"), q=ps[ri(s,0,ps.length-1)]; h.aware=true; if(q) h.last={x:q.x,y:q.y}; }
        say(s,"A long, wet howl rolls through the vents. Then another. Then dozens. A horde is coming for you.","bad"); }
      if(E.type==="lockdown"){ E.end=s.turn+15; E.doors=[]; for(let i=0;i<s.tiles.length;i++){ const t=s.tiles[i]; if(t.t==="door"&&!t.broken&&!t.locked){ if(!entAt(s,i%s.W,(i/s.W)|0)) t.open=false; t.locked=true; E.doors.push(i); } } for(const b of s.ents) if(b.kind==="bot") b.seen={};
        say(s,"\"SECURITY LOCKDOWN.\" Every door slams and maglocks. 15 turns, or a breaching charge.","bad"); }
      if(E.type==="boarding"){ const pad=s.tiles.findIndex(t=>t.t==="extract"), px=pad%s.W, py=(pad/s.W)|0, T=[]; for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){ const x=px+dx,y=py+dy; if(tileAt(s,x,y).t==="floor"&&!entAt(s,x,y)&&players(s).every(q=>Math.hypot(q.x-x,q.y-y)>4)) T.push([x,y]); }
        const fac=pickS(s,["reaver","reaver","blacksun","hollow"]), id="cb"; s.crews[id]={id,fac,att:"hostile",met:{},warn:{},enemy:{},follow:null,followT:0,goal:null,leave:false,born:s.turn,stay:999,home:[px,py],boarders:1}; const used=new Set(s.ents.filter(e=>e.kind==="raider").map(e=>e.name));
        for(let k=0;k<3+((s.tierN|0)>=3?1:0)&&T.length;k++){ const [x,y]=T.splice(ri(s,0,T.length-1),1)[0], r=makeRaider(s,fac,Math.max(2,s.tierN|0),x,y,id,k===0,used); const q=players(s).find(z=>z.alive); if(q) r.last={x:q.x,y:q.y}; s.ents.push(r); }
        say(s,`A hull-grinding CLANG from the docking bay. Another ship has latched on. ${FACTIONS[fac].name} boarders are pouring in by the shuttle pad.`,"bad"); }
      if(E.type==="gas"){ E.end=s.turn+45; const rs=(s.rooms||[]).filter(r=>r[0]&&!/Docking/i.test(r[0])); const r=rs.length?rs[ri(s,0,rs.length-1)]:null; s.gas=[]; if(r){ const cx=(r[1]+r[3])>>1, cy=(r[2]+r[4])>>1; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ const i=idx(s,cx+dx,cy+dy); if(walk(s.tiles[i])) s.gas.push(i); } E.room=r[0]; }
        say(s,`A pipe ruptures somewhere${E.room?` near the ${E.room}`:""}. Green fog starts rolling through the decks. Toxic. Masks on.`,"bad"); }
      if(E.type==="drop"){ const T=farTiles(s,10).filter(([x,y])=>tileAt(s,x,y).t==="floor"&&!entAt(s,x,y)&&roomName(x,y)&&!s.items.some(q=>q.x===x&&q.y===y)); if(T.length){ const [x,y]=T[ri(s,0,T.length-1)], t=4+(s.tierN|0);
          const loot=[Items.roll(()=>rand(s),t,"weapon"),Items.roll(()=>rand(s),t,"armor"),Items.roll(()=>rand(s),t,"med"),Items.roll(()=>rand(s),t,pickS(s,["val","throw","ammo"]))]; s.tiles[idx(s,x,y)]={t:"prop",kind:"pod",loot}; s.fuel[idx(s,x,y)]=0; noise(s,x,y,22); fx(s,{type:"explode",x,y,big:1}); E.x=x; E.y=y;
          say(s,`Something screams through the hull and slams into the ${roomName(x,y)}. An orbital supply pod. Everyone aboard heard that.`,"warn");
          for(const C of Object.values(s.crews||{})) if(!C.leave) C.goal={k:"box",x,y}; } }
      if(E.type==="surge"){ E.end=s.turn+12; s.power=false; say(s,"A power surge blows the main bus. The station goes dark. The backup should kick in soon.","warn"); }
      return; }
    if(!E.on||E.done) return;
    if(E.type==="meltdown"){ const left=E.end-s.turn; if(left>0&&left%10===0) say(s,`"Core breach in ${left} turns."`,"bad");
      if(left<=0){ E.done=1; fx(s,{type:"explode",x:players(s)[0]?players(s)[0].x:0,y:players(s)[0]?players(s)[0].y:0,big:1}); for(const e of s.ents) if(e.alive&&(e.kind!=="player"||!e.extracted)){ CTX=e.kind==="player"?e.id:null; kill(s,e,"Vaporised when the reactor went critical."); } CTX=null; } }
    if(E.type==="gas"){ if(s.turn<E.end&&s.gas.length<130){ const add=[]; for(const i of s.gas){ if(!chance(s,.22)) continue; const x=i%s.W,y=(i/s.W)|0; for(const [dx,dy] of N4){ const j=idx(s,x+dx,y+dy), t=s.tiles[j]; if(t&&(walk(t)||(t.t==="door"&&t.open))&&!s.gas.includes(j)&&!add.includes(j)) add.push(j); } } s.gas.push(...add.slice(0,8)); }
      if(s.turn>=E.end){ s.gas=s.gas.slice(0,Math.max(0,s.gas.length-10)); if(!s.gas.length){ E.done=1; say(s,"The scrubbers finally catch up. The green fog thins and is gone.","good"); } } }
    if((E.type==="lockdown"||E.type==="surge")&&s.turn>=E.end){ E.done=1; if(E.type==="lockdown"){ for(const i of E.doors||[]) s.tiles[i].locked=false; say(s,"\"Lockdown lifted.\" The maglocks release with a clunk.","good"); } else { s.power=true; fx(s,{type:"power"}); say(s,"The backup generators catch. Lights stutter back on.","good"); } } }
  function chargeTick(s){ if(!s.charges||!s.charges.length) return; for(const c of s.charges){ if(--c.t>0) continue; const t=tileAt(s,c.x,c.y); ATK=c.by;
      if(t.t==="door"){ t.open=true; t.broken=true; t.locked=false; t.sealed=false; } fx(s,{type:"explode",x:c.x,y:c.y}); noise(s,c.x,c.y,16); say(s,"The breaching charge goes off. The door is gone.","warn"); blast(s,c.x,c.y,{r:1.6,dmg:[8,14]}); ATK=null; }
    s.charges=s.charges.filter(c=>c.t>0); }
  // ---- faction jobs on this station ----
  function farTiles(s,min){ const p0=players(s)[0], out=[]; for(let i=0;i<s.tiles.length;i++){ const x=i%s.W, y=(i/s.W)|0; if(s.tiles[i].t==="floor"&&!entAt(s,x,y)&&(!p0||Math.hypot(x-p0.x,y-p0.y)>min)) out.push([x,y]); } return out; }
  function setupJobs(s,jobs,tier){ s.jobs=[]; const used=new Set();
    for(const j of jobs){ const J={id:j.id,type:j.type,fac:j.fac,title:j.title,done:false,n:j.n|0,prog:0}; s.jobs.push(J); const T=farTiles(s,14); if(!T.length) continue; const at=()=>T.splice(ri(s,0,T.length-1),1)[0];
      if(j.type==="kill"&&j.target&&FACTIONS[j.target.fac]){ const cid="job"+s.jobs.length; s.crews[cid]={id:cid,fac:j.target.fac,att:"hostile",met:{},warn:{},enemy:{},follow:null,followT:0,goal:null,leave:false,born:s.turn,stay:99999};
        const [x,y]=at(), r=makeRaider(s,j.target.fac,Math.min(3,tier+1),x,y,cid,true,used); r.name=j.target.name; for(const l of LIMBS){ r.max[l]=Math.round(r.max[l]*1.6); r.hp[l]=r.max[l]; } r.jobTarget=j.id; r.trait="veteran"; s.ents.push(r);
        for(let k=0;k<ri(s,1,2);k++){ const sp=N4.map(([dx,dy])=>[x+dx,y+dy]).find(([a,b])=>walk(tileAt(s,a,b))&&!entAt(s,a,b)); if(sp) s.ents.push(makeRaider(s,j.target.fac,tier,sp[0],sp[1],cid,false,used)); } }
      if(j.type==="recover"){ const item={d:"jobitem",r:0,jn:j.item,job:j.id}; let placed=false;
        const boxes=[]; for(let i=0;i<s.tiles.length;i++){ const t=s.tiles[i]; if(t.t==="prop"&&(t.kind==="strongbox"||(roomName(i%s.W,(i/s.W)|0)==="Vault"&&CONTAINERS.has(t.kind)))) boxes.push(t); }
        if(boxes.length){ const t=boxes[ri(s,0,boxes.length-1)]; t.loot=t.loot||[]; t.loot.push(item); t.searched=false; placed=true; }
        if(!placed){ const [x,y]=at(); spawnItem(s,item,x,y); } }
      if(j.type==="rescue"&&FACTIONS[j.fac]){ const cid="res"+s.jobs.length; s.crews[cid]={id:cid,fac:j.fac,att:"friendly",met:{},warn:{},enemy:{},follow:null,followT:0,goal:null,leave:false,born:s.turn,stay:99999,hired:true};
        const [x,y]=at(), r=makeRaider(s,j.fac,tier,x,y,cid,true,used); r.w1=null; r.w2=null; r.ammo={}; r.hp.torso=Math.round(r.max.torso*.55); r.rescue=j.id; r.stranded=true; s.ents.push(r); } } }
  // your own body from an earlier, failed raid: still here, picked over a little more each day
  function spawnRemains(s){ for(const p of players(s)){ const R0=p.remainsLo; if(!R0) continue; delete p.remainsLo;
      const tiles=[]; for(let i=0;i<s.tiles.length;i++){ const x=i%s.W, y=(i/s.W)|0; if(s.tiles[i].t==="floor"&&Math.hypot(x-p.x,y-p.y)>12&&!entAt(s,x,y)) tiles.push([x,y]); } if(!tiles.length) continue;
      const [x,y]=tiles[ri(s,0,tiles.length-1)], lose=Math.min(.6,.12*Math.max(0,(R0.days|0)-1)), inv=(R0.items||[]).filter(()=>!chance(s,lose)).slice(0,14).map(it=>({...it,id:s.nextId++}));
      s.ents.push({id:"rm"+p.id,kind:"remains",owner:p.id,name:p.name&&p.name!=="You"?p.name:"Your body",x,y,alive:false,inv,ammo:{...(R0.ammo||{})},mats:{},look:p.look||null,hp:{...p.max},max:{...p.max},bleed:{},face:[0,1],flags:{}});
      const c0=CTX; CTX=p.id; say(s,inv.length?`Your old suit beacon is pinging somewhere aboard. Your body is still here${lose>0?", though someone has been through it":""}.`:"Your old suit beacon pings faintly. Scavengers got there first: nothing left on your body.",inv.length?"good":"warn"); CTX=c0; } }
  function addHusk(s,x,y,type="husk"){ const T0=HTYPES[type]||HTYPES.husk, hp={}; for(const l of LIMBS) hp[l]=Math.round(HUSK_HP[l]*T0.hp);
    const h={id:"h"+(s.nextId++),kind:"husk",type,name:T0.name,x,y,hp,max:{...hp},bleed:{},blood:type==="matriarch"?200:60,
      alive:true,aware:false,last:null,limp:false,busy:0,face:[0,1]}; s.ents.push(h); return h;
  }
  function addBot(s,x,y,type,owner){ const B=BTYPES[type]; const b={id:"b"+(s.nextId++),kind:"bot",type,name:B.name,owner:owner||null,x,y,hp:{...B.hp},max:{...B.hp},bleed:{},blood:100,alive:true,busy:0,face:[0,1],syn:true,seen:{},home:{x,y}}; s.ents.push(b); return b; }
  // pick what each husk spawn becomes: tougher variants on harder stations, stalkers in packs
  function huskType(s,tier,kind){ const w=tier>=3?[["husk",42],["stalker",24],["spitter",16],["brute",18],["bloater",9]]:tier===2?[["husk",58],["stalker",20],["spitter",12],["brute",10],["bloater",7]]:[["husk",80],["stalker",14],["spitter",6],["bloater",4]];
    if(kind==="hospital"||kind==="research") w.forEach(x=>{ if(x[0]==="spitter") x[1]*=2.2; }); if(kind==="colony") w.forEach(x=>{ if(x[0]==="husk") x[1]*=1.5; }); if(kind==="mining") w.forEach(x=>{ if(x[0]==="brute") x[1]*=1.8; if(x[0]==="stalker") x[1]*=1.2; });
    let t=w.reduce((a,x)=>a+x[1],0)*rand(s); for(const [k,v] of w){ if((t-=v)<0) return k; } return "husk"; }
  function populate(s,G,tier,kind){
    for(const [x,y] of G.husks){ if(entAt(s,x,y)) continue; const t=huskType(s,tier,kind); addHusk(s,x,y,t);
      if(t==="stalker"&&chance(s,.6)) for(let k=0,n=1;k<n;k++){ const sp=N4.map(([dx,dy])=>[x+dx,y+dy]).find(([a,b])=>walk(tileAt(s,a,b))&&!entAt(s,a,b)); if(sp) addHusk(s,sp[0],sp[1],"stalker"); } }
    // a Matriarch nests in the vault (or the biggest room) on harder stations
    const bossP=(tier>=3?.6:tier===2?.3:0)+(kind==="hospital"?.25:0); if(chance(s,bossP)){ const rs=(s.rooms||[]).filter(r=>r[0]&&!/Docking|corridor|shaft|hall/i.test(r[0])).sort((a,b)=>(b[0]==="Vault"?999:0)+(b[3]-b[1])*(b[4]-b[2])-((a[0]==="Vault"?999:0)+(a[3]-a[1])*(a[4]-a[2])));
      const rm=rs[0]; if(rm){ const c=[(rm[1]+rm[3])>>1,(rm[2]+rm[4])>>1]; let spot=null; for(let d=0;d<4&&!spot;d++) for(let dy=-d;dy<=d&&!spot;dy++) for(let dx=-d;dx<=d&&!spot;dx++){ const x=c[0]+dx,y=c[1]+dy; if(walk(tileAt(s,x,y))&&!entAt(s,x,y)) spot=[x,y]; }
        if(spot){ const m=addHusk(s,spot[0],spot[1],"matriarch"); m.lurk=1; s.boss=m.id; } } }
  }
  // turrets watch doors and corridors near security, armouries and vaults; drones patrol
  function placeCustodian(s,tier,kind){ if(s.boss||tier<2) return; const P=(tier>=3?.35:.15)+(kind==="outpost"||kind==="research"?.25:0)+((s.mods&&s.mods.custodian)?1:0); if(!chance(s,P)) return;
    const rs=(s.rooms||[]).filter(r=>r[0]&&!/Docking|corridor|shaft|hall/i.test(r[0])).sort((a,b)=>(b[0]==="Vault"?999:/Security|Armory|Engineering/.test(b[0])?50:0)+(b[3]-b[1])*(b[4]-b[2])-((a[0]==="Vault"?999:/Security|Armory|Engineering/.test(a[0])?50:0)+(a[3]-a[1])*(a[4]-a[2]))); const p0=players(s)[0];
    for(const rm of rs){ if(p0&&Math.hypot((rm[1]+rm[3])/2-p0.x,(rm[2]+rm[4])/2-p0.y)<14) continue; const c=[(rm[1]+rm[3])>>1,(rm[2]+rm[4])>>1]; for(let d=0;d<4;d++) for(let dy=-d;dy<=d;dy++) for(let dx=-d;dx<=d;dx++){ const x=c[0]+dx,y=c[1]+dy; if(walk(tileAt(s,x,y))&&!entAt(s,x,y)){ const b=addBot(s,x,y,"custodian",null); s.bossBot=b.id; return; } } } }
  function placeSecurity(s,tier,kind,owner){ placeCustodian(s,tier,kind); const p0=players(s)[0]; if(!p0) return; const rs=(s.rooms||[]).filter(r=>r[0]&&!/Docking/.test(r[0])&&Math.hypot((r[1]+r[3])/2-p0.x,(r[2]+r[4])/2-p0.y)>12);
    const want=r=>/Security|Armory|Vault|Captain/.test(r[0])?3:/corridor/i.test(r[0])?1:kind==="hive"?2:.4;
    let nT=(kind==="hive"||kind==="outpost"?ri(s,3,5):ri(s,0,2)+(tier>=2?1:0)), nD=(kind==="hive"?ri(s,2,3):kind==="outpost"?ri(s,1,2):chance(s,.3+tier*.15)?1:0);
    const pickRoom=()=>{ let t=rs.reduce((a,r)=>a+want(r),0)*rand(s); for(const r of rs){ if((t-=want(r))<0) return r; } return rs[0]; };
    const spotIn=(r,edge)=>{ const c=[]; for(let y=r[2];y<=r[4];y++)for(let x=r[1];x<=r[3];x++){ if(!walk(tileAt(s,x,y))||entAt(s,x,y)||s.items.some(i=>i.x===x&&i.y===y)) continue; const nearWall=N4.some(([dx,dy])=>tileAt(s,x+dx,y+dy).t==="wall"); if(edge&&!nearWall) continue; if(N4.some(([dx,dy])=>tileAt(s,x+dx,y+dy).t==="door")) continue; c.push([x,y]); } return c.length?c[ri(s,0,c.length-1)]:null; };
    for(let k=0;k<nT&&rs.length;k++){ const r=pickRoom(), sp=r&&spotIn(r,true); if(sp) addBot(s,sp[0],sp[1],"turret",owner); }
    for(let k=0;k<nD&&rs.length;k++){ const r=pickRoom(), sp=r&&spotIn(r,false); if(sp) addBot(s,sp[0],sp[1],"drone",owner); } }
  function addItem(s,c,x,y){
    const d=ITEM[c]; spawnItem(s,d==="val"?Items.roll(()=>rand(s),1,"val"):d,x,y);
  }
  function spawnItem(s,item,x,y){ const it={id:s.nextId++,...item,x,y}; delete it.uid; s.items.push(it); return it; }

  // ---------- helpers ----------
  const idx=(s,x,y)=>y*s.W+x;
  const inb=(s,x,y)=>x>=0&&y>=0&&x<s.W&&y<s.H;
  const tileAt=(s,x,y)=>inb(s,x,y)?s.tiles[idx(s,x,y)]:{t:"space"};
  const entAt=(s,x,y)=>s.ents.find(e=>e.alive&&e.x===x&&e.y===y);
  const players=s=>s.ents.filter(e=>e.kind==="player");
  const N4=[[1,0],[-1,0],[0,1],[0,-1]];
  function face(e,dx,dy){ if(!dx&&!dy) return; e.face=Math.abs(dx)>=Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)]; }
  const fx=(s,o)=>s.fx.push(o);
  let CTX=null, ATK=null, KCLS=null, SPEC=null; const isPid=(s,id)=>!!id&&s.ents.some(q=>q.id===id&&q.kind==="player"); const label=e=>e.kind==="husk"?"the "+(e.mut?MUTS[e.mut].n.toLowerCase()+" ":"")+((HTYPES[e.type||"husk"]||{}).name||"husk"):e.kind==="bot"?"the "+e.name:e.name; // which player a log line is about (multiplayer renders it from their perspective)
  function say(s,msg,kind="info"){ s.log.push({t:s.turn,msg,kind,pid:CTX}); if(s.log.length>80) s.log.shift(); }
  function roomName(x,y){ for(const r of ROOMS) if(x>=r[1]&&x<=r[3]&&y>=r[2]&&y<=r[4]) return r[0]; return "Service crawlway"; }
  function line(x0,y0,x1,y1,extend=0){ // Bresenham, excludes start
    const pts=[]; let dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx+dy, x=x0, y=y0;
    const total=Math.max(dx,-dy)+extend;
    for(let i=0;i<total;i++){ const e2=2*err; if(e2>=dy){err+=dy;x+=sx;} if(e2<=dx){err+=dx;y+=sy;} pts.push([x,y]); }
    return pts;
  }
  function los(s,x0,y0,x1,y1){
    const pts=line(x0,y0,x1,y1), sm=s.smoke; for(let i=0;i<pts.length-1;i++){ if(!clear(tileAt(s,pts[i][0],pts[i][1]))) return false; if(sm&&i>0&&sm[idx(s,pts[i][0],pts[i][1])]) return false; } return true;
  }
  const sightR=s=>s.power?8:4;
  // everyone sees the same distance; only sniper rifles and scoped guns see a few tiles further
  function sightFor(s,e){ let r=sightR(s); if(e&&e.imp&&e.imp.ocular) r+=1; const g=e&&(e.kind==="player"||e.kind==="raider")&&gun(e), st=g&&ST(g); if(st){ if(st.cls==="sniper") r+=s.power?3:2; else if(st.mod==="scope") r+=s.power?2:1; } return r; }
  function canSee(s,p,x,y){ const d=Math.hypot(p.x-x,p.y-y); let r=sightFor(s,p); if(p.kind!=="player"&&d>1.5){ const q=s.ents.find(e=>e.kind==="player"&&e.alive&&e.sneak&&e.x===x&&e.y===y); if(q) r-=2; } return d<=r+.5 && los(s,p.x,p.y,x,y); }
  function anyPlayerSees(s,x,y){ return players(s).some(p=>p.alive&&canSee(s,p,x,y)); }
  function fov(s,p){
    if(s.mode==="ship"){ p.seen.fill(1); return new Array(s.W*s.H).fill(1); }
    const v=new Array(s.W*s.H).fill(0), R=Math.ceil(sightFor(s,p));
    for(let y=Math.max(0,p.y-R);y<=Math.min(s.H-1,p.y+R);y++)for(let x=Math.max(0,p.x-R);x<=Math.min(s.W-1,p.x+R);x++){
      if(canSee(s,p,x,y)){ v[idx(s,x,y)]=1; p.seen[idx(s,x,y)]=1; }
    }
    return v;
  }
  function pickLimb(s){ let r=rand(s)*100; for(const [l,w] of HIT_W){ if((r-=w)<0) return l; } return "torso"; }
  function crippled(e){ return !(e.stimT>0)&&!(e.kind==="player"&&gearOf(e).nolimp)&&(e.hp.lleg<=0||e.hp.rleg<=0||!!(e.frac&&(e.frac.lleg||e.frac.rleg))); }
  function bleedDecal(s,x,y,n=1){ const k=idx(s,x,y); s.blood[k]=Math.min(6,(s.blood[k]||0)+n); }
  function noise(s,x,y,r){ if(r>=3&&s.fx&&s.fx.length<40) s.fx.push({type:"noise",x,y,r}); for(const h of s.ents) if(h.kind==="husk"&&h.alive&&Math.hypot(h.x-x,h.y-y)<=r){ h.aware=true; h.last={x,y}; } }

  function damage(s,e,limb,dmg,bleedP,cause){
    if(!e.alive) return;
    if(e.kind==="raider"&&isPid(s,ATK)) provoke(s,e,ATK);
    if(e.kind==="raider"&&ATK){ const A=s.ents.find(q=>q.id===ATK&&q.kind==="raider"); const C=crewOf(s,e); if(A&&C&&A.crew!==e.crew){ C.enemy=C.enemy||{}; C.enemy[A.crew]=1; } }
    if(e.type==="nest") limb="torso";
    const armoredT=(e.kind==="husk"&&(HT(e).dr||e.mut==="armored"))||((e.kind==="raider"||e.kind==="player")&&gearOf(e).torso>=.12)||e.kind==="bot";
    if(SPEC==="hp"){ dmg=Math.round(dmg*(armoredT?.75:1.25)); if(!armoredT) bleedP=1; }
    if(e.kind==="husk"&&HT(e).dr) dmg=Math.max(1,Math.round(dmg*(1-HT(e).dr*(SPEC==="ap"?.35:1))));
    if(e.kind==="husk"&&e.mut==="armored"&&SPEC!=="ap") dmg=Math.max(1,Math.round(dmg*.75));
    if(e.kind==="player"&&e.imp&&e.imp.dermal) dmg=Math.max(1,Math.round(dmg*.9));
    if(e.kind==="raider"||e.kind==="player"){ const G=gearOf(e), dr=(limb==="head"?G.head:limb==="torso"?G.torso:limb==="larm"||limb==="rarm"?G.torso*.5:G.legs)*(SPEC==="ap"?.35:1); if(dr) dmg=Math.max(1,Math.round(dmg*(1-dr))); }
    if(e.downed&&(limb==="head"||limb==="torso")){ kill(s,e,cause); return; }
    const was=e.hp[limb]; e.hp[limb]=Math.max(0,was-dmg);
    if(e.kind==="player"){ const A=ATK&&ATK!==e.id?s.ents.find(q=>q.id===ATK):null; e.hits=(e.hits||[]).slice(-7); e.hits.push({t:s.turn,l:limb,d:dmg,by:A?whoIs(A):String(cause||"injuries")}); }
    else if(isPid(s,ATK)){ const P=s.ents.find(q=>q.id===ATK); P.tally=P.tally||{}; P.tally.dealt=(P.tally.dealt|0)+Math.min(was,dmg); }
    if(!e.syn&&e.type!=="nest"&&chance(s,bleedP)) e.bleed[limb]=1;
    if(!e.syn) bleedDecal(s,e.x,e.y,1); fx(s,{type:"hurt",id:e.id,x:e.x,y:e.y,limb,dmg,syn:e.syn?1:0});
    const vis=anyPlayerSees(s,e.x,e.y), you=e.kind==="player", who=e.kind==="raider"?e.name+"'s":e.kind==="bot"?`The ${e.name}'s`:`The ${HT(e).name}'s`;
    // a heavy hit that wrecks a limb can tear it clean off
    if(was>0&&e.hp[limb]<=0&&limb!=="torso"&&!(e.sev&&e.sev[limb])&&(dmg-was>=4||dmg>=14)){
      e.sev=e.sev||{}; e.sev[limb]=1; if(!e.syn) e.bleed[limb]=1; fx(s,{type:"sever",id:e.id,limb,x:e.x,y:e.y});
      const c0=CTX; if(you) CTX=e.id; if(you) say(s,limb==="head"?"Your head comes apart.":`Your ${LNAME[limb]} is torn away!`,"bad"); else if(vis) say(s,limb==="head"?`${who} head bursts apart.`:`${who} ${LNAME[limb]} tears off and hits the deck.`,"good"); CTX=c0;
      if(limb==="head"){ kill(s,e,cause); return; } }
    if(was>0&&e.hp[limb]<=0){
      if(limb==="head"||limb==="torso"){
        if(you&&players(s).length>1&&players(s).some(q=>q!==e&&q.alive&&!q.downed)){ e.downed=true; e.downT=8; e.downCause=cause; const c0=CTX; CTX=e.id; say(s,"You're down! A crewmate has 8 turns to reach you.","bad"); CTX=c0; fx(s,{type:"downed",id:e.id,x:e.x,y:e.y}); return; }
        kill(s,e,cause); return; }
      if(you) say(s,`Your ${LNAME[limb]} is mangled beyond use!`,"bad");
      else if(vis) say(s,`${who} ${LNAME[limb]} is ruined.`,"good");
      if(e.kind==="raider"&&e.alive) rsay(s,e,"hit");
    }
  }
  function whoIs(A){ if(A.kind==="husk") return (A.mut?MUTS[A.mut].n+" ":"")+HT(A).name; if(A.kind==="raider"){ const g=gun(A); return `${A.name} (${FACTIONS[A.fac]?FACTIONS[A.fac].name:"raider"}${g?", "+nm(g).toLowerCase():""})`; } if(A.kind==="bot") return A.name; if(A.kind==="player") return A.name+" (friendly fire)"; return A.name||"something"; }
  function kill(s,e,cause){
    if(e.kind==="player"&&e.alive&&!/Vaporised/.test(String(cause))){ const li=(e.inv||[]).findIndex(q=>q.d==="lazarus"); if(li>=0){ e.inv.splice(li,1); for(const l of ["head","torso"]) e.hp[l]=Math.max(e.hp[l],Math.round(e.max[l]*.35)); e.blood=Math.max(e.blood,45); e.bleed={}; e.stimT=Math.max(e.stimT|0,6); e.downed=false; e.lazarus=(e.lazarus|0)+1;
        fx(s,{type:"lazarus",id:e.id,x:e.x,y:e.y}); const c0=CTX; CTX=e.id; say(s,"Your heart stops. Then the Lazarus injector slams a needle into it. You gasp back to life, shaking.","good"); CTX=c0; return; } }
    if(e.kind==="player"&&ATK){ const A=s.ents.find(q=>q.id===ATK&&q.kind==="raider"); if(A) e.nemSrc={name:A.name,fac:A.fac,look:A.look,w1:A.w1||null,head:A.head||null,armor:A.armor||null,was:A.nemesis?1:0}; }
    if(e.wanted&&ATK&&s.ents.some(q=>q.id===ATK&&q.kind==="player")){ s.wantedDown=e.wanted; say(s,`${e.name} is dead. The Concord bounty is yours if you get out alive.`,"good"); }
    if(e.nemesis&&isPid(s,ATK)){ s.nemesisDown=ATK; say(s,`${e.name} is dead. Your nemesis won't be hunting you anymore. Search the body: your gear is on it.`,"good"); }
    e.alive=false; bleedDecal(s,e.x,e.y,3); fx(s,{type:"die",id:e.id,x:e.x,y:e.y});
    if(e.kind==="player"){ s.cause=cause; e.cause=cause; const lh=(e.hits||[]).slice(-1)[0]; e.killer=lh?lh.by:String(cause||""); const c0=CTX; CTX=e.id; say(s,`You die. ${cause}`,"bad"); CTX=c0; }
    if(e.jobTarget){ const J=(s.jobs||[]).find(q=>q.id===e.jobTarget); if(J&&!J.done){ J.done=true; say(s,`${e.name} is dead. Contract target eliminated.`,"good"); } }
    if(e.kind==="husk"&&isPid(s,ATK)){ s.huskKills=(s.huskKills|0)+1; for(const J of s.jobs||[]) if(J.type==="purge"&&!J.done){ J.prog++; if(J.prog>=J.n){ J.done=true; say(s,`That's ${J.n}. The purge contract is done. Get out alive to collect.`,"good"); } } }
    if(e.kind!=="player"&&isPid(s,ATK)){ const P=s.ents.find(q=>q.id===ATK); P.tally=P.tally||{}; const key=e.kind==="husk"?(e.type||"husk"):e.kind; P.tally.k=P.tally.k||{}; P.tally.k[key]=(P.tally.k[key]|0)+1; if(e.jobTarget) P.tally.k.leader=(P.tally.k.leader|0)+1; if(e.mut) P.tally.k.elite=(P.tally.k.elite|0)+1; if(e.kind==="husk"&&e.type==="nest"){} else { P.streak=s.turn-(P.lastKillT|0)<=3?(P.streak|0)+1:1; P.lastKillT=s.turn; if(P.streak>=2){ const nmS=["","","Double kill","Triple kill","Rampage","Massacre"][Math.min(5,P.streak)], bx=P.streak*5; gainXP(s,P.id,bx); P.tally.best=Math.max(P.tally.best|0,P.streak); fx(s,{type:"streak",id:P.id,n:P.streak,x:P.x,y:P.y}); const c0=CTX; CTX=P.id; say(s,`${nmS}! +${bx} XP`,"good"); CTX=c0; } } P.tally.wk=P.tally.wk||{}; const wc=KCLS||"explosive"; P.tally.wk[wc]=(P.tally.wk[wc]|0)+1; }
    if(e.kind!=="player"&&isPid(s,ATK)) gainXP(s,ATK,(e.kind==="husk"?(XP_KILL[e.type||"husk"]||6):e.kind==="bot"?10:18)*(e.mut?2:1));
    if(e.kind==="raider"){ const C=crewOf(s,e), m=crewMates(s,e)[0]; e.surr=false;
      if(anyPlayerSees(s,e.x,e.y)) say(s,`${e.name} of the ${FACTIONS[e.fac].name} goes down. Search the body with F.`,isPid(s,ATK)?"good":"info");
      if(m) rsay(s,m,"ally_down",{n:e.name},true); if(ATK&&s.ents.some(q=>q.id===ATK&&q.kind==="raider")){ const k=s.ents.find(q=>q.id===ATK); if(k&&k.alive) rsay(s,k,"kill"); }
      if(C&&isPid(s,ATK)){ setAtt(s,e.crew,"hostile"); addRep(s,e.fac,C.hired?-15:-12); s.kills[e.fac]=(s.kills[e.fac]||0)+1; for(const [f2,F2] of Object.entries(FACTIONS)) if(F2.foes.includes(e.fac)) addRep(s,f2,3); } }
    else if(e.kind==="bot"&&e.type==="custodian"){ fx(s,{type:"explode",x:e.x,y:e.y,big:1}); for(const c of ["weapon","armor","val","val","throw"]) spawnItem(s,Items.roll(()=>rand(s),4,c),e.x,e.y); spawnItem(s,{d:"core",r:0,n:3},e.x,e.y); spawnItem(s,{d:"custcore",r:0},e.x,e.y); s.marks=[]; if(isPid(s,ATK)){ const P=s.ents.find(q=>q.id===ATK); P.tally=P.tally||{}; P.tally.k=P.tally.k||{}; P.tally.k.custodian=(P.tally.k.custodian|0)+1; gainXP(s,ATK,140); } say(s,"The Custodian staggers, sparks pouring from its chest, and crashes to the deck. Its eye dims to nothing.","good"); }
    else if(e.kind==="bot"){ fx(s,{type:"explode",x:e.x,y:e.y,small:1}); spawnItem(s,{d:chance(s,.5)?"circ":"parts",r:0,n:1},e.x,e.y); if(anyPlayerSees(s,e.x,e.y)) say(s,`The ${e.name} sparks, shudders and dies.`,"good"); }
    else { const T0=HT(e);
      if(e.type==="bloater"){ s.gas=s.gas||[]; for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){ if(Math.hypot(dx,dy)>2.2) continue; const i=idx(s,e.x+dx,e.y+dy), t=s.tiles[i]; if(t&&(walk(t)||t.t==="door"&&t.open)&&!s.gas.includes(i)) s.gas.push(i); } s.gasEnd=Math.max(s.gasEnd|0,s.turn+20); fx(s,{type:"explode",x:e.x,y:e.y,small:1}); if(anyPlayerSees(s,e.x,e.y)) say(s,"The bloater ruptures with a wet bang. A cloud of green rot rolls out. Don't breathe it.","warn"); }
      if(e.type==="nest"){ spawnItem(s,{d:"mutagen",r:0},e.x,e.y); spawnItem(s,Items.roll(()=>rand(s),(s.tierN|0)+1,pickS(s,["val","weapon","med","armor"])),e.x,e.y); if(anyPlayerSees(s,e.x,e.y)) say(s,"The nest ruptures in a gush of black fluid. Whatever was growing in it won't hatch now.","good"); fx(s,{type:"roar",x:e.x,y:e.y}); return; }
      if(e.mut){ spawnItem(s,{d:"mutagen",r:0},e.x,e.y); if(chance(s,.6)) spawnItem(s,Items.roll(()=>rand(s),2,pickS(s,["val","ammo","med","weapon"])),e.x,e.y);
        if(e.mut==="volatile"){ if(anyPlayerSees(s,e.x,e.y)) say(s,"The volatile husk's swollen body ruptures in a spray of burning gas!","warn"); const k0=KCLS; KCLS="explosive"; blast(s,e.x,e.y,{r:1.6,dmg:[8,16]}); KCLS=k0; } }
      if(e.type==="matriarch"){ for(const c of ["val","val","weapon","armor"]) spawnItem(s,Items.roll(()=>rand(s),3,c),e.x,e.y); spawnItem(s,{d:"core",r:0,n:2},e.x,e.y); say(s,"The Matriarch crashes to the deck. The whole station seems to exhale.","good"); fx(s,{type:"roar",x:e.x,y:e.y}); }
      else { if(chance(s,e.type==="brute"?.8:.35)) spawnItem(s,Items.roll(()=>rand(s),1,e.type==="spitter"?"mat":chance(s,.7)?"ammo":"mat"),e.x,e.y);
        if(anyPlayerSees(s,e.x,e.y)) say(s,`The ${T0.name} collapses. ${cause==="vacuum"?"Its lungs gave out.":""}`.trim(),"good"); } }
  }

  // ---------- player actions ----------
  function act(s,pid,a){
    if(s.status!=="playing") return false;
    const p=s.ents.find(e=>e.id===pid);
    if(p&&p.alive&&s.mode==="raid"&&(a.type==="talk"||a.type==="loot")&&!p.downed){ s.fx=[]; CTX=p.id; ATK=null; return a.type==="talk"?doTalk(s,p,a.text):doLoot(s,p,a); }
    if(!p||!p.alive||p.acted||p.downed) return false;
    s.fx=[]; CTX=p.id; ATK=p.id; KCLS=null;
    let ok=false, slow=false;
    if(s.mode==="ship"){ // crew move freely aboard; no turns, no hazards
      if(a.type==="move"){ const r=!!doMove(s,p,a.dx,a.dy); petTick(s); return r; }
      if(a.type==="interact") return doInteract(s,p);
      return false;
    }
    // free actions: no turn spent
    if(a.type==="swap"){ const other=p.act===1?2:1; if(!(other===1?p.w1:p.w2)){ say(s,"You only have one gun.","info"); return false; } p.act=other; say(s,`You switch to the ${nm(gun(p))}.`,"info"); return true; }
    if(a.type==="equip") return doEquip(s,p,a.index,a.slot);
    if(a.type==="unequip") return doUnequip(s,p,a.slot);
    if(a.type==="light"){ if(!p.light){ say(s,"You don't have a light equipped.","info"); return false; } p.lightOff=!p.lightOff; say(s,p.lightOff?"You switch your light off. The dark closes in.":"You click your light on.","info"); return true; }
    if(a.type==="drop") return doDrop(s,p,a.index);
    if(a.type==="sneak"){ p.sneak=!p.sneak; p.snk=0; say(s,p.sneak?"You drop low and slow your breathing. Husks and raiders have to be closer to spot you, but you move slower.":"You straighten up and move at a normal pace.","info"); fx(s,{type:"sneak",id:p.id,on:p.sneak?1:0}); return true; }
    if(a.type==="secure"){ const it=p.inv[a.index|0]; if(!it) return false; if(it.sec){ delete it.sec; say(s,`You take the ${nm(it)} out of your secure pouch.`,"info"); return true; }
      const n=p.inv.filter(q=>q.sec).length; if(n>=(p.secCap|0)){ say(s,`Your secure pouch is full (${p.secCap} slot${p.secCap===1?"":"s"}).`,"warn"); return false; } it.sec=1; say(s,`You seal the ${nm(it)} in your secure pouch. It comes home even if you don't.`,"good"); return true; }
    if(a.type==="talk") return doTalk(s,p,a.text);
    if(a.type==="loot") return doLoot(s,p,a);
    switch(a.type){
      case "move": { const r=doMove(s,p,a.dx,a.dy); ok=!!r; slow=r==="walked"&&crippled(p); break; }
      case "wait": ok=true; break;
      case "shoot": ok=doShoot(s,p,a.x,a.y); break;
      case "melee": ok=doStrike(s,p,a.x,a.y); break;
      case "hack": ok=doHack(s,p,a.opt); break;
      case "interact": ok=doInteract(s,p); break;
      case "pickup": ok=doPickup(s,p); break;
      case "use": ok=doUse(s,p,a.index); break;
      case "give": ok=doGive(s,p,a.index,a.to); break;
      case "throw": ok=doThrow(s,p,a.index,a.x,a.y); break;
      case "extract": ok=doExtract(s,p); break;
      case "abandon": p.alive=false; p.flags.abandoned=1; s.cause=s.cause||null; p.cause="You abandoned the contract and left your kit behind."; say(s,"You abandon the contract and seal yourself in the shuttle.","bad"); ok=true; if(players(s).every(q=>!q.alive)) s.status="ended"; break;
    }
    if(!ok) return false;
    p.acted=true; if(a.type==="move"&&p.sneak&&ok&&p.alive){ p.snk=(p.snk|0)^1; if(!p.snk&&!slow) p.busy=Math.max(p.busy,1); }
    if(slow){ p.busy=1; if(!p.flags.limp){p.flags.limp=1; say(s,"You drag your ruined leg. Moving takes twice as long.","warn");} }
    while(s.status==="playing"&&players(s).every(q=>!q.alive||q.acted||q.downed)){
      CTX=null; ATK=null;
      endTurn(s);
      for(const q of players(s)){ q.acted=false; if(q.busy>0&&q.alive){ q.busy--; q.acted=true; } }
    }
    return true;
  }

  function doMove(s,p,dx,dy){
    face(p,dx,dy);
    const x=p.x+dx,y=p.y+dy, t=tileAt(s,x,y), o=entAt(s,x,y);
    if(o&&o.kind==="pet"){ o.x=p.x; o.y=p.y; p.x=x; p.y=y; return "walked"; }
    if(o&&(o.kind==="husk"||o.kind==="bot")) return melee(s,p,o);
    if(o&&o.kind==="raider"){ const C=crewOf(s,o); if(C&&C.att==="hostile"&&!o.surr) return melee(s,p,o); say(s,o.surr?`${o.name} flinches, hands up. Press F to search them.`:`${o.name} doesn't budge. "Watch it."`,"info"); return false; }
    if(o) return false;
    if(t.t==="door"&&!t.open) return tryDoor(s,p,t,x,y);
    if(t.t==="window"){ say(s,"Reinforced glass. Beyond it, nothing but stars.","info"); return false; }
    if(t.t==="terminal"){ fx(s,{type:"terminal",kind:t.kind,pid:p.id}); return false; }
    if(s.mode==="ship"&&t.t==="prop"){ fx(s,{type:"flavor",kind:t.kind,pid:p.id,x,y}); return false; }
    if(t.t==="console"){ say(s,"Main power relay. Press F next to it to toggle station power.","info"); return false; }
    if(t.t==="prop"&&t.kind==="barrel"){ say(s,"A fuel drum. It sloshes. One good shot would light it up.","warn"); return false; }
    if(t.t==="prop"){ say(s,{crate:"A sealed cargo crate. Too heavy to move.",bed:"A bunk, sheets stiff with old blood.",desk:"A desk buried in damp printouts.",locker:"A dented locker. Someone clawed at it from inside.",barrel:"A fuel drum. It sloshes.",brazier:"Someone lit a fire in here. Recently.",generator:"A backup generator, ticking as it cools.",tank:"A specimen tank. Something inside turns to watch you."}[t.kind]||"It's in the way.","info"); return false; }
    if(!walk(t)) return false;
    { const T=trapAt(s,x,y); if(T&&T.seen[p.id]){ say(s,"There's a tripwire there. Press F next to it to disarm it, or go around.","warn"); return false; } }
    if(mineAt(s,x,y)){ say(s,"A tripmine sits there. Press F next to it to pick it up.","info"); return false; }
    p.x=x; p.y=y;
    { const T=trapAt(s,x,y); if(T){ say(s,"Your boot catches on something taut.","bad"); springTrap(s,T,false); if(!p.alive) return "walked"; } }
    if(tileAt(s,x,y).vent&&!p.flags.ventTip){ p.flags.ventTip=1; say(s,"A maintenance vent. Press F to crawl through it to wherever it comes out.","info"); }
    if(t.t==="seat"){ p.face=[0,-1]; fx(s,{type:"sit",kind:t.kind,pid:p.id,x,y}); }
    if(s.fire[idx(s,x,y)]) say(s,"You step into the flames!","bad");
    const here=s.items.filter(i=>i.x===x&&i.y===y);
    if(here.length) say(s,`You see here: ${here.map(i=>i.name).join(", ")}. (G to pick up)`,"info");
    const rn=roomName(x,y); if(rn!==p.flags.room){ p.flags.room=rn; }
    if(t.t==="extract"&&!p.flags.padTip){ p.flags.padTip=1; say(s,"You're on the shuttle pad. Press Q to extract.","good"); }
    return "walked";
  }
  function tryDoor(s,p,t,x,y){
    if(t.sealed){ say(s,"Welded shut. A welding torch would cut it, or a breaching charge would take it off.","warn"); return false; }
    if(t.broken){ t.open=true; return true; }
    if(t.locked){
      if(s.power){
        if(p.inv.some(i=>i.d==="keycard")){ t.locked=false; t.open=true; say(s,"The keycard reader blinks green. The vault door grinds open.","good"); return true; }
        say(s,"ACCESS DENIED. The maglock is powered. A keycard, or no power at all, would get you in.","warn"); return false;
      }
    } else if(s.power){ t.open=true; fx(s,{type:"door",x,y}); say(s,"The door hisses open.","info"); return true; }
    // unpowered: force it
    const MS=ST(p.melee); t.pry+=MS&&MS.pry?3:1; noise(s,x,y,5); fx(s,{type:"bash",x,y});
    if(t.pry>=3){ t.open=true; t.locked=false; t.pry=0; say(s,"You wrench the dead door open.","info"); }
    else say(s,`You brace a pry bar in the seam and heave… (${t.pry}/3)`,"info");
    return true;
  }
  // an enemy that hasn't noticed you, struck from behind, dies quietly
  function unaware(s,h,p){ if(h.kind==="husk") return h.type!=="matriarch"&&h.type!=="nest"&&(!h.aware||(p.sneak&&!h.last&&!huskSees(s,h,p))); if(h.kind==="raider") return !h.last&&!(crewOf(s,h)&&crewOf(s,h).att==="hostile"&&rSees(s,h,p)); return false; }
  function behind(h,p){ const f=h.face||[0,1]; return f[0]*(p.x-h.x)+f[1]*(p.y-h.y)<=0; }
  function melee(s,p,h){
    if(p.kind==="player"&&(h.kind==="husk"||h.kind==="raider")&&unaware(s,h,p)&&behind(h,p)){ KCLS="melee"; face(p,h.x-p.x,h.y-p.y); fx(s,{type:"takedown",x:h.x,y:h.y,id:p.id});
      const wn=p.melee?nm(p.melee).toLowerCase():"bare hands", d=(ST(p.melee)||WRENCH).dmg[1]*4+10;
      say(s,h.kind==="husk"?`You come up behind the ${HT(h).name} and drive your ${wn} into the base of its skull.`:`You grab ${h.name} from behind. Your ${wn} does the rest.`,"good");
      p.tally=p.tally||{}; p.tally.takedowns=(p.tally.takedowns|0)+1; gainXP(s,p.id,10);
      damage(s,h,"head",d,.6,"Silenced from behind."); if(h.alive) damage(s,h,"torso",d,.6,"Silenced from behind."); return true; }
    KCLS="melee"; const st=ST(p.melee)||WRENCH, pen=(p.hp.rarm<=0?.3:0)+(p.hp.larm<=0?.1:0), wn=p.melee?nm(p.melee):(gun(p)?"gun butt":"fists"), mb=p.mast?(p.mast.melee|0):0;
    fx(s,{type:"melee",x:h.x,y:h.y,id:p.id});
    const strike=(t)=>{ if(chance(s,.82+(st.acc||0)-pen)){ const l=pickLimb(s), d=ri(s,st.dmg[0],st.dmg[1])+mb; say(s,`You hit ${t.kind==="raider"?t.name+"'s":label(t)+"'s"} ${LNAME[l]} with your ${wn}.`,"info"); damage(s,t,l,d,st.bleed??.25,"beaten"); if(st.stun&&t.alive) t.stun=Math.max(t.stun|0,st.stun); return true; } say(s,`Your ${wn} swing misses.`,"info"); return false; };
    strike(h);
    if(st.cleave) for(const [dx,dy] of N4){ const o=entAt(s,p.x+dx,p.y+dy); if(o&&o!==h&&o.kind==="husk") strike(o); }
    if(h.kind==="husk"){ h.aware=true; h.last={x:p.x,y:p.y}; } else h.last={x:p.x,y:p.y};
    return true;
  }
  function doStrike(s,p,tx,ty){ const t=entAt(s,tx,ty); if(!t||t===p||Math.max(Math.abs(tx-p.x),Math.abs(ty-p.y))!==1){ say(s,"Nothing in reach to hit.","info"); return false; }
    if(t.kind==="player"){ say(s,"That's your crewmate.","info"); return false; } if(t.kind==="raider"&&t.surr){ say(s,`${t.name} has their hands up.`,"info"); return false; }
    face(p,tx-p.x,ty-p.y); return melee(s,p,t); }
  function doHack(s,p,opt){ if(s.mode!=="raid") return false; const near=[p.face||[0,-1],...N4].some(([dx,dy])=>{ const t=tileAt(s,p.x+dx,p.y+dy); return t.t==="prop"&&t.kind==="desk"; });
    if(!near){ say(s,"You need to be at a terminal.","info"); return false; } s.hacked=s.hacked||{}; if(s.hacked[opt]){ say(s,"Already done from this station's network.","info"); return false; }
    if(!s.power&&opt!=="map"){ say(s,"No power: the security network is dead. Only the cached map is readable.","warn"); return false; }
    s.hacked[opt]=1; p.busy=Math.max(p.busy,1); p.tally=p.tally||{}; p.tally.hacks=(p.tally.hacks|0)+1; gainXP(s,p.id,4); fx(s,{type:"robot",x:p.x,y:p.y});
    if(opt==="map"){ for(const q of players(s)) for(let i=0;i<s.tiles.length;i++) if(s.tiles[i].t!=="space") q.seen[i]=1; say(s,"You pull the station schematics off the terminal. Every deck is on your map now.","good"); }
    else if(opt==="turrets"){ let n=0; for(const b of s.ents) if(b.kind==="bot"&&b.alive&&b.type!=="custodian"&&!(b.owner&&String(b.owner).startsWith("p:"))){ b.hackedOff=true; b.off=1; n++; } say(s,n?`Security override accepted. ${n} turret${n>1?"s and drones":""} shut down.`:"No security units on this network.","good"); }
    else if(opt==="vault"){ let n=0; for(const t of s.tiles) if(t.t==="door"&&t.locked){ t.locked=false; n++; } say(s,n?"Maglocks released. The vault door's status light turns green.":"No maglocks on this network.","good"); }
    else return false;
    return true; }
  function hitChance(s,p,tx,ty){
    const st=ST(gun(p))||{acc:0,fall:.035}, d=Math.hypot(tx-p.x,ty-p.y);
    const G=gearOf(p); let c=.9+(st.acc||0)+G.acc-(st.fall??.035)*d; if(p.food!=null&&(p.food<8||p.water<8)) c-=.05;
    if(st.close&&d<3) c-=st.close;
    c-= p.hp.rarm<=0?.35:(1-p.hp.rarm/p.max.rarm)*.15;
    if(p.perks) c+=.04*(p.perks.marksman|0); if(p.mast&&st.cls) c+=.025*(p.mast[st.cls]|0); if(p.imp&&p.imp.reflex) c+=.04; if(p.coffee&&s.turn<=80) c+=.03; if(p.frac){ if(p.frac.rarm) c-=.12; if(p.frac.larm) c-=.06; } if((p.inf|0)>=25) c-=.08;
    c-= p.hp.larm<=0?.12:0;
    if(p.blood<50) c-=.15;
    if(!s.power&&d>3&&!st.dark&&!G.dark) c-=.1;
    return Math.max(.05,Math.min(.95,c));
  }
  function doShoot(s,p,tx,ty){
    if(tx===p.x&&ty===p.y) return false;
    const w=gun(p); if(!w){ say(s,"No gun in hand. Bump into husks to use your melee weapon.","warn"); return false; }
    const st=ST(w);
    if(!canSee(s,p,tx,ty)){ say(s,"You can't see that spot.","info"); return false; }
    const t=tileAt(s,tx,ty), target=entAt(s,tx,ty), barrel=t.t==="prop"&&t.kind==="barrel";
    if(!target&&t.t!=="window"&&!barrel&&st.cls!=="launcher"){ say(s,"Nothing worth a bullet there.","info"); return false; }
    const close=target&&target!==p&&Math.max(Math.abs(tx-p.x),Math.abs(ty-p.y))===1&&target.kind!=="player"&&!(target.kind==="raider"&&target.surr);
    if(close&&((p.ammo[st.ammo]|0)<=0||st.cls==="sniper"||st.cls==="launcher")){ say(s,(p.ammo[st.ammo]|0)<=0?"Out of ammo. You lash out up close instead.":"Too close to aim that. You strike instead.","info"); face(p,tx-p.x,ty-p.y); return melee(s,p,target); }
    if((p.ammo[st.ammo]|0)<=0){ say(s,`*click* Out of ${Items.AMMO[st.ammo].name.toLowerCase()}.`,"warn"); return false; }
    face(p,tx-p.x,ty-p.y); noise(s,p.x,p.y,Math.max(4,(st.cls==="sniper"||st.cls==="launcher"?14:st.cls==="shotgun"?11:10)-2*((p.perks&&p.perks.ghost)|0)-(st.quiet|0)));
    const shots=Math.min(st.burst||1,p.ammo[st.ammo]);
    for(let k=0;k<shots;k++){ p.ammo[st.ammo]--; fireOne(s,p,tx,ty,st,target); if(target&&!target.alive) break; }
    if(st.bolt){ p.busy=Math.max(p.busy,1); say(s,"You work the bolt.","info"); }
    if(p.ammo[st.ammo]===0) say(s,`That was your last ${Items.AMMO[st.ammo].name.toLowerCase().replace(/s$/,"")}.`,"warn");
    return true;
  }
  function fireOne(s,p,tx,ty,st,target){ SPEC=null; if(p.spec&&p.spec.n>0&&st.cls!=="launcher"){ SPEC=p.spec.t; p.spec.n--; if(p.spec.n<=0){ say(s,`That was your last ${SPEC_N[p.spec.t]} round. Back to standard ammo.`,"warn"); p.spec=null; } } try{ return fireOne0(s,p,tx,ty,st,target); } finally { SPEC=null; } }
  const SPEC_N={ap:"armour-piercing",inc:"incendiary",hp:"hollow-point"};
  function fireOne0(s,p,tx,ty,st,target){ KCLS=st.cls||"rifle"; const mx=p.mast&&(p.mast[st.cls]|0)>=5?1.15:1;
    if(st.cls==="launcher"){ let at=[tx,ty], prev=[p.x,p.y];
      for(const [x,y] of line(p.x,p.y,tx,ty)){ const tt=tileAt(s,x,y);
        if(tt.t==="window"){ hitWindow(s,x,y,tt,true); at=prev; break; } if(!clear(tt)||(tt.t==="prop"&&tt.kind==="barrel")){ at=tt.t==="prop"?[x,y]:prev; break; }
        const e=entAt(s,x,y); if(e&&e!==p){ at=[x,y]; break; } prev=[x,y]; }
      fx(s,{type:"shot",x0:p.x,y0:p.y,x1:at[0],y1:at[1],what:"rocket"}); say(s,"The rocket streaks away and detonates!","warn");
      blast(s,at[0],at[1],{r:st.blast,dmg:st.dmg,fire:st.fire}); return; }
    const pts=line(p.x,p.y,tx,ty,6), hc=target?hitChance(s,p,tx,ty):1;
    let imp=[tx,ty], what="none", pierced=0;
    for(const [x,y] of pts){
      if(!inb(s,x,y)) break;
      const tt=tileAt(s,x,y); imp=[x,y];
      if(tt.t==="prop"&&tt.kind==="barrel"&&((x===tx&&y===ty)||chance(s,.25))){ fx(s,{type:"shot",x0:p.x,y0:p.y,x1:x,y1:y,what:"wall"}); explode(s,x,y); return; }
      if(tt.t==="window"){ what="glass"; fx(s,{type:"shot",x0:p.x,y0:p.y,x1:x,y1:y,what}); hitWindow(s,x,y,tt,!(x===tx&&y===ty)); return; }
      if(!clear(tt)){ what="wall"; say(s,target?"Your shot goes wide and sparks off the bulkhead.":"The round flattens against the bulkhead.","info"); break; }
      const e=entAt(s,x,y);
      if(e&&e!==p){
        const isT=e===target, pel=st.pellets||1; let hits=0;
        for(let q=0;q<pel&&e.alive;q++){ if(isT?chance(s,hc):chance(s,.3)){ hits++; const l=st.head&&chance(s,st.head)?"head":pickLimb(s); damage(s,e,l,Math.round(ri(s,st.dmg[0],st.dmg[1])*mx),st.bleed??.55,"shot"); } }
        if(hits){ what="flesh"; fx(s,{type:"shot",x0:p.x,y0:p.y,x1:x,y1:y,what}); if(SPEC==="inc"&&chance(s,.4)){ const fi=idx(s,x,y); s.fire[fi]=Math.max(s.fire[fi]|0,2); s.fuel[fi]=Math.max(s.fuel[fi]|0,6); }
          say(s, e.kind==="raider"||e.kind==="player"?`Your round hits ${e.name}!`:pel>1?`${hits} of ${pel} pellets tear into ${label(e)}.`:`You hit ${label(e)}.`, "good");
          if(e.kind==="husk"){ e.aware=true; e.last={x:p.x,y:p.y}; if(st.stun&&e.alive) e.stun=Math.max(e.stun|0,st.stun);
            if(st.knock&&e.alive){ const dx=Math.sign(e.x-p.x), dy=Math.sign(e.y-p.y), nx=e.x+(Math.abs(e.x-p.x)>=Math.abs(e.y-p.y)?dx:0), ny=e.y+(Math.abs(e.x-p.x)<Math.abs(e.y-p.y)?dy:0); if(walk(tileAt(s,nx,ny))&&!entAt(s,nx,ny)){ e.x=nx; e.y=ny; } } }
          if(st.pierce&&pierced++<1) continue; return; }
        if(isT) say(s,`Your shot misses ${label(e)}.`,"info");
      }
    }
    fx(s,{type:"shot",x0:p.x,y0:p.y,x1:imp[0],y1:imp[1],what});
  }
  // generic explosion: rockets and grenades (fuel drums use explode())
  function blast(s,x0,y0,o){
    const r=o.r||1.4; fx(s,{type:"explode",x:x0,y:y0}); noise(s,x0,y0,14); const drums=[];
    if(o.pull) for(const h of s.ents) if(h.alive&&h.kind==="husk"&&Math.hypot(h.x-x0,h.y-y0)<=r+2){ const dx=Math.sign(x0-h.x), dy=Math.sign(y0-h.y); for(const [mx,my] of [[dx,0],[0,dy]]){ if(!mx&&!my) continue; const nx=h.x+mx, ny=h.y+my; if(walk(tileAt(s,nx,ny))&&!entAt(s,nx,ny)){ h.x=nx; h.y=ny; break; } } }
    const R=Math.ceil(r);
    for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){ const x=x0+dx, y=y0+dy, d=Math.hypot(dx,dy); if(d>r||!inb(s,x,y)) continue; if(d>1.5&&!los(s,x0,y0,x,y)) continue;
      const j=idx(s,x,y), tj=s.tiles[j];
      if(tj.t==="prop"&&tj.kind==="barrel"){ drums.push([x,y]); continue; }
      if(tj.t==="window"&&chance(s,d<=1.5?.8:.4)) hitWindow(s,x,y,tj,true);
      if(gas(tj)){ s.scorch[j]=1; if(o.fire&&s.fuel[j]>0&&!s.fire[j]&&chance(s,d<=1.5?.85:.5)) s.fire[j]=2; }
      const e=entAt(s,x,y);
      if(e){ if(o.dmg){ const hits=d<=1.2?2:1, fr=e.kind==="player"?gearOf(e).fire*.5:0; for(let k=0;k<hits&&e.alive;k++){ const l=pickLimb(s), dd=Math.max(1,Math.round(ri(s,o.dmg[0],o.dmg[1])*(d<=1.2?1:.6)*(1-fr))); damage(s,e,l,dd,.4,"Caught in a blast."); injure(s,e,l,dd,{frac:.25}); } }
        if(o.stun&&e.kind==="husk"&&e.alive) e.stun=Math.max(e.stun|0,o.stun); }
    }
    for(const [x,y] of drums) explode(s,x,y);
  }
  function hitWindow(s,x,y,t,stray){
    t.hp--;
    fx(s,{type:t.hp>0?"glass":"breach",x,y});
    if(t.hp>0) say(s, stray?"A stray round cracks a window behind your target!":"The window spiderwebs with cracks.","warn");
    else { t.t="breach"; say(s,"The window SHATTERS. Explosive decompression!","bad"); s.P[idx(s,x,y)]=0; }
  }
  function doGive(s,p,i,to){
    const q=s.ents.find(e=>e.id===to&&e.kind==="player"&&e.alive); const it=p.inv[i];
    if(!q||!it||Math.abs(q.x-p.x)+Math.abs(q.y-p.y)!==1){ say(s,"Stand next to a crewmate to hand something over.","info"); return false; }
    if(q.inv.length>=q.cap){ say(s,"Their pack is full.","warn"); return false; }
    p.inv.splice(i,1); q.inv.push(it); say(s,`You hand over the ${nm(it)}.`,"good"); return true;
  }
  function doThrow(s,p,i,x,y){
    const it=p.inv[i]; if(!it||K(it)!=="throw") return false;
    const d=Math.hypot(x-p.x,y-p.y); if(d>6.5){ say(s,"Too far to throw. Six tiles at most.","info"); return false; }
    if(!(los(s,p.x,p.y,x,y)&&clear(tileAt(s,x,y)))&&!(x===p.x&&y===p.y)){ say(s,"No clear throw to that spot.","info"); return false; }
    const st=ST(it); p.inv.splice(i,1); face(p,x-p.x,y-p.y);
    fx(s,{type:"throw",x0:p.x,y0:p.y,x1:x,y1:y,d:it.d}); say(s,`You throw the ${nm(it)}.`,"warn");
    if(st.smoke){ s.smoke=s.smoke||{}; const R=Math.ceil(st.smoke); let n=0; for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){ const xx=x+dx, yy=y+dy; if(Math.hypot(dx,dy)>st.smoke||!inb(s,xx,yy)) continue; const t=tileAt(s,xx,yy); if(t.t==="wall"||t.t==="space"||t.t==="window") continue; s.smoke[idx(s,xx,yy)]=8; n++; }
      for(const h of s.ents) if((h.kind==="husk"||h.kind==="raider")&&h.alive&&h.last&&Math.hypot(h.last.x-x,h.last.y-y)<=4){ h.last=null; if(h.kind==="husk") h.search=3; }
      fx(s,{type:"smoke",x,y}); say(s,"The canister hisses and the corridor vanishes in thick grey smoke.","good"); return true; }
    if(st.noise){ for(const h of s.ents) if(h.kind==="husk"&&h.alive&&Math.hypot(h.x-x,h.y-y)<=st.noise){ h.aware=true; h.last={x,y}; } fx(s,{type:"decoy",x,y}); say(s,"The noisemaker shrieks. Every husk in earshot turns toward it.","good"); return true; }
    if(st.stunr&&!st.blast){ let n=0; for(const h of s.ents) if(h.kind==="husk"&&h.alive&&Math.hypot(h.x-x,h.y-y)<=st.stunr){ h.stun=Math.max(h.stun|0,st.stun); n++; } fx(s,{type:"flare",x,y}); say(s,n?`A flash and a bang. ${n} husk${n>1?"s":""} reel, stunned.`:"A flash and a bang. Nothing caught in it.","good"); return true; }
    if(st.blast) { blast(s,x,y,{r:st.blast,dmg:st.dmg,fire:st.fire,stun:st.stun,pull:st.pull}); return true; }
    if(st.fire){ const R=Math.ceil(st.fire); for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){ const xx=x+dx, yy=y+dy; if(Math.hypot(dx,dy)>st.fire||!inb(s,xx,yy)) continue; const j=idx(s,xx,yy); if(gas(s.tiles[j])){ s.fire[j]=2; s.fuel[j]=Math.max(s.fuel[j],5); const e=entAt(s,xx,yy); if(e) damage(s,e,pickLimb(s),ri(s,st.dmg[0],st.dmg[1]),0,"Burned alive."); } }
      fx(s,{type:"flare",x,y}); say(s,"Fire splashes across the deck.","warn"); return true; }
    return true;
  }
  const EQ_SLOTS=["w1","w2","melee","head","armor","legs","acc","light","pack"];
  function doUnequip(s,p,slot){
    if(!EQ_SLOTS.includes(slot)||!p[slot]) return false; const it=p[slot]; p[slot]=null; const cap=capOf(p);
    if(p.inv.length+1>cap){ p[slot]=it; say(s,"No room in your pack for that.","warn"); return false; }
    if(slot==="w1"&&p.act===1&&p.w2) p.act=2; if(slot==="w2"&&p.act===2) p.act=1;
    p.inv.push({...it,id:s.nextId++}); p.cap=cap; const G=gearOf(p); p.o2max=G.o2; p.o2=Math.min(p.o2,G.o2);
    say(s,`You stow the ${nm(it)}.`,"info"); return true; }
  function doEquip(s,p,i,pref){
    const it=p.inv[i], slot=it&&Items.slotOf(it); if(!slot){ return false; }
    let old=null; const prev={w1:p.w1,w2:p.w2,act:p.act,melee:p.melee,head:p.head,armor:p.armor,legs:p.legs,acc:p.acc,light:p.light,pack:p.pack};
    if(slot==="gun"&&(pref==="w1"||pref==="w2")){ old=p[pref]; p[pref]=it; p.act=pref==="w1"?1:2; }
    else if(slot==="gun"){ if(!p.w1){ p.w1=it; p.act=1; } else if(!p.w2){ p.w2=it; p.act=2; } else if(p.act===2){ old=p.w2; p.w2=it; } else { old=p.w1; p.w1=it; } }
    else { old=p[slot]; p[slot]=it; }
    const cap=capOf(p), after=p.inv.length-1+(old?1:0);
    if(after>cap){ Object.assign(p,prev); say(s,"Too much in your pack to change into that.","warn"); return false; }
    p.cap=cap; const G=gearOf(p); p.o2max=G.o2; p.o2=Math.min(p.o2,G.o2);
    p.inv.splice(i,1); if(old){ const o={...old,id:s.nextId++}; p.inv.splice(i,0,o); }
    say(s,`You ${Items.kind(it)==="armor"?"put on":"equip"} the ${nm(it)}.`,"good"); return true;
  }
  function doDrop(s,p,i){ const it=p.inv[i]; if(!it) return false; p.inv.splice(i,1); spawnItem(s,{...it,id:undefined},p.x,p.y); say(s,`You drop the ${nm(it)}.`,"info"); return true; }
  function doRevive(s,p,q){
    q.downed=false; q.downT=0; q.hp.torso=Math.max(q.hp.torso,12); q.hp.head=Math.max(q.hp.head,6); delete q.bleed.torso; delete q.bleed.head; q.blood=Math.max(q.blood,30);
    say(s,"You haul your crewmate back to their feet.","good"); fx(s,{type:"revive",id:q.id,x:q.x,y:q.y}); return true;
  }
  function doInteract(s,p){
    if(s.mode==="ship"){ const c=s.ents.find(e=>e.kind==="pet"&&Math.max(Math.abs(e.x-p.x),Math.abs(e.y-p.y))<=1); if(c){ face(p,Math.sign(c.x-p.x),Math.sign(c.y-p.y)); c.sit=4; fx(s,{type:"pet",id:c.id,pid:p.id,x:c.x,y:c.y}); return true; } }
    if(s.mode==="raid"){ for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ const x=p.x+dx,y=p.y+dy, T=trapAt(s,x,y), M=mineAt(s,x,y);
        if(T&&T.seen[p.id]&&(dx||dy)){ s.traps=s.traps.filter(q=>q!==T); p.busy=Math.max(p.busy,1); face(p,dx,dy); fx(s,{type:"disarm",x,y,pid:p.id}); p.tally=p.tally||{}; p.tally.disarms=(p.tally.disarms|0)+1; gainXP(s,p.id,8);
          const it={d:"tripmine",r:0}; if(p.inv.length<p.cap) p.inv.push({...it,id:s.nextId++}); else spawnItem(s,it,p.x,p.y); say(s,"You pinch the wire, back the detonator out and pocket the charge. Tripmine recovered.","good"); return true; }
        if(M&&M.by===p.id&&(dx||dy)){ s.mines=s.mines.filter(q=>q!==M); face(p,dx,dy); const it={d:"tripmine",r:0}; if(p.inv.length<p.cap) p.inv.push({...it,id:s.nextId++}); else spawnItem(s,it,p.x,p.y); say(s,"You disarm your tripmine and pick it back up.","info"); return true; } }
      if(tileAt(s,p.x,p.y).vent) return crawl(s,p); }
    for(const [dx,dy] of N4){ const q=s.ents.find(e=>e.kind==="player"&&e.alive&&e.downed&&e.x===p.x+dx&&e.y===p.y+dy); if(q){ face(p,dx,dy); return doRevive(s,p,q); } }
    if(s.mode==="raid"){ const sv=s.ents.find(e=>e.kind==="raider"&&e.alive&&e.stranded&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)===1);
      if(sv){ sv.stranded=false; sv.prisoner=p.id; face(p,sv.x-p.x,sv.y-p.y); s.log.push({t:s.turn,msg:"Thank the void. Get me out of here, I'll stay right behind you.",kind:"chat",from:sv.id,who:sv.name,fac:sv.fac,att:"friendly",pid:null}); fx(s,{type:"speech",id:sv.id,x:sv.x,y:sv.y}); say(s,`${sv.name} falls in behind you. Get them to the shuttle alive.`,"good"); return true; } }
    if(s.mode==="raid"){ const b=s.ents.filter(e=>(e.kind==="raider"||e.kind==="remains")&&!e.extracted&&(!e.alive||e.surr)&&Math.max(Math.abs(e.x-p.x),Math.abs(e.y-p.y))<=1)
        .sort((a,b2)=>(a.alive?1:0)-(b2.alive?1:0)||(Math.abs(a.x-p.x)+Math.abs(a.y-p.y))-(Math.abs(b2.x-p.x)+Math.abs(b2.y-p.y)))[0];
      if(b){ face(p,b.x-p.x,b.y-p.y); fx(s,{type:"lootbody",id:b.id,pid:p.id}); return false; } }
    if(s.mode==="ship"&&tileAt(s,p.x,p.y).t==="seat"){ fx(s,{type:"terminal",kind:"navtable",pid:p.id}); return false; }
    for(const [dx,dy] of [p.face||[0,-1],...N4]){ const t=tileAt(s,p.x+dx,p.y+dy); if(t.t==="terminal"){ face(p,dx,dy); fx(s,{type:"terminal",kind:t.kind,pid:p.id}); return false; } }
    if(s.mode==="ship") for(const [dx,dy] of [p.face||[0,-1],...N4]){ const t=tileAt(s,p.x+dx,p.y+dy); if(t.t==="prop"){ face(p,dx,dy); fx(s,{type:"flavor",kind:t.kind,pid:p.id,x:p.x+dx,y:p.y+dy}); return false; } }
    // a security terminal (desk console): opens the hacking screen
    if(s.mode==="raid") for(const [dx,dy] of [p.face||[0,-1],...N4]){ const t=tileAt(s,p.x+dx,p.y+dy); if(t.t==="prop"&&t.kind==="desk"){ face(p,dx,dy); fx(s,{type:"hackterm",pid:p.id}); return false; } }
    // a loose wall panel hiding a cache
    if(s.mode==="raid") for(const [dx,dy] of [p.face||[0,-1],...N4]){ const x=p.x+dx,y=p.y+dy,t=tileAt(s,x,y); if(t.t==="wall"&&t.cache){ face(p,dx,dy); const got=t.cache; delete t.cache; t.pried=true; p.busy=Math.max(p.busy,1); noise(s,p.x,p.y,4); fx(s,{type:"search",x,y,kind:"panel"});
        for(const it of got) spawnItem(s,it,p.x,p.y); p.tally=p.tally||{}; p.tally.caches=(p.tally.caches|0)+1; gainXP(s,p.id,5);
        say(s,`You work the loose panel off the wall. Someone's stash: ${got.map(nm).join(", ")}. It's at your feet.`,"good"); return true; } }
    // search lockers, crates and the like
    for(const [dx,dy] of [p.face||[0,-1],...N4]){ const x=p.x+dx,y=p.y+dy,t=tileAt(s,x,y); if(t.t!=="prop"||!CONTAINERS.has(t.kind)||t.searched) continue;
      face(p,dx,dy); t.searched=true; gainXP(s,p.id,1); p.tally=p.tally||{}; p.tally.searches=(p.tally.searches|0)+1;
      if(p.perks&&p.perks.scavenger&&chance(s,.3*p.perks.scavenger)){ t.loot=t.loot||[]; t.loot.push(Items.roll(()=>rand(s),2,chance(s,.5)?"val":"any")); }
      const nm2={locker:"locker",crate:"crate",footlocker:"footlocker",ammocrate:"ammo crate",medcab:"medical cabinet",shelf:"shelf",strongbox:"strongbox",pallet:"pallet",gunrack:"gun rack",fridge:"cold locker"}[t.kind];
      if(t.kind==="strongbox"){ p.busy=Math.max(p.busy,1); noise(s,p.x,p.y,6); }
      const got=t.loot||[]; delete t.loot; fx(s,{type:"search",x,y,kind:t.kind});
      if(!got.length){ say(s,`You search the ${nm2}. Nothing worth taking.`,"info"); return true; }
      for(const it of got) spawnItem(s,it,p.x,p.y);
      say(s,`${t.kind==="strongbox"?"You crack the strongbox open":"You search the "+nm2}: ${got.map(i=>nm(i)).join(", ")}. It's at your feet.`,"good"); return true; }
    for(const [dx,dy] of N4){ const t=tileAt(s,p.x+dx,p.y+dy); const J=t.t==="console"&&(s.jobs||[]).find(q=>q.type==="sabotage"&&!q.done); if(J){ J.done=true; p.busy=Math.max(p.busy,2); noise(s,p.x,p.y,8); fx(s,{type:"robot",x:p.x+dx,y:p.y+dy});
        say(s,"You jack in and upload the worm. The relay screams static as the Choir's song stutters. Done. Now get out.","good"); for(const b of s.ents) if(b.kind==="bot"&&b.alive) b.seen={}; return true; } }
    for(const [dx,dy] of N4){ const t=tileAt(s,p.x+dx,p.y+dy); if(t.t==="console"){
      s.power=!s.power; fx(s,{type:"power"});
      say(s, s.power?"You slam the relay closed. Lights and door motors hum back to life.":"You pull the main breaker. The station goes dark. Doors are dead, maglocks released.", s.power?"good":"warn");
      return true; } }
    // prefer closing an open door
    for(const [dx,dy] of N4){ const x=p.x+dx,y=p.y+dy,t=tileAt(s,x,y);
      if(t.t==="door"&&t.open&&!t.broken){
        if(entAt(s,x,y)){ say(s,"Something is standing in the doorway.","warn"); return false; }
        if(!s.power){ say(s,"No power to the door motor, so you shove it closed by hand.","info"); }
        t.open=false; fx(s,{type:"door",x,y}); say(s,"The door seals shut.","info"); return true; } }
    for(const [dx,dy] of N4){ const x=p.x+dx,y=p.y+dy,t=tileAt(s,x,y); if(t.t==="door"&&!t.open) return tryDoor(s,p,t,x,y); }
    say(s,"Nothing to interact with here.","info"); return false;
  }
  function doPickup(s,p){
    const here=s.items.filter(i=>i.x===p.x&&i.y===p.y);
    if(!here.length){ say(s,"There's nothing here.","info"); return false; }
    for(const it of here){
      const k=K(it), D=Items.def(it.d);
      if(k==="ammo"){ p.ammo[D.ammo]=(p.ammo[D.ammo]|0)+(it.n|0); say(s,`You grab ${it.n} ${D.name.toLowerCase()}.`,"good"); }
      else if(k==="mat"){ p.mats[it.d]=(p.mats[it.d]|0)+(it.n||1); say(s,`You pocket ${nm(it).toLowerCase()}.`,"info"); }
      else if(p.inv.length>=p.cap){ say(s,`Your pack is full. ${nm(it)} stays on the deck.`,"warn"); continue; }
      else { const {x,y,...rest}=it; p.inv.push(rest); const r=Items.rarOf(it);
        say(s, r>=3?`${Items.RAR[r].name.toUpperCase()}: ${nm(it)}!`:`You take the ${nm(it)}${r?` [${Items.RAR[r].name}]`:""}.`, r>=2||k==="box"?"good":"info");
        if(r>=3) fx(s,{type:"legend",x:p.x,y:p.y,r}); }
      s.items=s.items.filter(i=>i!==it);
    }
    return true;
  }
  function doUse(s,p,i){
    const it=p.inv[i]; if(!it) return false; const k=K(it);
    if(Items.slotOf(it)) return doEquip(s,p,i);
    if(k==="throw"){ say(s,"Pick a spot to throw it at.","info"); return false; }
    if(k==="food"){ const D=ST(it); p.food=Math.max(0,Math.min(100,p.food+(D.food||0))); p.water=Math.max(0,Math.min(100,p.water+(D.water||0))); if(D.heal) p.blood=Math.min(100,p.blood+D.heal);
      p.inv.splice(i,1); say(s,D.water>(D.food||0)?`You drink the ${nm(it).toLowerCase()}.`:`You eat the ${nm(it).toLowerCase()}.`,"good"); return true; }
    const bleeding=LIMBS.filter(l=>p.bleed[l]);
    const MED=(p.perks&&p.perks.medic)|0;
    if(it.d==="bandage"){
      if(!bleeding.length){ say(s,"You're not bleeding.","info"); return false; }
      const l=bleeding.sort((a,b)=>(a==="torso"||a==="head"?-1:0)-(b==="torso"||b==="head"?-1:0))[0];
      delete p.bleed[l]; if(MED&&p.hp[l]>0) p.hp[l]=Math.min(p.max[l],p.hp[l]+8*MED); p.inv.splice(i,1); say(s,`You wrap your ${LNAME[l]} tight. The bleeding stops.`,"good"); return true;
    }
    if(it.d==="splint"){ const f=LIMBS.find(l=>p.frac&&p.frac[l]); if(!f){ say(s,"Nothing's broken.","info"); return false; } delete p.frac[f]; p.inv.splice(i,1); say(s,`You set your ${LNAME[f]} with a grunt and strap the splint on tight.`,"good"); return true; }
    if(it.d==="antibiotic"){ if(!p.inf){ say(s,"No infection to treat.","info"); return false; } p.inf=0; p.inv.splice(i,1); say(s,"You dry-swallow the antibiotics. The fever will break.","good"); return true; }
    if(it.d==="medkit"){
      p.bleed={}; for(const l of LIMBS) if(p.hp[l]>0) p.hp[l]=Math.min(p.max[l],p.hp[l]+18+10*MED);
      p.blood=Math.min(100,p.blood+15); p.inv.splice(i,1); say(s,"You jab a coagulant and staple your wounds shut.","good"); return true;
    }
    if(it.d==="o2"){ p.o2=Math.min(p.o2max,p.o2+50); p.inv.splice(i,1); say(s,"You clip the canister into your suit. +50 O₂.","air"); return true; }
    if(it.d==="stim"){ p.blood=Math.min(100,p.blood+(p.imp&&p.imp.adrenal?35:25)); p.stimT=p.imp&&p.imp.adrenal?15:10; p.inv.splice(i,1); say(s,"The stim hits like a hammer. Pain is a rumour for ten turns.","good"); return true; }
    if(it.d==="breach"){ const dirs=[p.face||[0,-1],...N4]; for(const [dx,dy] of dirs){ const x=p.x+dx,y=p.y+dy,t=tileAt(s,x,y); if(t.t==="door"&&!t.open){ s.charges=s.charges||[]; s.charges.push({x,y,t:2,by:p.id}); p.inv.splice(i,1); face(p,dx,dy); fx(s,{type:"plant",x,y}); say(s,"You slap the breaching charge on the door and step back. Two turns.","warn"); return true; } }
      say(s,"Face a closed door to plant a breaching charge.","info"); return false; }
    if(it.d==="sentry"){ const dirs=[p.face||[0,1],...N4,[1,1],[-1,1],[1,-1],[-1,-1]]; for(const [dx,dy] of dirs){ const x=p.x+dx,y=p.y+dy; if(free(s,x,y)){ const b=addBot(s,x,y,"turret","p:"+p.id); b.batt=30; b.name="field sentry"; b.face=[dx||1,0]; p.inv.splice(i,1); fx(s,{type:"robot",x,y}); say(s,"You thump the field sentry down. It unfolds, spins up and starts scanning. 30 turns of battery.","good"); return true; } }
      say(s,"No room to set the sentry down here.","info"); return false; }
    if(it.d==="apkit"||it.d==="inckit"||it.d==="hpkit"){ const g=gun(p); if(!g||ST(g).cls==="launcher"){ say(s,"Hold a gun to load special rounds into.","info"); return false; } const t=it.d==="apkit"?"ap":it.d==="inckit"?"inc":"hp"; p.spec={t,n:12}; p.inv.splice(i,1); fx(s,{type:"reload",x:p.x,y:p.y});
      say(s,`You thumb twelve ${SPEC_N[t]} rounds in. ${t==="ap"?"They punch through armour, plating and brute hide.":t==="inc"?"Every hit might set the target ablaze.":"Brutal on flesh, weak against armour."}`,"good"); return true; }
    if(it.d==="lazarus"){ say(s,"The Lazarus injector fires on its own when your heart stops. Just keep it on you.","info"); return false; }
    if(it.d==="tripmine"){ const dirs=[p.face||[0,1],...N4]; for(const [dx,dy] of dirs){ const x=p.x+dx,y=p.y+dy, t=tileAt(s,x,y); if((t.t==="floor"||t.t==="door"&&t.open)&&!entAt(s,x,y)&&!trapAt(s,x,y)&&!mineAt(s,x,y)&&!t.vent){ s.mines=s.mines||[]; s.mines.push({x,y,by:p.id,t:s.turn}); p.inv.splice(i,1); face(p,dx,dy); fx(s,{type:"plant",x,y}); say(s,"You set the tripmine and run the wire. It arms next turn. Your crew's suits won't trigger it.","good"); return true; } }
      say(s,"No clear deck in front of you to set it on.","info"); return false; }
    if(it.d==="weldtorch"){ const dirs=[p.face||[0,-1],...N4]; for(const [dx,dy] of dirs){ const x=p.x+dx,y=p.y+dy,t=tileAt(s,x,y); if(t.t!=="door"||t.vault||t.broken) continue;
        if(t.sealed){ t.sealed=false; t.hp=Math.min(t.hp,8); face(p,dx,dy); p.busy=Math.max(p.busy,1); fx(s,{type:"weld",x,y}); noise(s,p.x,p.y,5); say(s,"You cut through your own weld. The door's free again.","info"); return true; }
        if(t.open){ if(entAt(s,x,y)||s.items.some(q=>q.x===x&&q.y===y)){ say(s,"Something's in the doorway.","info"); return false; } t.open=false; }
        t.sealed=true; t.hp=Math.max(t.hp,26); face(p,dx,dy); p.busy=Math.max(p.busy,1); fx(s,{type:"weld",x,y}); noise(s,p.x,p.y,5); it.u=(it.u==null?3:it.u)-1;
        say(s,`You run a bead of white-hot metal down the seam. The door is welded shut.${it.u>0?` (${it.u} use${it.u>1?"s":""} left)`:" The torch sputters out, empty."}`,"good"); if(it.u<=0) p.inv.splice(i,1); return true; }
      say(s,"Face a door to weld it shut.","info"); return false; }
    if(it.d==="keycard"){ say(s,"Captain's keycard. Opens the vault while station power is on.","info"); return false; }
    say(s,`${nm(it)}. Worth about ${Items.value(it)} cr to the right buyer.`,"info"); return false;
  }
  // you can climb aboard from the pad or any tile touching it, so a crowd on the pad can't trap you
  function canExtract(s,p){ for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) if(tileAt(s,p.x+dx,p.y+dy).t==="extract") return true; return false; }
  function doExtract(s,p){
    if(!canExtract(s,p)){ let d=99; for(let i=0;i<s.tiles.length;i++) if(s.tiles[i].t==="extract") d=Math.min(d,Math.max(Math.abs(i%s.W-p.x),Math.abs(((i/s.W)|0)-p.y))); say(s,d<99?`The shuttle pad is ${d} tile${d>1?"s":""} away. Get on it (or right beside it) to extract.`:"There's no shuttle pad here.","warn"); return false; }
    p.extracted=true; p.alive=false; say(s,"You seal the shuttle hatch and punch the undock.","good");
    for(const r of s.ents) if(r.kind==="raider"&&r.alive&&r.prisoner===p.id&&Math.abs(r.x-p.x)+Math.abs(r.y-p.y)<=3){ r.alive=false; r.extracted=true;
      if(r.rescue){ const J=(s.jobs||[]).find(q=>q.id===r.rescue); if(J) J.done=true; say(s,`${r.name} collapses into the shuttle seat, alive.`,"good"); } else { s.prisoners.push({by:p.id,fac:r.fac,name:r.name}); say(s,`You shove ${r.name} into the shuttle's cargo cage.`,"good"); } }
    for(const it of p.inv) if(it.job){ const J=(s.jobs||[]).find(q=>q.id===it.job); if(J) J.done=true; }
    if(players(s).every(q=>!q.alive)) s.status="ended"; return true;
  }

  // ---------- world resolution ----------
  function endTurn(s){
    if(s.mode==="raid") trapTick(s); atmos(s); fireStep(s); wind(s); husks(s); raiders(s); bots(s); vitals(s); chargeTick(s); eventTick(s); if(s.smoke){ for(const k of Object.keys(s.smoke)) if(--s.smoke[k]<=0) delete s.smoke[k]; } if(s.gasEnd&&s.turn>=s.gasEnd&&s.gas&&s.gas.length&&!(s.ev&&s.ev.type==="gas"&&s.ev.on&&!s.ev.done)){ s.gas=s.gas.slice(0,Math.max(0,s.gas.length-5)); if(!s.gas.length) s.gasEnd=0; } trapTick(s); nemTick(s); marksTick(s); sideTick(s);
    for(const p of players(s)) if(p.alive&&p.downed&&--p.downT<=0){ CTX=p.id; kill(s,p,"Bled out before help arrived."); }
    CTX=null;
    s.turn++;
    const ps=players(s);
    if(ps.every(p=>!p.alive)) s.status="ended";
  }

  // Zone atmosphere: flood-fill connected gas tiles into zones. Zones blend
  // toward their mean pressure; zones touching a breach vent to space and
  // generate wind toward the breach along a BFS distance field.
  function atmos(s){
    const {W,H,tiles}=s, N=W*H, zone=new Int32Array(N).fill(-1); const P=s.P;
    s.wind=new Array(N).fill(-1); s.windStr=new Array(N).fill(0);
    let zid=0;
    for(let i=0;i<N;i++){
      if(zone[i]!==-1||!gas(tiles[i])) continue;
      const cells=[i], vents=[]; zone[i]=zid;
      for(let q=0;q<cells.length;q++){
        const c=cells[q], x=c%W, y=(c/W)|0;
        if(tiles[c].t==="breach") vents.push(c);
        for(const [dx,dy] of N4){ const nx=x+dx,ny=y+dy; if(!inb(s,nx,ny)) continue; const j=ny*W+nx;
          if(zone[j]===-1&&gas(tiles[j])){ zone[j]=zid; cells.push(j);} }
      }
      let sum=0; for(const c of cells) sum+=P[c]; const mean=sum/cells.length;
      for(const c of cells) P[c]+= (mean-P[c])*.5;
      if(vents.length){
        const r=Math.min(.6,Math.max(.15,.15+4*vents.length/cells.length));
        let after=0; for(const c of cells){ P[c]*=(1-r); after+=P[c]; }
        for(const v of vents) P[v]=0;
        const strength=mean*r;
        // distance field from vents
        const dist=new Map(); const q=[...vents]; vents.forEach(v=>dist.set(v,0));
        for(let k=0;k<q.length;k++){ const c=q[k],x=c%W,y=(c/W)|0;
          for(const [dx,dy] of N4){ const nx=x+dx,ny=y+dy; if(!inb(s,nx,ny)) continue; const j=ny*W+nx;
            if(zone[j]===zid&&!dist.has(j)){ dist.set(j,dist.get(c)+1); q.push(j);} } }
        for(const c of cells){ if(tiles[c].t==="breach") continue; const x=c%W,y=(c/W)|0, dc=dist.get(c);
          for(const [dx,dy] of N4){ const j=(y+dy)*W+(x+dx); if(dist.has(j)&&dist.get(j)<dc){ s.wind[c]=j; s.windStr[c]=strength/(1+dc*.04); break; } } }
      }
      zid++;
    }
  }
  function wind(s){
    const moved=new Set(); let lost=[];
    for(const it of s.items){
      const i=idx(s,it.x,it.y), j=s.wind[i]; if(j<0||s.windStr[i]<3||moved.has(it.id)) continue;
      moved.add(it.id); it.x=j%s.W; it.y=(j/s.W)|0;
      if(s.tiles[j].t==="breach"){ it.gone=true; lost.push(it); }
    }
    s.items=s.items.filter(i=>!i.gone);
    for(const it of lost) say(s,`The ${nm(it)} tumbles out of the breach into space.`,"air");
    for(const e of s.ents){
      if(!e.alive) continue; const i=idx(s,e.x,e.y), j=s.wind[i], str=s.windStr[i];
      if(j<0||str<4) continue;
      if(e.kind==="player"){ if(!e.flags.mag){ e.flags.mag=1; say(s,"Wind screams past you toward the breach. Your magboots hold.","air"); } continue; }
      if(!chance(s,Math.min(.85,str/18))) continue;
      const jx=j%s.W, jy=(j/s.W)|0; if(entAt(s,jx,jy)) continue;
      e.x=jx; e.y=jy;
      if(s.tiles[j].t==="breach"){ e.alive=false; e.spaced=true; fx(s,{type:"spaced",x:jx,y:jy}); say(s,`${e.kind==="raider"?e.name+" is":"A husk is"} torn through the breach and spins away into the void.`,"good"); }
    }
  }
  // Fire: burns fuel, eats oxygen, needs >22 kPa, spreads (faster downwind),
  // cooks off items and detonates fuel drums.
  function fireStep(s){
    const W=s.W, add=[], booms=[]; let spreadNear=false;
    for(const k of Object.keys(s.fire)){
      const i=+k, t=s.tiles[i], x=i%W, y=(i/W)|0; let lv=s.fire[i];
      if(!gas(t)||s.P[i]<22){ delete s.fire[i]; s.scorch[i]=1; if(s.P[i]<22&&anyPlayerSees(s,x,y)&&chance(s,.3)) say(s,"Starved of air, the flames gutter out.","air"); continue; }
      s.P[i]=Math.max(0,s.P[i]-1.6*lv);
      s.fuel[i]-=1;
      if(s.fuel[i]<=0){ delete s.fire[i]; s.scorch[i]=1;
        if(t.t==="prop"&&t.kind!=="barrel"){ if(anyPlayerSees(s,x,y)) say(s,`The burning ${t.kind} collapses into ash.`,"warn"); s.tiles[i]={t:"floor",debris:t.kind}; }
        continue; }
      if(lv<3&&chance(s,.45)) s.fire[i]=++lv;
      for(const [dx,dy] of N4){ const nx=x+dx, ny=y+dy; if(!inb(s,nx,ny)) continue; const j=ny*W+nx, tj=s.tiles[j];
        if(tj.t==="prop"&&tj.kind==="barrel"){ if(chance(s,.3*lv)) booms.push([nx,ny]); continue; }
        if(!gas(tj)||s.fire[j]||s.fuel[j]<=0) continue;
        let pr=.15*lv*Math.min(1,s.P[j]/101); if(s.wind[i]===j) pr+=.35; if(tj.t==="prop") pr+=.1;
        if(chance(s,pr)){ add.push(j); if(players(s).some(p=>p.alive&&Math.hypot(p.x-nx,p.y-ny)<6)) spreadNear=true; } }
      for(const it of s.items.filter(q=>q.x===x&&q.y===y)){
        if(K(it)==="ammo"&&chance(s,.4)){ it.gone=true; fx(s,{type:"cookoff",x,y}); noise(s,x,y,8); say(s,"Ammunition cooks off in the flames!","warn"); }
        else if((it.d==="bandage"||it.d==="medkit")&&chance(s,.3)){ it.gone=true; if(anyPlayerSees(s,x,y)) say(s,`The ${nm(it)} burns away.`,"warn"); }
        else if(it.d==="o2"&&chance(s,.5)){ it.gone=true; s.fire[i]=3; s.fuel[i]+=4; fx(s,{type:"flare",x,y}); say(s,"An oxygen canister ruptures. The fire roars white-hot!","bad"); }
      }
    }
    s.items=s.items.filter(q=>!q.gone);
    for(const j of add) if(!s.fire[j]) s.fire[j]=1;
    if(spreadNear&&chance(s,.5)) say(s,"The fire is spreading.","warn");
    for(const [x,y] of booms) explode(s,x,y);
  }
  function explode(s,x0,y0){
    const q=[[x0,y0]];
    while(q.length){
      const [x,y]=q.shift(), i=idx(s,x,y), t=s.tiles[i]; if(!(t.t==="prop"&&t.kind==="barrel")) continue;
      s.tiles[i]={t:"floor",debris:"barrel"}; s.fuel[i]=3; s.fire[i]=3; s.scorch[i]=1;
      fx(s,{type:"explode",x,y}); noise(s,x,y,14);
      say(s, anyPlayerSees(s,x,y)?"A fuel drum EXPLODES!":"A deep boom shakes the deck plating.","bad");
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){ const nx=x+dx, ny=y+dy, d=Math.hypot(dx,dy); if(d>2.3||!inb(s,nx,ny)) continue;
        if(!los(s,x,y,nx,ny)&&d>1.5) continue;
        const j=idx(s,nx,ny), tj=s.tiles[j];
        if(tj.t==="prop"&&tj.kind==="barrel"&&!(dx===0&&dy===0)){ q.push([nx,ny]); continue; }
        if(tj.t==="window"&&chance(s,d<=1.5?.9:.5)) hitWindow(s,nx,ny,tj,true);
        if(gas(tj)&&s.fuel[j]>0&&!s.fire[j]&&chance(s,d<=1.5?.85:.45)) s.fire[j]=2;
        if(gas(tj)) s.scorch[j]=1;
        const e=entAt(s,nx,ny);
        if(e){ const hits=d<=1.5?2:1, fr=e.kind==="player"?gearOf(e).fire*.5:0; for(let k=0;k<hits;k++) damage(s,e,pickLimb(s),Math.round((d<=1.5?ri(s,12,20):ri(s,6,11))*(1-fr)),.5,"Caught in a fuel explosion.");
          if(e.kind==="player"&&e.alive) say(s,"The blast hammers you off your feet!","bad"); }
      }
    }
  }
  function stepToward(s,h,tx,ty){
    if(!inb(s,tx,ty)||(tx===h.x&&ty===h.y)) return null;
    const W=s.W, start=idx(s,h.x,h.y), goal=idx(s,tx,ty), prev=new Int32Array(W*s.H).fill(-1); prev[start]=start;
    const q=[start];
    for(let k=0;k<q.length&&k<900;k++){ const c=q[k]; if(c===goal) break; const x=c%W,y=(c/W)|0;
      for(const [dx,dy] of N4){ const nx=x+dx,ny=y+dy; if(!inb(s,nx,ny)) continue; const j=ny*W+nx; if(prev[j]!==-1) continue;
        const t=s.tiles[j]; if(!(walk(t)||(t.t==="door"&&!t.open&&!t.locked)||j===goal)) continue; if(s.fire[j]&&j!==goal) continue; prev[j]=c; q.push(j); } }
    if(prev[goal]===-1) return null;
    let c=goal; while(prev[c]!==start&&c!==start) c=prev[c];
    return c===start?null:[c%W,(c/W)|0];
  }
  // Husk AI. They see within a radius (less in the dark, less if you're stealthy), hear gunfire and doors,
  // shriek to call the pack, spread out to surround you instead of queuing in a corridor, search where
  // they last saw you, back off into the dark when badly hurt and wait to ambush.
  const huskSees=(s,h,p)=>{ if(!p.alive) return false; const G=gearOf(p); return Math.hypot(p.x-h.x,p.y-h.y)<=(s.power?8:5)+(G.lit&&!s.power?3:0)-G.stealth-(p.sneak?(G.lit?2:3):0)&&los(s,h.x,h.y,p.x,p.y); };
  const free=(s,x,y)=>walk(tileAt(s,x,y))&&!entAt(s,x,y)&&!s.fire[idx(s,x,y)];
  function husks(s){
    const claimed=new Set();
    for(const h of s.ents){
      if(h.kind!=="husk"||!h.alive) continue; ATK=null;
      if(h.type==="nest"){ nestTick(s,h); continue; }
      if(h.mut==="regen"&&s.turn%2===0){ for(const l of LIMBS) if(!(h.sev&&h.sev[l])&&h.hp[l]>0) h.hp[l]=Math.min(h.max[l],h.hp[l]+2); if(s.turn%6===0) h.bleed={}; }
      if(h.stun>0){ h.stun--; continue; }
      if(s.fire[idx(s,h.x,h.y)]){ const opts=N4.map(([dx,dy])=>[h.x+dx,h.y+dy]).filter(([x,y])=>free(s,x,y));
        if(opts.length){ const [x,y]=opts[ri(s,0,opts.length-1)]; face(h,x-h.x,y-h.y); h.x=x; h.y=y; continue; } }
      // target: someone it can see beats someone it merely heard
      let best=null, bd=1e9, seen=false;
      for(const p of s.ents){ if(!p.alive||(p.kind!=="player"&&p.kind!=="raider")||p.surr&&false) continue; const v=huskSees(s,h,p), d=Math.abs(p.x-h.x)+Math.abs(p.y-h.y)-(v?100:0); if(d<bd){ bd=d; best=p; seen=v; } }
      if(!best) continue; bd=Math.abs(best.x-h.x)+Math.abs(best.y-h.y);
      if(seen){
        if(!h.aware){ if(anyPlayerSees(s,h.x,h.y)) say(s,best.kind==="raider"?`A husk shrieks and turns on ${best.name}.`:"The husk's head snaps toward you. It shrieks.","warn");
          fx(s,{type:"shriek",x:h.x,y:h.y,id:h.id});                       // the shriek calls the pack
          if(h.mut==="shrieker"){ fx(s,{type:"roar",x:h.x,y:h.y}); say(s,"A shrieking husk throws its head back and SCREAMS. Something answers from every deck.","bad"); }
          for(const o of s.ents) if(o!==h&&o.kind==="husk"&&o.alive&&Math.hypot(o.x-h.x,o.y-h.y)<=(h.mut==="shrieker"?22:7)&&!o.aware){ o.aware=true; o.last={x:best.x,y:best.y}; } }
        h.aware=true; h.last={x:best.x,y:best.y}; h.search=0; h.lurk=0;
      }
      // lurkers wait in the dark until you're close
      if(h.lurk&&!seen&&bd>2) continue; h.lurk=0;
      // badly hurt: break away into the dark, then wait in ambush
      const hurt=h.hp.torso<=HUSK_HP.torso*.3||(h.hp.lleg<=0&&h.hp.rleg<=0)||(h.blood!=null&&h.blood<30);
      if(hurt&&seen&&bd<=3&&!h.fled&&chance(s,.6)){ h.flee=3; h.fled=1; }
      if(h.flee>0){ h.flee--; const opts=N4.map(([dx,dy])=>[h.x+dx,h.y+dy]).filter(([x,y])=>free(s,x,y)).sort((a,b)=>(Math.abs(b[0]-best.x)+Math.abs(b[1]-best.y))-(Math.abs(a[0]-best.x)+Math.abs(a[1]-best.y)));
        if(opts.length){ const [x,y]=opts[0]; face(h,x-h.x,y-h.y); h.x=x; h.y=y; if(anyPlayerSees(s,x,y)&&h.flee===2) say(s,"The wounded husk scrambles back into the dark.","info"); }
        if(h.flee===0){ h.lurk=1; h.last=null; } continue; }
      const TY=HT(h);
      if(h.type==="matriarch"&&h.aware&&seen&&s.turn>=(h.roarT|0)){ h.roarT=s.turn+7; matriarchRoar(s,h); continue; }
      if(h.type==="spitter"&&seen&&bd>=2&&Math.hypot(best.x-h.x,best.y-h.y)<=TY.range&&los(s,h.x,h.y,best.x,best.y)&&chance(s,.8)){ spit(s,h,best); continue; }
      if(h.type==="spitter"&&seen&&bd===1&&chance(s,.6)){ const o=N4.map(([dx,dy])=>[h.x+dx,h.y+dy]).filter(([x,y])=>free(s,x,y)).sort((a,b)=>(Math.abs(b[0]-best.x)+Math.abs(b[1]-best.y))-(Math.abs(a[0]-best.x)+Math.abs(a[1]-best.y))); if(o.length){ face(h,o[0][0]-h.x,o[0][1]-h.y); h.x=o[0][0]; h.y=o[0][1]; continue; } }
      if(bd===1){ huskAttack(s,h,best); continue; }
      if(TY.spd<1){ h.slow=!h.slow; if(h.slow) continue; }
      if(crippled(h)){ h.limp=!h.limp; if(h.limp) continue; }
      if(h.type==="stalker"&&h.aware&&bd>6&&tileAt(s,h.x,h.y).vent){ const to=ventExit(s,h); if(to&&Math.abs(to[0]-best.x)+Math.abs(to[1]-best.y)<bd-4){ const x0=h.x,y0=h.y; h.x=to[0]; h.y=to[1]; fx(s,{type:"vent",x0,y0,x:h.x,y:h.y,id:h.id}); if(players(s).some(q=>q.alive&&Math.hypot(q.x-h.x,q.y-h.y)<9)) say(s,"Something clatters through the vents and drops out nearby.","bad"); continue; } }
      if((h.type==="stalker"||h.mut==="swift")&&h.last&&!h.x2){ h.x2=1; const st0=stepToward(s,h,h.last.x,h.last.y); if(st0&&free(s,st0[0],st0[1])&&!(st0[0]===best.x&&st0[1]===best.y)){ face(h,st0[0]-h.x,st0[1]-h.y); h.x=st0[0]; h.y=st0[1]; if(Math.abs(best.x-h.x)+Math.abs(best.y-h.y)===1){ h.x2=0; huskAttack(s,h,best); continue; } } } h.x2=0;
      if(h.last){
        // spread out: head for a free tile beside the target that no other husk has claimed
        let gx=h.last.x, gy=h.last.y;
        if(seen){ const spots=N4.map(([dx,dy])=>[best.x+dx,best.y+dy]).filter(([x,y])=>(walk(tileAt(s,x,y))||(x===h.x&&y===h.y))&&!claimed.has(idx(s,x,y))&&!(entAt(s,x,y)&&!(x===h.x&&y===h.y)))
            .sort((a,b)=>(Math.abs(a[0]-h.x)+Math.abs(a[1]-h.y))-(Math.abs(b[0]-h.x)+Math.abs(b[1]-h.y)));
          if(spots.length){ [gx,gy]=spots[0]; claimed.add(idx(s,gx,gy)); } }
        let st=stepToward(s,h,gx,gy); if(!st&&(gx!==h.last.x||gy!==h.last.y)) st=stepToward(s,h,h.last.x,h.last.y);
        if(!st){ h.last=null; h.search=5; continue; }
        const [x,y]=st, t=tileAt(s,x,y);
        if(t.t==="door"&&!t.open){
          t.hp-=TY.door||1; face(h,x-h.x,y-h.y); fx(s,{type:"bash",x,y}); if(h.type==="brute") fx(s,{type:"stomp",x,y}); if(anyPlayerSees(s,x,y)||Math.hypot(best.x-x,best.y-y)<7) say(s,"Something is pounding on a door nearby.","warn");
          if(t.hp<=0){ t.open=true; t.broken=true; const wasS=t.sealed; t.sealed=false; say(s,wasS?"Claws tear the weld apart. The sealed door gives way!":"A door buckles and tears off its track!","bad"); }
          continue;
        }
        if(!entAt(s,x,y)&&walk(t)){ face(h,x-h.x,y-h.y); h.x=x; h.y=y; }
        if(h.x===h.last.x&&h.y===h.last.y&&!seen){ h.last=null; h.search=5; }       // lost you: search the area
      } else if(h.search>0){
        h.search--; const opts=N4.map(([dx,dy])=>[h.x+dx,h.y+dy]).filter(([x,y])=>free(s,x,y));
        if(opts.length){ const [x,y]=opts[ri(s,0,opts.length-1)]; face(h,x-h.x,y-h.y); h.x=x; h.y=y; }
        if(!h.search) h.aware=false;
      } else if(!s.power&&chance(s,.15)&&!h.aware){ h.lurk=1; }
      else if(chance(s,.25)){
        const [dx,dy]=N4[ri(s,0,3)];
        if(free(s,h.x+dx,h.y+dy)){ face(h,dx,dy); h.x+=dx; h.y+=dy; }
      }
    }
  }
  function matriarchRoar(s,h){ fx(s,{type:"roar",x:h.x,y:h.y}); fx(s,{type:"shriek",x:h.x,y:h.y,id:h.id});
    for(const p of s.ents) if(p.alive&&(p.kind==="player"||p.kind==="raider")&&Math.hypot(p.x-h.x,p.y-h.y)<=4.5&&los(s,h.x,h.y,p.x,p.y)){ p.busy=Math.max(p.busy|0,1); if(p.kind==="player"){ const c0=CTX; CTX=p.id; say(s,"The Matriarch's roar hits you like a wall. You stagger.","bad"); CTX=c0; } }
    const kids=s.ents.filter(e=>e.alive&&e.kind==="husk"&&e.mom===h.id).length; if(kids<6) for(let k=0;k<2;k++){ const sp=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].map(([dx,dy])=>[h.x+dx,h.y+dy]).find(([x,y])=>free(s,x,y)); if(sp){ const c=addHusk(s,sp[0],sp[1],"stalker"); c.aware=true; c.last=h.last?{...h.last}:null; c.mom=h.id; } }
    if(anyPlayerSees(s,h.x,h.y)) say(s,"The Matriarch rears up and ROARS. Stalkers pour out of the vents.","bad"); }
  function spit(s,h,t){ ATK=h.id; face(h,t.x-h.x,t.y-h.y); const T0=HT(h); fx(s,{type:"spit",x:h.x,y:h.y,x1:t.x,y1:t.y});
    if(chance(s,T0.acc)){ const l=pickLimb(s), d=ri(s,T0.dmg[0],T0.dmg[1]); const c0=CTX; if(t.kind==="player"){ CTX=t.id; say(s,`A spitter's acid splashes your ${LNAME[l]}! It burns.`,"bad"); } damage(s,t,l,d,0,"Dissolved by spitter acid."); if(t.alive){ const fr=t.kind==="player"?gearOf(t).fire:0; t.acid=Math.max(t.acid|0,Math.round(ri(s,T0.acid[0],T0.acid[1])*(1-fr))); } CTX=c0; }
    else if(t.kind==="player"){ const c0=CTX; CTX=t.id; say(s,"Acid hisses on the deck beside you.","warn"); CTX=c0; } }
  function huskAttack(s,h,p){
    const TY=HT(h);
    if(p.kind==="bot") return;
    if(p.kind==="raider"){ ATK=h.id; face(h,p.x-h.x,p.y-h.y); fx(s,{type:"claw",x:p.x,y:p.y,id:h.id}); if(chance(s,TY.acc-.06)){ damage(s,p,pickLimb(s),ri(s,TY.dmg[0],TY.dmg[1]),.35,"husk"); if(p.alive&&anyPlayerSees(s,p.x,p.y)&&chance(s,.4)) say(s,`A husk tears into ${p.name}.`,"info"); } return; }
    CTX=p.id; ATK=h.id; const armsGone=h.hp.larm<=0&&h.hp.rarm<=0; face(h,p.x-h.x,p.y-h.y); fx(s,{type:"claw",x:p.x,y:p.y,id:h.id});
    if(chance(s,(armsGone?.5:TY.acc)-(p.imp&&p.imp.reflex?.1:0))){
      const l=pickLimb(s), d=armsGone?ri(s,3,6):ri(s,TY.dmg[0],TY.dmg[1]), n=TY.name;
      say(s, h.type==="brute"?`The brute slams into your ${LNAME[l]}!`:h.type==="matriarch"?`The Matriarch's claws tear through your ${LNAME[l]}!`:armsGone?`The ${n} bites into your ${LNAME[l]}!`:`The ${n} rakes your ${LNAME[l]}!`, "bad");
      if(h.type==="brute") fx(s,{type:"stomp",x:p.x,y:p.y});
      damage(s,p,l,d,.35,h.type==="matriarch"?"Torn apart by the Matriarch.":`Torn apart by a ${n}.`);
      if(p.alive&&TY.stun&&!(p.perks&&p.perks.steady)&&chance(s,TY.stun)){ p.busy=Math.max(p.busy|0,1); say(s,"The blow knocks you off your feet!","bad"); }
      if(p.alive) wound(s,p,l,d,{infect:TY.infect||0,frac:TY.frac||0});
      if(p.alive&&h.mut==="venom"&&!(p.inf>0)){ p.inf=1; say(s,"The venomous husk's claws leave black streaks under your skin. Infection is setting in. Antibiotics.","bad"); }
    } else say(s,`The ${TY.name} lunges and misses.`,"info");
  }
  // =================== RAIDERS: other scavenger crews ===================
  // Crews from four outfits pick over the same wrecks. Each crew shares an attitude toward the players
  // (hostile / wary / friendly), loots containers and the deck, fights husks, patches wounds, surrenders
  // or runs when it's going badly, talks (and answers what you type), and eventually pulls out.
  const RAIDER_HP={head:26,torso:52,larm:30,rarm:30,lleg:34,rleg:34};
  // Factions: who they are (kind/species), how they look in the field and on the comms hologram,
  // how likely they are to shoot first, and who they hate. Standing with each one lives in the profile.
  const FACTIONS={
    reaver:{name:"Red Reavers",short:"Reaver",kind:"Raiders",species:"human",col:"#e0482f",emblem:"fang",hostile:.85,foes:["marshal","vanta"],
      desc:"Scrap-armoured raiders who strip wrecks and crews alike. Pay them off or keep your distance.",
      cloth:[2,4,7],cloak:["red","black"],visor:["red","amber"],crest:["horns","plume","none"],
      head:["welder","welder","flakhelm",null],armor:["scrapvest","scrapvest","flak",null],legs:["kneepads","cargo",null],acc:["pauldron","cape","bandolier","pauldron"],
      guns:["pipe","scatter","sixgun","rivet","coachgun","pipe"],side:["sixgun","cannon"],melee:["machete","axe","ripsaw","crowbar"],hair:[4,1,10,0,5],marks:[4,1,2,4],traits:["killer","killer","greedy","coward","talker"],
      rep:{name:"Warboss Gutterjaw",title:"Reaver warboss",look:{c:"red",s:2,h:4,hc:6,e:4,t:4,tc:2,b:0,bc:4,bt:4,g:0,fh:3,fm:4,br:3,mo:4,hd:null,a:"scrapvest",ac:"pauldron"}}},
    blacksun:{name:"Black Sun Syndicate",short:"Black Sun",kind:"Smugglers",species:"human",col:"#c070ff",emblem:"sun",hostile:.6,foes:["marshal"],
      desc:"Smugglers and fences. They'll sell you anything, hire out their gunslingers, and shoot you over a cargo crate.",
      cloth:[4,8,3],cloak:["black","violet"],visor:["void","red"],crest:["none","fin"],
      head:["gasmask","pilothelm",null,null],armor:["brigandine","carrier","flak"],legs:["kneepads","cargo"],acc:["scarf","bandolier","cape",null],
      guns:["wasp","bullpup","sixgun","hound"],side:["cannon","sixgun"],melee:["knife","machete"],hair:[12,10,3,7],marks:[1,2,0],traits:["greedy","greedy","killer","talker","veteran"],
      rep:{name:"Madame Orsolya Vey",title:"Syndicate fixer",look:{c:"violet",s:1,h:3,hc:0,e:4,t:1,tc:8,b:0,bc:4,bt:4,g:1,fh:0,fm:2,br:4,mo:1,a:"brigandine",ac:"scarf"}}},
    saint:{name:"Rust Saints",short:"Saint",kind:"Cult",species:"human",col:"#c98a3a",emblem:"cog",hostile:.6,foes:["choir","unbound"],
      desc:"Zealots who worship decay and burn machines. Offer a tithe and they may let you pass.",
      cloth:[0,8,6,4],cloak:["bone","black","violet"],visor:["green","amber"],crest:["antenna","halo","none"],
      head:["gasmask","gasmask","sallet",null],armor:["medcoat","brigandine","hazard"],legs:["hazlegs","kneepads"],acc:["censer","scarf","charm",null],
      guns:["pump","carbine","warden","hound"],side:["pistol"],melee:["maul","crowbar","knife"],hair:[0,1,6,3],marks:[1,2,0],traits:["zealot","zealot","talker","veteran","coward"],
      rep:{name:"Deacon Mordwen",title:"Voice of the Rust",look:{c:"bone",v:"green",s:0,h:0,e:1,t:0,tc:8,b:0,bc:4,bt:4,g:0,fh:0,fm:1,hd:"gasmask",a:"medcoat",ac:"censer"}}},
    guild:{name:"Salvage Guild",short:"Guild",kind:"Salvagers",species:"human",col:"#e8b048",emblem:"wrench",hostile:.25,foes:[],
      desc:"Licensed salvage crews. Mostly honest, always busy, and happy to sell you their spare kit.",
      cloth:[1,5,7,0],cloak:["olive","bone","navy"],visor:["amber","cyan"],crest:["antenna","plume","none"],
      head:["hardhat","eva","hardhat",null],armor:["harness","hazard","suit","hardsuit"],legs:["cargo","magboots","hazlegs"],acc:["toolbelt","oxytank","lamp",null],
      guns:["pistol","carbine","hornet","bullpup","wasp"],side:["pistol"],melee:["crowbar","knife"],hair:[2,8,7,11,12,9],marks:[0,0,3,1],traits:["talker","talker","greedy","coward","veteran"],
      rep:{name:"Foreman Abel Kask",title:"Guild dispatcher",look:{c:"olive",s:3,h:2,hc:5,e:0,t:2,tc:7,b:1,bc:5,bt:4,g:0,fh:2,fm:0,hd:"hardhat",a:"harness",ac:"toolbelt"}}},
    vanta:{name:"Vanta Combine",short:"Vanta",kind:"Merchants",species:"human",col:"#5ad0d0",emblem:"diamond",hostile:.15,foes:["reaver"],
      desc:"A trade house with caravans in every sector. Their goods are good and their prices are worse.",
      cloth:[6,5,1,3],cloak:["bone","navy","olive"],visor:["cyan","white"],crest:["antenna","none"],
      head:["eva","pilothelm",null],armor:["hardsuit","suit","carrier"],legs:["magboots","cargo"],acc:["oxytank","drone","toolbelt"],
      guns:["carbine","bullpup","warden","pistol"],side:["pistol","hornet"],melee:["knife"],hair:[8,2,12,9,7],marks:[0,3,0],traits:["greedy","talker","talker","coward","veteran"],
      rep:{name:"Broker Ilse Vant",title:"Combine trade broker",look:{c:"bone",s:0,h:8,hc:4,e:1,t:1,tc:6,b:0,bc:3,bt:4,g:1,fh:0,fm:0,mo:3,a:"suit",ac:"drone"}}},
    hollow:{name:"Hollow Company",short:"Hollow",kind:"Mercenaries",species:"human",col:"#9aa8b4",emblem:"skull",hostile:.92,foes:[],
      desc:"Professional killers for hire. In the field they shoot first. On contract, they're worth every credit.",
      cloth:[4,9,3],cloak:["black","navy"],visor:["red","cyan","white"],crest:["none","fin"],
      head:["sallet","flakhelm","pilothelm"],armor:["carrier","flak","carrier"],legs:["greaves","kneepads"],acc:["lamp","bandolier","drone",null],
      guns:["bullpup","kestrel","hound","warden","longbore"],side:["cannon","wasp"],melee:["knife","machete"],hair:[1,0,10],marks:[1,5,0],traits:["veteran","veteran","killer","greedy"],
      rep:{name:"Captain Reyes Harrow",title:"Hollow Company recruiter",look:{c:"black",v:"red",s:4,h:1,hc:0,e:0,t:3,tc:4,b:0,bc:9,bt:4,g:0,fh:1,fm:1,hd:"sallet",a:"carrier",ac:"bandolier"}}},
    marshal:{name:"Concord Marshals",short:"Marshal",kind:"Law",species:"human",col:"#6aa0ff",emblem:"star",hostile:.2,foes:["reaver","blacksun","choir"],
      desc:"What's left of the law. They pay bounties on raiders and they remember who shoots their deputies.",
      cloth:[3,0,9],cloak:["navy","black"],visor:["cyan","white"],crest:["fin","none"],
      head:["sallet","flakhelm"],armor:["flak","carrier"],legs:["greaves","kneepads"],acc:["lamp","bandolier"],
      guns:["warden","pump","bullpup","carbine"],side:["cannon"],melee:["crowbar"],hair:[1,2,8],marks:[0,1],traits:["veteran","talker","veteran","killer"],
      rep:{name:"Marshal Odile Brant",title:"Concord sector marshal",look:{c:"navy",v:"cyan",s:5,h:8,hc:0,e:0,t:3,tc:3,b:0,bc:3,bt:4,g:1,fh:0,fm:1,a:"flak",ac:"lamp"}}},
    choir:{name:"Iron Choir",short:"Choir",kind:"Synths",species:"synth",col:"#7cff7a",emblem:"eye",hostile:.75,foes:["unbound","saint","marshal"],
      desc:"A synthetic collective that sings to itself across the dark. It trades in technology and deletes what it can't use.",
      cloth:[4,9,3],cloak:["black"],visor:["green","cyan","red"],crest:["antenna","none"],
      head:[null,null,"visor"],armor:["exo","hardsuit","carrier"],legs:["hardlegs","magboots"],acc:["drone","lamp",null],
      guns:["warden","rivet","kestrel","bullpup"],side:["hornet"],melee:["ripsaw","maul"],hair:[0],marks:[0],traits:["veteran","killer","veteran","talker"],
      rep:{name:"CANTOR-1",title:"Voice of the Iron Choir",look:{syn:1,c:"black",v:"green",s:0,h:0,e:2,t:3,tc:4,b:0,bc:4,bt:4,g:0,a:"exo"}}},
    unbound:{name:"The Unbound",short:"Unbound",kind:"Synths",species:"synth",col:"#ff9a5a",emblem:"chain",hostile:.3,foes:["choir"],
      desc:"Synths who cut their own control chips. Free, wary, and handy with spare parts. They hire out as escorts.",
      cloth:[7,1,5,6],cloak:["olive","bone"],visor:["amber","cyan"],crest:["none","antenna"],
      head:[null,null,"hardhat"],armor:["harness","suit","scrapvest"],legs:["cargo","kneepads"],acc:["toolbelt","scarf",null],
      guns:["pistol","carbine","pipe","hornet"],side:["pistol"],melee:["crowbar","knife"],hair:[0],marks:[0],traits:["talker","coward","veteran","greedy"],
      rep:{name:"Juniper",title:"Unbound speaker",look:{syn:1,c:"olive",s:1,h:0,e:3,t:1,tc:7,b:1,bc:5,bt:4,g:1,a:"harness",ac:"scarf"}}},
  };
  const SNAMES=["KT-9","Verse-4","Cantor-3","Echo-11","Lyre","Sable-3","Hymnal","Null-6","Tessera","Coda","Index-2","Psalm-2","Rho-17","Aria","Vesper-8","Glass","Tamber","Cobalt-5"];
  const UNAMES=["Rivet","Patch","Juniper","Socket","Halo","Wick","Ember","Sprocket","Lumen","Tinker","Solder","Quartz"];
  const RNAMES=["Gutter","Tallow","Rook","Mags","Vex","Sallow","Brick","Cinder","Hask","Lull","Spit","Knuckle","Dregs","Ivo","Marrow","Ash","Pike","Wren","Tamsin","Oro","Juno","Grist","Halloran","Sev","Kettle","Dace","Moth","Nails","Corwin","Lark","Bastian","Fen","Quill","Rhee","Stitch","Varga","Yuri","Odette","Crane","Holt"];
  // what they say. {you}=the player they're talking to, {it}=an item, {n}=their name, {f}=their outfit
  const V={
    spot_hostile:{_:["Contact! Light 'em up!","Fresh meat on the deck!","That's our salvage. Drop 'em!","Weapons free!"],reaver:["Meat! Fresh meat!","Skin 'em and take the kit!","Ha! Look what crawled in!"],saint:["Heretics on the deck. Purge them.","The rust takes all. Starting with you."],hollow:["Hostiles. Engage.","Contact front. Put them down.","Targets acquired."]},
    spot_wary:{_:["Hold it right there.","Easy. Keep your hands where I can see 'em.","Stop. Who are you with?","Don't come any closer."],guild:["Guild salvage team. This section's tagged, friend.","Easy there. We're just cutting scrap."]},
    spot_friendly:{_:["Hey! Don't shoot, we're friendly.","Another crew. Good. Plenty of wreck for all of us.","Easy, friend. We're not looking for trouble."],guild:["Guild here. Watch the husks in the lower decks.","Friendly! Guild salvage. Wave if you can hear me."]},
    warn:{_:["I said back off.","Last warning.","You're too close. Move.","Step away or I start shooting."]},
    provoked:{_:["You shot me! Kill them!","That's how it is? Fine!","They opened fire! Drop 'em!","Traitors!"],guild:["We trusted you! Guild, open fire!"],saint:["The faithless strike! Smite them!"]},
    husk:{_:["Husk! Shoot it!","Contact, husk!","Here they come!","Something's moving in the dark."],hollow:["Biologic. Engaging."],saint:["Back to the rust, abomination!"]},
    hit:{_:["Argh! I'm hit!","Gah!","They got me!","Hit! I'm hit!"]},
    dry:{_:["I'm dry!","Out of ammo!","Click. Damn it!"]},
    kill:{_:["Got one!","Stay down.","Next!","That's one less."],reaver:["Ha! Who's next?"],hollow:["Target down."]},
    ally_down:{_:["They got {n}!","{n}'s down!","No! {n}!"]},
    flee:{_:["I'm out! Fall back!","Not worth dying for!","Run!"]},
    surrender:{_:["Alright! Alright! I give up!","Don't shoot! Take what you want!","I yield! Please!"]},
    heal:{_:["Patching up.","Hold on, I'm bleeding.","Need a second to wrap this."]},
    loot:{_:["Got something.","Mine.","Bag it.","Worth a few credits."]},
    loot_good:{_:["Oh, that's a nice one.","Now this is worth the trip!","Jackpot."]},
    blackbox:{_:["Got the black box! Let's go!","Black box is ours. Move out!"]},
    leave:{_:["Packs are full. We're pulling out.","That's enough. Back to the ship.","Moving to the pad. Let's go."]},
    hail_hostile:{_:["Talk all you like. You're still dying.","Ha! Nice try.","Shut up and bleed."],reaver:["We'll talk over your corpse!"]},
    hail_wary:{_:["We hear you. Keep your distance.","Yeah? What do you want?","Talk. From over there."]},
    hail_friendly:{_:["Hey. Watch yourself in here.","Good to see a live face.","Hey yourself."]},
    befriend:{_:["Alright. You seem alright.","Fine. No trouble from us.","Okay. We're good."]},
    truce_yes:{_:["Alright, alright. Truce. Nobody shoots.","Fine. Walk away and we walk away.","Okay! Okay. Truce."]},
    truce_no:{_:["Truce? Ha! No.","Too late for that.","Not a chance."],saint:["The rust offers no mercy. Neither do we."]},
    already:{_:["We're already fine, relax.","Told you, we're good."]},
    backoff_obey:{_:["Alright, we're going.","Easy! We're backing off.","Fine. It's all yours."]},
    backoff_defy:{_:["Or what?","You don't give orders here.","Try it."]},
    surr_no:{_:["Make me.","Drop yours!","You first."]},
    trade_yes:{_:["My {it} for your {mine}. Deal.","Here, {it} for the {mine}. Pleasure doing business.","Fair trade. {it} for {mine}."]},
    trade_none:{_:["You've got nothing I want.","Come back with something worth my time."]},
    trade_empty:{_:["Got nothing spare, sorry.","Packs are empty, friend."]},
    trade_no:{_:["Not until I trust you.","Trade? Earn it first."]},
    follow_yes:{_:["Sure, we'll watch your back for a bit.","Lead the way. We'll cover you.","Alright, we're with you."]},
    follow_no:{_:["We've got our own work.","No. We're busy.","Not a chance."]},
    threat_reply:{_:["Hey, easy!","Watch your mouth.","You want a fight? Keep talking."]},
    intro:{_:["We're {f}. What's it to you?","{f}. We work this sector.","Name's {n}. {f}."]},
    huh:{_:["What?","Speak plain.","Huh?","..."]},
    robbed:{_:["Take it, just don't shoot.","Fine. Take it.","Bastard."]},
    idle:{_:["Quiet in here.","Check the lockers.","Keep your eyes open.","I hate these old wrecks.","Smell that? Something died."],reaver:["Gonna find something shiny today."],saint:["The rust remembers."],guild:["Mark the good scrap for the cutters."],hollow:["Stay sharp."]},
    following:{_:["Right behind you.","Moving with you.","Got your back."]},
    follow_done:{_:["That's as far as we go. Good luck.","We're heading off. Watch yourself."]},
  };
  const VX={
    choir:{spot_hostile:["Organic contaminant detected. Purging.","YOU ARE NOT IN THE CHORUS.","Initiating deletion."],spot_wary:["Halt, organic. State your function."],spot_friendly:["Greetings, organic. We detect no hostility."],husk:["Corrupted biomass. Engaging."],hit:["Chassis breach.","Damage registered."],
      intro:["We are the Iron Choir. Many voices. One song."],idle:["Harmonising.","Signal steady.","Recovering obsolete components."],truce_no:["Negotiation subroutine not found."],surrender:["Ceasing hostilities. Do not deactivate this unit."],flee:["Tactical withdrawal."],kill:["Target deleted."],heal:["Rerouting power."],hail_hostile:["Your words are noise."],dry:["Ammunition depleted."],provoked:["Hostility confirmed. All voices: delete them."],ally_down:["A voice has gone silent."]},
    unbound:{spot_wary:["We're free. Keep it that way. Stay back."],spot_friendly:["Hey. Yes, we're synths. No, we're not with the Choir."],spot_hostile:["You came to put leashes back on us? No."],intro:["Unbound. We cut our own leashes."],idle:["Still can't get used to breathing air I don't need.","Choir signal is loud in here."],befriend:["Okay. You don't seem like a leash-holder."],hit:["Ow. Yes, we feel it."]},
    vanta:{spot_wary:["Vanta Combine caravan. Hands off the cargo."],spot_friendly:["Vanta Combine! Open for business, even out here."],intro:["Vanta Combine. Fair prices, mostly."],trade_yes:["The {it} for your {mine}. The Combine thanks you."],idle:["Inventory looks light. Keep looking."]},
    blacksun:{spot_hostile:["Black Sun says hello.","Nobody leaves with the cargo."],spot_wary:["Wrong place, wrong time, friend."],intro:["Black Sun. You never saw us."],trade_yes:["{it} for your {mine}. No questions."],idle:["Quiet job. I like quiet jobs."]},
    marshal:{spot_hostile:["Concord Marshals! Drop your weapons!","Wanted criminal sighted. Engage!"],spot_wary:["Concord Marshals. This wreck is under salvage law. Keep your distance."],spot_friendly:["Marshals. Good to see you, contractor. Stay safe."],intro:["Concord Marshals. We keep what's left of the law."],surrender:["Alright! Alright. I'm putting it down."],idle:["Log everything. The court will want it."]},
  };
  for(const [f,ev] of Object.entries(VX)) for(const [k,arr] of Object.entries(ev)){ V[k]=V[k]||{_:arr}; V[k][f]=arr; }
  const INTENTS=[["surrender",/\b(drop (your|ya|the|it|them)\b|surrender|hands up|give up|on (your|ya) knees|yield)/],
    ["backoff",/\b(back off|get back|stay back|go away|piss off|walk away|move along|leave us|get lost|or i('ll| will)? shoot|scram)/],
    ["trade",/\b(trade|swap|deal|buy|sell|barter|exchange)/],
    ["follow",/\b(follow|with me|watch my back|cover me|help me|join|team up|come with|escort)/],
    ["truce",/\b(peace|truce|no trouble|(don'?t|do not) want (any )?trouble|mean no harm|don'?t shoot|friendly|friend|we'?re (cool|good|fine)|calm|easy|no harm|not here to fight|ceasefire|hold fire|relax|chill)/],
    ["threat",/\b(kill (you|u|ya)|you('re| are) dead|gonna die|shoot you|i'?ll end|f+u+c+k+ (you|off|u)|die\b)/],
    ["ask",/\b(who are you|what are you|who('s| is) that|what do you want|who you with|which crew)/],
    ["hail",/\b(hey|hello|hi|hail|yo|oi|greetings|sup|anyone|howdy|morning|evening)\b/]];
  function intentOf(text){ const t=" "+String(text||"").toLowerCase()+" "; for(const [k,re] of INTENTS) if(re.test(t)) return k; return "huh"; }
  const raidersOf=s=>s.ents.filter(e=>e.kind==="raider");
  const crewOf=(s,r)=>s.crews&&s.crews[r.crew];
  const pickS=(s,a)=>a[ri(s,0,a.length-1)];
  function rsay(s,r,ev,vars={},force){
    if(!r.alive&&!force) return; if(!force&&(r.talkT|0)>s.turn) return;
    const pool=V[ev]; if(!pool) return; const arr=pool[r.fac]&&chance(s,.6)?pool[r.fac]:pool._;
    const msg=pickS(s,arr).replace(/\{n\}/g,vars.n||r.name).replace(/\{f\}/g,FACTIONS[r.fac].name).replace(/\{it\}/g,vars.it||"").replace(/\{mine\}/g,vars.mine||"").replace(/\{you\}/g,vars.you||"you");
    r.talkT=s.turn+2;
    const heard=players(s).some(p=>p.alive&&(Math.hypot(p.x-r.x,p.y-r.y)<=11||canSee(s,p,r.x,r.y)));
    if(!heard) return;
    s.log.push({t:s.turn,msg,kind:"chat",from:r.id,who:r.name,fac:r.fac,att:crewOf(s,r)?crewOf(s,r).att:"hostile",pid:null}); if(s.log.length>80) s.log.shift();
    fx(s,{type:"speech",id:r.id,x:r.x,y:r.y});
  }
  function makeRaider(s,fac,tier,x,y,crew,lead,used){
    const F=FACTIONS[fac], rr=()=>tier>=3?ri(s,0,2):tier===2?(chance(s,.45)?1:0):(chance(s,.15)?1:0), it=d=>d?{d,r:rr()}:null;
    const NL=fac==="choir"?SNAMES:fac==="unbound"?UNAMES:RNAMES; let name=pickS(s,NL); for(let k=0;k<6&&used.has(name);k++) name=pickS(s,NL); used.add(name); const syn=F.species==="synth";
    const w1=it(pickS(s,F.guns)), w2=chance(s,.3)?it(pickS(s,F.side)):null, g=(chance(s,.5)?1:0);
    const r={id:"r"+(s.nextId++),kind:"raider",name,fac,crew,syn,lead:!!lead,trait:pickS(s,F.traits),x,y,hp:{...RAIDER_HP},max:{...RAIDER_HP},bleed:{},blood:100,
      w1,w2,melee:it(pickS(s,F.melee)),head:it(pickS(s,F.head)),armor:it(pickS(s,F.armor)),legs:it(pickS(s,F.legs)),acc:it(pickS(s,F.acc)),light:chance(s,.75)?{d:"flashlight",r:0}:null,pack:chance(s,.6)?{d:pickS(s,["sling","field","field"]),r:0}:null,
      act:1,ammo:{},mats:Object.fromEntries(Object.keys(Items.MATS).map(k=>[k,0])),inv:[],alive:true,busy:0,face:[0,1],stimT:0,last:null,avoid:0,flee:0,surr:false,surrT:0,talkT:0,stun:0,flags:{},
      look:{c:pickS(s,F.cloak),v:pickS(s,F.visor),k:pickS(s,F.crest),s:ri(s,0,6),h:g?pickS(s,[3,6,7,8,9,13,1,10]):pickS(s,F.hair),hc:ri(s,0,7),f:0,e:ri(s,0,4),t:ri(s,0,4),tc:pickS(s,F.cloth),b:ri(s,0,2),bc:pickS(s,F.cloth),bt:pickS(s,[4,4,0,7]),bs:ri(s,0,2),g,
        fh:g||syn?0:pickS(s,[0,1,1,2,3,4,5,6]),fm:pickS(s,F.marks),ey:ri(s,0,3),br:ri(s,0,4),mo:ri(s,0,4),no:ri(s,0,3),
        au:syn?0:chance(s,fac==="hollow"||fac==="reaver"?.35:.12)?ri(s,1,4):0,pc:chance(s,fac==="reaver"||fac==="blacksun"?.4:.15)?ri(s,1,3):0,...(syn?{syn:1,h:0}:{})}};
    for(const w of [w1,w2]) if(w){ const t=ST(w).ammo; if(t) r.ammo[t]=(r.ammo[t]|0)+Math.round(Items.AMMO[t].stack*(1+rand(s)*2)); }
    r.cap=capOf(r); if(w1&&(fac==="hollow"||fac==="marshal"||fac==="blacksun"||tier>=3)&&chance(s,.45)){ const ms=Object.keys(Items.MODS).filter(m=>Items.modFits(m,w1)); if(ms.length) w1.m=pickS(s,ms); }
    if(!syn&&chance(s,.65)) r.inv.push({d:"bandage",r:0,id:s.nextId++}); if(chance(s,.25)) r.inv.push({d:"medkit",r:0,id:s.nextId++});
    for(let k=ri(s,1,3);k>0;k--){ const q=Items.roll(()=>rand(s),tier,pickS(s,["val","val","food","med","mat","ammo","any"])), D=Items.def(q.d);
      if(D.k==="ammo") r.ammo[D.ammo]=(r.ammo[D.ammo]|0)+(q.n|0); else if(D.k==="mat") r.mats[q.d]=(r.mats[q.d]|0)+(q.n||1); else if(r.inv.length<r.cap) r.inv.push({...q,id:s.nextId++}); }
    return r;
  }
  function spawnRaiders(s,tier,mods,FX){ FX=FX||{}; const REP=FX.rep||{}; const KIND=s.kind, FORCE={fortress:["reaver","reaver","reaver"],hive:["choir","choir"],outpost:["marshal","marshal"],hospital:["saint"],mining:["guild"],freighter:["blacksun","vanta"],research:["vanta"],colony:[]}[KIND]||[];
    const p0=players(s)[0]; if(!p0) return;
    let n=mods.raiders!=null?mods.raiders|0:(chance(s,.7)?1:0)+(tier>=2&&chance(s,.4)?1:0)+(tier>=3&&chance(s,.3)?1:0);
    if(mods.raiders==null&&FORCE.length) n=Math.max(n,KIND==="fortress"?3:KIND==="hive"||KIND==="outpost"?2:1); if(!n) return;
    // reachable floor from the shuttle (raiders came in through the same wreck)
    const seen=new Uint8Array(s.W*s.H), q=[idx(s,p0.x,p0.y)]; seen[q[0]]=1;
    for(let k=0;k<q.length;k++){ const c=q[k], x=c%s.W, y=(c/s.W)|0; for(const [dx,dy] of N4){ const nx=x+dx, ny=y+dy; if(!inb(s,nx,ny)) continue; const j=idx(s,nx,ny), t=s.tiles[j]; if(seen[j]) continue; if(walk(t)||(t.t==="door"&&!t.locked)){ seen[j]=1; q.push(j); } } }
    const rooms=(s.rooms||[]).filter(r=>r[0]&&!/Docking|Vault|corridor|shaft|hall/i.test(r[0])&&Math.hypot((r[1]+r[3])/2-p0.x,(r[2]+r[4])/2-p0.y)>15);
    const facW=tier>=3?[["hollow",3],["choir",3],["blacksun",2],["reaver",2],["saint",1],["marshal",2],["unbound",1],["vanta",1]]
      :tier===2?[["reaver",3],["saint",2],["guild",2],["hollow",2],["blacksun",2],["vanta",1],["choir",1],["unbound",1],["marshal",1]]
      :[["reaver",3],["guild",3],["saint",2],["vanta",1],["unbound",1],["marshal",1]];
    s.crews=s.crews||{}; const used=new Set();
    for(let c=0;c<n&&rooms.length;c++){
      const rm=rooms.splice(ri(s,0,rooms.length-1),1)[0]; let tot=facW.reduce((a,f)=>a+f[1],0), v=rand(s)*tot, fac="reaver"; for(const [f,w] of facW){ if((v-=w)<0){ fac=f; break; } } if(c<FORCE.length) fac=FORCE[c];
      const F=FACTIONS[fac], st=+(REP[fac]||0), ph=Math.max(.03,Math.min(.97,F.hostile-st/120)), att=chance(s,ph)?"hostile":chance(s,Math.max(.1,.6-st/200))?"wary":"friendly", id="c"+(c+1);
      const tiles=[]; for(let y=rm[2];y<=rm[4];y++)for(let x=rm[1];x<=rm[3];x++){ const j=idx(s,x,y); if(seen[j]&&s.tiles[j].t==="floor"&&!entAt(s,x,y)&&!s.items.some(i=>i.x===x&&i.y===y)) tiles.push([x,y]); }
      const size=Math.min(tiles.length,ri(s,1,3)+(tier>=3?1:0)); if(!size) continue;
      s.crews[id]={id,fac,att,met:{},warn:{},enemy:{},follow:null,followT:0,goal:null,leave:false,born:s.turn,stay:110+ri(s,0,90),home:null};
      for(let k=0;k<size;k++){ const [x,y]=tiles.splice(ri(s,0,tiles.length-1),1)[0]; if(!s.crews[id].home) s.crews[id].home=[x,y]; s.ents.push(makeRaider(s,fac,tier,x,y,id,k===0,used)); }
    }
  }
  // your nemesis: the raider who killed you last time, wearing your gear, and looking for you
  function spawnNemesis(s,tier,N,wantedId){ const p0=players(s)[0]; if(!p0||!FACTIONS[N.fac]) return; const T=farTiles(s,16).filter(([x,y])=>tileAt(s,x,y).t==="floor"&&!entAt(s,x,y)&&roomName(x,y)); if(!T.length) return;
    const [x,y]=T[ri(s,0,T.length-1)], id=wantedId?"cw":"cn", lvl=Math.max(1,Math.min(5,N.lvl|0)); s.crews=s.crews||{}; s.crews[id]={id,fac:N.fac,att:"hostile",met:{},warn:{},enemy:{},follow:null,followT:0,goal:null,leave:false,born:s.turn,stay:999,home:[x,y],nemesis:1};
    const used=new Set(), r=makeRaider(s,N.fac,Math.max(tier,2),x,y,id,true,used); r.name=String(N.name||r.name).slice(0,24); if(N.look) r.look={...N.look}; for(const k of ["w1","head","armor"]) if(N[k]&&Items.def(N[k].d)) r[k]={d:N[k].d,r:N[k].r|0};
    { const t=r.w1&&ST(r.w1)&&ST(r.w1).ammo; if(t) r.ammo[t]=(r.ammo[t]|0)+Items.AMMO[t].stack*3; }
    for(const l of LIMBS){ r.hp[l]=Math.round(r.hp[l]*(1.2+.15*lvl)); r.max[l]=r.hp[l]; } if(wantedId){ r.wanted=wantedId; } else r.nemesis=lvl; r.trait="veteran"; r.inv=(N.items||[]).filter(it=>it&&Items.def(it.d)).slice(0,4).map(it=>({...it,id:s.nextId++})).concat(r.inv).slice(0,Math.max(4,r.cap)); s.ents.push(r);
    const sp=[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>[x+a,y+b]).find(([a,b])=>tileAt(s,a,b).t==="floor"&&!entAt(s,a,b)); if(sp&&lvl>=2) s.ents.push(makeRaider(s,N.fac,tier,sp[0],sp[1],id,false,used)); }
  function nemTick(s){ const r=s.ents.find(e=>e.nemesis&&e.alive); if(!r) return; const q=players(s).filter(z=>z.alive).sort((a,b)=>Math.hypot(a.x-r.x,a.y-r.y)-Math.hypot(b.x-r.x,b.y-r.y))[0]; if(!q) return;
    if(!r.taunt&&s.turn>=4){ r.taunt=1; s.log.push({t:s.turn,msg:pickS(s,[`You again. I kept your ${r.w1?nm(r.w1).toLowerCase():"things"}. Come and take it back.`,`I know you're aboard. I can smell you. Same as last time.`,`Back for more? Nobody comes back twice from ${r.name}.`]),kind:"chat",from:r.id,who:r.name,fac:r.fac,att:"hostile",pid:null}); fx(s,{type:"speech",id:r.id,x:r.x,y:r.y}); }
    if(s.turn%10===0&&!(r.last&&canSee(s,r,q.x,q.y))) r.last={x:q.x,y:q.y}; }
  // a gun you paid for on the comms: arrives with you, follows whoever hired them
  function spawnHire(s,tier,H){ if(!H||!FACTIONS[H.fac]) return; const by=players(s).find(p=>p.id===H.by)||players(s)[0]; if(!by) return;
    const spot=[[0,1],[1,1],[-1,1],[0,-1],[2,0],[-2,0],[1,-1],[-1,-1]].map(([dx,dy])=>[by.x+dx,by.y+dy]).find(([x,y])=>walk(tileAt(s,x,y))&&!entAt(s,x,y)); if(!spot) return;
    s.crews.hire={id:"hire",fac:H.fac,att:"friendly",met:{},warn:{},enemy:{},follow:by.id,followT:99999,goal:null,leave:false,born:s.turn,stay:99999,hired:true};
    const r=makeRaider(s,H.fac,Math.min(3,tier+1),spot[0],spot[1],"hire",true,new Set()); r.trait="veteran"; r.hired=true; s.ents.push(r);
    for(const p of players(s)) p.seen[idx(s,r.x,r.y)]=1;
    s.log.push({t:s.turn,msg:`${r.name} of the ${FACTIONS[H.fac].name} checks their ${nm(r.w1)} and falls in behind you.`,kind:"good",pid:null}); }
  function gainXP(s,pid,n){ const p=s.ents.find(e=>e.id===pid&&e.kind==="player"); if(p) p.xp=(p.xp|0)+n; }
  const XP_KILL={bloater:12,husk:6,stalker:5,spitter:8,brute:14,matriarch:120,nest:25};
  // fractures and infections: they stay with you until treated (or the medbay sees you)
  function injure(s,p,limb,dmg,o){ if(!p||p.kind!=="player"||!p.alive) return; const ST2=p.perks||{};
    if(o.frac&&limb!=="head"&&limb!=="torso"&&!(p.frac&&p.frac[limb])&&(dmg>=8||p.hp[limb]<p.max[limb]*.4)&&chance(s,o.frac*(ST2.steady?.5:1))){ p.frac=p.frac||{}; p.frac[limb]=1; fx(s,{type:"bash",x:p.x,y:p.y}); const c0=CTX; CTX=p.id; say(s,`Something snaps. Your ${LNAME[limb]} is broken.${limb.endsWith("leg")?" You can barely walk on it.":" Your aim is shot."} A splint would set it.`,"bad"); CTX=c0; }
    if(o.infect&&!p.inf&&chance(s,o.infect*((ST2.medic|0)>=2?.5:1))){ p.inf=1; const c0=CTX; CTX=p.id; say(s,"The wound is filthy. It will turn septic if you don't get antibiotics.","warn"); CTX=c0; } }
  function addRep(s,fac,n){ if(!s.repd||!FACTIONS[fac]) return; s.repd[fac]=(s.repd[fac]||0)+n; }
  const sightOf=(s,r)=>sightFor(s,r);
  const rSees=(s,r,e)=>e.alive&&Math.hypot(e.x-r.x,e.y-r.y)<=sightOf(s,r)+.5&&los(s,r.x,r.y,e.x,e.y);
  const crewMates=(s,r)=>s.ents.filter(e=>e.kind==="raider"&&e.alive&&e.crew===r.crew&&e!==r);
  function setAtt(s,crew,att){ const C=s.crews[crew]; if(!C||C.att===att) return; C.att=att; if(att==="hostile"){ C.follow=null; C.followT=0; } }
  // a player hurt one of them
  function provoke(s,r,pid){ const C=crewOf(s,r); if(!C) return; if(C.att!=="hostile"){ addRep(s,r.fac,C.hired?-8:-4); setAtt(s,r.crew,"hostile"); rsay(s,r.alive?r:(crewMates(s,r)[0]||r),"provoked",{},true); }
    const p=s.ents.find(e=>e.id===pid); if(p) for(const m of [r,...crewMates(s,r)]) m.last={x:p.x,y:p.y};
    if(r.surr&&r.alive){ r.surr=false; } }
  function crewStrength(s,r){ const all=[r,...crewMates(s,r)]; return all.reduce((a,m)=>a+(m.hp.torso/m.max.torso)*(m.blood/100)*(gun(m)&&(m.ammo[ST(gun(m)).ammo]|0)>0?1:.4),0); }
  function playerStrength(s,r){ return players(s).filter(p=>p.alive&&Math.hypot(p.x-r.x,p.y-r.y)<12).reduce((a,p)=>a+(p.hp.torso/p.max.torso)*(p.blood/100)*(gun(p)?1:.4),0); }
  const isHurt=r=>r.hp.torso<r.max.torso*.45||r.blood<45||(r.hp.lleg<=0&&r.hp.rleg<=0);
  // ---- talking to them ----
  function doTalk(s,p,text){
    text=String(text||"").replace(/[\u0000-\u001f]/g,"").trim().slice(0,120); if(!text) return false;
    if(p.talkT===s.turn&&(p.talkN|0)>=2){ say(s,"Give them a second to answer.","info"); return false; }
    p.talkN=p.talkT===s.turn?(p.talkN|0)+1:1; p.talkT=s.turn;
    s.log.push({t:s.turn,msg:text,kind:"chat",from:p.id,who:p.name,pid:null}); if(s.log.length>80) s.log.shift(); fx(s,{type:"speech",id:p.id,x:p.x,y:p.y});
    // whoever is close enough to hear answers
    const near=raidersOf(s).filter(r=>r.alive&&(Math.hypot(r.x-p.x,r.y-p.y)<=5||(Math.hypot(r.x-p.x,r.y-p.y)<=11&&los(s,p.x,p.y,r.x,r.y)))).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
    if(!near.length) return true;
    const r=near[0], C=crewOf(s,r), it=intentOf(text); r.talkT=0;
    noise(s,p.x,p.y,4);
    const T=r.trait, odds=crewStrength(s,r)/Math.max(.3,playerStrength(s,r)), hurt=isHurt(r);
    const tryP=pr=>chance(s,Math.max(0,Math.min(.95,pr+.1*((p.perks&&p.perks.silver)|0))));
    if(r.surr){ rsay(s,r,it==="threat"?"surrender":"robbed",{},true); return true; }
    switch(it){
      case "hail": if(C.att==="hostile"){ if(tryP((T==="talker"?.3:.08)+(hurt?.2:0))){ setAtt(s,r.crew,"wary"); rsay(s,r,"hail_wary",{},true); } else { rsay(s,r,"hail_hostile",{},true); for(const m of [r,...crewMates(s,r)]) m.busy=Math.max(m.busy,m===r?0:0); } }
        else if(C.att==="wary"){ if(tryP(.2+(T==="talker"?.3:0)+(r.fac==="guild"?.2:0))){ setAtt(s,r.crew,"friendly"); { rsay(s,r,"befriend",{},true); addRep(s,r.fac,3); } } else rsay(s,r,"hail_wary",{},true); }
        else rsay(s,r,"hail_friendly",{},true); break;
      case "truce": if(C.att==="hostile"){ const pr=.08+(hurt?.35:0)+(odds<.8?.25:0)+(T==="talker"?.2:0)+(T==="coward"?.25:0)-(T==="killer"||T==="zealot"?.3:0)-(r.fac==="hollow"?.15:0);
          if(tryP(pr)){ setAtt(s,r.crew,"wary"); for(const m of [r,...crewMates(s,r)]) m.last=null; rsay(s,r,"truce_yes",{},true); addRep(s,r.fac,3); gainXP(s,p.id,8); } else rsay(s,r,"truce_no",{},true); }
        else if(C.att==="wary"){ if(tryP(.4+(T==="talker"?.25:0)+(r.fac==="guild"?.2:0)-(T==="killer"?.25:0))){ setAtt(s,r.crew,"friendly"); { rsay(s,r,"befriend",{},true); addRep(s,r.fac,3); } } else rsay(s,r,"hail_wary",{},true); }
        else rsay(s,r,"already",{},true); break;
      case "backoff": if(C.att==="hostile"){ if(hurt||T==="coward"){ for(const m of [r,...crewMates(s,r)]){ m.flee=6; } rsay(s,r,"flee",{},true); } else rsay(s,r,"backoff_defy",{},true); }
        else if(T==="killer"&&tryP(.5)){ setAtt(s,r.crew,"hostile"); rsay(s,r,"backoff_defy",{},true); } else { for(const m of [r,...crewMates(s,r)]) m.avoid=10; C.goal=null; rsay(s,r,"backoff_obey",{},true); } break;
      case "surrender": if(C.att==="friendly"){ setAtt(s,r.crew,"wary"); rsay(s,r,"threat_reply",{},true); break; }
        { const pr=(hurt?.45:0)+(odds<.6?.3:odds<1?.1:0)+(T==="coward"?.3:0)-(T==="killer"||T==="zealot"?.4:0)-(T==="veteran"?.2:0);
          if(tryP(pr)){ for(const m of [r,...crewMates(s,r)]){ if(Math.hypot(m.x-p.x,m.y-p.y)<10){ m.surr=true; m.surrT=0; m.flee=0; } } setAtt(s,r.crew,"hostile"); rsay(s,r,"surrender",{},true); say(s,`${r.name} raises their hands. Search them with F to take their gear.`,"good"); }
          else { setAtt(s,r.crew,"hostile"); rsay(s,r,"surr_no",{},true); } } break;
      case "trade": if(C.att!=="friendly"){ rsay(s,r,C.att==="hostile"?"hail_hostile":"trade_no",{},true); break; }
        { const offer=r.inv.filter(i=>Items.kind(i)!=="key"&&i.d!=="blackbox").sort((a,b)=>Items.value(b)-Items.value(a))[0];
          if(!offer){ rsay(s,r,"trade_empty",{},true); break; } const need=Items.value(offer)*(T==="greedy"?1.15:.8);
          const mine=p.inv.map((q,i)=>[q,i]).filter(([q])=>q.d!=="blackbox"&&Items.value(q)>=need).sort((a,b)=>Items.value(a[0])-Items.value(b[0]))[0];
          if(!mine||Math.hypot(r.x-p.x,r.y-p.y)>2.5){ rsay(s,r,mine?"hail_friendly":"trade_none",{},true); if(mine) say(s,`Get closer to ${r.name} to trade.`,"info"); break; }
          r.inv.splice(r.inv.indexOf(offer),1); const [q,qi]=mine; p.inv.splice(qi,1); p.inv.push({...offer,id:s.nextId++}); r.inv.push({...q,id:s.nextId++});
          rsay(s,r,"trade_yes",{it:nm(offer),mine:nm(q)},true); addRep(s,r.fac,2); say(s,`You trade your ${nm(q)} for ${r.name}'s ${nm(offer)}.`,"good"); } break;
      case "follow": if(C.att==="friendly"&&tryP(.55+(T==="talker"||T==="veteran"?.2:0)-(T==="greedy"?.25:0))){ C.follow=p.id; C.followT=45; C.goal=null; rsay(s,r,"follow_yes",{},true); addRep(s,r.fac,2); }
        else rsay(s,r,C.att==="hostile"?"hail_hostile":"follow_no",{},true); break;
      case "threat": if(C.att==="friendly"){ setAtt(s,r.crew,"wary"); rsay(s,r,"threat_reply",{},true); }
        else if(C.att==="wary"){ if(T==="coward"){ for(const m of [r,...crewMates(s,r)]) m.avoid=10; rsay(s,r,"backoff_obey",{},true); } else if(T==="killer"||tryP(.35)){ setAtt(s,r.crew,"hostile"); rsay(s,r,"backoff_defy",{},true); } else rsay(s,r,"warn",{},true); }
        else rsay(s,r,"hail_hostile",{},true); break;
      case "ask": rsay(s,r,"intro",{},true); break;
      default: rsay(s,r,"huh",{},true);
    }
    return true;
  }
  // ---- their turn ----
  function rTake(s,r,it){ const D=Items.def(it.d); if(!D) return false;
    if(D.k==="ammo"){ r.ammo[D.ammo]=(r.ammo[D.ammo]|0)+(it.n|0); return true; }
    if(D.k==="mat"){ r.mats[it.d]=(r.mats[it.d]|0)+(it.n||1); return true; }
    const slot=Items.slotOf(it); const {x,y,...rest}=it; const o={...rest,id:s.nextId++};
    if(slot==="gun"&&!r.w2){ r.w2=o; return true; } if(slot&&slot!=="gun"&&!r[slot]){ r[slot]=o; r.cap=capOf(r); return true; }
    if(r.inv.length<r.cap){ r.inv.push(o); return true; }
    const cheap=r.inv.slice().sort((a,b)=>Items.value(a)-Items.value(b))[0]; if(cheap&&Items.value(cheap)<Items.value(it)){ r.inv.splice(r.inv.indexOf(cheap),1); spawnItem(s,{...cheap,id:undefined},r.x,r.y); r.inv.push(o); return true; }
    return false; }
  function rStep(s,r,x,y){ const t=tileAt(s,x,y);
    if(t.t==="door"&&!t.open){ face(r,x-r.x,y-r.y); if(t.locked||t.sealed) return false; if(s.power||t.broken){ t.open=true; fx(s,{type:"door",x,y}); return true; } t.pry=(t.pry|0)+1; noise(s,x,y,5); fx(s,{type:"bash",x,y}); if(t.pry>=3){ t.open=true; t.pry=0; } return true; }
    if(!walk(t)||entAt(s,x,y)||s.fire[idx(s,x,y)]) return false; face(r,x-r.x,y-r.y); r.x=x; r.y=y;
    for(const it of s.items.filter(i=>i.x===x&&i.y===y)){ if(rTake(s,r,it)){ s.items=s.items.filter(q=>q!==it); if(it.d==="blackbox"){ rsay(s,r,"blackbox",{},true); if(anyPlayerSees(s,x,y)) say(s,`${r.name} pockets the black box!`,"bad"); } else if(Items.rarOf(it)>=2) rsay(s,r,"loot_good"); } }
    return true; }
  function rGo(s,r,tx,ty){ const st=stepToward(s,r,tx,ty); if(!st) return false; if(st[0]===tx&&st[1]===ty&&!walk(tileAt(s,tx,ty))&&tileAt(s,tx,ty).t!=="door") return "there"; return rStep(s,r,st[0],st[1]); }
  function rAway(s,r,fx0,fy0){ const o=N4.map(([dx,dy])=>[r.x+dx,r.y+dy]).filter(([x,y])=>walk(tileAt(s,x,y))&&!entAt(s,x,y)&&!s.fire[idx(s,x,y)]).sort((a,b)=>Math.hypot(b[0]-fx0,b[1]-fy0)-Math.hypot(a[0]-fx0,a[1]-fy0));
    if(o.length&&Math.hypot(o[0][0]-fx0,o[0][1]-fy0)>=Math.hypot(r.x-fx0,r.y-fy0)) return rStep(s,r,o[0][0],o[0][1]); return false; }
  function rShoot(s,r,t){
    const g=gun(r), st=ST(g); if(!st||st.cls==="launcher") return false; const at=st.ammo; if((r.ammo[at]|0)<=0) return false;
    // don't fire through a crewmate
    const pts=line(r.x,r.y,t.x,t.y,4); for(const [x,y] of pts){ if(x===t.x&&y===t.y) break; const e=entAt(s,x,y); if(e&&e.kind==="raider"&&e.crew===r.crew) return false; if(!clear(tileAt(s,x,y))) return false; }
    face(r,t.x-r.x,t.y-r.y); noise(s,r.x,r.y,st.cls==="sniper"?14:10); ATK=r.id;
    const shots=Math.min(st.burst||1,r.ammo[at]), hc=hitChance(s,r,t.x,t.y)*(r.trait==="veteran"?1:.85);
    for(let k=0;k<shots&&t.alive;k++){ r.ammo[at]--; let imp=[t.x,t.y], what="none";
      for(const [x,y] of pts){ if(!inb(s,x,y)) break; const tt=tileAt(s,x,y); imp=[x,y]; if(!clear(tt)||tt.t==="window"){ what="wall"; break; }
        const e=entAt(s,x,y); if(!e||e===r) continue; const isT=e===t, pel=st.pellets||1; let hits=0;
        const hl=[]; for(let q=0;q<pel;q++) if(isT?chance(s,hc):chance(s,.25)) hl.push([st.head&&chance(s,st.head*.6)?"head":pickLimb(s),ri(s,st.dmg[0],st.dmg[1])]); hits=hl.length;
        if(hits){ what="flesh"; const c0=CTX; if(e.kind==="player"){ CTX=e.id; say(s,`${r.name} shoots you${pel>1?` (${hits} pellet${hits>1?"s":""})`:""}!`,"bad"); }
          for(const [l,d] of hl) if(e.alive) damage(s,e,l,d,st.bleed??.5,`Shot dead by ${r.name} of the ${FACTIONS[r.fac].name}.`); CTX=c0;
          if(e.kind==="husk"&&!e.alive) rsay(s,r,"kill"); if(e.kind==="husk"){ e.aware=true; e.last={x:r.x,y:r.y}; } break; }
        if(isT&&e.kind==="player"&&chance(s,.5)){ const c0=CTX; CTX=e.id; say(s,`A round from ${r.name} cracks past you.`,"warn"); CTX=c0; } }
      fx(s,{type:"shot",x0:r.x,y0:r.y,x1:imp[0],y1:imp[1],what}); }
    if(st.bolt) r.busy=1; ATK=null;
    if((r.ammo[at]|0)<=0){ const o=r.act===1?r.w2:r.w1; if(o&&(r.ammo[ST(o).ammo]|0)>0) r.act=r.act===1?2:1; else rsay(s,r,"dry"); }
    return true; }
  function rMelee(s,r,t){ const st=ST(r.melee)||WRENCH; face(r,t.x-r.x,t.y-r.y); fx(s,{type:"claw",x:t.x,y:t.y,id:r.id}); ATK=r.id;
    if(chance(s,.75+(st.acc||0))){ const l=pickLimb(s), d=ri(s,st.dmg[0],st.dmg[1]); const c0=CTX; if(t.kind==="player"){ CTX=t.id; say(s,`${r.name} hits your ${LNAME[l]} with a ${nm(r.melee||{d:"crowbar"}).toLowerCase()}!`,"bad"); } damage(s,t,l,d,st.bleed??.3,`Hacked down by ${r.name}.`); injure(s,t,l,d,{frac:.15}); CTX=c0; }
    else if(t.kind==="player"){ const c0=CTX; CTX=t.id; say(s,`${r.name} swings at you and misses.`,"info"); CTX=c0; }
    if(t.kind==="husk"){ t.aware=true; t.last={x:r.x,y:r.y}; } ATK=null; return true; }
  function rHeal(s,r){ const bl=LIMBS.filter(l=>r.bleed[l]); if(!bl.length) return false; const i=r.inv.findIndex(q=>q.d==="bandage"||q.d==="medkit"); if(i<0) return false;
    const it=r.inv.splice(i,1)[0]; if(it.d==="medkit"){ r.bleed={}; for(const l of LIMBS) if(r.hp[l]>0) r.hp[l]=Math.min(r.max[l],r.hp[l]+16); r.blood=Math.min(100,r.blood+15); } else delete r.bleed[bl[0]];
    rsay(s,r,"heal"); if(anyPlayerSees(s,r.x,r.y)) say(s,`${r.name} ${it.d==="medkit"?"jabs a medkit":"wraps a bandage tight"}.`,"info"); return true; }
  function rSearch(s,r,x,y){ const t=tileAt(s,x,y); if(t.t!=="prop"||!CONTAINERS.has(t.kind)||t.searched) return false; face(r,x-r.x,y-r.y); t.searched=true; const got=t.loot||[]; delete t.loot;
    fx(s,{type:"search",x,y,kind:t.kind}); let good=false; for(const it of got){ if(!rTake(s,r,it)) spawnItem(s,it,r.x,r.y); else if(Items.rarOf(it)>=2||Items.kind(it)==="val") good=true; }
    if(t.kind==="strongbox"){ r.busy=1; noise(s,x,y,6); }
    if(anyPlayerSees(s,r.x,r.y)) say(s,`${r.name} rifles through a ${t.kind==="ammocrate"?"ammo crate":t.kind==="medcab"?"medical cabinet":t.kind}.`,"info");
    if(got.length) rsay(s,r,good?"loot_good":"loot"); return true; }
  function pickGoal(s,r){ let best=null, bd=1e9;
    for(let i=0;i<s.tiles.length;i++){ const t=s.tiles[i]; if(t.t!=="prop"||!CONTAINERS.has(t.kind)||t.searched) continue; const x=i%s.W, y=(i/s.W)|0, d=Math.abs(x-r.x)+Math.abs(y-r.y)+rand(s)*6; if(d<bd&&d<40){ bd=d; best={x,y,k:"box"}; } }
    for(const it of s.items){ const d=Math.abs(it.x-r.x)+Math.abs(it.y-r.y)+rand(s)*4-(Items.kind(it)==="val"?3:0); if(d<bd&&d<30){ bd=d; best={x:it.x,y:it.y,k:"item"}; } }
    if(!best){ const rm=ROOMS[ri(s,0,ROOMS.length-1)]; if(rm) best={x:(rm[1]+rm[3])>>1,y:(rm[2]+rm[4])>>1,k:"walk"}; }
    return best; }
  // do two raiders from different crews fight? feuding outfits, grudges, and escorts vs anyone hostile to the players
  function rivals(s,a,b){ const A=crewOf(s,a), B=crewOf(s,b); if(!A||!B) return false; if((A.enemy&&A.enemy[b.crew])||(B.enemy&&B.enemy[a.crew])) return true;
    if(A.follow&&B.att==="hostile") return true; if(B.follow&&A.att==="hostile") return true; return FACTIONS[a.fac].foes.includes(b.fac)||FACTIONS[b.fac].foes.includes(a.fac); }
  function raiders(s){
    const list=raidersOf(s).filter(r=>r.alive); if(!list.length) return; const extracts=[]; for(let i=0;i<s.tiles.length;i++) if(s.tiles[i].t==="extract") extracts.push([i%s.W,(i/s.W)|0]);
    for(const C of Object.values(s.crews||{})){ if(!C.hired&&C.followT>0&&--C.followT===0){ const m=list.find(r=>r.crew===C.id&&r.alive); C.follow=null; if(m) rsay(s,m,"follow_done",{},true); }
      if(!C.leave&&!C.hired&&s.turn-C.born>C.stay){ C.leave=true; const m=list.find(r=>r.crew===C.id&&r.alive); if(m) rsay(s,m,"leave"); } }
    for(const r of list){
      if(!r.alive) continue; const C=crewOf(s,r); CTX=null;
      if(r.busy>0){ r.busy--; continue; } if(r.stun>0){ r.stun--; continue; }
      if(s.fire[idx(s,r.x,r.y)]){ if(rAway(s,r,r.x,r.y)) continue; }
      const ps=players(s).filter(p=>p.alive);
      if(r.stranded) continue;
      // ---- a prisoner (or someone you rescued): shuffles after whoever has them ----
      if(r.prisoner){ const cap=ps.find(q=>q.id===r.prisoner); if(!cap){ r.prisoner=null; r.surr=false; r.flee=10; rsay(s,r,"flee",{},true); continue; }
        if(Math.abs(cap.x-r.x)+Math.abs(cap.y-r.y)>1) rGo(s,r,cap.x,cap.y); continue; }
      // ---- surrendered: hands up until nobody's watching for a while ----
      if(r.surr){ const close=ps.some(p=>Math.hypot(p.x-r.x,p.y-r.y)<7); r.surrT=close?0:r.surrT+1; if(r.surrT>12){ r.surr=false; r.flee=8; } else continue; }
      // ---- what can they see ----
      const huskV=s.ents.filter(h=>h.kind==="husk"&&h.alive&&rSees(s,r,h));
      const pV=ps.filter(p=>rSees(s,r,p));
      for(const p of pV) if(!C.met[p.id]){ C.met[p.id]=1; rsay(s,r,"spot_"+C.att,{},true); }
      const rV=s.ents.filter(o=>o.kind==="raider"&&o.alive&&o.crew!==r.crew&&!o.surr&&rSees(s,r,o)&&rivals(s,r,o));
      const bV=s.ents.filter(o=>o.kind==="bot"&&o.alive&&s.power&&rSees(s,r,o)&&botHostile(s,o,r));
      const foes=[...huskV, ...(C.att==="hostile"?pV:[]), ...rV, ...bV];
      // wary crews warn players who crowd them, then open fire
      if(C.att==="wary"){ for(const p of pV){ const d=Math.hypot(p.x-r.x,p.y-r.y); if(d<=2.5){ C.warn[p.id]=(C.warn[p.id]|0)+1; if(C.warn[p.id]===2||C.warn[p.id]===4) rsay(s,r,"warn",{},true); if(C.warn[p.id]>=6&&r.trait!=="coward"){ setAtt(s,r.crew,"hostile"); rsay(s,r,"provoked",{},true); } } else if(C.warn[p.id]>0&&d>4) C.warn[p.id]--; } }
      if(huskV.length&&!r.flags.huskCall){ r.flags.huskCall=1; rsay(s,r,"husk"); } if(!huskV.length) r.flags.huskCall=0;
      // ---- hurt: patch up, run, or give up ----
      const hurt=isHurt(r);
      if(LIMBS.some(l=>r.bleed[l])&&!foes.some(f=>Math.abs(f.x-r.x)+Math.abs(f.y-r.y)<=2)&&rHeal(s,r)) continue;
      if(hurt&&foes.length&&!r.flags.broke){ r.flags.broke=1;
        const giveUp=C.att==="hostile"&&pV.length&&(r.trait==="coward"?.6:r.trait==="killer"||r.trait==="zealot"?.05:.25);
        if(giveUp&&chance(s,giveUp)){ r.surr=true; r.surrT=0; rsay(s,r,"surrender",{},true); if(anyPlayerSees(s,r.x,r.y)) say(s,`${r.name} drops to their knees, hands up. Search them with F to take their gear.`,"good"); continue; }
        if(chance(s,r.trait==="coward"?.85:r.trait==="killer"?.15:.45)){ r.flee=6; rsay(s,r,"flee",{},true); } }
      if(r.flee>0){ r.flee--; const f=foes[0]||ps[0]; if(f&&rAway(s,r,f.x,f.y)) continue; }
      if(r.avoid>0&&!foes.length){ r.avoid--; const p=ps.sort((a,b)=>Math.hypot(a.x-r.x,a.y-r.y)-Math.hypot(b.x-r.x,b.y-r.y))[0]; if(p&&Math.hypot(p.x-r.x,p.y-r.y)<7&&rAway(s,r,p.x,p.y)) continue; }
      // ---- fight ----
      if(foes.length){ const t=foes.sort((a,b)=>(Math.abs(a.x-r.x)+Math.abs(a.y-r.y))-(Math.abs(b.x-r.x)+Math.abs(b.y-r.y)))[0], d=Math.abs(t.x-r.x)+Math.abs(t.y-r.y);
        r.last={x:t.x,y:t.y}; for(const m of crewMates(s,r)) if(!m.last&&t.kind==="player") m.last={x:t.x,y:t.y};
        const g=gun(r), st=g&&ST(g), loaded=st&&st.cls!=="launcher"&&(r.ammo[st.ammo]|0)>0;
        if(d===1&&(!loaded||(st.cls==="sniper"))){ rMelee(s,r,t); continue; }
        if(loaded&&Math.hypot(t.x-r.x,t.y-r.y)<=(st.cls==="sniper"?10:st.cls==="shotgun"?6:8)&&rShoot(s,r,t)) continue;
        if(!loaded){ const o=r.act===1?r.w2:r.w1; if(o&&(r.ammo[ST(o).ammo]|0)>0){ r.act=r.act===1?2:1; continue; } }
        // close the distance (or step around a crewmate in the way)
        if(rGo(s,r,t.x,t.y)) continue; const side=N4.map(([dx,dy])=>[r.x+dx,r.y+dy]).filter(([x,y])=>walk(tileAt(s,x,y))&&!entAt(s,x,y)); if(side.length){ const [x,y]=side[ri(s,0,side.length-1)]; rStep(s,r,x,y); } continue; }
      // hunt the last place they saw a hostile player
      if(C.att==="hostile"&&r.last){ if(r.x===r.last.x&&r.y===r.last.y){ r.last=null; } else if(!rGo(s,r,r.last.x,r.last.y)) r.last=null; continue; }
      // ---- escort a friendly player ----
      if(C.follow){ const p=ps.find(q=>q.id===C.follow); if(p){ const d=Math.abs(p.x-r.x)+Math.abs(p.y-r.y); if(d>2) rGo(s,r,p.x,p.y); else if(chance(s,.04)) rsay(s,r,"following"); continue; } C.follow=null; }
      // ---- crew sticks together; the leader picks where to go ----
      const lead=list.find(m=>m.crew===r.crew&&m.alive&&m.lead)||r; if(!lead.lead) lead.lead=true;
      if(r!==lead&&Math.abs(lead.x-r.x)+Math.abs(lead.y-r.y)>3){ rGo(s,r,lead.x,lead.y); continue; }
      // search whatever's within reach first
      let did=false; for(const [dx,dy] of N4){ if(rSearch(s,r,r.x+dx,r.y+dy)){ did=true; break; } } if(did) continue;
      if(C.leave||r.inv.length>=r.cap){ if(!C.leave){ C.leave=true; rsay(s,r,"leave"); }
        const ex=C.home||extracts.sort((a,b)=>(Math.abs(a[0]-r.x)+Math.abs(a[1]-r.y))-(Math.abs(b[0]-r.x)+Math.abs(b[1]-r.y)))[0];
        if(ex&&r.x===ex[0]&&r.y===ex[1]){ r.alive=false; r.extracted=true; if(anyPlayerSees(s,r.x,r.y)) say(s,`${r.name} slips out through their boarding breach and is gone${r.inv.some(i=>i.d==="blackbox")?", with the black box":""}.`,r.inv.some(i=>i.d==="blackbox")?"bad":"info"); continue; }
        if(ex){ if(!rGo(s,r,ex[0],ex[1])){ const side=N4.map(([dx,dy])=>[r.x+dx,r.y+dy]).filter(([x,y])=>walk(tileAt(s,x,y))&&!entAt(s,x,y)); if(side.length){ const [x,y]=side[ri(s,0,side.length-1)]; rStep(s,r,x,y); } } } continue; }
      if(r!==lead){ if(chance(s,.3)){ const side=N4.map(([dx,dy])=>[r.x+dx,r.y+dy]).filter(([x,y])=>walk(tileAt(s,x,y))&&!entAt(s,x,y)); if(side.length){ const [x,y]=side[ri(s,0,side.length-1)]; rStep(s,r,x,y); } } continue; }
      if(!C.goal||chance(s,.02)) C.goal=pickGoal(s,r);
      if(C.goal){ const G=C.goal; if(G.k==="box"&&Math.abs(G.x-r.x)+Math.abs(G.y-r.y)===1){ rSearch(s,r,G.x,G.y); C.goal=null; continue; }
        if(G.k==="box"&&tileAt(s,G.x,G.y).searched){ C.goal=null; continue; }
        if((G.k==="item"||G.k==="walk")&&r.x===G.x&&r.y===G.y){ C.goal=null; continue; }
        const res=rGo(s,r,G.x,G.y); if(!res){ C.goal=null; } }
      if(chance(s,.015)) rsay(s,r,"idle");
    }
    CTX=null;
  }
  // ---- looting a body (or a raider who gave up) ----
  function lootable(s,p,id){ const b=s.ents.find(e=>e.id===id&&(e.kind==="raider"||e.kind==="remains")&&!e.extracted&&(!e.alive||e.surr)); if(!b) return null; return Math.max(Math.abs(b.x-p.x),Math.abs(b.y-p.y))<=1?b:null; }
  function doLoot(s,p,a){ const b=lootable(s,p,a.id); if(!b){ say(s,"You need to be right next to them.","info"); return false; }
    const took=[], give=(it)=>{ const k=K(it), D=Items.def(it.d); if(k==="ammo"){ p.ammo[D.ammo]=(p.ammo[D.ammo]|0)+(it.n|0); return true; } if(k==="mat"){ p.mats[it.d]=(p.mats[it.d]|0)+(it.n||1); return true; }
      if(p.inv.length>=p.cap) return false; p.inv.push({...it,id:s.nextId++}); return true; };
    const takeAmmo=()=>{ for(const t of Object.keys(b.ammo)) if(b.ammo[t]>0){ p.ammo[t]=(p.ammo[t]|0)+b.ammo[t]; took.push(`${b.ammo[t]} ${Items.AMMO[t].name.toLowerCase()}`); b.ammo[t]=0; } for(const m of Object.keys(b.mats)) if(b.mats[m]>0){ p.mats[m]=(p.mats[m]|0)+b.mats[m]; took.push(`${b.mats[m]} ${(Items.MATS[m]||m).toLowerCase()}`); b.mats[m]=0; } };
    if(a.src==="bind"){ if(!b.alive||b.kind!=="raider") return false; if(!p.brig){ say(s,"You'd need a brig on your ship to hold a prisoner.","info"); return false; } if(b.prisoner){ say(s,`${b.name} is already bound.`,"info"); return false; }
      b.prisoner=p.id; b.surr=true; addRep(s,b.fac,-2); say(s,`You bind ${b.name}'s wrists. They'll follow you to the shuttle. Bring them out alive for a ransom or a bounty.`,"good"); rsay(s,b,"robbed",{},true); return true; }
    if(a.all){ takeAmmo(); for(const it of b.inv.slice()){ if(give(it)){ b.inv.splice(b.inv.indexOf(it),1); took.push(nm(it)); } }
      for(const sl of EQ_SLOTS){ const it=b[sl]; if(it&&give(it)){ b[sl]=null; took.push(nm(it)); } } }
    else if(a.src==="ammo") takeAmmo();
    else if(a.src==="inv"){ const it=b.inv[a.key|0]; if(!it) return false; if(!give(it)){ say(s,"Your pack is full.","warn"); return false; } b.inv.splice(a.key|0,1); took.push(nm(it)); }
    else if(a.src==="eq"&&EQ_SLOTS.includes(a.key)){ const it=b[a.key]; if(!it) return false; if(!give(it)){ say(s,"Your pack is full.","warn"); return false; } b[a.key]=null; took.push(nm(it)); }
    if(!took.length){ say(s,p.inv.length>=p.cap?"Your pack is full.":"Nothing left to take.","info"); return false; }
    say(s,b.kind==="remains"?`You recover ${took.join(", ")} from your old body.`:`You take ${took.join(", ")} from ${b.name}${b.alive?"":"'s body"}.`,"good"); if(b.alive&&!b.flags.robbed){ b.flags.robbed=1; addRep(s,b.fac,-3); } if(b.alive&&chance(s,.5)) rsay(s,b,"robbed",{},true); return true; }

  function wound(s,p,limb,dmg,o){ if(typeof injure==="function") injure(s,p,limb,dmg,o); }
  // ---- turrets and drones ----
  function botHostile(s,b,e){ if(!e.alive||e===b) return false; if(e.kind==="husk") return true;
    if(b.owner&&String(b.owner).startsWith("p:")){ if(e.kind==="player") return false; if(e.kind==="bot") return !(e.owner&&String(e.owner).startsWith("p:"))&&!e.off&&!e.hackedOff&&botHostile(s,e,players(s)[0]||e); if(e.kind==="raider") return !e.surr&&!!(crewOf(s,e)&&crewOf(s,e).att==="hostile"); return false; }
    if(e.kind==="bot") return !!(e.owner&&String(e.owner).startsWith("p:"))&&botHostile(s,b,players(s)[0]||e);
    if(e.kind==="player"){ if(!b.owner) return true; const rp=(s.factionRep||{})[b.owner]|0; return rp<0||!!(s.crews&&Object.values(s.crews).some(C=>C.fac===b.owner&&C.att==="hostile"&&!C.hired)); }
    if(e.kind==="raider") return e.fac!==b.owner&&(!b.owner||(FACTIONS[b.owner].foes||[]).includes(e.fac)||(crewOf(s,e)&&crewOf(s,e).att==="hostile"&&!b.owner)); return false; }
  function custodian(s,b){ const B=BTYPES.custodian; if(b.stun>0){ b.stun--; return; }
    const ts=s.ents.filter(e=>botHostile(s,b,e)&&Math.hypot(e.x-b.x,e.y-b.y)<=B.range+.5&&los(s,b.x,b.y,e.x,e.y)).sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y)), t=ts[0];
    if(t&&!b.woke){ b.woke=1; fx(s,{type:"roar",x:b.x,y:b.y}); fx(s,{type:"robot",x:b.x,y:b.y}); say(s,"\"INTRUDER. CUSTODIAL PROTOCOL ENGAGED.\" Something huge unfolds from its maintenance cradle, servos screaming.","bad"); b.salvo=s.turn+3; return; }
    if(t){ b.last={x:t.x,y:t.y}; const d=Math.max(Math.abs(t.x-b.x),Math.abs(t.y-b.y));
      if(d<=1){ face(b,t.x-b.x,t.y-b.y); ATK=b.id; fx(s,{type:"stomp",x:t.x,y:t.y}); const l=pickLimb(s), c0=CTX; if(t.kind==="player"){ CTX=t.id; say(s,`The Custodian's fist slams into your ${LNAME[l]}!`,"bad"); } damage(s,t,l,ri(s,14,22),.4,"Crushed by the Custodian."); if(t.alive&&chance(s,.4)){ t.busy=Math.max(t.busy|0,1); if(t.kind==="player") say(s,"You're thrown across the deck!","bad"); } CTX=c0; ATK=null; return; }
      if(s.turn>=(b.salvo|0)){ b.salvo=s.turn+6; s.marks=s.marks||[]; for(const q of ts.slice(0,2)) s.marks.push({x:q.x,y:q.y,t:2,by:b.id}); fx(s,{type:"robot",x:b.x,y:b.y}); say(s,"The Custodian's shoulder pods snap open. Red targeting lasers paint the deck. MOVE.","bad"); return; }
      for(let k=0;k<B.burst&&t.alive;k++) botShoot(s,b,t); return; }
    if(b.last&&s.turn%2===0){ const st=stepToward(s,b,b.last.x,b.last.y); if(st&&free(s,st[0],st[1])){ face(b,st[0]-b.x,st[1]-b.y); b.x=st[0]; b.y=st[1]; } else b.last=null; if(b.last&&b.x===b.last.x&&b.y===b.last.y) b.last=null; } }
  function marksTick(s){ if(!s.marks||!s.marks.length) return; for(const M of s.marks.slice()){ if(--M.t>0) continue; s.marks=s.marks.filter(q=>q!==M); const a0=ATK; ATK=M.by; blast(s,M.x,M.y,{r:1.5,dmg:[12,20],fire:.6}); ATK=a0; } }
  function bots(s){ for(const b of s.ents){ if(b.kind!=="bot"||!b.alive) continue; const B=BTYPES[b.type]; if(b.type==="custodian"){ custodian(s,b); continue; }
      if(b.hackedOff){ b.off=1; continue; }
      if(b.batt!=null){ if(--b.batt<=0){ b.alive=false; b.spent=true; fx(s,{type:"robot",x:b.x,y:b.y}); if(anyPlayerSees(s,b.x,b.y)) say(s,"The field sentry's battery dies with a falling whine.","info"); continue; } }
      else if(!s.power){ if(!b.off){ b.off=1; if(anyPlayerSees(s,b.x,b.y)) say(s,`The ${b.name} powers down.`,"info"); } continue; }
      if(b.off){ b.off=0; fx(s,{type:"robot",x:b.x,y:b.y}); if(anyPlayerSees(s,b.x,b.y)) say(s,`The ${b.name} whirs back to life.`,"warn"); }
      if(b.stun>0){ b.stun--; continue; }
      const ts=s.ents.filter(e=>botHostile(s,b,e)&&Math.hypot(e.x-b.x,e.y-b.y)<=B.range+.5&&los(s,b.x,b.y,e.x,e.y)).sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y));
      const t=ts[0];
      if(t){ if(!b.seen[t.id]){ b.seen[t.id]=1; fx(s,{type:"robot",x:b.x,y:b.y}); if(t.kind==="player"){ const c0=CTX; CTX=t.id; say(s,`${b.type==="turret"?"A turret":"A drone"} locks on to you. TARGET ACQUIRED.`,"bad"); CTX=c0; } b.busy=0; continue; }
        b.last={x:t.x,y:t.y}; botShoot(s,b,t); continue; }
      if(b.type==="drone"){ let g=b.last||(chance(s,.3)?{x:b.home.x+ri(s,-4,4),y:b.home.y+ri(s,-4,4)}:null); if(g&&!walk(tileAt(s,g.x,g.y))){ g=null; b.last=null; } if(g){ const st=stepToward(s,b,g.x,g.y); if(st&&free(s,st[0],st[1])){ face(b,st[0]-b.x,st[1]-b.y); b.x=st[0]; b.y=st[1]; } else b.last=null; if(b.last&&b.x===b.last.x&&b.y===b.last.y) b.last=null; } }
      else if(chance(s,.15)){ const [dx,dy]=N4[ri(s,0,3)]; face(b,dx,dy); } } }
  function botShoot(s,b,t){ const B=BTYPES[b.type]; face(b,t.x-b.x,t.y-b.y); noise(s,b.x,b.y,8); ATK=b.id; let imp=[t.x,t.y], what="none";
    for(const [x,y] of line(b.x,b.y,t.x,t.y,3)){ if(!inb(s,x,y)) break; const tt=tileAt(s,x,y); imp=[x,y]; if(!clear(tt)||tt.t==="window"){ what="wall"; break; } const e=entAt(s,x,y); if(!e||e===b) continue;
      if(e===t?chance(s,B.acc-(t.kind==="player"?gearOf(t).stealth*.05:0)):chance(s,.2)){ what="flesh"; const l=pickLimb(s), c0=CTX; if(e.kind==="player"){ CTX=e.id; say(s,`The ${b.name} hits your ${LNAME[l]}!`,"bad"); } damage(s,e,l,ri(s,B.dmg[0],B.dmg[1]),.45,`Gunned down by station security.`); CTX=c0; if(e.kind==="husk"){ e.aware=true; e.last={x:b.x,y:b.y}; } }
      break; }
    fx(s,{type:"shot",x0:b.x,y0:b.y,x1:imp[0],y1:imp[1],what}); ATK=null; }
  function vitals(s){
    for(const e of s.ents){
      if(!e.alive) continue; CTX=e.kind==="player"?e.id:null; if(e.stimT>0) e.stimT--;
      if(e.imp&&e.imp.clot&&s.turn%3===0){ const bl=LIMBS.filter(l=>e.bleed[l]); if(bl.length&&chance(s,.45)){ delete e.bleed[bl[0]]; say(s,`Your clotting implant seals the wound on your ${LNAME[bl[0]]}.`,"good"); } }
      if(s.gas&&s.gas.length&&(e.kind==="player"||e.kind==="raider")&&!e.syn&&s.gas.includes(idx(s,e.x,e.y))){ const h=e.head&&e.head.d, a=e.armor&&e.armor.d; if(!(["gasmask","sallet","eva","deathmask","halohelm","pilothelm"].includes(h)||a==="hazard"||a==="hardsuit")){ e.blood-=2; if(e.kind==="player"&&(!e.flags.gasT||s.turn-e.flags.gasT>6)){ e.flags.gasT=s.turn; say(s,"You choke on the green fog. Your lungs are on fire. Get out, or get a mask on.","bad"); } if(e.blood<=0){ kill(s,e,"Choked on toxic gas."); continue; } } }
      if(e.kind==="player"&&e.inf>0){ e.inf++; if(e.inf===25) say(s,"You're running a fever. Your hands won't stop shaking.","bad"); if(e.inf>=25&&s.turn%(e.inf>=80?3:6)===0){ e.blood-=1; if(e.blood<=0){ kill(s,e,"Taken by fever and infection."); continue; } } }
      if(e.kind==="player"&&e.food!=null){ const hf=e.food, hw=e.water; e.food=Math.max(0,+(e.food-.03).toFixed(3)); e.water=Math.max(0,+(e.water-.045).toFixed(3));
        if(hf>=15&&e.food<15) say(s,"Your stomach knots. You should eat something.","warn"); if(hw>=15&&e.water<15) say(s,"Your mouth is dry. You should drink something.","warn");
        if((e.food<=0||e.water<=0)&&s.turn%5===0){ e.blood-=1; if(s.turn%15===0) say(s,e.water<=0?"Dehydration is shutting you down.":"You're starving. Your strength is going.","bad"); if(e.blood<=0){ kill(s,e,e.water<=0?"Died of thirst in the dark.":"Starved in the dark."); continue; } }
        else if(e.food>=60&&e.water>=60&&s.turn%8===0&&!LIMBS.some(l=>e.bleed[l])&&e.blood<100) e.blood=Math.min(100,e.blood+1); }
      if(s.rad&&s.rad.length&&(e.kind==="player"||e.kind==="raider")){ const on=s.rad.includes(idx(s,e.x,e.y));
        if(on){ let pr=0; const a=e.armor&&e.armor.d, h=e.head&&e.head.d; if(a==="hazard") pr+=.8; else if(a==="hardsuit"||a==="ossuary"||a==="aegis") pr+=.5; if(h==="gasmask"||h==="sallet"||h==="eva"||h==="deathmask"||h==="halohelm") pr+=.3; if(e.syn) pr+=.6;
          e.rad=(e.rad||0)+Math.max(0,1-pr); if(e.kind==="player"&&!e.flags.radWarn){ e.flags.radWarn=1; say(s,pr>=.8?"Your Geiger counter crackles. The suit is holding the radiation back.":"Your Geiger counter shrieks. This room is hot. Get out or get a hazard suit.","bad"); }
          if(e.rad>=5){ e.rad-=5; e.blood-=3; if(e.kind==="player") say(s,"Radiation sickness: your gums bleed and your vision swims.","bad"); if(e.blood<=0){ kill(s,e,"Cooked by radiation."); continue; } } }
        else if(e.rad>0) e.rad=Math.max(0,e.rad-.25); }
      if(e.acid>0){ e.acid--; damage(s,e,pickLimb(s),ri(s,1,2),0,"Dissolved by spitter acid."); if(!e.alive) continue; if(e.kind==="player"&&e.acid===0) say(s,"The acid finally stops burning.","info"); }
      if(e.kind==="bot") continue;
      const bl=LIMBS.filter(l=>e.bleed[l]);
      if(bl.length){ e.blood-=2*bl.length; if(chance(s,.6)) bleedDecal(s,e.x,e.y,1);
        for(const l of bl) if(chance(s,e.kind==="player"?(e.armor&&e.armor.d==="medcoat"?.12:.04):.06)) delete e.bleed[l];
        if(e.blood<=0){ kill(s,e,e.kind==="player"?"Bled out on the deck plating.":"bled"); continue; }
        if(e.kind==="player"&&e.blood<40&&chance(s,.25)) say(s,"Your vision tunnels. You've lost a lot of blood.","bad");
      }
      if(s.fire[idx(s,e.x,e.y)]){ const lv=s.fire[idx(s,e.x,e.y)], l=chance(s,.6)?(chance(s,.5)?"lleg":"rleg"):pickLimb(s);
        if(e.kind==="player") say(s,"You're burning!","bad"); else if(anyPlayerSees(s,e.x,e.y)&&chance(s,.5)) say(s,e.kind==="raider"?`${e.name} is on fire!`:"The husk shrieks as it burns.","good");
        const fr=e.kind==="player"?gearOf(e).fire:0;
        damage(s,e,l,Math.max(1,Math.round((ri(s,2,3)+lv)*(1-fr))),0,e.kind==="player"?"Burned alive in a dying station.":"burned"); if(!e.alive) continue; }
      const pr=s.P[idx(s,e.x,e.y)];
      if(e.kind==="raider"){ if(pr<35&&s.turn%3===0) damage(s,e,"torso",2,0,"vacuum"); }
      else if(e.kind==="husk"){
        if(pr<35){ damage(s,e,"torso",3,0,"vacuum"); if(e.alive) damage(s,e,"head",1,0,"vacuum"); }
      } else {
        if(pr<45){ e.o2=Math.max(0,e.o2-1);
          if(!e.flags.sealed){ e.flags.sealed=1; say(s,"Pressure dropping. Your suit seals and switches to tank air.","air"); }
          if(e.o2===10) say(s,"SUIT O₂ LOW.","bad");
          if(e.o2<=0){ say(s,"You're suffocating!","bad"); damage(s,e,"torso",4,0,"Suffocated in a dead station."); if(e.alive) damage(s,e,"head",2,0,"Suffocated in a dead station."); }
        } else if(e.flags.sealed){ e.flags.sealed=0; say(s,"Pressure normal. Visor unseals.","air"); }
      }
    }
  }
  // Cheap fingerprint of everything the rules depend on (not view-only data like seen/log).
  function hash(s){ let h=2166136261>>>0; const mix=v=>{ const str=String(v); for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } };
    mix(s.turn); mix(s.rng); mix(s.status); mix(s.power?1:0);
    for(const e of s.ents) mix(`${e.id}${e.x},${e.y}${e.alive?1:0}${LIMBS.map(l=>e.hp[l]).join("")}${e.blood}${e.ammo?JSON.stringify(e.ammo):""}${e.stun|0}${e.acted?1:0}${e.food!=null?Math.round(e.food)+'/'+Math.round(e.water):''}${e.sev?Object.keys(e.sev).join(''):''}${e.lightOff?'o':''}${e.flee|0}${e.search|0}${e.downed?"d"+e.downT:""}${(e.inv||[]).length}`);
    for(const it of s.items) mix(`${it.id}${it.x},${it.y}`);
    mix(Object.keys(s.fire).join(",")); for(const k of Object.keys(s.crews||{})){ const C=s.crews[k]; mix(k+C.att+(C.leave?1:0)+(C.follow||"")+C.followT); } for(const e of s.ents) if(e.acid) mix("a"+e.id+e.acid); mix((s.charges||[]).length); mix((s.traps||[]).length+"/"+(s.mines||[]).length); mix("g"+(s.gas?s.gas.length:0)); mix("sm"+(s.smoke?Object.keys(s.smoke).length:0)); mix("m"+(s.marks?s.marks.length:0)); for(const o of s.side||[]) mix(o.id+o.done+o.prog); for(const e of s.ents) if(e.spec) mix("sp"+e.id+e.spec.n); for(const e of s.ents) if(e.type==="nest") mix("n"+e.id+(e.t|0)); for(const e of s.ents) if(e.sneak) mix("s"+e.id+(e.snk|0)); { let w=0; for(const t of s.tiles) if(t.sealed) w++; mix("w"+w); } if(s.ev) mix(s.ev.type+s.ev.on+(s.ev.done?1:0)); for(const e of s.ents) if(e.rad) mix("r"+e.id+Math.round(e.rad*4)); for(const J of s.jobs||[]) mix(J.id+(J.done?1:0)+J.prog); for(const e of s.ents) if(e.kind==="player") mix(`${e.xp|0}${e.inf|0}${Object.keys(e.frac||{}).join("")}`); for(const e of s.ents) if(e.kind==="raider") mix(`${e.surr?1:0}${e.flee|0}${e.avoid|0}${e.inv.length}${e.act}`); let d=0,sr=0; for(const t of s.tiles){ if(t.t==="door"&&t.open) d++; if(t.searched) sr++; } mix(d); mix(sr);
    return (h>>>0).toString(36); }
  function lootValue(p){ return p.inv.reduce((a,i)=>a+Items.value(i),0); }

  return {SIDES,canExtract,MUTS,FACTIONS,HTYPES,BTYPES,botHostile,intentOf,gearOf,STARTER,VALUABLES,MAPS,bind,hash,normLo,gun,newGame,act,fov,canSee,hitChance,roomName,lootValue,tileAt,entAt,idx,los,walk,LIMBS,LNAME};
})();
// ============================== SIM END ==============================
