// ============================ SQUAD PLAY ============================
// Shared vision, name tags, edge markers, pings, chat, crew cards,
// downed/revive prompts and item hand-offs. All presentation: the rules
// (revive, give) are Sim actions that travel through the lockstep sequencer.
const QUICK=["On me","Hold here","Need help!","Husk!","Loot here","Covering you","Go go go","Thanks"];
// lines for talking to other crews (raiders read intent from anything you type)
const TALK=["Hey! Who's there?","We don't want trouble.","Back off or I shoot!","Drop your weapons!","Want to trade?","Watch my back?","Who are you with?"];
const raidTalk=()=>S&&S.mode==="raid"&&S.status==="playing";
const chatOn=()=>inSquad()||raidTalk();
const BUBBLE={}; const heardLog=new WeakSet();
const PING_NAME={move:"Move here",danger:"Danger",loot:"Loot",target:"Target",here:"Over here"};
Net.chat=[]; Net.pings=[]; let lastPing=0, tagEls={};
const crewPlayers=()=>S?S.ents.filter(e=>e.kind==="player"):[];
function colorOf(key){ const ps=crewPlayers(); let i=ps.findIndex(e=>e.id===key); if(i<0) i=Net.roster.findIndex(r=>r.key===key); return CREW_COL[(i<0?0:i)%4]; }
function adjacentCrew(pred){ const p=me(); if(!p) return null; return crewPlayers().find(q=>q.id!==p.id&&q.alive&&Math.abs(q.x-p.x)+Math.abs(q.y-p.y)===1&&(!pred||pred(q)))||null; }

// ---------- shared vision ----------
function shareVision(){
  if(!S||S.mode!=="raid"||!inSquad()||!VIS) return; const mine=me(), v0=viewEnt();
  for(const q of crewPlayers()){ if(!q.alive||q.id===v0.id) continue; const v=Sim.fov(S,q); for(let i=0;i<v.length;i++) if(v[i]){ VIS[i]=1; mine.seen[i]=1; } }
}

// ---------- chat ----------
function addChat(k,text,sys,o){ Net.chat.push({k,text:String(text).slice(0,140),at:Date.now(),sys:!!sys,...(o||{})}); if(Net.chat.length>40) Net.chat.shift(); renderChat(); }
function sendChat(text){ text=String(text||"").trim().slice(0,140); if(!text) return;
  if(raidTalk()){ send({type:"talk",text:text.slice(0,120)},true); return; }   // spoken aloud in the station: crewmates and raiders hear it
  if(!inSquad()) return; emit({t:"chat",m:text}); addChat(Net.myKey,text); }
// lines spoken in the raid (yours, your crew's, raiders') go to the chat feed and float over the speaker
function harvestChat(){ if(!S||!S.log) return; let any=false;
  for(const l of S.log){ if(l.kind!=="chat"||heardLog.has(l)) continue; heardLog.add(l); if(l.t<S.turn-2) continue; any=true; BUBBLE[l.from]={msg:l.msg,at:Date.now()}; if(typeof setExpr==="function"){ const m=l.fac!=null?(l.att==="hostile"?(/!/.test(l.msg)?"shout":"angry"):l.att==="friendly"?"happy":"talk"):chatMood(l.msg); setExpr(l.from,m==="angry"?"angry":m,m==="talk"?1500:1700,2); }
    const raider=l.fac!=null; addChat(l.from,l.msg,false,raider?{nm:l.who,col:{hostile:"#e0482f",wary:"#e8b048",friendly:"#7cc46a"}[l.att]||"#e8b048",tagx:Sim.FACTIONS[l.fac].short}:{}); }
  if(any) renderChat(); }
