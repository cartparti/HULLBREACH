// ============================ SHIP BASE =============================
// Personal save (credits, stash, stats, kit) + the crew ship (World ship
// state). Signed-in players save to db at data/users/<id>/save.
const SAVE_V=1, SUPPLIES=["bandage","medkit","o2"];
let profile=null, panelKind=null, panelSub=null, mapSel=null, stashFilter="all", stashSel=null, armed={};
const CONS=World.CONS, itemInfo=World.itemInfo, mk=World.mkItem;
function newProfile(){ return {v:SAVE_V,updated:0,credits:300,rounds:24,
  stash:[mk({kind:"gear",gear:"pistol"}),mk({kind:"bandage"}),mk({kind:"bandage"}),mk({kind:"medkit"}),mk({kind:"o2"})],
  stats:{raids:0,extracts:0,deaths:0,earned:0,best:0,contracts:0},kit:{type:"starter",weapon:"pistol",armor:null,pack:null,cons:{bandage:1,medkit:0,o2:0},rounds:12},
  squad:"solo",last:null,active:null,ship:World.newShip(),welcomed:false}; }
function fixProfile(p){ const d=newProfile(); if(!p||p.v!==SAVE_V) return d;
  p.stats={...d.stats,...(p.stats||{})}; p.kit={...d.kit,...(p.kit||{})}; p.kit.cons={...d.kit.cons,...(p.kit.cons||{})}; p.stash=Array.isArray(p.stash)?p.stash:[];
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

// ---------- kit helpers ----------
const count=(kind,gear)=>profile.stash.filter(q=>q.kind===kind&&(gear?q.gear===gear:true)).length;
const gearOwned=slot=>[...new Set(profile.stash.filter(q=>q.kind==="gear"&&Sim.GEAR[q.gear].slot===slot).map(q=>q.gear))];
function kitResolved(){ const k=profile.kit;
  if(k.type==="starter"){ const st=Sim.STARTER; return {weapon:st.weapon,armor:st.armor,pack:st.pack,rounds:st.rounds,cons:{bandage:2,medkit:0,o2:0},free:true}; }
  const w=k.weapon&&count("gear",k.weapon)?k.weapon:null, a=k.armor&&count("gear",k.armor)?k.armor:null, p=k.pack&&count("gear",k.pack)?k.pack:null;
  const cap=Sim.GEAR[p||"sling"].slots; let used=0; const cons={};
  for(const c of SUPPLIES){ const n=Math.max(0,Math.min(k.cons[c]|0,count(c),cap-used)); cons[c]=n; used+=n; }
  return {weapon:w,armor:a||"suit",pack:p||"sling",rounds:Math.min(k.rounds|0,profile.rounds),cons,free:false,cap,used};
}
function kitRisk(r){ if(r.free) return 0; let v=0; for(const s of ["weapon","armor","pack"]){ const g=r[s]; if(g&&!Sim.GEAR[g].issued) v+=Math.round(Sim.GEAR[g].value*.5); } for(const c of SUPPLIES) v+=r.cons[c]*CONS[c].sell; return v; }
function slotHTML(kind,gear,n,title){ return `<div class="slot" title="${title||""}"><img alt="${title||""}" src="${iconURL(kind,gear)}">${n>1?`<span class="n">×${n}</span>`:""}</div>`; }
function toast(msg){ const t=$("h-toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,3000); }
function kitSummaryHTML(r){
  let s=`<div class="kit-row">${r.weapon?slotHTML("gear",r.weapon,1,Sim.GEAR[r.weapon].name):`<div class="slot" title="No weapon"></div>`}${slotHTML("gear",r.armor,1,Sim.GEAR[r.armor].name)}${slotHTML("gear",r.pack,1,Sim.GEAR[r.pack].name)}`;
  for(const c of SUPPLIES) if(r.cons[c]) s+=slotHTML(c,null,r.cons[c],CONS[c].name);
  return s+`<div class="slot" title="Rounds"><span class="num" style="font-size:18px">${r.rounds}</span><span class="n">rds</span></div></div>`;
}
function portrait(look){ const c=cvs(24,24), g=c.getContext("2d"); R(g,0,0,24,24,"#0b1110");
  const o=outlined(24,24,q=>{ R(q,4,10,16,14,look.hood); R(q,6,4,12,10,look.hood); R(q,7,3,10,2,look.hood); R(q,8,7,8,9,look.skin); R(q,8,7,8,1,shade(look.skin,.7));
    R(q,9,10,2,1,look.eye); R(q,13,10,2,1,look.eye); R(q,11,12,2,2,shade(look.skin,.8)); R(q,10,15,4,1,shade(look.skin,.55)); R(q,6,16,12,8,shade(look.hood,.8)); R(q,11,17,2,7,"#a37a32"); });
  g.drawImage(o,0,0); return c.toDataURL(); }

// ---------- ship HUD ----------
function adjacentTerminal(){ const p=me(); for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]]){ const t=Sim.tileAt(S,p.x+dx,p.y+dy); if(t.t==="terminal") return t.kind; } return null; }
const TERM_HINT={helm:"Helm · fly to another location",rack:"Loadout rack · choose your kit",stash:"Stash locker · your gear",records:"Records · service history",board:"Contract board · your jobs",airlock:"Airlock · leave the ship"};
function renderShipHud(){
  const L=here(), sh=ship(), sec=World.SECTORS.find(s=>s.id===L.sector), docked=L.type!=="derelict", cs=sh.contracts.length;
  $("s-ship").textContent=sh.name;
  if(warp){ $("s-loc").innerHTML=`<b>In transit</b><span>Jumping to ${L.name}</span>`; $("s-prompt").innerHTML=""; return; }
  $("s-loc").innerHTML=`<b>${L.name}</b><span>${sec.name} · ${docked?`<span class="dock">Docked</span>`:`<span class="warn">Holding beside a derelict</span>`}</span><span>${cs?`${cs} active contract${cs>1?"s":""}`:"No active contracts"}${World.siteContract(sh,L.id)?" · <span class=\"dock\">contract target</span>":""}</span>`;
  $("s-res").innerHTML=`<span>Credits</span><span style="color:var(--brass)">${profile.credits}</span><span>Fuel</span><span style="color:${sh.fuel<2?"var(--blood2)":"inherit"}">${sh.fuel}/${sh.fuelMax}</span><span>Day</span><span>${sh.day}</span><span>Crew</span><span>${inSquad()?Net.roster.length:1}/4${inSquad()?" · "+Net.code.toUpperCase():""}</span>`;
  $("s-mode").textContent=mode==="pc"?"Touch mode":"Mouse & keys";
  const k=adjacentTerminal();
  $("s-prompt").innerHTML=k&&!warp?(mode==="pc"?`<span class="key">F</span>${TERM_HINT[k]}`:`Tap USE · ${TERM_HINT[k]}`):"";
}

