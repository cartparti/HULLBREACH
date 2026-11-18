// ============================ MULTIPLAYER ===========================
// Squads of up to 4 meet through the page's `room` capability.
// - Lobby: the shared room. Presence advertises open squads.
// - Squad: a named room "sq-<code>". The squad leader (host) owns the crew
//   ship and is the sequencer for raids: crew send action requests, the host
//   applies them with Sim.act and broadcasts {n, actor, action}; every page
//   replays the same numbered actions on the same seeded station (lockstep).
//   Late or out-of-step pages ask for the action log again and replay it.
// - Aboard the ship, crew positions travel in presence (no rules involved).
const TOPIC="hb";
const Net={avail:false,room:null,user:null,sq:null,code:null,host:false,myKey:null,myPeer:null,myId:null,
  roster:[],names:{},ship:null,ep:0,n:0,log:[],setup:null,applied:0,buf:{},syncing:false,lobbyPeers:[],ready:false,readyLo:null,settled:false,unsub:[]};
const inSquad=()=>!!Net.sq;
const isHost=()=>!Net.sq||Net.host;
const crewKey=()=>Net.sq?Net.myKey:"p1";

async function netInit(){
  try{
    let room=null, user=null;
    if(window.claude?.use) [room,user]=await Promise.all([window.claude.use("room"),window.claude.use("user")]);
    else { const url=HB.serverUrl(); if(!url) return; Net.connecting=true; if(panelKind==="crew") renderPanel();
      const t=await wsTransport(url); Net.connecting=false; if(!t){ Net.avail=false; if(panelKind==="crew"){ renderPanel(); toast("Couldn't reach the squad server at that address."); } return; }
      room=t.room; user=t.user; Net.app=true; }
    if(!room) return; Net.room=room; Net.user=user;
    Net.myId=user?await user.id():null;
    room.onPeers(ch=>{ Net.lobbyPeers=ch.peers; const meP=ch.peers.find(p=>p.sameTab); if(meP) Net.myPeer=meP.peer; if(!Net.myKey) Net.myKey=Net.myId||Net.myPeer; resolveNames(ch.peers); if(panelKind==="crew") renderPanel(); });
    Net.avail=true; Net.myKey=Net.myId||null; lobbyPresence();
    if(panelKind==="crew") renderPanel();
  }catch(e){ Net.avail=false; }
}
async function resolveNames(peers){
  if(Net.app) for(const p of peers) if(p.by&&p.presence&&typeof p.presence.nm==="string"&&p.presence.nm) Net.names[p.by]=p.presence.nm.slice(0,20);
  if(!Net.user||!Net.user.profiles) return; const ids=[...new Set(peers.map(p=>p.by).filter(Boolean))].filter(id=>!(id in Net.names)); if(!ids.length) return;
  try{ const ps=await Net.user.profiles(ids); for(const id of ids) Net.names[id]=(ps[id]&&ps[id].name)||""; }catch(e){}
  if(panelKind==="crew") renderPanel(); if(S) renderPanels();
}
function nameOf(key){ if(key===crewKey()) return "You"; const n=Net.names[key]; if(n) return n; const i=Net.roster.findIndex(r=>r.key===key); return i>=0?`Crew ${i+1}`:"Crewmate"; }
function lobbyPresence(){ document.body.dataset.squad=Net.sq?"1":""; if(typeof renderChat==="function") renderChat(); if(!Net.room) return; const L=here(); Net.room.presence({app:"hb",sq:Net.sq&&Net.host?Net.code:null,crew:Net.roster.length||1,loc:L?L.name:"",raid:!!(S&&S.mode==="raid"),open:Net.sq&&Net.host&&Net.roster.length<4&&!(S&&S.mode==="raid")}).catch(()=>{}); }
function emit(data){ if(Net.sq) Net.sq.emit(TOPIC,data).catch(()=>{}); }
function squadPresence(extra){ if(!Net.sq) return; Net.sq.presence({k:Net.myKey,look:lookOfKit(),ready:Net.ready,lo:Net.ready?Net.readyLo:null,...(extra||{})}).catch(()=>{}); }

