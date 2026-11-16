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
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~##============##~~~~~~~~~~~~",
      "~############.t.t..N.t.t.t.###==###==##~",
      "~#.K.jj.j.U.#...3..1.2.4...#.C...qV..G#~",
      "~#..........#u.............#..........#~",
      "~#..........+u.....MM......+..nTTn....#~",
      "~#..........#.t..........t.#...nn...u.#~",
      "~#cc.......c#p............p#p.......u.#~",
      "~#####+############++###########+######~",
      "~=.................@..................=~",
      "~=....................................=~",
      "~#####+########+######+#######+####+###~",
      "~#By.....yB.#....s#......t.#Q...c#....#~",
      "~#..........#w....#........#....c#...A#~",
      "~#By.....yB.#....s#........#.....#....#~",
      "~=..........#w....#IIIIIIII#.....#EE..=~",
      "~#..........#.....#.z..#...#...g.#EE..#~",
      "~#By......J.#.....#....#...#.....#....#~",
      "~#..........#.....#....#...#.....#....#~",
      "~#By.......p#xx..p#....#..B#cc..c#....#~",
      "~######################################~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"],
      rooms:[["Bridge",13,2,26,7],["Armory",2,3,11,7],["Break room",28,3,37,7],["Main hall",2,9,37,10],["Crew quarters",2,12,11,19],["Bathroom",13,12,17,19],["Brig",19,12,26,19],["Ship hold",28,12,32,19],["Airlock",34,12,37,19]]},
  };
  let ROOMS=KS9_ROOMS;
  function bind(s){ ROOMS=(MAPS[s.map]||MAPS.ks9).rooms; }

  const LIMBS = ["head","torso","larm","rarm","lleg","rleg"];
  const LNAME = {head:"head",torso:"torso",larm:"left arm",rarm:"right arm",lleg:"left leg",rleg:"right leg"};
  const PLAYER_HP = {head:30,torso:60,larm:35,rarm:35,lleg:40,rleg:40};
  const HUSK_HP   = {head:14,torso:34,larm:18,rarm:18,lleg:22,rleg:22};
  const HIT_W = [["head",9],["torso",41],["larm",13],["rarm",13],["lleg",12],["rleg",12]];
  const FULL = 101; // kPa
  const VALUABLES = [["Encrypted data shard",120],["Gold-plated relay",90],["Sealed biosample",150],
    ["Officer's signet",70],["Quantum coolant cell",110],["Unmarked credit chit",80]];
  const GEAR = {
    pistol:{slot:"weapon",name:"Service pistol",dmg:[11,17],acc:0,fall:.035,value:120,desc:"Reliable sidearm. 11–17 damage, falls off at range."},
    scatter:{slot:"weapon",name:"Breach scattergun",dmg:[17,27],acc:.06,fall:.085,value:520,desc:"Devastating up close, hopeless past five tiles."},
    rifle:{slot:"weapon",name:"Rivet rifle",dmg:[13,20],acc:.12,fall:.018,value:640,desc:"Accurate at long range. 13–20 damage."},
    suit:{slot:"armor",name:"Contractor suit",dr:0,fire:0,o2:60,value:0,issued:true,desc:"Standard sealed suit. 60 O₂ tank."},
    flak:{slot:"armor",name:"Flak carapace",dr:.3,fire:.1,o2:50,value:760,desc:"Cuts head and torso damage by 30%. Smaller 50 O₂ tank."},
    hazard:{slot:"armor",name:"Hazard suit",dr:.1,fire:.65,o2:100,value:680,desc:"Shrugs off most fire damage. 100 O₂ tank."},
    sling:{slot:"pack",name:"Sling pack",slots:6,value:0,issued:true,desc:"Issued pack. 6 slots."},
    hauler:{slot:"pack",name:"Hauler pack",slots:10,value:540,desc:"Big frame pack. 10 slots."},
  };
  const ITEM = {
    W:{kind:"gear",gear:"scatter"}, R:{kind:"gear",gear:"rifle"}, Y:{kind:"gear",gear:"flak"}, Z:{kind:"gear",gear:"hazard"}, H:{kind:"gear",gear:"hauler"},
    a:{kind:"ammo",name:"Pistol magazine"}, b:{kind:"bandage",name:"Bandage roll"},
    m:{kind:"medkit",name:"Trauma kit"}, o:{kind:"o2",name:"Oxygen canister"},
    k:{kind:"keycard",name:"Captain's keycard"}, v:{kind:"valuable"}, X:{kind:"blackbox",name:"Black box recorder",value:500},
  };

  // ---------- RNG (mulberry32, state lives in game state) ----------
  function rand(s){ s.rng=(s.rng+0x6D2B79F5)|0; let t=s.rng; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
  const ri=(s,a,b)=>a+Math.floor(rand(s)*(b-a+1));
  const chance=(s,p)=>rand(s)<p;

  // ---------- tile predicates ----------
  const PROPS={c:"crate",B:"bed",t:"desk",l:"locker",r:"barrel",f:"brazier",g:"generator",S:"tank",
    u:"couch",T:"table",n:"chair",q:"coffee",V:"vending",G:"arcade",w:"toilet",s:"sink",x:"shower",I:"bars",z:"captive",j:"gunrack",p:"plant",d:"captchair",y:"footlocker",U:"workbench"};
  const TERMS={N:"helm",M:"navtable",K:"rack",Q:"stash",J:"records",C:"board",A:"airlock"};
  const SEATS={"1":"pilot","2":"copilot","3":"nav","4":"eng"};
  const gas  = t => t.t==="floor"||t.t==="extract"||t.t==="breach"||t.t==="prop"||t.t==="terminal"||t.t==="seat"||(t.t==="door"&&t.open);
  const walk = t => t.t==="floor"||t.t==="extract"||t.t==="seat"||(t.t==="door"&&t.open);
  const clear= t => !(t.t==="wall"||t.t==="console"||(t.t==="door"&&!t.open));

  const STARTER={weapon:"pistol",armor:"suit",pack:"sling",rounds:12,inv:[{kind:"bandage",name:"Bandage roll"},{kind:"bandage",name:"Bandage roll"}]};
  // opts: {map:"ks9"|"ship", mode:"raid"|"ship", site:"Relay KS-9", crew:[{id,name,loadout}],
  //        mods:{power:bool, fires:n, huskAdd:n, huskDrop:p, loot:x}}
  function newGame(seed,loadout,opts={}){
    const mapId=opts.map||"ks9", MAP=MAPS[mapId].rows; ROOMS=MAPS[mapId].rooms;
    const W=Math.max(...MAP.map(r=>r.length)), H=MAP.length;
    const s={v:1,seed:seed>>>0,rng:seed|0,turn:1,W,H,tiles:[],P:[],wind:[],blood:{},items:[],ents:[],
      log:[],fx:[],fire:{},fuel:[],scorch:{},power:true,map:mapId,mode:opts.mode||"raid",site:opts.site||"Relay KS-9",status:"playing",nextId:1,cause:null};
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
        case "u": case "T": case "n": case "q": case "V": case "G": case "w": case "s": case "x": case "I": case "z": case "j": case "p": case "d": case "y": case "U": t={t:"prop",kind:PROPS[c]};break;
        case "N": case "M": case "K": case "Q": case "J": case "C": case "A": t={t:"terminal",kind:TERMS[c]};break;
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
    if(s.mode==="ship"){ for(const p of players(s)) p.seen.fill(1); for(const t of s.tiles) if(t.t==="door") t.open=true; return s; }
    applyMods(s,opts.mods||{});
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
    if(m.loot) for(const it of s.items) if(it.kind==="valuable") it.value=Math.round(it.value*m.loot);
  }
  function addPlayer(s,id,name,x,y,lo){
    const armor=GEAR[lo.armor]?lo.armor:"suit", pack=GEAR[lo.pack]?lo.pack:"sling", weapon=GEAR[lo.weapon]?lo.weapon:null;
    s.ents.push({id,kind:"player",name,x,y,hp:{...PLAYER_HP},max:{...PLAYER_HP},bleed:{},blood:100,o2:GEAR[armor].o2,o2max:GEAR[armor].o2,ammo:lo.rounds|0,
      weapon,armor,pack,cap:GEAR[pack].slots,
      inv:(lo.inv||[]).slice(0,GEAR[pack].slots).map(it=>({...it,id:s.nextId++})),alive:true,acted:false,busy:0,face:[1,0],seen:new Array(s.W*s.H).fill(0),flags:{}});
  }
  function addHusk(s,x,y){
    s.ents.push({id:"h"+(s.nextId++),kind:"husk",name:"husk",x,y,hp:{...HUSK_HP},max:{...HUSK_HP},bleed:{},blood:60,
      alive:true,aware:false,last:null,limp:false,busy:0,face:[0,1]});
  }
  function addItem(s,c,x,y){
    const d=ITEM[c]; const it={id:s.nextId++,kind:d.kind,name:d.name,x,y};
    if(d.kind==="valuable"){const v=VALUABLES[ri(s,0,VALUABLES.length-1)]; it.name=v[0]; it.value=v[1]+ri(s,-15,25);}
    if(d.value) it.value=d.value;
    if(d.kind==="gear"){ it.gear=d.gear; it.name=GEAR[d.gear].name; it.value=GEAR[d.gear].value; }
    s.items.push(it);
  }

  // ---------- helpers ----------
  const idx=(s,x,y)=>y*s.W+x;
  const inb=(s,x,y)=>x>=0&&y>=0&&x<s.W&&y<s.H;
  const tileAt=(s,x,y)=>inb(s,x,y)?s.tiles[idx(s,x,y)]:{t:"space"};
  const entAt=(s,x,y)=>s.ents.find(e=>e.alive&&e.x===x&&e.y===y);
  const players=s=>s.ents.filter(e=>e.kind==="player");
  const N4=[[1,0],[-1,0],[0,1],[0,-1]];
  function face(e,dx,dy){ if(!dx&&!dy) return; e.face=Math.abs(dx)>=Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)]; }
  const fx=(s,o)=>s.fx.push(o);
  let CTX=null; // which player a log line is about (multiplayer renders it from their perspective)
  function say(s,msg,kind="info"){ s.log.push({t:s.turn,msg,kind,pid:CTX}); if(s.log.length>80) s.log.shift(); }
  function roomName(x,y){ for(const r of ROOMS) if(x>=r[1]&&x<=r[3]&&y>=r[2]&&y<=r[4]) return r[0]; return "Service crawlway"; }
  function line(x0,y0,x1,y1,extend=0){ // Bresenham, excludes start
    const pts=[]; let dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx+dy, x=x0, y=y0;
    const total=Math.max(dx,-dy)+extend;
    for(let i=0;i<total;i++){ const e2=2*err; if(e2>=dy){err+=dy;x+=sx;} if(e2<=dx){err+=dx;y+=sy;} pts.push([x,y]); }
    return pts;
  }
  function los(s,x0,y0,x1,y1){
    const pts=line(x0,y0,x1,y1); for(let i=0;i<pts.length-1;i++){ if(!clear(tileAt(s,pts[i][0],pts[i][1]))) return false; } return true;
  }
  const sightR=s=>s.power?8:4;
  function canSee(s,p,x,y){ const d=Math.hypot(p.x-x,p.y-y); return d<=sightR(s)+.5 && los(s,p.x,p.y,x,y); }
  function anyPlayerSees(s,x,y){ return players(s).some(p=>p.alive&&canSee(s,p,x,y)); }
  function fov(s,p){
    if(s.mode==="ship"){ p.seen.fill(1); return new Array(s.W*s.H).fill(1); }
    const v=new Array(s.W*s.H).fill(0), R=sightR(s);
    for(let y=Math.max(0,p.y-R);y<=Math.min(s.H-1,p.y+R);y++)for(let x=Math.max(0,p.x-R);x<=Math.min(s.W-1,p.x+R);x++){
      if(canSee(s,p,x,y)){ v[idx(s,x,y)]=1; p.seen[idx(s,x,y)]=1; }
    }
    return v;
  }
  function pickLimb(s){ let r=rand(s)*100; for(const [l,w] of HIT_W){ if((r-=w)<0) return l; } return "torso"; }
  function crippled(e){ return e.hp.lleg<=0||e.hp.rleg<=0; }
  function bleedDecal(s,x,y,n=1){ const k=idx(s,x,y); s.blood[k]=Math.min(6,(s.blood[k]||0)+n); }
  function noise(s,x,y,r){ for(const h of s.ents) if(h.kind==="husk"&&h.alive&&Math.hypot(h.x-x,h.y-y)<=r){ h.aware=true; h.last={x,y}; } }

  function damage(s,e,limb,dmg,bleedP,cause){
    if(!e.alive) return;
    if(e.armor&&(limb==="head"||limb==="torso")&&GEAR[e.armor].dr) dmg=Math.max(1,Math.round(dmg*(1-GEAR[e.armor].dr)));
    if(e.downed&&(limb==="head"||limb==="torso")){ kill(s,e,cause); return; }
    const was=e.hp[limb]; e.hp[limb]=Math.max(0,was-dmg);
    if(chance(s,bleedP)) e.bleed[limb]=1;
    bleedDecal(s,e.x,e.y,1); fx(s,{type:"hurt",id:e.id,x:e.x,y:e.y});
    const vis=anyPlayerSees(s,e.x,e.y), you=e.kind==="player";
    if(was>0&&e.hp[limb]<=0){
      if(limb==="head"||limb==="torso"){
        if(you&&players(s).length>1&&players(s).some(q=>q!==e&&q.alive&&!q.downed)){ e.downed=true; e.downT=8; e.downCause=cause; const c0=CTX; CTX=e.id; say(s,"You're down! A crewmate has 8 turns to reach you.","bad"); CTX=c0; fx(s,{type:"downed",id:e.id,x:e.x,y:e.y}); return; }
        kill(s,e,cause); return; }
      if(you) say(s,`Your ${LNAME[limb]} is mangled beyond use!`,"bad");
      else if(vis) say(s,`The husk's ${LNAME[limb]} is blown off.`,"good");
    }
  }
  function kill(s,e,cause){
    e.alive=false; bleedDecal(s,e.x,e.y,3); fx(s,{type:"die",id:e.id,x:e.x,y:e.y});
    if(e.kind==="player"){ s.cause=cause; e.cause=cause; const c0=CTX; CTX=e.id; say(s,`You die. ${cause}`,"bad"); CTX=c0; }
    else { if(anyPlayerSees(s,e.x,e.y)) say(s,`The husk collapses. ${cause==="vacuum"?"Its lungs gave out.":""}`.trim(),"good"); }
  }

  // ---------- player actions ----------
  function act(s,pid,a){
    if(s.status!=="playing") return false;
    const p=s.ents.find(e=>e.id===pid); if(!p||!p.alive||p.acted||p.downed) return false;
    s.fx=[]; CTX=p.id;
    let ok=false, slow=false;
    if(s.mode==="ship"){ // crew move freely aboard; no turns, no hazards
      if(a.type==="move") return !!doMove(s,p,a.dx,a.dy);
      if(a.type==="interact") return doInteract(s,p);
      return false;
    }
    switch(a.type){
      case "move": { const r=doMove(s,p,a.dx,a.dy); ok=!!r; slow=r==="walked"&&crippled(p); break; }
      case "wait": ok=true; break;
      case "shoot": ok=doShoot(s,p,a.x,a.y); break;
      case "interact": ok=doInteract(s,p); break;
      case "pickup": ok=doPickup(s,p); break;
      case "use": ok=doUse(s,p,a.index); break;
      case "give": ok=doGive(s,p,a.index,a.to); break;
      case "extract": ok=doExtract(s,p); break;
      case "abandon": p.alive=false; p.flags.abandoned=1; s.cause=s.cause||null; p.cause="You abandoned the contract and left your kit behind."; say(s,"You abandon the contract and seal yourself in the shuttle.","bad"); ok=true; if(players(s).every(q=>!q.alive)) s.status="ended"; break;
    }
    if(!ok) return false;
    p.acted=true; if(slow){ p.busy=1; if(!p.flags.limp){p.flags.limp=1; say(s,"You drag your ruined leg. Moving takes twice as long.","warn");} }
    while(s.status==="playing"&&players(s).every(q=>!q.alive||q.acted||q.downed)){
      CTX=null;
      endTurn(s);
      for(const q of players(s)){ q.acted=false; if(q.busy>0&&q.alive){ q.busy--; q.acted=true; } }
    }
    return true;
  }

  function doMove(s,p,dx,dy){
    face(p,dx,dy);
    const x=p.x+dx,y=p.y+dy, t=tileAt(s,x,y), o=entAt(s,x,y);
    if(o&&o.kind==="husk") return melee(s,p,o);
    if(o) return false;
    if(t.t==="door"&&!t.open) return tryDoor(s,p,t,x,y);
    if(t.t==="window"){ say(s,"Reinforced glass. Beyond it, nothing but stars.","info"); return false; }
    if(t.t==="terminal"){ fx(s,{type:"terminal",kind:t.kind,pid:p.id}); return false; }
    if(s.mode==="ship"&&t.t==="prop"){ fx(s,{type:"flavor",kind:t.kind,pid:p.id,x,y}); return false; }
    if(t.t==="console"){ say(s,"Main power relay. Press F next to it to toggle station power.","info"); return false; }
    if(t.t==="prop"&&t.kind==="barrel"){ say(s,"A fuel drum. It sloshes. One good shot would light it up.","warn"); return false; }
    if(t.t==="prop"){ say(s,{crate:"A sealed cargo crate. Too heavy to move.",bed:"A bunk, sheets stiff with old blood.",desk:"A desk buried in damp printouts.",locker:"A dented locker. Someone clawed at it from inside.",barrel:"A fuel drum. It sloshes.",brazier:"Someone lit a fire in here. Recently.",generator:"A backup generator, ticking as it cools.",tank:"A specimen tank. Something inside turns to watch you."}[t.kind]||"It's in the way.","info"); return false; }
    if(!walk(t)) return false;
    p.x=x; p.y=y;
    if(t.t==="seat"){ p.face=[0,-1]; fx(s,{type:"sit",kind:t.kind,pid:p.id,x,y}); }
    if(s.fire[idx(s,x,y)]) say(s,"You step into the flames!","bad");
    const here=s.items.filter(i=>i.x===x&&i.y===y);
    if(here.length) say(s,`You see here: ${here.map(i=>i.name).join(", ")}. (G to pick up)`,"info");
    const rn=roomName(x,y); if(rn!==p.flags.room){ p.flags.room=rn; }
    if(t.t==="extract"&&!p.flags.padTip){ p.flags.padTip=1; say(s,"You're on the shuttle pad. Press Q to extract.","good"); }
    return "walked";
  }
  function tryDoor(s,p,t,x,y){
    if(t.broken){ t.open=true; return true; }
    if(t.locked){
      if(s.power){
        if(p.inv.some(i=>i.kind==="keycard")){ t.locked=false; t.open=true; say(s,"The keycard reader blinks green. The vault door grinds open.","good"); return true; }
        say(s,"ACCESS DENIED. The maglock is powered. A keycard, or no power at all, would get you in.","warn"); return false;
      }
    } else if(s.power){ t.open=true; fx(s,{type:"door",x,y}); say(s,"The door hisses open.","info"); return true; }
    // unpowered: force it
    t.pry++; noise(s,x,y,5); fx(s,{type:"bash",x,y});
    if(t.pry>=3){ t.open=true; t.locked=false; t.pry=0; say(s,"You wrench the dead door open.","info"); }
    else say(s,`You brace a pry bar in the seam and heave… (${t.pry}/3)`,"info");
    return true;
  }
  function melee(s,p,h){
    const pen=(p.hp.rarm<=0?.3:0)+(p.hp.larm<=0?.1:0); fx(s,{type:"melee",x:h.x,y:h.y});
    if(chance(s,.82-pen)){ const l=pickLimb(s), d=ri(s,6,10); say(s,`You club the husk's ${LNAME[l]} with your wrench.`,"info"); damage(s,h,l,d,.25,"beaten"); }
    else say(s,"Your wrench swing whiffs.","info");
    h.aware=true; h.last={x:p.x,y:p.y};
    return true;
  }
  function hitChance(s,p,tx,ty){
    const d=Math.hypot(tx-p.x,ty-p.y);
    const w=GEAR[p.weapon]||GEAR.pistol; let c=.9+w.acc-w.fall*d;
    c-= p.hp.rarm<=0?.35:(1-p.hp.rarm/p.max.rarm)*.15;
    c-= p.hp.larm<=0?.12:0;
    if(p.blood<50) c-=.15;
    if(!s.power&&d>3) c-=.1;
    return Math.max(.05,Math.min(.95,c));
  }
  function doShoot(s,p,tx,ty){
    if(tx===p.x&&ty===p.y) return false;
    if(!canSee(s,p,tx,ty)){ say(s,"You can't see that spot.","info"); return false; }
    const t=tileAt(s,tx,ty), target=entAt(s,tx,ty);
    const barrel=t.t==="prop"&&t.kind==="barrel";
    if(!target&&t.t!=="window"&&!barrel){ say(s,"Nothing worth a bullet there.","info"); return false; }
    if(!p.weapon){ say(s,"You have no gun. Bump into husks to fight with your wrench.","warn"); return false; }
    if(p.ammo<=0){ say(s,"*click* Your weapon is empty.","warn"); return false; }
    p.ammo--; noise(s,p.x,p.y,10); face(p,tx-p.x,ty-p.y);
    const pts=line(p.x,p.y,tx,ty,6), hc=target?hitChance(s,p,tx,ty):1;
    let imp=[tx,ty], what="none";
    for(const [x,y] of pts){
      if(!inb(s,x,y)) break;
      const tt=tileAt(s,x,y); imp=[x,y];
      if(tt.t==="prop"&&tt.kind==="barrel"&&((x===tx&&y===ty)||chance(s,.25))){ fx(s,{type:"shot",x0:p.x,y0:p.y,x1:x,y1:y,what:"wall"}); explode(s,x,y); return true; }
      if(tt.t==="window"){ what="glass"; fx(s,{type:"shot",x0:p.x,y0:p.y,x1:x,y1:y,what}); hitWindow(s,x,y,tt, !(x===tx&&y===ty)); return true; }
      if(!clear(tt)){ what="wall"; say(s,target?"Your shot goes wide and sparks off the bulkhead.":"The round flattens against the bulkhead.","info"); break; }
      const e=entAt(s,x,y);
      if(e&&e!==p){
        const isT=e===target;
        if(isT? chance(s,hc) : chance(s,.3)){
          const wd=(GEAR[p.weapon]||GEAR.pistol).dmg, l=pickLimb(s), d=ri(s,wd[0],wd[1]); what="flesh";
          fx(s,{type:"shot",x0:p.x,y0:p.y,x1:x,y1:y,what});
          say(s, e.kind==="player"?`Your round hits ${e.name} in the ${LNAME[l]}!`:`You shoot the husk in the ${LNAME[l]}.`, "good");
          damage(s,e,l,d,.55,"shot"); if(e.kind==="husk"){e.aware=true;e.last={x:p.x,y:p.y};}
          return true;
        }
        if(isT) say(s,"Your shot misses the husk.","info");
      }
    }
    fx(s,{type:"shot",x0:p.x,y0:p.y,x1:imp[0],y1:imp[1],what});
    return true;
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
    p.inv.splice(i,1); q.inv.push(it); say(s,`You hand over the ${it.name}.`,"good"); return true;
  }
  function doRevive(s,p,q){
    q.downed=false; q.downT=0; q.hp.torso=Math.max(q.hp.torso,12); q.hp.head=Math.max(q.hp.head,6); delete q.bleed.torso; delete q.bleed.head; q.blood=Math.max(q.blood,30);
    say(s,"You haul your crewmate back to their feet.","good"); fx(s,{type:"revive",id:q.id,x:q.x,y:q.y}); return true;
  }
  function doInteract(s,p){
    for(const [dx,dy] of N4){ const q=s.ents.find(e=>e.kind==="player"&&e.alive&&e.downed&&e.x===p.x+dx&&e.y===p.y+dy); if(q){ face(p,dx,dy); return doRevive(s,p,q); } }
    if(s.mode==="ship"&&tileAt(s,p.x,p.y).t==="seat"){ fx(s,{type:"terminal",kind:"navtable",pid:p.id}); return false; }
    for(const [dx,dy] of [p.face||[0,-1],...N4]){ const t=tileAt(s,p.x+dx,p.y+dy); if(t.t==="terminal"){ face(p,dx,dy); fx(s,{type:"terminal",kind:t.kind,pid:p.id}); return false; } }
    if(s.mode==="ship") for(const [dx,dy] of [p.face||[0,-1],...N4]){ const t=tileAt(s,p.x+dx,p.y+dy); if(t.t==="prop"){ face(p,dx,dy); fx(s,{type:"flavor",kind:t.kind,pid:p.id,x:p.x+dx,y:p.y+dy}); return false; } }
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
      if(it.kind==="ammo"){ p.ammo+=8; say(s,"You slap the magazine into your belt. +8 rounds.","good"); }
      else if(p.inv.length>=p.cap){ say(s,`Your pack is full. ${it.name} stays on the deck.`,"warn"); continue; }
      else { p.inv.push({id:it.id,kind:it.kind,name:it.name,value:it.value,gear:it.gear}); say(s,`You take the ${it.name}${it.value?` (≈${it.value} cr)`:""}.`, it.kind==="blackbox"?"good":"info"); }
      s.items=s.items.filter(i=>i!==it);
    }
    return true;
  }
  function doUse(s,p,i){
    const it=p.inv[i]; if(!it) return false;
    const bleeding=LIMBS.filter(l=>p.bleed[l]);
    if(it.kind==="bandage"){
      if(!bleeding.length){ say(s,"You're not bleeding.","info"); return false; }
      const l=bleeding.sort((a,b)=>(a==="torso"||a==="head"?-1:0)-(b==="torso"||b==="head"?-1:0))[0];
      delete p.bleed[l]; p.inv.splice(i,1); say(s,`You wrap your ${LNAME[l]} tight. The bleeding stops.`,"good"); return true;
    }
    if(it.kind==="medkit"){
      p.bleed={}; for(const l of LIMBS) if(p.hp[l]>0) p.hp[l]=Math.min(p.max[l],p.hp[l]+18);
      p.blood=Math.min(100,p.blood+15); p.inv.splice(i,1); say(s,"You jab a coagulant and staple your wounds shut.","good"); return true;
    }
    if(it.kind==="o2"){ p.o2=Math.min(p.o2max,p.o2+50); p.inv.splice(i,1); say(s,"You clip the canister into your suit. +50 O₂.","air"); return true; }
    if(it.kind==="gear"){ const g=GEAR[it.gear]; if(!g) return false;
      const cur=p[g.slot];
      if(g.slot==="pack"&&p.inv.length-1+(GEAR[cur].issued?0:1)>g.slots){ say(s,"Too much in your pack to swap to that one.","warn"); return false; }
      p.inv.splice(i,1); p[g.slot]=it.gear;
      if(cur&&!GEAR[cur].issued) p.inv.push({id:s.nextId++,kind:"gear",gear:cur,name:GEAR[cur].name,value:GEAR[cur].value});
      if(g.slot==="armor"){ p.o2max=g.o2; p.o2=Math.min(p.o2,g.o2); }
      if(g.slot==="pack") p.cap=g.slots;
      say(s,`You equip the ${g.name}.`,"good"); return true; }
    if(it.kind==="keycard"){ say(s,"Captain's keycard. Opens the vault while station power is on.","info"); return false; }
    say(s,`${it.name}. Worth about ${it.value} cr to the right buyer.`,"info"); return false;
  }
  function doExtract(s,p){
    if(tileAt(s,p.x,p.y).t!=="extract"){ say(s,"You need to be standing on the shuttle pad to extract.","warn"); return false; }
    p.extracted=true; p.alive=false; say(s,"You seal the shuttle hatch and punch the undock.","good");
    if(players(s).every(q=>!q.alive)) s.status="ended"; return true;
  }

  // ---------- world resolution ----------
  function endTurn(s){
    atmos(s); fireStep(s); wind(s); husks(s); vitals(s);
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
    for(const it of lost) say(s,`The ${it.name} tumbles out of the breach into space.`,"air");
    for(const e of s.ents){
      if(!e.alive) continue; const i=idx(s,e.x,e.y), j=s.wind[i], str=s.windStr[i];
      if(j<0||str<4) continue;
      if(e.kind==="player"){ if(!e.flags.mag){ e.flags.mag=1; say(s,"Wind screams past you toward the breach. Your magboots hold.","air"); } continue; }
      if(!chance(s,Math.min(.85,str/18))) continue;
      const jx=j%s.W, jy=(j/s.W)|0; if(entAt(s,jx,jy)) continue;
      e.x=jx; e.y=jy;
      if(s.tiles[j].t==="breach"){ e.alive=false; e.spaced=true; fx(s,{type:"spaced",x:jx,y:jy}); say(s,"A husk is torn through the breach and spins away into the void.","good"); }
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
        if(it.kind==="ammo"&&chance(s,.4)){ it.gone=true; fx(s,{type:"cookoff",x,y}); noise(s,x,y,8); say(s,"Ammunition cooks off in the flames!","warn"); }
        else if((it.kind==="bandage"||it.kind==="medkit")&&chance(s,.3)){ it.gone=true; if(anyPlayerSees(s,x,y)) say(s,`The ${it.name} burns away.`,"warn"); }
        else if(it.kind==="o2"&&chance(s,.5)){ it.gone=true; s.fire[i]=3; s.fuel[i]+=4; fx(s,{type:"flare",x,y}); say(s,"An oxygen canister ruptures. The fire roars white-hot!","bad"); }
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
        if(e){ const hits=d<=1.5?2:1, fr=e.armor?GEAR[e.armor].fire*.5:0; for(let k=0;k<hits;k++) damage(s,e,pickLimb(s),Math.round((d<=1.5?ri(s,12,20):ri(s,6,11))*(1-fr)),.5,"Caught in a fuel explosion.");
          if(e.kind==="player"&&e.alive) say(s,"The blast hammers you off your feet!","bad"); }
      }
    }
  }
  function stepToward(s,h,tx,ty){
    const W=s.W, start=idx(s,h.x,h.y), goal=idx(s,tx,ty), prev=new Int32Array(W*s.H).fill(-1); prev[start]=start;
    const q=[start];
    for(let k=0;k<q.length&&k<900;k++){ const c=q[k]; if(c===goal) break; const x=c%W,y=(c/W)|0;
      for(const [dx,dy] of N4){ const nx=x+dx,ny=y+dy; if(!inb(s,nx,ny)) continue; const j=ny*W+nx; if(prev[j]!==-1) continue;
        const t=s.tiles[j]; if(!(walk(t)||(t.t==="door"&&!t.open&&!t.locked)||j===goal)) continue; if(s.fire[j]&&j!==goal) continue; prev[j]=c; q.push(j); } }
    if(prev[goal]===-1) return null;
    let c=goal; while(prev[c]!==start&&c!==start) c=prev[c];
    return c===start?null:[c%W,(c/W)|0];
  }
  function husks(s){
    for(const h of s.ents){
      if(h.kind!=="husk"||!h.alive) continue;
      if(s.fire[idx(s,h.x,h.y)]){ const opts=N4.map(([dx,dy])=>[h.x+dx,h.y+dy]).filter(([x,y])=>walk(tileAt(s,x,y))&&!entAt(s,x,y)&&!s.fire[idx(s,x,y)]);
        if(opts.length){ const [x,y]=opts[ri(s,0,opts.length-1)]; face(h,x-h.x,y-h.y); h.x=x; h.y=y; continue; } }
      let best=null,bd=1e9;
      for(const p of players(s)){ if(!p.alive) continue; const d=Math.abs(p.x-h.x)+Math.abs(p.y-h.y); if(d<bd){bd=d;best=p;} }
      if(!best) return;
      const R=s.power?8:5;
      if(Math.hypot(best.x-h.x,best.y-h.y)<=R&&los(s,h.x,h.y,best.x,best.y)){
        if(!h.aware&&anyPlayerSees(s,h.x,h.y)) say(s,"The husk's head snaps toward you. It shrieks.","warn");
        h.aware=true; h.last={x:best.x,y:best.y};
      }
      if(bd===1){ huskAttack(s,h,best); continue; }
      if(crippled(h)){ h.limp=!h.limp; if(h.limp) continue; }
      if(h.last){
        const st=stepToward(s,h,h.last.x,h.last.y);
        if(!st){ h.last=null; continue; }
        const [x,y]=st, t=tileAt(s,x,y);
        if(t.t==="door"&&!t.open){
          t.hp--; face(h,x-h.x,y-h.y); fx(s,{type:"bash",x,y}); if(anyPlayerSees(s,x,y)||Math.hypot(best.x-x,best.y-y)<7) say(s,"Something is pounding on a door nearby.","warn");
          if(t.hp<=0){ t.open=true; t.broken=true; say(s,"A door buckles and tears off its track!","bad"); }
          continue;
        }
        if(!entAt(s,x,y)&&walk(t)){ face(h,x-h.x,y-h.y); h.x=x; h.y=y; }
        if(h.x===h.last.x&&h.y===h.last.y) h.last=null;
      } else if(chance(s,.25)){
        const [dx,dy]=N4[ri(s,0,3)], t=tileAt(s,h.x+dx,h.y+dy);
        if(walk(t)&&!entAt(s,h.x+dx,h.y+dy)&&!s.fire[idx(s,h.x+dx,h.y+dy)]){ face(h,dx,dy); h.x+=dx; h.y+=dy; }
      }
    }
  }
  function huskAttack(s,h,p){
    CTX=p.id; const armsGone=h.hp.larm<=0&&h.hp.rarm<=0; face(h,p.x-h.x,p.y-h.y); fx(s,{type:"claw",x:p.x,y:p.y,id:h.id});
    if(chance(s,armsGone?.5:.68)){
      const l=pickLimb(s), d=armsGone?ri(s,3,6):ri(s,4,9);
      say(s, armsGone?`The husk bites into your ${LNAME[l]}!`:`The husk rakes your ${LNAME[l]}!`, "bad");
      damage(s,p,l,d,.35,"Torn apart by a husk.");
    } else say(s,"The husk lunges and misses.","info");
  }
  function vitals(s){
    for(const e of s.ents){
      if(!e.alive) continue; CTX=e.kind==="player"?e.id:null;
      const bl=LIMBS.filter(l=>e.bleed[l]);
      if(bl.length){ e.blood-=2*bl.length; if(chance(s,.6)) bleedDecal(s,e.x,e.y,1);
        for(const l of bl) if(chance(s,e.kind==="player"?.04:.06)) delete e.bleed[l];
        if(e.blood<=0){ kill(s,e,e.kind==="player"?"Bled out on the deck plating.":"bled"); continue; }
        if(e.kind==="player"&&e.blood<40&&chance(s,.25)) say(s,"Your vision tunnels. You've lost a lot of blood.","bad");
      }
      if(s.fire[idx(s,e.x,e.y)]){ const lv=s.fire[idx(s,e.x,e.y)], l=chance(s,.6)?(chance(s,.5)?"lleg":"rleg"):pickLimb(s);
        if(e.kind==="player") say(s,"You're burning!","bad"); else if(anyPlayerSees(s,e.x,e.y)) say(s,"The husk shrieks as it burns.","good");
        const fr=e.armor?GEAR[e.armor].fire:0;
        damage(s,e,l,Math.max(1,Math.round((ri(s,2,3)+lv)*(1-fr))),0,e.kind==="player"?"Burned alive in a dying station.":"burned"); if(!e.alive) continue; }
      const pr=s.P[idx(s,e.x,e.y)];
      if(e.kind==="husk"){
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
    for(const e of s.ents) mix(`${e.id}${e.x},${e.y}${e.alive?1:0}${LIMBS.map(l=>e.hp[l]).join("")}${e.blood}${e.ammo??""}${e.acted?1:0}${e.downed?"d"+e.downT:""}${(e.inv||[]).length}`);
    for(const it of s.items) mix(`${it.id}${it.x},${it.y}`);
    mix(Object.keys(s.fire).join(",")); let d=0; for(const t of s.tiles) if(t.t==="door"&&t.open) d++; mix(d);
    return (h>>>0).toString(36); }
  function lootValue(p){ return p.inv.reduce((a,i)=>a+(i.value||0),0); }

  return {GEAR,STARTER,VALUABLES,MAPS,bind,hash,newGame,act,fov,canSee,hitChance,roomName,lootValue,tileAt,entAt,idx,los,walk,LIMBS,LNAME};
})();
// ============================== SIM END ==============================
