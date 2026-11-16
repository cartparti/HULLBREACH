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
      "~#.K.jj.j.O.#...3..1.2.4...#.C...qV..G#~",
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
      "~#By.....&B.#....s#........#.....#....#~",
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
  function bind(s){ ROOMS=s.rooms||(MAPS[s.map]||MAPS.ks9).rooms; }

  const LIMBS = ["head","torso","larm","rarm","lleg","rleg"];
  const LNAME = {head:"head",torso:"torso",larm:"left arm",rarm:"right arm",lleg:"left leg",rleg:"right leg"};
  const PLAYER_HP = {head:30,torso:60,larm:35,rarm:35,lleg:40,rleg:40};
  const HUSK_HP   = {head:14,torso:34,larm:18,rarm:18,lleg:22,rleg:22};
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

  // ---------- RNG (mulberry32, state lives in game state) ----------
  function rand(s){ s.rng=(s.rng+0x6D2B79F5)|0; let t=s.rng; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
  const ri=(s,a,b)=>a+Math.floor(rand(s)*(b-a+1));
  const chance=(s,p)=>rand(s)<p;

  // ---------- tile predicates ----------
  const PROPS={c:"crate",B:"bed",t:"desk",l:"locker",r:"barrel",f:"brazier",g:"generator",S:"tank",
    u:"couch",T:"table",n:"chair",q:"coffee",V:"vending",G:"arcade",w:"toilet",s:"sink",x:"shower",I:"bars",z:"captive",j:"gunrack",p:"plant",d:"captchair",y:"footlocker",U:"workbench"};
  const TERMS={N:"helm",M:"navtable",K:"rack",Q:"stash",J:"records",C:"board",A:"airlock",O:"workbench","&":"wardrobe"};
  const SEATS={"1":"pilot","2":"copilot","3":"nav","4":"eng"};
  const gas  = t => t.t==="floor"||t.t==="extract"||t.t==="breach"||t.t==="prop"||t.t==="terminal"||t.t==="seat"||(t.t==="door"&&t.open);
  const walk = t => t.t==="floor"||t.t==="extract"||t.t==="seat"||(t.t==="door"&&t.open);
  const clear= t => !(t.t==="wall"||t.t==="console"||(t.t==="door"&&!t.open));

  const STARTER={w1:{d:"pistol",r:0},w2:null,melee:{d:"knife",r:0},armor:{d:"suit",r:0},pack:{d:"sling",r:0},ammo:{pistol:24},inv:[{d:"bandage",r:0},{d:"bandage",r:0},{d:"frag",r:0}]};
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
      log:[],fx:[],fire:{},fuel:[],scorch:{},power:true,map:mapId,rooms:G?G.rooms:null,decals:G?G.decals:(mapId==="ks9"?[{type:"ritual",x:33,y:29}]:[]),mode:opts.mode||"raid",site:opts.site||"Relay KS-9",status:"playing",nextId:1,cause:null};
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
        case "N": case "M": case "K": case "Q": case "J": case "C": case "A": case "O": case "&": t={t:"terminal",kind:TERMS[c]};break;
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
    if(G){ for(const [x,y] of G.husks) addHusk(s,x,y); for(const l of G.loot) spawnItem(s,l.item,l.x,l.y);
      for(const [x,y] of G.fires){ const i=idx(s,x,y); s.fire[i]=2; s.fuel[i]=14; } }
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
    if(m.loot) for(const it of s.items) if(K(it)==="val") it.v=Math.round(Items.value(it)*m.loot);
  }
  function addPlayer(s,id,name,x,y,lo){
    lo=normLo(lo); const cp=v=>v&&Items.def(v.d)?{d:v.d,r:v.r|0,...(v.l?{l:v.l}:{}),...(v.v?{v:v.v}:{}),...(v.iss?{iss:1}:{})}:null;
    const armor=cp(lo.armor)||{d:"suit",r:0}, pack=cp(lo.pack)||{d:"sling",r:0}, A=ST(armor), cap=ST(pack).slots;
    const ammo={}; for(const t of AMMO_TYPES) ammo[t]=Math.max(0,(lo.ammo&&lo.ammo[t])|0);
    s.ents.push({id,kind:"player",name,x,y,hp:{...PLAYER_HP},max:{...PLAYER_HP},bleed:{},blood:100,o2:A.o2,o2max:A.o2,
      w1:cp(lo.w1),w2:cp(lo.w2),melee:cp(lo.melee),armor,pack,act:1,ammo,mats:{scrap:0,prop:0,circ:0},cap,look:lo.look||null,stimT:0,
      inv:(lo.inv||[]).slice(0,cap).map(it=>({...it,id:s.nextId++})),alive:true,acted:false,busy:0,face:[1,0],seen:new Array(s.W*s.H).fill(0),flags:{}});
  }
  function addHusk(s,x,y){
    s.ents.push({id:"h"+(s.nextId++),kind:"husk",name:"husk",x,y,hp:{...HUSK_HP},max:{...HUSK_HP},bleed:{},blood:60,
      alive:true,aware:false,last:null,limp:false,busy:0,face:[0,1]});
  }
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
  function crippled(e){ return !(e.stimT>0)&&(e.hp.lleg<=0||e.hp.rleg<=0); }
  function bleedDecal(s,x,y,n=1){ const k=idx(s,x,y); s.blood[k]=Math.min(6,(s.blood[k]||0)+n); }
  function noise(s,x,y,r){ for(const h of s.ents) if(h.kind==="husk"&&h.alive&&Math.hypot(h.x-x,h.y-y)<=r){ h.aware=true; h.last={x,y}; } }

  function damage(s,e,limb,dmg,bleedP,cause){
    if(!e.alive) return;
    const AR=e.armor?ST(e.armor):null; if(AR&&(limb==="head"||limb==="torso")&&AR.dr) dmg=Math.max(1,Math.round(dmg*(1-AR.dr)));
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
    else { if(chance(s,.35)) spawnItem(s,Items.roll(()=>rand(s),1,chance(s,.7)?"ammo":"mat"),e.x,e.y);
      if(anyPlayerSees(s,e.x,e.y)) say(s,`The husk collapses. ${cause==="vacuum"?"Its lungs gave out.":""}`.trim(),"good"); }
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
    // free actions: no turn spent
    if(a.type==="swap"){ const other=p.act===1?2:1; if(!(other===1?p.w1:p.w2)){ say(s,"You only have one gun.","info"); return false; } p.act=other; say(s,`You switch to the ${nm(gun(p))}.`,"info"); return true; }
    if(a.type==="equip") return doEquip(s,p,a.index);
    if(a.type==="drop") return doDrop(s,p,a.index);
    switch(a.type){
      case "move": { const r=doMove(s,p,a.dx,a.dy); ok=!!r; slow=r==="walked"&&crippled(p); break; }
      case "wait": ok=true; break;
      case "shoot": ok=doShoot(s,p,a.x,a.y); break;
      case "interact": ok=doInteract(s,p); break;
      case "pickup": ok=doPickup(s,p); break;
      case "use": ok=doUse(s,p,a.index); break;
      case "give": ok=doGive(s,p,a.index,a.to); break;
      case "throw": ok=doThrow(s,p,a.index,a.x,a.y); break;
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
  function melee(s,p,h){
    const st=ST(p.melee)||WRENCH, pen=(p.hp.rarm<=0?.3:0)+(p.hp.larm<=0?.1:0), wn=p.melee?nm(p.melee):"wrench";
    fx(s,{type:"melee",x:h.x,y:h.y});
    const strike=(t)=>{ if(chance(s,.82+(st.acc||0)-pen)){ const l=pickLimb(s), d=ri(s,st.dmg[0],st.dmg[1]); say(s,`You hit the husk's ${LNAME[l]} with your ${wn}.`,"info"); damage(s,t,l,d,st.bleed??.25,"beaten"); if(st.stun&&t.alive) t.stun=Math.max(t.stun|0,st.stun); return true; } say(s,`Your ${wn} swing misses.`,"info"); return false; };
    strike(h);
    if(st.cleave) for(const [dx,dy] of N4){ const o=entAt(s,p.x+dx,p.y+dy); if(o&&o!==h&&o.kind==="husk") strike(o); }
    h.aware=true; h.last={x:p.x,y:p.y};
    return true;
  }
  function hitChance(s,p,tx,ty){
    const st=ST(gun(p))||{acc:0,fall:.035}, d=Math.hypot(tx-p.x,ty-p.y);
    let c=.9+(st.acc||0)-(st.fall??.035)*d;
    if(st.close&&d<3) c-=st.close;
    c-= p.hp.rarm<=0?.35:(1-p.hp.rarm/p.max.rarm)*.15;
    c-= p.hp.larm<=0?.12:0;
    if(p.blood<50) c-=.15;
    if(!s.power&&d>3&&!st.dark) c-=.1;
    return Math.max(.05,Math.min(.95,c));
  }
  function doShoot(s,p,tx,ty){
    if(tx===p.x&&ty===p.y) return false;
    const w=gun(p); if(!w){ say(s,"No gun in hand. Bump into husks to use your melee weapon.","warn"); return false; }
    const st=ST(w);
    if(!canSee(s,p,tx,ty)){ say(s,"You can't see that spot.","info"); return false; }
    const t=tileAt(s,tx,ty), target=entAt(s,tx,ty), barrel=t.t==="prop"&&t.kind==="barrel";
    if(!target&&t.t!=="window"&&!barrel&&st.cls!=="launcher"){ say(s,"Nothing worth a bullet there.","info"); return false; }
    if((p.ammo[st.ammo]|0)<=0){ say(s,`*click* Out of ${Items.AMMO[st.ammo].name.toLowerCase()}.`,"warn"); return false; }
    face(p,tx-p.x,ty-p.y); noise(s,p.x,p.y,st.cls==="sniper"||st.cls==="launcher"?14:st.cls==="shotgun"?11:10);
    const shots=Math.min(st.burst||1,p.ammo[st.ammo]);
    for(let k=0;k<shots;k++){ p.ammo[st.ammo]--; fireOne(s,p,tx,ty,st,target); if(target&&!target.alive) break; }
    if(p.ammo[st.ammo]===0) say(s,`That was your last ${Items.AMMO[st.ammo].name.toLowerCase().replace(/s$/,"")}.`,"warn");
    return true;
  }
  function fireOne(s,p,tx,ty,st,target){
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
        for(let q=0;q<pel&&e.alive;q++){ if(isT?chance(s,hc):chance(s,.3)){ hits++; const l=st.head&&chance(s,st.head)?"head":pickLimb(s); damage(s,e,l,ri(s,st.dmg[0],st.dmg[1]),st.bleed??.55,"shot"); } }
        if(hits){ what="flesh"; fx(s,{type:"shot",x0:p.x,y0:p.y,x1:x,y1:y,what});
          say(s, e.kind==="player"?`Your round hits ${e.name}!`:pel>1?`${hits} of ${pel} pellets tear into the husk.`:"You hit the husk.", "good");
          if(e.kind==="husk"){ e.aware=true; e.last={x:p.x,y:p.y}; if(st.stun&&e.alive) e.stun=Math.max(e.stun|0,st.stun);
            if(st.knock&&e.alive){ const dx=Math.sign(e.x-p.x), dy=Math.sign(e.y-p.y), nx=e.x+(Math.abs(e.x-p.x)>=Math.abs(e.y-p.y)?dx:0), ny=e.y+(Math.abs(e.x-p.x)<Math.abs(e.y-p.y)?dy:0); if(walk(tileAt(s,nx,ny))&&!entAt(s,nx,ny)){ e.x=nx; e.y=ny; } } }
          if(st.pierce&&pierced++<1) continue; return; }
        if(isT) say(s,"Your shot misses the husk.","info");
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
      if(e){ if(o.dmg){ const hits=d<=1.2?2:1, fr=e.armor?ST(e.armor).fire*.5:0; for(let k=0;k<hits&&e.alive;k++) damage(s,e,pickLimb(s),Math.max(1,Math.round(ri(s,o.dmg[0],o.dmg[1])*(d<=1.2?1:.6)*(1-fr))),.4,"Caught in a blast."); }
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
    if(st.noise){ for(const h of s.ents) if(h.kind==="husk"&&h.alive&&Math.hypot(h.x-x,h.y-y)<=st.noise){ h.aware=true; h.last={x,y}; } fx(s,{type:"decoy",x,y}); say(s,"The noisemaker shrieks. Every husk in earshot turns toward it.","good"); return true; }
    if(st.stunr&&!st.blast){ let n=0; for(const h of s.ents) if(h.kind==="husk"&&h.alive&&Math.hypot(h.x-x,h.y-y)<=st.stunr){ h.stun=Math.max(h.stun|0,st.stun); n++; } fx(s,{type:"flare",x,y}); say(s,n?`A flash and a bang. ${n} husk${n>1?"s":""} reel, stunned.`:"A flash and a bang. Nothing caught in it.","good"); return true; }
    if(st.blast) { blast(s,x,y,{r:st.blast,dmg:st.dmg,fire:st.fire,stun:st.stun,pull:st.pull}); return true; }
    if(st.fire){ const R=Math.ceil(st.fire); for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){ const xx=x+dx, yy=y+dy; if(Math.hypot(dx,dy)>st.fire||!inb(s,xx,yy)) continue; const j=idx(s,xx,yy); if(gas(s.tiles[j])){ s.fire[j]=2; s.fuel[j]=Math.max(s.fuel[j],5); const e=entAt(s,xx,yy); if(e) damage(s,e,pickLimb(s),ri(s,st.dmg[0],st.dmg[1]),0,"Burned alive."); } }
      fx(s,{type:"flare",x,y}); say(s,"Fire splashes across the deck.","warn"); return true; }
    return true;
  }
  function doEquip(s,p,i){
    const it=p.inv[i], slot=it&&Items.slotOf(it); if(!slot){ return false; }
    let old=null;
    if(slot==="gun"){ if(!p.w1){ p.w1=it; p.act=1; } else if(!p.w2){ p.w2=it; p.act=2; } else if(p.act===2){ old=p.w2; p.w2=it; } else { old=p.w1; p.w1=it; } }
    else if(slot==="melee"){ old=p.melee; p.melee=it; }
    else if(slot==="armor"){ old=p.armor; p.armor=it; const A=ST(it); p.o2max=A.o2; p.o2=Math.min(p.o2,A.o2); }
    else if(slot==="pack"){ const cap=ST(it).slots; if(p.inv.length-1+(p.pack?1:0)>cap){ say(s,"Too much in your pack to swap to that one.","warn"); return false; } old=p.pack; p.pack=it; p.cap=cap; }
    p.inv.splice(i,1); if(old){ const o={...old,id:s.nextId++}; p.inv.splice(i,0,o); }
    say(s,`You equip the ${nm(it)}.`,"good"); return true;
  }
  function doDrop(s,p,i){ const it=p.inv[i]; if(!it) return false; p.inv.splice(i,1); spawnItem(s,{...it,id:undefined},p.x,p.y); say(s,`You drop the ${nm(it)}.`,"info"); return true; }
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
    const bleeding=LIMBS.filter(l=>p.bleed[l]);
    if(it.d==="bandage"){
      if(!bleeding.length){ say(s,"You're not bleeding.","info"); return false; }
      const l=bleeding.sort((a,b)=>(a==="torso"||a==="head"?-1:0)-(b==="torso"||b==="head"?-1:0))[0];
      delete p.bleed[l]; p.inv.splice(i,1); say(s,`You wrap your ${LNAME[l]} tight. The bleeding stops.`,"good"); return true;
    }
    if(it.d==="medkit"){
      p.bleed={}; for(const l of LIMBS) if(p.hp[l]>0) p.hp[l]=Math.min(p.max[l],p.hp[l]+18);
      p.blood=Math.min(100,p.blood+15); p.inv.splice(i,1); say(s,"You jab a coagulant and staple your wounds shut.","good"); return true;
    }
    if(it.d==="o2"){ p.o2=Math.min(p.o2max,p.o2+50); p.inv.splice(i,1); say(s,"You clip the canister into your suit. +50 O₂.","air"); return true; }
    if(it.d==="stim"){ p.blood=Math.min(100,p.blood+25); p.stimT=10; p.inv.splice(i,1); say(s,"The stim hits like a hammer. Pain is a rumour for ten turns.","good"); return true; }
    if(it.d==="keycard"){ say(s,"Captain's keycard. Opens the vault while station power is on.","info"); return false; }
    say(s,`${nm(it)}. Worth about ${Items.value(it)} cr to the right buyer.`,"info"); return false;
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
    for(const it of lost) say(s,`The ${nm(it)} tumbles out of the breach into space.`,"air");
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
        if(e){ const hits=d<=1.5?2:1, fr=e.armor?ST(e.armor).fire*.5:0; for(let k=0;k<hits;k++) damage(s,e,pickLimb(s),Math.round((d<=1.5?ri(s,12,20):ri(s,6,11))*(1-fr)),.5,"Caught in a fuel explosion.");
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
      if(h.stun>0){ h.stun--; continue; }
      if(s.fire[idx(s,h.x,h.y)]){ const opts=N4.map(([dx,dy])=>[h.x+dx,h.y+dy]).filter(([x,y])=>walk(tileAt(s,x,y))&&!entAt(s,x,y)&&!s.fire[idx(s,x,y)]);
        if(opts.length){ const [x,y]=opts[ri(s,0,opts.length-1)]; face(h,x-h.x,y-h.y); h.x=x; h.y=y; continue; } }
      let best=null,bd=1e9;
      for(const p of players(s)){ if(!p.alive) continue; const d=Math.abs(p.x-h.x)+Math.abs(p.y-h.y); if(d<bd){bd=d;best=p;} }
      if(!best) return;
      const R=(s.power?8:5)-((best.armor&&ST(best.armor).stealth)||0);
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
      if(!e.alive) continue; CTX=e.kind==="player"?e.id:null; if(e.stimT>0) e.stimT--;
      const bl=LIMBS.filter(l=>e.bleed[l]);
      if(bl.length){ e.blood-=2*bl.length; if(chance(s,.6)) bleedDecal(s,e.x,e.y,1);
        for(const l of bl) if(chance(s,e.kind==="player"?.04:.06)) delete e.bleed[l];
        if(e.blood<=0){ kill(s,e,e.kind==="player"?"Bled out on the deck plating.":"bled"); continue; }
        if(e.kind==="player"&&e.blood<40&&chance(s,.25)) say(s,"Your vision tunnels. You've lost a lot of blood.","bad");
      }
      if(s.fire[idx(s,e.x,e.y)]){ const lv=s.fire[idx(s,e.x,e.y)], l=chance(s,.6)?(chance(s,.5)?"lleg":"rleg"):pickLimb(s);
        if(e.kind==="player") say(s,"You're burning!","bad"); else if(anyPlayerSees(s,e.x,e.y)) say(s,"The husk shrieks as it burns.","good");
        const fr=e.armor?ST(e.armor).fire:0;
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
    for(const e of s.ents) mix(`${e.id}${e.x},${e.y}${e.alive?1:0}${LIMBS.map(l=>e.hp[l]).join("")}${e.blood}${e.ammo?JSON.stringify(e.ammo):""}${e.stun|0}${e.acted?1:0}${e.downed?"d"+e.downT:""}${(e.inv||[]).length}`);
    for(const it of s.items) mix(`${it.id}${it.x},${it.y}`);
    mix(Object.keys(s.fire).join(",")); let d=0; for(const t of s.tiles) if(t.t==="door"&&t.open) d++; mix(d);
    return (h>>>0).toString(36); }
  function lootValue(p){ return p.inv.reduce((a,i)=>a+Items.value(i),0); }

  return {STARTER,VALUABLES,MAPS,bind,hash,normLo,gun,newGame,act,fov,canSee,hitChance,roomName,lootValue,tileAt,entAt,idx,los,walk,LIMBS,LNAME};
})();
// ============================== SIM END ==============================