// ---------- squad lifecycle ----------
async function createSquad(){ if(!Net.avail) return; const code=Array.from({length:4},()=>"abcdefghjkmnpqrstuvwxyz23456789"[Math.random()*31|0]).join(""); await joinSquad(code,true); }
async function joinSquad(code,asHost){
  if(!Net.avail||Net.sq) return; code=String(code||"").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,8); if(!code){ toast("Enter a squad code."); return; }
  try{ Net.sq=await Net.room.join("sq-"+code); }catch(e){ toast("Couldn't reach that squad. Try again in a moment."); return; }
  Object.assign(Net,{code,host:!!asHost,roster:[],ep:0,n:0,log:[],setup:null,applied:0,buf:{},ready:false,readyLo:null,ship:null,settled:false});
  Net.unsub.push(Net.sq.on(TOPIC,onSquadMsg,()=>leaveSquad("The squad link dropped.")));
  Net.unsub.push(Net.sq.onPeers(onSquadPeers));
  squadPresence({x:me()?me().x:0,y:me()?me().y:0,f:[1,0]});
  if(Net.host){ Net.ship=profile.ship; toast(`Squad ${code.toUpperCase()} open. Share the code with your crew.`); }
  else { toast(`Joining squad ${code.toUpperCase()}…`); setTimeout(()=>emit({t:"hello"}),400); Net.helloTimer=setTimeout(()=>{ if(!Net.setup) leaveSquad("No squad leader answered on that code."); },8000); }
  lobbyPresence(); if(panelKind==="crew") renderPanel();
}
function leaveSquad(msg){
  if(!Net.sq) return; const wasRaid=S&&S.mode==="raid"&&me()&&me().alive;
  if(Net.host) emit({t:"bye"});
  for(const u of Net.unsub) try{ u(); }catch(e){} Net.unsub=[]; clearTimeout(Net.helloTimer);
  Net.sq.leave().catch(()=>{}); Net.sq=null; Net.code=null; Net.host=false; Net.roster=[]; Net.ship=null; Net.setup=null;
  if(msg) toast(msg);
  if(wasRaid){ profile.stats.deaths++; profile.last={win:false,items:[],value:0,site:here().name,cause:"Contact with the squad was lost mid-raid.",kit:profile.active?.kit||"starter"}; profile.active=null; save(); boardShip(); openPanel("debrief"); }
  else if(S) { boardShip(); }
  lobbyPresence(); if(panelKind==="crew") renderPanel();
}
function onSquadPeers(ch){
  const peers=ch.peers.filter(p=>p.presence&&p.presence.k);
  Net.roster=peers.map(p=>({key:p.presence.k,peer:p.peer,by:p.by,look:p.presence.look||{},ready:!!p.presence.ready,lo:p.presence.lo||null,x:p.presence.x,y:p.presence.y,f:p.presence.f}))
    .sort((a,b)=>a.key<b.key?-1:1).slice(0,4);
  resolveNames(ch.peers);
  // crew positions aboard the ship
  if(S&&S.mode==="ship") for(const r of Net.roster){ if(r.key===Net.myKey) continue; const e=S.ents.find(q=>q.id===r.key); if(e&&typeof r.x==="number"){ e.x=r.x; e.y=r.y; if(r.f) e.face=r.f; if(r.look&&"a" in r.look){ const {hd,a,lg,ac,w,...lk}=r.look, o=d=>d?{d,r:0}:null; e.head=o(hd); e.armor=o(a); e.legs=o(lg); e.acc=o(ac); e.w1=o(w); e.w2=null; e.act=1; e.look=lk; } } }
  // two crew on one tile (both grabbed the same seat): the later key steps off
  if(S&&S.mode==="ship"&&me()){ const mine=me(), clash=Net.roster.find(r=>r.key!==Net.myKey&&r.x===mine.x&&r.y===mine.y&&r.key<Net.myKey);
    if(clash){ for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){ const t=Sim.tileAt(S,mine.x+dx,mine.y+dy); if(Sim.walk(t)&&t.t!=="seat"&&!S.ents.some(e=>e!==mine&&e.x===mine.x+dx&&e.y===mine.y+dy)){ mine.x+=dx; mine.y+=dy; toast("That seat's taken."); netShipMoved(); break; } } } }
  if(Net.host){
    for(const p of ch.left) hostCrewLeft(p);
    const shipCrew=S&&S.mode==="ship"?S.ents.filter(e=>e.kind==="player").map(e=>e.id).sort().join(","):"";
    if(S&&S.mode==="ship"&&shipCrew!==Net.roster.map(r=>r.key).join(",")) hostBroadcastShip(true);
  } else if(ch.left.some(p=>p.presence&&Net.setup&&p.presence.k===Net.setup.hostKey)) leaveSquad("The squad leader left. You're back on your own ship.");
  else if(!Net.setup&&S&&S.mode==="ship"&&Net.roster.length) { /* waiting for host */ }
  if(S&&S.mode==="ship"&&!Net.host&&Net.setup&&Net.setup.scene==="ship"){ const want=Net.roster.map(r=>r.key).join(","), have=S.ents.filter(e=>e.kind==="player").map(e=>e.id).sort().join(","); if(want!==have) buildFromSetup(); }
  lobbyPresence(); if(panelKind==="crew"||panelKind==="airlock") renderPanel(); if(S) renderPanels();
}

