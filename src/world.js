// =====================================================================
// WORLD — galaxy data + the crew ship. Pure functions over plain JSON.
// Multiplayer model: one shared `ship` per crew (location, fuel, contracts,
// day) changed only through World.act(ship, actor, action); every player
// keeps their own `profile` (credits, stash, stats). A server can run
// World.act authoritatively exactly like Sim.act.
// =====================================================================
const World = (() => {
  const SECTORS=[
    {id:"reach",name:"Gethsemane Reach",x:22,y:30,color:"#6f9b8c",desc:"Old mining lanes. Quiet, if you keep to the beacons."},
    {id:"vigil",name:"Vigil Expanse",x:68,y:24,color:"#c79a4a",desc:"Pilgrim routes between shrine stations."},
    {id:"cinder",name:"Cinder Drift",x:52,y:74,color:"#e0482f",desc:"Burned-out industrial belt. No law past the buoys."},
  ];
  const LOCS=[
    {id:"ninefold",sector:"reach",name:"Hangar Ninefold",type:"station",x:14,y:22,scene:{kind:"ring",hue:"#6f9b8c"},
      desc:"Contractor hangar and your home berth. Cheap fuel, honest prices.",npcs:["hesk","vance"],fuel:35},
    {id:"ossuary",sector:"reach",name:"Ossuary Belt",type:"outpost",x:32,y:37,scene:{kind:"planet",a:"#6a5a4a",b:"#2a2018",ring:true},
      desc:"A mining outpost dug into a dead moon. The foreman pays for dangerous work.",npcs:["dask"],fuel:45},
    {id:"ks9",sector:"reach",name:"Relay KS-9",type:"derelict",x:15,y:50,scene:{kind:"hulk",glow:"#ff7a30"},
      desc:"A comms relay gone silent six weeks ago. A fire still burns in its cargo hold.",site:{tier:1,fireStart:true,mods:{}}},
    {id:"tithe",sector:"reach",name:"Tithe Hulk 7",type:"derelict",x:36,y:18,scene:{kind:"hulk",glow:"#3a6a5a"},
      desc:"An ore tithe barge, powerless and cold. Rich holds, more husks.",site:{tier:2,mods:{power:false,huskAdd:2,loot:1.3}}},
    {id:"spire",sector:"vigil",name:"Saint Orrin's Spire",type:"station",x:66,y:14,scene:{kind:"spire",hue:"#c79a4a"},
      desc:"A shrine station of bells and candle-smoke. The reliquary sells armour blessed or otherwise.",npcs:["caul","ysolde"],fuel:50},
    {id:"mercy",sector:"vigil",name:"The Mercy of Iron",type:"derelict",x:80,y:32,scene:{kind:"hulk",glow:"#c22a1a"},
      desc:"A pilgrim hospital ship. Lights out, doors sealed, something singing in the vents.",site:{tier:3,mods:{power:false,huskAdd:3,loot:1.5}}},
    {id:"lazarus",sector:"cinder",name:"Lazarus Yards",type:"outpost",x:44,y:66,scene:{kind:"planet",a:"#7a3a1e",b:"#2a0e08",ring:false},
      desc:"Breaker yards on a smouldering world. Mott takes the jobs nobody else will.",npcs:["mott"],fuel:40},
    {id:"fennick",sector:"cinder",name:"Fennick's Hulk",type:"station",x:62,y:82,scene:{kind:"ring",hue:"#e0482f"},
      desc:"A black market bolted onto a gutted freighter. Rare weapons, no questions.",npcs:["fennick"],fuel:55},
    {id:"pyre",sector:"cinder",name:"Pyre Station",type:"derelict",x:38,y:84,scene:{kind:"hulk",glow:"#ffb040"},
      desc:"A refinery that has been burning for a month. Fewer husks. Much more fire.",site:{tier:3,mods:{fires:7,huskDrop:.35,loot:1.4}}},
  ];
  const NPCS={
    hesk:{name:"Quartermaster Hesk",role:"Trader",look:{skin:"#a68a6a",hood:"#3a4a44",eye:"#cfd8c8"},shop:{buy:1,sell:1,stock:[[{d:"bandage"},40],[{d:"medkit",r:1},140],[{d:"o2"},60],[{d:"ammo_pistol",n:12},50],[{d:"ammo_rifle",n:10},60],[{d:"ammo_shell",n:6},60],[{d:"pistol",r:0},240],[{d:"sixgun",r:0},300],[{d:"knife",r:0},120],[{d:"crowbar",r:0},90],[{d:"flashlight",r:0},60],[{d:"ration"},18],[{d:"waterflask"},14],[{d:"stew"},32],[{d:"org",n:3},30],[{d:"visor",r:0},220],[{d:"suit",r:0},260],[{d:"scrapvest",r:0},180],[{d:"cargo",r:0},120],[{d:"hardhat",r:0},180],[{d:"toolbelt",r:0},150],[{d:"eva",r:0},380],[{d:"scarf",r:0},60],[{d:"sling"},120],[{d:"frag"},160],[{d:"field"},450]]},
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
    c_pyre:{title:"Fireproof",site:"pyre",giver:"mott",reward:1400,brief:"Walk into Pyre Station and bring out its black box."},
  };
  const CONS={bandage:{name:"Bandage roll",sell:15,desc:"Stops bleeding on one limb."},medkit:{name:"Trauma kit",sell:55,desc:"Stops all bleeding and patches every limb."},
    o2:{name:"Oxygen canister",sell:25,desc:"Refills 50 suit O₂."},keycard:{name:"Captain's keycard",sell:20,desc:"Opens a station vault while power is on."}};

  const loc=id=>LOCS.find(l=>l.id===id);
  function newShip(){ return {v:1,name:"Ninefold Lark",loc:"ninefold",fuel:6,fuelMax:8,day:1,contracts:[],done:[],log:[],fab:1}; }
  function travelCost(ship,to){ const a=loc(ship.loc), b=loc(to); if(!a||!b||a.id===b.id) return 0; return a.sector===b.sector?1:3; }
  function siteContract(ship,site){ return ship.contracts.find(c=>CONTRACTS[c].site===site)||null; }
  // actor = {id, profile}; profile is the acting player's own save
  function act(ship,actor,a){
    const P=actor.profile, L=loc(ship.loc);
    switch(a.type){
      case "travel": { const c=travelCost(ship,a.to); if(!loc(a.to)||!c) return {ok:false,msg:"Already here."};
        if(ship.fuel<c) return {ok:false,msg:`Not enough fuel. That jump needs ${c}.`};
        ship.fuel-=c; ship.loc=a.to; ship.day+=c; return {ok:true,msg:`Jumped to ${loc(a.to).name}.`}; }
      case "tow": { if(ship.fuel>=1) return {ok:false,msg:"You still have fuel."}; ship.loc="ninefold"; ship.day+=4; return {ok:true,msg:"A Ninefold tug hauls you home. Four days lost."}; }
      case "refuel": { if(!L.fuel) return {ok:false,msg:"No fuel sold here."}; const need=ship.fuelMax-ship.fuel; if(!need) return {ok:false,msg:"Tanks are full."};
        const n=Math.min(need,Math.floor(P.credits/L.fuel)); if(!n) return {ok:false,msg:"You can't afford any fuel."};
        P.credits-=n*L.fuel; ship.fuel+=n; return {ok:true,msg:`Bought ${n} fuel for ${n*L.fuel} cr.`}; }
      case "accept": { const C=CONTRACTS[a.id]; if(!C||ship.done.includes(a.id)||ship.contracts.includes(a.id)) return {ok:false,msg:"Not available."};
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
    ship.day+=1; return out;
  }
  const itemInfo=it=>Items.info(it);
  // put an item into a player's base: ammo and materials stack, everything else goes to the stash
  function grant(P,spec){ const D=Items.def(spec.d); if(!D) return;
    if(D.k==="ammo"){ P.ammo=P.ammo||{}; P.ammo[D.ammo]=(P.ammo[D.ammo]|0)+(spec.n|0); return; }
    if(D.k==="mat"){ P.mats=P.mats||{}; P.mats[spec.d]=(P.mats[spec.d]|0)+(spec.n||1); return; }
    if(D.k==="dye"){ P.unlocks=P.unlocks||{cloak:[],visor:[],crest:[]}; const u=P.unlocks[D.slot]=P.unlocks[D.slot]||[]; if(!u.includes(D.dye)) u.push(D.dye); return; }
    P.stash.push(mkItem(spec)); }
  let uidN=0; const uid=()=>"i"+Date.now().toString(36)+(uidN++).toString(36)+Math.random().toString(36).slice(2,5);
  function mkItem(it){ const o={uid:uid(),d:it.d,r:it.r|0}; if(it.l) o.l=it.l; if(it.v) o.v=it.v; return o; }
  return {SECTORS,LOCS,NPCS,CONTRACTS,CONS,loc,newShip,travelCost,siteContract,act,settleRaid,itemInfo,mkItem,grant};
})();