// ---------- panels ----------
const PANELS={
  helm:{eye:"Helm",title:()=>"Star map",view:viewHelm},
  rack:{eye:"Armory",title:()=>"Loadout rack",view:viewLoadout},
  stash:{eye:"Ship hold",title:()=>"Stash locker",view:viewStash},
  records:{eye:"Comms",title:()=>"Service records",view:viewRecords},
  board:{eye:"Comms",title:()=>"Contract board",view:viewBoard},
  crew:{eye:"Comms",title:()=>inSquad()?`Squad ${Net.code.toUpperCase()}`:"Crew",view:viewCrew},
  airlock:{eye:"Airlock",title:()=>here().type==="derelict"?`Board ${here().name}`:here().name,view:viewAirlock},
  debrief:{eye:"Debrief",title:()=>profile.last&&profile.last.win?"Back aboard":"Raid lost",view:viewDebrief},
};
function onTerminal(kind){ if(warp) return; openPanel(kind); }
function openPanel(kind,sub){ panelKind=kind; panelSub=sub||null; stopTravel(); $("panel").hidden=false; renderPanel(); }
function closePanel(){ $("panel").hidden=true; panelKind=null; armed={}; if(S) renderShipHud(); }
function renderPanel(){ if(!panelKind) return; const P=PANELS[panelKind];
  $("p-eyebrow").textContent=P.eye; $("p-title").textContent=P.title(); $("h-cr").textContent=profile.credits.toLocaleString("en-US");
  $("p-body").innerHTML=P.view(); renderSync(); const c=$("h-prev"); if(c){ const r=kitResolved(), g=c.getContext("2d"); g.clearRect(0,0,24,32); g.drawImage(playerFrames(r.armor,r.weapon).idle0,0,0); } }
$("p-close").onclick=closePanel;
$("panel").addEventListener("click",e=>{ if(e.target.id==="panel") closePanel(); });

