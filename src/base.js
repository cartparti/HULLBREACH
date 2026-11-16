// ============================ SHIP BASE =============================
// Personal save (credits, stash, ammo, materials, looks, stats, kit) + the
// crew ship (World ship state). Signed-in players save to db at
// data/users/<id>/save.
const SAVE_V=2, KIT_SLOTS=["w1","w2","melee","head","armor","legs","acc","light","pack"], SLOT_NAME={w1:"Primary",w2:"Secondary",melee:"Melee",head:"Helmet",armor:"Chest",legs:"Legs",acc:"Accessory",light:"Light",pack:"Pack"};
const ISSUED={}; // nothing is issued: you start in your clothes and find or craft the rest
const EMPTY_TXT={w1:"No gun",w2:"A second gun. Swap with R or the swap button.",melee:"Bare hands and a wrench",head:`Bare head · ${Items.CLOTHES_O2} O₂ rebreather`,armor:"Just your shirt",legs:"Just your trousers",acc:"Nothing. Find scarves, capes, charms, lamps and stranger things",light:"No light. Derelicts are very dark",pack:`Pockets · ${Items.POCKETS} slots`};
let profile=null, panelKind=null, panelSub=null, mapSel=null, stashFilter="all", stashSel=null, armed={}, invSel=null;
const itemInfo=World.itemInfo, mk=World.mkItem, AMMO_T=Object.keys(Items.AMMO), MAT_T=Object.keys(Items.MATS);
function newProfile(){ return {v:SAVE_V,updated:0,credits:300,
  stash:[mk({d:"flashlight"}),mk({d:"bandage"}),mk({d:"bandage"}),mk({d:"o2"}),mk({d:"ration"}),mk({d:"waterflask"})],
  ammo:{pistol:12},mats:{scrap:10,prop:3,circ:3,org:4,parts:0,core:0},food:80,water:80,gotLight:1,look:{c:"red",v:"amber",k:"plume",s:1,h:2,hc:1,f:0,e:0,t:0,tc:0,b:0,bc:4,bt:4},unlocks:{cloak:[],visor:[],crest:[]},
  stats:{raids:0,extracts:0,deaths:0,earned:0,best:0,contracts:0},kit:{type:"starter",w1:null,w2:null,melee:null,armor:null,pack:null,inv:[],ammo:{}},
  squad:"solo",last:null,active:null,ship:World.newShip(),welcomed:false}; }
// v1 saves: gear ids and a shared round count become real items and pistol ammo
function migrate(p){ const d=newProfile();
  const conv=q=>{ if(q.d) return q; if(q.kind==="gear"&&Items.def(q.gear)) return {d:q.gear,r:0}; if(Items.def(q.kind)) return {d:q.kind,r:q.kind==="medkit"?1:0};
    if(q.kind==="valuable"||q.kind==="val"){ const i=Math.max(0,Items.VALS.findIndex(v=>v[0]===q.name)); return {d:"val"+i,r:0,v:q.value||Items.VALS[i][1]}; } return null; };
  d.credits=p.credits|0; d.stats={...d.stats,...(p.stats||{})}; d.ship=p.ship||d.ship; d.welcomed=!!p.welcomed;
  d.stash=(p.stash||[]).map(conv).filter(Boolean).map(mk); d.ammo={pistol:(p.rounds|0)}; return d; }
function fixProfile(p){ const d=newProfile(); if(!p) return d; if(p.v===1) p=migrate(p); if(p.v!==SAVE_V) return d;
  p.stats={...d.stats,...(p.stats||{})}; p.kit={...d.kit,...(p.kit||{})}; if(!Array.isArray(p.kit.inv)) p.kit.inv=[]; p.kit.ammo=p.kit.ammo||{};
  p.stash=Array.isArray(p.stash)?p.stash.filter(q=>q&&Items.def(q.d)):[]; for(const q of p.stash) if(!q.uid) Object.assign(q,mk(q));
  p.ammo=p.ammo||{}; p.mats=p.mats||{}; if(p.food==null) p.food=80; if(p.water==null) p.water=80; if(!p.gotLight){ p.gotLight=1; p.stash.push(mk({d:"flashlight"})); } p.look={...d.look,...(p.look||{})}; p.unlocks={cloak:[],visor:[],crest:[],...(p.unlocks||{})};
  p.ship=p.ship&&World.loc(p.ship.loc)?{...World.newShip(),...p.ship}:World.newShip(); return p; }
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
const strip=it=>{ if(!it) return null; const o={d:it.d,r:it.r|0}; if(it.l) o.l=it.l; if(it.v) o.v=it.v; if(it.n) o.n=it.n; if(it.iss) o.iss=1; return o; };
const rc=it=>Items.RAR[Items.rarOf(it)].col;
const nmHTML=it=>`<b style="color:${rc(it)}">${esc(Items.name(it))}</b>`;
const capOf=(pack,r)=>(pack?Items.stats(pack).slots:Items.POCKETS)+(r?["head","armor","legs","acc"].reduce((a,k)=>a+((r[k]&&Items.stats(r[k]).slots)||0),0):0);
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
function lookOfKit(r){ r=r||kitResolved(); const g=r.w1||r.w2, d=k=>r[k]?r[k].d:null; return {...profile.look,hd:d("head"),a:d("armor"),lg:d("legs"),ac:d("acc"),li:r.light?1:0,w:g?g.d:null}; }
function slotHTML(it,title,n){ if(!it) return `<div class="slot" title="${title||"Empty"}"></div>`;
  return `<div class="slot" title="${esc(title||Items.name(it))}" style="border-color:${rc(it)}"><img alt="${esc(Items.name(it))}" src="${iconFor(it)}">${n>1?`<span class="n">×${n}</span>`:""}</div>`; }