function renderChat(){
  const box=$("chat"); if(!box) return; box.hidden=!chatOn(); if(box.hidden) return;
  const now=Date.now(), open=box.classList.contains("open");
  $("chat-feed").innerHTML=Net.chat.slice(open?-10:(mode==="touch"?-3:-4)).map(c=>{ const el=document.createElement("div"); el.textContent=c.text; return `<div class="${now-c.at>9000?"old":""}" style="--c:${c.col||colorOf(c.k)}"><b>${esc(c.sys?"◆":c.nm||(c.k===PID&&!inSquad()?"You":nameOf(c.k)))}${c.tagx?` <small>${esc(c.tagx)}</small>`:""}</b>${el.innerHTML}</div>`; }).join("");
}
function esc(t){ const d=document.createElement("div"); d.textContent=t; return d.innerHTML; }
function openChat(on){ const box=$("chat"); if(!chatOn()) return; box.classList.toggle("open",on); $("chat-entry").hidden=!on; if(on){ $("chat-in").placeholder=raidTalk()?"Say something out loud":"Message your squad"; $("chat-quick").innerHTML=[...(raidTalk()?TALK:[]),...(inSquad()?QUICK:[])].map(q=>`<button class="plain" data-q="${esc(q)}">${esc(q)}</button>`).join(""); setTimeout(()=>$("chat-in").focus(),0); } else $("chat-in").blur(); renderChat(); }
$("chat-send").onclick=()=>{ sendChat($("chat-in").value); $("chat-in").value=""; if(mode==="touch") openChat(false); };
$("chat-close").onclick=()=>openChat(false);
$("chat-quick").addEventListener("click",e=>{ const b=e.target.closest("[data-q]"); if(b){ sendChat(b.dataset.q); openChat(false); } });
$("chat-in").addEventListener("keydown",e=>{ e.stopPropagation(); if(e.key==="Enter"){ sendChat($("chat-in").value); $("chat-in").value=""; openChat(false); } if(e.key==="Escape") openChat(false); });
$("t-chat").onclick=()=>openChat(!$("chat").classList.contains("open"));
$("s-chat").onclick=()=>openChat(!$("chat").classList.contains("open"));
setInterval(()=>{ if(chatOn()&&Net.chat.length) renderChat(); },3000);

