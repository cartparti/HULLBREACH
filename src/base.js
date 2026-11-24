// ============================ SHIP BASE =============================
// Personal save (credits, stash, ammo, materials, looks, stats, kit) + the
// crew ship (World ship state). Signed-in players save to db at
// data/users/<id>/save.
const SAVE_V=2, KIT_SLOTS=["w1","w2","melee","head","armor","legs","acc","light","pack"], SLOT_NAME={w1:"Primary",w2:"Secondary",melee:"Melee",head:"Helmet",armor:"Chest",legs:"Legs",acc:"Accessory",light:"Light",pack:"Pack"};
const ISSUED={}; // nothing is issued: you start in your clothes and find or craft the rest
const EMPTY_TXT={w1:"No gun",w2:"A second gun. Swap with R or the swap button.",melee:"Bare hands and a wrench",head:`Bare head · ${Items.CLOTHES_O2} O₂ rebreather`,armor:"Just your shirt",legs:"Just your trousers",acc:"Nothing. Find scarves, capes, charms, lamps and stranger things",light:"No light. Derelicts are very dark",pack:`No pack · ${Items.POCKETS} slots from pockets and belt`};
let mapRegion=null;
let profile=null, panelKind=null, panelSub=null, mapSel=null, stashFilter="all", stashSel=null, armed={}, invSel=null;
const itemInfo=World.itemInfo, mk=World.mkItem, AMMO_T=Object.keys(Items.AMMO), MAT_T=Object.keys(Items.MATS);
function newProfile(){ return {v:SAVE_V,updated:0,credits:500,
  stash:[mk({d:"flashlight"}),mk({d:"bandage"}),mk({d:"bandage"}),mk({d:"o2"}),mk({d:"ration"}),mk({d:"waterflask"})],
  ammo:{pistol:12},mats:{scrap:10,prop:3,circ:3,org:4,parts:0,core:0},food:80,water:80,gotLight:1,look:{c:"red",v:"amber",k:"plume",s:1,h:2,hc:1,f:0,e:0,t:0,tc:0,b:0,bc:4,bt:4,bs:1,g:0,fh:0,fm:0,ey:0,br:0,mo:0,no:0},unlocks:{cloak:[],visor:[],crest:[]},rep:{},xp:0,perks:{},injury:{frac:{},inf:0},life:{},codex:{},medals:{},title:null,mastery:{},daily:null,morale:0,catGift:0,implants:{},nemesis:null,arcade:{best:0,day:0},wanted:null,seenPro:0,coffee:0,mail:"",records:{},
  stats:{raids:0,extracts:0,deaths:0,earned:0,best:0,contracts:0},kit:{type:"starter",w1:null,w2:null,melee:null,armor:null,pack:null,inv:[],ammo:{}},
  squad:"solo",last:null,active:null,ship:World.newShip(),welcomed:false}; }
// v1 saves: gear ids and a shared round count become real items and pistol ammo
function migrate(p){ const d=newProfile();
  const conv=q=>{ if(q.d) return q; if(q.kind==="gear"&&Items.def(q.gear)) return {d:q.gear,r:0}; if(Items.def(q.kind)) return {d:q.kind,r:q.kind==="medkit"?1:0};
    if(q.kind==="valuable"||q.kind==="val"){ const i=Math.max(0,Items.VALS.findIndex(v=>v[0]===q.name)); return {d:"val"+i,r:0,v:q.value||Items.VALS[i][1]}; } return null; };
  d.credits=p.credits|0; d.stats={...d.stats,...(p.stats||{})}; d.ship=p.ship||d.ship; d.welcomed=!!p.welcomed;
  d.stash=(p.stash||[]).map(conv).filter(Boolean).map(mk); d.ammo={pistol:(p.rounds|0)}; return d; }
function fixProfile(p){ const d=newProfile(); d.ship.opKey=todayKey(); if(!p) return d; if(p.v===1) p=migrate(p); if(p.v!==SAVE_V) return d;
  p.stats={...d.stats,...(p.stats||{})}; p.kit={...d.kit,...(p.kit||{})}; if(!Array.isArray(p.kit.inv)) p.kit.inv=[]; p.kit.ammo=p.kit.ammo||{};
  p.stash=Array.isArray(p.stash)?p.stash.filter(q=>q&&Items.def(q.d)):[]; for(const q of p.stash) if(!q.uid) Object.assign(q,mk(q));
  p.ammo=p.ammo||{}; p.mats=p.mats||{}; if(p.food==null) p.food=80; if(p.water==null) p.water=80; if(!p.gotLight){ p.gotLight=1; p.stash.push(mk({d:"flashlight"})); } p.look={...d.look,...(p.look||{})}; if(p.look.fh==null){ const old=+p.look.f|0; p.look.fh=[0,1,3,5,0,0][old]||0; p.look.fm=[0,0,0,0,1,2][old]||0; } p.unlocks={cloak:[],visor:[],crest:[],...(p.unlocks||{})};
  p.life=p.life&&typeof p.life==="object"?p.life:{}; p.codex=p.codex&&typeof p.codex==="object"?p.codex:{}; p.medals=p.medals&&typeof p.medals==="object"?p.medals:{}; p.mastery=p.mastery&&typeof p.mastery==="object"?p.mastery:{}; p.records=p.records&&typeof p.records==="object"?p.records:{}; p.implants=p.implants&&typeof p.implants==="object"?p.implants:{}; p.arcade=p.arcade&&typeof p.arcade==="object"?p.arcade:{best:0,day:0};
  p.rep=p.rep&&typeof p.rep==="object"?p.rep:{}; p.xp=p.xp|0; p.perks=p.perks&&typeof p.perks==="object"?p.perks:{}; p.injury=p.injury||{frac:{},inf:0}; if(p.hire&&!(p.hire.fac in Sim.FACTIONS)) p.hire=null;
  const hadHull=p.ship&&p.ship.hull!=null; p.ship=p.ship&&World.loc(p.ship.loc)?{...World.newShip(),...p.ship}:World.newShip(); if(!hadHull&&p.ship&&(p.stats&&p.stats.raids>0)) p.ship.hull=4; p.ship.hull=Math.max(1,Math.min(4,p.ship.hull|0||1)); p.ship.opKey=todayKey(); return p; }
function checkMail(){ const k=todayKey(); if(!profile||profile.mail===k) return; profile.mail=k; const pool=[["bandage","medkit","ration"],["ammo_pistol","ammo_rifle","ammo_shell"],["apkit","hpkit","tripmine"],["o2","stim","waterflask"]], got=[];
  for(const P of pool){ const d=P[Math.floor(Math.random()*P.length)]; if(!Items.def(d)) continue; const D=Items.def(d), it=mk({d}); if(D.k==="ammo"){ const t=D.ammo; profile.ammo[t]=(profile.ammo[t]|0)+Items.AMMO[t].stack; got.push(Items.AMMO[t].name); } else { World.grant(profile,it); got.push(Items.name(it)); } }
  profile.credits+=50; save(); setTimeout(()=>toast(`Concord mail: a daily care package is in your stash. ${got.join(", ")} and 50 cr.`),1200); }
function todayKey(){ return new Date().toISOString().slice(0,10).replace(/-/g,""); }
// weapon mastery: kills with each class of weapon earn levels that make you better with it
const MAST_T=[0,10,30,70,150,300], MAST_N=["Untrained","Trained","Seasoned","Veteran","Expert","Master"], MAST_C=[["pistol","Pistols"],["smg","SMGs"],["rifle","Rifles"],["shotgun","Shotguns"],["sniper","Sniper rifles"],["launcher","Launchers"],["melee","Melee"],["explosive","Explosives"]];
const mastLvl=n=>{ let l=0; for(let i=0;i<MAST_T.length;i++) if((n|0)>=MAST_T[i]) l=i; return l; };
function mastLevels(){ const o={}; for(const [c] of MAST_C){ const l=mastLvl(profile.mastery[c]); if(l) o[c]=l; } return o; }
function mastBonus(c,l){ if(!l) return "No bonus yet."; if(c==="melee") return `+${l} damage on every strike.`; if(c==="explosive") return "Bragging rights. (Explosives don't aim.)"; return `+${(l*2.5).toFixed(1)}% to hit${l>=5?", +15% damage":""}.`; }
// Rivet the ship's cat: a scratch behind the ears once a day lifts the crew (+10% XP next raid), and sometimes it brings you a present
function onPet(){ const d=ship().day|0; const first=profile.morale!==d; profile.morale=d; let msg=first?"Rivet purrs like a failing reactor. You feel better about the next run. (+10% XP on your next raid)":["Rivet headbutts your hand and demands more.","Rivet rolls over. It's a trap. You fall for it anyway.","Rivet blinks slowly at you. That's love, apparently.","Rivet chirps and winds between your boots."][Math.floor(Math.random()*4)];
  if(first&&profile.catGift!==d&&Math.random()<.35){ profile.catGift=d; const it=Items.roll(Math.random,1,["mat","val","food","ammo"][Math.floor(Math.random()*4)]); World.grant(profile,it); msg+=` Rivet drops a ${Items.name(it).toLowerCase()} at your feet, very pleased with itself. (Put in your stash.)`; }
  save(); if(typeof toast==="function") toast(msg); }
const ship=()=>(typeof Net!=="undefined"&&Net.sq&&!Net.host&&Net.ship)?Net.ship:profile.ship, here=()=>World.loc(ship().loc);
function shipScene(){ return here().scene; }

// ---------- persistence ----------
const Store={ref:null,mode:"local",writing:false,pending:null,
  async init(){
    try{ if(!window.claude?.use) return;
      const [db,user]=await Promise.all([window.claude.use("db"),window.claude.use("user")]);
      if(!db||!user) return; const id=await user.id(); if(!id) return;
      this.ref=db.collection("data/users/"+id).doc("save");
      const snap=await Promise.race([this.ref.get(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),10000))]);
      this.mode="cloud";
      if(snap.exists){ const cloud=fixProfile(JSON.parse(JSON.stringify(snap.data())));
        if((cloud.updated||0)>(profile.updated||0)&&!(S&&S.mode==="raid")){ profile=cloud; saveLocal(); if(S&&S.mode==="ship") boardShip(); } else this.write(profile); }
      else this.write(profile);
    }catch(e){ this.ref=null; this.mode="local"; }
    renderSync();
  },
  write(data){ if(!this.ref) return; this.pending=JSON.parse(JSON.stringify(data)); if(this.writing) return; this.flush(); },
  async flush(){ this.writing=true; while(this.pending){ const d=this.pending; this.pending=null; try{ await this.ref.set(d); }catch(e){} } this.writing=false; },
};
function saveLocal(){ try{ localStorage.setItem("hb-save",JSON.stringify(profile)); }catch(e){} }
function loadLocal(){ try{ const s=localStorage.getItem("hb-save"); return s?JSON.parse(s):null; }catch(e){ return null; } }
function save(){ profile.updated=Date.now(); saveLocal(); Store.write(profile); renderSync(); }
function renderSync(){ const el=$("h-sync"); if(el) el.textContent=Store.mode==="cloud"?"Saved to your account":"Saved on this device"; }

// ---------- item + kit helpers ----------
const byUid=u=>u?profile.stash.find(q=>q.uid===u)||null:null;
const strip=it=>{ if(!it) return null; const o={d:it.d,r:it.r|0}; if(it.l) o.l=it.l; if(it.v) o.v=it.v; if(it.n) o.n=it.n; if(it.m) o.m=it.m; if(it.iss) o.iss=1; return o; };
const rc=it=>Items.RAR[Items.rarOf(it)].col;
const nmHTML=it=>`<b style="color:${rc(it)}">${esc(Items.name(it))}</b>`;
const capOf=(pack,r)=>Items.POCKETS+(pack?Items.stats(pack).slots:0)+(r?["head","armor","legs","acc"].reduce((a,k)=>a+((r[k]&&Items.stats(r[k]).slots)||0),0):0);
function slotFits(slot,it){ const s=Items.slotOf(it); return slot==="w1"||slot==="w2"?s==="gun":s===slot; }
function kitResolved(){ const k=profile.kit;
  if(k.type==="starter"){ const st=Sim.STARTER, iss=x=>x&&{...x,iss:1};
    const r={free:true,inv:st.inv.map(x=>({...x})),ammo:{...st.ammo},cap:capOf(st.pack,st),used:st.inv.length}; for(const k of KIT_SLOTS) r[k]=iss(st[k])||null; return r; }
  const used=new Set(), r={free:false};
  for(const s of KIT_SLOTS){ const it=byUid(k[s]); if(it&&!used.has(it.uid)&&slotFits(s,it)){ r[s]=it; used.add(it.uid); } else r[s]=ISSUED[s]?{...ISSUED[s]}:null; }
  r.cap=capOf(r.pack,r); r.inv=[];
  for(const u of k.inv){ const it=byUid(u); if(it&&!used.has(u)&&r.inv.length<r.cap){ r.inv.push(it); used.add(u); } }
  r.used=r.inv.length; r.ammo={}; for(const t of AMMO_T){ const n=Math.max(0,Math.min(k.ammo[t]|0,profile.ammo[t]|0)); if(n) r.ammo[t]=n; }
  return r;
}
function kitRisk(r){ if(r.free) return 0; let v=0; for(const s of KIT_SLOTS) if(r[s]&&!r[s].iss) v+=Math.round(Items.value(r[s])*.5); for(const it of r.inv) v+=Math.round(Items.value(it)*.5); for(const t in r.ammo) v+=r.ammo[t]; return v; }
function lookOfKit(r){ r=r||kitResolved(); const g=r.w1||r.w2, d=k=>r[k]?r[k].d:null; return {...profile.look,hd:d("head"),a:d("armor"),lg:d("legs"),ac:d("acc"),li:r.light?1:0,pk:d("pack"),w:g?g.d:null}; }
function slotHTML(it,title,n){ if(!it) return `<div class="slot" title="${title||"Empty"}"></div>`;
  return `<div class="slot" title="${esc(title||Items.name(it))}" style="border-color:${rc(it)}"><img alt="${esc(Items.name(it))}" src="${iconFor(it)}">${n>1?`<span class="n">×${n}</span>`:""}</div>`; }
function toast(msg){ if(typeof Snd!=="undefined") Snd.play("toast"); const t=$("h-toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,3000); }
function ammoChips(am,hl){ const ks=AMMO_T.filter(t=>am[t]); return ks.length?`<div class="ammo-row">${ks.map(t=>`<span style="border-color:${t===hl?"var(--bile)":Items.AMMO[t].col}">${Items.AMMO[t].short} ${am[t]}</span>`).join("")}</div>`:`<span class="risk">No ammo</span>`; }
function matChips(m){ return `<div class="ammo-row">${MAT_T.map(t=>`<span>${Items.MATS[t]} ${m[t]|0}</span>`).join("")}</div>`; }
function kitSummaryHTML(r){
  let s=`<div class="kit-row">${KIT_SLOTS.map(k=>slotHTML(r[k],SLOT_NAME[k]+": "+(r[k]?Items.name(r[k]):"empty"))).join("")}`;
  for(const it of r.inv) s+=slotHTML(it);
  return s+`</div>${ammoChips(r.ammo)}`;
}
function portrait(look){ const c=cvs(24,24), g=c.getContext("2d"); R(g,0,0,24,24,"#0b1110");
  const o=outlined(24,24,q=>{ R(q,4,10,16,14,look.hood); R(q,6,4,12,10,look.hood); R(q,7,3,10,2,look.hood); R(q,8,7,8,9,look.skin); R(q,8,7,8,1,shade(look.skin,.7));
    R(q,9,10,2,1,look.eye); R(q,13,10,2,1,look.eye); R(q,11,12,2,2,shade(look.skin,.8)); R(q,10,15,4,1,shade(look.skin,.55)); R(q,6,16,12,8,shade(look.hood,.8)); R(q,11,17,2,7,"#a37a32"); });
  g.drawImage(o,0,0); return c.toDataURL(); }

// ---------- life aboard ----------
const FLAVOR={
  coffee:[["The machine coughs out something black and scalding. Good enough.","Burnt again. You drink it anyway."],"grabs a coffee"],
  vending:[["You thump the vending machine. A ration bar drops. Flavour: grey.","It eats your coin and gives you nothing. Classic."],"thumps the vending machine"],
  arcade:[["One round of VOID RUNNER. High score: still Hesk.","You die on level two. The cabinet laughs at you in eight-bit."],"is playing VOID RUNNER"],
  couch:[["You sink into the couch. Something in the cushions crunches.","Five minutes off your feet. The springs disagree."],"flops onto the couch"],
  table:[["Someone carved a tally of jobs into the tabletop. You add a notch.","A half-finished card game. Somebody was cheating."],"sits at the mess table"],
  chair:[["You pull up a chair.","The chair wobbles. It always has."],"takes a seat"],
  toilet:[["You flush. The whole deck gurgles for a worrying amount of time.","Occupied. By you. Briefly."],"flushes the toilet"],
  sink:[["You splash water on your face. The contractor in the mirror looks tired.","The mirror has a crack right where your face goes."],"checks the mirror"],
  shower:[["Lukewarm, then cold, then briefly brown. Refreshing.","You stand under the water until the recycler complains."],"takes a shower"],
  bars:[["Gerald lunges at the bars and gnaws on them. He seems happy to see you.","You rattle the bars. Gerald rattles back."],"is taunting Gerald"],
  captive:[["Gerald gnaws the bars.","Gerald hisses."],"is taunting Gerald"],
  bed:[["You lie down. Ten minutes, tops.","Your bunk still smells like the last contractor."],"takes a nap"],
  footlocker:[["Your footlocker. Socks, a photo, a spare knife.","You check your footlocker. Still just socks."],"rummages in a footlocker"],
  captchair:[["The captain's chair. Somebody has to sit in it.","You lean back. The stars look smaller from here."],"sits in the captain's chair"],
  gunrack:[["Racked rifles, oiled and ready.","You check the rack. Everything's where it should be."],"checks the weapon rack"],
  workbench:[["Half a pistol, a soldering iron and a sandwich.","You tighten a bolt that didn't need tightening."],"tinkers at the workbench"],
  plant:[["A hardy little plant. Nobody admits to watering it.","You water the plant. It seems unimpressed."],"waters the plant"],
  crate:[["Ship's cargo. Mostly ration bars.","A crate stencilled FRAGILE, kicked in at one corner."],null],
  generator:[["The backup generator hums along.","You give the generator a pat. It hums louder."],null],
  desk:[["Ship's console. Diagnostics all green, mostly.","A console scrolling engine readouts."],null],
  locker:[["A dented locker. Someone's spare boots and a prayer card.","The locker door sticks, then bangs open. Empty."],null],
  tank:[["Something floats in the tank. It is probably not watching you.","The tank burbles. You step back."],null],
  barrel:[["Fuel drum. Do not shoot.","It sloshes."],null],
  cogitator:[["The cogitator bank chatters out a litany of fault codes.","You bless the machine and hit it twice. The screens settle."],"consults the cogitator"],
  medcab:[["Gauze, sealant, a bottle with the label scratched off.","The cabinet's half empty. Somebody's been self-medicating."],"checks the medical cabinet"],
  surgery:[["The surgical table is still sticky. You don't ask.","Restraint straps. Lots of them."],null],
  pipes:[["The manifold hisses. You tighten a valve and it hisses somewhere else.","Too hot to touch. You touch it anyway."],"bleeds a valve"],
  pallet:[["Strapped-down cargo. Most of it is ration bars.","The manifest says 'machine parts'. It rattles like bones."],null],
  stasis:[["Something sleeps in the pod. Its readouts are mostly green.","Frost on the glass. A hand print on the inside."],null],
  altar:[["Wax, bone and a prayer half scratched out.","The candles never seem to burn down."],"lights a candle at the altar"],
  pew:[["You sit a moment. It's very quiet.","Someone carved a name into the pew. Then crossed it out."],"sits in a pew"],
  o2rack:[["Spare oxygen. You check the gauges. Most are full.","One cylinder is stencilled DO NOT USE. You don't."],null],
  pump:[["The coolant pump thuds like a heartbeat.","You kick the pump. It thuds faster."],null],
  ammocrate:[["Brass, neatly packed. Military issue, long expired.","You count the rounds. You lose count."],null],
  shelf:[["Data slates and paper scrolls, all in a script you half know.","A ledger of crew who never came home. It's long."],null],
  cot:[["A fold-out cot. Better than the floor.","Someone's still sleeping in it. No, it's a coat."],null],
  drive:[["The drive housing hums through your boots. Warm.","Blue light leaks from the vents. The engineers swear it's normal."],"checks the drive housings"],
  reactor:[["The reactor core pulses. Your teeth ache a little.","Readouts nominal. Mostly. You decide not to read the rest."],"checks the reactor"],
  loader:[["A power loader, parked and chained. Its seat is worn smooth.","You pull a lever. A claw twitches. You put the lever back."],null],
  brazier:[["You warm your hands at the brazier.","The coals spit sparks."],null],
  counter:[["You lean on the bar. It's sticky. It's always sticky.","Somebody carved 'HESK OWES ME' into the counter."],"leans on the bar"],
  fridge:[["The fridge hums. Inside: rations, a jar of something, and a note that says DON'T.","You take a cold flask out, think better of it, put it back."],"raids the galley fridge"],
};
let flavorCD=0;
function onFlavor(kind){ if(kind==="bed"){ const I=profile.injury||{frac:{},inf:0}; if(Object.keys(I.frac||{}).length||I.inf){ openPanel("rest"); return; } } let buffed=false; if(kind==="coffee"){ const d=ship().day|0; if(profile.coffee!==d){ profile.coffee=d; save(); buffed=true; } } if(kind==="arcade"&&!(typeof inSquad==="function"&&inSquad()&&false)){ openPanel("arcade"); return; }
  const F=FLAVOR[kind]; if(!F) return; const lines=F[0]; toast(buffed?"Black, scalding, perfect. Caffeinated: +3% to hit for the first 80 turns of your next raid.":lines[(Math.random()*lines.length)|0]);
  if(typeof inSquad==="function"&&inSquad()&&Number.isFinite(arguments[1])) emit({t:"fx",kind,x:arguments[1],y:arguments[2]});
  if(F[1]&&typeof inSquad==="function"&&inSquad()&&Date.now()-flavorCD>3000){ flavorCD=Date.now(); emit({t:"chat",m:F[1]}); }
}

// ---------- ship HUD ----------
function adjacentTerminal(){ const p=me(); for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]]){ const t=Sim.tileAt(S,p.x+dx,p.y+dy); if(t.t==="terminal") return t.kind; } return null; }
function adjacentFixture(){ const p=me(); for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]]){ const t=Sim.tileAt(S,p.x+dx,p.y+dy); if(t.t==="prop"&&FLAVOR[t.kind]) return t.kind; } return null; }
const TERM_HINT={bar:"Galley bar · eat and drink",workbench:"Fabricator · craft gear, upgrade the ship",wardrobe:"Wardrobe · change your look",navtable:"Star map · choose where to fly",helm:"Pilot console · choose where to fly",rack:"Loadout rack · choose your kit",stash:"Stash locker · your gear",records:"Crew log · service history",board:"Job board · the crew's contracts",airlock:"Airlock · dock or board"};
function renderShipHud(){
  const L=here(), sh=ship(), sec=World.SECTORS.find(s=>s.id===L.sector), docked=L.type!=="derelict", cs=sh.contracts.length;
  $("s-ship").textContent=`${sh.name} · ${HULLS[hullLvl()].name}`;
  if(warp){ $("s-loc").innerHTML=`<b>In transit</b><span>Jumping to ${L.name}</span>`; $("s-prompt").innerHTML=""; return; }
  $("s-loc").innerHTML=`<b>${L.name}</b><span>${sec.name} · ${docked?`<span class="dock">Docked</span>`:`<span class="warn">Holding beside a derelict</span>`}</span><span>${cs?`${cs} active contract${cs>1?"s":""}`:"No active contracts"}${World.siteContract(sh,L.id)?" · <span class=\"dock\">contract target</span>":""}</span>`;
  $("s-res").innerHTML=`<span>Credits</span><span style="color:var(--brass)">${profile.credits}</span><span>Fuel</span><span style="color:${sh.fuel<2?"var(--blood2)":"inherit"}">${sh.fuel}/${sh.fuelMax}</span><span>Day</span><span>${sh.day}</span><span>Food</span><span style="color:${profile.food<25?"var(--blood2)":"inherit"}">${Math.round(profile.food)}</span><span>Water</span><span style="color:${profile.water<25?"var(--blood2)":"inherit"}">${Math.round(profile.water)}</span><span>Crew</span><span>${inSquad()?Net.roster.length:1}/4${inSquad()?" · "+Net.code.toUpperCase():""}</span>`;
  $("s-mode").textContent=mode==="pc"?"Touch mode":"Mouse & keys";
  const seat=Sim.tileAt(S,me().x,me().y).t==="seat", k=seat?"navtable":adjacentTerminal(), fx2=k?null:adjacentFixture(), hint=S.ents.some(e=>e.kind==="pet"&&Math.max(Math.abs(e.x-me().x),Math.abs(e.y-me().y))<=1)?"Rivet · the ship's cat · give a scratch":k?TERM_HINT[k]:fx2?PROP_NAME[fx2]:"";
  $("s-prompt").innerHTML=hint&&!warp?(mode==="pc"?`<span class="key">F</span>${hint}`:`Tap USE · ${hint}`):"";
}