// ---------- host side ----------
function hostBroadcastShip(rebuild){
  if(!Net.host||!Net.sq) return; Net.ship=profile.ship;
  if(rebuild){ Net.ep++; Net.n=0; Net.log=[]; const crew=crewList();
    Net.setup={t:"state",ep:Net.ep,scene:"ship",hostKey:Net.myKey,crew,ship:profile.ship}; emit(Net.setup); buildFromSetup(); }
  else emit({t:"ship",ship:profile.ship});
}
function lookLoadout(L){ L=L||{}; const {hd,a,lg,ac,w,...lk}=L, o=d=>d?{d,r:0}:null; return {w1:o(w),head:o(hd),armor:o(a),legs:o(lg),acc:o(ac),pack:null,ammo:{},inv:[],look:lk}; }
function crewList(){ const rs=Net.roster.length?Net.roster:[{key:Net.myKey,look:{}}]; if(!rs.some(r=>r.key===Net.myKey)) rs.push({key:Net.myKey,look:{}});
  return rs.map(r=>({id:r.key,name:"",loadout:lookLoadout(r.look)})).sort((a,b)=>a.id<b.id?-1:1); }
function hostLaunch(){
  if(!Net.host) return; const L=here(); if(L.type!=="derelict") return;
  const crew=Net.roster.map(r=>({id:r.key,name:"",loadout:r.key===Net.myKey?Net.readyLo:r.lo})).filter(c=>c.loadout).sort((a,b)=>a.id<b.id?-1:1);
  if(crew.length!==Net.roster.length){ toast("Everyone needs to ready up first."); return; }
  Net.ep++; Net.n=0; Net.log=[];
  Net.setup={t:"state",ep:Net.ep,scene:"raid",hostKey:Net.myKey,seed:(Math.random()*2**32)>>>0,site:L.id,crew,ship:profile.ship,fx:factionSetup(Net.myKey)};
  if(profile.hire){ profile.hire=null; save(); }
  const json=JSON.stringify(Net.setup); if(json.length>3900){ toast("Loadouts are too large to send. Carry fewer supplies."); return; }
  emit(Net.setup); buildFromSetup();
}
function hostApply(key,a){
  if(!S||S.mode!=="raid") return false;
  const before=S.log.length, ok=Sim.act(S,key,a);
  if(ok){ Net.n++; Net.log.push([key,a]); Net.applied=Net.n; emit({t:"seq",ep:Net.ep,n:Net.n,k:key,a,h:Net.n%4===0?Sim.hash(S):undefined}); afterChange(); hostAutoWait(); }
  else if(key!==Net.myKey&&S.log.length>before) emit({t:"nack",k:key,msg:S.log[S.log.length-1].msg});
  return ok;
}
function hostAutoWait(){ // crew who left mid-raid stand still so the station can keep moving
  if(!S||S.mode!=="raid"||S.status!=="playing") return; const present=new Set(Net.roster.map(r=>r.key));
  for(const p of S.ents) if(p.kind==="player"&&p.alive&&!p.acted&&!present.has(p.id)){ hostApply(p.id,{type:"wait"}); return; }
}
function hostCrewLeft(peer){ if(S&&S.mode==="raid") setTimeout(hostAutoWait,50); }
function hostSendLog(from){ for(let i=Math.max(1,from);i<=Net.n;i+=40) emit({t:"log",ep:Net.ep,from:i,acts:Net.log.slice(i-1,i-1+40)}); }