function viewHelm(){
  const sh=ship(), cur=here(), sel=World.loc(mapSel||cur.id), cost=World.travelCost(sh,sel.id), sc=World.SECTORS.find(s=>s.id===sel.sector);
  const Y=v=>v*.75, nodes=World.LOCS.map(l=>{ const col=l.type==="station"?"#76c2c4":l.type==="outpost"?"#c79a4a":"#e0482f", target=sh.contracts.some(c=>World.CONTRACTS[c].site===l.id), isSel=l.id===sel.id, isCur=l.id===cur.id;
    return `<g class="node" data-act="sel:${l.id}" role="button" aria-label="${l.name}">${isSel?`<circle cx="${l.x}" cy="${Y(l.y)}" r="3.4" fill="none" stroke="#d9d2c0" stroke-width=".35"/>`:""}
      <circle cx="${l.x}" cy="${Y(l.y)}" r="${l.type==="derelict"?1.5:2}" fill="${col}" ${l.type==="derelict"?'stroke="#2a0806" stroke-width=".4"':""}/>
      ${isCur?`<path d="M${l.x-1.6} ${Y(l.y)-3.2} L${l.x+1.6} ${Y(l.y)-3.2} L${l.x} ${Y(l.y)-1.8} Z" fill="#9bc06a"/>`:""}
      ${target?`<text x="${l.x+2.4}" y="${Y(l.y)-1.6}" style="fill:#e8b048;font-size:3.4px">★</text>`:""}
      <text x="${l.x>70?l.x-2.6:l.x+2.6}" y="${Y(l.y)+1.2}" text-anchor="${l.x>70?"end":"start"}">${l.name}</text><circle cx="${l.x}" cy="${Y(l.y)}" r="4" fill="transparent"/></g>`; }).join("");
  const lanes=[]; for(const a of World.LOCS) for(const b of World.LOCS) if(a.id<b.id&&a.sector===b.sector) lanes.push(`<line x1="${a.x}" y1="${Y(a.y)}" x2="${b.x}" y2="${Y(b.y)}" stroke="#34504a" stroke-width=".25"/>`);
  for(const [a,b] of [["ninefold","spire"],["ninefold","lazarus"],["spire","fennick"]]){ const A=World.loc(a),B=World.loc(b); lanes.push(`<line x1="${A.x}" y1="${Y(A.y)}" x2="${B.x}" y2="${Y(B.y)}" stroke="#6f9b8c" stroke-width=".3" stroke-dasharray="1.2 1"/>`); }
  const secs=World.SECTORS.map(s=>`<circle cx="${s.x}" cy="${Y(s.y)}" r="21" fill="${s.color}" opacity=".05"/><text class="sec" x="${s.x-14}" y="${Math.max(5,Y(s.y)-16)}" style="fill:${s.color}">${s.name}</text>`).join("");
  const services=sel.type==="derelict"?"Derelict · boardable":[sel.npcs.map(n=>World.NPCS[n].role+": "+World.NPCS[n].name).join(" · "),sel.fuel?`Fuel ${sel.fuel} cr`:""].filter(Boolean).join(" · ");
  const canJump=cost>0&&sh.fuel>=cost;
  return `<div class="galaxy"><div class="gmap"><svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid meet" aria-label="Star map">${secs}${lanes.join("")}${nodes}</svg></div>
    <div class="panel h-card"><div class="h-eyebrow">${sc.name}</div><h3>${sel.name}</h3><p>${sel.desc}</p>
      <div class="h-tags"><span>${sel.type}</span>${sh.contracts.some(c=>World.CONTRACTS[c].site===sel.id)?`<span class="hot">Contract target</span>`:""}</div>
      <div class="facts"><span>Services</span><span>${services}</span><span>Fuel aboard</span><span>${sh.fuel}/${sh.fuelMax}</span><span>Jump cost</span><span>${cost?cost+" fuel":"You are here"}</span><span>Travel time</span><span>${cost?cost+" day"+(cost>1?"s":""):"—"}</span></div>
      ${cost?(isHost()?`<button class="deploy-btn" data-act="jump:${sel.id}" ${canJump?"":"disabled"}>${canJump?`Jump · ${cost} fuel`:"Not enough fuel"}</button>`:`<p class="risk">Only the squad leader flies the ship.</p>`):`<p class="risk good">Your ship is here.</p>`}
      ${sh.fuel<1&&cur.id!=="ninefold"?`<button class="plain" data-act="tow">Call a tug to Hangar Ninefold (free, 4 days)</button>`:""}
      <p class="risk">Jumps inside a sector cost 1 fuel. Crossing to another sector costs 3. Buy fuel when docked at stations and outposts.</p></div></div>`;
}
function viewLoadout(){
  const k=profile.kit, custom=k.type==="custom", r=kitResolved();
  const head=`<div class="bar-row"><div class="seg"><button data-act="kit:starter" aria-pressed="${!custom}">Starter kit</button><button data-act="kit:custom" aria-pressed="${custom}">Custom kit</button></div>
    <span class="risk ${custom?"bad":"good"}">${custom?`At risk if you die: ${kitRisk(r)} cr`:"Free · nothing at risk"}</span></div>`;
  const preview=`<div class="preview"><canvas id="h-prev" width="24" height="32" aria-label="Your contractor"></canvas></div>`;
  let body;
  if(!custom) body=`<div class="eq"><h3>Starter kit</h3><p>Issued free for every raid. Die in it and you lose nothing from your stash. Anything you extract with is yours to keep.</p>
      ${kitSummaryHTML(r)}<div class="facts"><span>Weapon</span><span>Service pistol</span><span>Suit</span><span>Contractor suit · 60 O₂</span><span>Pack</span><span>Sling pack · 6 slots</span><span>Supplies</span><span>2 bandage rolls · 12 rounds</span></div></div>`;
  else {
    const row=(slot,label)=>{ const g=r[slot], G=g?Sim.GEAR[g]:null;
      return `<div class="eq-row"><span class="lbl">${label}</span>${g?slotHTML("gear",g,1,G.name):`<div class="slot"></div>`}<div class="nm"><b>${G?G.name:"None"}</b><span>${G?G.desc:"Bump into husks to use your wrench."}</span></div><button class="plain" data-act="pick:${slot}">Change</button></div>${panelSub===slot?pickerHTML(slot):""}`; };
    const sup=SUPPLIES.map(c=>`<div class="eq-row"><span class="lbl">${c==="o2"?"O₂":c==="medkit"?"Trauma":"Bandage"}</span>${slotHTML(c,null,0,CONS[c].name)}<div class="nm"><b>${CONS[c].name}</b><span>${count(c)} in stash</span></div>
      <div class="stepper"><button data-act="cons:${c}:-1" aria-label="Fewer">−</button><b>${r.cons[c]}</b><button data-act="cons:${c}:1" aria-label="More" ${r.used>=r.cap||r.cons[c]>=count(c)?"disabled":""}>+</button></div></div>`).join("");
    body=`<div class="eq">${row("weapon","Weapon")}${row("armor","Suit")}${row("pack","Pack")}
      <div class="h-eyebrow">Supplies · ${r.used}/${r.cap} slots</div>${sup}
      <div class="eq-row"><span class="lbl">Rounds</span><div class="slot"><span class="num">${profile.rounds}</span></div><div class="nm"><b>Ammunition</b><span>${profile.rounds} in stash. Shared by every weapon.</span></div>
        <div class="stepper"><button data-act="rounds:-4" aria-label="Fewer rounds">−</button><b>${r.rounds}</b><button data-act="rounds:4" aria-label="More rounds" ${r.rounds>=profile.rounds?"disabled":""}>+</button></div></div>
      <p class="risk">A custom kit leaves your stash when you board a derelict. Extract and it all comes home, with whatever you found.</p></div>`;
  }
  return `<section class="panel h-card">${head}<div class="lo">${preview}${body}</div></section>`;
}
function pickerHTML(slot){
  const opts=[];
  if(slot==="weapon") opts.push(`<button data-act="set:weapon:"><span><div class="slot" style="width:36px;height:36px"></div>No weapon</span><span class="risk">wrench only</span></button>`);
  if(slot==="armor") opts.push(`<button data-act="set:armor:"><span><img alt="" src="${iconURL("gear","suit")}">Contractor suit</span><span class="risk">issued · free</span></button>`);
  if(slot==="pack") opts.push(`<button data-act="set:pack:"><span><img alt="" src="${iconURL("gear","sling")}">Sling pack</span><span class="risk">issued · free</span></button>`);
  for(const g of gearOwned(slot)) opts.push(`<button data-act="set:${slot}:${g}"><span><img alt="" src="${iconURL("gear",g)}">${Sim.GEAR[g].name}</span><span class="risk">×${count("gear",g)} in stash</span></button>`);
  if(opts.length<=1) opts.push(`<div class="risk">Nothing else for this slot in your stash. Find gear on derelicts or buy it from traders.</div>`);
  return `<div class="picker">${opts.join("")}</div>`;
}
function viewStash(){
  const cats=[["all","All"],["gear","Gear"],["supplies","Supplies"],["salvage","Salvage"]];
  const items=profile.stash.filter(q=>stashFilter==="all"||itemInfo(q).cat===stashFilter), sel=profile.stash.find(q=>q.uid===stashSel);
  const tiles=items.map(q=>{ const I=itemInfo(q); return `<button class="tile" data-act="sel:${q.uid}" aria-pressed="${q.uid===stashSel}"><img alt="" src="${iconURL(q.kind,q.gear)}"><span class="nm">${I.name}</span><span class="v">${I.sell} cr</span></button>`; }).join("");
  const total=profile.stash.reduce((a,q)=>a+itemInfo(q).sell,0);
  const detail=sel?(()=>{ const I=itemInfo(sel); return `<div class="panel h-card span4"><div class="h-eyebrow">${I.cat}</div><div class="bar-row">${slotHTML(sel.kind,sel.gear,1,I.name)}<h3 class="grow">${I.name}</h3></div><p>${I.desc}</p><p class="risk">Base value ${I.sell} cr. Sell it to a trader when docked at a station.</p></div>`; })()
    :`<div class="panel h-card span4"><div class="h-eyebrow">Stash</div><p>${profile.stash.length} items and ${profile.rounds} rounds, worth about ${total} cr at base prices.</p><p class="risk">Traders at stations buy salvage. Fennick pays the most.</p></div>`;
  return `<section class="h-grid"><div class="panel h-card span8"><div class="bar-row"><div class="chips grow">${cats.map(([k,n])=>`<button data-act="filter:${k}" aria-pressed="${stashFilter===k}">${n}</button>`).join("")}</div><span class="risk">${profile.rounds} rounds</span></div>
    ${items.length?`<div class="grid-items">${tiles}</div>`:`<p class="risk">Nothing here yet.</p>`}</div>${detail}</section>`;
}
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
function viewNpc(L,id){
  const N=World.NPCS[id], sh=ship(), back=`<button class="plain" data-act="back">← ${L.name}</button>`;
  const head=`<div class="panel npc span12"><img alt="" src="${portrait(N.look)}"><div><div class="role">${N.role}</div><b>${N.name}</b><q>${N.line}</q>${back}</div></div>`;
  if(N.contracts){ const offers=N.contracts.map(cid=>{ const done=sh.done.includes(cid), have=sh.contracts.includes(cid);
      return contractRow(cid,done?`<span class="risk good">Completed</span>`:have?`<span class="risk good">Accepted</span>`:`<button class="plain" data-act="accept:${cid}" ${sh.contracts.length>=3?"disabled":""}>Accept</button>`); }).join("");
    return `<section class="h-grid">${head}<div class="panel h-card span12"><div class="h-eyebrow">Work on offer</div>${offers}</div></section>`; }
  const stock=N.shop.stock.map(([item,price])=>{ const isG=!!Sim.GEAR[item], name=item==="rounds"?"Rounds ×8":isG?Sim.GEAR[item].name:CONS[item].name, desc=item==="rounds"?"Fits every weapon.":isG?Sim.GEAR[item].desc:CONS[item].desc;
      const own=item==="rounds"?profile.rounds:isG?count("gear",item):count(item), icon=item==="rounds"?iconURL("ammo"):iconURL(isG?"gear":item,isG?item:null);
      return `<div class="panel shop-row"><div class="slot"><img alt="" src="${icon}"></div><div class="nm"><b>${name}</b><span>${desc} · ${own} owned</span></div><span class="price">${price} cr</span><button class="plain" data-act="buy:${id}:${item}" ${profile.credits<price?"disabled":""}>Buy</button></div>`; }).join("");
  const sells=profile.stash.map(q=>{ const I=itemInfo(q), v=Math.round(I.sell*N.shop.sell), key="sell:"+q.uid;
      return `<div class="panel shop-row"><div class="slot"><img alt="" src="${iconURL(q.kind,q.gear)}"></div><div class="nm"><b>${I.name}</b><span>${I.cat}</span></div><span class="price">${v} cr</span><button class="plain" data-act="sell:${id}:${q.uid}">${armed[key]?"Confirm":"Sell"}</button></div>`; }).join("");
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
      ${kitSummaryHTML(r)}<p class="risk ${r.free?"good":"bad"}">${r.free?"Free kit. Nothing from your stash is at risk.":`If you die you lose this kit: about ${risk} cr.`}${!r.weapon?" You are going in without a gun.":""}</p>
      ${btn}</div></section>`;
}
function viewCrew(){
  if(!Net.avail&&!window.claude) return `<section class="panel h-card"><h3>Squads are coming to the app</h3><p>This build of Hullbreach runs solo, with your save kept on this device. Co-op squads need the Hullbreach multiplayer server, which is next on the roadmap. Until then you can play squads in the claude.ai version of the game.</p></section>`;
  if(!Net.avail) return `<section class="panel h-card"><h3>Multiplayer isn't available here</h3><p>Squads need everyone signed in to Claude with this page shared to them, with permission to use it. Ask the page's owner to share it from the Share menu. Until then you can keep playing solo.</p></section>`;
  if(!inSquad()){
    const open=Net.lobbyPeers.filter(p=>!p.sameTab&&p.presence&&p.presence.app==="hb"&&p.presence.open&&p.presence.sq);
    return `<section class="h-grid"><div class="panel h-card span6"><div class="h-eyebrow">Lead a squad</div><p>Your ship becomes the squad's ship. You fly it, pick the targets and launch raids. Contract rewards go to everyone.</p><button class="deploy-btn" data-act="sqcreate">Open a squad</button></div>
      <div class="panel h-card span6"><div class="h-eyebrow">Join a squad</div><div class="bar-row"><input id="sq-code" maxlength="8" placeholder="Code" aria-label="Squad code" autocomplete="off" style="font:600 18px var(--f-num);letter-spacing:.2em;text-transform:uppercase;background:#071010;color:var(--bone);border:1px solid var(--line-dim);height:40px;padding:0 10px;width:140px"><button class="plain" data-act="sqjoin">Join</button></div>
        <div class="h-eyebrow" style="margin-top:6px">Open squads on this page</div>
        ${open.length?open.map(p=>`<div class="panel contract-row"><div><b>${(p.by&&Net.names[p.by])||"A contractor"}</b><br><span>${p.presence.crew}/4 crew · at ${String(p.presence.loc||"").slice(0,40)}</span></div><button class="plain" data-act="sqjoin:${String(p.presence.sq).replace(/[^a-z0-9]/g,"")}">Join</button></div>`).join(""):`<p class="risk">Nobody has an open squad right now.</p>`}</div></section>`; }
  return `<section class="h-grid"><div class="panel h-card span7"><div class="h-eyebrow">Squad code</div><h2 style="font-family:var(--f-num);letter-spacing:.3em">${Net.code.toUpperCase()}</h2><p class="risk">Crew can join with this code from their own Crew panel, or pick your squad from the open list.</p>
      <div class="squad">${Net.roster.map(q=>`<div class="${q.key===Net.myKey?"me":""}"><b>${nameOf(q.key)}</b><span>${q.key===(Net.setup?Net.setup.hostKey:Net.myKey)&&Net.host===(q.key===Net.myKey)?"Leader":"Crew"}${q.ready?" · ready":""}</span></div>`).join("")}${"<div>Open berth</div>".repeat(Math.max(0,4-Net.roster.length))}</div></div>
    <div class="panel h-card span5"><div class="h-eyebrow">${Net.host?"You lead this squad":"Crew member"}</div><p>${Net.host?"You fly the ship and launch raids. If you leave, the squad ends.":"The leader flies the ship and launches raids. Your stash and credits stay your own."}</p>
      <button class="plain" data-act="sqleave">${armed.sqleave?"Confirm":Net.host?"Disband squad":"Leave squad"}</button></div></section>`;
}
function viewDebrief(){ const Lr=profile.last; if(!Lr) return "<p>No raid to report.</p>";
  return `<section class="panel h-card report ${Lr.win?"":"lose"}"><h3>${Lr.win?`Extracted from ${Lr.site}`:`Lost on ${Lr.site}`}</h3>
    ${Lr.contract?`<p class="risk good">Contract complete: ${Lr.contract.title}. ${Lr.contract.reward} cr paid to the crew.</p>`:""}
    ${Lr.win?`<p>Brought home ${Lr.items.length} item${Lr.items.length===1?"":"s"} worth about ${Lr.value} cr${Lr.rounds?` and ${Lr.rounds} rounds`:""}. Everything is in the stash locker.</p>${Lr.items.length?`<ul>${Lr.items.slice(0,10).map(n=>`<li>${n}</li>`).join("")}${Lr.items.length>10?`<li>and ${Lr.items.length-10} more</li>`:""}</ul>`:""}`
      :`<p>${Lr.cause||"You did not come back."} ${Lr.kit==="custom"?"Your custom kit is gone.":"You went in on the starter kit, so your stash is untouched."}</p>`}
    <div class="bar-row"><button class="plain" data-act="close">Back to the ship</button></div></section>`; }

// ---------- panel actions ----------
function worldAct(a){
  const shared=["travel","tow","refuel","accept","drop"].includes(a.type);
  if(inSquad()&&!Net.host&&shared){ if(a.type==="accept"||a.type==="drop"){ emit({t:"wreq",a}); toast("Sent to the squad leader."); } else toast("Only the squad leader flies and refuels the ship."); return {ok:false}; }
  const res=World.act(ship(),{id:PID,profile},a); if(res.msg) toast(res.msg); if(res.ok){ save(); if(shared&&inSquad()) hostBroadcastShip(false); } return res; }
$("p-body").addEventListener("click",e=>{
  const b=e.target.closest("[data-act]"); if(!b||b.disabled) return; const [a,x,y]=b.dataset.act.split(":"); const k=profile.kit;
  const arm=key=>{ if(armed[key]){ armed={}; return true; } armed={[key]:1}; setTimeout(()=>{ if(armed[key]){ armed={}; renderPanel(); } },3000); return false; };
  switch(a){
    case "close": closePanel(); return;
    case "open": openPanel(x); return;
    case "back": panelSub=null; break;
    case "sel": if(panelKind==="helm") mapSel=x; else stashSel=stashSel===x?null:x; break;
    case "jump": { const res=worldAct({type:"travel",to:x}); if(res.ok){ if(inSquad()) emit({t:"warp"}); closePanel(); mapSel=null; warp={start:performance.now(),dur:2200,done:()=>{ toast(`Arrived at ${here().name}.`); renderShipHud(); }}; renderShipHud(); } break; }
    case "tow": { const res=worldAct({type:"tow"}); if(res.ok){ closePanel(); warp={start:performance.now(),dur:2600,done:()=>renderShipHud()}; } break; }
    case "refuel": worldAct({type:"refuel"}); break;
    case "npc": panelSub="npc:"+x; break;
    case "accept": worldAct({type:"accept",id:x}); break;
    case "drop": if(arm("drop:"+x)) worldAct({type:"drop",id:x}); break;
    case "buy": worldAct({type:"buy",npc:x,item:y}); break;
    case "sell": if(arm("sell:"+y)) worldAct({type:"sell",npc:x,uid:y}); break;
    case "filter": stashFilter=x; break;
    case "deploy": deploy(); return;
    case "launch": Net.ready=true; Net.readyLo=loadoutFromKit(kitResolved()); squadPresence(); hostLaunch(); return;
    case "ready": setReady(!Net.ready); return;
    case "sqcreate": createSquad(); return;
    case "sqjoin": joinSquad(x||($("sq-code")?$("sq-code").value:"")); return;
    case "sqleave": if(arm("sqleave")) leaveSquad(Net.host?"Squad disbanded.":"You left the squad."); break;
    case "kit": k.type=x; panelSub=null; save(); refreshLook(); break;
    case "pick": panelSub=panelSub===x?null:x; break;
    case "set": k[x]=y||null; panelSub=null; save(); refreshLook(); break;
    case "cons": { const r=kitResolved(); k.cons[x]=Math.max(0,(r.cons[x]|0)+(+y)); save(); break; }
    case "rounds": k.rounds=Math.max(0,Math.min(profile.rounds,(kitResolved().rounds|0)+(+x))); save(); break;
  }
  renderPanel(); if(S&&S.mode==="ship") renderShipHud();
});
function refreshLook(){ if(inSquad()&&Net.ready) setReady(false); if(S&&S.mode==="ship"){ const r=kitResolved(), p=me(); p.armor=r.armor; p.weapon=r.weapon; } if(inSquad()) squadPresence(); }

// ---------- scene changes ----------
function boardShipCrew(crew){
  const raidOver=S&&S.mode==="raid"; if(raidOver&&!Net.settled) settlePersonal();
  const r=kitResolved(); PID=crewKey();
  crew=crew.map(c=>c.id===PID?{...c,loadout:{weapon:r.weapon,armor:r.armor,pack:r.pack,rounds:0,inv:[]}}:c);
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
function loadoutFromKit(r){ if(r.free) return {...JSON.parse(JSON.stringify(Sim.STARTER)),starter:true};
  const inv=[]; for(const c of SUPPLIES) for(let n=0;n<r.cons[c];n++) inv.push({kind:c,name:CONS[c].name});
  return {weapon:r.weapon,armor:r.armor,pack:r.pack,rounds:r.rounds,inv}; }
function consumeKit(lo){
  profile.stats.raids++; profile.active={kit:lo.starter?"starter":"custom",site:ship().loc,at:Date.now()};
  if(!lo.starter){ const take=(kind,gear)=>{ const i=profile.stash.findIndex(q=>q.kind===kind&&(!gear||q.gear===gear)); if(i>=0) profile.stash.splice(i,1); };
    for(const s of ["weapon","armor","pack"]) if(lo[s]&&!Sim.GEAR[lo[s]].issued) take("gear",lo[s]);
    for(const it of lo.inv||[]) take(it.kind); profile.rounds=Math.max(0,profile.rounds-(lo.rounds|0)); }
  save();
}
function deploy(){
  const L=here(); if(L.type!=="derelict") return;
  if(inSquad()){ if(Net.host){ Net.ready=true; Net.readyLo=loadoutFromKit(kitResolved()); squadPresence(); hostLaunch(); } else setReady(!Net.ready); return; }
  const lo=loadoutFromKit(kitResolved()); consumeKit(lo); closePanel(); PID="p1"; Net.settled=false;
  S=Sim.newGame((Math.random()*2**32)>>>0,lo,{map:"ks9",site:L.name,mods:L.site.mods});
  const C=World.siteContract(ship(),L.id); $("r-site").textContent=(C?"Contract · ":"Salvage · ")+L.name;
  rp={}; parts=[]; camInit=false; staticKey=""; target=null; stopTravel(); spectating=false; resize(); afterChange();
}
// Each player settles their own haul. The crew contract pays out if anyone got the black box home.
function settlePersonal(){
  if(!S||S.mode!=="raid"||Net.settled) return; Net.settled=true;
  const p=me(), win=!!p.extracted, L=here(), crew=S.ents.filter(e=>e.kind==="player");
  const rep={win,items:[],value:0,rounds:0,cause:p.cause||S.cause,site:L.name,kit:profile.active?.kit||"starter",contract:null};
  const bbHome=crew.some(q=>q.extracted&&q.inv.some(i=>i.kind==="blackbox")), cid=World.siteContract(ship(),L.id);
  if(cid&&bbHome){ const C=World.CONTRACTS[cid]; profile.credits+=C.reward; profile.stats.contracts++; rep.contract={title:C.title,reward:C.reward};
    const i=p.inv.findIndex(q=>q.kind==="blackbox"); if(i>=0&&win) p.inv.splice(i,1); }
  if(isHost()) World.settleRaid(profile.ship,[],{status:bbHome?"extracted":"lost",blackbox:bbHome},L.id);
  if(win){
    for(const it of p.inv){ const m=mk(it); profile.stash.push(m); const I=itemInfo(m); rep.items.push(I.name); rep.value+=I.sell; }
    for(const s of ["weapon","armor","pack"]){ const g=p[s]; if(g&&!Sim.GEAR[g].issued){ profile.stash.push(mk({kind:"gear",gear:g})); rep.items.push(Sim.GEAR[g].name); } }
    profile.rounds+=p.ammo; rep.rounds=p.ammo; profile.stats.extracts++; profile.stats.earned+=rep.value; profile.stats.best=Math.max(profile.stats.best,rep.value);
  } else profile.stats.deaths++;
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
  if(st&&st.mode==="raid"&&st.status==="playing"&&st.W===55){ S=st; S.fx=[]; afterChange(); $("r-site").textContent="Contract · "+S.site; }
  else {
    if(profile.active){ profile.stats.deaths++; profile.last={win:false,items:[],value:0,site:World.loc(profile.active.site||"ks9").name,cause:"Contact lost. Your last raid ended when the link dropped.",kit:profile.active.kit}; profile.active=null; save(); boardShip(); openPanel("debrief"); }
    else { boardShip(); if(!profile.welcomed){ profile.welcomed=true; save(); toast("Welcome aboard. Walk to a terminal and press F, or tap it. The airlock leads into Hangar Ninefold."); } }
  }
  Store.init();
}