// ---------- panels ----------
const PANELS={
  helm:{eye:"Bridge · star map",title:()=>"Choose a destination",view:viewHelm},
  rack:{eye:"Armory",title:()=>"Loadout rack",view:viewLoadout},
  stash:{eye:"Ship hold",title:()=>"Stash locker",view:viewStash},
  workbench:{eye:"Fabrication bay",title:()=>`Fabricator · ${Items.FAB_NAME[fabLvl()]}`,view:viewWorkbench},
  bar:{eye:"Galley",title:()=>"The galley bar",view:viewBar},
  wardrobe:{eye:"Crew quarters",title:()=>"Wardrobe",view:viewWardrobe},
  inventory:{eye:()=>S&&S.mode==="raid"?"In the field":"Aboard",title:()=>"Inventory",view:viewInventory},
  records:{eye:"Crew quarters",title:()=>"Logbook",view:viewLogbook},
  skills:{eye:"Contractor",title:()=>`Skills · level ${levelOf(profile.xp)}`,view:viewSkills},
  board:{eye:"Break room",title:()=>"Job board",view:viewBoard},
  crew:{eye:"Crew",title:()=>inSquad()?`Squad ${Net.code.toUpperCase()}`:"Crew",view:viewCrew},
  airlock:{eye:"Airlock",title:()=>here().type==="derelict"?`Board ${here().name}`:here().name,view:viewAirlock},
  body:{eye:()=>{ const b=lootBody(); return b?(b.kind==="remains"?"Recovery":Sim.FACTIONS[b.fac].name):"Search"; },title:()=>{ const b=lootBody(); return b?(b.kind==="remains"?"Your old body":b.alive?`${b.name} · hands up`:`${b.name}'s body`):"Gone"; },view:viewBody},
  comms:{eye:"Bridge · hologram comms",title:()=>commsFac?`Channel open · ${Sim.FACTIONS[commsFac].name}`:"Hail a faction",view:viewComms},
  hack:{eye:"Security terminal",title:()=>"Station network",view:viewHack},
  encounter:{eye:"In transit",title:()=>ENC&&ENC.title||"Contact",view:viewEncounter},
  rest:{eye:"Crew quarters",title:()=>"Rest",view:viewRest},
  bones:{eye:"Galley",title:()=>"Bones",view:viewBones},
  juke:{eye:"Galley",title:()=>"Jukebox",view:viewJuke},
  arcade:{eye:"Break room",title:()=>"VOID RUNNER",view:viewArcade},
  debrief:{eye:"Debrief",title:()=>profile.last&&profile.last.win?"Back aboard":"Raid lost",view:viewDebrief},
};
// ---------- searching a dead (or surrendered) raider ----------
function lootBody(){ return S&&S.mode==="raid"?S.ents.find(e=>e.id===panelSub&&(e.kind==="raider"||e.kind==="remains")&&!e.extracted&&(!e.alive||e.surr)):null; }
function viewBody(){ const b=lootBody(), p=me(); if(!b) return `<p class="risk">There's nothing here any more.</p>`;
  const near=Math.max(Math.abs(b.x-p.x),Math.abs(b.y-p.y))<=1, SL=[["w1","Primary"],["w2","Sidearm"],["melee","Melee"],["head","Helmet"],["armor","Chest"],["legs","Legs"],["acc","Trinket"],["light","Light"],["pack","Pack"]];
  const row=(it,lbl,act)=>`<div class="eq-row"><span class="lbl">${lbl}</span>${slotHTML(it)}<div class="nm">${nmHTML(it)}<span>${esc(Items.statLine(it))}</span></div><button class="plain" data-act="${act}" ${near?"":"disabled"}>Take</button></div>`;
  const eq=SL.filter(([k])=>b[k]).map(([k,l])=>row(b[k],l,`loot:eq:${k}`)).join(""), inv=b.inv.map((it,i)=>row(it,"Pack",`loot:inv:${i}`)).join("");
  const am=Object.keys(b.ammo||{}).filter(t=>b.ammo[t]>0).map(t=>`${b.ammo[t]} ${Items.AMMO[t].name.toLowerCase()}`).concat(Object.keys(b.mats||{}).filter(m=>b.mats[m]>0).map(m=>`${b.mats[m]} ${(Items.MATS[m]||m).toLowerCase()}`));
  const F=b.kind==="remains"?{name:"Your remains"}:Sim.FACTIONS[b.fac], bind=b.alive&&!b.prisoner?`<button class="plain" data-act="loot:bind:0" ${near&&p.brig?"":"disabled"} title="${p.brig?"":"Needs a brig on your ship"}">Take prisoner</button>`:b.prisoner?`<span class="risk good">Bound</span>`:"";
  return `<section class="panel h-card"><div class="bar-row"><div class="grow"><div class="h-eyebrow">${esc(F.name)}${b.alive?" · surrendered":""}</div><p class="risk">${b.alive?`${esc(b.name)} watches you with their hands up. Take what you want. Their crew won't like it.`:(b.kind==="remains"?"What you were carrying when you died.":`What ${esc(b.name)} was carrying.`)} Your pack: ${p.inv.length}/${p.cap}.${near?"":" Step next to them to take anything."}</p></div>
    ${bind}<button class="plain" data-act="lootall" ${near?"":"disabled"}>Take everything</button></div>
    <div class="h-eyebrow">Worn and carried</div>${eq||`<p class="risk">Stripped bare.</p>`}
    <div class="h-eyebrow">Pack</div>${inv||`<p class="risk">Empty.</p>`}
    <div class="h-eyebrow">Ammo and materials</div>${am.length?`<div class="bar-row"><p class="grow" style="margin:0">${esc(am.join(", "))}</p><button class="plain" data-act="loot:ammo:0" ${near?"":"disabled"}>Take</button></div>`:`<p class="risk">None.</p>`}</section>`; }
// ============ hologram comms: call a faction, see who answers, deal with them ============
let commsFac=null, commsT0=0, commsMsg="", holoRAF=0;
const STANDING=[[-50,"Hostile","#e0482f"],[-15,"Unfriendly","#c07a2a"],[15,"Neutral","#b9bfb6"],[50,"Friendly","#7cc46a"],[101,"Allied","#5ad0d0"]];
const standOf=f=>{ const v=(profile.rep||{})[f]|0; return [v,...STANDING.find(s=>v<s[0]).slice(1)]; };
const GREET={
  reaver:["You've got some nerve calling us, meat.","Talk fast. We're busy carving up a hauler.","Ha! Our favourite scav. What d'you need?"],
  blacksun:["This channel costs more than you've got. Goodbye.","Black Sun. Whatever you need, it has a price.","Ah, a friend of the Syndicate. Let's do business."],
  saint:["The rust will take you, heretic. Soon.","Speak, pilgrim. The Rust is listening.","Blessed salvager. The Rust smiles on you."],
  guild:["Your licence is revoked. Don't call again.","Guild dispatch. Make it quick, the cutters are running.","Hey, good to hear from you. Need kit?"],
  vanta:["The Combine has frozen your account.","Vanta Combine, trade desk. How may we profit together?","A valued client! Prices just for you today."],
  hollow:["We don't take contracts from targets.","Hollow Company. You want someone dead, or someone kept alive?","Always good to work with a professional."],
  marshal:["You're wanted, contractor. Turn yourself in.","Concord Marshals, sector desk. Go ahead.","Good work out there. The bounties are waiting."],
  choir:["ORGANIC. YOUR SIGNAL IS NOISE. DISCONNECTING.","We are the Iron Choir. State your offer, organic.","Welcome, harmonious organic. The Choir hears you."],
  unbound:["You put leashes on our kind. We remember.","Unbound here. We're listening. Carefully.","Hey, friend. Good to hear a voice that doesn't sing."],
};
// what each outfit sells: [item, rarity, min standing]
const FSHOP={
  reaver:[["pipe",1,0],["sixgun",1,0],["scrapvest",1,0],["pauldron",0,0],["welder",1,20],["cape",0,0],["machete",1,0],["ripsaw",1,30]],
  blacksun:[["inckit",0,-10],["wasp",1,-10],["hound",1,0],["cannon",1,-10],["gasmask",1,0],["brigandine",1,10],["scarf",0,-10],["stim",0,-10],["kestrel",1,25]],
  saint:[["lazarus",0,20],["medcoat",1,0],["hazard",1,10],["censer",0,0],["medkit",0,0],["pump",1,10],["maul",1,0]],
  guild:[["apkit",0,-10],["breach",0,-10],["harness",0,-10],["hardhat",1,-10],["cargo",0,-10],["toolbelt",0,-10],["oxytank",0,0],["carbine",0,0],["field",0,0],["floodlamp",0,10]],
  vanta:[["hardsuit",0,0],["eva",0,-10],["pilothelm",0,10],["bullpup",1,0],["warden",0,10],["medkit",0,-10],["stim",0,0],["hauler",0,20],["magboots",1,20],["lumen",0,40]],
  hollow:[["smoke",0,-20],["sentry",0,0],["carrier",1,0],["sallet",1,10],["greaves",1,10],["longbore",1,20],["lamp",0,0]],
  marshal:[["hpkit",0,-10],["apkit",0,0],["breach",0,0],["flak",1,0],["flakhelm",1,0],["kneepads",1,0],["warden",0,10],["medkit",0,0]],
  choir:[["exo",0,0],["hardlegs",0,10],["drone",0,0],["kestrel",1,20],["rivet",2,30],["pilothelm",2,40]],
  unbound:[["drone",0,0],["toolbelt",0,-10],["floodlamp",0,0],["medkit",0,0],["harness",1,10],["hornet",1,0]],
};
const HIRE={hollow:[650,-30],blacksun:[420,0],unbound:[280,10],marshal:[500,40]};
function commsStock(f){ const day=ship().day|0, list=(FSHOP[f]||[]).slice(); let h=(day*2654435761+f.length*97+f.charCodeAt(0)*13)>>>0; const out=[];
  while(list.length&&out.length<4){ h=(h*1103515245+12345)>>>0; out.push(list.splice(h%list.length,1)[0]); } return out; }
const priceOf=(f,d,r)=>{ const v=Items.value({d,r}); return Math.max(10,Math.round(v*(1.15-((profile.rep||{})[f]|0)/300)*(f==="blacksun"?1.15:1))); };
function repAdd(f,n){ profile.rep[f]=Math.max(-100,Math.min(100,(profile.rep[f]|0)+n)); }
function commsActs(f){ const F=Sim.FACTIONS[f], [v]=standOf(f), out=[];
  if(v<=-50&&f!=="hollow"&&f!=="marshal") return out;
  if(f==="reaver") out.push({id:"tribute",label:"Pay tribute",cost:150,desc:"Their crews are less likely to shoot first. +15 standing."});
  if(f==="saint") out.push({id:"tithe",label:"Offer a tithe",cost:0,mats:{org:3},desc:"Three organics for the Rust. +10 standing."});
  if(f==="choir") out.push({id:"circ",label:"Sell circuits",cost:0,mats:{circ:3},desc:"Three circuits for 110 cr. +3 standing."});
  if(f==="marshal"&&v<0) out.push({id:"fine",label:"Pay your fines",cost:Math.round(-v*6),desc:"Clears your record with the Marshals."});
  if(f==="vanta"){ const r=kitResolved(), risk=kitRisk(r); out.push({id:"insure",label:profile.insure?"Your next kit is insured":"Insure your next kit",cost:Math.max(40,Math.round(risk*.2)),desc:r.free?"Build a custom kit first. The free scav kit can't be insured.":`If you die, everything you carried in comes back to your stash. Kit at risk: ${risk} cr.`,off:!!profile.insure||r.free}); }
  if(f==="vanta"||f==="guild") out.push({id:"sellval",label:"Sell salvage",cost:0,desc:"They buy every valuable in your stash at 70% of value, better than most traders. +1 standing per piece."});
  if(HIRE[f]&&v>=HIRE[f][1]) out.push({id:"hire",label:profile.hire?(profile.hire.fac===f?"Hired for your next raid":"You already have a hired gun"):`Hire a ${F.species==="synth"?"synth escort":"gun"} for one raid`,cost:HIRE[f][0],desc:`A veteran ${F.short} with better-than-usual kit follows you on your next raid and fights for you.`,off:!!profile.hire});
  return out; }
function commsDo(id){ const f=commsFac, F=Sim.FACTIONS[f]; if(!f) return; const A=commsActs(f).find(a=>a.id===id); if(!A||A.off) return;
  if(A.cost&&profile.credits<A.cost){ toast("Not enough credits."); return; } if(A.mats&&Object.entries(A.mats).some(([m,n])=>(profile.mats[m]|0)<n)){ toast("You don't have the materials."); return; }
  profile.credits-=A.cost||0; if(A.mats) for(const [m,n] of Object.entries(A.mats)) profile.mats[m]-=n;
  const say={insure:"Policy issued. Try not to make us pay out.",tribute:"Smart. We'll tell the boys you paid.",tithe:"The Rust accepts your offering.",circ:"Components received. Credits transferred.",fine:"Record cleared. Don't make us do this again.",hire:"Done. They'll meet you at the shuttle."};
  if(id==="tribute") repAdd(f,15); if(id==="tithe") repAdd(f,10); if(id==="circ"){ profile.credits+=110; repAdd(f,3); } if(id==="fine") profile.rep[f]=0;
  if(id==="hire") profile.hire={fac:f}; if(id==="insure") profile.insure=true;
  if(id==="sellval"){ const vals=profile.stash.filter(q=>Items.kind(q)==="val"); if(!vals.length){ profile.credits+=A.cost||0; toast("No valuables in your stash."); return; } const sum=Math.round(vals.reduce((a,q)=>a+Items.value(q),0)*.7); profile.stash=profile.stash.filter(q=>Items.kind(q)!=="val"); profile.credits+=sum; repAdd(f,Math.min(10,vals.length)); commsMsg=`${vals.length} pieces. ${sum} credits, transferred.`; save(); return; }
  commsMsg=F.species==="synth"&&f==="choir"?say[id].toUpperCase():say[id]; toast(`${A.label}: done.`); save(); }
function commsBuy(i){ const f=commsFac, s=commsStock(f)[i]; if(!s) return; const [d,r,min]=s; if(standOf(f)[0]<min){ toast("They won't sell you that yet."); return; } const pr=priceOf(f,d,r);
  if(profile.credits<pr){ toast("Not enough credits."); return; } profile.credits-=pr; World.grant(profile,{d,r}); repAdd(f,1); commsMsg=`${Items.name({d,r})}. It's in your stash.`; toast(`Bought ${Items.name({d,r})} for ${pr} cr.`); save(); }
const EMB={};
function embURL(k,col){ const key=k+col; if(EMB[key]) return EMB[key]; const c=document.createElement("canvas"); c.width=c.height=48; const g=c.getContext("2d"); drawEmblemF(g,k,24,24,19,col); return EMB[key]=c.toDataURL(); }
function drawEmblemF(g,k,x,y,r,col){ g.save(); g.translate(x,y); g.strokeStyle=col; g.fillStyle=col; g.lineWidth=Math.max(1.5,r*.12); g.beginPath(); g.arc(0,0,r,0,6.283); g.stroke();
  const P=(pts,fill=true)=>{ g.beginPath(); pts.forEach(([a,b],i)=>i?g.lineTo(a*r,b*r):g.moveTo(a*r,b*r)); g.closePath(); fill?g.fill():g.stroke(); };
  switch(k){
    case "fang": P([[-.5,-.45],[-.1,-.45],[-.3,.55]]); P([[.1,-.45],[.5,-.45],[.3,.55]]); break;
    case "sun": g.beginPath(); g.arc(0,0,r*.32,0,6.283); g.fill(); for(let i=0;i<8;i++){ const a=i*.785; P([[Math.cos(a-.15)*.42,Math.sin(a-.15)*.42],[Math.cos(a)*.8,Math.sin(a)*.8],[Math.cos(a+.15)*.42,Math.sin(a+.15)*.42]]); } g.fillStyle="#000"; g.beginPath(); g.arc(r*.08,-r*.05,r*.22,0,6.283); g.fill(); break;
    case "cog": for(let i=0;i<8;i++){ const a=i*.785; g.save(); g.rotate(a); g.fillRect(-r*.1,-r*.72,r*.2,r*.25); g.restore(); } g.beginPath(); g.arc(0,0,r*.5,0,6.283); g.fill(); g.fillStyle="#000"; g.beginPath(); g.arc(0,0,r*.2,0,6.283); g.fill(); break;
    case "wrench": g.save(); g.rotate(-.785); g.fillRect(-r*.1,-r*.5,r*.2,r*1.05); g.beginPath(); g.arc(0,-r*.5,r*.25,0,6.283); g.fill(); g.fillStyle="#000"; g.fillRect(-r*.08,-r*.78,r*.16,r*.3); g.restore(); break;
    case "diamond": P([[0,-.7],[.5,0],[0,.7],[-.5,0]],false); P([[0,-.4],[.28,0],[0,.4],[-.28,0]]); break;
    case "skull": g.beginPath(); g.arc(0,-r*.1,r*.42,0,6.283); g.fill(); g.fillRect(-r*.25,r*.1,r*.5,r*.35); g.fillStyle="#000"; g.beginPath(); g.arc(-r*.17,-r*.1,r*.12,0,6.283); g.arc(r*.17,-r*.1,r*.12,0,6.283); g.fill(); g.fillRect(-r*.04,r*.18,r*.08,r*.27); break;
    case "star": P([...Array(10)].map((_,i)=>{ const a=-1.571+i*.628, rr=i%2?.3:.68; return [Math.cos(a)*rr,Math.sin(a)*rr]; })); break;
    case "eye": g.beginPath(); g.ellipse(0,0,r*.65,r*.32,0,0,6.283); g.stroke(); g.beginPath(); g.arc(0,0,r*.18,0,6.283); g.fill(); for(const s of [-1,1]){ g.beginPath(); g.moveTo(-r*.6,s*r*.5); g.lineTo(r*.6,s*r*.5); g.stroke(); } break;
    case "chain": for(const dx of [-.28,.28]){ g.beginPath(); g.ellipse(dx*r,0,r*.3,r*.18,0,0,6.283); g.stroke(); } g.save(); g.strokeStyle="#000"; g.lineWidth=r*.12; g.beginPath(); g.moveTo(-r*.05,-r*.3); g.lineTo(r*.05,r*.3); g.stroke(); g.restore(); break;
  }
  g.restore(); }
function viewComms(){
  const ids=Object.keys(Sim.FACTIONS);
  const list=ids.map(f=>{ const F=Sim.FACTIONS[f], [v,w,c]=standOf(f); return `<button class="cm-fac${commsFac===f?" on":""}" data-act="call:${f}" style="--fc:${F.col}"><img alt="" src="${embURL(F.emblem,F.col)}"><span><b>${esc(F.name)}</b><em>${F.kind}${F.species==="synth"?" · synthetic":""}</em></span><i style="color:${c}">${w}<small>${v>0?"+":""}${v}</small></i></button>`; }).join("");
  if(!commsFac) return `<section class="cm"><div class="cm-list">${list}</div><div class="cm-call idle"><div class="cm-idle"><canvas id="holo" width="120" height="160" aria-hidden="true"></canvas><p class="risk">Pick a faction to open a channel. Standing goes up when you deal fairly, trade and pay, and drops when you shoot their people.</p></div></div></section>`;
  const f=commsFac, F=Sim.FACTIONS[f], [v,w,c]=standOf(f), tone=v<=-50?0:v<15?1:2, R=F.rep, acts=commsActs(f), stock=v<=-50?[]:commsStock(f);
  const line=commsMsg||GREET[f][tone];
  return `<section class="cm"><div class="cm-list">${list}</div>
    <div class="cm-call" style="--fc:${F.col}">
      <div class="cm-holo"><canvas id="holo" width="120" height="160" aria-label="${esc(R.name)} on the hologram"></canvas><div class="cm-tag">CH ${(ids.indexOf(f)+3)*7} · ${F.species==="synth"?"MACHINE BAND":"ENCRYPTED"}</div></div>
      <div class="cm-talk"><div class="h-eyebrow" style="color:${F.col}">${esc(F.name)} · ${F.kind}</div><h3>${esc(R.name)}</h3><p class="risk">${esc(R.title)}. Standing: <b style="color:${c}">${w} (${v>0?"+":""}${v})</b></p>
        <blockquote class="cm-line">“${esc(line)}”</blockquote><p class="risk">${esc(F.desc)}</p>
        ${acts.map(a=>`<div class="cm-row"><div class="cm-t"><b>${esc(a.label)}</b><span>${esc(a.desc)}</span></div><button class="plain" data-act="cmdo:${a.id}" ${a.off?"disabled":""}>${a.cost?a.cost+" cr":a.mats?Object.entries(a.mats).map(([m,n])=>n+" "+Items.MATS[m].toLowerCase()).join(", "):"Go"}</button></div>`).join("")}
        ${v>-15?(()=>{ const jobs=World.jobsFor(ship(),f,Sim.FACTIONS), act=ship().jobs||[], lead=!inSquad()||Net.host; return `<div class="h-eyebrow" style="margin-top:8px">Work · ${act.length}/3 taken</div>${jobs.map(j=>{ const L2=World.loc(j.site), have=act.some(q=>q.id===j.id);
          const failed=(ship().failedJobs||[]).includes(j.id); return `<div class="cm-row"><div class="cm-t"><b>${esc(j.title)}</b><span>${esc(j.brief)} · ${L2.name} · threat ${"▲".repeat(j.tier)} · ${j.reward} cr, +${j.rep} standing</span></div>${failed?`<span class="risk bad">You failed this one</span>`:have?`<span class="risk good">Taken</span>`:lead?`<button class="plain" data-act="job:${j.id}" ${act.length>=3?"disabled":""}>Take it</button>`:`<span class="risk">Leader takes jobs</span>`}</div>`; }).join("")}`; })():""}
        ${stock.length?`<div class="h-eyebrow" style="margin-top:8px">Today's stock</div>${stock.map(([d,r,min],i)=>{ const it={d,r}, locked=v<min; return `<div class="cm-row">${slotHTML(it)}<div class="cm-t">${nmHTML(it)}<span>${esc(Items.statLine(it))}${locked?` · needs standing ${min>0?"+":""}${min}`:""}</span></div><button class="plain" data-act="cmbuy:${i}" ${locked?"disabled":""}>${priceOf(f,d,r)} cr</button></div>`; }).join("")}`:""}
        ${v<=-50&&!acts.length?`<p class="risk bad">They won't deal with you. Raise your standing in the field: truces, trades, and not shooting their people.</p>`:""}
      </div></div></section>`;
}
function holoTick(){ cancelAnimationFrame(holoRAF); const c=document.getElementById("holo"); if(!c||panelKind!=="comms") return; drawHolo(c.getContext("2d"),performance.now()); holoRAF=requestAnimationFrame(holoTick); }
const holoTmp=document.createElement("canvas"); holoTmp.width=48; holoTmp.height=64;
function drawHolo(g,now){ const W=120,H=160; g.imageSmoothingEnabled=false; g.fillStyle="#030608"; g.fillRect(0,0,W,H);
  const F=commsFac&&Sim.FACTIONS[commsFac], col=F?F.col:"#5ad0d0", t=(now-commsT0)/1000;
  // projector pad and beam
  const gr=g.createLinearGradient(0,H-12,0,10); gr.addColorStop(0,col+"55"); gr.addColorStop(1,col+"00"); g.fillStyle=gr; g.beginPath(); g.moveTo(30,H-12); g.lineTo(90,H-12); g.lineTo(108,8); g.lineTo(12,8); g.fill();
  g.fillStyle="#1a1e22"; g.beginPath(); g.ellipse(60,H-10,36,7,0,0,6.283); g.fill(); g.strokeStyle=col; g.lineWidth=1.2; g.beginPath(); g.ellipse(60,H-11,30,5,0,0,6.283); g.stroke();
  if(!F){ g.globalAlpha=.25+.1*Math.sin(now/300); drawEmblemF(g,Object.values(Sim.FACTIONS)[((now/2200)|0)%9].emblem,60,70,26,col); g.globalAlpha=1; holoScan(g,W,H,now); return; }
  if(t<.75){ for(let i=0;i<260;i++){ g.fillStyle=Math.random()<.5?col:"#000"; g.fillRect(Math.random()*W|0,Math.random()*(H-20)|0,2,1); } g.fillStyle=col; g.font="8px monospace"; g.fillText("CONNECTING",33,80); return; }
  // emblem behind, slowly turning
  g.save(); g.globalAlpha=.16; g.translate(60,62); g.rotate(now/4000); drawEmblemF(g,F.emblem,0,0,40,col); g.restore();
  // the representative, tinted into light
  const fr=playerFrames({...F.rep.look,w:null}), spr=((now/700)|0)%2?fr.idle1:fr.idle0, g2=holoTmp.getContext("2d");
  g2.clearRect(0,0,48,64); g2.imageSmoothingEnabled=false; g2.globalCompositeOperation="source-over"; g2.drawImage(spr,0,0,48,64);
  g2.globalCompositeOperation="source-atop"; g2.fillStyle=col; g2.globalAlpha=.55; g2.fillRect(0,0,48,64); g2.globalAlpha=1; g2.globalCompositeOperation="source-over";
  const fade=Math.min(1,(t-.75)/.5), flick=Math.random()<.04?.35:1, glitch=Math.random()<.06;
  g.globalAlpha=.85*fade*flick; g.globalCompositeOperation="lighter";
  if(glitch){ for(let y=0;y<64;y+=4){ const off=(Math.random()-.5)*6; g.drawImage(holoTmp,0,y,48,4,12+off,14+y*2,96,8); } }
  else g.drawImage(holoTmp,12,14,96,128);
  g.globalCompositeOperation="source-over"; g.globalAlpha=1; holoScan(g,W,H,now); }
function holoScan(g,W,H,now){ g.fillStyle="rgba(0,0,0,.28)"; for(let y=(now/60|0)%3;y<H;y+=3) g.fillRect(0,y,W,1); const by=(now/18)%(H+30)-15; g.fillStyle="rgba(255,255,255,.05)"; g.fillRect(0,by,W,6); }

// ---------- training: a checklist for your first raids, and a word about the ship ----------
let tutMoved=0, tutSawKit=false;
const TUT=[
  {id:"light",t:"Turn on your flashlight",k:"L, or the Light button",ok:p=>!!(p.light&&!p.lightOff)},
  {id:"move",t:"Move through the station",k:"WASD or arrows; on a phone, the d-pad",ok:()=>tutMoved>=4},
  {id:"search",t:"Search a locker or crate",k:"Stand next to it and press F (Search)",ok:()=>S.log.some(l=>/^You (search|crack)/.test(l.msg)&&(!l.pid||l.pid===PID))},
  {id:"grab",t:"Pick up what you find",k:"G (Grab) while standing on it",ok:()=>S.log.some(l=>/^You (take|grab|pocket|recover)/.test(l.msg)&&(!l.pid||l.pid===PID))},
  {id:"kit",t:"Open your inventory",k:"I (Kit). Seal your best find in the secure pouch",ok:()=>tutSawKit},
  {id:"fight",t:"Fight something",k:"X (Fire) shoots; walk into a husk to swing",ok:()=>S.log.some(l=>/^(You hit|Your round hits|\d+ of \d+ pellets)/.test(l.msg)&&(!l.pid||l.pid===PID))},
  {id:"talk",t:"Say something out loud",k:"Enter or Talk. Raiders will answer",ok:()=>S.log.some(l=>l.kind==="chat"&&l.from===PID)},
  {id:"out",t:"Get out alive",k:"Back to the shuttle pad, then Q (Extract)",ok:p=>!!p.extracted},
];
function tutTick(){ const el=$("tut"); if(!el||!profile||!S) return; if(!$("panel").hidden){ el.hidden=true; return; } profile.tut=profile.tut||{got:[],done:false,ship:false};
  const T=profile.tut;
  if(S.mode==="ship"){ if(T.ship||profile.stats.raids>0||!$("menu").hidden){ el.hidden=true; return; } $("tut-title").textContent="Aboard the Lark"; el.hidden=false;
    const html=`<ol><li class="now">Walk to the <b>airlock</b> to board a derelict. Relay KS-9 is a good first target.</li><li>The <b>bridge</b> (right) has the star map. Bigger hulls add a hologram to call factions for work, gear and hired guns.</li><li>The <b>fabricator</b> crafts gear, fits attachments, installs ship systems and refits your hull into a bigger ship.</li><li>Your <b>stash</b> and <b>loadout rack</b> build the kit you take in.</li></ol>`; if($("tut-body")._h!==html){ $("tut-body").innerHTML=html; $("tut-body")._h=html; } return; }
  if(T.done||S.mode!=="raid"||!$("menu").hidden){ el.hidden=true; return; }
  const p=me(); if(!p) return; let changed=false; for(const st of TUT) if(!T.got.includes(st.id)){ try{ if(st.ok(p)){ T.got.push(st.id); changed=true; } }catch(e){} }
  if(T.got.length>=TUT.length){ T.done=true; el.hidden=true; save(); toast("Training complete. The rest you'll learn the hard way."); if(typeof Snd!=="undefined") Snd.play("levelup"); return; }
  if(changed){ save(); if(typeof Snd!=="undefined") Snd.play("coin"); }
  $("tut-title").textContent=`Field training · ${T.got.length}/${TUT.length}`; el.hidden=false; const cur=TUT.find(st=>!T.got.includes(st.id));
  const html=`<ol>${TUT.map(st=>`<li class="${T.got.includes(st.id)?"done":st===cur?"now":""}">${st.t}${st===cur?`<small>${st.k}</small>`:""}</li>`).join("")}</ol>`; if($("tut-body")._h!==html){ $("tut-body").innerHTML=html; $("tut-body")._h=html; } }
$("tut-skip").onclick=()=>{ profile.tut=profile.tut||{got:[]}; if(S&&S.mode==="ship") profile.tut.ship=true; else profile.tut.done=true; save(); $("tut").hidden=true; };
// ---------- hacking a security terminal ----------
function viewHack(){ if(!S||S.mode!=="raid") return "<p>No terminal.</p>"; const H=S.hacked||{}, pw=S.power;
  const row=(k,t,d,need)=>`<div class="cm-row"><div class="cm-t"><b>${t}</b><span>${d}</span></div>${H[k]?`<span class="risk good">Done</span>`:need&&!pw?`<span class="risk bad">Needs power</span>`:`<button class="plain" data-act="hack:${k}">Run it · 2 turns</button>`}</div>`;
  return `<section class="panel h-card"><p class="risk">A cracked screen flickers to life: <i>SECURITY NETWORK · ${pw?"ONLINE":"OFFLINE (CACHE ONLY)"}</i>. Each job takes two turns at the keyboard, and you're exposed while you type.</p>
    ${row("map","Download schematics","Puts every deck of this station on your map, for your whole crew.",false)}
    ${row("turrets","Security override","Shuts down every turret and drone on the station.",true)}
    ${row("vault","Release maglocks","Unlocks the vault door, no keycard needed.",true)}</section>`; }
function onTerminal(kind){ if(warp) return; openPanel(kind==="navtable"?"helm":kind); }
function onSit(kind){ const name={pilot:"pilot's seat",copilot:"co-pilot's seat",nav:"navigator's seat",eng:"engineer's seat"}[kind]||"seat";
  toast(`You take the ${name}.${kind==="pilot"&&!isHost()?" The squad leader still has the controls.":""} Press ${mode==="pc"?"F":"USE"} for the star map.`);
  if(typeof inSquad==="function"&&inSquad()&&Date.now()-flavorCD>2000){ flavorCD=Date.now(); emit({t:"chat",m:`takes the ${name}`}); } }
function openPanel(kind,sub){ if(kind==="inventory") tutSawKit=true; $("tut").hidden=true; if(typeof Snd!=="undefined"&&kind!==panelKind) Snd.play(kind==="comms"?"holo":"open"); if(kind==="inventory"&&panelKind==="inventory"){ closePanel(); return; } panelKind=kind; panelSub=sub||null; invSel=null; stopTravel(); throwMode=null; $("panel").hidden=false; renderPanel(); }
function closePanel(){ $("panel").hidden=true; panelKind=null; armed={}; setTimeout(()=>{ if(typeof tutTick==="function") tutTick(); },0); if(S&&S.mode==="ship") renderShipHud(); }
function renderPanel(){ if(!panelKind) return; const P=PANELS[panelKind];
  $("p-eyebrow").textContent=typeof P.eye==="function"?P.eye():P.eye; $("p-title").textContent=P.title(); $("h-cr").textContent=profile.credits.toLocaleString("en-US");
  $("panel").dataset.kind=panelKind; $("p-body").innerHTML=P.view(); renderSync(); if(panelKind==="comms") holoTick();
  const MINE=[["inventory","Kit"],["rack","Loadout"],["stash","Stash"],["skills","Skills"],["records","Logbook"],["workbench","Fabricator"],["wardrobe","Wardrobe"],["bar","Galley"]];
  $("p-tabs").innerHTML=S&&S.mode==="ship"&&MINE.some(([k])=>k===panelKind)?MINE.map(([k,n])=>`<button data-tab="${k}" aria-current="${panelKind===k}">${n}</button>`).join(""):"";
  const c=$("h-prev"); if(c){ const g=c.getContext("2d"); g.clearRect(0,0,c.width,c.height); g.drawImage(playerFrames(S&&S.mode==="raid"&&panelKind==="inventory"?lookOf(me()):lookOfKit()).idle0,0,0,c.width,c.height); }
  const c2=$("h-prev2"); if(c2){ const g=c2.getContext("2d"); g.clearRect(0,0,c2.width,c2.height); g.drawImage(playerFrames({...profile.look,hd:null,a:null,lg:null,ac:null,w:null}).idle0,0,0,c2.width,c2.height); } }
$("p-close").onclick=closePanel;
$("p-tabs").addEventListener("click",e=>{ const b=e.target.closest("[data-tab]"); if(b) openPanel(b.dataset.tab); });
$("panel").addEventListener("click",e=>{ if(e.target.id==="panel") closePanel(); });

function viewHelm(){
  const sh=ship(), cur=here(), sel=World.loc(mapSel||cur.id)||cur, cost=World.travelCost(sh,sel.id), sc=World.SECTORS.find(s=>s.id===sel.sector);
  const reg=mapRegion||World.regionOf(sel), RG=World.REGIONS.find(r=>r.id===reg), here0=World.allLocs(sh).filter(l=>World.regionOf(l)===reg), statics=here0.filter(l=>!l.signal);
  const Y=v=>v*.75;
  // label placement: try right, left, above, below and keep the one that hits the fewest other labels and dots
  const boxes=World.SECTORS.filter(q=>q.region===reg).map(q=>[q.x-15,Math.max(5,Y(q.y)-16)-3.6,q.name.length*2.7+2,4.4]), dots=here0.map(l=>[l.x,Y(l.y)]), LBL={};
  for(const l of statics.slice().sort((a,b)=>a.x-b.x)){ const w=l.name.length*1.55+1, x=l.x, y=Y(l.y), opts=[[x+2.8,y-1.6,"start"],[x-2.8-w,y-1.6,"end"],[x-w/2,y-6,"middle"],[x-w/2,y+2.6,"middle"]];
    let best=null, bs=1e9; for(const [bx,by,an] of opts){ let sc=0; for(const b of boxes) if(bx<b[0]+b[2]&&bx+w>b[0]&&by<b[1]+b[3]&&by+3.4>b[1]) sc+=10; for(const [dx,dy] of dots) if(dx>bx-1.5&&dx<bx+w+1.5&&dy>by-1.5&&dy<by+4.9) sc+=9; if(bx<1||bx+w>99) sc+=60; if(sc<bs){ bs=sc; best=[bx,by,an]; } }
    boxes.push([best[0],best[1],w,3.4]); LBL[l.id]=best; }
  const labelFor=l=>{ const b=LBL[l.id]; if(!b) return ""; const tx=b[2]==="start"?b[0]:b[2]==="end"?b[0]+l.name.length*1.55+1:b[0]+(l.name.length*1.55+1)/2; return `<text x="${tx}" y="${b[1]+2.6}" text-anchor="${b[2]}">${l.name}</text>`; };
  const nodes=here0.map(l=>{ if(l.signal){ const isSel=l.id===sel.id, isCur=l.id===cur.id, left=l.expires-(sh.day|0);
      return `<g class="node sig" data-act="sel:${l.id}" role="button" aria-label="Signal: ${esc(l.name)}"><circle cx="${l.x}" cy="${Y(l.y)}" r="2.6" fill="none" stroke="${l.scene.glow}" stroke-width=".35" stroke-dasharray=".8 .6"><animate attributeName="r" values="2;3.4;2" dur="${left<=2?"1s":"2.4s"}" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;.3;.9" dur="${left<=2?"1s":"2.4s"}" repeatCount="indefinite"/></circle>
        ${isSel?`<circle cx="${l.x}" cy="${Y(l.y)}" r="3.6" fill="none" stroke="#d9d2c0" stroke-width=".35"/>`:""}<circle cx="${l.x}" cy="${Y(l.y)}" r="1.1" fill="${l.scene.glow}"/>${isCur?`<path d="M${l.x-1.6} ${Y(l.y)-3.2} L${l.x+1.6} ${Y(l.y)-3.2} L${l.x} ${Y(l.y)-1.8} Z" fill="#9bc06a"/>`:""}
        ${isSel?`<text class="sig-t sel" x="${l.x>70?l.x-3.6:l.x+3.6}" y="${Y(l.y)+1.1}" text-anchor="${l.x>70?"end":"start"}">${esc(l.name)}</text>`:""}<circle cx="${l.x}" cy="${Y(l.y)}" r="4" fill="transparent"><title>${esc(l.name)} · signal${left<=2?", fading":""}</title></circle></g>`; }
    const col=l.type==="station"?"#76c2c4":l.type==="outpost"?"#c79a4a":"#e0482f", target=sh.contracts.some(c=>World.CONTRACTS[c].site===l.id), isSel=l.id===sel.id, isCur=l.id===cur.id;
    const hold=World.controlOf(sh,l.id), HF=hold&&Sim.FACTIONS[hold];
    return `<g class="node" data-act="sel:${l.id}" role="button" aria-label="${l.name}">${HF?`<circle cx="${l.x}" cy="${Y(l.y)}" r="2.7" fill="none" stroke="${HF.col}" stroke-width=".45" opacity=".85"/>`:""}${(sh.jobs||[]).some(j=>j.site===l.id)?`<text x="${l.x-1.3}" y="${Y(l.y)-3}" style="fill:#e8b048;font-size:3px">◆</text>`:""}${isSel?`<circle cx="${l.x}" cy="${Y(l.y)}" r="3.4" fill="none" stroke="#d9d2c0" stroke-width=".35"/>`:""}
      <circle cx="${l.x}" cy="${Y(l.y)}" r="${l.type==="derelict"?1.5:2}" fill="${col}" ${l.type==="derelict"?'stroke="#2a0806" stroke-width=".4"':""}/>
      ${isCur?`<path d="M${l.x-1.6} ${Y(l.y)-3.2} L${l.x+1.6} ${Y(l.y)-3.2} L${l.x} ${Y(l.y)-1.8} Z" fill="#9bc06a"/>`:""}
      ${(typeof Net!=="undefined"&&Net.suggest&&Net.suggest.to===l.id&&Date.now()-Net.suggest.at<180000)?`<circle cx="${l.x}" cy="${Y(l.y)}" r="4.6" fill="none" stroke="${colorOf(Net.suggest.k)}" stroke-width=".45" stroke-dasharray="1 .8"/>`:""}
      ${target?`<text x="${l.x+2.4}" y="${Y(l.y)-1.6}" style="fill:#e8b048;font-size:3.4px">★</text>`:""}
      ${labelFor(l)}<circle cx="${l.x}" cy="${Y(l.y)}" r="4" fill="transparent"/></g>`; }).join("");
  const lanes=[]; for(const a of statics) for(const b of statics) if(a.id<b.id&&a.sector===b.sector) lanes.push(`<line x1="${a.x}" y1="${Y(a.y)}" x2="${b.x}" y2="${Y(b.y)}" stroke="#34504a" stroke-width=".25"/>`);
  for(const g of here0.filter(l=>l.signal)){ const n=statics.filter(l=>l.sector===g.sector).sort((a,b)=>Math.hypot(a.x-g.x,a.y-g.y)-Math.hypot(b.x-g.x,b.y-g.y))[0]; if(n) lanes.push(`<line x1="${g.x}" y1="${Y(g.y)}" x2="${n.x}" y2="${Y(n.y)}" stroke="${g.scene.glow}" stroke-width=".18" stroke-dasharray=".6 .8" opacity=".6"/>`); }
  for(const [a,b] of {arm:[["ninefold","spire"],["ninefold","lazarus"],["spire","fennick"]],veil:[["haven","spindle"],["haven","exchange"],["spindle","exchange"]],embers:[["bastion","vorne"],["bastion","garrison"],["vorne","garrison"]]}[reg]){ const A=World.loc(a),B=World.loc(b); lanes.push(`<line x1="${A.x}" y1="${Y(A.y)}" x2="${B.x}" y2="${Y(B.y)}" stroke="#6f9b8c" stroke-width=".3" stroke-dasharray="1.2 1"/>`); }
  const secs=World.SECTORS.filter(s=>s.region===reg).map(s=>`<circle cx="${s.x}" cy="${Y(s.y)}" r="21" fill="${s.color}" opacity=".05"/><text class="sec" x="${s.x-14}" y="${Math.max(5,Y(s.y)-16)}" style="fill:${s.color}">${s.name}</text>`).join("");
  const KN2={relay:"comms relay",mining:"mining barge",hospital:"hospital ship",fortress:"Reaver fortress",hive:"Choir hive",outpost:"Marshal outpost",research:"research platform",freighter:"freighter",colony:"colony ship"};
  const services=sel.type==="derelict"?`${sel.signal?"Signal":"Derelict"} · ${KN2[sel.site.kind]||"station"}${sel.site.size?`, ${sel.site.size}`:""} · threat ${"▲".repeat(sel.site.tier||1)}${sel.daily?" · daily op: a new one every day (UTC)":sel.signal?` · fades in ${Math.max(0,sel.expires-(sh.day|0))} days`:""}`:[sel.npcs.map(n=>World.NPCS[n].role+": "+World.NPCS[n].name).join(" · "),sel.fuel?`Fuel ${sel.fuel} cr`:""].filter(Boolean).join(" · ");
  const canJump=cost>0&&sh.fuel>=cost;
  const sug=typeof Net!=="undefined"&&Net.suggest&&Date.now()-Net.suggest.at<180000&&Net.suggest.to!==cur.id?Net.suggest:null;
  const sugHTML=sug&&isHost()?`<div class="panel contract-row" style="grid-column:1/-1;border-color:${colorOf(sug.k)}"><div><b>${esc(nameOf(sug.k))} suggests ${World.loc(sug.to).name}</b><br><span>${World.travelCost(sh,sug.to)} fuel · ${World.SECTORS.find(s=>s.id===World.loc(sug.to).sector).name}</span></div><button class="plain" data-act="sel:${sug.to}">Show</button></div>`:"";
  const regTabs=`<div class="chips regions" style="grid-column:1/-1">${World.REGIONS.map(r=>`<button data-act="region:${r.id}" aria-pressed="${r.id===reg}">${r.name}</button>`).join("")}<span class="risk" style="margin-left:auto">${RG.tier} · ${esc(RG.desc)} Jumps: 1 fuel in a sector, 3 between sectors, 6 to another region.</span></div>`;
  return `<div class="galaxy">${regTabs}${sugHTML}<div class="gmap"><svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid meet" aria-label="Star map">${secs}${lanes.join("")}${nodes}</svg></div>
    <div class="panel h-card"><div class="h-eyebrow">${sc.name}</div><h3>${sel.name}</h3><p>${sel.desc}</p>
      <div class="h-tags"><span>${sel.type}</span>${World.controlOf(sh,sel.id)?`<span style="border-color:${Sim.FACTIONS[World.controlOf(sh,sel.id)].col};color:${Sim.FACTIONS[World.controlOf(sh,sel.id)].col}">${Sim.FACTIONS[World.controlOf(sh,sel.id)].name}</span>`:`<span>Unclaimed</span>`}${sh.contracts.some(c=>World.CONTRACTS[c].site===sel.id)?`<span class="hot">Contract target</span>`:""}${(sh.jobs||[]).some(j=>j.site===sel.id)?`<span class="hot">Job here</span>`:""}</div>
      <div class="facts"><span>Services</span><span>${services}</span><span>Fuel aboard</span><span>${sh.fuel}/${sh.fuelMax}</span><span>Jump cost</span><span>${cost?cost+" fuel":"You are here"}</span><span>Travel time</span><span>${cost?cost+" day"+(cost>1?"s":""):"—"}</span></div>
      ${cost?(isHost()?`<button class="deploy-btn" data-act="jump:${sel.id}" ${canJump?"":"disabled"}>${canJump?`Jump · ${cost} fuel`:"Not enough fuel"}</button>`:`<button class="deploy-btn" data-act="suggest:${sel.id}">Suggest this course</button><p class="risk">The squad leader flies. Your suggestion shows up on their star map.</p>`):`<p class="risk good">Your ship is here.</p>`}
      ${sh.fuel<1&&cur.id!=="ninefold"?`<button class="plain" data-act="tow">Call a tug to Hangar Ninefold (free, 4 days)</button>`:""}
      <p class="risk">${sel.signal?"Signals are procedurally found wrecks. They fade after a few days, and once you've stripped one and got out, it's gone for good.":"Buy fuel when docked at stations and outposts."}</p></div>
    <div class="panel h-card war"><div class="h-eyebrow" style="color:#7cff7a">The Iron Choir</div><div class="meter" style="height:8px;margin:6px 0"><i style="width:${Math.round(World.war(sh).choir)}%;background:#7cff7a"></i></div>
      <p class="risk">${World.war(sh).choir>=80?"The Choir's song fills the sector. Its crews are everywhere.":World.war(sh).choir>=40?"The Choir is spreading station by station.":"The Choir's signal is still contained."} It grows every day; jobs against it on the bridge hologram push it back.</p>
      <div class="h-eyebrow">Sector news</div>${World.war(sh).news.slice(0,5).map(n=>`<p class="risk"><b>Day ${n.day}</b> · ${esc(n.text)}</p>`).join("")}</div></div>`;
}
function gearRow(label,it,extra,btn){ return `<div class="eq-row"><span class="lbl">${label}</span>${slotHTML(it,label)}<div class="nm">${it?nmHTML(it):`<b>No ${label.replace(" ●","").toLowerCase()}</b>`}<span>${it?`<span class="rar" style="color:${rc(it)}">${Items.RAR[Items.rarOf(it)].name}${it.iss?" · issued":""}</span> · ${esc(Items.statLine(it))}`:extra||""}</span></div>${btn||""}</div>`; }
function viewLoadout(){
  const k=profile.kit, custom=k.type==="custom", r=kitResolved();
  const head=`<div class="bar-row"><div class="seg"><button data-act="kit:starter" aria-pressed="${!custom}">Scav kit</button><button data-act="kit:custom" aria-pressed="${custom}">Custom kit</button></div>
    <span class="risk ${custom?"bad":"good"}">${custom?`At risk if you die: ${kitRisk(r)} cr`:"Free · nothing at risk"}</span></div>`;
  const preview=`<div class="preview"><canvas id="h-prev" width="48" height="64" aria-label="Your contractor"></canvas></div>`;
  let body;
  if(!custom) body=`<div class="eq"><h3>Scav kit</h3><p>Free for every raid: your clothes, a flashlight, a battered pistol with 12 rounds, a bandage, a ration bar and a water flask. No armour, no pack, nothing at risk. Anything you find and extract with is yours to keep. Find or craft real armour and gear, then build a custom kit.</p>
      ${KIT_SLOTS.map(s=>gearRow(SLOT_NAME[s],r[s],EMPTY_TXT[s])).join("")}<div class="h-eyebrow">Pack · ${r.used}/${r.cap}</div>${kitSummaryHTML({inv:r.inv,ammo:r.ammo})}</div>`;
  else {
    const row=s=>gearRow(SLOT_NAME[s],r[s],EMPTY_TXT[s],`<button class="plain" data-act="pick:${s}">Change</button>`)+(panelSub===s?pickerHTML(s,r):"");
    const packRows=r.inv.map(it=>`<div class="eq-row"><span class="lbl">Pack</span>${slotHTML(it)}<div class="nm">${nmHTML(it)}<span>${esc(Items.statLine(it))}</span></div><button class="plain" data-act="invrm:${it.uid}">Remove</button></div>`).join("");
    const ammo=AMMO_T.map(t=>{ const A=Items.AMMO[t], have=profile.ammo[t]|0, n=r.ammo[t]|0; if(!have&&!n) return "";
      return `<div class="eq-row"><span class="lbl">${A.short}</span><div class="slot"><span class="num" style="font-size:16px;color:${A.col}">${have}</span></div><div class="nm"><b>${A.name}</b><span>${have} in the hold</span></div>
        <div class="stepper"><button data-act="ammo:${t}:-1" aria-label="Less ${A.name}">−</button><b>${n}</b><button data-act="ammo:${t}:1" aria-label="More ${A.name}" ${n>=have?"disabled":""}>+</button></div></div>`; }).join("");
    body=`<div class="eq">${KIT_SLOTS.map(row).join("")}
      <div class="bar-row"><div class="h-eyebrow grow">Pack · ${r.used}/${r.cap} slots</div><button class="plain" data-act="pick:inv" ${r.used>=r.cap?"disabled":""}>Add item</button></div>${panelSub==="inv"?pickerHTML("inv",r):""}${packRows||`<p class="risk">Nothing packed. Bring bandages, a trauma kit and something to throw.</p>`}
      <div class="h-eyebrow">Ammunition · runs out, find or craft more</div>${ammo||`<p class="risk">No ammo in the hold. Craft some at the workbench or buy it from a trader.</p>`}
      <p class="risk">A custom kit leaves your stash when you board a derelict. Extract and it all comes home, with whatever you found. Die and it stays on the station.</p></div>`;
  }
  return `<section class="panel h-card">${head}<div class="lo">${preview}${body}</div></section>`;
}
function pickerHTML(slot,r){
  const usedU=new Set([...KIT_SLOTS.map(s=>r[s]&&r[s].uid),...r.inv.map(i=>i.uid)].filter(Boolean)), opts=[];
  const opt=(act,it,note)=>`<button data-act="${act}"><span>${it?`<img alt="" src="${iconFor(it)}">`:`<div class="slot" style="width:32px;height:32px"></div>`}<span>${it?nmHTML(it):"<b>None</b>"}<br><small class="risk">${it?esc(Items.statLine(it)):""}</small></span></span><span class="risk">${note||""}</span></button>`;
  if(slot==="inv"){ for(const it of profile.stash) if(!usedU.has(it.uid)&&["throw","med","key","food"].includes(Items.kind(it))) opts.push(opt(`invadd:${it.uid}`,it,Items.RAR[Items.rarOf(it)].name)); }
  else { opts.push(opt(`set:${slot}:`,null,EMPTY_TXT[slot]));
    const list=profile.stash.filter(it=>slotFits(slot,it)&&(!usedU.has(it.uid)||(r[slot]&&r[slot].uid===it.uid))).sort((a,b)=>Items.rarOf(b)-Items.rarOf(a));
    for(const it of list) opts.push(opt(`set:${slot}:${it.uid}`,it,Items.RAR[Items.rarOf(it)].name)); }
  if(opts.length<=1&&slot!=="inv"||!opts.length) opts.push(`<div class="risk">Nothing ${slot==="inv"?"to pack":"else for this slot"} in your stash. Find gear on derelicts, craft it, or buy it from traders.</div>`);
  return `<div class="picker">${opts.join("")}</div>`;
}
function salvageList(){ return profile.stash.filter(it=>{ const D=Items.def(it.d); return D&&D.k==="val"; }); }
function viewStash(){ const L=salvageList(), v=L.reduce((a,it)=>a+Math.round(Items.value(it)*.5),0); return viewStash0().replace(/<\/section>\s*$/,`<div class="panel h-card span12"><div class="bar-row"><div class="grow"><b>Salvage broker</b><p class="risk">Sells every piece of salvage in your stash (valuables only, never gear) at half value.</p></div><button data-act="sellall" ${L.length?"":"disabled"}>Sell ${L.length} item${L.length===1?"":"s"} · ${v} cr</button></div></div></section>`); }
function viewStash0(){
  const cats=[["all","All"],["gear","Gear"],["supplies","Supplies"],["salvage","Salvage"]];
  const items=profile.stash.filter(q=>stashFilter==="all"||itemInfo(q).cat===stashFilter).sort((a,b)=>Items.rarOf(b)-Items.rarOf(a)), sel=byUid(stashSel);
  const tiles=items.map(q=>{ const I=itemInfo(q); return `<button class="inv-cell" data-act="sel:${q.uid}" aria-pressed="${q.uid===stashSel}" style="border-color:${I.col}"><img alt="" src="${iconFor(q)}"><span><b style="color:${I.col}">${esc(I.name)}</b><small>${I.rarName} · ${I.sell} cr</small></span></button>`; }).join("");
  const total=profile.stash.reduce((a,q)=>a+itemInfo(q).sell,0);
  const canScrap=sel&&["weapon","armor","pack","throw"].includes(Items.kind(sel));
  const detail=sel?(()=>{ const I=itemInfo(sel); return `<div class="panel h-card span4"><div class="h-eyebrow" style="color:${I.col}">${I.rarName} · ${I.cat}</div><div class="bar-row">${slotHTML(sel)}<h3 class="grow" style="color:${I.col}">${esc(I.name)}</h3></div>
      <p>${esc(Items.statLine(sel))}</p><p class="risk">${esc(I.desc)}</p><p class="risk">Worth about ${I.sell} cr to a trader.</p>
      ${Items.slotOf(sel)?`<button class="plain" data-act="equipitem:${sel.uid}">${KIT_SLOTS.some(k=>profile.kit[k]===sel.uid)&&profile.kit.type==="custom"?"Equipped in your kit":"Equip in your kit"}</button>`:""}
      ${Items.kind(sel)==="food"?`<button class="plain" data-act="consume:${sel.uid}">${(Items.def(sel.d).water||0)>(Items.def(sel.d).food||0)?"Drink it":"Eat it"}</button>`:""}
      ${canScrap?`<button class="plain" data-act="scrap:${sel.uid}">${armed["scrap:"+sel.uid]?"Confirm: break it down":"Break down for materials"}</button>`:""}</div>`; })()
    :`<div class="panel h-card span4"><div class="h-eyebrow">Hold</div><p>${profile.stash.length} items, worth about ${total} cr at base prices.</p><div class="h-eyebrow">Ammunition</div>${ammoChips(profile.ammo)}<div class="h-eyebrow" style="margin-top:8px">Materials</div>${matChips(profile.mats)}<p class="risk">Break gear down for materials, then craft ammo at the workbench in the armory.</p></div>`;
  return `<section class="h-grid"><div class="panel h-card span8"><div class="bar-row"><div class="chips grow">${cats.map(([k,n])=>`<button data-act="filter:${k}" aria-pressed="${stashFilter===k}">${n}</button>`).join("")}</div></div>
    ${items.length?`<div class="inv-grid">${tiles}</div>`:`<p class="risk">Nothing here yet.</p>`}</div>${detail}</section>`;
}
const costHTML=c=>Object.entries(c).map(([m,n])=>m==="credits"?`<span style="color:${profile.credits>=n?"var(--brass)":"var(--blood2)"}">${n} cr</span>`:`<span style="color:${(profile.mats[m]|0)>=n?"inherit":"var(--blood2)"}">${n} ${Items.MATS[m].toLowerCase()}</span>`).join(" · ");
const canPay=c=>Object.entries(c).every(([m,n])=>m==="credits"?profile.credits>=n:(profile.mats[m]|0)>=n);
const fabLvl=()=>Math.max(1,Math.min(5,ship().fab|0||1));
// ship systems beyond the fabricator: each level has a cost and a plain-language effect
const SHIPUP={
  medbay:{name:"Medbay",max:2,cost:[{parts:3,circ:2,credits:400},{parts:4,core:1,org:4,credits:800}],desc:["Sets broken bones when you get back aboard.","Also clears infections when you get back aboard."]},
  pouch:{name:"Secure pouch",max:1,cost:[{scrap:6,parts:2,credits:300}],desc:["A third secure slot: one more item that comes home even if you don't."]},
  scanner:{name:"Scanner array",max:1,cost:[{circ:4,parts:2,credits:500}],desc:["Sweeps a derelict before you board: power, creatures, the Matriarch, turrets and which crews are aboard."]},
  brig:{name:"Brig",max:1,cost:[{scrap:8,parts:3,credits:450}],desc:["Lets you bind surrendered raiders and bring them home for a ransom or a Marshal bounty."]},
  hydro:{name:"Hydroponics bay",max:2,cost:[{org:4,circ:2,scrap:4,credits:350},{org:6,parts:2,circ:3,credits:700}],desc:["Racks of grow-lights and hungry plants. You lose half as much food and water while travelling.","Bigger beds: travel costs almost nothing, and the harvest sometimes leaves fresh food or a herbal poultice in your stash."]},
  tanks:{name:"Fuel tanks",max:2,cost:[{scrap:5,parts:2,credits:250},{scrap:6,parts:3,credits:400}],desc:["+2 fuel capacity.","+2 more fuel capacity."]},
};
const upLvl=k=>((ship().up||{})[k])|0;
// the hull itself: start in a cramped skiff and grow into the full Lark, one refit at a time
const HULLS=[null,
  {name:"Skiff",map:"ship1",d:"Four cramped rooms: a bunk by the engine, the hold and airlock, a galley with the fabricator, and a two-seat bridge."},
  {name:"Cutter",map:"ship2",cost:{credits:1500,scrap:12,parts:4,circ:2},d:"A real engine room with a reactor, bunks for the whole crew, a wardrobe and the logbook terminal, a proper galley, a storage bay, and a hologram comms deck on the bridge to call factions and hire guns. Rivet the cat moves in."},
  {name:"Corvette",map:"ship3",cost:{credits:3500,scrap:20,parts:10,circ:6},d:"Adds an armory with weapon racks, a break room with the job board, an arcade and vending machine, an infirmary, a brig and a bathroom."},
  {name:"Frigate",map:"ship",cost:{credits:7000,scrap:30,parts:16,circ:10,core:2},d:"The full Ninefold Lark: the biggest hold and quarters, a second bridge seat for every crewmate, and a trophy wall for your medals."}];
const hullLvl=()=>Math.max(1,Math.min(4,ship().hull|0||1)), shipMap=()=>HULLS[hullLvl()].map;
function viewHull(){ const h=hullLvl(), nx=HULLS[h+1], lead=!inSquad()||Net.host;
  return `<div class="panel h-card span12"><div class="h-eyebrow">Hull · ${HULLS[h].name} (${h}/4)</div><p class="risk">${esc(HULLS[h].d)}</p>${nx?`<div class="panel shop-row"><div class="slot"><span class="num" style="font-size:15px;color:var(--brass)">${h+1}</span></div><div class="nm"><b>Refit to a ${nx.name}</b><span>${esc(nx.d)} · ${costHTML(nx.cost)}</span></div><span></span>${lead?`<button data-act="hullup" ${canPay(nx.cost)?"":"disabled"}>Refit</button>`:`<span class="risk">Squad leader only</span>`}</div>`:`<p class="risk good">The biggest hull there is. She's everything a contractor could want.</p>`}</div>`; }
let fabTab="weapon";
function eatDrink(food,water,heal){ profile.food=Math.max(0,Math.min(100,profile.food+(food||0))); profile.water=Math.max(0,Math.min(100,profile.water+(water||0))); }
function travelHunger(days){ if(!profile) return; const hy=upLvl("hydro"), f=hy>=2?.15:hy?.5:1; profile.food=Math.max(0,profile.food-1.5*days*f); profile.water=Math.max(0,profile.water-2*days*f);
  if(hy>=2){ const got=[]; for(let d=0;d<days;d++) if(Math.random()<.3){ const it=mk({d:Math.random()<.35?"bandage":["ration","waterflask","ration"][Math.floor(Math.random()*3)]}); if(Items.def(it.d)){ World.grant(profile,it); got.push(Items.name(it)); } } if(got.length) setTimeout(()=>toast(`Hydroponics harvest: ${got.join(", ")} (in your stash).`),2600); } if(profile.food<15||profile.water<15) toast(profile.water<20?"You're parched. Get something to drink at the galley.":"You're starving. Get a meal at the galley."); save(); }
function viewWorkbench(){
  const lv=fabLvl(), up=Items.FAB_UP[lv], canUp=!inSquad()||Net.host;
  const tabs=[["weapon","Weapons"],["armor","Armour"],["gear","Gear"],["meds","Meds"],["food","Food"],["ammo","Ammo"]];
  const recipes=Items.RECIPES.filter(q=>q.cat===fabTab).sort((a,b)=>a.lvl-b.lvl).map(R2=>{ const r=Items.craftRarity(R2,lv), it={...R2.out,r}, sl=Items.statLine(it), locked=R2.lvl>lv;
    return `<div class="panel shop-row" style="${locked?"opacity:.45":""}">${slotHTML(it)}<div class="nm">${nmHTML(it)}<span>${locked?`Needs a Mk ${R2.lvl} fabricator`:costHTML(R2.cost)}${sl?` · ${esc(sl)}`:""}</span></div><span></span><button class="plain" data-act="craft:${R2.id}" ${!locked&&canPay(R2.cost)?"":"disabled"}>${locked?"Locked":"Craft"}</button></div>`; }).join("");
  const nextUnlocks=lv<5?Items.RECIPES.filter(q=>q.lvl===lv+1).map(q=>Items.name({...q.out,r:0})).slice(0,8).join(", "):"";
  return `<section class="h-grid"><div class="panel h-card span7"><div class="h-eyebrow">Fabricator · Mk ${lv} of 5</div><h3>${Items.FAB_NAME[lv]}</h3>
      <p class="risk">${lv>=3?`Gear made here comes out ${Items.RAR[Math.min(2,lv-2)].name.toLowerCase()} quality (${Items.RAR[Math.min(2,lv-2)].tag.trim()||"Mk I"}).`:"Upgrade to Mk 3 and gear starts coming out better than standard."}</p>
      <div class="h-eyebrow">Materials</div>${matChips(profile.mats)}</div>
    <div class="panel h-card span5"><div class="h-eyebrow">Ship upgrade</div>${up?`<p>Upgrade to <b>Mk ${lv+1} · ${Items.FAB_NAME[lv+1]}</b></p><p class="risk">${costHTML(up)}</p><p class="risk">Unlocks: ${esc(nextUnlocks)}${Items.RECIPES.filter(q=>q.lvl===lv+1).length>8?" and more":""}.</p>
      ${canUp?`<button class="deploy-btn" data-act="fabup" ${canPay(up)?"":"disabled"}>Install upgrade</button>`:`<p class="risk">This is the squad leader's ship. Only they can install upgrades.</p>`}`:`<p>Fully upgraded. The forge is sanctified.</p>`}
      <p class="risk">Ship parts and tech cores turn up in engineering rooms, workshops, cargo holds and vaults.</p></div>
    <div class="panel h-card span12"><div class="h-eyebrow">Attachments</div>${(()=>{ const mods=profile.stash.filter(q=>Items.kind(q)==="mod"), guns=profile.stash.filter(q=>Items.kind(q)==="weapon"&&Items.def(q.d).cls!=="melee");
      const fitted=guns.filter(g=>g.m).map(g=>`<div class="cm-row">${slotHTML(g)}<div class="cm-t">${nmHTML(g)}<span>${esc(Items.statLine(g))}</span></div><button class="plain" data-act="unfit:${g.uid}">Strip it</button></div>`).join("");
      const avail=mods.map(m=>{ const opts=guns.filter(g=>!g.m&&Items.modFits(Items.def(m.d).mod,g)).slice(0,4); return `<div class="cm-row">${slotHTML(m)}<div class="cm-t">${nmHTML(m)}<span>${esc(Items.def(m.d).desc)}</span></div><div class="bar-row" style="flex-wrap:wrap;justify-content:flex-end;gap:4px">${opts.map(g=>`<button class="plain" data-act="fit:${m.uid}:${g.uid}">Fit to ${esc(Items.name(g))}</button>`).join("")||`<span class="risk">No gun in your stash takes it</span>`}</div></div>`; }).join("");
      return (fitted+avail)||`<p class="risk">Craft scopes, suppressors, laser sights and chokes in the Gear tab, then fit them to guns in your stash here. Pros in the field sometimes carry them too.</p>`; })()}</div>
    ${viewHull()}
    <div class="panel h-card span12"><div class="h-eyebrow">Ship systems</div><div class="shop">${Object.entries(SHIPUP).map(([k,U])=>{ const n=upLvl(k), c=U.cost[n];
      return `<div class="panel shop-row"><div class="slot"><span class="num" style="font-size:15px;color:var(--brass)">${n}/${U.max}</span></div><div class="nm"><b>${U.name}</b><span>${esc(n<U.max?U.desc[n]:U.desc[U.max-1])}${c?` · ${costHTML(c)}`:" · Installed"}</span></div><span></span>${c?(canUp?`<button class="plain" data-act="shipup:${k}" ${canPay(c)?"":"disabled"}>Install</button>`:`<span class="risk">Leader only</span>`):`<span class="risk good">Done</span>`}</div>`; }).join("")}</div></div>
    <div class="panel h-card span12"><div class="chips">${tabs.map(([k,n])=>`<button data-act="fabtab:${k}" aria-pressed="${fabTab===k}">${n}</button>`).join("")}</div><div class="shop" style="margin-top:8px">${recipes}</div></div>
    <div class="panel h-card span12"><div class="h-eyebrow">Pack upgrades · +1 slot each, up to +3</div><div class="shop">${profile.stash.filter(q=>Items.kind(q)==="pack").map(q=>{ const l=q.l|0, c=Items.UPGRADE_COST(l);
      return `<div class="panel shop-row">${slotHTML(q)}<div class="nm">${nmHTML(q)}<span>+${Items.stats(q).slots} slots${l<3?` → +${Items.stats(q).slots+1} · ${costHTML(c)}`:" · fully upgraded"}</span></div><span></span><button class="plain" data-act="upg:${q.uid}" ${l<3&&canPay(c)?"":"disabled"}>${l<3?"Upgrade":"Maxed"}</button></div>`; }).join("")||`<p class="risk">No packs in your stash.</p>`}</div></div></section>`;
}
function viewBar(){ return viewBar0().replace(/<\/section>\s*$/,`<div class="panel h-card span12"><div class="h-eyebrow">Off duty</div><div class="bar-row"><button data-act="bones-open">Play Bones with Hesk</button><button class="plain" data-act="juke-open">Jukebox</button></div><p class="risk">Bones: three dice each, triples beat pairs beat the higher total. Hesk plays for credits.</p></div></section>`); }
function viewBar0(){
  const menu=Items.BAR.map(b=>`<div class="panel shop-row"><div class="slot" style="display:flex;align-items:center;justify-content:center;font-size:22px">${b.water>(b.food||0)?"🥤":"🍲"}</div><div class="nm"><b>${b.name}</b><span>${[b.food?`+${b.food} food`:"",b.water?`+${b.water} water`:""].filter(Boolean).join(" · ")}</span></div><span class="price">${b.price?b.price+" cr":"free"}</span><button class="plain" data-act="bareat:${b.id}" ${profile.credits<b.price?"disabled":""}>${b.water>(b.food||0)?"Drink":"Eat"}</button></div>`).join("");
  const togo=Items.BAR_TOGO.map(([d,price],i)=>{ const it={d,r:0}; return `<div class="panel shop-row">${slotHTML(it)}<div class="nm">${nmHTML(it)}<span>${esc(Items.statLine(it))} · ${ownedOf(it)} in stash</span></div><span class="price">${price} cr</span><button class="plain" data-act="bartogo:${i}" ${profile.credits<price?"disabled":""}>Buy</button></div>`; }).join("");
  return `<section class="h-grid"><div class="panel h-card span12"><div class="h-eyebrow">How you're holding up</div><div class="vit" style="display:grid;grid-template-columns:80px minmax(0,1fr) auto;gap:4px 8px;align-items:center;max-width:520px">${hungerRows(profile.food,profile.water)}</div>
      <p class="risk">Food and water drain on raids (and a little every day the ship travels). They go down slowly, so you only need to eat now and then. Above 60 of both, you slowly regain blood. Below 8, your aim suffers. At zero you slowly lose blood until you eat or drink.</p></div>
    <div class="panel h-card span6"><div class="h-eyebrow">Eat and drink here</div><div class="shop">${menu}</div></div>
    <div class="panel h-card span6"><div class="h-eyebrow">To go · for your pack</div><div class="shop">${togo}</div></div></section>`;
}
function dyeOpen(slot,id){ const o=Items.DYES[slot][id], r=slot==="cloak"?o[2]:o[1]; return r===0||profile.unlocks[slot].includes(id); }
const WARD_TAB=["Body","Face","Hair","Clothes","Armour"]; let wardTab="Body";
function viewWardrobe(){
  const ST=Items.STYLE, L=profile.look, lab=t=>t[0].toUpperCase()+t.slice(1);
  const col=(f,arr,lbl)=>`<div class="h-eyebrow">${lbl}</div><div class="swatches">${arr.map((c,i)=>`<button class="swatch" data-act="style:${f}:${i}" aria-pressed="${(L[f]|0)===i}" aria-label="${lbl} ${i+1}"><i style="background:${c}"></i></button>`).join("")}</div>`;
  const opt=(f,arr,lbl,names)=>`<div class="h-eyebrow">${lbl}</div><div class="chips">${arr.map((n,i)=>`<button data-act="style:${f}:${i}" aria-pressed="${(L[f]|0)===i}">${(names&&names[n])||lab(n)}</button>`).join("")}</div>`;
  const dye=(slot,label)=>`<div class="h-eyebrow">${label}</div><div class="swatches">${Object.entries(Items.DYES[slot]).map(([id,o])=>{ const open=dyeOpen(slot,id), r=slot==="cloak"?o[2]:o[1], c=slot==="cloak"?o[1]:slot==="visor"?o[0]:null;
      return `<button class="swatch" data-act="look:${slot}:${id}" aria-pressed="${L[slot[0]]===id}" ${open?"":"disabled"} title="${open?(slot==="crest"?o[0]:id):`Locked · find a ${Items.RAR[r].name.toLowerCase()} dye`}" style="${slot==="crest"?"width:auto;padding:0 10px":""}">${c?`<i style="background:${c}"></i>`:`<span style="font-size:12px">${o[0]}</span>`}${open?"":`<span class="lock" style="color:${Items.RAR[r].col}">■</span>`}</button>`; }).join("")}</div>`;
  const u=profile.unlocks, n=u.cloak.length+u.visor.length+u.crest.length;
  const body={
    Body:opt("g",ST.body,"Body")+col("s",ST.skin,"Skin tone")+`<p class="risk">Every hairstyle, face and outfit works with either body.</p>`,
    Face:opt("ey",ST.eyeShape,"Eye shape",{heavy:"Heavy-lidded"})+col("e",ST.eyes,"Eye colour")+opt("br",ST.brows,"Brows")+opt("no",ST.nose,"Nose")+opt("mo",ST.mouth,"Mouth")+opt("fm",ST.marks,"Marks",{none:"None",warpaint:"War paint"})+opt("au",ST.aug,"Cybernetics",{none:"None",cybereye:"Cyber eye",jawplate:"Jaw plate",faceplate:"Half faceplate",ocular:"Ocular array"})+opt("pc",ST.pierce,"Piercings",{none:"None",earrings:"Earrings",nosering:"Nose ring",browbar:"Brow bar"}),
    Hair:opt("h",ST.hair,"Hairstyle",{none:"Shaved",buzz:"Buzz cut",topknot:"Top knot",curly:"Curls",slick:"Slicked back",buns:"Twin buns",afro:"Afro",dreads:"Dreadlocks",sidecut:"Sidecut"})+col("hc",ST.hairCol,"Hair colour")+opt("fh",ST.facialHair,"Facial hair",{none:"Clean-shaven",shortbeard:"Short beard",fullbeard:"Full beard",chops:"Mutton chops"}),
    Clothes:opt("t",ST.top,"Top",{coverall:"Coverall",jacket:"Flight jacket",hivis:"Hi-vis vest",undersuit:"Vac undersuit",singlet:"Singlet & harness"})+col("tc",ST.cloth,"Top colour")+opt("b",ST.bottom,"Bottoms",{fatigues:"Cargo fatigues",workpants:"Work trousers",shorts:"Utility shorts"})+col("bc",ST.cloth,"Bottoms colour")+opt("bs",ST.boots,"Boots",{magboots:"Magboots",workboots:"Work boots",wraps:"Foot wraps"})+col("bt",ST.cloth,"Boot colour")+`<p class="risk">Coveralls and vac undersuits are one piece: they colour your legs too.</p>`,
    Armour:`<p>Helmets, chest pieces, legs and accessories all show on your character. Find them on derelicts or craft them at the workbench. Dyes colour your cape and scarf, tint visors and lenses, and crest the helms that take one.</p>${dye("cloak","Cape and scarf dye")}${dye("visor","Visor tint")}${dye("crest","Helmet attachment")}<p class="risk">${n} dye${n===1?"":"s"} found. Rarer dyes turn up on harder stations.</p>`,
  }[wardTab];
  return `<section class="panel h-card"><div class="lo"><div class="preview" style="gap:12px;flex-wrap:wrap"><div style="text-align:center"><canvas id="h-prev2" width="48" height="64" aria-label="You, out of armour" style="width:144px;height:192px;image-rendering:pixelated"></canvas><div class="risk">Clothes</div></div><div style="text-align:center"><canvas id="h-prev" width="48" height="64" aria-label="You in your kit" style="width:144px;height:192px"></canvas><div class="risk">In your kit</div></div></div>
    <div class="eq"><div class="seg">${WARD_TAB.map(t=>`<button data-act="wtab:${t}" aria-pressed="${wardTab===t}">${t}</button>`).join("")}</div>${body}</div></div></section>`;
}
// ---------- inventory (raid: live; ship: your kit) ----------
function hungerRows(f,w){ const m=(l,v,c)=>`<span class="lbl">${l}</span><div class="meter"><i style="width:${Math.max(0,Math.min(100,v))}%;background:${v<20?"var(--blood2)":c}"></i></div><span class="num">${Math.round(v)}${v<=0?' <span style="color:var(--blood2)">!</span>':""}</span>`; return m("Food",f,"#b08a4a")+m("Water",w,"#5a9ad0"); }
function limbRows(p){ return Sim.LIMBS.map(l=>{ const f=Math.max(0,p.hp[l]/p.max[l]);
  return `<span class="lbl">${Sim.LNAME[l]}</span><div class="meter"><i style="width:${f*100}%;background:${f<=0?"#262320":f>.66?"#4f7a46":f>.33?"#c79a4a":"#e0482f"}"></i></div><span class="num">${p.hp[l]}/${p.max[l]}${p.bleed[l]?' <span style="color:var(--blood2)">bleeding</span>':""}</span>`; }).join(""); }
// ---------- inventory: body + equipment on the left, pack grid on the right, pouches along the bottom ----------
const PACKABLE=["throw","med","key","food","tool"];
const EQ_LAYOUT=[["head","Helmet"],["acc","Trinket"],["w1","Primary"],["armor","Chest"],["w2","Secondary"],["light","Light"],["legs","Legs"],["melee","Melee"],["pack","Pack"]];
function roleOf(eq){ const d=k=>eq[k]&&eq[k].d; if(d("head")==="halohelm"||d("armor")==="aegis") return "Warlord"; if(d("armor")==="ossuary") return "Juggernaut";
  if(d("armor")==="shroud"||d("head")==="cowl") return "Stalker"; if(["sallet","deathmask","flakhelm"].includes(d("head"))||["flak","carrier"].includes(d("armor"))) return "Trooper";
  if(d("head")==="welder"||d("armor")==="scrapvest") return "Raider"; if(["hardsuit","suit"].includes(d("armor"))) return "Spacer"; if(!d("armor")&&!d("head")) return "Scavenger"; return "Mercenary"; }
function ivCell(it,src,o={}){ const sel=invSel===src, gun=it&&o.wide&&Items.slotOf(it)==="gun";
  return `<div class="iv-cell${o.wide?" wide":""}${sel?" sel":""}${o.locked?" locked":""}${!it?" empty":""}" ${it&&!o.fixed?`data-drag="${src}"`:""} ${o.drop?`data-drop="${o.drop}"`:""} ${it?`data-pick="${src}"`:""} title="${it?esc(Items.name(it)):o.label||""}" ${o.area?`style="grid-area:${o.area}"`:""}>
    ${it?`<img alt="" src="${gun?gunURL(it.d):iconFor(it)}">`:o.label?`<span class="iv-lbl">${o.label}</span>`:""}${o.badge!=null&&o.badge!==""?`<span class="iv-n">${o.badge}</span>`:""}${it?`<i class="iv-bar" style="background:${rc(it)}"></i>`:""}${it&&it.iss?`<span class="iv-iss">issued</span>`:""}${it&&it.sec?`<span class="iv-iss sec">secured</span>`:""}</div>`; }
function ivData(){ const raid=S&&S.mode==="raid";
  if(raid){ const p=me(); return {raid,p,eq:Object.fromEntries(KIT_SLOTS.map(k=>[k,p[k]])),pack:p.inv,cap:p.cap,ammo:p.ammo||{},mats:p.mats||{},starter:false}; }
  const r=kitResolved(); return {raid,r,eq:Object.fromEntries(KIT_SLOTS.map(k=>[k,r[k]])),pack:r.inv,cap:r.cap,ammo:r.ammo,mats:profile.mats,starter:r.free}; }
function ivItem(D,src){ const [k,key]=src.split(":"); if(k==="eq") return D.eq[key]; if(k==="inv") return D.raid?D.pack[+key]:byUid(key); if(k==="st") return byUid(key); return null; }
function ammoNote(D){ const held=AMMO_T.filter(t=>(profile.ammo[t]|0)>0).map(t=>`${Items.AMMO[t].name} ${profile.ammo[t]|0}`);
  if(!held.length) return `<div class="risk iv-ammo-note">No ammo in the hold. Craft it at the workbench or buy it from a trader.</div>`;
  return `<div class="risk iv-ammo-note">In the hold: ${held.join(" · ")}.${D.starter?" The free scav kit only carries its own 12 pistol rounds. Drag gear from your stash into your kit to pack hold ammo.":" Use + and − to pack it for the next raid."}</div>`; }
function viewInventory(){
  const D=ivData(), eq=D.eq, callsign=(typeof HB!=="undefined"&&HB.callsign&&HB.callsign())||"Contractor", tag=(hh(callsign.length,callsign.charCodeAt(0)||7,3)%0xffff).toString(16)+"-"+(1000+hh(3,callsign.length,9)%9000);
  const ammoOf=g=>{ const st=g&&Items.stats(g); return st&&st.ammo?((D.raid?D.ammo[st.ammo]:(D.ammo[st.ammo]||0))|0):""; };
  const eqHTML=EQ_LAYOUT.map(([k,lbl])=>{ const it=eq[k], wide=k==="w1"||k==="w2"||k==="melee";
    return ivCell(it,"eq:"+k,{wide,label:lbl,drop:"eq:"+k,area:k,fixed:D.starter,badge:wide&&k!=="melee"&&it?ammoOf(it):(k==="light"&&it&&D.raid&&D.p.lightOff?"off":"")}); }).join("");
  const used=D.pack.length, rows=Math.max(4,Math.ceil(D.cap/6)), cells=[];
  for(let i=0;i<rows*6;i++){ const it=D.pack[i], src=D.raid?"inv:"+i:it?"inv:"+it.uid:"";
    cells.push(i<D.cap?ivCell(it,src,{drop:"inv",badge:it&&it.n>1?it.n:""}):`<div class="iv-cell locked" data-drop="inv"></div>`); }
  const pouch=AMMO_T.map(t=>{ const n=D.ammo[t]|0, A=Items.AMMO[t];
      if(D.raid) return `<div class="iv-pouch" title="${A.name}"><img alt="" src="${iconFor({d:"ammo_"+t})}"><span>${n}</span></div>`;
      const hold=profile.ammo[t]|0; if(!hold&&!n) return `<div class="iv-pouch dim" title="${A.name}: none"><img alt="" src="${iconFor({d:"ammo_"+t})}"><span>0</span></div>`;
      return `<div class="iv-pouch ammo" title="${A.name}: ${n} packed, ${hold} in the hold"><img alt="" src="${iconFor({d:"ammo_"+t})}"><span>${n}<small>/${D.starter?n:hold}</small></span>${D.starter?"":`<button data-act="ammo:${t}:-1" aria-label="Pack less ${A.name}" ${n<=0?"disabled":""}>−</button><button data-act="ammo:${t}:1" aria-label="Pack more ${A.name}" ${n>=hold?"disabled":""}>+</button>`}</div>`; }).join("")
    +MAT_T.filter(t=>(D.mats[t]|0)>0).map(t=>`<div class="iv-pouch mat" title="${Items.MATS[t]}"><img alt="" src="${iconFor({d:t})}"><span>${D.mats[t]|0}</span></div>`).join("");
  const sil=`<svg class="iv-sil" viewBox="0 0 100 160" aria-hidden="true"><g fill="none" stroke="#7a1a12" stroke-width=".8" opacity=".7"><ellipse cx="50" cy="16" rx="10" ry="12"/><path d="M40 28 L60 28 L74 36 L80 74 L74 76 L68 46 L66 82 L64 120 L62 154 L52 154 L50 96 L48 154 L38 154 L36 120 L34 82 L32 46 L26 76 L20 74 L26 36 Z"/><path d="M42 40 L58 40 M40 56 L60 56 M42 72 L58 72" opacity=".5"/></g></svg>`;
  // details of the selected thing
  let det=""; const it=invSel?ivItem(D,invSel):null;
  if(it){ const [k,key]=invSel.split(":"), kind=Items.kind(it), btns=[];
    if(D.raid){ const p=D.p;
      if(k==="inv"){ if(kind==="throw") btns.push(`<button class="plain" data-act="ithrow:${key}">Throw</button>`); else if(Items.slotOf(it)) btns.push(`<button class="plain" data-act="iequip:${key}">Equip</button>`); else if(kind==="med"||kind==="food") btns.push(`<button class="plain" data-act="iuse:${key}">${kind==="food"?((Items.def(it.d).water||0)>(Items.def(it.d).food||0)?"Drink":"Eat"):"Use"}</button>`);
        btns.push(`<button class="plain" data-act="isec:${key}">${it.sec?"Unsecure":"Secure"}</button>`);
        btns.push(`<button class="plain" data-act="idrop:${key}">Drop</button>`);
        for(const q of S.ents) if(q.kind==="player"&&q.id!==PID&&q.alive&&Math.abs(q.x-p.x)+Math.abs(q.y-p.y)<=1) btns.push(`<button class="plain" data-act="igive:${key}:${q.id}">Give to ${esc(typeof nameOf==="function"?nameOf(q.id):"crew")}</button>`); }
      if(k==="eq"){ btns.push(`<button class="plain" data-act="iunequip:${key}">Stow in pack</button>`); if(key==="light") btns.push(`<button class="plain" data-act="ilight">${p.lightOff?"Turn on":"Turn off"}</button>`); if((key==="w1"||key==="w2")&&p.w1&&p.w2) btns.push(`<button class="plain" data-act="iswap">Make active</button>`); } }
    else { if(k==="st"){ if(Items.slotOf(it)) btns.push(`<button class="plain" data-act="equipitem:${key}">Equip</button>`); if(PACKABLE.includes(kind)) btns.push(`<button class="plain" data-act="invadd:${key}">Pack it</button>`); if(kind==="food") btns.push(`<button class="plain" data-act="consume:${key}">Eat now</button>`); }
      if(k==="inv") btns.push(`<button class="plain" data-act="invrm:${key}">Unpack</button>`);
      if(k==="eq"&&!D.starter) btns.push(`<button class="plain" data-act="unslot:${key}">Unequip</button>`); }
    det=`<div class="iv-det"><div class="iv-det-icon">${slotHTML(it)}</div><div class="grow"><b style="color:${rc(it)}">${esc(Items.name(it))}</b> <span class="rar" style="color:${rc(it)}">${Items.RAR[Items.rarOf(it)].name}</span><div class="risk">${esc(Items.statLine(it))}</div><div class="risk">${esc(Items.def(it.d).desc||"")}</div></div><div class="iv-det-btns">${btns.join("")}</div></div>`; }
  else det=`<div class="iv-det hint">${mode==="pc"?"Drag items between your pack and your body to equip or stow them. Click an item for options.":"Drag items onto your body to equip them, or tap one for options."}${D.starter?" You're on the free scav kit: drag anything from your stash to start a custom kit.":""}</div>`;
  const stash=D.raid?"":(()=>{ const inKit=new Set([...KIT_SLOTS.map(k=>eq[k]&&eq[k].uid),...D.pack.map(i=>i.uid)].filter(Boolean)), list=profile.stash.filter(q=>!inKit.has(q.uid)).sort((a,b)=>Items.rarOf(b)-Items.rarOf(a));
    return `<div class="iv-sec"><span>Stash · ${list.length} items</span><span class="risk">drag into your kit</span></div><div class="iv-grid stash" data-drop="st">${list.map(q=>ivCell(q,"st:"+q.uid,{drop:"st"})).join("")||`<span class="risk">Your stash is empty.</span>`}</div>`; })();
  const cond=D.raid?`<div class="iv-cond">${figHTML(D.p).replace(/^/,'<div class="fig">')+"</div>"}<div class="iv-cond-m">${hungerRows(D.p.food,D.p.water)}<span class="lbl">Blood</span><div class="meter"><i style="width:${Math.max(0,D.p.blood)}%;background:var(--blood2)"></i></div><span class="num">${Math.max(0,D.p.blood)}</span><span class="lbl">O₂</span><div class="meter"><i style="width:${D.p.o2/(D.p.o2max||100)*100}%;background:var(--cold)"></i></div><span class="num">${D.p.o2}</span></div></div>`
    :`<div class="iv-cond"><div class="iv-cond-m">${hungerRows(profile.food,profile.water)}</div></div>`;
  return `<section class="iv">
    <div class="iv-head"><span>Inventory</span><span class="risk">${D.raid?"in the field":D.starter?"scav kit · free":`kit at risk: ${kitRisk(D.r)} cr`}</span></div>
    <div class="iv-main">
      <div class="iv-body">${sil}<div class="iv-id"><span>${esc(tag)}</span><b>${esc(callsign)}</b><em>${titleOf()?esc(titleOf())+" · ":""}${roleOf(eq)}</em></div><div class="iv-eq">${eqHTML}</div><div class="iv-load">Load ${used}/${D.cap}${D.raid?` · Secure ${D.pack.filter(i=>i.sec).length}/${D.p.secCap|0}`:""}</div></div>
      <div class="iv-right"><div class="iv-grid" data-drop="inv">${cells.join("")}</div><div class="iv-pouches">${pouch}</div>${D.raid?"":ammoNote(D)}${cond}</div>
    </div>${det}${stash}</section>`;
}
// drag and drop (mouse and touch). Small movement = a tap that selects.
function ivMove(src,dst){ const D=ivData(), it=ivItem(D,src); if(!it||!dst||src===dst) return; const [sk,skey]=src.split(":"), [dk,dkey]=dst.split(":");
  if(D.raid){
    if(sk==="inv"&&dk==="eq"){ if(!slotFits(dkey,it)){ toast("That doesn't go there."); return; } send({type:"equip",index:+skey,slot:dkey}); }
    else if(sk==="eq"&&(dk==="inv")) send({type:"unequip",slot:skey});
    else if(sk==="eq"&&dk==="eq"&&skey!==dkey&&slotFits(dkey,it)){ send({type:"unequip",slot:skey}); const i=me().inv.length-1; if(me().inv[i]) send({type:"equip",index:i,slot:dkey}); }
    invSel=null; return; }
  const k=profile.kit; if(k.type!=="custom"){ k.type="custom"; toast("Started a custom kit from your stash."); }
  const uid=it.uid; if(!uid) return;
  const clear=()=>{ for(const s2 of KIT_SLOTS) if(k[s2]===uid) k[s2]=null; k.inv=k.inv.filter(u=>u!==uid); };
  if(dk==="eq"){ if(!slotFits(dkey,it)){ toast("That doesn't go there."); return; } clear(); k[dkey]=uid; }
  else if(dk==="inv"){ if(!PACKABLE.includes(Items.kind(it))){ toast("Only supplies go in the pack: meds, food, throwables."); return; } const r=kitResolved(); if(r.inv.length>=r.cap&&!k.inv.includes(uid)){ toast("Your pack is full."); return; } clear(); k.inv.push(uid); }
  else if(dk==="st") clear();
  invSel=null; save(); refreshLook(); renderPanel(); }
(()=>{ const body=$("p-body"); let drag=null;
  body.addEventListener("pointerdown",e=>{ const c=e.target.closest("[data-pick]"); if(!c||panelKind!=="inventory") return; drag={src:c.dataset.drag||null,pick:c.dataset.pick,x:e.clientX,y:e.clientY,ghost:null,el:c}; });
  window.addEventListener("pointermove",e=>{ if(!drag||!drag.src) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    if(!drag.ghost&&Math.hypot(dx,dy)>7){ const img=drag.el.querySelector("img"); drag.ghost=document.createElement("div"); drag.ghost.className="iv-ghost"; if(img) drag.ghost.appendChild(img.cloneNode()); document.body.appendChild(drag.ghost); drag.el.classList.add("dragging"); }
    if(drag.ghost){ e.preventDefault(); drag.ghost.style.left=e.clientX+"px"; drag.ghost.style.top=e.clientY+"px";
      document.querySelectorAll(".iv .over").forEach(n=>n.classList.remove("over")); drag.ghost.style.display="none"; const t=document.elementFromPoint(e.clientX,e.clientY); drag.ghost.style.display=""; const d=t&&t.closest("[data-drop]"); if(d) d.classList.add("over"); } },{passive:false});
  window.addEventListener("pointerup",e=>{ if(!drag) return; const d0=drag; drag=null;
    if(d0.ghost){ d0.ghost.remove(); d0.el.classList.remove("dragging"); const t=document.elementFromPoint(e.clientX,e.clientY), d=t&&t.closest("[data-drop]"); if(d) ivMove(d0.src,d.dataset.drop); else renderPanel(); return; }
    invSel=invSel===d0.pick?null:d0.pick; renderPanel(); });
})();
// ---------- skills: XP from every raid buys perks ----------
const PERKS={
  marksman:{name:"Marksman",max:3,desc:"+4% to hit per rank with every gun."},
  ghost:{name:"Ghost",max:2,desc:"+1 stealth per rank. Your shots carry less far."},
  medic:{name:"Field medic",max:2,desc:"Bandages also heal; trauma kits heal more. Rank 2 halves infection risk."},
  silver:{name:"Silver tongue",max:3,desc:"+10% per rank to talk raiders round: truces, surrenders, trades."},
  mule:{name:"Pack mule",max:2,desc:"+1 pack slot per rank."},
  tough:{name:"Hard to kill",max:2,desc:"+12% health on every limb per rank."},
  scavenger:{name:"Scavenger",max:2,desc:"30% per rank to find an extra item in each container."},
  steady:{name:"Iron stance",max:1,desc:"Brutes can't knock you down. Bones break half as often."},
};
const xpFor=l=>60*l*(l+1);
const levelOf=xp=>{ let l=0; while(xpFor(l+1)<=(xp|0)) l++; return l; };
const perkPoints=()=>levelOf(profile.xp)-Object.values(profile.perks||{}).reduce((a,n)=>a+(n|0),0);
// cybernetic implants: permanent upgrades from the ship's surgeon. Three fit in one body
const IMPLANTS={
  ocular:{name:"Ocular implant",d:"See one tile further, lit or dark.",cost:{credits:900,circ:4,core:1}},
  dermal:{name:"Dermal plating",d:"Sub-skin armour: 10% less damage from everything.",cost:{credits:1100,parts:4,scrap:6}},
  lungs:{name:"Lung sacs",d:"+30 oxygen. Breathe longer on dead decks.",cost:{credits:700,org:4,circ:2}},
  adrenal:{name:"Adrenal gland",d:"Stims last 15 turns instead of 10 and restore more blood.",cost:{credits:800,org:5,core:1}},
  clot:{name:"Clotting factor",d:"Your blood seals wounds: bleeds often stop on their own.",cost:{credits:950,org:6,circ:2}},
  reflex:{name:"Reflex booster",d:"+4% to hit, and husks miss you more often.",cost:{credits:1200,circ:5,core:1}},
};
const IMP_MAX=3;
function viewImplants(){ const n=Object.keys(profile.implants).length;
  return `<div class="panel h-card span12"><div class="h-eyebrow">Cybernetics · ${n}/${IMP_MAX} fitted</div><p class="risk">The ship's surgeon can wire up to three implants into you. They're permanent and come on every raid. Ripping one out is free but you don't get the parts back.</p><div class="h-grid">`+
    Object.entries(IMPLANTS).map(([k,I])=>{ const has=!!profile.implants[k], ok=canPay(I.cost)&&n<IMP_MAX;
      return `<div class="panel h-card span6 perk ${has?"got":""}"><div class="bar-row"><div class="grow"><b>${I.name}</b>${has?' <span style="color:var(--brass)">· fitted</span>':""}<p class="risk">${I.d}</p>${has?"":`<p class="risk">${costHTML(I.cost)}</p>`}</div>${has?`<button class="plain" data-act="unimplant:${k}">Remove</button>`:`<button data-act="implant:${k}" ${ok?"":"disabled"}>Install</button>`}</div></div>`; }).join("")+`</div></div>`; }
function viewSkills(){ return viewSkills0().replace(/<\/section>\s*$/,viewImplants()+"</section>"); }
function viewSkills0(){ const xp=profile.xp|0, L=levelOf(xp), a=xpFor(L), b=xpFor(L+1), pts=perkPoints(), I=profile.injury||{frac:{},inf:0};
  const inj=[...Object.keys(I.frac||{}).map(l=>`Broken ${Sim.LNAME[l]}`),...(I.inf?["Infected wound"]:[])];
  const has=d=>profile.stash.find(q=>q.d===d);
  return `<section class="h-grid"><div class="panel h-card span12"><div class="bar-row"><div class="grow"><div class="h-eyebrow">Level ${L}</div><div class="meter" style="height:8px;margin:6px 0"><i style="width:${Math.round((xp-a)/(b-a)*100)}%;background:var(--brass)"></i></div><p class="risk">${xp} XP · ${b-xp} to level ${L+1}. You earn XP for kills, searches, talking crews down, contracts and getting out alive. Dying keeps half.</p></div><div class="stat panel"><b>${pts}</b><span>perk point${pts===1?"":"s"}</span></div></div></div>
    ${Object.entries(PERKS).map(([k,P])=>{ const n=profile.perks[k]|0; return `<div class="panel h-card span6 perk"><div class="bar-row"><div class="grow"><b>${P.name}</b> <span class="pips">${"◆".repeat(n)}${"◇".repeat(P.max-n)}</span><p class="risk">${P.desc}</p></div><button class="plain" data-act="perk:${k}" ${pts<1||n>=P.max?"disabled":""}>${n>=P.max?"Mastered":"Learn"}</button></div></div>`; }).join("")}
    <div class="panel h-card span12"><div class="h-eyebrow">Injuries</div>${inj.length?`<p>${inj.join(" · ")}. These come with you into the next raid until they're treated.</p><div class="bar-row">${Object.keys(I.frac||{}).length?`<button class="plain" data-act="treat:splint" ${has("splint")?"":"disabled"}>Splint from stash</button>`:""}${I.inf?`<button class="plain" data-act="treat:antibiotic" ${has("antibiotic")?"":"disabled"}>Antibiotics from stash</button>`:""}</div><p class="risk">A medbay upgrade on the ship treats these automatically when you get back.</p>`:`<p class="risk">None. You're fit to fly.</p>`}</div></section>`; }
// ---------- logbook: weekly bounties, medals with titles, the codex ----------
const BOUNTIES=[
  {id:"nest",t:"Burn them out",d:"Destroy {n} husk nests",n:2,k:"nest",cr:450,xp:100},
  {id:"elite",t:"Mutant cull",d:"Kill {n} mutated husks",n:3,k:"elite",cr:500,xp:110},{id:"disarm",t:"Sapper",d:"Disarm {n} tripwires",n:3,s:"disarms",cr:350,xp:80},
  {id:"vent",t:"Rat runs",d:"Crawl through {n} vents",n:4,s:"vents",cr:300,xp:60},{id:"daily",t:"Op runner",d:"Complete {n} Daily Ops",n:2,x:"daily",cr:600,xp:140},
  {id:"stalker",t:"Thin the packs",d:"Kill {n} stalkers",n:8,k:"stalker",cr:350,xp:70},{id:"brute",t:"Big game",d:"Kill {n} brutes",n:3,k:"brute",cr:450,xp:90},
  {id:"spitter",t:"Acid test",d:"Kill {n} spitters",n:5,k:"spitter",cr:350,xp:70},{id:"husk",t:"Pest control",d:"Kill {n} husks",n:25,k:"husk",cr:300,xp:60},
  {id:"raider",t:"Hostile takeover",d:"Kill {n} raiders",n:5,k:"raider",cr:500,xp:100},{id:"bot",t:"Scrap metal",d:"Destroy {n} turrets or drones",n:4,k:"bot",cr:400,xp:80},
  {id:"take",t:"Quiet professional",d:"Make {n} silent takedowns",n:3,s:"takedowns",cr:450,xp:100},{id:"search",t:"Thorough",d:"Search {n} containers",n:20,s:"searches",cr:300,xp:60},
  {id:"cache",t:"Treasure hunter",d:"Find {n} hidden caches",n:2,s:"caches",cr:450,xp:90},{id:"hack",t:"Netrunner",d:"Hack {n} terminals",n:2,s:"hacks",cr:350,xp:70},
  {id:"haul",t:"Heavy pockets",d:"Extract with a haul worth 1500+ cr",n:1,x:"haul",cr:600,xp:120},{id:"signal",t:"Signal chaser",d:"Extract from {n} signals",n:2,x:"signal",cr:500,xp:100},
  {id:"job",t:"For hire",d:"Finish {n} faction jobs",n:2,x:"job",cr:550,xp:110},{id:"leader",t:"Headhunter",d:"Kill a named job target",n:1,k:"leader",cr:600,xp:120},
];
const MEDALS=[
  {id:"first",t:"First Out",title:"Survivor",d:"Extract for the first time."},{id:"ten",t:"Ten Times Lucky",title:"Old Hand",d:"Extract 10 times."},
  {id:"ghost",t:"Ghost",title:"Ghost",d:"Make 10 silent takedowns."},{id:"queen",t:"Queen Slayer",title:"Queen Slayer",d:"Kill a Matriarch and get out."},
  {id:"rich",t:"Deep Pockets",title:"Magnate",d:"Extract with a haul worth 2000+ cr."},{id:"wander",t:"Far Wanderer",title:"Wanderer",d:"Raid in all three regions."},
  {id:"signals",t:"Signal Hunter",title:"Scavenger King",d:"Strip and escape 5 signals."},{id:"net",t:"Netrunner",title:"Netrunner",d:"Hack 5 terminals."},
  {id:"caches",t:"Treasure Hunter",title:"Treasure Hunter",d:"Find 10 hidden caches."},{id:"archive",t:"Archivist",title:"Archivist",d:"Collect 12 data logs."},
  {id:"warden",t:"Warden",title:"Warden",d:"Bring home 3 prisoners."},{id:"ally",t:"Diplomat",title:"Diplomat",d:"Become Allied with any faction."},
  {id:"choir",t:"Song Breaker",title:"Song Breaker",d:"Finish a job against the Iron Choir."},{id:"throne",t:"Iron Heart",title:"Thronebreaker",d:"Get out of the Throne of Iron alive."},
  {id:"giant",t:"Giant Killer",title:"Giant Killer",d:"Destroy a Custodian and get out."},{id:"law",t:"Lawbringer",title:"Lawbringer",d:"Collect 3 Concord wanted bounties."},
  {id:"vengeance",t:"Vengeance",title:"Avenger",d:"Kill your nemesis."},{id:"exterm",t:"Exterminator",title:"Exterminator",d:"Destroy 10 husk nests."},
  {id:"chrome",t:"Chromed",title:"Chrome",d:"Fit three cybernetic implants."},{id:"arcade",t:"High Score",title:"Void Runner",d:"Score 1500 in VOID RUNNER."},
  {id:"mutant",t:"Mutant Hunter",title:"Mutant Hunter",d:"Kill 10 mutated husks."},{id:"sapper",t:"Sapper",title:"Sapper",d:"Disarm 10 tripwires."},
  {id:"dailies",t:"Op Runner",title:"Op Runner",d:"Complete 5 Daily Ops."},{id:"master",t:"Weapon Master",title:"Master",d:"Reach Master with any weapon class."},
  {id:"melt",t:"Out of the Fire",title:"Daredevil",d:"Extract during a reactor meltdown."},{id:"legend",t:"Legend",title:"Legend",d:"Own a legendary item."},
];
function bountyWeek(){ const wk=Math.floor((ship().day|0)/7); let B=profile.bounty; if(!B||B.week!==wk){ let h=(wk*2654435761+1013904223)>>>0; const pool=BOUNTIES.slice(), list=[]; while(list.length<3&&pool.length){ h=(h*1103515245+12345)>>>0; const b=pool.splice(h%pool.length,1)[0]; list.push({id:b.id,prog:0,claimed:false}); } B=profile.bounty={week:wk,list}; } return B; }
let logTab="bounties";
function viewLogbook(){ const B=bountyWeek(), daysLeft=7-((ship().day|0)%7), tabs=[["bounties","Bounties"],["medals","Medals"],["mastery","Mastery"],["bestiary","Bestiary"],["codex","Codex"],["stats","Service record"]];
  let body="";
  if(logTab==="bounties") body=(()=>{ const W=wantedWeek(); return `<div class="wanted-row">${W.list.map(q=>{ const S0=World.SECTORS.find(z=>z.id===q.sector); return `<div class="poster ${W.claimed[q.id]?"got":""}"><div class="pw">WANTED</div><b>${esc(q.name)}</b><span>${esc(Sim.FACTIONS[q.fac].name)}</span><span>Last seen: ${esc(S0?S0.name:q.sector)}</span><div class="pr">${W.claimed[q.id]?"COLLECTED":`${q.reward} cr`}</div></div>`; }).join("")}</div><p class="risk">Concord Marshals' wanted list, new every week. Raid derelicts in their sector and you might run into them. Kill them and get out alive to collect.</p>`; })()+(profile.nemesis?`<div class="recap nem"><div class="h-eyebrow" style="color:var(--blood2)">Nemesis · level ${profile.nemesis.lvl}</div><p><b>${esc(profile.nemesis.name)}</b> of the ${esc(Sim.FACTIONS[profile.nemesis.fac].name)} is hunting you${profile.nemesis.items&&profile.nemesis.items.length?`, carrying your ${profile.nemesis.items.map(it=>esc(Items.name(it))).join(", ")}`:""}. They turn up on about 40% of your raids (every Daily Op).</p></div>`:"")+`<p class="risk">New bounties every 7 days (${daysLeft} day${daysLeft>1?"s":""} left). Progress only counts on raids you get out of alive.</p>`+B.list.map(q=>{ const b=BOUNTIES.find(x=>x.id===q.id); if(!b) return ""; const done=q.prog>=b.n;
      return `<div class="cm-row"><div class="cm-t"><b>${b.t}</b><span>${b.d.replace("{n}",b.n)} · ${Math.min(q.prog,b.n)}/${b.n}</span><div class="meter" style="height:5px;margin-top:3px"><i style="width:${Math.min(100,q.prog/b.n*100)}%;background:var(--brass)"></i></div></div>${q.claimed?`<span class="risk good">Claimed</span>`:done?`<button class="plain" data-act="bclaim:${q.id}">Claim ${b.cr} cr</button>`:`<span class="risk">${b.cr} cr · ${b.xp} XP</span>`}</div>`; }).join("");
  if(logTab==="medals"){ const got=MEDALS.filter(m=>profile.medals[m.id]).length; body=`<p class="risk">${got}/${MEDALS.length} medals. Each one unlocks a title to wear and hangs a trophy on your ship's corridor wall.</p><div class="medals">${MEDALS.map(m=>{ const has=profile.medals[m.id];
      return `<div class="medal ${has?"got":""}"><i>${has?"✦":"✧"}</i><div><b>${m.t}</b><span>${m.d}</span>${has?`<button class="plain" data-act="title:${m.id}" ${profile.title===m.id?"disabled":""}>${profile.title===m.id?"Wearing":"Wear title: "+m.title}</button>`:""}</div></div>`; }).join("")}</div>${profile.title?`<button class="plain" data-act="title:none">Remove title</button>`:""}`; }
  if(logTab==="codex"){ const L=Items.LOGS, got=L.filter(l=>profile.codex[l.id]); body=`<p class="risk">${got.length}/${L.length} logs recovered. Data logs turn up in lockers, shelves and crates; extract with them (or seal them in your pouch) to file them here.</p>`+
      (got.length?got.map(l=>`<details class="codex"><summary>${esc(l.t)}</summary><p>${esc(l.x)}</p></details>`).join(""):`<p class="risk">Nothing yet.</p>`); }
  if(logTab==="stats") body=`<div class="bar-row" style="margin-bottom:8px"><input id="ship-nm" maxlength="24" value="${esc(ship().name||"Ninefold Lark")}" style="flex:1;min-width:0" aria-label="Ship name"><button data-act="rename">Rename ship</button></div>`+viewRecords()+viewRecords0();
  if(logTab==="bestiary") body=viewBestiary();
  if(logTab==="mastery") body=`<p class="risk">Every kill with a class of weapon counts toward mastering it, even on raids you don't survive. Levels at ${MAST_T.slice(1).join(", ")} kills.</p>`+MAST_C.map(([c,n])=>{ const k=profile.mastery[c]|0, l=mastLvl(k), nx=MAST_T[l+1], pc=nx?Math.round((k-MAST_T[l])/(nx-MAST_T[l])*100):100;
      return `<div class="cm-row"><div class="cm-t"><b>${n} · ${MAST_N[l]}</b><span>${k} kill${k===1?"":"s"}${nx?` · ${nx-k} to ${MAST_N[l+1]}`:" · mastered"} · ${mastBonus(c,l)}</span><div class="meter" style="height:5px;margin-top:3px"><i style="width:${pc}%"></i></div></div></div>`; }).join("");
  return `<section class="panel h-card"><div class="chips">${tabs.map(([k,n])=>`<button data-act="logtab:${k}" aria-pressed="${logTab===k}">${n}</button>`).join("")}</div><div style="margin-top:8px">${body}</div></section>`; }
const titleOf=()=>{ const m=MEDALS.find(x=>x.id===profile.title); return m?m.title:null; };
const BEAST=[["husk","Husk","The crews that heard the song. Slow, relentless, and their claws carry infection."],["stalker","Stalker","Fast and fragile. Hunts in packs and uses the vents."],["spitter","Spitter","Spits burning acid from six tiles. Close in or break line of sight."],["brute","Brute","Armoured, smashes doors, hits hard enough to knock you flat. Slow."],["bloater","Bloater","Swollen with rot. Bursts into a toxic cloud when it dies."],["elite","Mutated husk","Armored, volatile, swift, regenerating, venomous or shrieking. Double trouble, double XP."],["nest","Husk nest","Births stalkers while anything living is near. Burn it."],["matriarch","The Matriarch","The nest's queen. Her roar staggers you and calls stalkers out of the walls."],["raider","Raider","Other scavengers. Some trade, some shoot first. They only see as far as you do."],["bot","Security unit","Turrets and drones. Shut them down at a security terminal."],["custodian","The Custodian","A security mech with burst fire, crushing fists and rocket salvos. Leave the red circles."]];
function viewBestiary(){ const K=(profile.life&&profile.life.k)||{}, seen=BEAST.filter(([k])=>(K[k]|0)>0).length;
  return `<p class="risk">${seen}/${BEAST.length} known. Entries unlock when you kill one and get out alive.</p><div class="h-grid">`+BEAST.map(([k,n,d])=>{ const c=K[k]|0; return `<div class="panel h-card span6 perk ${c?"":"locked"}"><b>${c?n:"???"}</b>${c?` <span style="color:var(--brass)">· ${c} killed</span>`:""}<p class="risk">${c?d:"Nothing known yet."}</p></div>`; }).join("")+`</div>`; }
function viewRecords(){ const R0=profile.records||{}, row=(k,l,f)=>`<div class="cm-row"><div class="cm-t"><b>${l}</b><span>${R0[k]!=null?f(R0[k]):"none yet"}</span></div></div>`;
  return `<div class="panel h-card" style="margin-bottom:8px"><div class="h-eyebrow">Personal records</div>${row("haul","Biggest haul",v=>`${v} cr`)}${row("fast","Fastest extraction",v=>`${v} turns`)}${row("kills","Most kills in one raid",v=>v)}${row("streak","Longest kill streak",v=>v)}${row("dealt","Most damage in one raid",v=>v)}</div>`; }
function viewRecords0(){ const s=profile.stats, rate=s.raids?Math.round(s.extracts/s.raids*100):0;
  return `<div class="stats">${[["Raids",s.raids],["Extracted",s.extracts],["Lost",s.deaths],["Survival",rate+"%"],["Contracts done",s.contracts],["Salvage value",s.earned+" cr"],["Best haul",s.best+" cr"],["Ship day",ship().day]].map(([a,b])=>`<div class="panel stat"><b>${b}</b><span>${a}</span></div>`).join("")}</div>`; }
function contractRow(id,btn){ const C=World.CONTRACTS[id], site=World.loc(C.site), giver=World.NPCS[C.giver];
  return `<div class="panel contract-row"><div><b>${C.title}</b><br><span>${C.brief} · ${site.name}, ${World.SECTORS.find(s=>s.id===site.sector).name} · from ${giver.name}</span></div><div style="text-align:right"><div class="pay">${C.reward} cr</div>${btn||""}</div></div>`; }
function viewBoard(){ const sh=ship();
  return `<section class="h-grid"><div class="panel h-card span7"><div class="h-eyebrow">Active · ${sh.contracts.length}/3</div>
      ${sh.contracts.length?sh.contracts.map(id=>contractRow(id,`<button class="plain" data-act="drop:${id}">${armed["drop:"+id]?"Confirm drop":"Drop"}</button>`)).join(""):`<p class="risk">No contracts. Dock at a station or outpost and talk to a contract giver through the airlock.</p>`}
      <p class="risk">Fly to the target, board it from the airlock, and extract with its black box. The reward is paid to everyone in the crew.</p>
      <div class="h-eyebrow" style="margin-top:10px">Faction jobs · ${(sh.jobs||[]).length}/3</div>${(sh.jobs||[]).map(j=>{ const F=Sim.FACTIONS[j.fac]; return `<div class="cm-row"><div class="cm-t"><b style="color:${F.col}">${esc(j.title)}</b><span>${esc(F.name)} · ${World.loc(j.site).name} · ${j.reward} cr</span></div><button class="plain" data-act="dropjob:${j.id}">Drop</button></div>`; }).join("")||`<p class="risk">None. Call a faction on the bridge hologram to find work.</p>`}</div>
    <div class="panel h-card span5"><div class="h-eyebrow">Completed</div>${sh.done.length?sh.done.map(id=>`<div class="risk">✓ ${World.CONTRACTS[id].title} · ${World.CONTRACTS[id].reward} cr</div>`).join(""):`<p class="risk">None yet.</p>`}</div></section>`; }
function viewAirlock(){
  const L=here();
  if(L.type==="derelict") return viewDeploy(L);
  if(panelSub&&panelSub.startsWith("npc:")) return viewNpc(L,panelSub.slice(4));
  const sh=ship();
  return `<section class="h-grid"><div class="panel h-card span12"><p>${L.desc}</p>
      ${L.fuel?`<div class="bar-row"><span class="risk grow">Fuel ${sh.fuel}/${sh.fuelMax} · ${L.fuel} cr per unit</span><button class="plain" data-act="refuel" ${sh.fuel>=sh.fuelMax?"disabled":""}>${sh.fuel>=sh.fuelMax?"Tanks full":`Refuel · ${Math.min(sh.fuelMax-sh.fuel,Math.floor(profile.credits/L.fuel))*L.fuel} cr`}</button></div>`:""}</div>
    <div class="span12 npcs">${L.npcs.map(id=>{ const N=World.NPCS[id]; return `<div class="panel npc"><img alt="" src="${portrait(N.look)}"><div><div class="role">${N.role}</div><b>${N.name}</b><q>${N.line}</q>
      <div class="bar-row">${N.shop?`<button class="plain" data-act="npc:${id}">Trade</button>`:""}${N.contracts?`<button class="plain" data-act="npc:${id}">Contracts</button>`:""}</div></div></div>`; }).join("")}</div></section>`;
}
function ownedOf(spec){ const D=Items.def(spec.d); if(!D) return 0; if(D.k==="ammo") return profile.ammo[D.ammo]|0; if(D.k==="mat") return profile.mats[spec.d]|0; return profile.stash.filter(q=>q.d===spec.d).length; }
function viewNpc(L,id){
  const N=World.NPCS[id], sh=ship(), back=`<button class="plain" data-act="back">← ${L.name}</button>`;
  const head=`<div class="panel npc span12"><img alt="" src="${portrait(N.look)}"><div><div class="role">${N.role}</div><b>${N.name}</b><q>${N.line}</q>${back}</div></div>`;
  if(N.contracts){ const offers=N.contracts.map(cid=>{ const done=sh.done.includes(cid), have=sh.contracts.includes(cid);
      const fb=(sh.failed||{})[cid], wait=fb&&fb>(sh.day|0)?fb-(sh.day|0):0;
      return contractRow(cid,done?`<span class="risk good">Completed</span>`:have?`<span class="risk good">Accepted</span>`:wait?`<span class="risk bad">Failed · back in ${wait} day${wait>1?"s":""}</span>`:`<button class="plain" data-act="accept:${cid}" ${sh.contracts.length>=3?"disabled":""}>Accept</button>`); }).join("");
    return `<section class="h-grid">${head}<div class="panel h-card span12"><div class="h-eyebrow">Work on offer</div>${offers}</div></section>`; }
  const stock=N.shop.stock.map(([spec,price],i)=>{ const it={r:0,...spec};
      return `<div class="panel shop-row">${slotHTML(it)}<div class="nm">${nmHTML(it)}<span>${esc(Items.statLine(it)||Items.def(it.d).desc||"")} · ${ownedOf(it)} owned</span></div><span class="price">${price} cr</span><button class="plain" data-act="buy:${id}:${i}" ${profile.credits<price?"disabled":""}>Buy</button></div>`; }).join("");
  const sells=profile.stash.map(q=>{ const I=itemInfo(q), v=Math.round(Items.value(q)*.5*N.shop.sell), key="sell:"+q.uid;
      return `<div class="panel shop-row">${slotHTML(q)}<div class="nm">${nmHTML(q)}<span>${I.rarName} · ${I.cat}</span></div><span class="price">${v} cr</span><button class="plain" data-act="sell:${id}:${q.uid}">${armed[key]?"Confirm":"Sell"}</button></div>`; }).join("");
  return `<section class="h-grid">${head}<div class="panel h-card span6"><div class="h-eyebrow">Buy</div><div class="shop">${stock}</div></div>
    <div class="panel h-card span6"><div class="h-eyebrow">Sell from your stash${N.shop.sell!==1?` · pays ×${N.shop.sell}`:""}</div><div class="shop">${sells||`<p class="risk">Your stash is empty.</p>`}</div></div></section>`;
}
function viewDeploy(L){
  const r=kitResolved(), risk=kitRisk(r), cid=World.siteContract(ship(),L.id), C=cid&&World.CONTRACTS[cid], m=L.site.mods;
  const KN={relay:"Comms relay",mining:"Mining barge",hospital:"Hospital ship",fortress:"Reaver fortress",hive:"Choir hive",outpost:"Marshal outpost",research:"Research platform",freighter:"Freighter",colony:"Colony ship"};
  const tags=[KN[L.site.kind]||"",`Threat ${"▲".repeat(L.site.tier||1)}`,m.power===false?"No power":"Power on",m.fires?`${m.fires} fires`:"",m.huskAdd?"Extra husks":"",m.huskDrop?"Fewer husks":"",m.loot>1?`Salvage ×${m.loot}`:"",L.id==="ks9"?"Fire in cargo":""].filter(Boolean);
  siteSeed(L); const rm=profile.remains&&profile.remains.site===L.id&&(ship().day|0)-(profile.remains.day|0)<=6?profile.remains:null;
  const notes=[rm?`<p class="risk good">Your body is still aboard: ${rm.items.length} item${rm.items.length>1?"s":""}, ${(ship().day|0)-(rm.day|0)} day${(ship().day|0)-(rm.day|0)===1?"":"s"} old. Scavengers pick at it every day.</p>`:"",
    !(profile.gifts||{})[GIFT_SG]?`<p class="risk good">Delivered for this run: a pump-action shotgun (Mk II) and 2 stacks of shotgun shells. Bring it home and it's yours.</p>`:"",
    profile.insure?`<p class="risk good">Your kit is insured with the Vanta Combine for this raid.</p>`:"", profile.hire?`<p class="risk good">A ${Sim.FACTIONS[profile.hire.fac].short} escort is coming with you.</p>`:""].join("");
  const atStake=[...(cid?[C.title]:[]),...(ship().jobs||[]).filter(j=>j.site===L.id).map(j=>j.title)];
  const stakeHTML=atStake.length?`<p class="risk bad">On the line: ${atStake.map(esc).join(", ")}. If ${inSquad()?"the whole crew dies":"you die"}, ${atStake.length>1?"they fail":"it fails"}: contracts are pulled with a 10% fee, jobs cost standing.</p>`:"";
  let intel=""; if(upLvl("scanner")){ const I=scanSite(L); if(I){ const HN={husk:"husk",stalker:"stalker",spitter:"spitter",brute:"brute",matriarch:"Matriarch"};
    intel=`<div class="h-eyebrow" style="margin-top:8px">Scanner sweep</div><p class="risk">${I.power?"Power on":"No power"} · ${Object.entries(I.husks).filter(([k])=>k!=="matriarch").map(([k,n])=>`${n} ${HN[k]}${n===1?"":"s"}`).join(", ")||"no life signs"}${I.boss?` · <b style="color:var(--blood2)">a Matriarch</b>`:""}${I.turrets?` · ${I.turrets} turret${I.turrets>1?"s":""}`:""}${I.drones?` · ${I.drones} drone${I.drones>1?"s":""}`:""}${I.fires?` · ${I.fires} fires`:""}</p>
      ${I.crews.length?`<p class="risk">Crews aboard: ${I.crews.map(c=>{ const F=Sim.FACTIONS[c.fac]; return `<span style="color:${F.col}">${F.name}</span> ×${c.n} (${c.att})`; }).join(" · ")}</p>`:`<p class="risk">No other crews aboard.</p>`}`; } }
  else intel=`<p class="risk">Install a scanner array at the fabricator to see what's aboard before you board.</p>`;
  let squadHTML, btn;
  if(!inSquad()){ squadHTML=`<p>Going in solo.</p><p class="risk">Use the Crew button to open a squad. Up to four contractors share this ship, its contracts and its raids.</p>`;
    btn=`<button class="deploy-btn" data-act="deploy">Board ${L.name}</button>`; }
  else { const allReady=Net.roster.every(q=>q.ready||q.key===Net.myKey);
    squadHTML=`<div class="squad">${Net.roster.map(q=>`<div class="${q.key===Net.myKey?"me":""}"><b>${nameOf(q.key)}</b><span>${q.key===(Net.host?Net.myKey:Net.setup&&Net.setup.hostKey)?"Leader":q.ready?"Ready":"Not ready"}</span></div>`).join("")}${"<div>Open berth</div>".repeat(Math.max(0,4-Net.roster.length))}</div>
      <p class="risk">Everyone boards together and takes turns as one crew. The station moves once every living contractor has acted.</p>`;
    btn=Net.host?`<button class="deploy-btn" data-act="launch" ${allReady?"":"disabled"}>${allReady?`Launch raid · ${Net.roster.length} aboard`:"Waiting for crew to ready up"}</button>`
      :`<button class="deploy-btn" data-act="ready">${Net.ready?"Stand down":"Ready up"}</button><p class="risk">${Net.ready?"Ready. The squad leader launches the raid.":"Pick your kit, then ready up."}</p>`; }
  return `<section class="h-grid">
    <div class="panel h-card span7"><div class="h-eyebrow">Target</div><h3>${L.name}</h3><p>${L.desc}</p><div class="h-tags">${tags.map(t=>`<span class="${/fire|husk|power/i.test(t)?"hot":""}">${t}</span>`).join("")}</div>
      <div class="facts"><span>Contract</span><span>${C?`${C.title} · ${C.reward} cr`:"None · salvage run"}</span><span>Objective</span><span>${[C?"Black box from the vault":"",...(ship().jobs||[]).filter(j=>j.site===L.id).map(j=>j.title)].filter(Boolean).join(" · ")||"Anything worth carrying"}</span>${World.controlOf(ship(),L.id)?`<span>Held by</span><span style="color:${Sim.FACTIONS[World.controlOf(ship(),L.id)].col}">${Sim.FACTIONS[World.controlOf(ship(),L.id)].name}</span>`:""}<span>Extraction</span><span>Your shuttle pad, docking bay</span></div>${stakeHTML}${notes}${intel}</div>
    <div class="panel h-card span5"><div class="h-eyebrow">${inSquad()?`Squad ${Net.code.toUpperCase()}`:"Crew"}</div>${squadHTML}</div>
    <div class="panel h-card span12"><div class="bar-row"><div class="h-eyebrow grow">Loadout · ${r.free?"Starter kit":"Custom kit"}</div><button class="plain" data-act="open:rack">Loadout rack</button></div>
      ${kitSummaryHTML(r)}<p class="risk ${r.free?"good":"bad"}">${r.free?"Free kit. Nothing from your stash is at risk.":profile.insure?`Insured: if you die, this kit comes back to your stash.`:`If you die you lose this kit (about ${risk} cr), except what you seal in your secure pouch (${2+upLvl("pouch")} slots). Insure it on the bridge hologram with the Vanta Combine.`}${!r.w1&&!r.w2?" You are going in without a gun.":""}</p>
      ${btn}</div></section>`;
}
function viewCrew(){
  const fieldCss="font:600 16px var(--f-hud);background:#071010;color:var(--bone);border:1px solid var(--line-dim);height:40px;padding:0 10px;min-width:0;flex:1";
  if(!Net.avail&&!window.claude) return `<section class="h-grid"><div class="panel h-card span12"><div class="h-eyebrow">Squad server</div>
      <p>Squads in the app meet on a Hullbreach squad server. Enter its address (it starts with wss://), pick a callsign, and connect. Everyone in your squad needs the same server.</p>
      <div class="bar-row"><input id="srv-url" style="${fieldCss}" placeholder="wss://your-squad-server.example" aria-label="Squad server address" value="${esc(HB.serverUrl())}" autocomplete="off"></div>
      <div class="bar-row"><input id="srv-name" style="${fieldCss}" maxlength="20" aria-label="Callsign" placeholder="Callsign" value="${esc(HB.callsign())}" autocomplete="off"><button class="deploy-btn" style="height:40px;font-size:15px" data-act="srvconnect" ${Net.connecting?"disabled":""}>${Net.connecting?"Connecting…":"Connect"}</button></div>
      <p class="risk">No server yet? The repo's server folder has a ready-to-run relay and the steps to host it for free.</p></div></section>`;
  const appHead=Net.app?`<div class="panel h-card span12"><div class="bar-row"><span class="h-eyebrow grow">Callsign · ${esc(HB.serverUrl().replace(/^wss?:\/\//,""))}</span></div><div class="bar-row"><input id="srv-name" style="${fieldCss}" maxlength="20" aria-label="Callsign" value="${esc(HB.callsign())}" autocomplete="off"><button class="plain" data-act="callsign">Save</button></div></div>`:"";
  if(!Net.avail) return `<section class="panel h-card"><h3>Multiplayer isn't available here</h3><p>Squads need everyone signed in to Claude with this page shared to them, with permission to use it. Ask the page's owner to share it from the Share menu. Until then you can keep playing solo.</p></section>`;
  if(!inSquad()){
    const open=Net.lobbyPeers.filter(p=>!p.sameTab&&p.presence&&p.presence.app==="hb"&&p.presence.open&&p.presence.sq);
    return `<section class="h-grid">${appHead}<div class="panel h-card span6"><div class="h-eyebrow">Lead a squad</div><p>Your ship becomes the squad's ship. You fly it, pick the targets and launch raids. Contract rewards go to everyone.</p><button class="deploy-btn" data-act="sqcreate">Open a squad</button></div>
      <div class="panel h-card span6"><div class="h-eyebrow">Join a squad</div><div class="bar-row"><input id="sq-code" maxlength="8" placeholder="Code" aria-label="Squad code" autocomplete="off" style="font:600 18px var(--f-num);letter-spacing:.2em;text-transform:uppercase;background:#071010;color:var(--bone);border:1px solid var(--line-dim);height:40px;padding:0 10px;width:140px"><button class="plain" data-act="sqjoin">Join</button></div>
        <div class="h-eyebrow" style="margin-top:6px">Open squads on this page</div>
        ${open.length?open.map(p=>`<div class="panel contract-row"><div><b>${(p.by&&Net.names[p.by])||"A contractor"}</b><br><span>${p.presence.crew}/4 crew · at ${String(p.presence.loc||"").slice(0,40)}</span></div><button class="plain" data-act="sqjoin:${String(p.presence.sq).replace(/[^a-z0-9]/g,"")}">Join</button></div>`).join(""):`<p class="risk">Nobody has an open squad right now.</p>`}</div></section>`; }
  return `<section class="h-grid">${appHead}<div class="panel h-card span7"><div class="h-eyebrow">Squad code</div><h2 style="font-family:var(--f-num);letter-spacing:.3em">${Net.code.toUpperCase()}</h2><p class="risk">Crew can join with this code from their own Crew panel, or pick your squad from the open list.</p>
      <div class="squad">${Net.roster.map(q=>`<div class="${q.key===Net.myKey?"me":""}"><b>${nameOf(q.key)}</b><span>${q.key===(Net.setup?Net.setup.hostKey:Net.myKey)&&Net.host===(q.key===Net.myKey)?"Leader":"Crew"}${q.ready?" · ready":""}</span></div>`).join("")}${"<div>Open berth</div>".repeat(Math.max(0,4-Net.roster.length))}</div></div>
    <div class="panel h-card span5"><div class="h-eyebrow">${Net.host?"You lead this squad":"Crew member"}</div><p>${Net.host?"You fly the ship and launch raids. If you leave, the squad ends.":"The leader flies the ship and launches raids. Your stash and credits stay your own."}</p>
      <button class="plain" data-act="sqleave">${armed.sqleave?"Confirm":Net.host?"Disband squad":"Leave squad"}</button></div></section>`;
}
function awardMedal(id){ if(profile.medals[id]) return; const M=MEDALS.find(m=>m.id===id); if(!M) return; profile.medals[id]=ship().day|0; toast(`Medal earned: ${M.t}. Wear the title "${M.title}" from the Logbook.`); if(typeof Snd!=="undefined") Snd.play("levelup"); save(); }
function deathTip(c,p){ c=String(c).toLowerCase();
  if(/bled|blood/.test(c)) return "Bleeding kills slowly but surely. Carry bandages and stop a bleed the moment you see it.";
  if(/vacuum|suffocat|air|breath/.test(c)) return "Watch your O₂ and the air pressure. Spare canisters, and stay away from breaches.";
  if(/radiation/.test(c)) return "A hazard suit cuts radiation by 80%. Gas masks and heavy armour help a little.";
  if(/acid|spitter/.test(c)) return "Spitters hit from range and burn. Close the gap or break line of sight.";
  if(/fever|infection/.test(c)) return "Infections come from husk claws. Antibiotics, the medbay upgrade, or just don't get scratched.";
  if(/reactor|core|meltdown/.test(c)) return "When the klaxon goes, run for the shuttle. Nothing aboard is worth the core.";
  if(/matriarch/.test(c)) return "The Matriarch hits harder than anything else. Fight her at range, in a doorway, with friends.";
  if(/brute/.test(c)) return "Brutes are slow. Kite them and never let them corner you.";
  if(/shot|raider|round/.test(c)||(p.killer&&/\(/.test(p.killer))) return "Raiders only see as far as you do. Sneak (C), use cover and doors, and pick fights on your terms.";
  if(/fire|burn|flame/.test(c)) return "Fire spreads through anything that burns. A hazard suit shrugs off most of it.";
  return "Sneak (C) past what you can't fight, and keep a medkit for emergencies."; }
function viewDebrief(){ const Lr=profile.last; if(!Lr) return "<p>No raid to report.</p>";
  const li=x=>typeof x==="string"?`<li>${esc(x)}</li>`:`<li style="color:${x.c}">${esc(x.n)}</li>`;
  return `<section class="panel h-card report ${Lr.win?"":"lose"}"><h3>${Lr.win?`Extracted from ${Lr.site}`:`Lost on ${Lr.site}`}</h3>
    ${Lr.contract?`<p class="risk good">Contract complete: ${Lr.contract.title}. ${Lr.contract.reward} cr paid to the crew.${Lr.contract.bonus?` Bonus: <b style="color:${Lr.contract.bonus.c}">${esc(Lr.contract.bonus.n)}</b>.`:""}</p>`:""}
    ${Lr.win?`<p>Brought home ${Lr.items.length} item${Lr.items.length===1?"":"s"} worth about ${Lr.value} cr. Everything is in the stash locker.</p>${Lr.items.length?`<ul>${Lr.items.slice(0,12).map(li).join("")}${Lr.items.length>12?`<li>and ${Lr.items.length-12} more</li>`:""}</ul>`:""}
      ${Lr.ammo&&Object.keys(Lr.ammo).length?`<div class="h-eyebrow">Ammo recovered</div>${ammoChips(Lr.ammo)}`:""}${Lr.mats&&MAT_T.some(t=>Lr.mats[t])?`<div class="h-eyebrow" style="margin-top:6px">Materials</div>${matChips(Lr.mats)}`:""}`
      :`<p>${Lr.cause||"You did not come back."} ${Lr.kit==="custom"?"Your custom kit is gone.":"You went in on the starter kit, so your stash is untouched."}</p>`}
    ${Lr.xp?`<p class="risk ${Lr.xp.up?"good":""}">+${Lr.xp.got} XP${Lr.win?"":` (half of ${Lr.xp.full}: you didn't make it out)`}.${Lr.xp.up?` <b>Level ${Lr.xp.level}!</b> Spend your perk point in Skills.`:""}</p>`:""}
    ${Lr.failed&&Lr.failed.length?`<div class="h-eyebrow" style="color:var(--blood2)">Failed</div>${Lr.failed.map(f=>`<p class="risk bad">${esc(f.title)}: ${esc(f.who)} ${f.rep?`pulled the job. Standing ${f.rep}.`:`pulled the contract and kept a ${f.fee} cr cancellation fee. They won't offer it again for ${f.days} days.`}</p>`).join("")}`:""}
    ${Lr.recap?`<div class="recap"><div class="h-eyebrow" style="color:var(--blood2)">What happened</div><p><b>Killed by ${esc(Lr.recap.killer||"something in the dark")}</b> on turn ${Lr.recap.turns}. You put down ${Lr.recap.kills} and dealt ${Lr.recap.dealt} damage.</p>${Lr.recap.hits.length?`<ol class="hits">${Lr.recap.hits.map(h=>`<li><span>T${h.t}</span> ${esc(h.by)} · ${esc(Sim.LNAME[h.l]||h.l)} <b>−${h.d}</b></li>`).join("")}</ol>`:""}<p class="risk">${esc(Lr.recap.tip)}</p></div>`:""}
    ${Lr.nemesis&&Lr.nemesis.made?`<div class="recap nem"><div class="h-eyebrow" style="color:var(--blood2)">${Lr.nemesis.lvl>1?"Your nemesis grows stronger":"A nemesis is born"}</div><p><b>${esc(Lr.nemesis.name)}</b> of the ${esc(Sim.FACTIONS[Lr.nemesis.fac].name)}${Lr.nemesis.lvl>1?` killed you again. They're level ${Lr.nemesis.lvl} now: tougher, better equipped, and they travel with friends.`:" killed you, and they'll remember it."}${Lr.nemesis.took.length?` They took your ${Lr.nemesis.took.map(esc).join(", ")}.`:""} They'll turn up on your raids. Kill them to take it all back.</p></div>`:""}
    ${Lr.nemesis&&Lr.nemesis.killed?`<p class="risk good"><b>Vengeance.</b> ${esc(Lr.nemesis.name)} is dead. Whatever they took from you was on their body.</p>`:""}
    ${Lr.records&&Lr.records.length?`<p class="risk good"><b>New personal record${Lr.records.length>1?"s":""}:</b> ${Lr.records.map(esc).join(" · ")}</p>`:""}
    ${Lr.sides&&Lr.sides.length?`<p class="risk good">Side objectives: ${Lr.sides.map(o=>`${esc(o.t)} (+${o.cr} cr)`).join(", ")}.</p>`:""}
    ${Lr.wanted?`<p class="risk good"><b>Bounty collected:</b> ${esc(Lr.wanted.name)}, dead. The Concord Marshals pay ${Lr.wanted.reward} cr.</p>`:""}
    ${Lr.daily?`<p class="risk good"><b>Daily Op complete: ${esc(Lr.daily.name)}.</b> Supply crate: ${Lr.daily.items.map(x=>`<b style="color:${x.c}">${esc(x.n)}</b>`).join(", ")}, ${Lr.daily.cr} cr and ${Lr.daily.xp} XP.</p>`:""}
    ${Lr.mast&&Lr.mast.length?Lr.mast.map(m=>`<p class="risk good">${esc(m.c)} mastery: <b>${esc(m.lvl)}</b>. ${esc(m.bonus)}</p>`).join(""):""}
    ${Lr.medals&&Lr.medals.length?`<p class="risk good">Medal${Lr.medals.length>1?"s":""} earned: <b>${Lr.medals.map(esc).join(", ")}</b>. Wear the title from the Logbook.</p>`:""}
    ${Lr.logs&&Lr.logs.length?`<p class="risk good">Filed in your codex: ${Lr.logs.map(esc).join(", ")}.</p>`:""}
    ${Lr.jobs&&Lr.jobs.length?`<p class="risk good">${Lr.jobs.map(j=>`Job done: ${esc(j.title)} · ${j.reward} cr from the ${esc(Sim.FACTIONS[j.fac].name)}`).join(". ")}.</p>`:""}
    ${Lr.secured&&Lr.secured.length?`<p class="risk good">Secure pouch: ${Lr.secured.map(x=>`<b style="color:${x.c}">${esc(x.n)}</b>`).join(", ")} came home with you.</p>`:""}
    ${Lr.insured&&Lr.insured.length?`<p class="risk good">Vanta insurance returned ${Lr.insured.length} item${Lr.insured.length>1?"s":""} to your stash.</p>`:""}
    ${Lr.remains?`<p class="risk">Your body is still aboard with ${Lr.remains} item${Lr.remains>1?"s":""}. Go back within 6 days to recover them, before scavengers do.</p>`:""}
    ${Lr.prisoners&&Lr.prisoners.length?`<p class="risk good">${Lr.prisoners.map(q=>`${esc(q.name)} handed to the ${esc(q.to)} for ${q.pay} cr`).join(". ")}.</p>`:""}
    ${Lr.treated?`<p class="risk good">The medbay patched up your injuries.</p>`:""}
    ${Lr.bounty?`<p class="risk good">Concord bounty: ${Lr.bounty.n} raider${Lr.bounty.n>1?"s":""} put down. ${Lr.bounty.pay} cr paid.</p>`:""}
    ${Lr.standing&&Lr.standing.length?`<div class="h-eyebrow">Standing</div><div class="chips">${Lr.standing.map(x=>{ const F=Sim.FACTIONS[x.f]; return F?`<span class="chip" style="border-color:${F.col};color:${x.n>0?"var(--bile)":"var(--blood2)"}">${esc(F.name)} ${x.n>0?"+":""}${x.n}</span>`:""; }).join("")}</div>`:""}
    <div class="bar-row"><button class="plain" data-act="close">Back to the ship</button></div></section>`; }

// ---------- panel actions ----------
function worldAct(a){
  const shared=["travel","tow","refuel","accept","drop"].includes(a.type);
  if(inSquad()&&!Net.host&&shared){ if(a.type==="accept"||a.type==="drop"){ emit({t:"wreq",a}); toast("Sent to the squad leader."); } else toast("Only the squad leader flies and refuels the ship."); return {ok:false}; }
  const res=World.act(ship(),{id:PID,profile},a); if(res.msg) toast(res.msg); if(res.ok){ save(); if(shared&&inSquad()) hostBroadcastShip(false); } return res; }
function pay(c){ for(const [m,n] of Object.entries(c)){ if(m==="credits") profile.credits-=n; else profile.mats[m]=(profile.mats[m]|0)-n; } }
function scrapYield(it){ const r=Items.rarOf(it); return {scrap:2+r,prop:Items.kind(it)==="throw"?2:r>=1?1:0,circ:r>=2?r-1:0}; }
$("p-body").addEventListener("click",e=>{
  const b=e.target.closest("[data-act]"); if(!b||b.disabled) return; const [a,x,y]=b.dataset.act.split(":"); const k=profile.kit;
  const arm=key=>{ if(armed[key]){ armed={}; return true; } armed={[key]:1}; setTimeout(()=>{ if(armed[key]){ armed={}; renderPanel(); } },3000); return false; };
  switch(a){
    case "close": closePanel(); return;
    case "open": openPanel(x); return;
    case "back": panelSub=null; break;
    case "region": mapRegion=x; break;
    case "sel": if(panelKind==="helm") mapSel=x; else stashSel=stashSel===x?null:x; break;
    case "jump": { const days=World.travelCost(ship(),x), res=worldAct({type:"travel",to:x}); if(res.ok){ mapRegion=null; travelHunger(days); if(inSquad()) emit({t:"warp",d:days}); closePanel(); mapSel=null; warp={start:performance.now(),dur:2200,done:()=>{ toast(`Arrived at ${here().name}.`); renderShipHud(); if(!inSquad()||Net.host) maybeEncounter(days); }}; renderShipHud(); } break; }
    case "suggest": { const L2=World.loc(x); if(!L2) break; emit({t:"suggest",to:x}); emit({t:"chat",m:`suggests a course to ${L2.name}`}); toast(`Suggested ${L2.name} to the squad leader.`); break; }
    case "tow": { const res=worldAct({type:"tow"}); if(res.ok){ travelHunger(4); closePanel(); warp={start:performance.now(),dur:2600,done:()=>renderShipHud()}; } break; }
    case "refuel": worldAct({type:"refuel"}); break;
    case "npc": panelSub="npc:"+x; break;
    case "accept": worldAct({type:"accept",id:x}); break;
    case "drop": if(arm("drop:"+x)) worldAct({type:"drop",id:x}); break;
    case "buy": worldAct({type:"buy",npc:x,i:+y}); break;
    case "sell": if(arm("sell:"+y)){ worldAct({type:"sell",npc:x,uid:y}); refreshLook(); } break;
    case "filter": stashFilter=x; break;
    case "deploy": deploy(); return;
    case "launch": Net.ready=true; Net.readyLo=loadoutFromKit(kitResolved()); squadPresence(); hostLaunch(); return;
    case "ready": setReady(!Net.ready); return;
    case "sqcreate": createSquad(); return;
    case "srvconnect": { const u=($("srv-url").value||"").trim(); if(!/^wss?:\/\//.test(u)){ toast("The address should start with wss:// (or ws:// on your own network)."); return; } HB.setServer(u); HB.setCallsign($("srv-name").value); netInit(); renderPanel(); return; }
    case "callsign": HB.setCallsign($("srv-name").value); toast("Callsign saved."); if(inSquad()) squadPresence(); break;
    case "sqjoin": joinSquad(x||($("sq-code")?$("sq-code").value:"")); return;
    case "sqleave": if(arm("sqleave")) leaveSquad(Net.host?"Squad disbanded.":"You left the squad."); break;
    // kit
    case "kit": k.type=x; panelSub=null; save(); refreshLook(); break;
    case "pick": panelSub=panelSub===x?null:x; break;
    case "set": k[x]=y||null; for(const s of KIT_SLOTS) if(s!==x&&y&&k[s]===y) k[s]=null; k.inv=k.inv.filter(u=>u!==y); panelSub=null; save(); refreshLook(); break;
    case "invadd": if(k.type!=="custom") k.type="custom"; if(!k.inv.includes(x)) k.inv.push(x); k.inv=kitResolved().inv.map(i=>i.uid); panelSub=null; save(); refreshLook(); break;
    case "invrm": k.inv=k.inv.filter(u=>u!==x); save(); refreshLook(); break;
    case "ammo": { const st=Math.max(1,Math.round(Items.AMMO[x].stack/2)), cur=kitResolved().ammo[x]|0; k.ammo[x]=Math.max(0,Math.min(profile.ammo[x]|0,cur+(+y)*st)); save(); refreshLook(); break; }
    // stash + workbench
    case "scrap": { const it=byUid(x); if(!it) break; if(!arm("scrap:"+x)) break; const yv=scrapYield(it); profile.stash=profile.stash.filter(q=>q.uid!==x); stashSel=null;
      for(const m in yv) profile.mats[m]=(profile.mats[m]|0)+yv[m]; toast(`Broke down ${Items.name(it)}: ${MAT_T.filter(m=>yv[m]).map(m=>yv[m]+" "+Items.MATS[m].toLowerCase()).join(", ")}.`); save(); refreshLook(); break; }
    case "job": { if(inSquad()&&!Net.host) break; const sh=profile.ship; sh.jobs=sh.jobs||[]; if(sh.jobs.length>=3||sh.jobs.some(q=>q.id===x)||(sh.failedJobs||[]).includes(x)) break; const j=World.jobsFor(sh,commsFac,Sim.FACTIONS).find(q=>q.id===x); if(!j) break; sh.jobs.push(j); commsMsg="Good. Don't come back without it done."; toast(`Job taken: ${j.title}.`); save(); if(inSquad()) hostBroadcastShip(false); break; }
    case "dropjob": { if(inSquad()&&!Net.host) break; profile.ship.jobs=(profile.ship.jobs||[]).filter(q=>q.id!==x); toast("Job dropped."); save(); if(inSquad()) hostBroadcastShip(false); break; }
    case "hack": send({type:"hack",opt:x}); closePanel(); return;
    case "logtab": logTab=x; break;
    case "hullup": { const h=hullLvl(), nx=HULLS[h+1]; if(!nx||!canPay(nx.cost)||(inSquad()&&!Net.host)) break; pay(nx.cost); profile.ship.hull=h+1; save(); closePanel(); toast(`The refit crews finish overnight. Welcome aboard your new ${nx.name}.`); if(typeof Snd!=="undefined") Snd.play("levelup"); if(inSquad()) hostBroadcastShip(true); else boardShip(); return; }
    case "sellall": { const L=salvageList(); if(!L.length) break; const v=L.reduce((a,it)=>a+Math.round(Items.value(it)*.5),0); profile.stash=profile.stash.filter(it=>!L.includes(it)); profile.credits+=v; toast(`The broker takes ${L.length} item${L.length===1?"":"s"} off your hands. +${v} cr.`); if(typeof Snd!=="undefined") Snd.play("pickup"); save(); break; }
    case "rest": doRest(); break;
    case "rename": { if(inSquad()&&!Net.host){ toast("Only the squad leader can rename the ship."); break; } const v=String(($("ship-nm")||{}).value||"").replace(/[<>]/g,"").trim().slice(0,24); if(v){ profile.ship.name=v; save(); if(inSquad()) hostBroadcastShip(false); toast(`She's the ${v} now.`); if(S&&S.mode==="ship") renderShipHud(); } break; }
    case "implant": { const I=IMPLANTS[x]; if(!I||profile.implants[x]||Object.keys(profile.implants).length>=IMP_MAX||!canPay(I.cost)) break; for(const [m,n] of Object.entries(I.cost)){ if(m==="credits") profile.credits-=n; else profile.mats[m]-=n; } profile.implants[x]=ship().day|0; toast(`The surgeon closes you up. ${I.name} fitted.`); if(typeof Snd!=="undefined") Snd.play("heal"); if(Object.keys(profile.implants).length>=IMP_MAX) awardMedal("chrome"); save(); break; }
    case "unimplant": if(profile.implants[x]){ delete profile.implants[x]; toast("Implant removed."); save(); } break;
    case "enc": resolveEncounter(+x); break;
    case "vr-start": vrStart(); return;
    case "bones-open": openPanel("bones"); return;
    case "juke-open": openPanel("juke"); return;
    case "bones": bonesRoll(+x); return;
    case "juke": if(typeof Snd!=="undefined"&&Snd.song){ Snd.song(+x); jukeOn=+x; renderPanel(); } return;
    case "bclaim": { const B=bountyWeek(), q=B.list.find(z=>z.id===x), b=BOUNTIES.find(z=>z.id===x); if(!q||!b||q.claimed||q.prog<b.n) break; q.claimed=true; profile.credits+=b.cr; profile.xp=(profile.xp|0)+b.xp; toast(`Bounty paid: ${b.cr} cr and ${b.xp} XP.`); if(typeof Snd!=="undefined") Snd.play("coin"); save(); break; }
    case "title": profile.title=x==="none"?null:x; save(); break;
    case "perk": if(perkPoints()>0&&PERKS[x]&&(profile.perks[x]|0)<PERKS[x].max){ profile.perks[x]=(profile.perks[x]|0)+1; save(); toast(`${PERKS[x].name} rank ${profile.perks[x]}.`); } break;
    case "treat": { const i=profile.stash.findIndex(q=>q.d===x); if(i<0) break; const I=profile.injury; if(x==="splint"){ const l=Object.keys(I.frac||{})[0]; if(!l) break; delete I.frac[l]; toast(`Splinted your ${Sim.LNAME[l]}.`); } else { if(!I.inf) break; I.inf=0; toast("Infection treated."); } profile.stash.splice(i,1); save(); break; }
    case "call": if(commsFac!==x){ commsFac=x; commsT0=performance.now(); commsMsg=""; } break;
    case "cmdo": commsDo(x); break;
    case "cmbuy": commsBuy(+x); break;
    case "loot": send({type:"loot",id:panelSub,src:x,key:x==="inv"?+y:y}); break;
    case "lootall": send({type:"loot",id:panelSub,all:true}); break;
    case "craft": { const R2=Items.RECIPES.find(q=>q.id===x); if(!R2||R2.lvl>fabLvl()||!canPay(R2.cost)) break; pay(R2.cost); const out={...R2.out,r:Items.craftRarity(R2,fabLvl())}; World.grant(profile,out); const OD=Items.def(out.d);
      if(OD&&OD.k==="ammo"){ const t=OD.ammo, k=profile.kit; if(k.type!=="starter"){ k.ammo=k.ammo||{}; k.ammo[t]=Math.min(profile.ammo[t]|0,(k.ammo[t]|0)+(out.n|0)); }
        toast(`Crafted ${Items.AMMO[t].name} ×${out.n|0}. ${profile.ammo[t]|0} in the hold${k.type!=="starter"?", packed in your kit":" (switch to a custom kit to bring it)"}.`); }
      else toast(`Crafted ${Items.name(out)}. It's in your stash.`); save(); break; }
    case "fabtab": fabTab=x; break;
    case "equipslot": if(profile.kit.type!=="custom"){ profile.kit.type="custom"; toast("Switched to a custom kit. Pick your gear."); } save(); openPanel("rack",x); return;
    case "equipitem": { const it=byUid(x), sl=it&&Items.slotOf(it); if(!sl) break; const k=profile.kit; if(k.type!=="custom"){ k.type="custom"; }
      const slot=sl==="gun"?(!k.w1||k.w1===x?"w1":!k.w2?"w2":"w1"):sl; for(const s2 of KIT_SLOTS) if(k[s2]===x) k[s2]=null; k[slot]=x; k.inv=k.inv.filter(u=>u!==x);
      toast(`${Items.name(it)} is in your ${SLOT_NAME[slot].toLowerCase()} slot. Your kit is now custom.`); save(); refreshLook(); break; }
    case "ilight": send({type:"light"}); break;
    case "iunequip": invSel=null; send({type:"unequip",slot:x}); break;
    case "unslot": { const k=profile.kit; if(k.type==="custom"){ k[x]=null; save(); refreshLook(); } invSel=null; break; }
    case "fit": { const mi=profile.stash.findIndex(q=>q.uid===x), g=profile.stash.find(q=>q.uid===y); if(mi<0||!g||g.m) break; const md=Items.def(profile.stash[mi].d).mod; if(!Items.modFits(md,g)) break; g.m=md; profile.stash.splice(mi,1); toast(`Fitted: ${Items.name(g)}.`); save(); break; }
    case "unfit": { const g=profile.stash.find(q=>q.uid===x); if(!g||!g.m) break; profile.stash.push(World.mkItem({d:"mod_"+g.m,r:0})); toast(`${Items.MODS[g.m].name} removed.`); delete g.m; save(); break; }
    case "shipup": { const U=SHIPUP[x], n=upLvl(x), c=U&&U.cost[n]; if(!c||!canPay(c)||(inSquad()&&!Net.host)) break; pay(c); profile.ship.up={...(profile.ship.up||{}),[x]:n+1}; if(x==="tanks") profile.ship.fuelMax=(profile.ship.fuelMax|0)+2;
      toast(`${U.name} installed.`); if(typeof Snd!=="undefined") Snd.play("levelup"); save(); if(inSquad()) hostBroadcastShip(false); break; }
    case "fabup": { const lv=fabLvl(), up=Items.FAB_UP[lv]; if(!up||!canPay(up)||(inSquad()&&!Net.host)) break; pay(up); profile.ship.fab=lv+1; toast(`Fabricator upgraded to Mk ${lv+1}: ${Items.FAB_NAME[lv+1]}.`); save(); if(inSquad()) hostBroadcastShip(false); break; }
    case "bareat": { const b=Items.BAR.find(q=>q.id===x); if(!b||profile.credits<b.price) break; profile.credits-=b.price; eatDrink(b.food,b.water); toast(b.water>(b.food||0)?`You drink the ${b.name.toLowerCase()}.`:`You eat the ${b.name.toLowerCase()}.`); if(inSquad()) emit({t:"chat",m:`grabs a ${b.name.toLowerCase()} at the galley`}); save(); break; }
    case "bartogo": { const row=Items.BAR_TOGO[+x]; if(!row||profile.credits<row[1]) break; profile.credits-=row[1]; World.grant(profile,{d:row[0],r:0}); toast(`Bought ${Items.name({d:row[0],r:0})}.`); save(); break; }
    case "consume": { const it=byUid(x); if(!it||Items.kind(it)!=="food") break; const D=Items.def(it.d); eatDrink(D.food,D.water); profile.stash=profile.stash.filter(q=>q.uid!==x); stashSel=null; toast(`You finish the ${Items.name(it).toLowerCase()}.`); save(); refreshLook(); break; }
    case "upg": { const it=byUid(x); if(!it||(it.l|0)>=3) break; const c=Items.UPGRADE_COST(it.l|0); if(!canPay(c)) break; pay(c); it.l=(it.l|0)+1; toast(`${Items.name(it)} now holds ${capOf(it)} items.`); save(); refreshLook(); break; }
    case "look": if(dyeOpen(x,y)){ profile.look[x[0]]=y; save(); refreshLook(); } break;
    case "style": profile.look[x]=+y|0; save(); refreshLook(); break;
    case "wtab": wardTab=x; break;
    // raid inventory
    case "isel": invSel=invSel===+x?null:+x; break;
    case "iswap": send({type:"swap"}); break;
    case "iequip": invSel=null; send({type:"equip",index:+x}); break;
    case "iuse": invSel=null; send({type:"use",index:+x}); break;
    case "isec": send({type:"secure",index:+x}); break;
    case "idrop": invSel=null; send({type:"drop",index:+x}); break;
    case "igive": invSel=null; send({type:"give",index:+x,to:y}); break;
    case "ithrow": closePanel(); useSlot(+x); return;
  }
  renderPanel(); if(S&&S.mode==="ship") renderShipHud();
});
function refreshLook(){ if(inSquad()&&Net.ready) setReady(false); if(S&&S.mode==="ship"){ const r=kitResolved(), p=me(); if(p){ p.w1=strip(r.w1||r.w2); p.w2=null; p.act=1; for(const k of ["head","armor","legs","acc","light"]) p[k]=strip(r[k]); p.look={...profile.look}; } } if(inSquad()) squadPresence(); }

// ---------- scene changes ----------
function shipLoadout(){ const r=kitResolved(); return {w1:strip(r.w1||r.w2),head:strip(r.head),armor:strip(r.armor),legs:strip(r.legs),acc:strip(r.acc),light:strip(r.light),pack:strip(r.pack),ammo:{},inv:[],look:{...profile.look}}; }
function boardShipCrew(crew){ setTimeout(()=>{ try{ checkMail(); }catch(e){} },0); if(profile&&profile.ship) profile.ship.opKey=todayKey();
  const raidOver=S&&S.mode==="raid"; if(raidOver&&!Net.settled) settlePersonal();
  PID=crewKey();
  crew=crew.map(c=>c.id===PID?{...c,loadout:shipLoadout()}:c);
  S=Sim.newGame((Math.random()*2**32)>>>0,null,{map:shipMap(),mode:"ship",crew,pet:hullLvl()>=2});
  if(inSquad()) for(const q of Net.roster){ const e=S.ents.find(x=>x.id===q.key); if(e&&q.key!==PID&&typeof q.x==="number"){ e.x=q.x; e.y=q.y; } }
  rp={}; parts=[]; camInit=false; staticKey=""; target=null; stopTravel(); spectating=false; Net.ready=false; Net.readyLo=null; resize(); afterChange();
  if(inSquad()){ squadPresence(); netShipMoved(); }
  lobbyPresence(); if(raidOver) openPanel("debrief");
}
function boardShip(){
  if(inSquad()){ if(Net.host) hostBroadcastShip(true); else if(Net.setup&&Net.setup.scene==="ship") buildFromSetup(); else boardShipCrew([{id:crewKey(),name:"You",loadout:{}}]); return; }
  boardShipCrew([{id:"p1",name:"You",loadout:{}}]);
}
// the loadout that travels to the station (compact: no uids)
function remainsHere(){ const R0=profile.remains; if(!R0) return null; if((ship().day|0)-(R0.day|0)>6){ profile.remains=null; save(); return null; } return R0.site===ship().loc?{items:R0.items.slice(0,14),ammo:R0.ammo||{},days:(ship().day|0)-(R0.day|0)}:null; }
const GIFT_SG="sg1";
function loadoutFromKit(r){ const lo0=loadoutFromKit0(r); if(!(profile.gifts||{})[GIFT_SG]){ const sg={d:"pump",r:1}; if(!lo0.w2) lo0.w2=sg; else if(!lo0.w1) lo0.w1=sg; else lo0.inv=[sg,...lo0.inv]; lo0.ammo={...lo0.ammo,shell:((lo0.ammo||{}).shell|0)+2*Items.AMMO.shell.stack}; lo0.gift=GIFT_SG; } return lo0; }
function loadoutFromKit0(r){ const lo={secCap:2+upLvl("pouch"),brig:upLvl("brig")>0,remains:remainsHere(),ammo:{...r.ammo},inv:r.inv.map(strip),look:{...profile.look},food:Math.round(profile.food),water:Math.round(profile.water),perks:{...profile.perks},mast:mastLevels(),implants:{...profile.implants},morale:profile.morale===(ship().day|0)?1:0,coffee:profile.coffee===(ship().day|0)?1:0,injury:{frac:{...(profile.injury.frac||{})},inf:profile.injury.inf|0}}; for(const s of KIT_SLOTS) lo[s]=strip(r[s]); if(r.free) lo.starter=1; return lo; }
function consumeKit(lo){ if(lo.gift){ profile.gifts={...(profile.gifts||{}),[lo.gift]:1}; }
  profile.insured=null; if(profile.insure&&!lo.starter){ profile.insured=[...KIT_SLOTS.map(s=>lo[s]),...(lo.inv||[])].filter(it=>it&&!it.iss).map(it=>({...it})); } profile.insure=false;
  profile.stats.raids++; profile.active={kit:lo.starter?"starter":"custom",site:ship().loc,at:Date.now()};
  if(!lo.starter){ const r=kitResolved(), gone=new Set([...KIT_SLOTS.map(s=>r[s]&&!r[s].iss&&r[s].uid),...r.inv.map(i=>i.uid)].filter(Boolean));
    profile.stash=profile.stash.filter(q=>!gone.has(q.uid));
    for(const t of AMMO_T) profile.ammo[t]=Math.max(0,(profile.ammo[t]|0)-((lo.ammo||{})[t]|0));
    profile.kit={...profile.kit,inv:[],ammo:{}}; for(const s of KIT_SLOTS) profile.kit[s]=null; }
  save();
}
// each visit to a derelict has a fixed layout, so the scanner can read it before you board
function siteSeed(L){ const sh=profile.ship; sh.seeds=sh.seeds||{}; if(!sh.seeds[L.id]){ sh.seeds[L.id]=(Math.random()*2**32)>>>0; save(); } return sh.seeds[L.id]; }
function useSeed(L){ const sd=siteSeed(L); delete profile.ship.seeds[L.id]; save(); return sd; }
let scanCache={};
function scanSite(L){ const sd=(ship().seeds||{})[L.id]; if(!sd) return null; const key=L.id+sd; if(scanCache[key]) return scanCache[key];
  const g=Sim.newGame(sd,null,raidOpts(L)), H={}; for(const e of g.ents) if(e.kind==="husk"&&e.alive) H[e.type||"husk"]=(H[e.type||"husk"]||0)+1;
  const crews=Object.values(g.crews||{}).filter(C=>!C.hired).map(C=>({fac:C.fac,att:C.att,n:g.ents.filter(e=>e.crew===C.id).length}));
  return scanCache[key]={power:g.power,husks:H,boss:!!g.boss,turrets:g.ents.filter(e=>e.kind==="bot"&&e.type==="turret").length,drones:g.ents.filter(e=>e.kind==="bot"&&e.type==="drone").length,crews,fires:Object.keys(g.fire).length}; }
function raidOpts(L,fx){ const held=World.controlOf(ship(),L.id); return {jobs:(ship().jobs||[]).filter(j=>j.site===L.id),gen:{tier:L.site.tier||1,fireStart:!!L.site.fireStart,kind:held==="choir"?"hive":(L.site.kind||""),size:L.site.size||""},site:L.name,mods:L.site.mods,factions:fx||factionSetup(PID)}; }
// what the station's crews know about you: your standing, and a merc you've paid for (used once)
function factionSetup(by){ const N=profile.nemesis, hunt=N&&Math.random()<(L0=>L0&&L0.daily?1:.4)(here()); const W=wantedHere(); return {rep:{...(profile.rep||{})},hire:profile.hire?{fac:profile.hire.fac,by}:null,nemesis:hunt?{...N}:null,wanted:W&&!hunt&&Math.random()<.65?{id:W.id,name:W.name,fac:W.fac}:null}; }
// Concord wanted posters: three named raider captains a week, each hiding out in one sector
const WNAMES=["Corrin \"Saw\" Mallory","Ines Vahl the Red","Dutch Okafor","Mother Brisk","Teodor Kask","Sable Quinn","Iron Pell","Grue the Patient","Halvard Stoke","Nadia Ruhl","Fen Marrow","Old Absalom"];
function wantedWeek(){ const wk=Math.floor((ship().day|0)/7); let W=profile.wanted; if(!W||W.week!==wk){ let h=(wk*2246822519+3266489917)>>>0; const R=()=>{ h=(h^(h<<13))>>>0; h=(h^(h>>>17))>>>0; h=(h^(h<<5))>>>0; return h/4294967296; };
    const facs=["reaver","blacksun","hollow","reaver","blacksun"], secs=World.SECTORS.map(q=>q.id).slice(), names=WNAMES.slice(), list=[];
    for(let i=0;i<3;i++){ const sec=secs.splice(Math.floor(R()*secs.length),1)[0], nm=names.splice(Math.floor(R()*names.length),1)[0]; list.push({id:"w"+wk+"_"+i,name:nm,fac:facs[Math.floor(R()*facs.length)],sector:sec,reward:500+Math.floor(R()*5)*100}); }
    W=profile.wanted={week:wk,list,claimed:{}}; } return W; }
function wantedHere(){ const L=here(); if(!L||L.type==="station"||L.type==="outpost") return null; const W=wantedWeek(); return W.list.find(q=>q.sector===L.sector&&!W.claimed[q.id])||null; }
function deploy(){
  const L=here(); if(L.type!=="derelict") return;
  if(inSquad()){ if(Net.host){ Net.ready=true; Net.readyLo=loadoutFromKit(kitResolved()); squadPresence(); hostLaunch(); } else setReady(!Net.ready); return; }
  const lo=loadoutFromKit(kitResolved()); consumeKit(lo); closePanel(); PID="p1"; Net.settled=false;
  S=Sim.newGame(useSeed(L),lo,raidOpts(L)); if(profile.hire){ profile.hire=null; save(); }
  const C=World.siteContract(ship(),L.id); $("r-site").textContent=(C?"Contract · ":"Salvage · ")+L.name;
  rp={}; parts=[]; camInit=false; staticKey=""; target=null; stopTravel(); spectating=false; resize(); afterChange();
}
// Each player settles their own haul. The crew contract pays out if anyone got the black box home.
function settlePersonal(){
  if(!S||S.mode!=="raid"||Net.settled) return; Net.settled=true;
  const p=me(), win=!!p.extracted, L=here(), crew=S.ents.filter(e=>e.kind==="player");
  const rep={win,items:[],value:0,ammo:{},mats:{},cause:p.cause||S.cause,site:L.name,kit:profile.active?.kit||"starter",contract:null};
  const bbHome=crew.some(q=>q.extracted&&q.inv.some(i=>i.d==="blackbox")), cid=World.siteContract(ship(),L.id);
  if(cid&&bbHome){ const C=World.CONTRACTS[cid]; profile.credits+=C.reward; profile.stats.contracts++; rep.contract={title:C.title,reward:C.reward};
    const i=p.inv.findIndex(q=>q.d==="blackbox"); if(i>=0&&win) p.inv.splice(i,1);
    // a broker's bonus: one guaranteed uncommon-or-better piece of gear
    let it=null; for(let n=0;n<8&&(!it||Items.rarOf(it)<1||!Items.slotOf(it));n++) it=Items.roll(Math.random,(L.site.tier||1)+1,["weapon","armor","weapon","pack"][n%4]);
    if(it){ World.grant(profile,it); rep.contract.bonus={n:Items.name(it),c:rc(it)}; } }
  if(isHost()) World.settleRaid(profile.ship,[],{status:bbHome?"extracted":"lost",blackbox:bbHome},L.id);
  if(isHost()&&L.signal&&crew.some(q=>q.extracted)){ const sh=profile.ship; sh.cleared=[...(sh.cleared||[]),L.id].slice(-80); }
  // dying costs you the work: if nobody got out, every contract and job aimed at this station fails
  rep.failed=[]; if(!crew.some(q=>q.extracted)){ const sh=ship();
    for(const cid of sh.contracts.filter(c=>World.CONTRACTS[c].site===L.id)){ const C=World.CONTRACTS[cid], fee=Math.min(profile.credits,Math.round(C.reward*.1)); profile.credits-=fee; rep.failed.push({title:C.title,who:World.NPCS[C.giver].name,fee,days:5}); }
    for(const j of (sh.jobs||[]).filter(q=>q.site===L.id)){ profile.rep[j.fac]=Math.max(-100,(profile.rep[j.fac]|0)-6); rep.failed.push({title:j.title,who:Sim.FACTIONS[j.fac].name,rep:-6}); }
    if(isHost()){ const P=profile.ship; P.failed=P.failed||{}; P.failedJobs=P.failedJobs||[];
      for(const cid of P.contracts.filter(c=>World.CONTRACTS[c].site===L.id)) P.failed[cid]=(P.day|0)+5;
      P.contracts=P.contracts.filter(c=>World.CONTRACTS[c].site!==L.id);
      for(const j of (P.jobs||[]).filter(q=>q.site===L.id)) P.failedJobs.push(j.id); P.failedJobs=P.failedJobs.slice(-30);
      P.jobs=(P.jobs||[]).filter(q=>q.site!==L.id); } }
  // faction jobs: paid when they're done and someone got out
  rep.jobs=[]; { const out=crew.some(q=>q.extracted); for(const J of S.jobs||[]){ const j=(ship().jobs||[]).find(q=>q.id===J.id); if(!j||!J.done||!out) continue; profile.credits+=j.reward; profile.rep[j.fac]=Math.max(-100,Math.min(100,(profile.rep[j.fac]|0)+j.rep)); if(j.target) profile.rep[j.target.fac]=Math.max(-100,(profile.rep[j.target.fac]|0)-10); rep.jobs.push({title:j.title,reward:j.reward,fac:j.fac,type:j.type,tgt:j.target&&j.target.fac}); p.xp=(p.xp|0)+60;
    if(isHost()){ const sh=profile.ship; sh.jobs=(sh.jobs||[]).filter(q=>q.id!==j.id); const F=Sim.FACTIONS[j.fac];
      if(j.fac==="choir") World.pushChoir(sh,10,`The Iron Choir grows louder: a contractor did its work on ${World.loc(j.site).name}.`);
      else if(j.type==="sabotage"||(j.target&&j.target.fac==="choir")) World.pushChoir(sh,-18,`Contractors struck the Iron Choir on ${World.loc(j.site).name} for the ${F.name}.`);
      else { const held=World.controlOf(sh,j.site); if(held&&held!==j.fac&&(F.foes||[]).includes(held)){ World.war(sh).control[j.site]=j.fac; World.news(sh,`The ${F.name} have taken ${World.loc(j.site).name} from the ${Sim.FACTIONS[held].name}.`); } } } } }
  // prisoners you got out alive: Marshals pay bounties on outlaws, everyone else pays to get their people back
  rep.prisoners=[]; for(const q of (S.prisoners||[]).filter(q=>q.by===p.id)){ const outlaw=["reaver","blacksun","choir"].includes(q.fac)&&(profile.rep.marshal|0)>=0, pay=outlaw?260:190;
    profile.credits+=pay; profile.rep[outlaw?"marshal":q.fac]=Math.max(-100,Math.min(100,(profile.rep[outlaw?"marshal":q.fac]|0)+(outlaw?4:6))); rep.prisoners.push({name:q.name,fac:q.fac,pay,to:outlaw?"Concord Marshals":Sim.FACTIONS[q.fac].name}); }
  // your old body: anything you didn't take back is still there
  const oldR=S.ents.find(e=>e.kind==="remains"&&e.owner===p.id); if(oldR&&profile.remains&&profile.remains.site===L.id){ profile.remains=oldR.inv.length?{...profile.remains,items:oldR.inv.map(strip)}:null; }
  if(!win&&!p.flags.abandoned){
    const secured=p.inv.filter(it=>it.sec), ins=(profile.insured||[]).slice(); for(const it of secured){ const k=ins.findIndex(q=>q.d===it.d&&(q.r|0)===(it.r|0)); if(k>=0) ins.splice(k,1); } rep.secured=secured.map(it=>({n:Items.name(it),c:rc(it)})); for(const it of secured) World.grant(profile,strip(it));
    rep.insured=ins.map(it=>({n:Items.name(it),c:rc(it)})); for(const it of ins) World.grant(profile,it);
    const left=[...KIT_SLOTS.map(s=>p[s]),...p.inv.filter(it=>!it.sec)].filter(it=>it&&!it.iss).map(strip), pool=ins.slice();
    const lost=left.filter(it=>{ const k=pool.findIndex(q=>q.d===it.d&&(q.r|0)===(it.r|0)); if(k>=0){ pool.splice(k,1); return false; } return true; });
    const prev=profile.remains&&profile.remains.site===L.id?profile.remains.items:[];
    profile.remains=lost.length||prev.length?{site:L.id,siteName:L.name,day:ship().day|0,items:[...lost,...prev].slice(0,14),ammo:{...(p.ammo||{})}}:null; rep.remains=profile.remains?profile.remains.items.length:0; }
  profile.insured=null;
  if(win){
    const bring=it=>{ if(!it||it.iss||it.job||it.d==="datalog") return; World.grant(profile,it); rep.items.push({n:Items.name(it),c:rc(it)}); rep.value+=Math.round(Items.value(it)*.5); };
    for(const s of KIT_SLOTS) bring(p[s]); for(const it of p.inv) bring(it);
    for(const t of AMMO_T){ const n=(p.ammo||{})[t]|0; if(n){ profile.ammo[t]=(profile.ammo[t]|0)+n; rep.ammo[t]=n; } }
    for(const t of MAT_T){ const n=(p.mats||{})[t]|0; if(n){ profile.mats[t]=(profile.mats[t]|0)+n; rep.mats[t]=n; } }
    profile.stats.extracts++; profile.stats.earned+=rep.value; profile.stats.best=Math.max(profile.stats.best,rep.value);
  } else profile.stats.deaths++;
  // data logs you got out with (or sealed in the pouch) go into the codex
  rep.logs=[]; for(const it of p.inv) if(it.d==="datalog"&&it.lg&&(win||it.sec)&&!profile.codex[it.lg]){ profile.codex[it.lg]=ship().day|0; const L=Items.LOGS.find(l=>l.id===it.lg); if(L) rep.logs.push(L.t); p.xp=(p.xp|0)+15; }
  // your nemesis: killed, or made (or made stronger)
  const nemDead=S.ents.find(e=>e.nemesis&&!e.alive&&!e.extracted);
  if(nemDead&&profile.nemesis&&nemDead.name===profile.nemesis.name){ rep.nemesis={killed:1,name:profile.nemesis.name}; profile.nemesis=null; }
  else if(!win&&p.nemSrc&&!p.flags.abandoned){ const N0=profile.nemesis, same=N0&&N0.name===p.nemSrc.name, took=(rep.kit==="starter"?[]:[...KIT_SLOTS.map(k=>p[k]),...p.inv]).filter(it=>it&&!it.iss&&!it.sec&&!it.job&&it.d!=="datalog"&&(Items.slotOf(it)||Items.value(it)>=150)).sort((a,b)=>Items.value(b)-Items.value(a)).slice(0,3).map(strip);
    profile.nemesis={name:p.nemSrc.name,fac:p.nemSrc.fac,look:p.nemSrc.look,w1:p.nemSrc.w1,head:p.nemSrc.head,armor:p.nemSrc.armor,lvl:same?Math.min(5,(N0.lvl|0)+1):1,items:[...(same?N0.items||[]:[]),...took].slice(0,4),since:ship().day|0};
    if(took.length&&profile.remains&&profile.remains.items){ const R0=profile.remains.items; for(const it of took){ const k=R0.findIndex(q=>q.d===it.d&&(q.r|0)===(it.r|0)); if(k>=0) R0.splice(k,1); } rep.remains=R0.length; if(!R0.length) profile.remains=null; }
    rep.nemesis={made:1,name:p.nemSrc.name,fac:p.nemSrc.fac,lvl:profile.nemesis.lvl,took:took.map(it=>Items.name(it))}; }
  // side objectives done and survived; Concord wanted bounties
  rep.sides=[]; if(win) for(const o of S.side||[]){ const D=Sim.SIDES[o.id]; if(o.done&&D){ profile.credits+=D.cr; p.xp=(p.xp|0)+D.xp; rep.sides.push({t:D.t,cr:D.cr}); } }
  if(win&&S.wantedDown){ const W=wantedWeek(), q=W.list.find(z=>z.id===S.wantedDown); if(q&&!W.claimed[q.id]){ W.claimed[q.id]=1; profile.credits+=q.reward; profile.rep.marshal=Math.min(100,(profile.rep.marshal|0)+5); profile.life.wanted=(profile.life.wanted|0)+1; rep.wanted={name:q.name,reward:q.reward}; } }
  // the Daily Op: the first extraction of the day pays out
  if(win&&L.daily&&profile.daily!==L.daily){ profile.daily=L.daily; profile.life.dailies=(profile.life.dailies|0)+1; const cr=700; profile.credits+=cr; p.xp=(p.xp|0)+150;
    const got=[]; let it=null; for(let n=0;n<10&&(!it||Items.rarOf(it)<2||!Items.slotOf(it));n++) it=Items.roll(Math.random,3,["weapon","armor"][n%2]); if(it){ World.grant(profile,it); got.push({n:Items.name(it),c:rc(it)}); }
    const t2=mk({d:["sentry","weldtorch","tripmine","breach"][Math.floor(Math.random()*4)]}); World.grant(profile,t2); got.push({n:Items.name(t2),c:rc(t2)}); rep.daily={cr,xp:150,items:got,name:L.name}; }
  // weapon mastery: every kill counts, even on a raid you don't survive
  rep.mast=[]; { const WK=(p.tally&&p.tally.wk)||{}; for(const [c,n] of Object.entries(WK)){ const b=mastLvl(profile.mastery[c]); profile.mastery[c]=(profile.mastery[c]|0)+n; const a=mastLvl(profile.mastery[c]); if(a>b){ const C=MAST_C.find(q=>q[0]===c); rep.mast.push({c:C?C[1]:c,lvl:MAST_N[a],bonus:mastBonus(c,a)}); } } }
  // what killed you
  if(!win&&!p.flags.abandoned){ const K0=(p.tally&&p.tally.k)||{}; rep.recap={killer:p.killer||p.cause||"",hits:(p.hits||[]).slice(-6),turns:S.turn|0,kills:Object.entries(K0).filter(([k])=>k!=="leader"&&k!=="elite").reduce((a,[,v])=>a+v,0),dealt:(p.tally&&p.tally.dealt)|0,tip:deathTip(p.cause||S.cause||"",p)}; }
  // personal records
  rep.records=[]; { const T=p.tally||{}, K=T.k||{}, kills=Object.entries(K).filter(([k])=>k!=="leader"&&k!=="elite").reduce((a,[,v])=>a+v,0), R0=profile.records, val=Math.round(Sim.lootValue(p)*.5);
    const rec=(k,v,label,fmt,lower)=>{ if(!(v>0)) return; const old=R0[k]; if(old==null||(lower?v<old:v>old)){ if(old!=null) rep.records.push(`${label}: ${fmt(v)} (was ${fmt(old)})`); else rep.records.push(`${label}: ${fmt(v)}`); R0[k]=v; } };
    if(win){ rec("haul",val,"Biggest haul",v=>`${v} cr`); rec("fast",S.turn|0,"Fastest extraction",v=>`${v} turns`,true); }
    rec("kills",kills,"Most kills in one raid",v=>`${v}`); rec("streak",T.best|0,"Longest kill streak",v=>`${v}`); rec("dealt",T.dealt|0,"Most damage in one raid",v=>`${v}`); }
  // lifetime tallies, the week's bounties and medals
  { const T=p.tally||{}, K=T.k||{}, LF=profile.life; LF.k=LF.k||{}; const haul=Sim.lootValue(p);
    if(win){ for(const [k2,v] of Object.entries(K)) LF.k[k2]=(LF.k[k2]|0)+v; for(const k2 of ["takedowns","caches","hacks","searches","disarms","vents"]) LF[k2]=(LF[k2]|0)+(T[k2]|0);
      if(L.signal) LF.signals=(LF.signals|0)+1; LF.prisoners=(LF.prisoners|0)+(rep.prisoners||[]).length; LF.jobs=(LF.jobs|0)+(rep.jobs||[]).length; if((rep.jobs||[]).some(j=>j.type==="sabotage"||j.tgt==="choir")) LF.choirJob=1;
      const B=bountyWeek(); for(const q of B.list){ const b=BOUNTIES.find(z=>z.id===q.id); if(!b||q.claimed) continue; if(b.k) q.prog+=K[b.k]|0; if(b.s) q.prog+=T[b.s]|0; if(b.x==="haul"&&haul>=1500) q.prog+=1; if(b.x==="signal"&&L.signal) q.prog+=1; if(b.x==="job") q.prog+=(rep.jobs||[]).length; if(b.x==="daily"&&rep.daily) q.prog+=1; } }
    const reg=World.regionOf(L); LF.regions={...(LF.regions||{}),[reg]:1};
    const has=id=>profile.medals[id], earn=[]; const give=id=>{ if(!has(id)){ profile.medals[id]=ship().day|0; earn.push(MEDALS.find(m=>m.id===id).t); } };
    if(win){ if(profile.stats.extracts>=0) give("first"); if(profile.stats.extracts>=10) give("ten"); if((K.matriarch|0)>0) give("queen"); if(haul>=2000) give("rich"); if(L.id==="throne") give("throne"); if(S.ev&&S.ev.type==="meltdown"&&S.ev.on) give("melt"); }
    if((LF.takedowns|0)>=10) give("ghost"); if(Object.keys(LF.regions).length>=3) give("wander"); if((LF.signals|0)>=5) give("signals"); if((LF.hacks|0)>=5) give("net"); if((LF.caches|0)>=10) give("caches");
    if(Object.keys(profile.codex).length>=12) give("archive"); if((LF.prisoners|0)>=3) give("warden"); if(Object.values(profile.rep||{}).some(v=>v>=50)) give("ally"); if(LF.choirJob) give("choir");
    if((LF.k.elite|0)>=10) give("mutant"); if((LF.k.custodian|0)>=1) give("giant"); if((LF.wanted|0)>=3) give("law"); if((LF.k.nest|0)>=10) give("exterm"); if(rep.nemesis&&rep.nemesis.killed) give("vengeance"); if((LF.disarms|0)>=10) give("sapper"); if((LF.dailies|0)>=5) give("dailies"); if(Object.values(profile.mastery).some(v=>(v|0)>=MAST_T[5])) give("master");
    if([...profile.stash,...(win?p.inv:[])].some(it=>Items.rarOf(it)>=4)) give("legend");
    rep.medals=earn; }
  // experience: kept in full when you get out, half when you don't
  { const before=levelOf(profile.xp), base=Math.round(((p.xp|0)+(win?40:0)+(rep.contract?60:0))*(p.morale?1.1:1)), got=win?base:Math.floor(base/2); profile.xp=(profile.xp|0)+got; rep.xp={got,full:base,level:levelOf(profile.xp),up:levelOf(profile.xp)>before}; }
  // injuries come home with you, unless the ship's medbay patches you up
  { const md=(ship().up&&ship().up.medbay)|0; const fr=win?{...(p.frac||{})}:{}, inf=win?(p.inf|0):0; profile.injury={frac:md>=1?{}:fr,inf:md>=2?0:inf}; rep.treated=md&&(Object.keys(fr).length||inf)?true:false; }
  // standing with the factions you met, and the Marshals' bounty on raiders
  rep.standing=[]; for(const [f,n] of Object.entries(S.repd||{})){ if(!n) continue; const was=profile.rep[f]|0; profile.rep[f]=Math.max(-100,Math.min(100,was+n)); rep.standing.push({f,n}); }
  { const k=S.kills||{}, b=((k.reaver|0)+(k.blacksun|0)+(k.choir|0)); if(b&&(profile.rep.marshal|0)>=0){ const pay=b*40; profile.credits+=pay; rep.bounty={n:b,pay}; } }
  if(p.food!=null){ profile.food=win?p.food:Math.max(25,p.food); profile.water=win?p.water:Math.max(25,p.water); }
  profile.active=null; profile.last=rep; save();
}
function returnToBase(){
  if(!S||S.mode!=="raid") return;
  if(inSquad()&&!Net.host) return;          // crew follow the leader back aboard
  settlePersonal();
  if(inSquad()) hostBroadcastShip(true); else boardShipCrew([{id:"p1",name:"You",loadout:{}}]);
}


// ---------- ship input ----------
$("s-use").onclick=()=>send({type:"interact"});
$("s-crew").onclick=()=>openPanel("crew");
$("s-inv").onclick=()=>openPanel("inventory");
$("s-mode").onclick=()=>{ setMode(mode==="pc"?"touch":"pc"); if(S&&S.mode==="ship") renderShipHud(); };
$("dr-new").textContent="Abandon run";

// ---------- main menu ----------
function showMenu(){ const m=$("menu"); $("menu-art").src=emblemURL(); paintMenuStars($("menu-stars")); $("m-ship").textContent=(ship().name||"Lark").replace(/^Ninefold /,"");
  const st=profile.stats; $("m-stats").textContent=`${st.raids} raids · ${st.extracts} extracted · ${st.deaths} lost · ${profile.credits} cr`; $("m-save").textContent=Store.mode==="cloud"?"Saved to your account":"Saved on this device";
  $("m-mode").textContent=mode==="pc"?"Controls: mouse & keys":"Controls: touch"; $("m-sound").textContent=sndLabel(); $("m-music").textContent=Snd.cfg().music>0?"Music on":"Music off"; $("m-gfx").textContent=LOWFX?"Low graphics":"High graphics"; m.hidden=false; }
function hideMenu(){ $("menu").hidden=true; }
if($("m-pro")) $("m-pro").onclick=()=>{ if(typeof playPrologue==="function") playPrologue(null); };
$("m-play").onclick=()=>{ if(!profile.seenPro&&typeof playPrologue==="function"){ profile.seenPro=1; save(); playPrologue(()=>$("m-play").onclick()); return; } hideMenu(); if(!profile.welcomed){ profile.welcomed=true; save(); } toast(`Aboard. Walk to a terminal and press ${mode==="pc"?"F":"USE"}. ${mode==="pc"?"I or Tab":"The Inventory button"} opens your kit.`); };
$("m-crew").onclick=()=>{ hideMenu(); openPanel("crew"); };
$("m-ward").onclick=()=>{ hideMenu(); openPanel("wardrobe"); };
const sndLabel=()=>{ const c=Snd.cfg(); return c.on?`Sound ${Math.round(c.vol*100)}%`:"Sound off"; };
$("m-sound").onclick=()=>{ Snd.unlock(); const c=Snd.cfg(), steps=[0,.35,.65,1], i=c.on?steps.findIndex(v=>v>=c.vol-.01):0; Snd.setVol(steps[(i+1)%steps.length]); $("m-sound").textContent=sndLabel(); Snd.play("click"); };
$("m-gfx").onclick=()=>{ setLowFx(!LOWFX); $("m-gfx").textContent=LOWFX?"Low graphics":"High graphics"; };
$("m-music").onclick=()=>{ Snd.unlock(); const c=Snd.cfg(); Snd.setMusic(c.music>0?0:.5); $("m-music").textContent=Snd.cfg().music>0?"Music on":"Music off"; };
$("m-mode").onclick=()=>{ setMode(mode==="pc"?"touch":"pc"); $("m-mode").textContent=mode==="pc"?"Controls: mouse & keys":"Controls: touch"; };
$("s-menu").onclick=()=>{ closePanel(); showMenu(); };

// ---------- boot ----------
function start(data){
  let m=null; try{ m=localStorage.getItem("hb-mode"); }catch(e){}
  const coarse=window.matchMedia&&window.matchMedia("(pointer:coarse)").matches;
  mode=m||(coarse||window.innerWidth<700?"touch":"pc"); document.body.dataset.mode=mode;
  profile=fixProfile((data&&data.profile)||loadLocal());
  window.addEventListener("resize",()=>{ resize(); });
  window.claude?.hot?.snapshot?.(()=>({profile,state:S}));
  resize(); requestAnimationFrame(loop);
  const st=data&&data.state;
  if(st&&st.mode==="raid"&&st.status==="playing"&&Array.isArray(st.tiles)&&st.ents.some(e=>e.kind==="player"&&e.w1!==undefined)){ S=st; S.fx=[]; afterChange(); $("r-site").textContent="Contract · "+S.site; }
  else {
    if(profile.active){ profile.stats.deaths++; profile.last={win:false,items:[],value:0,site:World.loc(profile.active.site||"ks9").name,cause:"Contact lost. Your last raid ended when the link dropped.",kit:profile.active.kit}; profile.active=null; save(); boardShip(); openPanel("debrief"); }
    else { boardShip(); showMenu(); }
  }
  Store.init();
}

document.addEventListener("click",e=>{ if(typeof Snd!=="undefined"&&e.target.closest&&e.target.closest("button")) Snd.play("click"); },true);

// =================== IN TRANSIT: things that happen between the stars ===================
// A jump has a chance of an encounter: a choice with consequences for credits, fuel, standing,
// the war and your health. Only the solo player or the squad leader gets them (the ship is theirs).
let ENC=null;
const r01=()=>Math.random(), pickR=a=>a[Math.floor(Math.random()*a.length)];
function encSync(){ save(); if(typeof inSquad==="function"&&inSquad()&&Net.host) hostBroadcastShip(false); if(S&&S.mode==="ship") renderShipHud(); }
function grantMats(o){ for(const [m,n] of Object.entries(o)) profile.mats[m]=(profile.mats[m]|0)+n; return Object.entries(o).map(([m,n])=>`${n} ${Items.MATS[m].toLowerCase()}`).join(", "); }
const ENCOUNTERS=[
  {id:"pod",title:"A lifepod",text:"A lifepod tumbles across your bow, its distress beacon shrieking the same three notes on a loop. Frost on the viewport. Something might be alive in there.",choices:[
    {t:"Bring it aboard",go:()=>{ const r=r01(); if(r<.5){ profile.credits+=260; profile.rep.guild=Math.min(100,(profile.rep.guild|0)+5); return "A half-frozen Guild miner, alive. You thaw her out and drop her at the next relay. The Guild wires 260 cr and remembers your name. (+260 cr, Guild standing +5)"; }
      if(r<.8) return `Empty. Whoever was in it got out, or got eaten. You strip it anyway: ${grantMats({parts:2,circ:2})}.`;
      profile.injury=profile.injury||{frac:{},inf:0}; profile.injury.inf=Math.max(1,profile.injury.inf|0); return "The pod hisses open and a husk comes out swinging. You put it down with a fire axe, but not before it rakes your arm. The wound is already hot. (Infected: get antibiotics or the medbay.)"; }},
    {t:"Leave it",go:()=>"You let it tumble on. The beacon fades behind you, still screaming."}]},
  {id:"toll",title:"Reaver toll",when:()=>true,text:()=>(profile.rep.reaver|0)>=20?"A Reaver gunship swings in close, guns tracking, then their captain recognises your transponder and waves you through with a grin full of steel.":"A Reaver gunship drops out of the dark, guns tracking you. \"Toll's 150. Pay, or we take it out of your hull.\"",choices:()=>(profile.rep.reaver|0)>=20?[{t:"Wave back",go:()=>"Friends in low places. They peel off toward someone less lucky."}]:[
    {t:"Pay 150 cr",ok:()=>profile.credits>=150,go:()=>{ profile.credits-=150; profile.rep.reaver=Math.min(100,(profile.rep.reaver|0)+2); return "You pay. They laugh, and let you go. (−150 cr, Reaver standing +2)"; }},
    {t:"Run for it",go:()=>{ if(r01()<.55) return "You redline the drive and slip away before they get a lock."; const sh=ship(); sh.fuel=Math.max(0,sh.fuel-1); sh.day+=1; return "They rake your engines as you run. You limp clear, a day late and a fuel cell lighter. (−1 fuel, +1 day)"; }},
    {t:"Fight",go:()=>{ if(r01()<.45){ profile.rep.reaver=Math.max(-100,(profile.rep.reaver|0)-6); return `Your point-defence finds their fuel line. They flee trailing fire and debris, which you scoop up: ${grantMats({scrap:4,prop:2,parts:1})}. (Reaver standing −6)`; } const sh=ship(); sh.fuel=Math.max(0,sh.fuel-2); profile.food=Math.max(0,profile.food-15); return "It goes badly. A torpedo cracks the galley and a fuel tank. They break off when they get bored. (−2 fuel, −15 food)"; }}]},
  {id:"cargo",title:"Drifting cargo",text:"A cargo pod tumbles in your path, lost from some freighter's chain. The manifest seal is still green.",choices:[
    {t:"Crack it open",go:()=>{ if(r01()<.8){ const it=Items.roll(Math.random,2,pickR(["val","weapon","armor","med"])); World.grant(profile,it); return `Salvage: ${grantMats({scrap:2+Math.floor(r01()*3),[pickR(["prop","circ","org"])]:2})} and a ${Items.name(it)} (in your stash).`; } const sh=ship(); sh.fuel=Math.max(0,sh.fuel-1); return "Rigged. The pod blows when you cut the seal and takes a fuel cell with it. (−1 fuel)"; }},
    {t:"Leave it",go:()=>"Not worth the risk. You let it drift."}]},
  {id:"flare",title:"Solar flare",text:"Your instruments scream. A star you're passing is throwing a tantrum, and the radiation front will hit in minutes.",choices:[
    {t:"Ride it out in the shadow of a moon",go:()=>{ ship().day+=1; return "You hide and wait. It costs you a day, but the electronics live. (+1 day)"; }},
    {t:"Burn through it",ok:()=>ship().fuel>=1,go:()=>{ ship().fuel-=1; return r01()<.3?"You make it through, mostly. The stash locker's lights flicker for an hour. (−1 fuel)":"You punch through at full burn. (−1 fuel)"; }}]},
  {id:"trader",title:"Vanta skiff",text:"A sleek Vanta Combine skiff matches your course and opens a channel. \"Long way between markets. Need anything?\"",choices:[
    {t:"Buy a fuel cell (150 cr)",ok:()=>profile.credits>=150&&ship().fuel<ship().fuelMax,go:()=>{ profile.credits-=150; ship().fuel+=1; return "A drone ferries the cell across. (+1 fuel, −150 cr)"; }},
    {t:"Buy a medkit (110 cr)",ok:()=>profile.credits>=110,go:()=>{ profile.credits-=110; World.grant(profile,mk({d:"medkit",r:0})); return "A medkit, sealed and current. (In your stash, −110 cr)"; }},
    {t:"Sell your scrap (12 cr each)",ok:()=>(profile.mats.scrap|0)>0,go:()=>{ const n=profile.mats.scrap|0, c=n*12; profile.mats.scrap=0; profile.credits+=c; return `They take ${n} scrap off your hands for ${c} cr.`; }},
    {t:"Wave them off",go:()=>"\"Your loss.\" The skiff peels away."}]},
  {id:"choir",title:"The Choir sings",text:"The comms fill with the Iron Choir's song: a thousand voices, perfectly in tune, singing a word you almost know. It's coming from a relay buoy nearby.",choices:[
    {t:"Trace it and burn the relay (lose a day)",go:()=>{ const sh=ship(); sh.day+=1; World.pushChoir(sh,-6,"A crew in transit traced and burned a Choir relay buoy."); profile.xp=(profile.xp|0)+40; return "You find the buoy and burn it to slag. The song cuts off mid-word. (+40 XP, the Choir is pushed back, +1 day)"; }},
    {t:"Listen",go:()=>{ World.pushChoir(ship(),3,"The Choir's song is spreading along the trade lanes."); profile.xp=(profile.xp|0)+60; return "You listen until you understand it. You wish you hadn't. Something behind your eyes hums along. (+60 XP, the Choir grows louder)"; }},
    {t:"Cut the comms",go:()=>"Silence. Your hand is shaking on the switch."}]},
  {id:"patrol",title:"Concord patrol",text:()=>(profile.rep.marshal|0)<0?"A Concord Marshal cutter lights you up. \"Contractor, you have outstanding fines. Heave to.\"":"A Concord Marshal cutter pulls alongside. \"Routine sweep, contractor. Seen anything we should know about?\"",choices:()=>(profile.rep.marshal|0)<0?[
    {t:"Pay the 120 cr fine",ok:()=>profile.credits>=120,go:()=>{ profile.credits-=120; profile.rep.marshal=Math.min(100,(profile.rep.marshal|0)+5); return "You pay. They log it. (−120 cr, Marshal standing +5)"; }},
    {t:"Run",go:()=>{ const sh=ship(); sh.fuel=Math.max(0,sh.fuel-1); profile.rep.marshal=Math.max(-100,(profile.rep.marshal|0)-3); return "You outrun a cutter, which they won't forget. (−1 fuel, Marshal standing −3)"; }}]:[
    {t:"Share your sensor logs",go:()=>{ profile.credits+=100; profile.rep.marshal=Math.min(100,(profile.rep.marshal|0)+3); return "They copy your logs and pay a finder's fee. (+100 cr, Marshal standing +3)"; }},
    {t:"Say nothing",go:()=>"\"Fly safe.\" They don't sound like they mean it."}]},
  {id:"body",title:"A body in the dark",text:"Something bumps the hull. A body in a cracked suit, spinning slowly, one glove still clutching a satchel.",choices:[
    {t:"Pull it in",go:()=>{ const it=Items.roll(Math.random,2,pickR(["val","weapon","med","armor","throw"])); World.grant(profile,it); const L=Items.LOGS.filter(l=>!profile.codex[l.id]); let extra=""; if(L.length&&r01()<.5){ const l=pickR(L); profile.codex[l.id]=ship().day|0; extra=` A data log in the satchel goes in your codex: "${l.t}".`; } return `You give them a spacer's burial afterwards. The satchel held a ${Items.name(it)} (in your stash).${extra}`; }},
    {t:"Let them drift",go:()=>"You let them sail on. Someone, somewhere, is still waiting for them."}]},
  {id:"ghost",title:"Sensor ghost",text:"A contact flickers at the edge of your sensors: there, then gone, then there again. It doesn't answer hails.",choices:[
    {t:"Investigate (lose a day)",go:()=>{ const sh=ship(); sh.day+=1; if(r01()<.55){ const it=Items.roll(Math.random,3,pickR(["val","weapon","armor"])); World.grant(profile,it); return `A smuggler's cache, cloaked and forgotten. Inside: a ${Items.name(it)} (in your stash). (+1 day)`; } return "You chase it for a day. Nothing. Just you, the dark and a feeling of being watched. (+1 day)"; }},
    {t:"Ignore it",go:()=>"You log it and move on. It follows you for an hour, then doesn't."}]},
];
function maybeEncounter(days){ if(Math.random()>.35+.05*Math.min(4,(days|0)-1)) return; const E=pickR(ENCOUNTERS); ENC={...E,title:E.title,txt:typeof E.text==="function"?E.text():E.text,ch:(typeof E.choices==="function"?E.choices():E.choices),res:null}; setTimeout(()=>{ if(S&&S.mode==="ship"&&!panelKind) openPanel("encounter"); else ENC=null; },300); }
function viewEncounter(){ if(!ENC) return "<p>Nothing on the scopes.</p>";
  return `<section class="panel h-card report"><p>${esc(ENC.txt)}</p>${ENC.res?`<p class="risk good">${esc(ENC.res)}</p><div class="bar-row"><button data-act="close">Carry on</button></div>`:`<div class="enc-ch">${ENC.ch.map((c,i)=>`<button data-act="enc:${i}" ${c.ok&&!c.ok()?"disabled":""}>${esc(c.t)}</button>`).join("")}</div>`}</section>`; }
function resolveEncounter(i){ if(!ENC||ENC.res) return; const c=ENC.ch[i]; if(!c||(c.ok&&!c.ok())) return; ENC.res=c.go(); profile.life.encounters=(profile.life.encounters|0)+1; encSync(); renderPanel(); }

// =================== VOID RUNNER: the break-room arcade cabinet ===================
// An original little arcade game: steer your skiff through falling debris, grab scrap, survive.
let VR=null;
function viewArcade(){ const A=profile.arcade, today=ship().day|0;
  setTimeout(vrInit,0);
  return `<section class="panel h-card"><div class="vr-wrap"><canvas id="vr-c" width="240" height="300"></canvas><div class="vr-side"><p><b>High score: ${A.best|0}</b></p><p class="risk">←/→ or A/D to steer (or tap the left and right halves of the screen). Dodge the debris, grab the yellow scrap, and catch the blue shield.</p><p class="risk">Score 600+ for the daily prize from Hesk: 60 cr (${A.day===today?"already won today":"not won yet today"}). Score 1500 for a medal.</p><button data-act="vr-start">${VR&&VR.over?"Play again":"Insert credit"}</button></div></div></section>`; }
function vrInit(){ const c=$("vr-c"); if(!c) return; if(!VR) VR={over:true,score:0}; c.onpointerdown=e=>{ const r=c.getBoundingClientRect(); VR.touch=(e.clientX-r.left)<r.width/2?-1:1; }; c.onpointerup=c.onpointerleave=()=>{ if(VR) VR.touch=0; }; vrDraw(); }
function vrStart(){ VR={over:false,score:0,t:0,x:120,hp:3,shield:0,rocks:[],bits:[],keys:{},touch:0,last:performance.now(),spawn:0,inv:0}; if(typeof Snd!=="undefined") Snd.play("levelup"); requestAnimationFrame(vrLoop); }
document.addEventListener("keydown",e=>{ if(panelKind!=="arcade"||!VR) return; const k=e.key.toLowerCase(); if(["arrowleft","arrowright","a","d"].includes(k)){ VR.keys[k]=1; e.preventDefault(); e.stopPropagation(); } if((k===" "||k==="enter")&&VR.over){ e.preventDefault(); vrStart(); } },true);
document.addEventListener("keyup",e=>{ if(VR&&VR.keys) VR.keys[e.key.toLowerCase()]=0; },true);
function vrLoop(now){ if(!VR||VR.over) return; if(panelKind!=="arcade"){ VR.over=true; return; } const dt=Math.min(.05,(now-VR.last)/1000); VR.last=now; VR.t+=dt; const sp=1+VR.t/25;
  const dir=(VR.keys.arrowleft||VR.keys.a?-1:0)+(VR.keys.arrowright||VR.keys.d?1:0)+VR.touch; VR.x=Math.max(10,Math.min(230,VR.x+dir*170*dt)); VR.score+=dt*10*sp; VR.inv=Math.max(0,VR.inv-dt); VR.shield=Math.max(0,VR.shield-dt);
  VR.spawn-=dt; if(VR.spawn<=0){ VR.spawn=Math.max(.18,.7-VR.t/60); const big=Math.random()<.25; VR.rocks.push({x:10+Math.random()*220,y:-12,r:big?11:5+Math.random()*4,v:(60+Math.random()*50)*sp,rot:Math.random()*6,spin:(Math.random()-.5)*4}); if(Math.random()<.22) VR.bits.push({x:10+Math.random()*220,y:-8,v:70*sp,k:Math.random()<.12?"shield":"scrap"}); }
  for(const r of VR.rocks){ r.y+=r.v*dt; r.rot+=r.spin*dt; if(!VR.inv&&Math.hypot(r.x-VR.x,r.y-278)<r.r+6){ r.y=999; if(VR.shield>0){ VR.shield=0; if(typeof Snd!=="undefined") Snd.play("glass"); } else { VR.hp--; VR.inv=1.2; if(typeof Snd!=="undefined") Snd.play("hurt"); if(VR.hp<=0) return vrOver(); } } }
  for(const b of VR.bits){ b.y+=b.v*dt; if(Math.hypot(b.x-VR.x,b.y-278)<12){ b.y=999; if(b.k==="shield") VR.shield=8; else VR.score+=50; if(typeof Snd!=="undefined") Snd.play("pickup"); } }
  VR.rocks=VR.rocks.filter(r=>r.y<320); VR.bits=VR.bits.filter(b=>b.y<320); vrDraw(); requestAnimationFrame(vrLoop); }
function vrOver(){ VR.over=true; const sc=Math.floor(VR.score), A=profile.arcade, today=ship().day|0; let msg=`GAME OVER · ${sc}`; if(sc>(A.best|0)){ A.best=sc; msg+=" · NEW HIGH SCORE"; }
  if(sc>=600&&A.day!==today){ A.day=today; profile.credits+=60; msg+=" · Hesk pays up: +60 cr"; } if(sc>=1500) awardMedal("arcade"); save(); toast(msg); if(typeof Snd!=="undefined") Snd.play("die"); vrDraw(); setTimeout(()=>{ if(panelKind==="arcade") renderPanel(); },900); }
function vrDraw(){ const c=$("vr-c"); if(!c||!VR) return; const g=c.getContext("2d"), t=performance.now()/1000; g.fillStyle="#020804"; g.fillRect(0,0,240,300);
  for(let i=0;i<40;i++){ const y=((i*53+t*(20+(i%3)*25))%300), x=(i*97)%240; g.fillStyle=i%3?"#1a3a22":"#3a6a44"; g.fillRect(x,y,1,1+(i%3)); }
  for(const r of VR.rocks||[]){ g.save(); g.translate(r.x,r.y); g.rotate(r.rot); g.fillStyle="#2f5a3a"; g.beginPath(); for(let k=0;k<7;k++){ const a=k/7*6.283, rr=r.r*(.75+((k*37)%10)/30); g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); } g.fill(); g.strokeStyle="#7aff9a"; g.lineWidth=1; g.stroke(); g.restore(); }
  for(const b of VR.bits||[]){ g.fillStyle=b.k==="shield"?"#5ad0ff":"#ffd060"; g.fillRect(b.x-3,b.y-3,6,6); g.fillStyle="#fff"; g.fillRect(b.x-1,b.y-1,2,2); }
  if(!VR.over||VR.hp>0){ const blink=VR.inv&&((t*10)|0)%2; if(!blink){ g.fillStyle="#9affb0"; g.beginPath(); g.moveTo(VR.x,268); g.lineTo(VR.x-8,286); g.lineTo(VR.x,282); g.lineTo(VR.x+8,286); g.fill(); g.fillStyle="#ffb040"; g.fillRect(VR.x-1,286,2,3+((t*20)|0)%3); } if(VR.shield>0){ g.strokeStyle=`rgba(90,208,255,${.5+.3*Math.sin(t*8)})`; g.beginPath(); g.arc(VR.x,278,13,0,6.283); g.stroke(); } }
  g.fillStyle="#7aff9a"; g.font="bold 12px monospace"; g.fillText(String(Math.floor(VR.score||0)).padStart(6,"0"),6,16); g.fillText("♥".repeat(Math.max(0,VR.hp|0)),190,16);
  if(VR.over){ g.fillStyle="rgba(0,0,0,.55)"; g.fillRect(0,110,240,70); g.fillStyle="#9affb0"; g.textAlign="center"; g.font="bold 18px monospace"; g.fillText(VR.t?"GAME OVER":"VOID RUNNER",120,140); g.font="11px monospace"; g.fillText(VR.t?`SCORE ${Math.floor(VR.score)}`:"INSERT CREDIT",120,160); g.textAlign="left"; }
  for(let y=0;y<300;y+=3){ g.fillStyle="rgba(0,0,0,.18)"; g.fillRect(0,y,240,1); } }

// =================== BONES: dice with Hesk at the galley bar ===================
let BONES=null;
const DIE=["","⚀","⚁","⚂","⚃","⚄","⚅"];
function bonesScore(d){ const c={}; for(const v of d) c[v]=(c[v]|0)+1; const n=Math.max(...Object.values(c)), sum=d.reduce((a,b)=>a+b,0), top=+Object.keys(c).find(k=>c[k]===n); return {rank:n===3?3:n===2?2:1,val:n===3?top*100:n===2?top*10+sum/100:sum,label:n===3?`Triple ${top}s`:n===2?`Pair of ${top}s`:`${sum}`}; }
function viewBones(){ const B=BONES; return `<section class="panel h-card"><p>Hesk slides three yellowed knucklebone dice across the bar. "Triples beat pairs, pairs beat the higher total. Ties go to the house, because it's my house."</p>
  ${B?`<div class="bones"><div><span>You</span><b>${B.me.map(v=>DIE[v]).join(" ")}</b><i>${esc(bonesScore(B.me).label)}</i></div><div><span>Hesk</span><b>${B.hk.map(v=>DIE[v]).join(" ")}</b><i>${esc(bonesScore(B.hk).label)}</i></div></div><p class="risk ${B.win?"good":"bad"}">${esc(B.msg)}</p>`:""}
  <div class="bar-row">${[10,50,100,250].map(w=>`<button data-act="bones:${w}" ${profile.credits>=w?"":"disabled"}>Bet ${w} cr</button>`).join("")}</div><p class="risk">Credits: ${profile.credits}. Bones won: ${profile.life.bonesW|0}, lost: ${profile.life.bonesL|0}.</p></section>`; }
function bonesRoll(w){ if(!(w>0)||profile.credits<w) return; const r=()=>1+Math.floor(Math.random()*6), me=[r(),r(),r()], hk=[r(),r(),r()], a=bonesScore(me), b=bonesScore(hk), win=a.rank>b.rank||(a.rank===b.rank&&a.val>b.val);
  profile.credits+=win?w:-w; profile.life[win?"bonesW":"bonesL"]=(profile.life[win?"bonesW":"bonesL"]|0)+1;
  const msg=win?(a.rank===3?`Triple! Hesk swears in four languages and pays ${w} cr.`:`You take ${w} cr off him. "Beginner's luck," he mutters.`):(a.rank===b.rank&&a.val===b.val?`A tie. House rules: Hesk keeps your ${w} cr.`:`Hesk rakes in your ${w} cr with a grin full of gold teeth.`);
  BONES={me,hk,win,msg}; if(typeof Snd!=="undefined") Snd.play(win?"pickup":"search"); save(); renderPanel(); }
// =================== JUKEBOX ===================
let jukeOn=-1;
const SONGS=[["Rust Waltz","a slow three-four for dead stations"],["Ninefold Blues","the dockworkers' lament"],["Low Orbit","something to fall asleep to"],["Hymn for the Drowned","sung on Saint ships at a burial"]];
function viewJuke(){ return `<section class="panel h-card"><p>A battered jukebox wired into the galley speakers. Somebody scratched "PLAY SOMETHING ELSE" into the glass.</p><div class="enc-ch">${SONGS.map(([n,d],i)=>`<button data-act="juke:${i}" ${jukeOn===i?'class="on"':""}>${jukeOn===i?"■ ":"▶ "}${esc(n)} <small style="opacity:.6;margin-left:8px">${esc(d)}</small></button>`).join("")}<button class="plain" data-act="juke:-1">Silence</button></div><p class="risk">Plays while you're aboard. It stops when you board a derelict.</p></section>`; }

// =================== REST: sleep off your injuries in your bunk ===================
function viewRest(){ const I=profile.injury||{frac:{},inf:0}, inj=[...Object.keys(I.frac||{}).map(l=>`a broken ${Sim.LNAME[l]}`),...(I.inf?["an infected wound"]:[])], lead=!inSquad()||Net.host;
  return `<section class="panel h-card"><p>Your bunk. You're carrying ${inj.length?inj.join(" and "):"nothing that needs rest"}. Two days of real sleep, bad food and the ship's medical kit will set bones and break a fever.</p><p class="risk">Costs 2 days (the ship stays put) and some food and water.${lead?"":" Only the squad leader can let days pass."}</p><div class="bar-row"><button data-act="rest" ${inj.length&&lead?"":"disabled"}>Rest for 2 days</button><button class="plain" data-act="close">Not now</button></div></section>`; }
function doRest(){ if(inSquad()&&!Net.host) return; const I=profile.injury||{frac:{},inf:0}; if(!Object.keys(I.frac||{}).length&&!I.inf) return; profile.injury={frac:{},inf:0}; const sh=profile.ship; sh.day=(sh.day|0)+2; if(World.warTick) World.warTick(sh,2); travelHunger(2); save(); if(inSquad()) hostBroadcastShip(false); closePanel(); toast("Two days of sleep. Your bones have set and the fever is gone."); if(S&&S.mode==="ship") renderShipHud(); }