// ---------- pings ----------
function pingKindAt(x,y){
  if(!S) return "move"; const i=Sim.idx(S,x,y); if(x<0||y<0||x>=S.W||y>=S.H) return null;
  const t=S.tiles[i], e=Sim.entAt(S,x,y);
  if(S.mode==="ship") return "here";
  if(VIS&&VIS[i]){ if(e&&e.kind==="husk") return "danger"; if(S.items.some(q=>q.x===x&&q.y===y)) return "loot"; if(t.t==="window"||(t.t==="prop"&&t.kind==="barrel")) return "target"; }
  return "move";
}
function sendPing(x,y){
  if(!inSquad()||!S) return; const now=Date.now(); if(now-lastPing<600) return; const kind=pingKindAt(x,y); if(!kind) return; lastPing=now;
  emit({t:"ping",x,y,kind,sc:S.mode}); addPing(Net.myKey,x,y,kind,S.mode);
}
function addPing(k,x,y,kind,sc){ if(!S||sc!==S.mode||!PING_NAME[kind]) return; Net.pings=Net.pings.filter(p=>p.k!==k); Net.pings.push({k,x:x|0,y:y|0,kind,at:performance.now()}); addChat(k,`${PING_NAME[kind]}${S.mode==="raid"?" · "+Sim.roomName(x,y):""}`,false); }
function drawPings(g,cx,cy,now){
  Net.pings=Net.pings.filter(p=>now-p.at<6500);
  for(const p of Net.pings){ const t=now-p.at, c=colorOf(p.k), X=p.x*TS+12-cx, Y=p.y*TS+12-cy, a=t>5500?(6500-t)/1000:1;
    g.globalAlpha=a; g.strokeStyle=c; g.lineWidth=1;
    const r=4+((t/700)%1)*12; g.globalAlpha=a*(1-((t/700)%1)); g.beginPath(); g.arc(X,Y,r,0,6.283); g.stroke(); g.globalAlpha=a;
    const bob=Math.round(Math.sin(t/180)*1.5), Y2=Y-16+bob;
    R(g,X,Y2+8,1,6,c);
    if(p.kind==="danger"){ R(g,X-3,Y2-4,7,9,"#140806"); R(g,X-1,Y2-3,3,5,"#e0482f"); R(g,X-1,Y2+3,3,1,"#e0482f"); }
    else if(p.kind==="loot"){ for(let k=0;k<4;k++){ R(g,X-k,Y2-3+k,1+k*2,1,c); R(g,X-k,Y2+4-k,1+k*2,1,c); } }
    else if(p.kind==="target"){ R(g,X-4,Y2,9,1,c); R(g,X,Y2-4,1,9,c); R(g,X-2,Y2-2,5,5,"rgba(0,0,0,0)"); g.strokeRect(X-2.5,Y2-2.5,6,6); }
    else { for(let k=0;k<4;k++) R(g,X-3+k,Y2-2+k,7-k*2,1,c); R(g,X-3,Y2-4,7,1,c); }
    for(const [dx,dy] of [[-6,-6],[5,-6],[-6,5],[5,5]]) R(g,X+dx,Y+dy,2,1,c);
  }
  g.globalAlpha=1;
}
// edge markers for crew and pings that are off screen
function drawEdges(cx,cy){
  if(!inSquad()||!S) return; const sc=view.scale, fw=view.fw, fh=view.fh, pts=[];
  for(const q of crewPlayers()) if(q.alive&&q.id!==PID){ const r=rp[q.id]; if(r) pts.push({x:r.x+12-cx,y:r.y+4-cy,c:colorOf(q.id),down:q.downed}); }
  for(const p of Net.pings) pts.push({x:p.x*TS+12-cx,y:p.y*TS+12-cy,c:colorOf(p.k),ping:true});
  for(const p of pts){ const m=10; if(p.x>=m&&p.y>=m&&p.x<=fw-m&&p.y<=fh-m) continue;
    const ax=Math.max(m,Math.min(fw-m,p.x)), ay=Math.max(m,Math.min(fh-m,p.y)), ang=Math.atan2(p.y-fh/2,p.x-fw/2), X=ax*sc, Y=ay*sc, s=(p.ping?5:7)*sc/2;
    sctx.save(); sctx.translate(X,Y); sctx.rotate(ang); sctx.fillStyle=p.down&&((performance.now()/300|0)%2)?"#e0482f":p.c; sctx.globalAlpha=.9;
    sctx.beginPath(); sctx.moveTo(s*1.4,0); sctx.lineTo(-s,s); sctx.lineTo(-s*.4,0); sctx.lineTo(-s,-s); sctx.closePath(); sctx.fill(); sctx.restore(); }
}
// floating name tags
function updateTags(cx,cy){
  const layer=$("tags"); const want={};
  if(S&&inSquad()){ const dpr=view.dpr, sc=view.scale;
    for(const q of crewPlayers()){ if(q.id===PID||!q.alive) continue; const i=Sim.idx(S,q.x,q.y); if(S.mode==="raid"&&VIS&&!VIS[i]) continue; const r=rp[q.id]; if(!r) continue;
      want[q.id]=1; let el=tagEls[q.id]; if(!el){ el=document.createElement("div"); el.className="tag"; layer.appendChild(el); tagEls[q.id]=el; }
      const hp=Sim.LIMBS.reduce((a,l)=>a+q.hp[l],0)/Sim.LIMBS.reduce((a,l)=>a+q.max[l],0), stat=S.mode!=="raid"?"":q.downed?`<em class="down">DOWN ${q.downT}</em>`:q.acted?"<em>✓</em>":"";
      const html=`<b>${esc(nameOf(q.id))}</b><i><span style="width:${Math.round(Math.max(0,Math.min(1,hp*q.blood/100))*100)}%"></span></i>${stat}`;
      if(el._h!==html){ el.innerHTML=html; el._h=html; } el.style.setProperty("--c",colorOf(q.id));
      el.style.left=((r.x+12-cx)*sc/dpr)+"px"; el.style.top=((r.y-12-cy)*sc/dpr)+"px"; } }
  if(S&&S.mode==="raid"){ const dpr=view.dpr, sc=view.scale, now=Date.now();
    const place=(key,cls,html,c,ex,ey)=>{ want[key]=1; let el=tagEls[key]; if(!el){ el=document.createElement("div"); el.className=cls; layer.appendChild(el); tagEls[key]=el; } if(el._h!==html){ el.innerHTML=html; el._h=html; } el.style.setProperty("--c",c); el.style.left=(ex*sc/dpr)+"px"; el.style.top=(ey*sc/dpr)+"px"; };
    for(const q of S.ents){ if(!q.alive||q.kind!=="raider") continue; const i=Sim.idx(S,q.x,q.y); if(!VIS||!VIS[i]) continue; const r=rp[q.id]; if(!r) continue;
      const at=S.crews&&S.crews[q.crew]?S.crews[q.crew].att:"hostile", c={hostile:"#e0482f",wary:"#e8b048",friendly:"#7cc46a"}[at], hp=Sim.LIMBS.reduce((a,l)=>a+q.hp[l],0)/Sim.LIMBS.reduce((a,l)=>a+q.max[l],0);
      place(q.id,"tag rtag",`<b>${esc(q.name)} <small>${esc(Sim.FACTIONS[q.fac].short)}</small></b><i><span style="width:${Math.round(Math.max(0,Math.min(1,hp*q.blood/100))*100)}%"></span></i>${q.surr?"<em>HANDS UP</em>":""}`,c,r.x+12-cx,r.y-12-cy); }
    for(const id of Object.keys(BUBBLE)){ const B=BUBBLE[id]; if(now-B.at>4200){ delete BUBBLE[id]; continue; } const q=S.ents.find(e=>e.id===id); if(!q||!q.alive) continue; const i=Sim.idx(S,q.x,q.y); if(!VIS||!(VIS[i]||q.id===PID)) continue; const r=rp[q.id]; if(!r) continue;
      const at=q.kind==="raider"&&S.crews&&S.crews[q.crew]?S.crews[q.crew].att:null, c=at?{hostile:"#e0482f",wary:"#e8b048",friendly:"#7cc46a"}[at]:(q.kind==="player"?colorOf(q.id):"#ddd");
      place("b_"+id,"bubble",esc(B.msg),c,r.x+12-cx,r.y-(q.kind==="raider"||(inSquad()&&q.id!==PID)?30:14)-cy); } }
  for(const k of Object.keys(tagEls)) if(!want[k]){ tagEls[k].remove(); delete tagEls[k]; }
}