function toast(msg){ const t=$("h-toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,3000); }
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
function onFlavor(kind){
  const F=FLAVOR[kind]; if(!F) return; const lines=F[0]; toast(lines[(Math.random()*lines.length)|0]);
  if(typeof inSquad==="function"&&inSquad()&&Number.isFinite(arguments[1])) emit({t:"fx",kind,x:arguments[1],y:arguments[2]});
  if(F[1]&&typeof inSquad==="function"&&inSquad()&&Date.now()-flavorCD>3000){ flavorCD=Date.now(); emit({t:"chat",m:F[1]}); }
}

// ---------- ship HUD ----------
function adjacentTerminal(){ const p=me(); for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]]){ const t=Sim.tileAt(S,p.x+dx,p.y+dy); if(t.t==="terminal") return t.kind; } return null; }
function adjacentFixture(){ const p=me(); for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]]){ const t=Sim.tileAt(S,p.x+dx,p.y+dy); if(t.t==="prop"&&FLAVOR[t.kind]) return t.kind; } return null; }
const TERM_HINT={bar:"Galley bar · eat and drink",workbench:"Fabricator · craft gear, upgrade the ship",wardrobe:"Wardrobe · change your look",navtable:"Star map · choose where to fly",helm:"Pilot console · choose where to fly",rack:"Loadout rack · choose your kit",stash:"Stash locker · your gear",records:"Crew log · service history",board:"Job board · the crew's contracts",airlock:"Airlock · dock or board"};
function renderShipHud(){
  const L=here(), sh=ship(), sec=World.SECTORS.find(s=>s.id===L.sector), docked=L.type!=="derelict", cs=sh.contracts.length;
  $("s-ship").textContent=sh.name;
  if(warp){ $("s-loc").innerHTML=`<b>In transit</b><span>Jumping to ${L.name}</span>`; $("s-prompt").innerHTML=""; return; }
  $("s-loc").innerHTML=`<b>${L.name}</b><span>${sec.name} · ${docked?`<span class="dock">Docked</span>`:`<span class="warn">Holding beside a derelict</span>`}</span><span>${cs?`${cs} active contract${cs>1?"s":""}`:"No active contracts"}${World.siteContract(sh,L.id)?" · <span class=\"dock\">contract target</span>":""}</span>`;
  $("s-res").innerHTML=`<span>Credits</span><span style="color:var(--brass)">${profile.credits}</span><span>Fuel</span><span style="color:${sh.fuel<2?"var(--blood2)":"inherit"}">${sh.fuel}/${sh.fuelMax}</span><span>Day</span><span>${sh.day}</span><span>Food</span><span style="color:${profile.food<25?"var(--blood2)":"inherit"}">${Math.round(profile.food)}</span><span>Water</span><span style="color:${profile.water<25?"var(--blood2)":"inherit"}">${Math.round(profile.water)}</span><span>Crew</span><span>${inSquad()?Net.roster.length:1}/4${inSquad()?" · "+Net.code.toUpperCase():""}</span>`;
  $("s-mode").textContent=mode==="pc"?"Touch mode":"Mouse & keys";
  const seat=Sim.tileAt(S,me().x,me().y).t==="seat", k=seat?"navtable":adjacentTerminal(), fx2=k?null:adjacentFixture(), hint=k?TERM_HINT[k]:fx2?PROP_NAME[fx2]:"";
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
  records:{eye:"Crew quarters",title:()=>"Crew log",view:viewRecords},
  board:{eye:"Break room",title:()=>"Job board",view:viewBoard},
  crew:{eye:"Crew",title:()=>inSquad()?`Squad ${Net.code.toUpperCase()}`:"Crew",view:viewCrew},
  airlock:{eye:"Airlock",title:()=>here().type==="derelict"?`Board ${here().name}`:here().name,view:viewAirlock},
  debrief:{eye:"Debrief",title:()=>profile.last&&profile.last.win?"Back aboard":"Raid lost",view:viewDebrief},
};
function onTerminal(kind){ if(warp) return; openPanel(kind==="navtable"?"helm":kind); }
function onSit(kind){ const name={pilot:"pilot's seat",copilot:"co-pilot's seat",nav:"navigator's seat",eng:"engineer's seat"}[kind]||"seat";
  toast(`You take the ${name}.${kind==="pilot"&&!isHost()?" The squad leader still has the controls.":""} Press ${mode==="pc"?"F":"USE"} for the star map.`);
  if(typeof inSquad==="function"&&inSquad()&&Date.now()-flavorCD>2000){ flavorCD=Date.now(); emit({t:"chat",m:`takes the ${name}`}); } }