// ---------- message handling ----------
function onSquadMsg(m){
  const d=m.data; if(!d||typeof d!=="object") return; const fromKey=m.by||m.peer;
  if(d.t==="chat"){ if(!m.sameTab&&typeof d.m==="string") addChat(fromKey,d.m); return; }
  if(d.t==="fx"){ if(!m.sameTab&&typeof d.kind==="string") flavorFx(d.kind,d.x|0,d.y|0,false); return; }
  if(d.t==="suggest"){ if(!m.sameTab&&World.loc(d.to)){ Net.suggest={k:fromKey,to:d.to,at:Date.now()}; if(Net.host) toast(`${nameOf(fromKey)} suggests a course to ${World.loc(d.to).name}. Open the star map to fly there.`); if(panelKind==="helm") renderPanel(); } return; }
  if(d.t==="ping"){ if(!m.sameTab&&Number.isFinite(d.x)&&Number.isFinite(d.y)) addPing(fromKey,d.x,d.y,String(d.kind),d.sc); return; }
  if(m.sameTab&&d.t!=="state") return;
  if(Net.host){
    switch(d.t){
      case "hello": if(S&&S.mode==="raid"&&Net.setup&&Net.setup.scene==="raid"&&!Net.setup.crew.some(c=>c.id===fromKey)){ emit({t:"busy",to:fromKey}); return; }
        if(!Net.setup) hostBroadcastShip(true); else { emit(Net.setup); if(Net.setup.scene==="raid") hostSendLog(1); } return;
      case "req": if(d.ep===Net.ep&&d.a&&typeof d.a.type==="string") hostApply(fromKey,d.a); return;
      case "sync": if(d.ep===Net.ep){ emit(Net.setup); hostSendLog(1); } return;
      case "wreq": hostWorld(fromKey,d.a); return;
    }
    return;
  }
  switch(d.t){
    case "state": if(m.sameTab) return; clearTimeout(Net.helloTimer); Net.setup=d; Net.ep=d.ep; Net.applied=0; Net.buf={};
      if(d.scene==="raid"&&!d.crew.some(c=>c.id===Net.myKey)){ leaveSquad("That squad is already on a raid."); return; }
      buildFromSetup(); return;
    case "busy": if(d.to===Net.myKey) leaveSquad("That squad is already on a raid."); return;
    case "seq": if(d.ep!==Net.ep||!S||S.mode!=="raid") return; Net.buf[d.n]=d; drain(); return;
    case "log": if(d.ep!==Net.ep||!S||S.mode!=="raid") return; d.acts.forEach((ka,i)=>{ Net.buf[d.from+i]={n:d.from+i,k:ka[0],a:ka[1]}; }); drain(); return;
    case "ship": Net.ship=d.ship; if(S&&S.mode==="ship"){ renderShipHud(); if(panelKind) renderPanel(); } return;
    case "warp": if(S&&S.mode==="ship"){ travelHunger(Math.max(1,Math.min(6,d.d|0||1))); closePanel(); warp={start:performance.now(),dur:2200,done:()=>{ toast(`Arrived at ${here().name}.`); renderShipHud(); }}; renderShipHud(); } return;
    case "nack": if(d.k===Net.myKey&&d.msg&&S){ S.log.push({t:S.turn,msg:d.msg,kind:"info",pid:Net.myKey}); renderPanels(); } return;
    case "toast": if(!d.to||d.to===Net.myKey) toast(String(d.msg||"").slice(0,200)); return;
    case "bye": leaveSquad("The squad leader disbanded the squad."); return;
  }
}
function drain(){
  let moved=false;
  while(Net.buf[Net.applied+1]){ const d=Net.buf[Net.applied+1]; delete Net.buf[Net.applied+1]; Sim.act(S,d.k,d.a); Net.applied++; moved=true;
    if(d.h&&Sim.hash(S)!==d.h){ requestResync(); return; } }
  if(moved){ Net.syncing=false; afterChange(); }
  const pending=Object.keys(Net.buf).map(Number); if(pending.length&&!Net.syncing){ Net.syncing=true; emit({t:"sync",ep:Net.ep,from:Net.applied+1}); setTimeout(()=>{ Net.syncing=false; },2500); }
}
function requestResync(){ Net.applied=0; Net.buf={}; buildFromSetup(); Net.syncing=true; emit({t:"sync",ep:Net.ep,from:1}); setTimeout(()=>{ Net.syncing=false; },2500); }
function buildFromSetup(){
  const d=Net.setup; if(!d) return; PID=Net.myKey;
  if(d.scene==="ship"&&S&&S.mode==="raid"&&!Net.settled) settlePersonal(); // settle against the ship as it was during the raid
  Net.ship=d.ship;
  if(d.scene==="ship"){ boardShipCrew(d.crew); return; }
  // raid: take my kit out of my stash, then build the identical station
  const mine=d.crew.find(c=>c.id===Net.myKey);
  if(!Net.inRaidEp||Net.inRaidEp!==d.ep){ Net.inRaidEp=d.ep; Net.settled=false; consumeKit(mine.loadout); }
  const L=World.loc(d.site);
  S=Sim.newGame(d.seed,null,{...raidOpts(L,d.fx||{rep:{},hire:null}),crew:d.crew}); Net.applied=0;
  const C=World.siteContract(ship(),L.id); $("r-site").textContent=(C?"Contract · ":"Salvage · ")+L.name;
  closePanel(); rp={}; parts=[]; camInit=false; staticKey=""; target=null; stopTravel(); spectating=false; resize(); afterChange(); lobbyPresence();
}

// ---------- requests from this page ----------
function netRaidAction(a){ if(Net.host) return hostApply(Net.myKey,a); emit({t:"req",ep:Net.ep,a}); return true; }
function hostWorld(fromKey,a){
  if(!a||typeof a.type!=="string") return; const allowed=["accept","drop"]; if(!allowed.includes(a.type)) return;
  const res=World.act(profile.ship,{id:fromKey,profile},a); if(res.ok){ save(); hostBroadcastShip(false); if(S&&S.mode==="ship") renderShipHud(); }
  emit({t:"toast",to:fromKey,msg:res.msg});
}
function netShipMoved(){ if(!Net.sq||!S||S.mode!=="ship") return; const p=me(); Net.sq.presence({x:p.x,y:p.y,f:p.face}).catch(()=>{}); }
function setReady(on){ Net.ready=on; if(on){ const r=kitResolved(); Net.readyLo=loadoutFromKit(r); } else Net.readyLo=null; squadPresence(); renderPanel(); }