// ---------- crew cards & prompts ----------
function renderCrew(){
  document.body.dataset.squad=inSquad()?"1":"";
  const cards=$("crew-cards"), chips=$("tcrew"), prompt=$("r-prompt");
  const crew=S&&S.mode==="raid"?crewPlayers().filter(q=>q.id!==PID):[];
  cards.hidden=chips.hidden=!crew.length;
  if(crew.length){
    const st=q=>!q.alive?(q.extracted?["OUT","good"]:["KIA","bad"]):q.downed?[`DOWN ${q.downT}`,"bad"]:q.acted?["✓ ready","good"]:["acting…",""];
    cards.innerHTML=crew.map(q=>{ const [t,c]=st(q), hp=Sim.LIMBS.reduce((a,l)=>a+q.hp[l],0)/Sim.LIMBS.reduce((a,l)=>a+q.max[l],0);
      return `<div class="cc" style="--c:${colorOf(q.id)}"><span class="dot"></span><b>${esc(nameOf(q.id))}</b><span class="st ${c}">${t}</span>
        <div class="bars"><div class="meter" title="Blood"><i style="width:${Math.max(0,q.blood)}%;background:${q.blood>60?"var(--bile)":q.blood>35?"var(--brass)":"var(--blood2)"}"></i></div><div class="meter" title="Body"><i style="width:${Math.round(hp*100)}%;background:var(--c)"></i></div><span class="num" style="font-size:11px;color:var(--ash)">${(()=>{ const G=Sim.gun(q), at=G&&Items.stats(G).ammo; return at?(q.ammo[at]|0)+" "+Items.AMMO[at].short:"melee"; })()}</span></div></div>`; }).join("");
    chips.innerHTML=crew.map(q=>{ const [t]=st(q); return `<span style="--c:${colorOf(q.id)}">${esc(nameOf(q.id)).slice(0,10)} <i><u style="width:${Math.max(0,q.blood)}%"></u></i> ${t}</span>`; }).join("");
  }
  let msg="";
  if(S&&S.mode==="raid"&&inSquad()){ const p=me();
    if(p.alive&&p.downed) msg=`You're down · ${p.downT} turn${p.downT===1?"":"s"} to bleed out. Your crew can revive you.`;
    else if(p.alive){ const d=adjacentCrew(q=>q.downed), a=adjacentCrew();
      if(d) msg=mode==="pc"?`<span class="key">F</span>Revive ${esc(nameOf(d.id))}`:`Tap USE · revive ${esc(nameOf(d.id))}`;
      else if(a&&p.inv.length) msg=mode==="pc"?`Right-click an item to hand it to ${esc(nameOf(a.id))}`:`Kit → hand items to ${esc(nameOf(a.id))}`; } }
  prompt.innerHTML=msg;
  // touch: give buttons in the kit drawer
  if(mode==="touch"&&S&&S.mode==="raid"){ const a=adjacentCrew(), inv=$("dinv"); if(a&&me().inv.length&&inv&&!inv.querySelector(".give")){
    inv.insertAdjacentHTML("beforeend",`<div class="give h-eyebrow" style="margin-top:6px">Hand to ${esc(nameOf(a.id))}</div>`+me().inv.map((it,i)=>`<button class="give" data-give="${i}"><span><img alt="" src="${iconFor(it)}">Give ${esc(Items.name(it))}</span><span>→</span></button>`).join("")); } }
}
$("dinv").addEventListener("click",e=>{ const b=e.target.closest("[data-give]"); if(!b) return; e.stopPropagation(); const a=adjacentCrew(); if(a) send({type:"give",index:+b.dataset.give,to:a.id}); },true);
$("hotbar").addEventListener("contextmenu",e=>{ const b=e.target.closest("[data-use]"); if(!b) return; e.preventDefault(); const a=adjacentCrew(); if(a) send({type:"give",index:+b.dataset.use,to:a.id}); else toast("Stand next to a crewmate to hand items over."); });

