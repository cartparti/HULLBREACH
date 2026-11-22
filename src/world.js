// =====================================================================
// WORLD — galaxy data + the crew ship. Pure functions over plain JSON.
// Multiplayer model: one shared `ship` per crew (location, fuel, contracts,
// day) changed only through World.act(ship, actor, action); every player
// keeps their own `profile` (credits, stash, stats). A server can run
// World.act authoritatively exactly like Sim.act.
// =====================================================================
const World = (() => {
  // three regions of space, three sectors each. Jumps: 1 fuel inside a sector, 3 between sectors, 6 to another region.
  const REGIONS=[
    {id:"arm",name:"The Gethsemane Arm",tier:"Threat ▲ to ▲▲▲",desc:"Home space. Mining lanes, pilgrim routes and the burned-out Cinder belt."},
    {id:"veil",name:"The Veil",tier:"Threat ▲▲ to ▲▲▲",desc:"Frontier past the Long Lanes: Choir country, deep mines and the Vanta trade worlds."},
    {id:"embers",name:"Throne of Embers",tier:"Threat ▲▲▲",desc:"The old imperial core. Cathedral ships, garrison worlds and the Choir's iron heart."},
  ];
  const SECTORS=[
    {id:"reach",region:"arm",name:"Gethsemane Reach",x:22,y:30,color:"#6f9b8c",desc:"Old mining lanes. Quiet, if you keep to the beacons."},
    {id:"vigil",region:"arm",name:"Vigil Expanse",x:68,y:24,color:"#c79a4a",desc:"Pilgrim routes between shrine stations."},
    {id:"cinder",region:"arm",name:"Cinder Drift",x:52,y:74,color:"#e0482f",desc:"Burned-out industrial belt. No law past the buoys."},
    {id:"ashen",region:"veil",name:"Ashen Verge",x:24,y:28,color:"#7cbf7a",desc:"Where the Choir's song is loudest, and where the Unbound hide from it."},
    {id:"morrow",region:"veil",name:"Morrow Deep",x:72,y:30,color:"#b08a5a",desc:"Frontier mines and drowned colonies. The Guild's last honest posting."},
    {id:"sable",region:"veil",name:"Sable Crown",x:48,y:74,color:"#b070e0",desc:"Vanta trade worlds. Rich freighters, richer pirates."},
    {id:"pyrewind",region:"embers",name:"Pyrewind",x:24,y:30,color:"#ff7a3a",desc:"A dying sun and the Marshals' last bastion."},
    {id:"blackmere",region:"embers",name:"Blackmere",x:72,y:26,color:"#7a7ac0",desc:"Cathedral fleets drifting in a dark nebula."},
    {id:"crown",region:"embers",name:"Iron Crown",x:50,y:74,color:"#9aa8b4",desc:"The Choir's iron heart, ringed by mercenary garrisons."},
  ];
  const LOCS=[
    {id:"ninefold",sector:"reach",name:"Hangar Ninefold",type:"station",x:14,y:22,scene:{kind:"ring",hue:"#6f9b8c"},
      desc:"Contractor hangar and your home berth. Cheap fuel, honest prices.",npcs:["hesk","vance"],fuel:35},
    {id:"ossuary",sector:"reach",name:"Ossuary Belt",type:"outpost",x:32,y:37,scene:{kind:"planet",a:"#6a5a4a",b:"#2a2018",ring:true},
      desc:"A mining outpost dug into a dead moon. The foreman pays for dangerous work.",npcs:["dask"],fuel:45},
    {id:"ks9",sector:"reach",name:"Relay KS-9",type:"derelict",x:15,y:50,scene:{kind:"hulk",glow:"#ff7a30"},
      desc:"A comms relay gone silent six weeks ago. A fire still burns in its cargo hold.",site:{tier:1,fireStart:true,kind:"relay",mods:{}}},
    {id:"tithe",sector:"reach",name:"Tithe Hulk 7",type:"derelict",x:36,y:18,scene:{kind:"hulk",glow:"#3a6a5a"},
      desc:"An ore tithe barge, powerless and cold. Rich holds, more husks.",site:{tier:2,kind:"mining",mods:{power:false,huskAdd:2,loot:1.3}}},
    {id:"vesper",sector:"reach",name:"Vesper Outpost",type:"derelict",x:5,y:34,scene:{kind:"hulk",glow:"#6aa0ff"},
      desc:"A Concord Marshal outpost that stopped answering hails. Its turrets are still watching.",site:{tier:2,kind:"outpost",mods:{}}},
    {id:"spire",sector:"vigil",name:"Saint Orrin's Spire",type:"station",x:66,y:14,scene:{kind:"spire",hue:"#c79a4a"},
      desc:"A shrine station of bells and candle-smoke. The reliquary sells armour blessed or otherwise.",npcs:["caul","ysolde"],fuel:50},
    {id:"mercy",sector:"vigil",name:"The Mercy of Iron",type:"derelict",x:80,y:32,scene:{kind:"hulk",glow:"#c22a1a"},
      desc:"A pilgrim hospital ship. Lights out, doors sealed, something singing in the vents.",site:{tier:3,kind:"hospital",mods:{power:false,huskAdd:3,loot:1.5}}},
    {id:"theta",sector:"vigil",name:"Choir Node Theta",type:"derelict",x:86,y:46,scene:{kind:"hulk",glow:"#7cff7a"},
      desc:"An Iron Choir relay node. The walls hum in harmony and the turrets never sleep.",site:{tier:3,kind:"hive",mods:{loot:1.4}}},
    {id:"lazarus",sector:"cinder",name:"Lazarus Yards",type:"outpost",x:44,y:66,scene:{kind:"planet",a:"#7a3a1e",b:"#2a0e08",ring:false},
      desc:"Breaker yards on a smouldering world. Mott takes the jobs nobody else will.",npcs:["mott"],fuel:40},
    {id:"fennick",sector:"cinder",name:"Fennick's Hulk",type:"station",x:62,y:82,scene:{kind:"ring",hue:"#e0482f"},
      desc:"A black market bolted onto a gutted freighter. Rare weapons, no questions.",npcs:["fennick"],fuel:55},
    // ---- The Veil ----
    {id:"haven",sector:"ashen",name:"Unbound Haven",type:"station",x:16,y:20,scene:{kind:"ring",hue:"#ff9a5a"},desc:"A hidden station run by free synths. Spare parts, no questions, a wary welcome.",npcs:["solder"],fuel:60},
    {id:"kappa",sector:"ashen",name:"Choir Node Kappa",type:"derelict",x:34,y:36,scene:{kind:"hulk",glow:"#7cff7a"},desc:"A Choir relay node, louder than Theta and better guarded.",site:{tier:3,kind:"hive",size:"large",mods:{loot:1.5}}},
    {id:"glasswing",sector:"ashen",name:"Glasswing Laboratory",type:"derelict",x:12,y:40,scene:{kind:"hulk",glow:"#5ad0d0"},desc:"A research platform that studied the Choir until the Choir studied it back.",site:{tier:2,kind:"research",mods:{power:false,loot:1.3}}},
    {id:"spindle",sector:"morrow",name:"Morrow Spindle",type:"outpost",x:64,y:22,scene:{kind:"planet",a:"#6a5040",b:"#2a1a10",ring:true},desc:"A Guild mining outpost on a cracked moon. Foreman Kessa pays for the truth about the colonies.",npcs:["kessa","morr"],fuel:50},
    {id:"kessler",sector:"morrow",name:"Kessler Quarry",type:"derelict",x:82,y:28,scene:{kind:"hulk",glow:"#e8b048"},desc:"A deep-core mining barge. Brutes in the shafts, ore in the holds.",site:{tier:2,kind:"mining",size:"large",mods:{huskAdd:2,loot:1.3}}},
    {id:"ilex",sector:"morrow",name:"Colony Ship Ilex",type:"derelict",x:70,y:40,scene:{kind:"hulk",glow:"#c8a070"},desc:"Twelve thousand colonists went to sleep aboard. Something woke up instead.",site:{tier:3,kind:"colony",mods:{power:false,huskAdd:3,loot:1.4}}},
    {id:"exchange",sector:"sable",name:"Vanta Exchange",type:"station",x:42,y:66,scene:{kind:"ring",hue:"#5ad0d0"},desc:"The Combine's richest market. Premium gear at premium prices.",npcs:["ilse","corsa"],fuel:65},
    {id:"gilded",sector:"sable",name:"The Gilded Hulk",type:"derelict",x:58,y:82,scene:{kind:"hulk",glow:"#e8c040"},desc:"A Combine bullion freighter. Black Sun crews are already aboard.",site:{tier:3,kind:"freighter",size:"large",mods:{loot:1.8}}},
    // ---- Throne of Embers ----
    {id:"bastion",sector:"pyrewind",name:"Ember Bastion",type:"outpost",x:18,y:22,scene:{kind:"planet",a:"#8a3a1e",b:"#2a0806",ring:false},desc:"The Concord Marshals' last fortress world. Strict, safe and well armed.",npcs:["brant"],fuel:55},
    {id:"ardent",sector:"pyrewind",name:"Furnace Ship Ardent",type:"derelict",x:32,y:38,scene:{kind:"hulk",glow:"#ff6a20"},desc:"A Marshal furnace ship taken by Reavers. Its reactors still burn.",site:{tier:3,kind:"fortress",size:"large",mods:{fires:4,loot:1.7}}},
    {id:"vorne",sector:"blackmere",name:"Saint Vorne's Cathedral",type:"station",x:66,y:18,scene:{kind:"spire",hue:"#9a7ac0"},desc:"A cathedral station older than the Concord. The reliquary sells armour fit for a crusade.",npcs:["vorne"],fuel:60},
    {id:"lament",sector:"blackmere",name:"Cathedral Ship Lament",type:"derelict",x:80,y:34,scene:{kind:"hulk",glow:"#a040c0"},desc:"A hospital cathedral that sang its last hymn a year ago. The Matriarchs nest in its wards.",site:{tier:3,kind:"hospital",size:"large",mods:{power:false,huskAdd:4,loot:1.8}}},
    {id:"garrison",sector:"crown",name:"Hollow Garrison",type:"outpost",x:40,y:66,scene:{kind:"ring",hue:"#9aa8b4"},desc:"A Hollow Company fortress-moon. They take contracts on the Choir, and they pay well.",npcs:["harrow"],fuel:70},
    {id:"throne",sector:"crown",name:"The Throne of Iron",type:"derelict",x:60,y:82,scene:{kind:"hulk",glow:"#7cff7a"},desc:"The Choir's heart: a mountain of machines singing in the dark. Nobody has come back from its core.",site:{tier:3,kind:"hive",size:"large",mods:{huskAdd:2,loot:2}}},
    {id:"pyre",sector:"cinder",name:"Pyre Station",type:"derelict",x:38,y:84,scene:{kind:"hulk",glow:"#ffb040"},
      desc:"A refinery that has been burning for a month. Fewer husks. Much more fire.",site:{tier:3,kind:"mining",mods:{fires:7,huskDrop:.35,loot:1.4}}},
    {id:"maw",sector:"cinder",name:"Breaker's Maw",type:"derelict",x:76,y:74,scene:{kind:"hulk",glow:"#e0482f"},
      desc:"A Reaver fortress welded together from a dozen wrecks. Their war bands sleep here, and so does their loot.",site:{tier:3,kind:"fortress",mods:{loot:1.6}}},
  ];
  const NPCS={
    solder:{name:"Solder",role:"Trader",look:{skin:"#9aa4ac",hood:"#3a4a30",eye:"#ffb060"},shop:{buy:1,sell:1.05,stock:[[{d:"drone"},420],[{d:"toolbelt"},150],[{d:"medkit",r:1},130],[{d:"splint"},60],[{d:"antibiotic"},90],[{d:"ammo_rifle",n:10},60],[{d:"carbine",r:1},1100],[{d:"mod_laser"},260]]},
      line:"Unbound Haven. We don't ask what you are. Don't ask what we were."},
    kessa:{name:"Foreman Kessa Vire",role:"Contracts",look:{skin:"#8a6a50",hood:"#5a4a2a",eye:"#e8c080"},line:"Morrow's dying, contractor. The mines took the colonies. Bring me proof of what happened.",contracts:["c_kessler","c_ilex"]},
    morr:{name:"Quartermaster Morr",role:"Trader",look:{skin:"#7a5a44",hood:"#4a3a24",eye:"#d0b080"},shop:{buy:1,sell:1,stock:[[{d:"harness"},420],[{d:"hardhat",r:1},300],[{d:"cargo"},80],[{d:"floodlamp"},260],[{d:"ammo_shell",n:6},60],[{d:"pump",r:0},700],[{d:"o2"},60],[{d:"mod_choke"},200]]},
      line:"Frontier prices. You want cheap, go back to the Arm."},
    ilse:{name:"Broker Ilse Vant",role:"Trader",look:{skin:"#e0c0a0",hood:"#2a4a5a",eye:"#5ad0d0"},shop:{buy:1.2,sell:1.15,stock:[[{d:"hardsuit",r:1},1700],[{d:"pilothelm",r:1},800],[{d:"bullpup",r:1},1500],[{d:"warden",r:1},1600],[{d:"hauler"},700],[{d:"mod_scope"},320],[{d:"mod_suppressor"},360],[{d:"sentry"},620],[{d:"stim",r:2},240]]},
      line:"The Vanta Exchange buys everything and sells it back at a profit. You're welcome."},
    corsa:{name:"Captain Corsa",role:"Contracts",look:{skin:"#6a4a3a",hood:"#2a2a40",eye:"#c070ff"},line:"The Gilded Hulk went quiet with a hold full of Combine gold. I'd like it before the Syndicate gets there.",contracts:["c_gilded"]},
    brant:{name:"Marshal Odile Brant",role:"Contracts",look:{skin:"#5a3a2a",hood:"#1c2a44",eye:"#6aa0ff"},line:"The Ardent was a Marshal furnace ship. The Reavers took it. I want it back, or burned.",contracts:["c_ardent"]},
    vorne:{name:"Sister Vorne",role:"Reliquary",look:{skin:"#c8b098",hood:"#3a1a3a",eye:"#f0d090"},shop:{buy:1.1,sell:.95,stock:[[{d:"medcoat",r:1},700],[{d:"brigandine",r:1},800],[{d:"gasmask",r:1},500],[{d:"censer"},300],[{d:"maul",r:1},600],[{d:"medkit",r:1},120],[{d:"antibiotic"},80]]},
      line:"Saint Vorne's walls have held for nine centuries. Our prices have held for nearly as long."},
    harrow:{name:"Captain Reyes Harrow",role:"Contracts",look:{skin:"#7a5a44",hood:"#2a2826",eye:"#ff4a30"},line:"The Throne of Iron is the Choir's heart. Bring me its black box and the Company will make you rich.",contracts:["c_throne","c_lament"]},
    hesk:{name:"Quartermaster Hesk",role:"Trader",look:{skin:"#a68a6a",hood:"#3a4a44",eye:"#cfd8c8"},shop:{buy:1,sell:1,stock:[[{d:"breach"},160],[{d:"bandage"},40],[{d:"medkit",r:1},140],[{d:"o2"},60],[{d:"ammo_pistol",n:12},50],[{d:"ammo_rifle",n:10},60],[{d:"ammo_shell",n:6},60],[{d:"pistol",r:0},240],[{d:"sixgun",r:0},300],[{d:"knife",r:0},120],[{d:"crowbar",r:0},90],[{d:"flashlight",r:0},60],[{d:"ration"},18],[{d:"waterflask"},14],[{d:"stew"},32],[{d:"org",n:3},30],[{d:"visor",r:0},220],[{d:"suit",r:0},260],[{d:"scrapvest",r:0},180],[{d:"cargo",r:0},120],[{d:"hardhat",r:0},180],[{d:"carrier",r:0},420],[{d:"toolbelt",r:0},150],[{d:"eva",r:0},380],[{d:"scarf",r:0},60],[{d:"sling"},120],[{d:"frag"},160],[{d:"field"},450]]},
      line:"Ninefold keeps its contractors stocked. Fair prices. Don't make me regret it."},
    vance:{name:"Broker Vance",role:"Contracts",look:{skin:"#8a6a50",hood:"#2a2420",eye:"#e8b450"},
      line:"KS-9 went dark with something my client wants back. Recover it and I'll make it worth the trip.",contracts:["c_ks9","c_tithe"]},
    dask:{name:"Foreman Dask",role:"Contracts",look:{skin:"#6a5040",hood:"#5a4a2a",eye:"#d0b080"},
      line:"Tithe Hulk 7 drifted off its lane with a full hold. I want its recorder before the guild does.",contracts:["c_tithe2"]},
    caul:{name:"Brother Caul",role:"Reliquary",look:{skin:"#b8a088",hood:"#5a1a12",eye:"#f0d090"},shop:{buy:1.1,sell:.9,stock:[[{d:"flak",r:0},900],[{d:"flak",r:1},1500],[{d:"hazard",r:0},800],[{d:"hazard",r:1},1350],[{d:"medkit",r:1},130],[{d:"stim",r:2},260],[{d:"incendiary"},180],[{d:"axe",r:1},420],[{d:"machete",r:1},300],[{d:"sallet",r:0},900],[{d:"brigandine",r:0},700],[{d:"greaves",r:0},800],[{d:"seals",r:0},650],[{d:"cape",r:0},180],[{d:"medcoat",r:0},520],[{d:"harness",r:0},650],[{d:"coachgun",r:0},700],[{d:"purewater"},28],[{d:"amber"},70]]},
      line:"Every plate is blessed. Most of them even stop bullets."},
    ysolde:{name:"Prioress Ysolde",role:"Contracts",look:{skin:"#c8b098",hood:"#e8e0d0",eye:"#7ab0d0"},
      line:"The Mercy of Iron carried our sick. Bring back its log so we know how they died.",contracts:["c_mercy"]},
    mott:{name:"Fixer Mott",role:"Contracts",look:{skin:"#7a5a44",hood:"#2a2a2a",eye:"#ff6a30"},
      line:"Pyre Station's still burning. The recorder's fireproof. Are you?",contracts:["c_pyre"]},
    fennick:{name:"Fennick",role:"Black market",look:{skin:"#9a8a70",hood:"#3a2a40",eye:"#9ae8c0"},shop:{buy:1.15,sell:1.25,stock:[[{d:"scatter",r:1},1100],[{d:"carbine",r:0},900],[{d:"rivet",r:1},1200],[{d:"longbore",r:0},1300],[{d:"launcher",r:0},1800],[{d:"hornet",r:0},650],[{d:"wasp",r:1},1000],[{d:"bullpup",r:0},1000],[{d:"hound",r:0},1350],[{d:"kestrel",r:0},1500],[{d:"thumper",r:0},1400],[{d:"ripsaw",r:0},850],[{d:"parts",n:2},120],[{d:"core",n:1},420],[{d:"lumen",r:0},380],[{d:"hardsuit",r:0},1700],[{d:"magboots",r:0},900],[{d:"oxytank",r:0},420],[{d:"pilothelm",r:0},700],[{d:"floodlamp",r:0},220],[{d:"recaf"},20],[{d:"gasmask",r:0},520],[{d:"flakhelm",r:0},500],[{d:"kneepads",r:0},380],[{d:"exo",r:0},1500],[{d:"lamp",r:0},600],[{d:"bandolier",r:0},400],[{d:"pauldron",r:0},500],[{d:"ammo_sniper",n:4},90],[{d:"ammo_rocket",n:2},160],[{d:"hauler"},950],[{d:"stun"},150],[{d:"scrap",n:3},40],[{d:"prop",n:2},50],[{d:"circ",n:2},70]]},
      line:"I pay more for salvage than anyone in three sectors. I also charge more. Funny how that works."},
  };
  const CONTRACTS={
    c_ks9:{title:"Silence on KS-9",site:"ks9",giver:"vance",reward:600,brief:"Recover the black box from Relay KS-9's vault."},
    c_tithe:{title:"Tithe in arrears",site:"tithe",giver:"vance",reward:800,brief:"Pull the recorder from the powerless Tithe Hulk 7."},
    c_tithe2:{title:"Before the guild",site:"tithe",giver:"dask",reward:900,brief:"Beat the guild salvagers to Tithe Hulk 7's recorder."},
    c_mercy:{title:"Last rites",site:"mercy",giver:"ysolde",reward:1200,brief:"Recover the Mercy of Iron's log from its sealed vault."},
    c_kessler:{title:"Down the shaft",site:"kessler",giver:"kessa",reward:1300,brief:"Recover Kessler Quarry's black box from the deep holds."},
    c_ilex:{title:"Twelve thousand sleepers",site:"ilex",giver:"kessa",reward:1700,brief:"Bring back the Ilex's flight recorder and learn what woke up."},
    c_gilded:{title:"Gold in the dark",site:"gilded",giver:"corsa",reward:2000,brief:"Beat the Black Sun to the Gilded Hulk's black box."},
    c_ardent:{title:"Furnace and flame",site:"ardent",giver:"brant",reward:2100,brief:"Take the Ardent's black box back from the Reavers."},
    c_lament:{title:"The last hymn",site:"lament",giver:"harrow",reward:2300,brief:"Recover the Lament's log from its nest-choked wards."},
    c_throne:{title:"The iron heart",site:"throne",giver:"harrow",reward:3500,brief:"Walk into the Throne of Iron and bring out its black box."},
    c_pyre:{title:"Fireproof",site:"pyre",giver:"mott",reward:1400,brief:"Walk into Pyre Station and bring out its black box."},
  };
  const CONS={bandage:{name:"Bandage roll",sell:15,desc:"Stops bleeding on one limb."},medkit:{name:"Trauma kit",sell:55,desc:"Stops all bleeding and patches every limb."},
    o2:{name:"Oxygen canister",sell:25,desc:"Refills 50 suit O₂."},keycard:{name:"Captain's keycard",sell:20,desc:"Opens a station vault while power is on."}};

  // ---- signals: procedural derelicts that show up in every sector, fade after a while, and vanish once stripped ----
  const EPOCH=4; // a new batch every 4 days; each signal lasts two batches
  const hashS=str=>{ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h; };
  const SIGKIND={arm:[["relay",3],["mining",3],["freighter",2],["colony",1],["research",1],["outpost",1]],veil:[["research",3],["hive",2],["mining",2],["colony",2],["freighter",2],["fortress",1]],embers:[["hospital",2],["fortress",3],["hive",3],["freighter",2],["outpost",2],["research",1]]};
  const SIGNAME={relay:[["Relay","Beacon","Listening post"],["VX-12","Omen-4","Kestrel-9","Corvid-7","Talon-3","Ash-21","Wren-5","Hollow-8"]],
    mining:[["Ore barge","Mining hulk","Deep-core rig"],["Tessaly","Grist","Basalt Mother","Hammerfall","Old Karrow","Seam-40","Sulphur Grace"]],
    freighter:[["Freighter","Bulk hauler","Courier"],["Black Orchid","Marrow Queen","Saint Calla","Low Fortune","Grey Tithe","Iron Wager","Pale Margin"]],
    colony:[["Colony ship","Ark","Settler barge"],["Hearthward","New Morrow","Last Harvest","Kindly Light","Second Dawn","Ilyria"]],
    research:[["Research platform","Laboratory","Survey station"],["Ixion","Glassmere","Antikyth","Cold Psalm","Veridian","Nadir-6"]],
    outpost:[["Outpost","Picket station","Customs post"],["Corvin","Vesk","Harrow Point","Grey Watch","Toll-9","Saint Ebb"]],
    hive:[["Choir node","Choir shard","Singing hulk"],["Iota","Lambda","Sigma","Rho","Omicron","Tau"]],
    fortress:[["Reaver hold","Raider hulk","War-barge"],["Gutter Throne","Red Mouth","Bonepile","Rust Crown","Scrapgate"]],
    hospital:[["Hospital ship","Infirmary barge","Plague hulk"],["Mercy's Ash","Saint Odile","Quiet Ward","Last Rites","Pale Saint"]]};
  const SIGDESC={relay:"A comms relay gone silent.",mining:"A mining hulk drifting off its lane, holds still full.",freighter:"A freighter that stopped answering hails mid-run.",colony:"A colony ship whose sleepers never woke the way they should have.",research:"A research platform; its specimens got loose.",outpost:"An abandoned picket station, turrets still tracking.",hive:"A fragment of the Choir, singing to itself.",fortress:"A Reaver stronghold welded from wrecks.",hospital:"A hospital ship full of things that used to be patients."};
  const SIGGLOW={relay:"#ff7a30",mining:"#e8b048",freighter:"#c8a050",colony:"#c8a070",research:"#5ad0d0",outpost:"#6aa0ff",hive:"#7cff7a",fortress:"#e0482f",hospital:"#c22a1a"};
  const SLOTS=[[-14,-9],[13,-10],[-11,12],[14,10],[0,-17],[1,17],[-19,2],[19,1],[-7,-14],[8,14]];
  function signal(sector,epoch,i){ const S=SECTORS.find(q=>q.id===sector); if(!S) return null; const id=`sig~${sector}~${epoch}~${i}`; let h=hashS(id); const R=()=>{ h=(h+0x6D2B79F5)>>>0; let t=h; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
    const reg=S.region, kinds=SIGKIND[reg]; let t=kinds.reduce((a,k)=>a+k[1],0)*R(), kind="relay"; for(const [k,w] of kinds){ if((t-=w)<0){ kind=k; break; } }
    const regSecs=SECTORS.filter(q=>q.region===S.region).map(q=>q.id), statics=LOCS.filter(l=>regSecs.includes(l.sector)), slots=SLOTS.filter(([dx,dy])=>statics.every(l=>Math.hypot(l.x-(S.x+dx),l.y-(S.y+dy))>9)&&S.x+dx>4&&S.x+dx<96&&S.y+dy>6&&S.y+dy<94);
    const off=hashS(sector)%Math.max(1,slots.length), sl=slots[(off+epoch*2+i)%Math.max(1,slots.length)]||[0,0], N=SIGNAME[kind], hn=hashS(id+"n"), suf=N[1][(hashS(id+"b")>>>5)%N[1].length].replace(/-\d+$/,"-"+(2+hn%97)), nm=`${N[0][(hashS(id+"a")>>>3)%N[0].length]} ${suf}${/-\d+$/.test(suf)?"":["",""," II"," III"," IV"," VII"][hn%6]}`;
    const tier=reg==="arm"?(R()<.65?1:2):reg==="veil"?(R()<.5?2:3):3, size=R()<.25?"small":R()<.75?"medium":"large";
    const mods={}; if(R()<.4) mods.power=false; if(R()<.2) mods.fires=1+Math.floor(R()*4); if(R()<.4) mods.huskAdd=1+Math.floor(R()*3); mods.loot=+(1+R()*.6+(size==="large"?.2:0)).toFixed(2);
    const cond=[mods.power===false?"No power.":"Power still on.",mods.fires?"Fires aboard.":"",mods.huskAdd?"Heavy life signs.":"",size==="large"?"A big station.":size==="small"?"A small wreck: a quick run.":""].filter(Boolean).join(" ");
    return {id,sector,name:nm,type:"derelict",signal:true,x:S.x+sl[0],y:S.y+sl[1],scene:{kind:"hulk",glow:SIGGLOW[kind]},expires:(epoch+2)*EPOCH,
      desc:`Signal picked up: ${SIGDESC[kind]} ${cond}`,site:{tier,kind,size,mods}}; }
  // ---- the Daily Op: one brutal station a day, the same for every crew (keyed by the real-world UTC date) ----
  const OPNAMES=["Black Litany","Red Vigil","Iron Requiem","Ashen Choir","Hollow Crown","Grave Tide","Pale Furnace","Bitter Saint","Sunken Psalm","Carrion Star","Mourning Engine","Last Lantern","Dead Orbit","Weeping Forge"];
  const OPMODS=[["Mutation outbreak","elite"],["Blackout","dark"],["Reactor failing","melt"],["The horde is coming","horde"],["Security lockdown","lock"],["Heavy life signs","swarm"],["Burning decks","fire"]];
  function dailyOp(key){ key=String(key||""); if(!/^\d{8}$/.test(key)) return null; const id=`op~${key}`; let h=hashS(id); const R=()=>{ h=(h+0x6D2B79F5)>>>0; let t=h; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
    const S=SECTORS[Math.floor(R()*SECTORS.length)], kinds=["relay","mining","freighter","colony","research","outpost","hospital","hive"], kind=kinds[Math.floor(R()*kinds.length)], tier=R()<.45?2:3, size=R()<.5?"large":"medium";
    const picks=[], pool=OPMODS.slice(); picks.push(pool.splice(0,1)[0]); while(picks.length<3){ picks.push(pool.splice(Math.floor(R()*pool.length),1)[0]); }
    const mods={elite:2.5,loot:1.7,huskAdd:1}; for(const [,m] of picks){ if(m==="dark") mods.power=false; if(m==="melt") mods.ev="meltdown"; if(m==="horde"&&!mods.ev) mods.ev="horde"; if(m==="lock"&&!mods.ev) mods.ev="lockdown"; if(m==="swarm") mods.huskAdd=4; if(m==="fire") mods.fires=3; }
    const sl=SLOTS[Math.floor(R()*SLOTS.length)], nm=OPNAMES[Math.floor(R()*OPNAMES.length)], N=SIGNAME[kind];
    return {id,sector:S.id,name:`Op ${nm}`,type:"derelict",signal:true,daily:key,x:Math.max(5,Math.min(95,S.x+Math.round(sl[0]*.6))),y:Math.max(7,Math.min(93,S.y+Math.round(sl[1]*.6))),scene:{kind:"hulk",glow:"#ffd060"},
      desc:`DAILY OP. ${/^[aeiou]/i.test(N[0][0])?"An":"A"} ${N[0][0].toLowerCase()} gone very wrong, the same for every crew today. ${picks.map(q=>q[0]).join(". ")}. First extraction today pays a supply crate, credits and XP.`,mods:picks.map(q=>q[0]),site:{tier,kind,size,mods}}; }
  const loc=id=>{ if(typeof id==="string"&&id.startsWith("op~")) return dailyOp(id.slice(3)); if(typeof id==="string"&&id.startsWith("sig~")){ const [,sec,ep,i]=id.split("~"); return signal(sec,+ep,+i); } return LOCS.find(l=>l.id===id); };
  function signals(ship){ const e=Math.floor((ship.day|0)/EPOCH), out=[], gone=new Set(ship.cleared||[]); for(const S of SECTORS) for(const ep of [e-1,e]) for(let i=0,n=1+(hashS(S.id+"~"+ep)%2);i<n;i++){ if(ep<0) continue; const g=signal(S.id,ep,i); if(g&&!gone.has(g.id)) out.push(g); } if(ship.opKey){ const o=dailyOp(ship.opKey); if(o&&!gone.has(o.id)) out.push(o); } return out; }
  const allLocs=ship=>[...LOCS,...signals(ship)];
  // ---- the sector war: who holds what, and the Iron Choir's slow advance ----
  const CONTROL={haven:"unbound",kappa:"choir",glasswing:null,spindle:"guild",kessler:"guild",ilex:null,exchange:"vanta",gilded:"blacksun",bastion:"marshal",ardent:"reaver",vorne:"saint",lament:"saint",garrison:"hollow",throne:"choir",ninefold:"marshal",ossuary:"guild",ks9:null,tithe:"guild",vesper:"marshal",spire:"saint",mercy:"saint",theta:"choir",lazarus:"blacksun",fennick:"blacksun",pyre:"blacksun",maw:"reaver"};
  const CHOIR_PATH=["mercy","vesper","tithe","ks9","pyre","maw"]; // the order the Choir takes derelicts in
  function war(ship){ if(!ship.war) ship.war={control:{...CONTROL},choir:10,news:[{day:ship.day|0,text:"The Iron Choir's signal is spreading out of Choir Node Theta. Nobody is answering it yet."}]}; return ship.war; }
  function controlOf(ship,id){ const W=war(ship); return id in W.control?W.control[id]:CONTROL[id]||null; }
  function news(ship,text){ const W=war(ship); W.news.unshift({day:ship.day|0,text}); W.news=W.news.slice(0,12); }
  // every day the Choir sings a little louder; at each 20 points it takes the next derelict on its path
  function warTick(ship,days){ const W=war(ship); for(let d=0;d<days;d++){ const before=W.choir; W.choir=Math.min(100,W.choir+2.5);
      if(Math.floor(W.choir/20)>Math.floor(before/20)){ const next=CHOIR_PATH.find(id=>W.control[id]!=="choir"); if(next){ const was=W.control[next]; W.control[next]="choir"; news(ship,`The Iron Choir has taken ${loc(next).name}${was?` from the ${was}`:""}. Its crews are converting the station.`); } } } }
  function pushChoir(ship,n,why){ const W=war(ship); W.choir=Math.max(0,Math.min(100,W.choir+n));
    if(n<0){ const lost=[...CHOIR_PATH].reverse().find(id=>W.control[id]==="choir"); if(lost&&W.choir<CHOIR_PATH.filter(id=>W.control[id]==="choir").length*20-10){ W.control[lost]=CONTROL[lost]; news(ship,`${why} The Choir's hold on ${loc(lost).name} breaks. ${CONTROL[lost]?`The ${CONTROL[lost]} move back in.`:"It's open salvage again."}`); } else news(ship,why); }
    else news(ship,why); }
  // ---- faction jobs: two offers per faction per day, worked out from the day so every crew member sees the same ----
  const JOBITEM={choir:"Choir harmonic core",unbound:"Freed-synth memory drive",saint:"Rust Saint reliquary",guild:"Guild survey drive",vanta:"Vanta cargo ledger",blacksun:"Black Sun strongbox key",marshal:"Marshal evidence locker",hollow:"Hollow Company contract file",reaver:"Reaver war-banner"};
  const LEAD=["Warboss","Captain","Deacon","Foreman","Broker","Overseer","Cantor","Fixer","Sergeant"];
  function jobsFor(ship,fac,FAC){ const day=ship.day|0, out=[]; let h=(day*2246822519^fac.length*3266489917^fac.charCodeAt(0)*668265263)>>>0; const R=()=>((h=(h*1664525+1013904223)>>>0)/4294967296);
    const sites=LOCS.filter(l=>l.type==="derelict"), F=FAC[fac]; if(!F) return out;
    for(let i=0;i<2;i++){ const site=sites[Math.floor(R()*sites.length)], tier=site.site.tier||1, holder=controlOf(ship,site.id);
      const foes=(F.foes||[]).filter(f=>FAC[f]); let type=["kill","recover","purge","rescue"][Math.floor(R()*4)];
      if(fac!=="choir"&&holder==="choir"&&R()<.6) type=R()<.5?"sabotage":"kill"; if(type==="kill"&&!foes.length&&holder!=="choir") type="purge";
      const target=type==="kill"?(holder==="choir"&&fac!=="choir"?"choir":foes[Math.floor(R()*foes.length)]):null;
      const base=[0,450,750,1100][tier]+Math.round(R()*8)*25, j={id:`j${day}${fac}${i}`,fac,type,site:site.id,tier,reward:base+(type==="kill"?150:type==="sabotage"?200:0),rep:type==="kill"||type==="sabotage"?10:8};
      if(type==="kill"){ const TF=FAC[target]; j.target={fac:target,name:`${TF.species==="synth"?"Conductor":LEAD[Math.floor(R()*LEAD.length)]} ${["Vane","Korr","Sato","Lisk","Morrow","Hale","Quist","Dray","Ferro","Ash"][Math.floor(R()*10)]}`}; j.title=`Kill ${j.target.name}`; j.brief=`${j.target.name} of the ${TF.name} is holed up on ${site.name}. Put them down.`; }
      if(type==="recover"){ j.item=JOBITEM[fac]; j.title=`Recover the ${j.item}`; j.brief=`The ${j.item} was lost on ${site.name}. It's locked in the vault or a strongbox. Bring it out.`; }
      if(type==="purge"){ j.n=6+tier*3; j.title=`Purge ${site.name}`; j.brief=`Kill ${j.n} of the dead aboard ${site.name} so a salvage crew can follow.`; }
      if(type==="rescue"){ j.title=`Rescue a stranded ${F.short}`; j.brief=`One of ours is trapped somewhere on ${site.name}. Find them, get them to your shuttle alive.`; }
      if(type==="sabotage"){ j.title=`Silence the Choir on ${site.name}`; j.brief=`Get to ${site.name}'s main power relay and upload our worm. It'll set the Choir's song back by weeks.`; }
      out.push(j); }
    return out; }
  function newShip(){ return {v:1,name:"Ninefold Lark",loc:"ninefold",fuel:6,fuelMax:8,day:1,contracts:[],done:[],log:[],fab:1}; }
  const regionOf=l=>{ const s=SECTORS.find(q=>q.id===(l&&l.sector)); return s?s.region:"arm"; };
  function travelCost(ship,to){ const a=loc(ship.loc), b=loc(to); if(!a||!b||a.id===b.id) return 0; return a.sector===b.sector?1:regionOf(a)===regionOf(b)?3:6; }
  function siteContract(ship,site){ return ship.contracts.find(c=>CONTRACTS[c].site===site)||null; }
  // actor = {id, profile}; profile is the acting player's own save
  function act(ship,actor,a){
    const P=actor.profile, L=loc(ship.loc);
    switch(a.type){
      case "travel": { const c=travelCost(ship,a.to); if(!loc(a.to)||!c) return {ok:false,msg:"Already here."};
        if((String(a.to).startsWith("sig~")||String(a.to).startsWith("op~"))&&!signals(ship).some(g=>g.id===a.to)) return {ok:false,msg:"That signal has faded."};
        if(ship.fuel<c) return {ok:false,msg:`Not enough fuel. That jump needs ${c}.`};
        ship.fuel-=c; ship.loc=a.to; ship.day+=c; warTick(ship,c); return {ok:true,msg:`Jumped to ${loc(a.to).name}.`}; }
      case "tow": { if(ship.fuel>=1) return {ok:false,msg:"You still have fuel."}; ship.loc="ninefold"; ship.day+=4; warTick(ship,4); return {ok:true,msg:"A Ninefold tug hauls you home. Four days lost."}; }
      case "refuel": { if(!L.fuel) return {ok:false,msg:"No fuel sold here."}; const need=ship.fuelMax-ship.fuel; if(!need) return {ok:false,msg:"Tanks are full."};
        const n=Math.min(need,Math.floor(P.credits/L.fuel)); if(!n) return {ok:false,msg:"You can't afford any fuel."};
        P.credits-=n*L.fuel; ship.fuel+=n; return {ok:true,msg:`Bought ${n} fuel for ${n*L.fuel} cr.`}; }
      case "accept": { const C=CONTRACTS[a.id]; if(!C||ship.done.includes(a.id)||ship.contracts.includes(a.id)) return {ok:false,msg:"Not available."};
        const fb=(ship.failed||{})[a.id]; if(fb&&fb>(ship.day|0)) return {ok:false,msg:`After your last failure, ${NPCS[C.giver].name} won't offer this for ${fb-(ship.day|0)} more day${fb-(ship.day|0)>1?"s":""}.`};
        if(!L.npcs||!L.npcs.includes(C.giver)) return {ok:false,msg:"Talk to the giver in person."};
        if(ship.contracts.length>=3) return {ok:false,msg:"Your crew can hold three contracts at once."};
        ship.contracts.push(a.id); return {ok:true,msg:`Contract accepted: ${C.title}.`}; }
      case "drop": { ship.contracts=ship.contracts.filter(c=>c!==a.id); return {ok:true,msg:"Contract dropped."}; }
      case "buy": { const N=NPCS[a.npc]; if(!N||!N.shop||!L.npcs.includes(a.npc)) return {ok:false,msg:"No trader here."};
        const row=N.shop.stock[a.i|0]; if(!row) return {ok:false,msg:"Not stocked."}; const [spec,price]=row;
        if(P.credits<price) return {ok:false,msg:"Not enough credits."}; P.credits-=price; grant(P,spec);
        return {ok:true,msg:`Bought ${Items.name(spec)} for ${price} cr.`}; }
      case "sell": { const N=NPCS[a.npc]; if(!N||!N.shop||!L.npcs.includes(a.npc)) return {ok:false,msg:"No trader here."};
        const i=P.stash.findIndex(q=>q.uid===a.uid); if(i<0) return {ok:false,msg:"Item not found."};
        const it=P.stash[i], v=Math.round(Items.value(it)*.5*N.shop.sell); P.stash.splice(i,1); P.credits+=v; return {ok:true,msg:`Sold ${Items.name(it)} for ${v} cr.`}; }
    }
    return {ok:false,msg:"Unknown action."};
  }
  // Raid results: each player's haul goes to their own profile; contract pay is shared by the crew.
  function settleRaid(ship,profiles,raid,site){
    const cid=siteContract(ship,site), out={contract:null};
    if(cid&&raid.status==="extracted"&&raid.blackbox){ const C=CONTRACTS[cid]; ship.contracts=ship.contracts.filter(c=>c!==cid); ship.done.push(cid);
      for(const P of profiles) P.credits+=C.reward; out.contract={title:C.title,reward:C.reward}; }
    ship.day+=1; warTick(ship,1); return out;
  }
  const itemInfo=it=>Items.info(it);
  // put an item into a player's base: ammo and materials stack, everything else goes to the stash
  function grant(P,spec){ const D=Items.def(spec.d); if(!D) return;
    if(D.k==="ammo"){ P.ammo=P.ammo||{}; P.ammo[D.ammo]=(P.ammo[D.ammo]|0)+(spec.n|0); return; }
    if(D.k==="mat"){ P.mats=P.mats||{}; P.mats[spec.d]=(P.mats[spec.d]|0)+(spec.n||1); return; }
    if(D.k==="dye"){ P.unlocks=P.unlocks||{cloak:[],visor:[],crest:[]}; const u=P.unlocks[D.slot]=P.unlocks[D.slot]||[]; if(!u.includes(D.dye)) u.push(D.dye); return; }
    P.stash.push(mkItem(spec)); }
  let uidN=0; const uid=()=>"i"+Date.now().toString(36)+(uidN++).toString(36)+Math.random().toString(36).slice(2,5);
  function mkItem(it){ const o={uid:uid(),d:it.d,r:it.r|0}; if(it.l) o.l=it.l; if(it.v) o.v=it.v; if(it.m) o.m=it.m; return o; }
  return {dailyOp,REGIONS,regionOf,signals,allLocs,EPOCH,CONTROL,war,controlOf,warTick,pushChoir,news,jobsFor,SECTORS,LOCS,NPCS,CONTRACTS,CONS,loc,newShip,travelCost,siteContract,act,settleRaid,itemInfo,mkItem,grant};
})();