function openPanel(kind,sub){ if(kind==="inventory"&&panelKind==="inventory"){ closePanel(); return; } panelKind=kind; panelSub=sub||null; invSel=null; stopTravel(); throwMode=null; $("panel").hidden=false; renderPanel(); }
function closePanel(){ $("panel").hidden=true; panelKind=null; armed={}; if(S&&S.mode==="ship") renderShipHud(); }
function renderPanel(){ if(!panelKind) return; const P=PANELS[panelKind];
  $("p-eyebrow").textContent=typeof P.eye==="function"?P.eye():P.eye; $("p-title").textContent=P.title(); $("h-cr").textContent=profile.credits.toLocaleString("en-US");
  $("panel").dataset.kind=panelKind; $("p-body").innerHTML=P.view(); renderSync();
  const MINE=[["inventory","Kit"],["rack","Loadout"],["stash","Stash"],["workbench","Fabricator"],["wardrobe","Wardrobe"],["bar","Galley"]];
  $("p-tabs").innerHTML=S&&S.mode==="ship"&&MINE.some(([k])=>k===panelKind)?MINE.map(([k,n])=>`<button data-tab="${k}" aria-current="${panelKind===k}">${n}</button>`).join(""):"";
  const c=$("h-prev"); if(c){ const g=c.getContext("2d"); g.clearRect(0,0,c.width,c.height); g.drawImage(playerFrames(S&&S.mode==="raid"&&panelKind==="inventory"?lookOf(me()):lookOfKit()).idle0,0,0,c.width,c.height); }
  const c2=$("h-prev2"); if(c2){ const g=c2.getContext("2d"); g.clearRect(0,0,c2.width,c2.height); g.drawImage(playerFrames({...profile.look,hd:null,a:null,lg:null,ac:null,w:null}).idle0,0,0,c2.width,c2.height); } }
$("p-close").onclick=closePanel;
$("p-tabs").addEventListener("click",e=>{ const b=e.target.closest("[data-tab]"); if(b) openPanel(b.dataset.tab); });
$("panel").addEventListener("click",e=>{ if(e.target.id==="panel") closePanel(); });