// ---------- inputs: pings & chat keys ----------
let lp=null, lpFired=false;
$("vp").addEventListener("pointerup",ev=>{
  if(ev.target!==screen) return;
  if(lpFired){ lpFired=false; ev.stopPropagation(); return; }
  if(inSquad()&&(ev.button===1||ev.altKey)){ ev.stopPropagation(); ev.preventDefault(); const t=tileAt(ev); sendPing(t.x,t.y); }
},true);
screen.addEventListener("pointerdown",ev=>{ if(!inSquad()||ev.pointerType==="mouse") return; const sx=ev.clientX, sy=ev.clientY; clearTimeout(lp&&lp.t);
  lp={sx,sy,t:setTimeout(()=>{ const t=tileAt({clientX:sx,clientY:sy}); sendPing(t.x,t.y); lpFired=true; if(navigator.vibrate) try{ navigator.vibrate(20); }catch(e){} },450)}; });
screen.addEventListener("pointermove",ev=>{ if(lp&&Math.hypot(ev.clientX-lp.sx,ev.clientY-lp.sy)>12){ clearTimeout(lp.t); lp=null; } });
screen.addEventListener("pointercancel",()=>{ if(lp) clearTimeout(lp.t); lp=null; });
screen.addEventListener("pointerup",()=>{ if(lp) clearTimeout(lp.t); lp=null; });
screen.addEventListener("auxclick",ev=>{ if(ev.button===1) ev.preventDefault(); });
document.addEventListener("keydown",e=>{
  if(e.target.tagName==="INPUT"||!$("panel").hidden) return;
  if((e.key==="Enter"||e.key==="c"||e.key==="C")&&mode==="pc"&&chatOn()){ e.preventDefault(); openChat(true); return; }
  if(!inSquad()) return;
  if((e.key==="z"||e.key==="Z")&&mode==="pc"&&hover){ sendPing(hover.x,hover.y); }
});