function viewHelm(){
  const sh=ship(), cur=here(), sel=World.loc(mapSel||cur.id), cost=World.travelCost(sh,sel.id), sc=World.SECTORS.find(s=>s.id===sel.sector);
  const Y=v=>v*.75, nodes=World.LOCS.map(l=>{ const col=l.type==="station"?"#76c2c4":l.type==="outpost"?"#c79a4a":"#e0482f", target=sh.contracts.some(c=>World.CONTRACTS[c].site===l.id), isSel=l.id===sel.id, isCur=l.id===cur.id;
    return `<g class="node" data-act="sel:${l.id}" role="button" aria-label="${l.name}">${isSel?`<circle cx="${l.x}" cy="${Y(l.y)}" r="3.4" fill="none" stroke="#d9d2c0" stroke-width=".35"/>`:""}
      <circle cx="${l.x}" cy="${Y(l.y)}" r="${l.type==="derelict"?1.5:2}" fill="${col}" ${l.type==="derelict"?'stroke="#2a0806" stroke-width=".4"':""}/>
      ${isCur?`<path d="M${l.x-1.6} ${Y(l.y)-3.2} L${l.x+1.6} ${Y(l.y)-3.2} L${l.x} ${Y(l.y)-1.8} Z" fill="#9bc06a"/>`:""}
      ${(typeof Net!=="undefined"&&Net.suggest&&Net.suggest.to===l.id&&Date.now()-Net.suggest.at<180000)?`<circle cx="${l.x}" cy="${Y(l.y)}" r="4.6" fill="none" stroke="${colorOf(Net.suggest.k)}" stroke-width=".45" stroke-dasharray="1 .8"/>`:""}
      ${target?`<text x="${l.x+2.4}" y="${Y(l.y)-1.6}" style="fill:#e8b048;font-size:3.4px">★</text>`:""}
      <text x="${l.x>70?l.x-2.6:l.x+2.6}" y="${Y(l.y)+1.2}" text-anchor="${l.x>70?"end":"start"}">${l.name}</text><circle cx="${l.x}" cy="${Y(l.y)}" r="4" fill="transparent"/></g>`; }).join("");
  const lanes=[]; for(const a of World.LOCS) for(const b of World.LOCS) if(a.id<b.id&&a.sector===b.sector) lanes.push(`<line x1="${a.x}" y1="${Y(a.y)}" x2="${b.x}" y2="${Y(b.y)}" stroke="#34504a" stroke-width=".25"/>`);
  for(const [a,b] of [["ninefold","spire"],["ninefold","lazarus"],["spire","fennick"]]){ const A=World.loc(a),B=World.loc(b); lanes.push(`<line x1="${A.x}" y1="${Y(A.y)}" x2="${B.x}" y2="${Y(B.y)}" stroke="#6f9b8c" stroke-width=".3" stroke-dasharray="1.2 1"/>`); }
  const secs=World.SECTORS.map(s=>`<circle cx="${s.x}" cy="${Y(s.y)}" r="21" fill="${s.color}" opacity=".05"/><text class="sec" x="${s.x-14}" y="${Math.max(5,Y(s.y)-16)}" style="fill:${s.color}">${s.name}</text>`).join("");
  const services=sel.type==="derelict"?"Derelict · boardable":[sel.npcs.map(n=>World.NPCS[n].role+": "+World.NPCS[n].name).join(" · "),sel.fuel?`Fuel ${sel.fuel} cr`:""].filter(Boolean).join(" · ");
  const canJump=cost>0&&sh.fuel>=cost;
  const sug=typeof Net!=="undefined"&&Net.suggest&&Date.now()-Net.suggest.at<180000&&Net.suggest.to!==cur.id?Net.suggest:null;
  const sugHTML=sug&&isHost()?`<div class="panel contract-row" style="grid-column:1/-1;border-color:${colorOf(sug.k)}"><div><b>${esc(nameOf(sug.k))} suggests ${World.loc(sug.to).name}</b><br><span>${World.travelCost(sh,sug.to)} fuel · ${World.SECTORS.find(s=>s.id===World.loc(sug.to).sector).name}</span></div><button class="plain" data-act="sel:${sug.to}">Show</button></div>`:"";
  return `<div class="galaxy">${sugHTML}<div class="gmap"><svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid meet" aria-label="Star map">${secs}${lanes.join("")}${nodes}</svg></div>
    <div class="panel h-card"><div class="h-eyebrow">${sc.name}</div><h3>${sel.name}</h3><p>${sel.desc}</p>
      <div class="h-tags"><span>${sel.type}</span>${sh.contracts.some(c=>World.CONTRACTS[c].site===sel.id)?`<span class="hot">Contract target</span>`:""}</div>
      <div class="facts"><span>Services</span><span>${services}</span><span>Fuel aboard</span><span>${sh.fuel}/${sh.fuelMax}</span><span>Jump cost</span><span>${cost?cost+" fuel":"You are here"}</span><span>Travel time</span><span>${cost?cost+" day"+(cost>1?"s":""):"—"}</span></div>
      ${cost?(isHost()?`<button class="deploy-btn" data-act="jump:${sel.id}" ${canJump?"":"disabled"}>${canJump?`Jump · ${cost} fuel`:"Not enough fuel"}</button>`:`<button class="deploy-btn" data-act="suggest:${sel.id}">Suggest this course</button><p class="risk">The squad leader flies. Your suggestion shows up on their star map.</p>`):`<p class="risk good">Your ship is here.</p>`}
      ${sh.fuel<1&&cur.id!=="ninefold"?`<button class="plain" data-act="tow">Call a tug to Hangar Ninefold (free, 4 days)</button>`:""}
      <p class="risk">Jumps inside a sector cost 1 fuel. Crossing to another sector costs 3. Buy fuel when docked at stations and outposts.</p></div></div>`;
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
function viewStash(){
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
let fabTab="weapon";
function eatDrink(food,water,heal){ profile.food=Math.max(0,Math.min(100,profile.food+(food||0))); profile.water=Math.max(0,Math.min(100,profile.water+(water||0))); }
function travelHunger(days){ if(!profile) return; profile.food=Math.max(0,profile.food-6*days); profile.water=Math.max(0,profile.water-8*days); if(profile.food<20||profile.water<20) toast(profile.water<20?"You're parched. Get something to drink at the galley.":"You're starving. Get a meal at the galley."); save(); }
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
    <div class="panel h-card span12"><div class="chips">${tabs.map(([k,n])=>`<button data-act="fabtab:${k}" aria-pressed="${fabTab===k}">${n}</button>`).join("")}</div><div class="shop" style="margin-top:8px">${recipes}</div></div>
    <div class="panel h-card span12"><div class="h-eyebrow">Pack upgrades · +1 slot each, up to +3</div><div class="shop">${profile.stash.filter(q=>Items.kind(q)==="pack").map(q=>{ const l=q.l|0, c=Items.UPGRADE_COST(l);
      return `<div class="panel shop-row">${slotHTML(q)}<div class="nm">${nmHTML(q)}<span>${capOf(q)} slots${l<3?` → ${capOf(q)+1} · ${costHTML(c)}`:" · fully upgraded"}</span></div><span></span><button class="plain" data-act="upg:${q.uid}" ${l<3&&canPay(c)?"":"disabled"}>${l<3?"Upgrade":"Maxed"}</button></div>`; }).join("")||`<p class="risk">No packs in your stash.</p>`}</div></div></section>`;
}
function viewBar(){
  const menu=Items.BAR.map(b=>`<div class="panel shop-row"><div class="slot" style="display:flex;align-items:center;justify-content:center;font-size:22px">${b.water>(b.food||0)?"🥤":"🍲"}</div><div class="nm"><b>${b.name}</b><span>${[b.food?`+${b.food} food`:"",b.water?`+${b.water} water`:""].filter(Boolean).join(" · ")}</span></div><span class="price">${b.price?b.price+" cr":"free"}</span><button class="plain" data-act="bareat:${b.id}" ${profile.credits<b.price?"disabled":""}>${b.water>(b.food||0)?"Drink":"Eat"}</button></div>`).join("");
  const togo=Items.BAR_TOGO.map(([d,price],i)=>{ const it={d,r:0}; return `<div class="panel shop-row">${slotHTML(it)}<div class="nm">${nmHTML(it)}<span>${esc(Items.statLine(it))} · ${ownedOf(it)} in stash</span></div><span class="price">${price} cr</span><button class="plain" data-act="bartogo:${i}" ${profile.credits<price?"disabled":""}>Buy</button></div>`; }).join("");
  return `<section class="h-grid"><div class="panel h-card span12"><div class="h-eyebrow">How you're holding up</div><div class="vit" style="display:grid;grid-template-columns:80px minmax(0,1fr) auto;gap:4px 8px;align-items:center;max-width:520px">${hungerRows(profile.food,profile.water)}</div>
      <p class="risk">Food and water drain on raids (and a little every day the ship travels). Above 60 of both, you slowly regain blood. Below 15, your aim suffers. At zero you lose blood until you eat or drink.</p></div>
    <div class="panel h-card span6"><div class="h-eyebrow">Eat and drink here</div><div class="shop">${menu}</div></div>
    <div class="panel h-card span6"><div class="h-eyebrow">To go · for your pack</div><div class="shop">${togo}</div></div></section>`;
}
function dyeOpen(slot,id){ const o=Items.DYES[slot][id], r=slot==="cloak"?o[2]:o[1]; return r===0||profile.unlocks[slot].includes(id); }
const WARD_TAB=["Face","Hair","Clothes","Armour"]; let wardTab="Face";
function viewWardrobe(){
  const ST=Items.STYLE, L=profile.look, lab=t=>t[0].toUpperCase()+t.slice(1);
  const col=(f,arr,lbl)=>`<div class="h-eyebrow">${lbl}</div><div class="swatches">${arr.map((c,i)=>`<button class="swatch" data-act="style:${f}:${i}" aria-pressed="${(L[f]|0)===i}" aria-label="${lbl} ${i+1}"><i style="background:${c}"></i></button>`).join("")}</div>`;
  const opt=(f,arr,lbl,names)=>`<div class="h-eyebrow">${lbl}</div><div class="chips">${arr.map((n,i)=>`<button data-act="style:${f}:${i}" aria-pressed="${(L[f]|0)===i}">${(names&&names[n])||lab(n)}</button>`).join("")}</div>`;
  const dye=(slot,label)=>`<div class="h-eyebrow">${label}</div><div class="swatches">${Object.entries(Items.DYES[slot]).map(([id,o])=>{ const open=dyeOpen(slot,id), r=slot==="cloak"?o[2]:o[1], c=slot==="cloak"?o[1]:slot==="visor"?o[0]:null;
      return `<button class="swatch" data-act="look:${slot}:${id}" aria-pressed="${L[slot[0]]===id}" ${open?"":"disabled"} title="${open?(slot==="crest"?o[0]:id):`Locked · find a ${Items.RAR[r].name.toLowerCase()} dye`}" style="${slot==="crest"?"width:auto;padding:0 10px":""}">${c?`<i style="background:${c}"></i>`:`<span style="font-size:12px">${o[0]}</span>`}${open?"":`<span class="lock" style="color:${Items.RAR[r].col}">■</span>`}</button>`; }).join("")}</div>`;
  const u=profile.unlocks, n=u.cloak.length+u.visor.length+u.crest.length;
  const body={
    Face:col("s",ST.skin,"Skin tone")+opt("f",ST.face,"Face",{clean:"Clean-shaven",tattoo:"Face tattoo"})+col("e",ST.eyes,"Eyes"),
    Hair:opt("h",ST.hair,"Hairstyle",{none:"Shaved",buzz:"Buzz cut",topknot:"Top knot"})+col("hc",ST.hairCol,"Hair colour"),
    Clothes:opt("t",ST.top,"Top",{tee:"T-shirt",long:"Long sleeve",tank:"Tank top"})+col("tc",ST.cloth,"Top colour")+opt("b",ST.bottom,"Bottoms")+col("bc",ST.cloth,"Bottoms colour")+col("bt",ST.cloth,"Boots"),
    Armour:`<p>Helmets, chest pieces, legs and accessories all show on your character. Find them on derelicts or craft them at the workbench. Dyes colour your cape and scarf, tint visors and lenses, and crest the helms that take one.</p>${dye("cloak","Cape and scarf dye")}${dye("visor","Visor tint")}${dye("crest","Helm crest")}<p class="risk">${n} dye${n===1?"":"s"} found. Rarer dyes turn up on harder stations.</p>`,
  }[wardTab];
  return `<section class="panel h-card"><div class="lo"><div class="preview" style="gap:12px;flex-wrap:wrap"><div style="text-align:center"><canvas id="h-prev2" width="48" height="64" aria-label="You, out of armour" style="width:96px;height:128px;image-rendering:pixelated"></canvas><div class="risk">Clothes</div></div><div style="text-align:center"><canvas id="h-prev" width="48" height="64" aria-label="You in your kit" style="width:96px;height:128px"></canvas><div class="risk">In your kit</div></div></div>
    <div class="eq"><div class="seg">${WARD_TAB.map(t=>`<button data-act="wtab:${t}" aria-pressed="${wardTab===t}">${t}</button>`).join("")}</div>${body}</div></div></section>`;
}
// ---------- inventory (raid: live; ship: your kit) ----------
function hungerRows(f,w){ const m=(l,v,c)=>`<span class="lbl">${l}</span><div class="meter"><i style="width:${Math.max(0,Math.min(100,v))}%;background:${v<20?"var(--blood2)":c}"></i></div><span class="num">${Math.round(v)}${v<=0?' <span style="color:var(--blood2)">!</span>':""}</span>`; return m("Food",f,"#b08a4a")+m("Water",w,"#5a9ad0"); }
function limbRows(p){ return Sim.LIMBS.map(l=>{ const f=Math.max(0,p.hp[l]/p.max[l]);
  return `<span class="lbl">${Sim.LNAME[l]}</span><div class="meter"><i style="width:${f*100}%;background:${f<=0?"#262320":f>.66?"#4f7a46":f>.33?"#c79a4a":"#e0482f"}"></i></div><span class="num">${p.hp[l]}/${p.max[l]}${p.bleed[l]?' <span style="color:var(--blood2)">bleeding</span>':""}</span>`; }).join(""); }
// ---------- inventory: body + equipment on the left, pack grid on the right, pouches along the bottom ----------
const PACKABLE=["throw","med","key","food"];
const EQ_LAYOUT=[["head","Helmet"],["acc","Trinket"],["w1","Primary"],["armor","Chest"],["w2","Secondary"],["light","Light"],["legs","Legs"],["melee","Melee"],["pack","Pack"]];
function roleOf(eq){ const d=k=>eq[k]&&eq[k].d; if(["halohelm","aegis","aegislegs"].includes(d("head"))||d("armor")==="aegis") return "Saint";
  if(d("armor")==="shroud"||d("head")==="cowl") return "Shade"; if(["ossuary","flak"].includes(d("armor"))||d("head")==="sallet") return "Paladin";
  if(d("armor")==="hazard") return "Firewalker"; if(d("armor")==="exo") return "Hauler"; if(!d("armor")&&!d("head")) return "Scavenger"; return "Contractor"; }
function ivCell(it,src,o={}){ const sel=invSel===src, gun=it&&o.wide&&Items.slotOf(it)==="gun";
  return `<div class="iv-cell${o.wide?" wide":""}${sel?" sel":""}${o.locked?" locked":""}${!it?" empty":""}" ${it&&!o.fixed?`data-drag="${src}"`:""} ${o.drop?`data-drop="${o.drop}"`:""} ${it?`data-pick="${src}"`:""} title="${it?esc(Items.name(it)):o.label||""}" ${o.area?`style="grid-area:${o.area}"`:""}>
    ${it?`<img alt="" src="${gun?gunURL(it.d):iconFor(it)}">`:o.label?`<span class="iv-lbl">${o.label}</span>`:""}${o.badge!=null&&o.badge!==""?`<span class="iv-n">${o.badge}</span>`:""}${it?`<i class="iv-bar" style="background:${rc(it)}"></i>`:""}${it&&it.iss?`<span class="iv-iss">issued</span>`:""}</div>`; }
function ivData(){ const raid=S&&S.mode==="raid";
  if(raid){ const p=me(); return {raid,p,eq:Object.fromEntries(KIT_SLOTS.map(k=>[k,p[k]])),pack:p.inv,cap:p.cap,ammo:p.ammo||{},mats:p.mats||{},starter:false}; }
  const r=kitResolved(); return {raid,r,eq:Object.fromEntries(KIT_SLOTS.map(k=>[k,r[k]])),pack:r.inv,cap:r.cap,ammo:r.ammo,mats:profile.mats,starter:r.free}; }
function ivItem(D,src){ const [k,key]=src.split(":"); if(k==="eq") return D.eq[key]; if(k==="inv") return D.raid?D.pack[+key]:byUid(key); if(k==="st") return byUid(key); return null; }
function viewInventory(){
  const D=ivData(), eq=D.eq, callsign=(typeof HB!=="undefined"&&HB.callsign&&HB.callsign())||"Contractor", tag=(hh(callsign.length,callsign.charCodeAt(0)||7,3)%0xffff).toString(16)+"-"+(1000+hh(3,callsign.length,9)%9000);
  const ammoOf=g=>{ const st=g&&Items.stats(g); return st&&st.ammo?((D.raid?D.ammo[st.ammo]:(D.ammo[st.ammo]||0))|0):""; };
  const eqHTML=EQ_LAYOUT.map(([k,lbl])=>{ const it=eq[k], wide=k==="w1"||k==="w2"||k==="melee";
    return ivCell(it,"eq:"+k,{wide,label:lbl,drop:"eq:"+k,area:k,fixed:D.starter,badge:wide&&k!=="melee"&&it?ammoOf(it):(k==="light"&&it&&D.raid&&D.p.lightOff?"off":"")}); }).join("");
  const used=D.pack.length, rows=Math.max(4,Math.ceil(D.cap/6)), cells=[];
  for(let i=0;i<rows*6;i++){ const it=D.pack[i], src=D.raid?"inv:"+i:it?"inv:"+it.uid:"";
    cells.push(i<D.cap?ivCell(it,src,{drop:"inv",badge:it&&it.n>1?it.n:""}):`<div class="iv-cell locked" data-drop="inv"></div>`); }
  const pouch=AMMO_T.map(t=>{ const n=D.raid?(D.ammo[t]|0):(D.ammo[t]|0); return `<div class="iv-pouch" title="${Items.AMMO[t].name}${D.raid?"":` · ${profile.ammo[t]|0} in the hold`}"><img alt="" src="${iconFor({d:"ammo_"+t})}"><span>${n}</span></div>`; }).join("")
    +MAT_T.filter(t=>(D.mats[t]|0)>0).map(t=>`<div class="iv-pouch mat" title="${Items.MATS[t]}"><img alt="" src="${iconFor({d:t})}"><span>${D.mats[t]|0}</span></div>`).join("");
  const sil=`<svg class="iv-sil" viewBox="0 0 100 160" aria-hidden="true"><g fill="none" stroke="#7a1a12" stroke-width=".8" opacity=".7"><ellipse cx="50" cy="16" rx="10" ry="12"/><path d="M40 28 L60 28 L74 36 L80 74 L74 76 L68 46 L66 82 L64 120 L62 154 L52 154 L50 96 L48 154 L38 154 L36 120 L34 82 L32 46 L26 76 L20 74 L26 36 Z"/><path d="M42 40 L58 40 M40 56 L60 56 M42 72 L58 72" opacity=".5"/></g></svg>`;
  // details of the selected thing
  let det=""; const it=invSel?ivItem(D,invSel):null;
  if(it){ const [k,key]=invSel.split(":"), kind=Items.kind(it), btns=[];
    if(D.raid){ const p=D.p;
      if(k==="inv"){ if(kind==="throw") btns.push(`<button class="plain" data-act="ithrow:${key}">Throw</button>`); else if(Items.slotOf(it)) btns.push(`<button class="plain" data-act="iequip:${key}">Equip</button>`); else if(kind==="med"||kind==="food") btns.push(`<button class="plain" data-act="iuse:${key}">${kind==="food"?((Items.def(it.d).water||0)>(Items.def(it.d).food||0)?"Drink":"Eat"):"Use"}</button>`);
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
      <div class="iv-body">${sil}<div class="iv-id"><span>${esc(tag)}</span><b>${esc(callsign)}</b><em>${roleOf(eq)}</em></div><div class="iv-eq">${eqHTML}</div><div class="iv-load">Load ${used}/${D.cap}</div></div>
      <div class="iv-right"><div class="iv-grid" data-drop="inv">${cells.join("")}</div><div class="iv-pouches">${pouch}</div>${cond}</div>
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
function viewRecords(){ const s=profile.stats, rate=s.raids?Math.round(s.extracts/s.raids*100):0;
  return `<div class="stats">${[["Raids",s.raids],["Extracted",s.extracts],["Lost",s.deaths],["Survival",rate+"%"],["Contracts done",s.contracts],["Salvage value",s.earned+" cr"],["Best haul",s.best+" cr"],["Ship day",ship().day]].map(([a,b])=>`<div class="panel stat"><b>${b}</b><span>${a}</span></div>`).join("")}</div>`; }
function contractRow(id,btn){ const C=World.CONTRACTS[id], site=World.loc(C.site), giver=World.NPCS[C.giver];
  return `<div class="panel contract-row"><div><b>${C.title}</b><br><span>${C.brief} · ${site.name}, ${World.SECTORS.find(s=>s.id===site.sector).name} · from ${giver.name}</span></div><div style="text-align:right"><div class="pay">${C.reward} cr</div>${btn||""}</div></div>`; }
function viewBoard(){ const sh=ship();
  return `<section class="h-grid"><div class="panel h-card span7"><div class="h-eyebrow">Active · ${sh.contracts.length}/3</div>
      ${sh.contracts.length?sh.contracts.map(id=>contractRow(id,`<button class="plain" data-act="drop:${id}">${armed["drop:"+id]?"Confirm drop":"Drop"}</button>`)).join(""):`<p class="risk">No contracts. Dock at a station or outpost and talk to a contract giver through the airlock.</p>`}
      <p class="risk">Fly to the target, board it from the airlock, and extract with its black box. The reward is paid to everyone in the crew.</p></div>
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
      return contractRow(cid,done?`<span class="risk good">Completed</span>`:have?`<span class="risk good">Accepted</span>`:`<button class="plain" data-act="accept:${cid}" ${sh.contracts.length>=3?"disabled":""}>Accept</button>`); }).join("");
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
  const tags=[m.power===false?"No power":"Power on",m.fires?`${m.fires} fires`:"",m.huskAdd?"Extra husks":"",m.huskDrop?"Fewer husks":"",m.loot>1?`Salvage ×${m.loot}`:"",L.id==="ks9"?"Fire in cargo":""].filter(Boolean);
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
      <div class="facts"><span>Contract</span><span>${C?`${C.title} · ${C.reward} cr`:"None · salvage run"}</span><span>Objective</span><span>${C?"Black box from the vault":"Anything worth carrying"}</span><span>Extraction</span><span>Your shuttle pad, docking bay</span></div></div>
    <div class="panel h-card span5"><div class="h-eyebrow">${inSquad()?`Squad ${Net.code.toUpperCase()}`:"Crew"}</div>${squadHTML}</div>
    <div class="panel h-card span12"><div class="bar-row"><div class="h-eyebrow grow">Loadout · ${r.free?"Starter kit":"Custom kit"}</div><button class="plain" data-act="open:rack">Loadout rack</button></div>
      ${kitSummaryHTML(r)}<p class="risk ${r.free?"good":"bad"}">${r.free?"Free kit. Nothing from your stash is at risk.":`If you die you lose this kit: about ${risk} cr.`}${!r.w1&&!r.w2?" You are going in without a gun.":""}</p>
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
function viewDebrief(){ const Lr=profile.last; if(!Lr) return "<p>No raid to report.</p>";
  const li=x=>typeof x==="string"?`<li>${esc(x)}</li>`:`<li style="color:${x.c}">${esc(x.n)}</li>`;
  return `<section class="panel h-card report ${Lr.win?"":"lose"}"><h3>${Lr.win?`Extracted from ${Lr.site}`:`Lost on ${Lr.site}`}</h3>
    ${Lr.contract?`<p class="risk good">Contract complete: ${Lr.contract.title}. ${Lr.contract.reward} cr paid to the crew.${Lr.contract.bonus?` Bonus: <b style="color:${Lr.contract.bonus.c}">${esc(Lr.contract.bonus.n)}</b>.`:""}</p>`:""}
    ${Lr.win?`<p>Brought home ${Lr.items.length} item${Lr.items.length===1?"":"s"} worth about ${Lr.value} cr. Everything is in the stash locker.</p>${Lr.items.length?`<ul>${Lr.items.slice(0,12).map(li).join("")}${Lr.items.length>12?`<li>and ${Lr.items.length-12} more</li>`:""}</ul>`:""}
      ${Lr.ammo&&Object.keys(Lr.ammo).length?`<div class="h-eyebrow">Ammo recovered</div>${ammoChips(Lr.ammo)}`:""}${Lr.mats&&MAT_T.some(t=>Lr.mats[t])?`<div class="h-eyebrow" style="margin-top:6px">Materials</div>${matChips(Lr.mats)}`:""}`
      :`<p>${Lr.cause||"You did not come back."} ${Lr.kit==="custom"?"Your custom kit is gone.":"You went in on the starter kit, so your stash is untouched."}</p>`}
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
    case "sel": if(panelKind==="helm") mapSel=x; else stashSel=stashSel===x?null:x; break;
    case "jump": { const days=World.travelCost(ship(),x), res=worldAct({type:"travel",to:x}); if(res.ok){ travelHunger(days); if(inSquad()) emit({t:"warp",d:days}); closePanel(); mapSel=null; warp={start:performance.now(),dur:2200,done:()=>{ toast(`Arrived at ${here().name}.`); renderShipHud(); }}; renderShipHud(); } break; }
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
    case "craft": { const R2=Items.RECIPES.find(q=>q.id===x); if(!R2||R2.lvl>fabLvl()||!canPay(R2.cost)) break; pay(R2.cost); const out={...R2.out,r:Items.craftRarity(R2,fabLvl())}; World.grant(profile,out); toast(`Crafted ${Items.name(out)}.`); save(); break; }
    case "fabtab": fabTab=x; break;
    case "equipslot": if(profile.kit.type!=="custom"){ profile.kit.type="custom"; toast("Switched to a custom kit. Pick your gear."); } save(); openPanel("rack",x); return;
    case "equipitem": { const it=byUid(x), sl=it&&Items.slotOf(it); if(!sl) break; const k=profile.kit; if(k.type!=="custom"){ k.type="custom"; }
      const slot=sl==="gun"?(!k.w1||k.w1===x?"w1":!k.w2?"w2":"w1"):sl; for(const s2 of KIT_SLOTS) if(k[s2]===x) k[s2]=null; k[slot]=x; k.inv=k.inv.filter(u=>u!==x);
      toast(`${Items.name(it)} is in your ${SLOT_NAME[slot].toLowerCase()} slot. Your kit is now custom.`); save(); refreshLook(); break; }
    case "ilight": send({type:"light"}); break;
    case "iunequip": invSel=null; send({type:"unequip",slot:x}); break;
    case "unslot": { const k=profile.kit; if(k.type==="custom"){ k[x]=null; save(); refreshLook(); } invSel=null; break; }
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
    case "idrop": invSel=null; send({type:"drop",index:+x}); break;
    case "igive": invSel=null; send({type:"give",index:+x,to:y}); break;
    case "ithrow": closePanel(); useSlot(+x); return;
  }
  renderPanel(); if(S&&S.mode==="ship") renderShipHud();
});
function refreshLook(){ if(inSquad()&&Net.ready) setReady(false); if(S&&S.mode==="ship"){ const r=kitResolved(), p=me(); if(p){ p.w1=strip(r.w1||r.w2); p.w2=null; p.act=1; for(const k of ["head","armor","legs","acc","light"]) p[k]=strip(r[k]); p.look={...profile.look}; } } if(inSquad()) squadPresence(); }

// ---------- scene changes ----------
function shipLoadout(){ const r=kitResolved(); return {w1:strip(r.w1||r.w2),head:strip(r.head),armor:strip(r.armor),legs:strip(r.legs),acc:strip(r.acc),light:strip(r.light),pack:strip(r.pack),ammo:{},inv:[],look:{...profile.look}}; }
function boardShipCrew(crew){
  const raidOver=S&&S.mode==="raid"; if(raidOver&&!Net.settled) settlePersonal();
  PID=crewKey();
  crew=crew.map(c=>c.id===PID?{...c,loadout:shipLoadout()}:c);
  S=Sim.newGame((Math.random()*2**32)>>>0,null,{map:"ship",mode:"ship",crew});
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
function loadoutFromKit(r){ const lo={ammo:{...r.ammo},inv:r.inv.map(strip),look:{...profile.look},food:Math.round(profile.food),water:Math.round(profile.water)}; for(const s of KIT_SLOTS) lo[s]=strip(r[s]); if(r.free) lo.starter=1; return lo; }
function consumeKit(lo){
  profile.stats.raids++; profile.active={kit:lo.starter?"starter":"custom",site:ship().loc,at:Date.now()};
  if(!lo.starter){ const r=kitResolved(), gone=new Set([...KIT_SLOTS.map(s=>r[s]&&!r[s].iss&&r[s].uid),...r.inv.map(i=>i.uid)].filter(Boolean));
    profile.stash=profile.stash.filter(q=>!gone.has(q.uid));
    for(const t of AMMO_T) profile.ammo[t]=Math.max(0,(profile.ammo[t]|0)-((lo.ammo||{})[t]|0));
    profile.kit={...profile.kit,inv:[],ammo:{}}; for(const s of KIT_SLOTS) profile.kit[s]=null; }
  save();
}
function raidOpts(L){ return {gen:{tier:L.site.tier||1,fireStart:!!L.site.fireStart},site:L.name,mods:L.site.mods}; }
function deploy(){
  const L=here(); if(L.type!=="derelict") return;
  if(inSquad()){ if(Net.host){ Net.ready=true; Net.readyLo=loadoutFromKit(kitResolved()); squadPresence(); hostLaunch(); } else setReady(!Net.ready); return; }
  const lo=loadoutFromKit(kitResolved()); consumeKit(lo); closePanel(); PID="p1"; Net.settled=false;
  S=Sim.newGame((Math.random()*2**32)>>>0,lo,raidOpts(L));
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
  if(win){
    const bring=it=>{ if(!it||it.iss) return; World.grant(profile,it); rep.items.push({n:Items.name(it),c:rc(it)}); rep.value+=Math.round(Items.value(it)*.5); };
    for(const s of KIT_SLOTS) bring(p[s]); for(const it of p.inv) bring(it);
    for(const t of AMMO_T){ const n=(p.ammo||{})[t]|0; if(n){ profile.ammo[t]=(profile.ammo[t]|0)+n; rep.ammo[t]=n; } }
    for(const t of MAT_T){ const n=(p.mats||{})[t]|0; if(n){ profile.mats[t]=(profile.mats[t]|0)+n; rep.mats[t]=n; } }
    profile.stats.extracts++; profile.stats.earned+=rep.value; profile.stats.best=Math.max(profile.stats.best,rep.value);
  } else profile.stats.deaths++;
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
    else { boardShip(); if(!profile.welcomed){ profile.welcomed=true; save(); toast(`Welcome aboard. Walk to a terminal and press ${mode==="pc"?"F":"USE"}. ${mode==="pc"?"I or Tab":"The bag button"} opens your inventory.`); } }
  }
  Store.init();
}

