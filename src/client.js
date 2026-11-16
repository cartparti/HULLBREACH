// ============================ CLIENT ================================
// World is drawn at native 24px tiles onto a small frame canvas, lit by a
// per-tile lightmap (multiply) + additive glow, then scaled up crisp.
let PID="p1", spectating=false; const TS=24;
const CREW_COL=["#9bc06a","#76c2c4","#e8b048","#d07ad0"];
function viewEnt(){ const m=me(); if(!S||S.mode!=="raid"||!m||m.alive||!spectating) return m; return S.ents.find(e=>e.kind==="player"&&e.alive)||m; }
let S=null, VIS=null, mode="pc", overlay=false;
const $=id=>document.getElementById(id);
const screen=$("screen"), sctx=screen.getContext("2d");
const frame=document.createElement("canvas"), fctx=frame.getContext("2d");
const lm=document.createElement("canvas"), lctx=lm.getContext("2d");
const staticLayer=document.createElement("canvas");
let fireContrib=[], rings=[], arcs=[], throwMode=null;
let staticKey="", SOURCES=[], srcContrib=[], FLASH=null, AMB=null, view={dpr:1,scale:3,fw:0,fh:0};
let camX=0,camY=0,camInit=false, rp={}, flashT={}, atkT={}, dirH={}, parts=[], tracers=[], slashes=[], lightsT=[];
let shake=0, hurtFlash=0, powerFlicker=0, hover=null, mouse=null, target=null, travel=null, lastT=performance.now();
let vignette=null, grain=null, scan=null, conduit=null, conduitPat=null;
const me=()=>S.ents.find(e=>e.id===PID);

// ---------- helpers ----------
function hh(x,y,k=0){ let n=(x*73856093)^(y*19349663)^(k*83492791); n=Math.imul(n^(n>>>13),1274126177); n^=n>>>16; return n>>>0; }
const R=(g,x,y,w,h,c)=>{ g.fillStyle=c; g.fillRect(x,y,w,h); };
const cvs=(w,h)=>{ const c=document.createElement("canvas"); c.width=w; c.height=h; return c; };
const T=(x,y)=>Sim.tileAt(S,x,y);
const isW=(x,y)=>{ const t=T(x,y).t; return t==="wall"||t==="window"||t==="door"; };
function disc(g,cx,cy,r,c){ for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++) if(x*x+y*y<=r*r+r*.6) R(g,cx+x,cy+y,1,1,c); }
function outlined(w,h,draw,col="#060505"){
  const a=cvs(w,h), g=a.getContext("2d"); draw(g);
  const o=cvs(w,h), og=o.getContext("2d");
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) og.drawImage(a,dx,dy);
  og.globalCompositeOperation="source-in"; og.fillStyle=col; og.fillRect(0,0,w,h);
  og.globalCompositeOperation="source-over"; og.drawImage(a,0,0); return o;
}
function whiteOf(c){ const w=cvs(c.width,c.height), g=w.getContext("2d"); g.drawImage(c,0,0); g.globalCompositeOperation="source-in"; g.fillStyle="#fff"; g.fillRect(0,0,w.width,w.height); return w; }

// ---------- characters (24x32, facing right, feet at y=30) ----------
// ---------- gear art: one pixel design per weapon, reused in hands, on the floor and in the HUD ----------
const ARMOR_PAL={suit:{},scrap:{a:"#5a5448",aH:"#8a826e",pl:"#5a5448",plH:"#8a826e",br:"#b0a890"},flak:{pl:"#4a4438",plH:"#736a52",plS:"#2c2820",br:"#c9a24a",a:"#34322c",aH:"#56534a"},
  hazard:{a:"#7a5e1a",aH:"#a8842a",aS:"#4a380e",pl:"#9a7a22",plH:"#c9a240",plS:"#5a4612",br:"#2a2a24"},
  ossuary:{a:"#b8ad94",aH:"#e0d6c0",aS:"#7a705c",pl:"#cfc4aa",plH:"#f0e8d4",plS:"#8a8068",br:"#5a4a30"},
  shroud:{a:"#1a1a20",aH:"#34343e",aS:"#0a0a0e",pl:"#22222a",plH:"#3e3e4a",plS:"#101014",br:"#8a3ad0"},
  aegis:{a:"#8a6a1e",aH:"#c9a24a",aS:"#5a4410",pl:"#a8842a",plH:"#e8c868",plS:"#6a5014",br:"#b01818"}};
// draws a weapon inside a 16x7 box at (x,y), muzzle pointing right
function gunPix(g,id,x,y){
  const r=(a,b,w,h,c)=>R(g,x+a,y+b,w,h,c), D="#24251f", H="#4a4a40", K="#121210", WD="#4a3020", BR="#b08a3a";
  switch(id){
    case "pistol": r(4,1,8,2,D); r(4,1,8,1,H); r(12,2,2,1,K); r(5,3,2,3,"#2a2018"); r(7,3,1,1,D); r(8,0,2,1,BR); break;
    case "cannon": r(3,1,10,3,"#2e2f2a"); r(3,1,10,1,"#56574e"); r(13,2,3,1,K); r(4,4,3,3,WD); r(7,2,2,2,BR); break;
    case "widow": r(4,1,8,2,"#141414"); r(4,1,8,1,"#3a3a3a"); r(5,2,6,1,"#a01818"); r(12,2,2,1,K); r(5,3,2,3,"#1e1414"); r(9,0,1,1,"#ff3a30"); break;
    case "lastword": r(3,1,11,2,"#a07a2a"); r(3,1,11,1,"#e8c060"); r(14,2,2,1,"#6a5018"); r(4,3,2,3,"#3a2010"); for(let k=0;k<4;k++) r(5+k*2,2,1,1,"#5a3a10"); break;
    case "carbine": r(1,2,13,2,D); r(1,2,13,1,H); r(14,2,2,1,K); r(7,4,2,3,K); r(0,2,2,3,WD); r(5,1,2,1,K); break;
    case "rivet": r(0,2,15,2,"#33352f"); r(0,2,15,1,"#5a5d54"); r(15,2,1,1,K); r(5,0,4,2,K); r(6,0,1,1,"#5ab0c0"); r(0,3,3,2,"#3a2a1a"); r(8,4,2,2,D); break;
    case "lament": r(0,2,15,2,"#b8ad94"); r(0,2,15,1,"#e8dec8"); r(15,2,1,1,"#6a6050"); for(const k of [3,8,12]) r(k,2,1,2,"#c9a24a"); r(5,0,3,2,"#c9a24a"); r(12,4,2,2,"#6a5a40"); r(13,6,1,1,"#a8a8a0"); break;
    case "hymn": r(0,2,6,3,"#2a2a26"); r(0,2,6,1,"#4e4e46"); for(const yy of [1,3,5]) r(6,yy,10,1,yy===3?"#3a3a34":"#2a2a26"); r(2,2,1,3,BR); r(4,2,1,3,BR); r(3,5,2,2,K); break;
    case "scatter": r(2,1,11,3,"#2e2f2a"); r(2,1,11,1,"#55574e"); r(13,1,3,2,K); r(6,4,4,1,"#5a3a1e"); r(0,2,3,3,WD); break;
    case "pump": r(2,2,12,2,D); r(2,2,12,1,H); r(14,2,2,1,K); r(8,4,4,1,"#5a3a1e"); r(0,2,3,3,WD); break;
    case "gravedigger": r(0,1,3,5,"#6a5a40"); r(1,0,1,1,"#8a7a5a"); r(0,5,1,2,"#6a5a40"); r(3,2,10,2,"#2a2620"); r(3,2,10,1,"#4a443a"); r(13,2,3,2,K); r(7,4,3,1,"#5a1a12"); break;
    case "sweeper": r(2,1,12,3,"#30302a"); r(2,1,12,1,"#5a5a50"); r(14,0,2,5,K); r(6,4,4,3,"#4a4438"); r(7,5,2,1,BR); r(0,2,2,3,WD); break;
    case "longbore": r(0,3,16,1,"#2e302a"); r(2,2,8,2,"#33352f"); r(2,2,8,1,"#5a5d54"); r(4,0,5,2,K); r(5,0,1,1,"#5ab0c0"); r(12,4,1,2,D); r(0,3,2,3,WD); break;
    case "goodbye": r(0,3,16,1,"#d8cfb8"); r(2,2,8,2,"#e8e0cc"); r(2,2,8,1,"#fbf6ea"); r(4,0,5,2,"#a07a2a"); r(5,0,1,1,"#5ab0c0"); r(15,3,1,1,"#121210"); r(0,3,2,3,"#cfc4aa"); break;
    case "voideye": r(0,3,16,1,"#121214"); r(2,2,8,2,"#18181c"); r(2,2,8,1,"#34343e"); r(4,0,5,2,"#1e1428"); r(5,0,2,1,"#c070ff"); r(12,4,1,2,"#18181c"); r(0,3,2,3,"#22222a"); break;
    case "launcher": r(1,1,14,3,"#3a4430"); r(1,1,14,1,"#56603c"); r(14,0,2,5,K); r(6,4,2,2,D); r(4,0,2,1,K); break;
    case "hullbreaker": r(1,1,14,3,"#7a1a12"); r(1,1,14,1,"#a83020"); for(let k=0;k<4;k++) r(2+k*3,3,1,1,k%2?"#e0c040":"#141210"); r(14,0,2,5,K); r(6,4,2,2,D); break;
    case "judgement": r(1,1,14,3,"#a07a2a"); r(1,1,14,1,"#e8c060"); r(3,2,10,1,"#7a5a1a"); r(14,0,2,5,"#5a4010"); r(6,4,2,2,"#3a2810"); r(15,2,1,1,"#ff8a20"); break;
    case "knife": r(6,3,8,1,"#c8c8c0"); r(6,2,7,1,"#8a8a82"); r(2,3,4,2,"#2a2018"); r(6,2,1,3,"#4a4a40"); break;
    case "axe": r(1,3,12,1,"#5a3a1e"); r(11,0,4,6,"#8a2018"); r(14,0,1,6,"#d0d0c8"); r(11,0,4,1,"#b03020"); break;
    case "maul": r(1,3,10,1,"#2a2a2a"); r(10,1,5,5,"#3a4448"); r(10,1,5,1,"#5a666a"); r(11,3,3,1,"#5ad0d0"); break;
    case "butcher": r(1,3,5,1,"#2a2018"); r(6,1,8,4,"#9a9a92"); r(6,1,8,1,"#c8c8c0"); r(9,3,3,2,"#6a1010"); r(13,1,1,4,"#e0e0d8"); break;
    case "splitter": r(1,3,9,1,"#1a1a1a"); r(9,0,7,7,"#2a1a3a"); r(9,0,7,1,"#4a2e66"); r(10,2,5,1,"#b070ff"); r(12,1,1,5,"#b070ff"); break;
    case "hornet": r(4,1,8,2,"#2a2c28"); r(4,1,8,1,"#4e5048"); r(12,2,1,1,K); r(7,3,2,4,"#1a1a18"); r(5,3,2,2,"#2a2018"); r(3,1,1,1,"#4e5048"); r(9,0,2,1,"#5a5a50"); break;
    case "sixgun": r(3,1,9,2,"#6a6a64"); r(3,1,9,1,"#9a9a92"); r(12,1,2,1,"#4a4a44"); r(6,2,3,2,"#4a4a44"); r(6,2,3,1,"#8a8a82"); r(3,3,2,3,"#6a3a1e"); r(3,3,1,3,"#8a5030"); break;
    case "wasp": r(2,1,11,3,"#33352f"); r(2,1,11,1,"#5a5d54"); r(13,2,2,1,K); r(8,4,2,3,K); r(5,4,2,2,"#2a2018"); r(0,2,2,1,"#4a4a40"); r(0,3,1,2,"#4a4a40"); r(6,0,3,1,K); break;
    case "bullpup": r(1,1,13,3,"#3a3e36"); r(1,1,13,1,"#62685a"); r(14,2,2,1,K); r(9,4,2,2,"#2a2018"); r(3,4,3,3,K); r(7,0,4,1,K); r(8,0,1,1,"#e04030"); break;
    case "warden": r(0,2,15,2,"#4a3a24"); r(0,2,15,1,"#6a5434"); r(5,1,9,2,"#2e302a"); r(5,1,9,1,"#55584e"); r(14,2,2,1,K); r(8,4,2,3,K); r(6,0,3,1,K); break;
    case "hound": r(2,1,11,3,"#2a2c28"); r(2,1,11,1,"#50524a"); r(13,1,3,2,K); r(6,4,4,3,"#3a3a34"); r(7,4,2,2,"#5a5a50"); r(0,2,3,3,"#1e1e1a"); r(11,0,2,1,K); break;
    case "coachgun": r(0,2,4,3,WD); r(0,2,4,1,"#6a4a2c"); r(4,1,12,1,"#3a3a34"); r(4,2,12,1,"#2a2a26"); r(4,1,12,1,"#5a5a50"); r(4,3,4,1,BR); r(5,4,2,2,WD); break;
    case "pipe": r(1,2,13,2,"#5a5048"); r(1,2,13,1,"#8a7a68"); r(14,1,2,4,"#3a3430"); r(3,1,2,1,"#a83a20"); r(0,3,3,3,"#5a3a1e"); r(7,4,1,2,"#3a3430"); r(10,2,1,2,"#2a2420"); break;
    case "kestrel": r(0,3,16,1,"#2e302a"); r(0,3,6,2,"#5a3a1e"); r(0,3,6,1,"#7a5030"); r(4,0,6,2,K); r(5,0,1,1,"#5ab0c0"); r(9,2,2,1,"#8a8a80"); r(10,1,1,1,"#8a8a80"); r(13,4,1,2,D); break;
    case "rook": r(0,3,16,1,"#33352f"); r(2,2,9,2,"#3a3e36"); r(2,2,9,1,"#62685a"); r(4,0,5,2,K); r(5,0,1,1,"#e8b048"); r(7,4,2,3,K); r(0,2,2,4,"#3a3e36"); break;
    case "thumper": r(1,1,10,4,"#3a4430"); r(1,1,10,1,"#56603c"); r(11,1,5,4,"#22261c"); r(12,2,3,2,K); r(4,5,2,2,WD); r(0,2,2,3,WD); break;
    case "machete": r(2,3,4,1,"#2a2018"); r(6,2,9,2,"#a8a8a0"); r(6,2,9,1,"#d0d0c8"); r(14,3,2,1,"#d0d0c8"); r(6,2,1,3,"#4a4a40"); break;
    case "crowbar": r(1,3,13,1,"#8a2018"); r(1,3,13,1,"#a83020"); r(13,1,1,3,"#8a2018"); r(14,1,1,1,"#a83020"); r(1,4,2,1,"#6a1810"); break;
    case "ripsaw": r(1,3,4,2,"#2a2a26"); r(1,3,4,1,"#e0a020"); r(5,2,11,3,"#5a5a54"); r(5,2,11,1,"#8a8a82"); for(let k=0;k<6;k++){ r(5+k*2,1,1,1,"#c8c8c0"); r(6+k*2,5,1,1,"#c8c8c0"); } break;
    default: r(4,2,8,2,D);
  }
}
// ---------- contractor: clothes + face + hair, then legs, chest, helmet and accessory on top ----------
const STY_NM=(arr,v,d)=>typeof v==="number"?(arr[v]||d):(v||d);
function drawLegPiece(g,id,lx,bx,back){
  const r=(x,y,w,h,c)=>R(g,x,y,w,h,back?shade(c,.78):c);
  switch(id){
    case "cargo": r(lx,21,3,5,"#6a6448"); r(lx,21,1,5,"#857e5c"); if(!back){ r(lx,23,3,2,"#55503a"); r(lx,23,3,1,"#7a7354"); } break;
    case "kneepads": r(lx,21,3,5,"#30363a"); r(lx,23,3,2,"#55554c"); r(lx,23,3,1,"#7a7a6e"); r(bx,25,5,5,"#1a1a18"); r(bx,25,5,1,"#3a3a34"); break;
    case "hazlegs": r(lx,21,3,5,"#9a7a22"); r(lx,21,1,5,"#c9a240"); for(let k=0;k<3;k++) r(lx+k,24,1,1,k%2?"#e0c040":"#141210"); r(bx,26,5,4,"#2a2a24"); break;
    case "greaves": r(lx,21,3,5,"#2e2a26"); r(lx,22,3,4,"#7a7e76"); r(lx,22,1,4,"#a8aca2"); r(lx,22,3,1,"#b8bcb2"); r(bx,27,5,3,"#6a6e66"); r(bx,27,5,1,"#9a9e96"); r(bx+5,28,1,2,"#6a6e66"); break;
    case "bonegreaves": r(lx,21,3,5,"#3a3028"); r(lx+1,21,1,5,"#d8cdb4"); r(lx,22,3,1,"#cfc4aa"); r(lx,24,3,1,"#cfc4aa"); r(bx,26,5,4,"#cfc4aa"); r(bx,29,5,1,"#8a8068"); r(bx+1,27,1,1,"#3a3028"); break;
    case "strider": r(lx,21,3,5,"#26282a"); r(lx+2,21,1,6,"#8a8a80"); r(lx,23,2,2,"#e8b048"); r(lx,23,1,1,"#fff0a0"); r(bx,27,5,3,"#3a3a34"); r(bx,27,5,1,"#5a5a50"); r(bx+1,26,1,1,"#8a8a80"); break;
    case "aegislegs": r(lx-1,21,4,2,"#8a1a12"); r(lx-1,21,4,1,"#b02a1c"); r(lx,23,3,3,"#a8842a"); r(lx,23,1,3,"#e8c868"); r(bx,26,5,4,"#a8842a"); r(bx,26,5,1,"#e8c868"); r(bx,29,5,1,"#6a5014"); break;
  }
}
// chest pieces: returns the sleeve colour for the arm
function drawChest(g,id,b,L){
  const r=(x,y,w,h,c)=>R(g,x,y+b,w,h,c), rr=(x,y,w,h,c)=>R(g,x,y,w,h,c);
  switch(id){
    case "suit": r(8,12,8,8,"#525849"); r(8,12,8,1,"#7a816d"); r(8,12,1,8,"#7a816d"); r(15,13,1,7,"#2f322b"); r(10,15,4,1,"#2f322b"); r(10,11,4,1,"#6a6e66"); r(15,13,1,5,"#2a2a26"); rr(8,20,8,1,"#2e2418"); rr(11,20,2,1,"#a37a32"); return "#3b3f38";
    case "scrapvest": r(8,13,8,7,"#5a5448"); r(8,13,8,1,"#8a826e"); r(8,13,1,7,"#7a7262"); r(15,14,1,6,"#3a362e"); for(const [vx,vy] of [[9,14],[14,14],[9,18],[14,18]]) r(vx,vy,1,1,"#b0a890"); r(10,16,4,1,"#3a362e"); return null;
    case "brigandine": r(8,12,8,8,"#5a3a20"); rr(8,20,8,3,"#5a3a20"); rr(8,22,8,1,"#3a2414"); r(8,12,1,8,"#7a5030"); for(let y=13;y<22;y+=2) for(let x=9;x<15;x+=2) R(g,x,y+(y<20?b:0),1,1,"#c9a24a"); rr(8,19,8,1,"#2a1a10"); return "#4a3020";
    case "flak": r(8,12,8,8,"#4a4438"); r(8,12,8,1,"#736a52"); r(8,12,1,8,"#736a52"); r(15,13,1,7,"#2c2820"); r(9,15,6,1,"#2c2820"); r(9,17,6,1,"#2c2820"); r(8,19,8,1,"#c9a24a"); rr(8,20,8,1,"#2e2418"); return "#34322c";
    case "hazard": r(8,12,8,8,"#7a5e1a"); r(8,12,8,1,"#a8842a"); r(8,12,1,8,"#a8842a"); r(15,13,1,7,"#4a380e"); for(let k=0;k<8;k++) r(8+k,18,1,1,k%2?"#141210":"#e0c040"); r(10,11,4,1,"#141210"); rr(8,20,8,1,"#2a2a24"); return "#7a5e1a";
    case "exo": r(9,12,6,8,"#26282a"); r(8,12,8,1,"#8a8a80"); r(9,12,1,9,"#8a8a80"); r(12,15,2,2,"#5ad0d0"); r(12,15,1,1,"#c8ffff"); rr(8,19,8,1,"#6a6a60"); rr(8,20,8,1,"#3a3a34"); return "#26282a";
    case "ossuary": r(8,12,8,8,"#3a3028"); for(let y=13;y<20;y+=2) r(9,y,6,1,"#d8cdb4"); r(11,13,2,7,"#cfc4aa"); r(11,12,2,1,"#f0e8d4"); rr(8,20,8,1,"#2a2018"); rr(11,20,2,1,"#d8cdb4"); return "#3a3028";
    case "shroud": r(8,12,8,8,"#1a1a20"); rr(8,20,8,5,"#1a1a20"); rr(7,23,10,2,"#1a1a20"); r(8,12,1,8,"#34343e"); rr(10,20,1,5,"#34343e"); rr(13,21,1,4,"#101014"); rr(7,24,10,1,"#8a3ad0"); r(12,12,1,8,"#8a3ad0"); return "#1a1a20";
    case "aegis": r(8,12,8,7,"#a8842a"); r(8,12,8,1,"#e8c868"); r(8,12,1,7,"#e8c868"); r(15,13,1,6,"#6a5014"); r(10,14,4,1,"#6a5014"); r(11,13,2,4,"#c9a24a"); rr(11,19,3,6,"#8a1a12"); rr(11,19,1,6,"#b02a1c"); rr(11,24,3,1,"#e8c868"); rr(8,19,8,1,"#6a5014"); return "#a8842a";
  }
  return null;
}
function drawCrest(g,b,L,col){ const vis=(Items.DYES.visor[L.v]||Items.DYES.visor.amber)[0];
  switch(L.k||"plume"){
    case "plume": R(g,12,1+b,1,3,col); R(g,11,2+b,3,1,col); break;
    case "antenna": R(g,14,0+b,1,4,"#8a8a80"); R(g,14,0+b,1,1,vis); break;
    case "fin": R(g,10,1+b,5,2,"#7a7e76"); R(g,10,1+b,5,1,"#9aa09a"); break;
    case "horns": R(g,8,2+b,1,3,"#d8cdb4"); R(g,7,1+b,1,2,"#d8cdb4"); R(g,16,2+b,1,3,"#d8cdb4"); R(g,17,1+b,1,2,"#d8cdb4"); break;
    case "halo": R(g,9,0+b,7,1,"#f0d060"); R(g,8,1+b,1,1,"#f0d060"); R(g,16,1+b,1,1,"#f0d060"); break;
  } }
function drawHelmet(g,id,b,L){
  const r=(x,y,w,h,c)=>R(g,x,y+b,w,h,c), vis=(Items.DYES.visor[L.v]||Items.DYES.visor.amber)[0], cl=(Items.DYES.cloak[L.c]||Items.DYES.cloak.red)[1];
  switch(id){
    case "visor": r(9,4,7,8,"#3b3f38"); r(9,4,7,1,"#5f6458"); r(9,4,1,7,"#5f6458"); r(10,3,5,1,"#5f6458"); r(15,5,1,6,"#25271f"); r(13,7,3,2,vis); r(13,7,1,1,"#ffffff"); r(9,10,2,2,"#25271f"); drawCrest(g,b,L,cl); break;
    case "welder": r(9,5,2,1,"#2a2a24"); r(12,4,5,8,"#3a3a34"); r(12,4,5,1,"#5a5a50"); r(12,4,1,8,"#5a5a50"); r(14,7,2,1,"#3aa04a"); r(14,7,1,1,"#9aff9a"); r(16,10,1,2,"#2a2a24"); break;
    case "flakhelm": r(9,3,7,3,"#4a5040"); r(10,2,5,1,"#6a705e"); r(9,3,7,1,"#6a705e"); r(8,6,9,1,"#3a4032"); r(9,4,7,1,"#2a2a24"); r(14,4,2,1,"#c9a24a"); r(15,4,1,1,"#ffe8a0"); r(11,7,1,4,"#2a2a24"); break;
    case "gasmask": r(9,4,7,9,"#3a4030"); r(9,4,7,1,"#56603c"); r(9,4,1,8,"#56603c"); r(10,3,5,1,"#56603c"); r(12,6,4,6,"#55574e"); r(12,6,4,1,"#6a6c62"); r(13,7,1,1,vis); r(15,7,1,1,vis); r(15,10,2,2,"#2a2a24"); r(16,10,1,1,"#6a6a60"); break;
    case "sallet": r(9,4,7,6,"#7e827a"); r(9,4,7,1,"#a8aca2"); r(10,3,5,1,"#a8aca2"); r(9,4,1,6,"#a8aca2"); r(8,9,3,3,"#6a6e66"); r(10,10,6,2,"#6a6e66"); r(12,7,4,1,"#121210"); r(15,5,1,1,"#c8ccc2"); r(11,9,1,1,"#c8ccc2"); drawCrest(g,b,L,cl); break;
    case "deathmask": r(9,3,7,10,"#2a2420"); r(10,2,5,1,"#3a322c"); r(12,5,4,6,"#d8cdb4"); r(12,5,4,1,"#f0e8d4"); r(13,7,1,1,"#0a0806"); r(15,7,1,1,"#0a0806"); r(15,7,1,1,"#ff3a26"); r(14,9,1,1,"#5a5040"); for(let k=0;k<3;k++) r(13+k,10,1,1,k%2?"#5a5040":"#f0e8d4"); break;
    case "cowl": r(9,3,7,10,"#141418"); r(10,2,5,1,"#141418"); r(11,1,3,1,"#141418"); r(9,3,1,9,"#26262e"); r(10,2,4,1,"#26262e"); r(13,6,3,5,"#050506"); r(13,7,1,1,"#c070ff"); r(15,7,1,1,"#c070ff"); r(9,12,7,1,"#26262e"); break;
    case "halohelm": r(9,4,7,8,"#a8842a"); r(9,4,7,1,"#e8c868"); r(9,4,1,7,"#e8c868"); r(10,3,5,1,"#e8c868"); r(15,5,1,6,"#6a5014"); r(12,7,4,1,"#121210"); r(13,8,1,2,"#121210"); r(11,0,3,3,"#8a1a12"); r(11,0,3,1,"#b02a1c"); r(8,-1,9,1,"#f0d060"); r(7,0,1,1,"#f0d060"); r(17,0,1,1,"#f0d060"); break;
  }
}
function drawAccBack(g,id,b,L,bl){
  const cl=(Items.DYES.cloak[L.c]||Items.DYES.cloak.red);
  switch(id){
    case "cape": R(g,5,12+b,4,13-b,cl[0]); R(g,5,12+b,1,12-b,cl[1]); R(g,5,25,1,2,cl[0]); R(g,7,25,2,1,cl[0]); R(g,6,26,1,1,cl[0]); R(g,4,24,1,2,cl[0]); break;
    case "lamp": R(g,8,9+b,3,3,"#3a3a34"); R(g,8,9+b,3,1,"#5a5a50"); R(g,10,10+b,1,1,"#ffe080"); break;
    case "drone": { const y=1+(b?1:0); R(g,1,y,7,1,"#8a8a80"); R(g,2,y+1,5,4,"#d8cdb4"); R(g,2,y+1,5,1,"#f0e8d4"); R(g,5,y+2,1,1,"#ff3a26"); R(g,3,y+2,1,1,"#0a0806"); R(g,3,y+4,3,1,"#8a8068"); R(g,4,y+5,1,2,"#5a5a50"); break; }
    case "scarf": R(g,7,12+b,3,1,cl[0]); R(g,6,13+b,2,2,cl[0]); R(g,5,15+b,2,1,cl[1]); break;
  }
}
function drawAccFront(g,id,b,L){
  const r=(x,y,w,h,c)=>R(g,x,y+b,w,h,c), cl=(Items.DYES.cloak[L.c]||Items.DYES.cloak.red);
  switch(id){
    case "scarf": r(10,11,5,2,cl[0]); r(10,11,5,1,cl[1]); break;
    case "bandolier": for(let k=0;k<7;k++){ r(14-k,12+k,2,1,"#4a3020"); if(k%2===0) r(14-k,12+k,1,1,"#c9a24a"); } break;
    case "seals": r(10,14,2,2,"#a01818"); r(10,14,1,1,"#d03a2a"); r(10,16,1,3,"#e8dcc0"); r(13,13,2,2,"#a01818"); r(14,15,1,2,"#e8dcc0"); break;
    case "charm": R(g,12,19,1,1,"#8a7a4a"); R(g,13,20,2,2,"#c9a24a"); R(g,13,20,1,1,"#2a2010"); R(g,14,21,1,1,"#e8c868"); break;
    case "censer": R(g,9,20,1,3,"#6a5a3a"); R(g,8,23,3,3,"#a07a2a"); R(g,8,23,3,1,"#e8c060"); R(g,9,24,1,1,"#ff8a20"); R(g,7,21-b,1,1,"#8a8a80"); R(g,8,19-b,1,1,"#6a6a64"); break;
  }
}
function drawPauldron(g,b){ R(g,11,10+b,5,4,"#4a4a44"); R(g,11,10+b,5,1,"#7a7a6e"); R(g,12,8+b,1,2,"#c8c8c0"); R(g,14,8+b,1,2,"#c8c8c0"); R(g,11,13+b,5,1,"#2a2a26"); }
function drawHuman(g,{step=0,b=0},L){
  const ST=Items.STYLE, pick=(arr,i,d)=>arr[i]!=null?arr[i]:arr[d];
  const sk=pick(ST.skin,L.s,1), skS=shade(sk,.78), hc=pick(ST.hairCol,L.hc,1), eye=pick(ST.eyes,L.e,0);
  const tc=pick(ST.cloth,L.tc,0), tcH=shade(tc,1.3), tcS=shade(tc,.7), bc=pick(ST.cloth,L.bc,4), bcH=shade(bc,1.25), bcS=shade(bc,.7), bt=pick(ST.cloth,L.bt,4), btD=shade(bt,.55), btH=shade(bt,.9);
  const top=STY_NM(ST.top,L.t,"tee"), shorts=STY_NM(ST.bottom,L.b,"pants")==="shorts", hair=STY_NM(ST.hair,L.h,"short"), face=STY_NM(ST.face,L.f,"clean");
  const bl=step===1?-2:step===2?2:0, fl=-bl, HD=L.hd, CH=L.a, LG=L.lg, AC=L.ac;
  if(AC) drawAccBack(g,AC,b,L,bl);
  if(CH==="hazard"){ R(g,6,13+b,3,7,"#5a5a50"); R(g,6,13+b,3,1,"#8a8a80"); R(g,7,12+b,1,1,"#2a2a24"); }
  // back leg
  R(g,9+bl,21,3,6,bcS); if(shorts) R(g,9+bl,24,3,3,skS); R(g,8+bl,26,5,4,btD); R(g,8+bl,29,5,1,"#0e0d0b");
  if(LG) drawLegPiece(g,LG,9+bl,8+bl,true);
  // front leg
  R(g,12+fl,21,3,6,bc); R(g,12+fl,21,1,6,bcH); if(shorts){ R(g,12+fl,24,3,3,sk); R(g,12+fl,24,1,3,shade(sk,1.08)); } R(g,11+fl,26,5,4,btD); R(g,11+fl,26,5,1,btH); R(g,11+fl,29,5,1,"#0e0d0b");
  if(LG) drawLegPiece(g,LG,12+fl,11+fl,false);
  // torso (clothes, then chest piece)
  R(g,9,12+b,6,9-b,tc); R(g,9,12+b,6,1,tcH); R(g,9,12+b,1,8,tcH); R(g,14,13+b,1,8,tcS);
  if(top==="tank"){ R(g,9,12+b,1,3,sk); R(g,14,12+b,1,2,sk); }
  R(g,9,20,6,1,"#2e2418"); R(g,11,20,1,1,"#a37a32");
  const sleeve=CH?drawChest(g,CH,b,L):null;
  // neck + head + face (+ hair unless a helmet covers it)
  R(g,11,11+b,3,2,skS);
  R(g,10,5+b,5,7,sk); R(g,10,5+b,5,1,shade(sk,1.08)); R(g,15,6+b,1,4,sk); R(g,10,10+b,1,2,skS);
  R(g,11,8+b,1,2,skS);
  R(g,14,7+b,1,1,eye); R(g,13,7+b,1,1,"#e8e0d0"); R(g,14,6+b,2,1,shade(hc,.9));
  R(g,15,8+b,1,1,skS); R(g,14,10+b,2,1,shade(sk,.62));
  switch(face){
    case "stubble": for(const [fx,fy] of [[12,10],[13,11],[15,11],[14,11],[12,11]]) R(g,fx,fy+b,1,1,shade(hc,1.1)); break;
    case "beard": R(g,11,9+b,5,3,hc); R(g,12,12+b,3,1,hc); R(g,14,10+b,2,1,shade(sk,.62)); break;
    case "moustache": R(g,13,9+b,3,1,hc); break;
    case "scar": R(g,13,5+b,1,5,"#c06a5a"); R(g,12,8+b,1,1,"#c06a5a"); break;
    case "tattoo": R(g,12,6+b,1,4,"#2a3a5a"); R(g,11,9+b,1,1,"#2a3a5a"); break;
  }
  if(!HD||HD==="welder"||HD==="flakhelm") switch(hair){
    case "buzz": R(g,10,4+b,5,1,shade(hc,.85)); R(g,10,5+b,1,2,shade(hc,.85)); break;
    case "short": R(g,10,3+b,6,2,hc); R(g,9,4+b,2,4,hc); R(g,10,3+b,6,1,shade(hc,1.25)); break;
    case "long": R(g,10,3+b,6,2,hc); R(g,9,4+b,2,9,hc); R(g,8,7+b,1,6,shade(hc,.8)); R(g,10,3+b,6,1,shade(hc,1.25)); break;
    case "mohawk": R(g,11,1+b,3,4,hc); R(g,11,1+b,3,1,shade(hc,1.25)); R(g,10,5+b,1,2,shade(sk,.85)); break;
    case "topknot": R(g,10,4+b,6,1,hc); R(g,9,5+b,1,3,hc); R(g,11,1+b,3,3,hc); R(g,11,1+b,3,1,shade(hc,1.25)); break;
    case "braid": R(g,10,3+b,6,2,hc); R(g,9,4+b,2,4,hc); R(g,8,8+b,2,2,hc); R(g,7,10+b,2,2,shade(hc,.85)); R(g,7,12+b,1,3,hc); break;
  }
  if(HD) drawHelmet(g,HD,b,L);
  if(AC) drawAccFront(g,AC,b,L);
  // arm: sleeve from the chest piece, else from the shirt
  const up=sleeve||(top==="tank"?sk:tc), low=sleeve||(top==="long"?tc:sk), lowH=sleeve?shade(sleeve,1.3):top==="long"?tcH:shade(sk,1.08);
  if(L.w){ gunPix(g,L.w,7,13+b); R(g,12,15+b,3,2,up); R(g,12,17+b,3,2,low); R(g,12,17+b,3,1,lowH); }
  else { R(g,12,14+b,3,3,up); R(g,12,17+b,3,4,low); R(g,12,17+b,1,4,lowH); R(g,12,21+b,3,1,sleeve?shade(sleeve,.7):skS); }
  if(CH==="flak"){ R(g,10,10+b,5,4,"#4a4438"); R(g,10,10+b,5,1,"#736a52"); R(g,10,13+b,5,1,"#c9a24a"); }
  if(CH==="exo"){ R(g,12,18+b,3,1,"#8a8a80"); }
  if(CH==="aegis"){ R(g,10,10+b,5,3,"#a8842a"); R(g,10,10+b,5,1,"#e8c868"); }
  if(AC==="pauldron") drawPauldron(g,b);
}
function drawPlayer(g,o,L={}){ drawHuman(g,o,L); }
function lookOf(e){ const g=e&&(Sim.gun(e)||e.melee), d=k=>e&&e[k]?e[k].d:null; return {...((e&&e.look)||{}),hd:d("head"),a:d("armor"),lg:d("legs"),ac:d("acc"),w:g?g.d:null}; }

function drawHusk(g,{step=0,b=0,lunge=0}){
  const P={f:"#a69679",fH:"#c7b899",fS:"#76654f",fD:"#4a3d30",raw:"#6e2620",rawH:"#9a3a2c",bone:"#d6cbb0",cl:"#2b3533",clH:"#3e4a47",bl:"#5a0e0a",eye:"#ff3a26"};
  const bl=step===1?-2:step===2?2:0, fl=-bl;
  R(g,9+bl,21,2,7,P.fS); R(g,8+bl,27,4,2,P.fD);
  if(lunge){ R(g,13,10,2,4,P.fS); R(g,14,8,7,2,P.fS); R(g,21,7,2,1,P.bone); R(g,21,9,2,1,P.bone); }
  else { R(g,13,13+b,2,6,P.fS); R(g,14,18+b,5,2,P.fS); R(g,19,18+b,2,1,P.bone); R(g,19,20+b,1,1,P.bone); }
  R(g,8,13+b,7,8,P.f); R(g,10,11+b,7,3,P.f); R(g,8,13+b,1,8,P.fS); R(g,10,11+b,6,1,P.fH); R(g,9,12+b,1,1,P.fH);
  for(let k=0;k<3;k++){ R(g,10,14+b+k*2,4,1,P.bone); R(g,10,15+b+k*2,4,1,P.raw); }
  R(g,8,15+b,2,2,P.rawH); R(g,14,13+b,1,6,P.fS);
  R(g,8,19,7,3,P.cl); R(g,8,19,7,1,P.clH); R(g,9,22,2,1,P.cl); R(g,12,22,1,2,P.cl); R(g,14,22,1,1,P.cl);
  R(g,12+fl,21,2,7,P.f); R(g,12+fl,21,1,7,P.fH); R(g,12+fl,27,4,2,P.fS);
  const hx=lunge?16:15, hy=lunge?7:9+b;
  R(g,hx,hy,6,6,P.f); R(g,hx,hy,6,1,P.fH); R(g,hx+1,hy-1,4,1,P.fH); R(g,hx,hy+1,1,4,P.fS);
  R(g,hx+3,hy+2,2,2,P.fD); R(g,hx+4,hy+2,1,1,P.eye); R(g,hx+3,hy+4,3,2,P.raw); R(g,hx+3,hy+4,1,1,P.bone); R(g,hx+5,hy+4,1,1,P.bone); R(g,hx+4,hy+6,1,2,P.bl);
  if(lunge){ R(g,14,11,2,3,P.f); R(g,15,9,7,2,P.f); R(g,22,8,2,1,P.bone); R(g,22,10,2,1,P.bone); }
  else { R(g,14,13+b,2,5,P.f); R(g,15,17+b,5,2,P.f); R(g,15,17+b,5,1,P.fH); R(g,20,17+b,3,1,P.bone); R(g,20,19+b,2,1,P.bone); }
}
function buildChar(fn){ const fr={}; for(const [k,o] of Object.entries({idle0:{b:0},idle1:{b:1},walk1:{step:1},walk2:{step:2},lunge:{lunge:1}})){ fr[k]=outlined(24,32,g=>fn(g,o)); fr[k+"W"]=whiteOf(fr[k]); } return fr; }
const CH={husk:buildChar(drawHusk)}, CHP={};
function playerFrames(L){ L=L||{}; const k=["hd","a","lg","ac","w","c","v","k","s","h","hc","f","e","t","tc","b","bc","bt"].map(f=>L[f]==null?"":L[f]).join("|"); return CHP[k]||(CHP[k]=buildChar((g,o)=>drawPlayer(g,o,L))); }
const CORPSE={
  husk:outlined(24,16,g=>{ R(g,4,6,13,4,"#a69679"); R(g,4,6,13,1,"#c7b899"); for(let k=0;k<3;k++) R(g,7+k*3,7,1,3,"#d6cbb0"); R(g,7,9,8,1,"#6e2620"); R(g,17,4,5,5,"#a69679"); R(g,19,6,2,2,"#4a3d30"); R(g,2,10,5,2,"#76654f"); R(g,10,2,2,4,"#76654f"); R(g,11,1,3,1,"#d6cbb0"); R(g,6,10,6,2,"#2b3533"); }),
  player:outlined(24,16,g=>{ R(g,3,7,4,4,"#5e1a12"); R(g,6,5,11,6,"#525849"); R(g,6,5,11,1,"#7a816d"); R(g,17,5,5,5,"#3b3f38"); R(g,19,7,2,1,"#6a5020"); R(g,8,11,9,2,"#1b1a17"); R(g,9,3,10,2,"#20201b"); }),
};

// ---------- props (anchored to tile bottom) ----------
const PROP={
  crate:outlined(24,24,g=>{ R(g,2,6,20,16,"#46412f"); R(g,2,6,20,6,"#5f583f"); R(g,2,6,20,1,"#79704f"); R(g,2,12,20,1,"#2b2719"); R(g,6,6,2,16,"#2c281b"); R(g,16,6,2,16,"#2c281b"); for(let k=0;k<6;k++) R(g,9+k,17,1,3,(k%2)?"#9a7a22":"#15120b"); R(g,3,20,18,2,"#2f2b1f"); }),
  bed:outlined(24,24,g=>{ R(g,1,9,22,13,"#383c3e"); R(g,2,8,20,9,"#6d6b60"); R(g,2,8,20,1,"#8a887b"); R(g,3,9,6,6,"#8f8c80"); R(g,3,9,6,1,"#aaa799"); R(g,12,11,6,4,"#4f120d"); R(g,14,15,3,2,"#4f120d"); R(g,1,17,22,5,"#2a2d2f"); R(g,1,17,22,1,"#4a4f52"); R(g,2,21,2,2,"#1a1c1d"); R(g,20,21,2,2,"#1a1c1d"); }),
  desk:outlined(24,24,g=>{ R(g,1,8,22,8,"#4b3b29"); R(g,1,8,22,1,"#66513a"); R(g,3,9,5,4,"#bdb39c"); R(g,4,10,3,1,"#7a7262"); R(g,9,10,4,3,"#c9bfa6"); R(g,15,5,7,6,"#22261f"); R(g,16,6,5,4,"#123a1e"); R(g,16,7,3,1,"#4ec06a"); R(g,1,16,22,6,"#33281c"); R(g,3,18,7,1,"#1a130c"); R(g,13,18,7,1,"#1a130c"); R(g,6,17,1,1,"#a37a32"); R(g,16,17,1,1,"#a37a32"); }),
  locker:outlined(24,34,g=>{ R(g,4,2,16,30,"#3d4949"); R(g,4,2,16,2,"#566464"); R(g,4,2,1,30,"#566464"); R(g,11,4,2,28,"#253030"); for(let k=0;k<4;k++){ R(g,6,6+k*2,4,1,"#1c2424"); R(g,14,6+k*2,4,1,"#1c2424"); } R(g,9,18,1,3,"#a37a32"); R(g,14,18,1,3,"#a37a32"); R(g,15,22,1,5,"#7a7a70"); R(g,16,23,1,5,"#7a7a70"); R(g,17,24,1,4,"#7a7a70"); R(g,6,26,3,2,"#4f120d"); }),
  barrel:outlined(24,24,g=>{ R(g,6,6,12,16,"#5c3b1e"); R(g,6,6,12,3,"#77502b"); R(g,8,5,8,1,"#8a6034"); R(g,6,10,12,1,"#3a2412"); R(g,6,16,12,1,"#3a2412"); R(g,6,6,2,16,"#77502b"); R(g,16,6,2,16,"#3e2814"); R(g,10,12,3,3,"#9a7a22"); R(g,11,13,1,1,"#15120b"); R(g,13,18,2,4,"#5a8a2c"); R(g,14,22,3,1,"#5a8a2c"); }),
  brazier:outlined(24,24,g=>{ R(g,7,17,2,6,"#2a2622"); R(g,15,17,2,6,"#2a2622"); R(g,11,18,2,5,"#2a2622"); R(g,4,12,16,6,"#4a3f30"); R(g,4,12,16,1,"#6a5a40"); R(g,5,17,14,1,"#2a2218"); R(g,6,11,12,2,"#2a1a10"); R(g,8,11,2,1,"#7a2a10"); R(g,13,11,2,1,"#7a2a10"); }),
  generator:outlined(24,26,g=>{ R(g,1,6,22,18,"#4a4438"); R(g,1,6,22,5,"#5e5646"); R(g,1,6,22,1,"#7a705a"); for(let k=0;k<5;k++) R(g,4,13+k*2,10,1,"#1a1814"); R(g,16,13,5,7,"#2a2620"); R(g,17,14,3,2,"#0e0d0b"); R(g,1,22,22,2,"#2a261e"); R(g,3,7,4,3,"#9a7a22"); R(g,0,16,1,6,"#2b1a12"); }),
  tank:outlined(24,36,g=>{ R(g,5,2,14,4,"#4a4f50"); R(g,5,2,14,1,"#6a7172"); R(g,5,28,14,6,"#3a3e3f"); R(g,5,28,14,1,"#5a6061"); R(g,6,6,12,22,"#163a2c"); R(g,7,8,10,20,"#22604a"); R(g,7,6,1,22,"#5aa88a"); R(g,10,12,4,8,"#0e2a1e"); R(g,9,14,6,2,"#0e2a1e"); R(g,11,10,2,2,"#0e2a1e"); R(g,11,20,1,5,"#0e2a1e"); R(g,13,20,1,4,"#0e2a1e"); R(g,6,30,2,2,"#9a7a22"); }),
};

// ---------- ship furnishings ----------
Object.assign(PROP,{
  couch:outlined(24,22,g=>{ R(g,1,6,22,14,"#4a1e18"); R(g,1,6,22,5,"#6a2a20"); R(g,1,6,22,1,"#8a3a2a"); R(g,1,11,22,6,"#5a241c"); R(g,4,11,7,4,"#6e2c22"); R(g,13,11,7,4,"#6e2c22"); R(g,4,11,7,1,"#8a3a2a"); R(g,13,11,7,1,"#8a3a2a"); R(g,1,6,3,14,"#3a1610"); R(g,20,6,3,14,"#3a1610"); R(g,2,20,2,2,"#1a0e0a"); R(g,20,20,2,2,"#1a0e0a"); R(g,8,14,2,1,"#c9a24a"); }),
  table:outlined(24,20,g=>{ R(g,0,6,24,8,"#4a4842"); R(g,0,6,24,1,"#6a6860"); R(g,0,13,24,2,"#2a2824"); R(g,3,15,2,5,"#2a2824"); R(g,19,15,2,5,"#2a2824"); R(g,4,8,3,3,"#d8d0c0"); R(g,5,9,1,1,"#3a2010"); R(g,12,8,5,3,"#bdb39c"); R(g,13,9,3,1,"#a32a1d"); R(g,19,9,2,2,"#c9a24a"); }),
  chair:outlined(24,20,g=>{ R(g,7,4,10,4,"#2e3336"); R(g,7,4,10,1,"#4a5256"); R(g,7,8,10,6,"#3a3f42"); R(g,7,8,10,1,"#5a6266"); R(g,8,14,2,6,"#1e2224"); R(g,14,14,2,6,"#1e2224"); }),
  coffee:outlined(24,28,g=>{ R(g,5,4,14,22,"#2a2622"); R(g,5,4,14,2,"#45403a"); R(g,7,7,10,6,"#141210"); R(g,8,8,4,1,"#e8b048"); R(g,9,15,6,7,"#2e2a24"); R(g,10,17,4,4,"#5a3a1e"); R(g,10,17,4,1,"#7a5030"); R(g,8,15,1,7,"#6a6458"); R(g,15,8,2,2,"#e04030"); R(g,7,24,10,2,"#1a1814"); }),
  vending:outlined(24,34,g=>{ R(g,3,2,18,30,"#26343c"); R(g,3,2,18,2,"#4a5e6a"); R(g,5,5,10,22,"#0e1a20"); const cs=["#c9a24a","#a32a1d","#5ad06a","#62cfe0","#d8d0c0"]; for(let k=0;k<5;k++) for(let c=0;c<3;c++) R(g,6+c*3,6+k*4,2,3,cs[(k+c)%5]); R(g,16,8,3,6,"#141c20"); R(g,17,9,1,1,"#5ad06a"); R(g,16,22,3,4,"#0a0f12"); R(g,3,29,18,3,"#1a2228"); }),
  arcade:outlined(24,34,g=>{ R(g,4,2,16,30,"#2a1a3a"); R(g,4,2,16,4,"#4a2a5a"); R(g,5,3,14,2,"#c9a24a"); R(g,6,7,12,10,"#06040a"); R(g,5,18,14,4,"#3a2a4a"); R(g,8,19,2,2,"#e04030"); R(g,13,19,2,2,"#62cfe0"); R(g,16,19,1,2,"#e8b048"); R(g,4,22,16,10,"#22142e"); R(g,9,26,6,3,"#140a1c"); }),
  toilet:outlined(24,22,g=>{ R(g,7,2,10,8,"#bfb8a8"); R(g,7,2,10,1,"#e0d8c8"); R(g,15,4,2,1,"#8a8a80"); R(g,6,10,12,8,"#cfc8b8"); R(g,6,10,12,1,"#ece4d4"); R(g,8,11,8,5,"#6a8a8e"); R(g,9,12,2,1,"#9ac0c4"); R(g,9,18,6,3,"#a8a090"); }),
  sink:outlined(24,30,g=>{ R(g,5,1,14,12,"#3a3f42"); R(g,6,2,12,10,"#3e5a62"); R(g,7,3,3,2,"#8ab0b8"); R(g,8,6,1,3,"#6a8a92"); R(g,4,15,16,6,"#cfc8b8"); R(g,4,15,16,1,"#ece4d4"); R(g,6,16,12,3,"#6a8a8e"); R(g,11,13,2,3,"#8a8a80"); R(g,10,21,4,8,"#a8a090"); }),
  shower:outlined(24,34,g=>{ R(g,2,2,20,30,"#3a4448"); R(g,4,4,16,26,"#4e646c"); R(g,4,4,1,26,"#8ab0b8"); R(g,8,4,1,26,"#5e7880"); R(g,10,5,5,2,"#a8a8a0"); R(g,12,7,1,1,"#a8a8a0"); R(g,3,30,18,2,"#2a3236"); R(g,10,29,4,1,"#1a2024"); }),
  bars:outlined(24,32,g=>{ R(g,0,3,24,2,"#3a3832"); R(g,0,25,24,2,"#3a3832"); for(let k=0;k<6;k++){ R(g,1+k*4,0,2,32,"#4a4842"); R(g,1+k*4,0,1,32,"#6a6860"); } R(g,0,30,24,2,"#22201c"); }),
  gunrack:outlined(24,30,g=>{ R(g,2,2,20,26,"#2b2a27"); R(g,2,2,20,2,"#45423c"); for(const y of [7,14,21]){ R(g,3,y-2,1,4,"#a37a32"); R(g,20,y-2,1,4,"#a37a32"); R(g,4,y,16,3,"#20201b"); R(g,4,y,16,1,"#4a4a40"); R(g,5,y+3,3,2,"#3a2a1a"); } R(g,2,27,20,1,"#141210"); }),
  plant:outlined(24,26,g=>{ R(g,7,16,10,8,"#5a3a1e"); R(g,7,16,10,2,"#7a5030"); R(g,8,24,8,2,"#3a2412"); const L=[[11,4,2,12],[7,7,4,2],[13,6,5,2],[6,10,5,2],[13,10,5,2],[8,13,3,2],[13,13,4,2],[10,2,2,3]]; L.forEach(([x,y,w,h],i)=>R(g,x,y,w,h,i%2?"#3f6a3a":"#5a8a4a")); R(g,12,5,1,6,"#2e4a2a"); }),
  captchair:outlined(24,26,g=>{ R(g,5,2,14,13,"#3a2a20"); R(g,5,2,14,1,"#5a4030"); R(g,5,3,14,1,"#a37a32"); R(g,7,5,10,8,"#4a3426"); R(g,4,14,16,6,"#4a3426"); R(g,4,14,16,1,"#6a4a36"); R(g,2,12,3,8,"#2a1e16"); R(g,19,12,3,8,"#2a1e16"); R(g,19,12,3,1,"#e04030"); R(g,10,20,4,4,"#1e1a16"); R(g,7,23,10,2,"#141210"); }),
  footlocker:outlined(24,18,g=>{ R(g,4,6,16,10,"#3a3f2c"); R(g,4,6,16,2,"#56603f"); R(g,4,11,16,1,"#22261a"); R(g,11,9,2,3,"#a37a32"); R(g,6,13,4,1,"#c9a24a"); }),
  workbench:outlined(24,22,g=>{ R(g,1,6,22,6,"#4a3a28"); R(g,1,6,22,1,"#66513a"); R(g,4,7,6,1,"#8a8a80"); R(g,12,7,2,3,"#a32a1d"); R(g,16,8,5,2,"#3a3c38"); R(g,2,12,2,10,"#2a2018"); R(g,20,12,2,10,"#2a2018"); R(g,2,17,20,2,"#33281c"); R(g,6,15,4,2,"#9a7a22"); }),
  captive:cvs(24,24),
});
const PROP_NAME={crate:"Cargo crate",bed:"Bunk",desk:"Console desk",locker:"Locker",barrel:"Fuel drum",brazier:"Brazier",generator:"Generator",tank:"Specimen tank",couch:"Couch",table:"Mess table",chair:"Chair",coffee:"Coffee machine",vending:"Vending machine",arcade:"Arcade cabinet",toilet:"Toilet",sink:"Sink and mirror",shower:"Shower",bars:"Brig bars",captive:"Gerald",gunrack:"Weapon rack",plant:"Plant",captchair:"Captain's chair",footlocker:"Footlocker",workbench:"Workbench"};
let flavorT={};

// ---------- ship terminals ----------
const TERM={
  helm:outlined(24,26,g=>{ R(g,1,10,22,14,"#2a2f30"); R(g,1,10,22,4,"#3e4648"); R(g,1,10,22,1,"#5a6466"); R(g,3,1,18,10,"#1a1e1f"); R(g,3,1,18,1,"#4a5456");
    R(g,4,2,7,7,"#0a2a2a"); R(g,13,2,7,7,"#0a2a2a"); R(g,5,3,4,1,"#5ad0d0"); R(g,5,5,3,1,"#3a9a9a"); R(g,5,7,5,1,"#3a9a9a"); R(g,14,3,5,1,"#e8b048"); R(g,14,5,2,1,"#5ad0d0"); R(g,16,7,3,1,"#5ad0d0");
    R(g,6,11,2,3,"#a37a32"); R(g,6,11,2,1,"#dcae4c"); R(g,16,11,2,3,"#a37a32"); R(g,16,11,2,1,"#dcae4c"); R(g,10,12,4,2,"#7a1a12"); R(g,2,22,20,2,"#1a1e1f"); }),
  rack:outlined(24,34,g=>{ R(g,2,2,20,30,"#2b2a27"); R(g,2,2,20,2,"#45423c"); R(g,2,9,20,1,"#a37a32"); R(g,2,20,20,1,"#a37a32");
    R(g,4,5,16,3,"#20201b"); R(g,4,5,16,1,"#4a4a40"); R(g,6,8,3,2,"#3a2a1a"); R(g,4,15,14,3,"#20201b"); R(g,4,15,14,1,"#4a4a40"); R(g,17,13,3,2,"#141412");
    R(g,6,24,7,3,"#20201b"); R(g,6,24,7,1,"#4a4a40"); R(g,15,23,4,6,"#3e4a4a"); R(g,8,29,8,2,"#c9a24a"); }),
  stash:outlined(24,32,g=>{ R(g,2,2,20,28,"#3a3f2c"); R(g,2,2,20,2,"#56603f"); R(g,2,2,1,28,"#56603f"); R(g,11,4,2,26,"#22261a");
    for(let k=0;k<20;k++) R(g,2+k,25,1,3,((k>>1)%2)?"#9a7a22":"#15120b"); R(g,15,11,4,6,"#141712"); R(g,16,12,2,1,"#5ad06a"); R(g,5,8,4,1,"#c9a24a"); R(g,5,10,3,1,"#c9a24a"); }),
  records:outlined(24,30,g=>{ R(g,8,20,8,10,"#2a2620"); R(g,8,20,8,1,"#45403a"); R(g,4,2,16,18,"#33302a"); R(g,4,2,16,1,"#55504a"); R(g,6,4,12,12,"#1a1206");
    R(g,7,6,8,1,"#e8b048"); R(g,7,8,5,1,"#a87a30"); R(g,7,10,9,1,"#a87a30"); R(g,7,12,4,1,"#e8b048"); R(g,9,17,6,2,"#1a1814"); }),
  board:outlined(24,30,g=>{ R(g,1,2,22,22,"#4a3a24"); R(g,1,2,22,1,"#6a5434"); R(g,3,4,18,18,"#5a4630"); R(g,4,5,6,7,"#cfc6b0"); R(g,12,6,7,5,"#b8ae96"); R(g,6,14,8,6,"#d8d0bc"); R(g,15,13,5,7,"#c4baa2");
    R(g,6,7,3,1,"#5a5246"); R(g,6,9,2,1,"#5a5246"); R(g,13,8,4,1,"#5a5246"); R(g,8,16,4,1,"#5a5246"); R(g,8,11,2,2,"#a8301f"); R(g,17,10,2,2,"#a8301f"); R(g,12,19,2,2,"#a8301f"); R(g,10,24,4,6,"#2a2218"); }),
  airlock:outlined(24,26,g=>{ R(g,4,3,16,19,"#3a3732"); R(g,4,3,16,1,"#5a564e"); for(let k=0;k<16;k++){ R(g,4+k,3,1,1,((k>>1)%2)?"#9a7a22":"#15120b"); R(g,4+k,21,1,1,((k>>1)%2)?"#9a7a22":"#15120b"); }
    R(g,8,8,8,8,"#2a0806"); R(g,9,9,6,6,"#9a1e14"); R(g,9,9,6,1,"#d0402a"); R(g,7,18,3,1,"#5ad06a"); R(g,14,18,3,1,"#e04030"); R(g,10,22,4,4,"#2a2620"); }),
};
TERM.workbench=outlined(24,26,g=>{ R(g,1,10,22,6,"#4a3a28"); R(g,1,10,22,1,"#6a5434"); R(g,3,2,18,8,"#2a2620"); R(g,3,2,18,1,"#45403a"); for(let k=0;k<5;k++) R(g,5+k*3,4,1,4,k%2?"#8a8a80":"#a37a32");
  R(g,4,11,6,1,"#8a8a80"); R(g,12,11,2,3,"#a32a1d"); R(g,16,11,5,2,"#3a3c38"); R(g,17,11,1,1,"#e8b048"); R(g,2,16,2,10,"#2a2018"); R(g,20,16,2,10,"#2a2018"); R(g,2,21,20,2,"#33281c"); R(g,6,19,4,2,"#9a7a22"); });
TERM.wardrobe=outlined(24,34,g=>{ R(g,3,2,18,30,"#3a2e24"); R(g,3,2,18,2,"#5a4834"); R(g,11,4,2,28,"#241c16"); R(g,5,6,5,22,"#5e1a12"); R(g,5,6,5,2,"#8a2a1c"); R(g,14,6,5,9,"#3a4448"); R(g,15,8,3,2,"#f2b648");
  R(g,14,17,5,11,"#2e3336"); R(g,15,18,3,3,"#4a5054"); R(g,9,16,1,2,"#c9a24a"); R(g,14,16,1,2,"#c9a24a"); });
TERM.navtable=outlined(48,26,g=>{ R(g,20,20,8,6,"#141a1c"); R(g,4,9,40,12,"#1e2628"); R(g,2,7,44,4,"#3a4448"); R(g,2,7,44,1,"#5a6a70"); R(g,6,8,36,2,"#0a3a40"); R(g,4,19,40,2,"#0e1214");
  for(let k=0;k<6;k++) R(g,8+k*6,15,3,2,k%2?"#5ad0d0":"#2a6a70"); R(g,22,12,4,2,"#e8b048"); });
const SEAT=outlined(24,24,g=>{ R(g,8,16,8,6,"#1a1e20"); R(g,5,10,14,7,"#3a3f42"); R(g,5,10,14,1,"#5a6266"); R(g,6,11,12,5,"#2a2f32"); });
const SEAT_BACK={}; for(const [k,c] of Object.entries({pilot:"#7a2416",copilot:"#2a5a5a",nav:"#2a5a5a",eng:"#5a4a20"})) SEAT_BACK[k]=outlined(24,14,g=>{ R(g,5,1,14,11,"#2e3336"); R(g,5,1,14,2,c); R(g,7,4,10,6,"#3a3f42"); R(g,3,6,3,7,"#1e2224"); R(g,18,6,3,7,"#1e2224"); });
const SEAT_NAME={pilot:"Pilot's seat",copilot:"Co-pilot's seat",nav:"Navigator's seat",eng:"Engineer's seat"};
const TERM_NAME={workbench:"Workbench",wardrobe:"Wardrobe",navtable:"Star map table",helm:"Helm",rack:"Loadout rack",stash:"Stash locker",records:"Records terminal",board:"Contract board",airlock:"Airlock control"};

// ---------- space backdrop (ship view) ----------
const BD={};
function shade(hex,f){ const n=parseInt(hex.slice(1),16); return "#"+[16,8,0].map(s=>Math.round(((n>>s)&255)*f).toString(16).padStart(2,"0")).join(""); }
function backdrop(scene,w,h){
  const key=JSON.stringify(scene)+"|"+w+"x"+h; if(BD.key===key) return BD.c;
  const c=cvs(w,h), g=c.getContext("2d"); R(g,0,0,w,h,"#020305");
  let sd=7; const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const tint=scene.hue||scene.glow||scene.a||"#6f9b8c";
  for(let k=0;k<5;k++){ const x=rnd()*w, y=rnd()*h, r=60+rnd()*140, gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,tint+"26"); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(0,0,w,h); }
  for(let k=0;k<w*h/90;k++){ const v=rnd(); const x=(rnd()*w)|0, y=(rnd()*h)|0; R(g,x,y,v>.97?2:1,v>.97?2:1,v>.9?"#d8dfe8":v>.6?"#6a7282":"#2e3440"); }
  const o=cvs(Math.ceil(w/2),Math.ceil(h/2)), og=o.getContext("2d"), ow=o.width, oh=o.height, cx=Math.round(ow*.8), cy=Math.round(oh*.28);
  const P=(x,y,col)=>{ og.fillStyle=col; og.fillRect(x|0,y|0,1,1); };
  if(scene.kind==="planet"){ const r=Math.round(oh*.34);
    const ring=front=>{ if(!scene.ring) return; for(let a=0;a<6.283;a+=.004){ const x=cx+Math.cos(a)*r*1.7, y=cy+Math.sin(a)*r*.32; if((Math.sin(a)>0)!==front) continue; if(!front&&Math.hypot(x-cx,y-cy)<r) continue; P(x,y,((a*40)|0)%3?"#8a7a60":"#5a4e3e"); } };
    ring(false);
    for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){ const d=Math.hypot(x,y); if(d>r) continue; const band=Math.sin((y+r)*.35+Math.sin(x*.08)*2)>.2, l=(-x*.55-y*.45)/r+.35-(d/r)*.25, dith=((x+y)&1)?.08:-.08;
      P(cx+x,cy+y,l+dith>.35?(band?scene.a:scene.b):l+dith>-.15?(band?shade(scene.a,.6):shade(scene.b,.7)):"#07080a"); }
    for(let a=0;a<6.283;a+=.01){ const x=cx+Math.cos(a)*(r+1), y=cy+Math.sin(a)*(r+1); if(Math.cos(a)*-.55+Math.sin(a)*-.45>0) P(x,y,shade(scene.a,1.3)); }
    ring(true);
  } else if(scene.kind==="ring"){ const rx=Math.round(oh*.48), ry=Math.round(rx*.36);
    for(let k=0;k<4;k++){ const a=k*1.5708+.4; for(let t=6;t<rx-3;t++) P(cx+Math.cos(a)*t,cy+Math.sin(a)*t*.36,"#30363a"); }
    for(let a=0;a<6.283;a+=.003){ const front=Math.sin(a)>0; for(let t=0;t<4;t++) P(cx+Math.cos(a)*(rx-t),cy+Math.sin(a)*(ry-t*.36),t===0?(front?"#7a8288":"#4a5056"):front?"#3a4044":"#25292c");
      if(((a*90)|0)%7===0) P(cx+Math.cos(a)*(rx-2),cy+Math.sin(a)*(ry-1),scene.hue); }
    for(let y=-5;y<=5;y++)for(let x=-6;x<=6;x++) P(cx+x,cy+y,Math.abs(y)===5||Math.abs(x)===6?"#5a6268":((x+y)&3)?"#2a3034":scene.hue);
  } else if(scene.kind==="spire"){ const top=cy-Math.round(oh*.26), base=cy+Math.round(oh*.4);
    for(let y=top;y<base;y++){ const t=(y-top)/(base-top), hw=Math.max(1,Math.round(1+t*t*11+(Math.sin(t*20)>.6?2:0)));
      for(let x=-hw;x<=hw;x++) P(cx+x,y,x===-hw?"#6a5a40":x===hw?"#1a1610":((x*7+y*3)%11===0)?scene.hue:"#3a3226"); }
    for(const sx of [-15,15]) for(let y=0;y<22;y++) for(let x=-2;x<=2;x++) P(cx+sx+x,base-22+y,x===-2?"#5a4a34":(y%6===2&&x===0)?scene.hue:"#2e281e");
  } else if(scene.kind==="hulk"){ const len=Math.round(ow*.36), th0=Math.round(oh*.1);
    for(let x=-len;x<=len;x++){ if(Math.sin(x*.21)>.86||Math.abs(x-len*.3)<3) continue; const th=th0+(Math.sin(x*.07)>0?3:0)-(x>len*.7?Math.round((x-len*.7)*.5):0);
      for(let y=-th;y<=th;y++) P(cx-len*.3+x,cy+y+x*.12,y===-th?"#4a4440":y===th?"#0e0c0a":((x*13+y*7)%17===0)?scene.glow:"#22201d"); }
  }
  g.imageSmoothingEnabled=false; g.drawImage(o,0,0,ow*2,oh*2);
  BD.key=key; BD.c=c; return c;
}
let warp=null;

// ---------- item icons (16x16) ----------
function itemIcon(g,it,x,y,blink){
  const D=Items.def(it.d)||{k:"?"}, r=(a,b,w,h,c)=>R(g,x+a,y+b,w,h,c);
  switch(D.k){
    case "weapon": gunPix(g,it.d,x,y+5); break;
    case "throw":
      if(it.d==="frag"){ r(5,6,6,7,"#3a4428"); r(5,6,6,1,"#56603c"); r(7,4,2,2,"#8a8a80"); r(10,4,2,1,"#8a8a80"); r(6,9,4,1,"#2a3018"); }
      else if(it.d==="incendiary"){ r(6,5,4,8,"#8a5a1e"); r(6,5,1,8,"#b07a30"); r(7,3,2,2,"#a32a1d"); r(7,1,1,2,"#ff8a20"); }
      else if(it.d==="stun"){ r(5,4,6,9,"#4a5056"); r(5,4,1,9,"#6a7076"); r(5,7,6,1,"#e0c040"); r(7,2,2,2,"#2a2e32"); }
      else if(it.d==="decoy"){ r(4,6,8,7,"#3a3a3a"); r(4,6,8,1,"#5a5a5a"); for(let k=0;k<3;k++) r(6,8+k*2,4,1,"#1a1a1a"); r(10,4,1,2,"#e04030"); }
      else if(it.d==="sunburst"){ r(5,5,6,6,"#f0d060"); r(6,6,4,4,"#fff4c0"); r(7,2,2,2,"#f0d060"); r(7,12,2,2,"#f0d060"); r(2,7,2,2,"#f0d060"); r(12,7,2,2,"#f0d060"); }
      else if(it.d==="halo"){ r(5,5,6,6,"#121214"); r(6,6,2,2,"#34343e"); r(3,7,10,1,"#b070ff"); r(4,6,1,1,"#b070ff"); r(11,8,1,1,"#b070ff"); }
      break;
    case "armor": { // draw the piece itself (helmets on a head), crop to what was drawn
      const part=D.part||"body", m=cvs(26,36), mg=m.getContext("2d"), L={s:6,h:0,t:0,tc:4,bc:4,bt:4,c:"red",v:"amber",k:"plume"}; mg.translate(1,3);
      if(part==="head"){ L.hd=it.d; drawHuman(mg,{b:0},L); } else if(part==="legs"){ drawLegPiece(mg,it.d,9,8,true); drawLegPiece(mg,it.d,12,11,false); }
      else if(part==="body"){ drawChest(mg,it.d,0,L); if(it.d==="hazard"){ R(mg,6,13,3,7,"#5a5a50"); R(mg,6,13,3,1,"#8a8a80"); } }
      else { drawAccBack(mg,it.d,0,L,0); drawAccFront(mg,it.d,0,L); if(it.d==="pauldron") drawPauldron(mg,0); }
      let bx=[26,0,36,0]; if(part==="head") bx=[7,19,1,17]; else { const px=mg.getImageData(0,0,26,36).data; for(let yy=0;yy<36;yy++) for(let xx=0;xx<26;xx++) if(px[(yy*26+xx)*4+3]){ bx[0]=Math.min(bx[0],xx); bx[1]=Math.max(bx[1],xx); bx[2]=Math.min(bx[2],yy); bx[3]=Math.max(bx[3],yy); } }
      const cw=Math.max(1,bx[1]-bx[0]+1), ch=Math.max(1,bx[3]-bx[2]+1), sc=Math.min(14/cw,14/ch,2); g.imageSmoothingEnabled=false;
      g.drawImage(m,bx[0],bx[2],cw,ch,x+Math.round((16-cw*sc)/2),y+Math.round((16-ch*sc)/2),cw*sc,ch*sc); break; }
    case "pack": { const col={sling:"#4a3a26",field:"#3e4a32",hauler:"#4a4a3a",mule:"#5a5a60",bottomless:"#2a1a3a"}[it.d]||"#4a3a26", hi={sling:"#6a5436",field:"#5a6a48",hauler:"#6a6a56",mule:"#8a8a92",bottomless:"#4a2e66"}[it.d]||"#6a5436";
      const w=it.d==="sling"?8:it.d==="field"?10:12; r(8-w/2,4,w,10,col); r(8-w/2,4,w,1,hi); r(6,2,4,2,"#2a2018"); r(8-w/2+1,8,w-2,1,"#1a140c"); if(it.d==="mule") { r(1,3,1,11,"#8a8a92"); r(14,3,1,11,"#8a8a92"); } if(it.d==="bottomless") r(7,10,2,2,"#b070ff"); break; }
    case "ammo": { const A=Items.AMMO[D.ammo]; if(D.ammo==="rocket"){ r(3,7,9,3,"#5a6040"); r(12,7,2,3,"#d0703a"); r(1,6,2,5,"#3a4028"); } else { r(3,8,10,5,"#3a3020"); r(3,8,10,1,"#5a4a30"); for(const k of [4,6,8,10]){ r(k,4,1,4,A.col); r(k,4,1,1,"#f4e4b0"); } } break; }
    case "mat": if(it.d==="scrap"){ r(3,6,10,7,"#5a5a52"); r(3,6,10,1,"#8a8a80"); r(5,8,3,3,"#3a3a34"); r(10,5,3,2,"#6a6a62"); } else if(it.d==="prop"){ r(5,3,6,11,"#7a2a1a"); r(5,3,1,11,"#a8402a"); r(6,1,4,2,"#4a4a42"); r(5,7,6,1,"#e0c040"); } else { r(3,5,10,8,"#1e4a2a"); r(3,5,10,1,"#3a7a4a"); for(let k=0;k<4;k++){ r(4+k*2,13,1,2,"#c9a24a"); r(4+k*2,3,1,2,"#c9a24a"); } r(6,7,4,3,"#141414"); } break;
    case "dye": { const col=D.slot==="cloak"?(Items.DYES.cloak[D.dye]||["#888"])[1]:D.slot==="visor"?(Items.DYES.visor[D.dye]||["#888"])[0]:"#c9c0a8"; r(6,3,4,2,"#8a8a80"); r(5,5,6,9,"#2a2e32"); r(6,7,4,6,col); r(6,7,1,6,"rgba(255,255,255,.3)"); break; }
    case "val": { const i=+it.d.slice(3)||0, cs=[["#3a6a8a","#7ab0d0"],["#7a5c1c","#e0b850"],["#3a6a3a","#8ad08a"],["#6a5a40","#c9a24a"],["#2a5a6a","#5ad0d0"],["#4a4a42","#a8a89c"],["#c8bfa6","#f0e8d4"],["#6a4a1a","#c9a24a"]][i%8];
      r(5,4,6,9,cs[0]); r(6,3,4,11,cs[1]); r(7,5,1,3,"#fff8e0"); break; }
    case "med":
      if(it.d==="bandage"){ r(3,6,10,7,"#a39b86"); r(3,6,10,1,"#d0c7b0"); r(11,6,2,7,"#857d6a"); r(5,8,4,2,"#7a1a14"); }
      else if(it.d==="medkit"){ r(2,5,12,9,"#363b27"); r(2,5,12,1,"#575d3e"); r(7,6,2,7,"#a32a1d"); r(5,8,6,2,"#a32a1d"); r(6,3,4,2,"#1a1a16"); }
      else if(it.d==="o2"){ r(5,3,6,11,"#36545a"); r(5,3,1,11,"#6a9aa0"); r(6,1,4,2,"#8a8a80"); r(5,7,6,1,"#c9a24a"); }
      else { r(2,7,10,3,"#cfd8d8"); r(2,7,10,1,"#ffffff"); r(4,8,6,1,"#e04060"); r(12,8,3,1,"#8a8a80"); r(0,7,2,3,"#4a5056"); }
      break;
    case "key": r(2,5,12,7,"#2a2420"); r(2,5,12,1,"#6a5a3a"); r(4,8,6,1,"#c9a24a"); r(11,7,2,3,"#b8301f"); break;
    case "box": r(2,4,12,10,"#7a3610"); r(2,4,12,1,"#a8561e"); for(let k=0;k<5;k++) r(3+k*2,11,1,3,"#1a0c05"); r(11,6,2,2,blink?"#ff6a30":"#3a1a0a"); r(3,6,6,1,"#c9a24a"); break;
    default: r(5,5,6,6,"#6a6a62");
  }
}
const ICON={};
function iconFor(it){ if(!it) return ""; const key=it.d; if(ICON[key]) return ICON[key]; const c=cvs(16,16); itemIcon(c.getContext("2d"),it,0,0,true); return ICON[key]=outlined(16,16,gg=>gg.drawImage(c,0,0)).toDataURL(); }
const iconURL=(kind,gear)=>iconFor({d:gear||kind});
const GUNS={};
function gunURL(d){ const k=d||"none"; if(GUNS[k]) return GUNS[k]; const s=cvs(16,7), sg=s.getContext("2d"); if(d) gunPix(sg,d,0,0); else { R(sg,4,3,8,1,"#4a4842"); R(sg,11,1,2,4,"#4a4842"); }
  const c=outlined(48,16,g=>{ g.imageSmoothingEnabled=false; g.drawImage(s,0,0,16,7,0,1,48,14); }); return GUNS[k]=c.toDataURL(); }
const rarCol=it=>Items.RAR[Items.rarOf(it)].col;

// ---------- floors ----------
const FL={
  "Docking bay":{type:"plate",base:"#3d4245",hi:"#555b5f",lo:"#2a2e30",seam:"#15181a",inner:"#383d40",riv:"#6a7175",mesh:"#2c3134"},
  "Medbay":{type:"tile",base:"#6c767c",alt:"#626b71",hi:"#858f95",lo:"#4c5459",seam:"#2e3438",mesh:"#4a5257"},
  "Crew quarters":{type:"plank",base:"#5c4532",alt:"#523c2b",hi:"#6e543e",seam:"#26190f",mesh:"#3d2d20"},
  "Security office":{type:"plate",base:"#3d3c3a",hi:"#52504d",lo:"#2a2928",seam:"#141313",inner:"#383735",riv:"#64615c",mesh:"#2a2a29"},
  "Captain's cabin":{type:"carpet",base:"#5c1e19",alt:"#6e2620",gold:"#a07e38",seam:"#2a0d0a",mesh:"#3a1210"},
  "Main corridor":{type:"grate",base:"#344040",hi:"#485656",lo:"#222b2b",seam:"#111616",inner:"#2a3434",riv:"#5a6a68",mesh:"#26302f"},
  "Engineering":{type:"plate",base:"#4b3f2f",hi:"#605140",lo:"#34291d",seam:"#1a140d",inner:"#44392a",riv:"#75654c",mesh:"#33291c",oil:true},
  "Cargo hold":{type:"diamond",base:"#43433c",hi:"#5a5a50",lo:"#2f2f2a",seam:"#161613",mesh:"#30302b"},
  "Xenolab":{type:"tile",base:"#3c5a49",alt:"#345040",hi:"#4d6e5b",lo:"#284035",seam:"#142019",mesh:"#2a4234"},
  "Vault":{type:"vault",base:"#2e2a20",hi:"#3e3829",lo:"#1f1c15",seam:"#0d0c09",gold:"#8a6c34",mesh:"#24201a"},
};
FL["Lower corridor"]=FL["Main corridor"];
FL["Service shaft"]={type:"grate",base:"#3a3a34",hi:"#4e4e46",lo:"#26261f",seam:"#121210",inner:"#2e2e28",riv:"#66665a",mesh:"#2a2a24"};
FL["Fuel storage"]={type:"plate",base:"#4a3a26",hi:"#5e4a32",lo:"#33281a",seam:"#18120a",inner:"#423422",riv:"#7a6440",mesh:"#30251a",oil:true};
FL["Armory"]={type:"plate",base:"#363c42",hi:"#4a525a",lo:"#252a2e",seam:"#111416",inner:"#30363b",riv:"#66707a",mesh:"#262b30"};
FL["Shrine"]={type:"stone",base:"#3a2a26",alt:"#33241f",hi:"#4c3832",lo:"#24180f",seam:"#140c09",mesh:"#2a1c16"};
FL["Bridge"]={type:"plate",base:"#2c3540",hi:"#3e4a58",lo:"#1e252c",seam:"#0e1216",inner:"#28303a",riv:"#5a6a7a",mesh:"#1e262e"};
FL["Comms"]=FL["Security office"]; FL["Ship hold"]=FL["Cargo hold"]; FL["Quarters"]=FL["Crew quarters"]; FL["Airlock"]=FL["Docking bay"]; FL["Main hall"]=FL["Main corridor"];
FL["Break room"]={type:"plank",base:"#4e3a2a",alt:"#46341f",hi:"#5e4836",seam:"#22170e",mesh:"#33251a"};
FL["Bathroom"]={type:"tile",base:"#7a8488",alt:"#6e787c",hi:"#929ca0",lo:"#586064",seam:"#3a4246",mesh:"#5a6266"};
FL["Brig"]={type:"grate",base:"#2e2a2a",hi:"#403a3a",lo:"#1e1a1a",seam:"#0e0c0c",inner:"#262222",riv:"#5a4a4a",mesh:"#221e1e"};
FL["Mess hall"]={type:"plank",base:"#4a3a2c",alt:"#423222",hi:"#5a4838",seam:"#1e150e",mesh:"#30241a"};
FL["Workshop"]={type:"plate",base:"#3e3a30",hi:"#524c3e",lo:"#2a2720",seam:"#141210",inner:"#383428",riv:"#6a6450",mesh:"#2a2620",oil:true};
FL._=FL["Main corridor"];
const AMBC={"Docking bay":[.44,.47,.5],"Medbay":[.42,.52,.58],"Crew quarters":[.5,.42,.33],"Security office":[.4,.42,.48],"Captain's cabin":[.5,.32,.25],
  "Main corridor":[.34,.43,.43],"Lower corridor":[.32,.4,.42],"Service shaft":[.38,.38,.34],"Fuel storage":[.5,.4,.26],"Armory":[.38,.42,.48],"Shrine":[.42,.22,.2],"Mess hall":[.62,.5,.38],"Workshop":[.5,.46,.36],"Bridge":[.5,.58,.66],"Break room":[.66,.54,.42],"Bathroom":[.62,.68,.72],"Brig":[.54,.34,.32],"Comms":[.56,.5,.4],"Main hall":[.5,.56,.56],"Ship hold":[.52,.5,.44],"Quarters":[.6,.5,.4],"Airlock":[.5,.5,.54],"Engineering":[.52,.42,.29],"Cargo hold":[.42,.42,.38],"Xenolab":[.3,.5,.38],"Vault":[.48,.4,.24],_:[.34,.4,.4]};
FL.corrPlate={type:"plate",base:"#323b3b",hi:"#465250",lo:"#212929",seam:"#101515",inner:"#2c3535",riv:"#5a6a68",mesh:"#26302f"};
function styleAt(x,y){ const n=Sim.roomName(x,y); if((n==="Main corridor"||n==="Lower corridor"||n==="Main hall")&&(x%6)>1) return FL.corrPlate; return FL[n]||FL._; }
function bevel(g,x,y,w,h,base,hi,lo,seam){ R(g,x,y,w,h,seam); R(g,x+1,y+1,w-2,h-2,base); R(g,x+1,y+1,w-2,1,hi); R(g,x+1,y+1,1,h-2,hi); R(g,x+1,y+h-2,w-2,1,lo); R(g,x+w-2,y+1,1,h-2,lo); }
function drawFloor(g,x,y,force){
  const st=force||styleAt(x,y), ox=x*TS, oy=y*TS, h=hh(x,y);
  switch(st.type){
    case "plate": bevel(g,ox,oy,24,24,st.base,st.hi,st.lo,st.seam); R(g,ox+6,oy+6,12,12,st.inner); R(g,ox+6,oy+6,12,1,st.lo); R(g,ox+6,oy+17,12,1,st.hi);
      for(const [a,b] of [[3,3],[20,3],[3,20],[20,20]]) R(g,ox+a,oy+b,1,1,st.riv);
      if(st.oil&&h%4===0){ disc(g,ox+12,oy+12,4,"rgba(8,6,3,.6)"); disc(g,ox+15,oy+14,2,"rgba(8,6,3,.5)"); } break;
    case "grate": bevel(g,ox,oy,24,24,st.base,st.hi,st.lo,st.seam); R(g,ox+4,oy+4,16,16,"#0b0e0e");
      for(let k=0;k<5;k++){ R(g,ox+5,oy+5+k*3,14,2,st.inner); R(g,ox+5,oy+5+k*3,14,1,st.hi); } for(const [a,b] of [[2,2],[21,2],[2,21],[21,21]]) R(g,ox+a,oy+b,1,1,st.riv); break;
    case "tile": for(let i=0;i<2;i++)for(let j=0;j<2;j++) bevel(g,ox+i*12,oy+j*12,12,12,(i+j)%2?st.base:st.alt,st.hi,st.lo,st.seam); break;
    case "plank": for(let r=0;r<6;r++){ const c=hh(x,y,r)%2?st.base:st.alt; R(g,ox,oy+r*4,24,4,c); R(g,ox,oy+r*4,24,1,st.hi); R(g,ox,oy+r*4+3,24,1,st.seam); R(g,ox+(hh(x,y,r+9)%18)+3,oy+r*4,1,4,st.seam); } break;
    case "carpet": R(g,ox,oy,24,24,st.base); for(let k=0;k<6;k++){ R(g,ox+12-k,oy+6+k,1,1,st.alt); R(g,ox+11+k,oy+6+k,1,1,st.alt); R(g,ox+12-k,oy+17-k,1,1,st.alt); R(g,ox+11+k,oy+17-k,1,1,st.alt); }
      R(g,ox+11,oy+11,2,2,st.gold); R(g,ox,oy,24,1,st.seam); R(g,ox,oy,1,24,st.seam); for(const [a,b] of [[2,2],[21,2],[2,21],[21,21]]) R(g,ox+a,oy+b,1,1,st.gold); break;
    case "diamond": bevel(g,ox,oy,24,24,st.base,st.hi,st.lo,st.seam); for(let i=0;i<5;i++)for(let j=0;j<5;j++){ const a=ox+3+i*4+(j%2)*2, b=oy+3+j*4; if(a<ox+21){ R(g,a,b,2,1,st.hi); R(g,a,b+1,2,1,st.lo); } } break;
    case "stone": R(g,ox,oy,24,24,st.seam); { const sp=hh(x,y,5)%2; if(sp){ bevel(g,ox,oy,24,12,st.base,st.hi,st.lo,st.seam); bevel(g,ox,oy+12,12,12,st.alt,st.hi,st.lo,st.seam); bevel(g,ox+12,oy+12,12,12,st.base,st.hi,st.lo,st.seam); } else { bevel(g,ox,oy,12,24,st.alt,st.hi,st.lo,st.seam); bevel(g,ox+12,oy,12,12,st.base,st.hi,st.lo,st.seam); bevel(g,ox+12,oy+12,12,12,st.alt,st.hi,st.lo,st.seam); } } break;
    case "vault": bevel(g,ox,oy,24,24,st.base,st.hi,st.lo,st.seam); R(g,ox+11,oy+2,2,20,st.gold); R(g,ox+2,oy+11,20,2,st.gold); R(g,ox+10,oy+10,4,4,"#b8944a"); break;
  }
  for(let k=0;k<6;k++){ const v=hh(x,y,k+11); if(v%3===0) R(g,ox+v%22+1,oy+(v>>6)%22+1,1+(v>>12)%2,1,(v>>3)%2?"rgba(0,0,0,.35)":"rgba(255,235,200,.05)"); }
  if(h%7===0){ let cx=ox+4+(h>>5)%14, cy=oy+4+(h>>9)%14; for(let k=0;k<9;k++){ R(g,cx,cy,1,1,"rgba(0,0,0,.5)"); const v=hh(x,y,k+60); if(v%2) cx+=v%4<2?1:-1; else cy+=1; } }
  if(h%9===0) disc(g,ox+6+(h>>4)%12,oy+6+(h>>8)%12,3,"rgba(30,22,10,.3)");
  // mesh border against walls
  const mesh=(sx,sy,w,hh2)=>{ for(let j=0;j<hh2;j++)for(let i=0;i<w;i++) R(g,sx+i,sy+j,1,1,((i+j)%2)?st.mesh:st.seam); };
  if(isW(x,y-1)) mesh(ox,oy,24,4); if(isW(x,y+1)) mesh(ox,oy+20,24,4); if(isW(x-1,y)) mesh(ox,oy,4,24); if(isW(x+1,y)) mesh(ox+20,oy,4,24);
}
function drawSpace(g,x,y){ const ox=x*TS, oy=y*TS; R(g,ox,oy,24,24,"#030305");
  for(let k=0;k<4;k++){ const v=hh(x,y,k+50); if(v%4===0) R(g,ox+v%24,oy+(v>>5)%24,1,1,v%7===0?"#c9cfdc":"#3c4252"); } }
function capEdges(g,x,y,h){ const ox=x*TS, oy=y*TS;
  if(!isW(x-1,y)){ R(g,ox,oy,1,h,"#6a6458"); R(g,ox+1,oy,1,h,"#0c0b0a"); }
  if(!isW(x+1,y)){ R(g,ox+23,oy,1,h,"#6a6458"); R(g,ox+22,oy,1,h,"#0c0b0a"); }
  if(!isW(x,y-1)){ R(g,ox,oy,24,1,"#6a6458"); R(g,ox,oy+1,24,1,"#0c0b0a"); } }
function wallCap(g,x,y,h){ const ox=x*TS, oy=y*TS; R(g,ox,oy,24,h,"#151413");
  for(let k=0;k<3;k++){ const v=hh(x,y,k+30); const vx=ox+(v%5)*5, vy=oy+((v>>4)%Math.max(1,h-3)); R(g,vx,vy,6,2,"#1f1d1b"); R(g,vx,vy,6,1,"#2a2825"); }
  capEdges(g,x,y,h); }
function skull(g,x,y,c,d){ [".ccc.","cdcdc","ccccc",".c.c."].forEach((r,j)=>[...r].forEach((ch,i)=>{ if(ch==="c") R(g,x+i,y+j,1,1,c); else if(ch==="d") R(g,x+i,y+j,1,1,d); })); }
function drawWall(g,x,y){
  const ox=x*TS, oy=y*TS, below=T(x,y+1).t, front=!(below==="wall"||below==="window"), ext=below==="space", h=hh(x,y);
  if(!front){ wallCap(g,x,y,24); return; }
  wallCap(g,x,y,8); const fy=oy+8, fh=16;
  R(g,ox,fy,24,fh,ext?"#141312":"#2c2b28"); R(g,ox,fy,24,1,ext?"#222120":"#4b4842");
  if(ext){ for(let k=3;k<24;k+=8) R(g,ox+k,fy+1,1,fh-1,"#0b0a0a"); return; }
  for(let k=0;k<24;k+=8){ R(g,ox+k,fy+1,1,fh-3,"#191816"); R(g,ox+k+1,fy+1,1,fh-3,"#3b3935"); }
  R(g,ox,fy+8,24,1,"#1f1e1b"); R(g,ox,oy+22,24,2,"#121110");
  const d=h%12;
  if(d===0){ R(g,ox+8,fy+2,8,2,"#5a4526"); R(g,ox+9,fy+4,6,1,"#3a2c18"); R(g,ox+10,fy+5,4,3,"#2a2015"); SOURCES.push({kind:"lamp",x,y:y+1,bx:ox+12,by:fy+6,emerg:h%3===0,ph:(h%628)/100,flick:h%4===0,r:6,i:1.05}); }
  else if(d===1||d===2){ R(g,ox,fy+3,24,3,"#3c3329"); R(g,ox,fy+3,24,1,"#56483a"); R(g,ox+(h>>4)%18,fy+2,3,5,"#1a1611"); if(d===2){ R(g,ox,fy+10,24,2,"#2e2419"); R(g,ox,fy+10,24,1,"#3f3224"); } }
  else if(d===3){ R(g,ox+7,fy+2,10,9,"#2b241b"); R(g,ox+7,fy+2,10,1,"#4a3d2a"); R(g,ox+7,fy+10,10,1,"#120f0b"); skull(g,ox+9+1,fy+4,"#b3a68c","#0b0908"); R(g,ox+9,fy+11,1,3,"#5a1812"); R(g,ox+15,fy+11,1,4,"#5a1812"); }
  else if(d===4){ R(g,ox+5,fy+3,14,9,"#0b0a08"); for(let k=0;k<4;k++) R(g,ox+5,fy+4+k*2,14,1,"#34302a"); }
  else if(d===5){ R(g,ox+3,fy,1,fh-2,"#2b1a12"); R(g,ox+5,fy,1,fh-4,"#3a2a14"); R(g,ox+18,fy+2,1,fh-4,"#14202a"); R(g,ox+19,fy+fh-3,3,1,"#14202a"); }
  else if(d===6){ for(let k=0;k<24;k++) R(g,ox+k,fy+fh-5,1,3,((k>>1)%2)?"#8a6a1e":"#0d0b08"); }
  else if(d===7){ const c=4+(h>>3)%14; R(g,ox+c,fy+2,2,1,"#6a140e"); R(g,ox+c+1,fy+3,1,6,"#5a100a"); R(g,ox+c+3,fy+3,3,1,"#6a140e"); R(g,ox+c+4,fy+4,1,4,"#5a100a"); R(g,ox+c-2,fy+6,1,5,"#4a0c08"); }
  else if(d===8){ R(g,ox+4,fy+2,16,9,"#0a120c"); R(g,ox+4,fy+2,16,1,"#2a3a2c"); for(let k=0;k<3;k++) R(g,ox+6,fy+4+k*2,4+((h>>k)%8),1,"#3f8a52"); SOURCES.push({kind:"screen",x,y:y+1,bx:ox+12,by:fy+6,r:2.6,i:.45,col:[.3,.9,.45]}); }
}
function drawWindow(g,x,y,t){
  const ox=x*TS, oy=y*TS, below=T(x,y+1).t, front=!(below==="wall"||below==="window");
  if(front){ wallCap(g,x,y,8); const fy=oy+8; R(g,ox,fy,24,16,"#3b2f1d"); R(g,ox,fy,24,1,"#5a4a2c"); R(g,ox+2,fy+2,20,11,"#05080b");
    for(let k=0;k<4;k++){ const v=hh(x,y,k+3); R(g,ox+3+v%18,fy+3+(v>>4)%9,1,1,"#8a9eb0"); }
    R(g,ox+11,fy+2,2,11,"#3b2f1d"); R(g,ox+3,fy+3,1,1,"#2f5560"); R(g,ox+4,fy+4,1,1,"#2f5560"); R(g,ox+15,fy+3,1,1,"#2f5560"); R(g,ox,oy+22,24,2,"#121110");
    if(t.hp===1){ R(g,ox+4,fy+5,4,1,"#d8e8ec"); R(g,ox+7,fy+6,3,1,"#d8e8ec"); R(g,ox+6,fy+7,1,3,"#d8e8ec"); R(g,ox+15,fy+4,1,4,"#d8e8ec"); R(g,ox+16,fy+8,3,1,"#d8e8ec"); }
  } else { wallCap(g,x,y,24); R(g,ox+7,oy,10,24,"#3b2f1d"); R(g,ox+9,oy+2,6,20,"#05080b"); R(g,ox+11,oy+6,1,1,"#8a9eb0"); R(g,ox+12,oy+15,1,1,"#8a9eb0"); R(g,ox+9,oy+3,1,1,"#2f5560");
    if(t.hp===1){ R(g,ox+11,oy+7,1,6,"#d8e8ec"); R(g,ox+12,oy+12,1,4,"#d8e8ec"); } }
}
function drawBreach(g,x,y){ drawSpace(g,x,y); const ox=x*TS, oy=y*TS;
  for(let k=0;k<24;k++){ const a=hh(x,y,k)%5, b=hh(x,y,k+40)%5; R(g,ox+k,oy,1,1+a,"#2a241d"); R(g,ox+k,oy+23-b,1,1+b,"#2a241d"); R(g,ox,oy+k,1+b,1,"#2a241d"); R(g,ox+23-a,oy+k,1+a,1,"#2a241d"); }
  R(g,ox+4,oy+3,3,1,"#4a3a24"); R(g,ox+16,oy+19,4,1,"#4a3a24"); }
function doorVert(x,y){ return isW(x,y-1)&&isW(x,y+1)&&!(isW(x-1,y)&&isW(x+1,y)); }
function drawDoor(g,x,y,t){
  const ox=x*TS, oy=y*TS, vert=doorVert(x,y);
  const nb=[[0,1],[0,-1],[1,0],[-1,0]].map(([a,b])=>[x+a,y+b]).find(([a,b])=>T(a,b).t==="floor");
  drawFloor(g,x,y,nb?styleAt(nb[0],nb[1]):null);
  if(!vert){
    if(t.open){ R(g,ox,oy,24,6,"#1c1b19"); R(g,ox,oy+5,24,1,"#4b4842"); R(g,ox,oy,3,24,"#33312d"); R(g,ox+21,oy,3,24,"#33312d"); R(g,ox,oy,1,24,"#6a6458"); R(g,ox+23,oy,1,24,"#6a6458"); R(g,ox+3,oy+6,18,3,"rgba(0,0,0,.45)");
      if(t.broken){ R(g,ox+5,oy+13,5,2,"#4a463f"); R(g,ox+13,oy+18,6,2,"#3a3732"); R(g,ox+16,oy+9,3,3,"#2a2825"); } return; }
    wallCap(g,x,y,8);
    const c=t.vault?"#5a4520":"#4a463f", ch=t.vault?"#7a5e2c":"#625d54";
    R(g,ox,oy+8,24,16,"#1c1b19"); R(g,ox+2,oy+8,10,16,c); R(g,ox+12,oy+8,10,16,c); R(g,ox+2,oy+8,10,1,ch); R(g,ox+12,oy+8,10,1,ch); R(g,ox+11,oy+8,2,16,"#0e0d0c");
    for(let k=2;k<22;k++) R(g,ox+k,oy+19,1,3,((k>>1)%2)?"#9a7a22":"#0e0c09");
    R(g,ox+4,oy+11,6,4,"#33302b"); R(g,ox+14,oy+11,6,4,"#33302b");
    if(t.vault){ disc(g,ox+12,oy+14,4,"#8a6a30"); disc(g,ox+12,oy+14,2,"#2a1f0e"); }
    R(g,ox,oy+8,2,16,"#33312d"); R(g,ox+22,oy+8,2,16,"#33312d"); R(g,ox,oy+22,24,2,"#121110");
  } else {
    if(t.open){ R(g,ox+4,oy,16,4,"#33312d"); R(g,ox+4,oy+20,16,4,"#33312d"); R(g,ox+4,oy,16,1,"#6a6458"); return; }
    R(g,ox+7,oy,10,24,"#4a463f"); R(g,ox+7,oy,1,24,"#625d54"); R(g,ox+7,oy+11,10,2,"#0e0d0c"); for(let k=0;k<24;k++) R(g,ox+15,oy+k,2,1,((k>>1)%2)?"#9a7a22":"#0e0c09");
  }
}
function drawConsole(g,x,y){ drawFloor(g,x,y,FL.Engineering); const ox=x*TS, oy=y*TS;
  R(g,ox+2,oy+3,20,19,"#2a2620"); R(g,ox+2,oy+3,20,6,"#3a352c"); R(g,ox+2,oy+3,20,1,"#554d3e"); R(g,ox+5,oy+10,14,6,"#070807");
  R(g,ox+5,oy+18,3,2,"#7a1a14"); R(g,ox+10,oy+18,3,2,"#7a6a1a"); R(g,ox+15,oy+18,4,1,"#151515"); R(g,ox+4,oy+5,4,2,"#9a7a22"); R(g,ox+22,oy+8,2,12,"#2b1a12"); }
function drawExtract(g,x,y){ drawFloor(g,x,y,FL["Docking bay"]); const ox=x*TS, oy=y*TS;
  const L=T(x-1,y).t!=="extract", Rr=T(x+1,y).t!=="extract", U=T(x,y-1).t!=="extract", D=T(x,y+1).t!=="extract";
  for(let k=0;k<24;k++){ const c=((k>>1)%2)?"#9a7420":"#100d08"; if(U) R(g,ox+k,oy+1,1,3,c); if(D) R(g,ox+k,oy+20,1,3,c); if(L) R(g,ox+1,oy+k,3,1,c); if(Rr) R(g,ox+20,oy+k,3,1,c); }
  if(!Rr&&!D) disc(g,ox+24,oy+24,6,"#5a4416"); if(!L&&!U) disc(g,ox,oy,6,"#5a4416"); if(!L&&!D) disc(g,ox,oy+24,6,"#5a4416"); if(!Rr&&!U) disc(g,ox+24,oy,6,"#5a4416"); }
function drawRitual(g,tx,ty){ const cx=tx*TS+TS, cy=ty*TS+TS, r=19, c="#6a120d";
  for(let a=0;a<360;a+=2){ const x=Math.round(cx+Math.cos(a*Math.PI/180)*r), y=Math.round(cy+Math.sin(a*Math.PI/180)*r); R(g,x,y,1,1,c); if(a%7===0) R(g,x,y+1,1,1,"#4a0c08"); }
  const pts=[0,1,2].map(k=>[cx+Math.cos((90+k*120)*Math.PI/180)*r, cy+Math.sin((90+k*120)*Math.PI/180)*r]);
  for(let k=0;k<3;k++){ const [x0,y0]=pts[k],[x1,y1]=pts[(k+1)%3], L=Math.hypot(x1-x0,y1-y0); for(let s=0;s<L;s++) R(g,Math.round(x0+(x1-x0)*s/L),Math.round(y0+(y1-y0)*s/L),1,1,c); }
  for(let k=0;k<6;k++){ const a=k*60*Math.PI/180; R(g,Math.round(cx+Math.cos(a)*(r+4)),Math.round(cy+Math.sin(a)*(r+4)),2,2,c); }
  disc(g,cx,cy,2,"#4a0c08"); }
function drawDebris(g,x,y,kind){ const ox=x*TS, oy=y*TS;
  disc(g,ox+12,oy+14,8,"#141210"); disc(g,ox+11,oy+13,6,"#1e1b18");
  for(let k=0;k<10;k++){ const v=hh(x,y,k+90); R(g,ox+4+v%16,oy+6+(v>>5)%14,1+(v>>9)%3,1,(v>>3)%3?"#2a2622":"#3a2a1e"); }
  if(kind==="barrel"){ R(g,ox+7,oy+10,10,2,"#3a2412"); R(g,ox+6,oy+15,4,2,"#2a1a0e"); R(g,ox+15,oy+16,3,2,"#2a1a0e"); }
  else { R(g,ox+6,oy+12,9,2,"#2a2017"); R(g,ox+12,oy+9,2,7,"#2a2017"); R(g,ox+14,oy+15,4,1,"#5a2a10"); } }
function makeConduit(){ const c=cvs(96,96), g=c.getContext("2d"); R(g,0,0,96,96,"#0a0a09"); let seed=11; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let i=0;i<16;i++){ let x=Math.floor(rnd()*24)*4, y=Math.floor(rnd()*24)*4, dir=rnd()<.5; const len=6+Math.floor(rnd()*12);
    for(let k=0;k<len;k++){ if(dir){ R(g,x%96,y%96,4,3,"#161513"); R(g,x%96,y%96,4,1,"#211f1c"); x+=4; } else { R(g,x%96,y%96,3,4,"#161513"); R(g,x%96,y%96,1,4,"#211f1c"); y+=4; } if(rnd()<.18) dir=!dir; }
    R(g,x%96,y%96,5,5,"#1b1916"); R(g,x%96,y%96,5,1,"#2a2723"); }
  for(let i=0;i<7;i++){ const x=Math.floor(rnd()*88), y=Math.floor(rnd()*88); R(g,x,y,8,6,"#121110"); R(g,x,y,8,1,"#24221f"); }
  return c; }

function buildStatic(){
  staticLayer.width=S.W*TS; staticLayer.height=S.H*TS; const g=staticLayer.getContext("2d"); SOURCES=[];
  AMB=new Float32Array(S.W*S.H*3);
  for(let y=0;y<S.H;y++)for(let x=0;x<S.W;x++){
    const t=S.tiles[Sim.idx(S,x,y)];
    switch(t.t){
      case "space": if(S.mode!=="ship") drawSpace(g,x,y); break;
      case "wall": drawWall(g,x,y); break;
      case "window": drawWindow(g,x,y,t); break;
      case "breach": drawBreach(g,x,y); break;
      case "door": drawDoor(g,x,y,t); break;
      case "console": drawConsole(g,x,y); break;
      case "extract": drawExtract(g,x,y); break;
      default: drawFloor(g,x,y); if(t.debris) drawDebris(g,x,y,t.debris);
    }
    if(t.t==="prop"){
      if(t.kind==="brazier") SOURCES.push({kind:"fire",x,y,bx:x*TS+12,by:y*TS+10,r:6.5,i:1.25,col:[1,.6,.28],ph:hh(x,y)%100});
      if(t.kind==="tank") SOURCES.push({kind:"tank",x,y,bx:x*TS+12,by:y*TS+4,r:3.2,i:.7,col:[.3,1,.6],ph:hh(x,y)%100});
      if(t.kind==="vending") SOURCES.push({kind:"term",x,y,bx:x*TS+10,by:y*TS-2,r:2.6,i:.6,col:[.5,.9,1]});
      if(t.kind==="arcade") SOURCES.push({kind:"term",x,y,bx:x*TS+12,by:y*TS-2,r:2.8,i:.7,col:[.9,.35,1]});
      if(t.kind==="coffee") SOURCES.push({kind:"term",x,y,bx:x*TS+16,by:y*TS+4,r:1.6,i:.4,col:[1,.4,.2]});
      if(t.kind==="generator") SOURCES.push({kind:"gen",x,y,bx:x*TS+5,by:y*TS+8,r:2.4,i:.5,col:[1,.55,.2],ph:0,powered:true});
    }
  }
  for(const d of S.decals||[]) if(d.type==="ritual") drawRitual(g,d.x,d.y);
  for(let y=0;y<S.H;y++)for(let x=0;x<S.W;x++){ const t=S.tiles[Sim.idx(S,x,y)]; if(t.t!=="terminal") continue;
    const L={navtable:[.3,.85,1,3.8],helm:[.3,.9,.9,3.2],board:[1,.7,.35,2.6],records:[1,.7,.3,2.2],airlock:[1,.2,.1,2.4],stash:[.3,1,.4,1.8],rack:[1,.75,.4,2],workbench:[1,.6,.25,2.2],wardrobe:[.9,.75,.5,1.6]}[t.kind];
    if(L) SOURCES.push({kind:"term",x,y,bx:x*TS+12,by:y*TS+4,r:L[3],i:.7,col:[L[0],L[1],L[2]],tk:t.kind}); }
  for(let y=0;y<S.H;y++)for(let x=0;x<S.W;x++){ const i=Sim.idx(S,x,y), t=S.tiles[i]; let c=null;
    if(t.t!=="wall"&&t.t!=="window"&&t.t!=="space") c=AMBC[Sim.roomName(x,y)]||AMBC._;
    else { let n=0,a=[0,0,0]; for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){ const tt=T(x+dx,y+dy).t; if(tt!=="wall"&&tt!=="window"&&tt!=="space"){ const cc=AMBC[Sim.roomName(x+dx,y+dy)]||AMBC._; a[0]+=cc[0];a[1]+=cc[1];a[2]+=cc[2];n++; } } c=n?a.map(v=>v/n):[.2,.21,.22]; }
    AMB[i*3]=c[0]; AMB[i*3+1]=c[1]; AMB[i*3+2]=c[2]; }
}
const tileKey=()=>S.tiles.map(t=>t.t[0]+(t.open?1:0)+(t.hp??"")+(t.broken?"b":"")).join("");

// ---------- lighting ----------
function computeLights(){
  const W=S.W, N=W*S.H, p=viewEnt();
  srcContrib=SOURCES.map(L=>{ const out=[], r=L.r, rr=Math.ceil(r);
    for(let y=Math.max(0,L.y-rr);y<=Math.min(S.H-1,L.y+rr);y++)for(let x=Math.max(0,L.x-rr);x<=Math.min(W-1,L.x+rr);x++){
      const d=Math.hypot(x-L.x,y-L.y); if(d>r) continue; if(!(x===L.x&&y===L.y)&&!Sim.los(S,L.x,L.y,x,y)) continue;
      out.push(Sim.idx(S,x,y), Math.pow(1-d/r,1.2)*L.i); }
    return out; });
  fireContrib=[];
  for(const k of Object.keys(S.fire||{})){ const i=+k, lv=S.fire[i], x0=i%W, y0=(i/W)|0, r=2.5+lv;
    for(let y=Math.max(0,Math.floor(y0-r));y<=Math.min(S.H-1,Math.ceil(y0+r));y++)for(let x=Math.max(0,Math.floor(x0-r));x<=Math.min(W-1,Math.ceil(x0+r));x++){
      const d=Math.hypot(x-x0,y-y0); if(d>r) continue; if(d>0&&!Sim.los(S,x0,y0,x,y)) continue; fireContrib.push(Sim.idx(S,x,y),(1-d/r)*(.45+.22*lv)); } }
  FLASH=new Float32Array(N); const [fx,fy]=p.face||[1,0];
  for(let i=0;i<N;i++){ if(!VIS[i]) continue; const x=i%W,y=(i/W)|0, dx=x-p.x, dy=y-p.y, d=Math.hypot(dx,dy);
    let v=0; if(d<2.6) v+=(1-d/2.6)*.35;
    if(d>0&&d<8.5){ const cos=(dx*fx+dy*fy)/d; if(cos>.72) v+=Math.pow(1-d/8.5,1.05)*.75*Math.min(1,(cos-.72)/.12); }
    FLASH[i]=v; }
}
const imgCache={};
function buildLightmap(cx,cy,now){
  const ox=Math.floor(cx/TS)-1, oy=Math.floor(cy/TS)-1, lw=Math.ceil(view.fw/TS)+3, lh=Math.ceil(view.fh/TS)+3, W=S.W, N=W*S.H;
  if(lm.width!==lw||lm.height!==lh||!imgCache.d){ lm.width=lw; lm.height=lh; imgCache.d=lctx.createImageData(lw,lh); }
  const Lr=new Float32Array(N), Lg=new Float32Array(N), Lb=new Float32Array(N), p=viewEnt(), pw=S.power;
  SOURCES.forEach((L,k)=>{
    let f=1, c=L.col||[1,.7,.4];
    if(L.kind==="lamp"){ if(pw){ if(L.flick){ const n=Math.sin(now*.013+L.ph*7)+Math.sin(now*.031+L.ph); if(n>1.55) f=.25; } if(powerFlicker>0) f*=Math.random()<.5?.15:1; c=[1,.72,.42]; }
      else if(L.emerg){ f=.6*(.55+.45*Math.sin(now*.003+L.ph)); c=[1,.12,.06]; } else f=0; }
    else if(L.kind==="screen"||L.kind==="gen"){ if(!pw) f=0; }
    else if(L.kind==="fire"){ f=.82+.18*Math.sin(now*.02+L.ph)+.08*Math.sin(now*.053+L.ph*3); }
    else if(L.kind==="tank"){ f=.85+.15*Math.sin(now*.002+L.ph); }
    L.lit=f; if(!f) return; const arr=srcContrib[k]; if(!arr) return;
    for(let j=0;j<arr.length;j+=2){ const i=arr[j], v=arr[j+1]*f; Lr[i]+=v*c[0]; Lg[i]+=v*c[1]; Lb[i]+=v*c[2]; }
  });
  { const fl=.85+.15*Math.sin(now*.025)+.06*Math.sin(now*.067); for(let j=0;j<fireContrib.length;j+=2){ const i=fireContrib[j], v=fireContrib[j+1]*fl; Lr[i]+=v; Lg[i]+=v*.5; Lb[i]+=v*.16; } }
  for(const l of lightsT){ const a=1-l.t/l.dur; if(a<=0) continue;
    for(let y=Math.max(0,Math.floor(l.y-l.r));y<=Math.min(S.H-1,Math.ceil(l.y+l.r));y++)for(let x=Math.max(0,Math.floor(l.x-l.r));x<=Math.min(W-1,Math.ceil(l.x+l.r));x++){
      const d=Math.hypot(x-l.x,y-l.y); if(d>l.r) continue; const v=(1-d/l.r)*l.i*a, i=Sim.idx(S,x,y); Lr[i]+=v*l.c[0]; Lg[i]+=v*l.c[1]; Lb[i]+=v*l.c[2]; } }
  const d=imgCache.d.data, am=pw?1:.33;
  for(let j=0;j<lh;j++)for(let i=0;i<lw;i++){
    const x=ox+i, y=oy+j, o=(j*lw+i)*4; let r=0,g=0,b=0;
    if(x>=0&&y>=0&&x<W&&y<S.H){ const k=y*W+x, t=S.tiles[k];
      if(p.seen[k]){
        if(VIS[k]){ const fl=FLASH[k]||0; r=AMB[k*3]*am+Lr[k]+fl*.8; g=AMB[k*3+1]*am+Lg[k]+fl*.85; b=AMB[k*3+2]*am+Lb[k]+fl*.95;
          if(t.t==="space"||t.t==="window"||t.t==="breach"){ r+=.35; g+=.38; b+=.45; }
          if(t.t==="console"){ r+=pw?.12:.3; g+=pw?.35:.05; b+=pw?.15:.03; }
          if(t.t==="extract"){ const bl=(Math.sin(now*.004)+1)/2; r+=.22*bl; g+=.13*bl; b+=.03*bl; } }
        else { r=AMB[k*3]*.26; g=AMB[k*3+1]*.27; b=AMB[k*3+2]*.3; if(t.t==="space"){ r=.2; g=.21; b=.26; } }
      } else if(t.t==="space"){ r=.2; g=.21; b=.26; }
      if(S.mode==="ship"&&t.t==="space"){ r=g=b=1; }
    } else { r=.24; g=.25; b=.3; if(S.mode==="ship"){ r=g=b=1; } }
    d[o]=Math.min(255,r*255); d[o+1]=Math.min(255,g*255); d[o+2]=Math.min(255,b*255); d[o+3]=255;
  }
  lctx.putImageData(imgCache.d,0,0);
  return {ox,oy,lw,lh};
}

// ---------- effects ----------
function spawn(n,x,y,o){ for(let i=0;i<n;i++){ const a=(o.dir??Math.random()*6.283)+(Math.random()-.5)*(o.spread??6.283), sp=(o.speed||50)*(.4+Math.random()*.8);
  parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:(o.life||.4)*(.6+Math.random()*.6),max:o.life||.4,col:o.col[i%o.col.length],size:o.size||1,emit:!!o.emit,drag:o.drag??3}); } }
const cpx=v=>v*TS+12;
// Fixture effects; also played when a crewmate uses something (net.js "fx" message).
function flavorFx(kind,x,y,local){
  if(!S||S.mode!=="ship"||!Number.isFinite(x)||!Number.isFinite(y)) return; const now=performance.now(); flavorT[kind]=now;
  if(kind==="coffee") spawn(10,cpx(x)+3,y*TS+2,{col:["rgba(220,220,220,.5)","rgba(180,180,180,.4)"],speed:12,life:1.2,dir:-1.57,spread:.8,drag:.6});
  if(kind==="toilet") spawn(10,cpx(x),cpx(y),{col:["#9ac0c4","#6a8a8e"],speed:25,life:.6});
  if(kind==="vending") spawn(6,cpx(x),cpx(y)+4,{col:["#c9a24a","#ffffff"],speed:20,life:.5,emit:true});
  if(kind==="bars"||kind==="captive"){ flavorT.captive=now; if(local) shake=Math.max(shake,1.5); spawn(6,cpx(x),cpx(y),{col:["#8a8a80","#c9c0a8"],speed:30,life:.3,emit:true}); }
  if(kind==="arcade") spawn(8,cpx(x),y*TS-6,{col:["#e04030","#62cfe0","#e8b048"],speed:30,life:.4,emit:true});
}
function processFx(){
  const p=me(), now=performance.now();
  for(const f of S.fx||[]){
    const vis=()=>VIS&&VIS[Sim.idx(S,f.x,f.y)];
    switch(f.type){
      case "shot": { const x0=cpx(f.x0),y0=cpx(f.y0)-6; let x1=cpx(f.x1),y1=cpx(f.y1)-6; const a=Math.atan2(y1-y0,x1-x0);
        if(f.what==="wall"){ x1-=Math.cos(a)*12; y1-=Math.sin(a)*12; }
        const mx=x0+Math.cos(a)*12, my=y0+Math.sin(a)*12;
        tracers.push({x0:mx,y0:my,x1,y1,t:0,dur:.09});
        spawn(6,mx,my,{col:["#fff2b0","#ffc050"],speed:90,life:.12,dir:a,spread:.9,emit:true});
        lightsT.push({x:f.x0,y:f.y0,r:5,i:1.3,c:[1,.78,.42],t:0,dur:.13});
        if(f.what==="wall") spawn(10,x1,y1,{col:["#ffd070","#ff9a30","#fff"],speed:80,life:.25,dir:a+Math.PI,spread:2.2,emit:true});
        if(f.what==="flesh") spawn(16,x1,y1,{col:["#5a0e0a","#8a1a12","#3a0806"],speed:60,life:.55,dir:a,spread:1.6,size:2});
        if(f.what==="glass") spawn(14,x1,y1,{col:["#cfe8ee","#7ab0bc","#ffffff"],speed:70,life:.5});
        if(f.x0===p.x&&f.y0===p.y) shake=Math.max(shake,1.5); break; }
      case "hurt": flashT[f.id]=now; if(f.id===PID){ hurtFlash=1; shake=Math.max(shake,5); } break;
      case "die": spawn(26,cpx(f.x),cpx(f.y),{col:["#5a0e0a","#7a140e","#2a0504"],speed:45,life:.7,size:2}); break;
      case "breach": spawn(34,cpx(f.x),cpx(f.y),{col:["#cfe8ee","#7ab0bc","#4a3a24","#fff"],speed:120,life:.8}); lightsT.push({x:f.x,y:f.y,r:5,i:1.2,c:[.8,.9,1],t:0,dur:.25}); shake=Math.max(shake,9); break;
      case "glass": spawn(10,cpx(f.x),cpx(f.y),{col:["#cfe8ee","#7ab0bc"],speed:50,life:.4}); break;
      case "bash": if(vis()){ spawn(8,cpx(f.x),cpx(f.y),{col:["#6a5f50","#3a332a"],speed:35,life:.5}); shake=Math.max(shake,1.2); } break;
      case "claw": slashes.push({x:f.x,y:f.y,t:0,dur:.28}); atkT[f.id]=now; break;
      case "melee": spawn(7,cpx(f.x),cpx(f.y)-6,{col:["#5a0e0a","#8a1a12"],speed:40,life:.35,size:2}); shake=Math.max(shake,1.5); break;
      case "spaced": spawn(18,cpx(f.x),cpx(f.y),{col:["#5a0e0a","#a39379"],speed:90,life:.6,size:2}); break;
      case "power": powerFlicker=.7; break;
      case "throw": arcs.push({x0:cpx(f.x0),y0:cpx(f.y0)-8,x1:cpx(f.x1),y1:cpx(f.y1),t:0,dur:.35,d:f.d}); break;
      case "decoy": spawn(14,cpx(f.x),cpx(f.y),{col:["#e8b048","#ffffff"],speed:40,life:.6,emit:true}); rings.push({x:cpx(f.x),y:cpx(f.y),t:0,dur:.6}); break;
      case "legend": { const c=Items.RAR[f.r].col; spawn(30,cpx(f.x),cpx(f.y)-6,{col:[c,"#ffffff",c],speed:70,life:.9,emit:true}); lightsT.push({x:f.x,y:f.y,r:4,i:1.4,c:[1,.85,.5],t:0,dur:.6}); shake=Math.max(shake,2); break; }
      case "flavor": if(f.pid===PID&&typeof onFlavor==="function") setTimeout(()=>onFlavor(f.kind,f.x,f.y),0); flavorFx(f.kind,f.x,f.y,true); break;
      case "sit": if(f.pid===PID&&typeof onSit==="function") setTimeout(()=>onSit(f.kind),0); break;
      case "terminal": if(f.pid===PID&&typeof onTerminal==="function") setTimeout(()=>onTerminal(f.kind),0); break;
      case "explode": spawn(46,cpx(f.x),cpx(f.y),{col:["#fff0b0","#ffb040","#ff6a20","#c02a10"],speed:150,life:.6,size:2,emit:true}); spawn(30,cpx(f.x),cpx(f.y),{col:["#2a2420","#3a3430","#1a1614"],speed:90,life:1.1,size:2});
        lightsT.push({x:f.x,y:f.y,r:7,i:2.2,c:[1,.7,.35],t:0,dur:.45}); rings.push({x:cpx(f.x),y:cpx(f.y),t:0,dur:.35}); shake=Math.max(shake,13); break;
      case "cookoff": spawn(10,cpx(f.x),cpx(f.y),{col:["#ffe080","#fff"],speed:110,life:.2,emit:true}); lightsT.push({x:f.x,y:f.y,r:3,i:1,c:[1,.8,.4],t:0,dur:.1}); break;
      case "flare": spawn(24,cpx(f.x),cpx(f.y),{col:["#ffffff","#cfe8ff","#ffd080"],speed:80,life:.5,emit:true}); lightsT.push({x:f.x,y:f.y,r:6,i:1.8,c:[1,1,.9],t:0,dur:.4}); shake=Math.max(shake,4); break;
    }
  }
  S.fx=[];
}
function updateFx(dt,now){
  for(const q of parts){ q.x+=q.vx*dt; q.y+=q.vy*dt; const k=Math.exp(-q.drag*dt); q.vx*=k; q.vy*=k; q.life-=dt; }
  parts=parts.filter(q=>q.life>0); if(parts.length>700) parts.splice(0,parts.length-700);
  for(const a of [tracers,slashes,lightsT,rings,arcs]) for(const q of a) q.t+=dt;
  rings=rings.filter(q=>q.t<q.dur); arcs=arcs.filter(q=>q.t<q.dur); tracers=tracers.filter(q=>q.t<q.dur); slashes=slashes.filter(q=>q.t<q.dur); lightsT=lightsT.filter(q=>q.t<q.dur);
  shake=Math.max(0,shake-dt*22); hurtFlash=Math.max(0,hurtFlash-dt*2.4); powerFlicker=Math.max(0,powerFlicker-dt);
  const cx=Math.floor(camX/TS), cy=Math.floor(camY/TS), x1=cx+Math.ceil(view.fw/TS)+1, y1=cy+Math.ceil(view.fh/TS)+1;
  for(let y=Math.max(0,cy);y<Math.min(S.H,y1);y++)for(let x=Math.max(0,cx);x<Math.min(S.W,x1);x++){
    const i=Sim.idx(S,x,y); if(!VIS[i]) continue; const t=S.tiles[i];
    if(S.wind&&S.windStr){ const j=S.wind[i], st=S.windStr[i];
      if(j>=0&&st>=2&&Math.random()<Math.min(.5,st/45)*dt*30){ const dx=(j%S.W)-x, dy=((j/S.W)|0)-y, sp=80+st*6;
        parts.push({x:x*TS+Math.random()*24,y:y*TS+Math.random()*24,vx:dx*sp,vy:dy*sp,life:.3,max:.3,col:"rgba(190,210,220,.55)",size:1,emit:false,drag:0}); } }
    const fl=S.fire&&S.fire[i];
    if(fl){ if(Math.random()<dt*(5+fl*4)) parts.push({x:x*TS+4+Math.random()*16,y:y*TS+8,vx:(Math.random()-.5)*14,vy:-26-Math.random()*20,life:.7,max:.7,col:Math.random()<.5?"#ffb040":"#ff5a18",size:1,emit:true,drag:.4});
      if(Math.random()<dt*(2+fl*2)) parts.push({x:x*TS+6+Math.random()*12,y:y*TS,vx:(Math.random()-.5)*10,vy:-14-Math.random()*8,life:1.6,max:1.6,col:Math.random()<.5?"rgba(40,36,34,.55)":"rgba(70,64,60,.4)",size:3,emit:false,drag:.2}); }
    if(t.t==="prop"&&t.kind==="brazier"&&Math.random()<dt*14) parts.push({x:x*TS+8+Math.random()*8,y:y*TS+10,vx:(Math.random()-.5)*8,vy:-18-Math.random()*14,life:.6,max:.6,col:Math.random()<.5?"#ffb040":"#ff6a20",size:1,emit:true,drag:.5});
    if(t.t==="prop"&&t.kind==="tank"&&Math.random()<dt*3) parts.push({x:x*TS+8+Math.random()*7,y:y*TS+4,vx:0,vy:-10,life:.9,max:.9,col:"#9ae8c0",size:1,emit:true,drag:0,clipY:y*TS-14});
  }
}

// ---------- dynamic drawing ----------
function drawBlood(g,x,y,n,ox,oy){ for(let k=0;k<n;k++){ const v=hh(x,y,k+300), r=2+(v>>7)%3+(n>3?1:0), cx=ox+5+v%14, cy=oy+5+(v>>5)%14;
  disc(g,cx,cy,r,"#4a0a07"); disc(g,cx-1,cy-1,Math.max(1,r-2),"#6a140e"); R(g,cx-r+1,cy-1,1,1,"#8e2216"); } }
function drawEnt(g,e,x,y,now){
  if(e.downed){ const t=now/400; g.drawImage(CORPSE.player,x,y+6); g.strokeStyle=`rgba(224,72,47,${.5+.4*Math.sin(t*3)})`; g.lineWidth=1; g.beginPath(); g.ellipse(x+12,y+16,10+Math.sin(t*3),5,0,0,6.283); g.stroke(); return; }
  const isP=e.kind==="player", set=isP?playerFrames(lookOf(e)):CH.husk, r=rp[e.id];
  const moving=r&&(Math.abs(r.x-e.x*TS)>.6||Math.abs(r.y-e.y*TS)>.6);
  let k=moving?(((now/110)|0)%2?"walk1":"walk2"):(((now/(isP?650:420)+(isP?0:e.x*.37))|0)%2?"idle1":"idle0");
  if(!isP&&atkT[e.id]&&now-atkT[e.id]<260) k="lunge";
  if(flashT[e.id]&&now-flashT[e.id]<110) k+="W";
  if(e.face&&e.face[0]) dirH[e.id]=e.face[0]; const left=(dirH[e.id]??1)<0;
  if(isP&&S.mode==="ship"&&T(e.x,e.y).t==="seat"&&r&&Math.abs(r.x-e.x*TS)<1&&Math.abs(r.y-e.y*TS)<1) y+=3;
  g.fillStyle="rgba(0,0,0,.45)"; g.fillRect(x+6,y+21,12,2); g.fillRect(x+7,y+23,10,1);
  const spr=set[k];
  if(left){ g.save(); g.translate(x+24,y-8); g.scale(-1,1); g.drawImage(spr,0,0); g.restore(); } else g.drawImage(spr,x,y-8);
  if(Object.keys(e.bleed||{}).length&&((now/300+x)%3)<1) R(g,x+12,y+22,1,1,"#9a1a12");
}
function drawProp(g,t,x,y,now){
  if(t.kind==="captive"){ const lunge=flavorT.captive&&now-flavorT.captive<700, k=lunge?"lunge":(((now/380)|0)%2?"idle1":"idle0"), sp=CH.husk[k], left=((now/2600)|0)%2===0;
    R(g,x+4,y+21,16,2,"rgba(0,0,0,.5)"); R(g,x+2,y+18,1,5,"#4a4842"); R(g,x+3,y+18,6,1,"#4a4842");
    if(left){ g.save(); g.translate(x+24+(lunge?0:0),y-8-(lunge?2:0)); g.scale(-1,1); g.drawImage(sp,0,0); g.restore(); } else g.drawImage(sp,x,y-8-(lunge?2:0)); return; }
  const s=PROP[t.kind]; if(!s) return; g.drawImage(s,x,y+24-s.height);
  if(t.kind==="arcade"){ const f=(now/120)|0; for(let k=0;k<6;k++) R(g,x+7+((k*5+f)%10),y+24-34+8+((k*3+f*2)%8),1,1,["#e04030","#62cfe0","#e8b048","#9bc06a"][k%4]); R(g,x+7+(f%10),y+24-34+15,2,1,"#ffffff"); }
  if(t.kind==="vending"&&((now/1300)|0)%2) R(g,x+17,y+24-34+9,1,1,"#c8ffd0");
  if(t.kind==="coffee"&&((now/900)|0)%2) R(g,x+15,y+24-28+8,2,2,"#ff7050");
  if(t.kind==="shower"&&flavorT.shower&&now-flavorT.shower<2500) for(let k=0;k<10;k++) R(g,x+9+((k*7+((now/40)|0))%7),y+24-34+8+((k*11+((now/30)|0))%20),1,2,"#9ad0e0");
  if(t.kind==="brazier"){ for(let k=0;k<7;k++){ const fx=x+6+((k*5+((now/70)|0))%12), h=3+((k*7+((now/90)|0))%6); R(g,fx,y+11-h,1,h,k%3?"#ff8a20":"#ffd060"); R(g,fx,y+11-h,1,1,"#fff0b0"); } }
  if(t.kind==="generator"&&S.power&&(now%800)<400) R(g,x+18,y+6+14,2,1,"#5ad06a");
}
function drawUI(g,cx,cy,now){
  const p=me();
  const corners=(tx,ty,c)=>{ const x=tx*TS-cx, y=ty*TS-cy; for(const [a,b,dx,dy] of [[0,0,1,1],[23,0,-1,1],[0,23,1,-1],[23,23,-1,-1]]){ for(let s=0;s<4;s++){ R(g,x+a+dx*s,y+b,1,1,c); R(g,x+a,y+b+dy*s,1,1,c); } } };
  const lof=(tx,ty,c)=>{ const x0=p.x*TS+12, y0=p.y*TS+6, x1=tx*TS+12, y1=ty*TS+8, L=Math.hypot(x1-x0,y1-y0); for(let s=14;s<L-8;s+=4) R(g,Math.round(x0+(x1-x0)*s/L-cx),Math.round(y0+(y1-y0)*s/L-cy),1,1,c); };
  if(typeof drawPings==="function") drawPings(g,cx,cy,now);
  for(const a of arcs){ const t=a.t/a.dur, X=a.x0+(a.x1-a.x0)*t, Y=a.y0+(a.y1-a.y0)*t-Math.sin(t*Math.PI)*22; R(g,Math.round(X-cx)-1,Math.round(Y-cy)-1,3,3,"#2a3018"); R(g,Math.round(X-cx),Math.round(Y-cy)-1,1,1,"#e0c040"); }
  if(throwMode&&S.mode==="raid"){ const it=me().inv[throwMode.index], st=it&&Items.stats(it); if(st){ const tx=hover?hover.x:p.x, ty=hover?hover.y:p.y, ok=Math.hypot(tx-p.x,ty-p.y)<=6.5&&Sim.los(S,p.x,p.y,tx,ty);
    g.strokeStyle="rgba(232,176,72,.35)"; g.lineWidth=1; g.beginPath(); g.arc(p.x*TS+12-cx,p.y*TS+12-cy,6.5*TS,0,6.283); g.stroke();
    const rad=(st.blast||st.fire||st.stunr||(st.noise?2:1))*TS; g.strokeStyle=ok?"rgba(224,72,47,.9)":"rgba(120,120,120,.6)"; g.beginPath(); g.arc(tx*TS+12-cx,ty*TS+12-cy,rad,0,6.283); g.stroke(); } }
  if(travel&&travel.path) for(let i=travel.i;i<travel.path.length;i++){ const [x,y]=travel.path[i]; R(g,x*TS+11-cx,y*TS+11-cy,2,2,"rgba(214,204,182,.55)"); }
  const tg=mode==="touch"?target:(hover&&targetable(hover.x,hover.y)?hover:null);
  if(tg&&targetable(tg.x,tg.y)){ const c=mode==="touch"?((now%600)<300?"#ff5a3a":"#a8301f"):"#e8b048"; lof(tg.x,tg.y,"rgba(232,176,72,.75)"); corners(tg.x,tg.y,c); }
  else if(mode==="pc"&&hover&&S.status==="playing"){
    const path=pathTo(hover.x,hover.y);
    if(path){ for(const [x,y] of path.slice(0,40)) R(g,x*TS+11-cx,y*TS+11-cy,2,2,"rgba(130,190,170,.45)"); corners(hover.x,hover.y,"rgba(130,190,170,.85)"); }
    else if(hover.x>=0&&hover.y>=0&&hover.x<S.W&&hover.y<S.H&&p.seen[Sim.idx(S,hover.x,hover.y)]) corners(hover.x,hover.y,"rgba(140,130,110,.4)");
  }
}

function render(now){
  if(!S) return;
  const dt=Math.min(.05,(now-lastT)/1000); lastT=now; const p=viewEnt();
  for(const e of S.ents){ const tx=e.x*TS, ty=e.y*TS, r=rp[e.id]||(rp[e.id]={x:tx,y:ty});
    if(Math.abs(r.x-tx)>72||Math.abs(r.y-ty)>72){ r.x=tx; r.y=ty; } const step=dt*TS*8; r.x+=Math.max(-step,Math.min(step,tx-r.x)); r.y+=Math.max(-step,Math.min(step,ty-r.y)); }
  const pr=rp[p.id]||rp[PID], fw=view.fw, fh=view.fh, mw=S.W*TS, mh=S.H*TS;
  let tx=pr.x+12-fw/2, ty=pr.y+12-fh*(mode==="touch"?.42:.5);
  tx=mw>fw?Math.max(-TS*2,Math.min(mw-fw+TS*2,tx)):(mw-fw)/2;
  ty=Math.max(-fh*.3,Math.min(mh-fh*.7,ty));
  if(!camInit){ camX=tx; camY=ty; camInit=true; } const ck=1-Math.exp(-dt*8); camX+=(tx-camX)*ck; camY+=(ty-camY)*ck;
  updateFx(dt,now);
  const cx=Math.round(camX), cy=Math.round(camY), g=fctx;
  g.imageSmoothingEnabled=false; g.globalCompositeOperation="source-over"; g.globalAlpha=1;
  g.fillStyle="#000"; g.fillRect(0,0,fw,fh);
  if(S.mode==="ship"){
    if(warp){ const t=(now-warp.start)/warp.dur; R(g,0,0,fw,fh,"#02040a"); const ccx=fw*.5, ccy=fh*.45;
      for(let k=0;k<160;k++){ const a=hh(k,3,1)%6283/1000, sp=.3+(hh(k,5,2)%100)/100, d=((t*sp*3+(hh(k,7,3)%100)/100)%1), r0=d*Math.hypot(fw,fh)*.6, r1=r0+10+d*60;
        g.strokeStyle=`rgba(${170+d*80|0},${200+d*50|0},255,${Math.min(1,d*1.6)})`; g.lineWidth=1; g.beginPath(); g.moveTo(ccx+Math.cos(a)*r0,ccy+Math.sin(a)*r0); g.lineTo(ccx+Math.cos(a)*r1,ccy+Math.sin(a)*r1); g.stroke(); }
      if(t>=1){ const dn=warp.done; warp=null; shake=Math.max(shake,4); dn&&dn(); } else shake=Math.max(shake,1.2); }
    else if(typeof shipScene==="function"){ g.drawImage(backdrop(shipScene(),fw,fh),0,0); }
  }
  g.drawImage(staticLayer,-cx,-cy);
  const x0=Math.max(0,Math.floor(cx/TS)), y0=Math.max(0,Math.floor(cy/TS)), x1=Math.min(S.W-1,Math.floor((cx+fw)/TS)), y1=Math.min(S.H-1,Math.floor((cy+fh)/TS)+1);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const i=Sim.idx(S,x,y), t=S.tiles[i], ox=x*TS-cx, oy=y*TS-cy; if(!p.seen[i]) continue;
    if(S.scorch&&S.scorch[i]&&t.t!=="space"&&t.t!=="wall"){ for(let k=0;k<5;k++){ const v=hh(x,y,k+400); disc(g,ox+5+v%14,oy+5+(v>>5)%14,3+(v>>8)%3,"rgba(12,10,8,.5)"); } }
    if(S.blood[i]&&t.t!=="space") drawBlood(g,x,y,S.blood[i],ox,oy);
    if(t.t==="console") R(g,ox+5,oy+10,14,6,S.power?(((now/90)|0)%7?"#1d5a2a":"#2a7a3a"):"#4a0e0a");
    if(t.t==="door"&&!t.open){ const c=!S.power?"#2a1a10":(t.locked?"#e04030":"#5ad06a"); if(doorVert(x,y)) R(g,ox+11,oy+3,2,2,c); else R(g,ox+20,oy+10,2,2,c); }
  }
  for(const e of S.ents){ if(e.alive||e.extracted||e.spaced) continue; const i=Sim.idx(S,e.x,e.y); if(p.seen[i]) g.drawImage(CORPSE[e.kind],e.x*TS-cx,e.y*TS-cy+6); }
  for(const it of S.items){ const i=Sim.idx(S,it.x,it.y); if(!VIS[i]) continue; const x=it.x*TS-cx+4, y=it.y*TS-cy+5; g.fillStyle="rgba(0,0,0,.5)"; g.fillRect(x+3,y+14,10,1); const rr=Items.rarOf(it); if(rr>=1){ g.fillStyle=Items.RAR[rr].col+"55"; g.fillRect(x+2,y+13,12,2); } itemIcon(g,it,x,y,(now%900)<450); if(((now/1000+it.id*.37)%2.6)<.12) R(g,x+5+((it.id*3)%6),y+6,1,1,"#fff"); }
  // y-sorted props + characters
  const draws=[];
  for(let y=y0;y<=Math.min(S.H-1,y1+1);y++)for(let x=x0;x<=x1;x++){ const i=Sim.idx(S,x,y), t=S.tiles[i]; if(t.t==="prop"&&p.seen[i]) draws.push({y:y*TS,f:()=>drawProp(g,t,x*TS-cx,y*TS-cy,now)});
    if(t.t==="seat"){ draws.push({y:y*TS-1,f:()=>g.drawImage(SEAT,x*TS-cx,y*TS-cy)}); draws.push({y:y*TS+1,f:()=>g.drawImage(SEAT_BACK[t.kind]||SEAT_BACK.nav,x*TS-cx,y*TS-cy+12)}); }
    if(t.t==="terminal"&&t.kind==="navtable"&&T(x-1,y).t==="terminal"&&T(x-1,y).kind==="navtable") continue;
    if(t.t==="terminal") draws.push({y:y*TS,f:()=>{ const sp=TERM[t.kind], ox=x*TS-cx, oy=y*TS-cy; g.drawImage(sp,ox,oy+24-sp.height); if(t.kind==="helm"&&((now/400)|0)%2) R(g,ox+16,oy+5,1,1,"#e8ffff"); if(t.kind==="airlock"&&((now/700)|0)%2) R(g,ox+9,oy+7,6,1,"#ff8060"); }}); }
  for(const e of S.ents){ if(!e.alive) continue; const i=Sim.idx(S,e.x,e.y); if(!(VIS[i]||e.id===PID)) continue; const r=rp[e.id]; draws.push({y:r.y+.5,f:()=>drawEnt(g,e,Math.round(r.x)-cx,Math.round(r.y)-cy,now)}); }
  draws.sort((a,b)=>a.y-b.y).forEach(d=>d.f());
  for(const q of parts) if(!q.emit){ g.fillStyle=q.col; g.fillRect(Math.round(q.x-cx),Math.round(q.y-cy),q.size,q.size); }
  for(const s of slashes){ const ox=s.x*TS-cx, oy=s.y*TS-cy-6, a=1-s.t/s.dur; g.fillStyle=`rgba(230,40,30,${a})`; for(let k=0;k<3;k++) for(let j=0;j<10;j++) g.fillRect((ox+5+k*5+j*.6)|0,oy+4+j,1,1); }
  // lighting
  const L=buildLightmap(cx,cy,now);
  g.save(); g.imageSmoothingEnabled=true; g.globalCompositeOperation="multiply"; g.drawImage(lm,0,0,L.lw,L.lh,L.ox*TS-cx,L.oy*TS-cy,L.lw*TS,L.lh*TS); g.restore();
  // unexplored: dark machinery
  if(!conduit){ conduit=makeConduit(); conduitPat=g.createPattern(conduit,"repeat"); }
  try{ conduitPat.setTransform(new DOMMatrix().translate(-cx,-cy)); }catch(e){}
  g.fillStyle=conduitPat; g.globalAlpha=S.mode==="ship"?0:.4;
  const gx0=Math.floor(cx/TS)-1, gy0=Math.floor(cy/TS)-1, gx1=Math.ceil((cx+fw)/TS), gy1=Math.ceil((cy+fh)/TS);
  for(let y=gy0;y<=gy1;y++)for(let x=gx0;x<=gx1;x++){ const off=x<0||y<0||x>=S.W||y>=S.H; if(off||!p.seen[Sim.idx(S,x,y)]) g.fillRect(x*TS-cx,y*TS-cy,TS,TS); }
  g.globalAlpha=1;
  // flames (self-lit)
  for(const k of Object.keys(S.fire||{})){ const i=+k; if(!VIS[i]) continue; const lv=S.fire[i], x=i%S.W, y=(i/S.W)|0, ox=x*TS-cx, oy=y*TS-cy;
    for(let c=0;c<6+lv*2;c++){ const fx2=ox+3+((c*7+hh(x,y,c))%18), ph=(now/80+c*1.7+x)|0, hgt=4+lv*3+((ph*13+c*5)%(5+lv*2)), base=oy+20-((c*3)%5);
      R(g,fx2,base-hgt,2,hgt,"#c22a0c"); R(g,fx2,base-hgt+2,2,Math.max(1,hgt-4),"#ff6a18"); R(g,fx2,base-Math.floor(hgt*.55),1,Math.max(1,Math.floor(hgt*.4)),"#ffc040"); R(g,fx2,base-hgt,1,1,"#fff0a0"); } }
  // glow
  g.save(); g.globalCompositeOperation="lighter";
  const glow=(x,y,r,c)=>{ const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,c); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2); };
  for(const Lp of SOURCES){ if(!Lp.lit) continue; const i=Sim.idx(S,Lp.x,Lp.y); if(!VIS[i]) continue; const bx=Lp.bx-cx, by=Lp.by-cy;
    if(Lp.kind==="lamp"){ if(S.power){ glow(bx,by,16,`rgba(255,180,90,${.35*Lp.lit})`); R(g,bx-2,by-1,4,2,`rgba(255,225,160,${Lp.lit})`); } else { glow(bx,by,14,`rgba(255,40,20,${.45*Lp.lit})`); R(g,bx-2,by-1,4,2,`rgba(255,60,40,${Lp.lit})`); } }
    else if(Lp.kind==="fire") glow(bx,by,22,`rgba(255,140,50,${.3*Lp.lit})`);
    else if(Lp.kind==="tank") glow(bx,by+10,14,`rgba(80,255,160,${.18*Lp.lit})`);
    else if(Lp.kind==="screen") glow(bx,by,10,"rgba(80,220,110,.16)");
    else if(Lp.kind==="term"&&Lp.tk==="navtable"){ const ox=Lp.x*TS-cx, oy=Lp.y*TS-cy; if(T(Lp.x-1,Lp.y).kind==="navtable") continue;
      const hx=ox+24, hy=oy-6; glow(hx,hy+8,30,"rgba(80,220,255,.16)"); g.fillStyle="rgba(90,208,208,.12)"; g.beginPath(); g.moveTo(ox+6,oy+9); g.lineTo(ox+42,oy+9); g.lineTo(ox+34,oy-16); g.lineTo(ox+14,oy-16); g.fill();
      const a0=now/2400; World.LOCS.forEach((l,i)=>{ const a=a0+i*0.698, rx=14+(i%3)*2, px=hx+Math.cos(a)*rx, py=hy-2+Math.sin(a)*rx*.35-(i%3)*3; const col=l.type==="station"?"#76c2c4":l.type==="outpost"?"#c79a4a":"#e0482f"; R(g,Math.round(px),Math.round(py),2,2,col); });
      R(g,hx-1,hy-3,3,3,"#e8f8ff"); }
    else if(Lp.kind==="term") glow(bx,by,12,`rgba(${Lp.col[0]*255|0},${Lp.col[1]*255|0},${Lp.col[2]*255|0},.22)`); }
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){ const i=Sim.idx(S,x,y), t=S.tiles[i]; if(!VIS[i]) continue; const ox=x*TS-cx, oy=y*TS-cy;
    if(t.t==="console") glow(ox+12,oy+13,12,S.power?"rgba(60,200,90,.25)":"rgba(220,40,20,.3)");
    if(t.t==="door"&&!t.open&&S.power){ const v=doorVert(x,y); glow(v?ox+12:ox+21,v?oy+4:oy+11,4,t.locked?"rgba(255,60,40,.55)":"rgba(80,220,100,.45)"); }
    if(t.t==="extract"&&(now%1400)<700) glow(ox+12,oy+12,10,"rgba(255,160,50,.16)"); }
  for(const e of S.ents){ if(!e.alive) continue; const i=Sim.idx(S,e.x,e.y); if(!(VIS[i]||e.id===PID)) continue; const r=rp[e.id], left=(dirH[e.id]??1)<0, X=Math.round(r.x)-cx, Y=Math.round(r.y)-cy-8;
    const lunge=atkT[e.id]&&now-atkT[e.id]<260, bob=((now/(e.kind==="player"?650:420)+(e.kind==="player"?0:e.x*.37))|0)%2;
    if(e.kind==="husk"){ const ex=lunge?20:19, ey=lunge?9:11+bob, px=left?23-ex:ex; R(g,X+px,Y+ey,1,1,e.aware?"#ff5a3a":"#8a2010"); glow(X+px+.5,Y+ey+.5,e.aware?7:4,e.aware?"rgba(255,50,30,.5)":"rgba(160,20,10,.25)"); }
    else { const vx=left?23-14:14, vy=8+bob; glow(X+vx,Y+vy,5,"rgba(242,182,72,.35)");
      const ci=S.ents.filter(q=>q.kind==="player").indexOf(e); if(S.ents.filter(q=>q.kind==="player").length>1){ const c=CREW_COL[ci%4]; R(g,X+10,Y-3,5,1,c); R(g,X+11,Y-2,3,1,c); R(g,X+12,Y-1,1,1,c); } } }
  for(const k of Object.keys(S.fire||{})){ const i=+k; if(!VIS[i]) continue; const lv=S.fire[i]; glow((i%S.W)*TS-cx+12,((i/S.W)|0)*TS-cy+12,14+lv*5,`rgba(255,110,30,${.16+.06*lv+.04*Math.sin(now*.03+i)})`); }
  for(const r of rings){ const a=1-r.t/r.dur, rad=4+r.t/r.dur*52; g.strokeStyle=`rgba(255,200,120,${a*.8})`; g.lineWidth=2; g.beginPath(); g.arc(r.x-cx,r.y-cy,rad,0,6.283); g.stroke(); }
  for(const it of S.items){ if(!VIS[Sim.idx(S,it.x,it.y)]) continue; const rr=Items.rarOf(it), X=it.x*TS-cx+12, Y=it.y*TS-cy+16;
    if(it.d==="blackbox"&&(now%900)<450) glow(X+4,Y-4,7,"rgba(255,100,40,.5)");
    if(rr>=2){ const c=Items.RAR[rr].col, h=rr>=3?70:30, a=.25+.12*Math.sin(now*.004+it.id); const gr=g.createLinearGradient(0,Y-h,0,Y); gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(1,c); g.globalAlpha=a; g.fillStyle=gr; g.fillRect(X-2,Y-h,4,h); g.globalAlpha=1; glow(X,Y-2,rr>=3?12:7,c+"66"); } }
  for(const q of parts) if(q.emit){ if(q.clipY!=null&&q.y<q.clipY) continue; g.fillStyle=q.col; g.globalAlpha=Math.max(0,q.life/q.max); g.fillRect(Math.round(q.x-cx),Math.round(q.y-cy),q.size,q.size); }
  g.globalAlpha=1;
  for(const t of tracers){ const a=1-t.t/t.dur, L2=Math.hypot(t.x1-t.x0,t.y1-t.y0); g.fillStyle=`rgba(255,226,140,${a})`; for(let s=0;s<L2;s++) g.fillRect(Math.round(t.x0+(t.x1-t.x0)*s/L2-cx),Math.round(t.y0+(t.y1-t.y0)*s/L2-cy),1,1); }
  g.restore();
  if(overlay){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){ const i=Sim.idx(S,x,y), t=S.tiles[i]; if(!p.seen[i]) continue;
    if(!(t.t==="floor"||t.t==="extract"||t.t==="prop"||(t.t==="door"&&t.open))) continue; const f=S.P[i]/101;
    g.fillStyle=f>.66?"rgba(80,170,190,.22)":f>.35?"rgba(200,150,40,.3)":"rgba(220,50,30,.38)"; g.fillRect(x*TS-cx,y*TS-cy,TS,TS);
    if(S.wind[i]>=0){ const j=S.wind[i], dx=(j%S.W)-x, dy=((j/S.W)|0)-y; for(let s=-4;s<=4;s++) R(g,x*TS-cx+12+dx*s,y*TS-cy+12+dy*s,1,1,"rgba(220,240,250,.8)"); R(g,x*TS-cx+12+dx*5,y*TS-cy+12+dy*5,1,1,"#fff"); } } }
  drawUI(g,cx,cy,now);
  const sw=screen.width, shh=screen.height, sc=view.scale, sx=shake?Math.round((Math.random()-.5)*shake)*sc:0, sy=shake?Math.round((Math.random()-.5)*shake)*sc:0;
  sctx.imageSmoothingEnabled=false; sctx.globalCompositeOperation="source-over"; sctx.globalAlpha=1;
  sctx.fillStyle="#000"; sctx.fillRect(0,0,sw,shh);
  sctx.drawImage(frame,0,0,fw,fh,sx,sy,fw*sc,fh*sc);
  if(scan&&sc>=3){ sctx.fillStyle=scan; sctx.fillRect(0,0,sw,shh); }
  if(grain){ sctx.save(); sctx.globalAlpha=.06; sctx.globalCompositeOperation="overlay"; const ox=(Math.random()*128)|0, oy=(Math.random()*128)|0; sctx.translate(-ox,-oy); sctx.fillStyle=grain; sctx.fillRect(0,0,sw+128,shh+128); sctx.restore(); }
  if(vignette) sctx.drawImage(vignette,0,0);
  const danger=p.alive&&(p.blood<40||(p.o2<=12&&S.P[Sim.idx(S,p.x,p.y)]<45));
  if(hurtFlash>0||danger){ const a=Math.max(hurtFlash*.35,danger?(.12+.08*Math.sin(now*.006)):0); const gr=sctx.createRadialGradient(sw/2,shh/2,Math.min(sw,shh)*.25,sw/2,shh/2,Math.max(sw,shh)*.7); gr.addColorStop(0,"rgba(120,0,0,0)"); gr.addColorStop(1,`rgba(150,10,0,${a*2})`); sctx.fillStyle=gr; sctx.fillRect(0,0,sw,shh); }
  if(typeof drawEdges==="function") drawEdges(cx,cy);
  if(typeof updateTags==="function") updateTags(cx,cy);
}
function loop(now){ try{ render(now); }catch(e){ console.error(e); } requestAnimationFrame(loop); }

function resize(){
  const r=$("vp").getBoundingClientRect(), dpr=window.devicePixelRatio||1;
  view.dpr=dpr; screen.width=Math.max(1,Math.round(r.width*dpr)); screen.height=Math.max(1,Math.round(r.height*dpr));
  const tiles=mode==="touch"?10.5:20;
  view.scale=Math.max(1,Math.round(screen.width/(TS*tiles)));
  view.fw=Math.ceil(screen.width/view.scale); view.fh=Math.ceil(screen.height/view.scale);
  frame.width=view.fw; frame.height=view.fh;
  vignette=cvs(screen.width,screen.height);
  { const g=vignette.getContext("2d"), w=screen.width, h=screen.height, gr=g.createRadialGradient(w/2,h/2,Math.min(w,h)*.35,w/2,h/2,Math.hypot(w,h)*.55); gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(1,"rgba(0,0,0,.65)"); g.fillStyle=gr; g.fillRect(0,0,w,h); }
  const sl=cvs(1,view.scale), sg=sl.getContext("2d"); sg.fillStyle="rgba(0,0,0,.14)"; sg.fillRect(0,view.scale-1,1,1); scan=sctx.createPattern(sl,"repeat");
  if(!grain){ const n=cvs(128,128), ng=n.getContext("2d"), id=ng.createImageData(128,128); for(let i=0;i<id.data.length;i+=4){ const v=Math.random()*255; id.data[i]=id.data[i+1]=id.data[i+2]=v; id.data[i+3]=255; } ng.putImageData(id,0,0); grain=sctx.createPattern(n,"repeat"); }
  conduitPat=null; conduit=null;
}

// ---------- state refresh ----------
function afterChange(){
  Sim.bind(S); document.body.dataset.scene=S.mode==="ship"?"ship":"raid";
  const p=viewEnt(); VIS=Sim.fov(S,p); if(typeof shareVision==="function") shareVision();
  const k=tileKey(); if(k!==staticKey){ staticKey=k; buildStatic(); }
  computeLights(); processFx();
  if(target&&!targetable(target.x,target.y)) target=null;
  renderPanels();
}

// ---------- panels ----------
const limbCol=(e,l)=>{ const f=e.hp[l]/e.max[l]; return f<=0?"#262320":f>.66?"#4f7a46":f>.33?"#c79a4a":"#e0482f"; };
function figHTML(p){ return Sim.LIMBS.map(l=>`<i class="${l}${p.bleed[l]?" bleed":""}" style="background:${limbCol(p,l)}" title="${Sim.LNAME[l]} ${p.hp[l]}/${p.max[l]}"></i>`).join(""); }
function vitHTML(p){ const pr=S.P[Sim.idx(S,p.x,p.y)], bl=Sim.LIMBS.filter(l=>p.bleed[l]);
  const m=(lbl,val,max,col,txt)=>`<span class="lbl">${lbl}</span><div class="meter"><i style="width:${Math.max(0,Math.min(100,val/max*100))}%;background:${col}"></i></div><span class="num">${txt}</span>`;
  const st=!p.alive?"Flatline":bl.length?`Bleeding: ${bl.map(l=>Sim.LNAME[l]).join(", ")}`:(pr<45?"Suit sealed · on tank air":"Stable");
  return `<span class="big" style="color:${p.blood>60?"var(--bile)":p.blood>35?"var(--brass)":"var(--blood2)"}">${Math.max(0,p.blood)}</span><canvas class="ekg" width="200" height="26"></canvas>`+
    m("O₂",p.o2,p.o2max||100,p.o2>20?"var(--cold)":"var(--blood2)",p.o2)+m("Air",pr,101,pr>70?"var(--cold)":pr>40?"var(--brass)":"var(--blood2)",Math.round(pr)+" kPa")+
    `<span class="state ${bl.length||p.blood<40?"bad":""}">${st}</span>`; }
function drawEkg(root,p){ root.querySelectorAll("canvas.ekg").forEach(c=>{ const g=c.getContext("2d"), w=c.width, h=c.height; g.clearRect(0,0,w,h); g.fillStyle=p.blood>60?"#7fa86a":p.blood>35?"#c79a4a":"#e0482f";
  const amp=Math.max(.2,p.blood/100), rate=p.blood<50?14:20; for(let x=0;x<w;x+=2){ const ph=(x+S.turn*7)%rate; let y=h/2; if(ph===4) y=h/2-9*amp; else if(ph===6) y=h/2+7*amp; else if(ph===2) y=h/2+2; g.fillRect(x,Math.round(y),2,2); if(ph===4||ph===6){ const y0=Math.min(y,h/2), y1=Math.max(y,h/2); g.fillRect(x,y0,1,y1-y0); } } }); }
function contractRows(p){ const vis=S.ents.filter(e=>e.kind==="husk"&&e.alive&&VIS[Sim.idx(S,e.x,e.y)]).length, bb=p.inv.some(i=>i.d==="blackbox");
  return [["Black box",bb?"SECURED":"in the vault",bb?"good":""],["Haul",Sim.lootValue(p)+" cr",""],["Station power",S.power?"ON":"OFF",S.power?"good":"bad"],["Location",Sim.roomName(p.x,p.y),""],["Husks in sight",vis,vis?"bad":""],["Fires",Object.keys(S.fire||{}).length,Object.keys(S.fire||{}).length?"bad":""],...crewRows(),["Turn",S.turn,""]]
    .map(([a,b,c])=>`<span>${a}</span><span class="${c}">${b}</span>`).join(""); }
function crewRows(){ const crew=S.ents.filter(e=>e.kind==="player"); if(crew.length<2) return [];
  const aboard=crew.filter(e=>e.alive).length, waiting=crew.filter(e=>e.alive&&!e.acted&&e.id!==PID).map(e=>typeof nameOf==="function"?nameOf(e.id):e.id);
  return [["Crew",`${aboard} aboard · ${crew.length-aboard} out`,""],...(me().alive&&me().acted&&waiting.length?[["Waiting on",waiting.join(", ").slice(0,28),"bad"]]:[])]; }
function logText(l){ if(!l.pid||l.pid===PID||typeof nameOf!=="function") return l.msg; const n=nameOf(l.pid);
  const verb=w=>w==="have"?"has":/(s|sh|ch|x|z)$/.test(w)?w+"es":w+"s";
  return l.msg.replace(/^You die\./,n+" dies.").replace(/^You're /,n+" is ").replace(/^Your /,n+"'s ").replace(/^You ([a-z]+)\b(?!')/,(m,w)=>n+" "+verb(w)).replace(/^You /,n+" ").replace(/\byour\b/g,"their").replace(/\bYou\b/g,n).replace(/\byou\b/g,n); }
function logHTML(n){ return S.log.slice(-n).map(l=>`<div class="${l.kind}"><span class="t">${String(l.t).padStart(3,"0")}</span>${logText(l)}</div>`).join(""); }
function hotHTML(p,n,keys){ let s=""; for(let i=0;i<Math.max(n,p.inv.length);i++){ const it=p.inv[i];
  s+=it?`<button class="hotslot" data-use="${i}" title="${Items.name(it)} · ${Items.RAR[Items.rarOf(it)].name}${Items.kind(it)==="throw"?" · click, then pick a spot":""}"><div class="slot" style="border-color:${rarCol(it)}"><img alt="${Items.name(it)}" src="${iconFor(it)}">${Items.kind(it)==="throw"?`<span class="v">THROW</span>`:""}</div>${keys?`<span class="kb">${i+1}</span>`:""}</button>`
       :`<div class="hotslot empty"><div class="slot"></div>${keys?`<span class="kb">${i+1}</span>`:""}</div>`; } return s; }
function renderPanels(){
  if(typeof renderCrew==="function") renderCrew();
  if(S.mode==="raid"&&typeof panelKind!=="undefined"&&panelKind==="inventory") renderPanel();
  if(S.mode==="ship"){ $("end").hidden=true; if(typeof renderShipHud==="function") renderShipHud(); return; }
  const p=me(), onPad=Sim.tileAt(S,p.x,p.y).t==="extract"&&S.status==="playing";
  if(mode==="pc"){
    const wk=(Sim.gun(p)||{}).d||"none"; if($("ic-gun").dataset.w!==wk){ $("ic-gun").dataset.w=wk; $("ic-gun").src=gunURL(Sim.gun(p)?wk:null); $("ic-gun").alt=Sim.gun(p)?Items.name(Sim.gun(p)):"Unarmed"; }
    const G=Sim.gun(p), GS=G&&Items.stats(G), at=GS&&GS.ammo, an=at?(p.ammo[at]|0):0;
    $("ammo").textContent=at?an:"–"; $("ammo").classList.toggle("low",!!at&&an<=3); $("ammobar").style.width=at?Math.min(100,an/(Items.AMMO[at].stack*2)*100)+"%":"0%";
    $("ammo-type").textContent=at?Items.AMMO[at].short:"melee"; $("gun-name").textContent=G?Items.name(G):"No gun"; $("gun-name").style.color=G?rarCol(G):"var(--ash)";
    const other=p.act===1?p.w2:p.w1; $("gun-swap").textContent=other?`R · ${Items.name(other)}`:"one gun";
    $("contract").innerHTML=contractRows(p);
    const lg=$("log"); lg.innerHTML=logHTML(40); lg.scrollTop=lg.scrollHeight;
    $("fig").innerHTML=figHTML(p); $("vitals").innerHTML=vitHTML(p); drawEkg($("vitals"),p);
    $("hotbar").innerHTML=hotHTML(p,6,true);
    $("b-ext").disabled=!onPad; $("b-air").classList.toggle("on",overlay); renderTip();
  } else {
    const pr=S.P[Sim.idx(S,p.x,p.y)];
    const m=(lbl,val,max,col,txt)=>`<span class="lbl">${lbl}</span><div class="meter"><i style="width:${Math.max(0,Math.min(100,val/max*100))}%;background:${col}"></i></div><span class="num">${txt}</span>`;
    $("tvit").innerHTML=m("BLD",p.blood,100,p.blood>60?"var(--bile)":p.blood>35?"var(--brass)":"var(--blood2)",Math.max(0,p.blood))+m("O₂",p.o2,p.o2max||100,p.o2>20?"var(--cold)":"var(--blood2)",p.o2)+m("AIR",pr,101,pr>70?"var(--cold)":pr>40?"var(--brass)":"var(--blood2)",Math.round(pr))+`<span class="lbl">${(()=>{ const G=Sim.gun(p), at=G&&Items.stats(G).ammo; return at?Items.AMMO[at].short:"RDS"; })()}</span><span style="grid-column:2/4;font-size:12px">${(()=>{ const G=Sim.gun(p), at=G&&Items.stats(G).ammo; return at?(p.ammo[at]|0):"–"; })()} · <span style="color:${S.power?"var(--bile)":"var(--blood2)"}">${S.power?"POWER ON":"POWER OFF"}</span></span>`;
    $("tfig").innerHTML=figHTML(p); $("tick").innerHTML=logHTML(2);
    $("thot").innerHTML=hotHTML(p,Math.min(6,Math.max(4,p.inv.length)),false);
    $("dfig").innerHTML=figHTML(p); $("dvit").innerHTML=vitHTML(p); drawEkg($("dvit"),p);
    $("dinv").innerHTML=p.inv.length?p.inv.map((it,i)=>`<button data-use="${i}" style="border-color:${rarCol(it)}"><span><img alt="" src="${iconFor(it)}">${Items.name(it)}</span><span style="color:${rarCol(it)}">${Items.RAR[Items.rarOf(it)].name}</span></button>`).join(""):`<div class="empty">Empty.</div>`;
    $("dfacts").innerHTML=contractRows(p);
    const dl=$("dlog"); dl.innerHTML=logHTML(60); dl.scrollTop=dl.scrollHeight;
    $("t-ext").disabled=!onPad; $("t-air").classList.toggle("on",overlay);
    const tg=target&&targetable(target.x,target.y)?target:null;
    $("t-firepct").textContent=tg?(Sim.entAt(S,tg.x,tg.y)?Math.round(Sim.hitChance(S,p,tg.x,tg.y)*100)+"%":(S.tiles[Sim.idx(S,tg.x,tg.y)].t==="window"?"window":"drum")):"nearest";
    renderCard();
  }
  renderEnd();
}
function describe(x,y){
  if(x<0||y<0||x>=S.W||y>=S.H) return "";
  const p=me(), i=Sim.idx(S,x,y); if(!p.seen[i]) return "Unexplored";
  const t=S.tiles[i], names={floor:Sim.roomName(x,y),extract:"Shuttle pad",wall:"Bulkhead",space:"Open space",window:"Window",breach:"Hull breach",console:"Main power relay",door:"Door",prop:PROP_NAME[t.kind],terminal:TERM_NAME[t.kind],seat:SEAT_NAME[t.kind]};
  let s=names[t.t]||""; if(t.t==="door") s=(t.vault?"Vault door":"Door")+(t.broken?" (wrecked)":t.open?" (open)":t.locked?" (maglocked)":" (closed)");
  if(t.t==="window"&&t.hp===1) s+=" (cracked)";
  let sub="";
  if(t.t==="floor"||t.t==="extract"||(t.t==="door"&&t.open)) sub=`${Math.round(S.P[i])} kPa`;
  if(VIS[i]){ const e=Sim.entAt(S,x,y); if(e&&e.kind==="husk"){ const hurt=Sim.LIMBS.filter(l=>e.hp[l]<e.max[l]).length; s=`<b>Husk</b> · ${Math.round(Sim.hitChance(S,p,x,y)*100)}% to hit`; sub=hurt?"Wounded":"Unharmed"; }
    const its=S.items.filter(it=>it.x===x&&it.y===y); if(its.length) sub=(sub?sub+" · ":"")+its.map(q=>`<span style="color:${rarCol(q)}">${Items.name(q)}</span>`).join(", ");
    if(t.t==="window") sub="Shoot it out to vent the room";
    if(t.t==="prop"&&t.kind==="barrel") sub="Shoot it to detonate · blast radius 2"; }
  if(S.fire&&S.fire[i]) { s=`<b>Fire</b> · ${s}`; sub=(sub?sub+" · ":"")+["","smouldering","burning","raging"][S.fire[i]]; }
  if(t.t==="floor"&&t.debris) sub=(sub?sub+" · ":"")+"burnt wreckage";
  return s+(sub?`<span class="sub">${sub}</span>`:"");
}
function renderTip(){ if(mode!=="pc") return; const el=$("tip");
  if(!hover||!mouse){ el.hidden=true; return; } const html=describe(hover.x,hover.y); if(!html){ el.hidden=true; return; }
  el.hidden=false; el.innerHTML=html; const vr=$("vp").getBoundingClientRect(); let x=mouse.x+18, y=mouse.y+18; if(x+el.offsetWidth>vr.width-8) x=mouse.x-el.offsetWidth-12; if(y+el.offsetHeight>vr.height-8) y=mouse.y-el.offsetHeight-12; el.style.left=x+"px"; el.style.top=y+"px"; }
let cardTimer=null;
function renderCard(msg){ const c=$("tcard");
  if(target&&targetable(target.x,target.y)){ c.hidden=false; c.innerHTML=describe(target.x,target.y).replace(/<span class="sub">/," · <span>")+" · tap again or FIRE"; return; }
  if(msg){ c.hidden=false; c.innerHTML=msg.replace(/<span class="sub">/," · <span>"); clearTimeout(cardTimer); cardTimer=setTimeout(()=>{ cardTimer=null; if(!target) $("tcard").hidden=true; },1800); return; }
  if(!cardTimer) c.hidden=true; }
function renderEnd(){
  const box=$("end"), p=me();
  if(S.mode!=="raid"||!p||p.alive||(spectating&&S.status==="playing")){ box.hidden=true; return; }
  box.hidden=false; const over=S.status!=="playing", left=S.ents.filter(e=>e.kind==="player"&&e.alive).length, squad=typeof inSquad==="function"&&inSquad();
  let head;
  if(p.extracted){ const bb=p.inv.some(i=>i.d==="blackbox"), v=Sim.lootValue(p);
    head=`<h3 class="win">Extracted</h3><div>${bb?"The black box is aboard.":"You made it out."}</div><ul>${p.inv.map(i=>`<li style="color:${rarCol(i)}">${Items.name(i)} · ${Items.value(i)} cr</li>`).join("")||"<li>No salvage</li>"}</ul><div><b style="color:var(--brass)">${v} cr</b> hauled in ${S.turn} turns.</div><div class="note">Everything you carried goes into your ship's stash.</div>`; }
  else head=`<h3 class="lose">Lost to the void</h3><div>${p.cause||S.cause||"You died."}</div><div class="note">Your kit and everything you carried stays behind. Turn ${S.turn}.</div>`;
  let foot;
  if(!over) foot=`<div class="note">${left} crewmate${left>1?"s are":" is"} still aboard. The raid ends when everyone is out.</div><button id="b-spec" class="plain">Spectate crew</button>`;
  else if(!squad||Net.host) foot=`<button id="b-again" class="danger plain">${squad?"Return the crew to the ship":"Return to ship"}</button>`;
  else foot=`<div class="note">Waiting for the squad leader to undock…</div>`;
  $("endbox").innerHTML=head+foot;
  if($("b-again")) $("b-again").onclick=()=>returnToBase();
  if($("b-spec")) $("b-spec").onclick=()=>{ spectating=true; afterChange(); };
}

// ---------- actions & travel ----------
function targetable(x,y){ if(!VIS||x<0||y<0||x>=S.W||y>=S.H) return false; const i=Sim.idx(S,x,y); if(!VIS[i]) return false; const e=Sim.entAt(S,x,y); const t=S.tiles[i]; return (e&&e.kind==="husk")||t.t==="window"||(t.t==="prop"&&t.kind==="barrel"); }
function send(a,keepTravel){ if(!S||S.status!=="playing") return false; if(!keepTravel) stopTravel();
  if(S.mode==="raid"&&typeof inSquad==="function"&&inSquad()) return netRaidAction(a);
  const ok=Sim.act(S,PID,a); afterChange(); if(S.mode==="ship"&&a.type==="move"&&typeof netShipMoved==="function") netShipMoved(); return ok; }
function note(msg){ S.log.push({t:S.turn,msg,kind:"info"}); renderPanels(); }
function nearestHusk(){ const p=me(); let best=null,bd=1e9; for(const e of S.ents){ if(e.kind!=="husk"||!e.alive||!VIS[Sim.idx(S,e.x,e.y)]) continue; const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<bd){bd=d;best=e;} } return best; }
function fire(){
  let tg=null;
  if(mode==="pc"&&hover&&targetable(hover.x,hover.y)) tg=hover; else if(target&&targetable(target.x,target.y)) tg=target; else { const h=nearestHusk(); if(h) tg={x:h.x,y:h.y}; }
  if(!tg){ note("No husks in sight."); if(mode==="touch") renderCard("No husks in sight"); return; }
  send({type:"shoot",x:tg.x,y:tg.y});
}
function pathTo(gx,gy){
  const p=me(); if(gx<0||gy<0||gx>=S.W||gy>=S.H||!p.seen[Sim.idx(S,gx,gy)]||(gx===p.x&&gy===p.y)) return null;
  const W=S.W, start=Sim.idx(S,p.x,p.y), goal=Sim.idx(S,gx,gy);
  const pass=t=>Sim.walk(t)||(t.t==="door"&&!t.open&&(!t.locked||!S.power||p.inv.some(i=>i.d==="keycard")));
  if(!pass(S.tiles[goal])) return null;
  const prev=new Int32Array(W*S.H).fill(-1); prev[start]=start; const q=[start];
  for(let k=0;k<q.length;k++){ const c=q[k]; if(c===goal) break; const x=c%W,y=(c/W)|0;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx,ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=S.H) continue; const j=ny*W+nx; if(prev[j]!==-1||!p.seen[j]) continue;
      if(!pass(S.tiles[j])||(S.fire&&S.fire[j]&&j!==goal)) continue; const o=Sim.entAt(S,nx,ny); if(o&&VIS[j]) continue; prev[j]=c; q.push(j); } }
  if(prev[goal]===-1) return null; const path=[]; let c=goal; while(c!==start){ path.push([c%W,(c/W)|0]); c=prev[c]; } return path.reverse();
}
const visHusks=()=>S.ents.filter(e=>e.kind==="husk"&&e.alive&&VIS[Sim.idx(S,e.x,e.y)]).map(e=>e.id);
const hpSum=p=>Sim.LIMBS.reduce((a,l)=>a+p.hp[l],0)+p.blood;
function travelTo(x,y){ const path=pathTo(x,y); if(!path) return false; stopTravel(); travel={path,i:0,seen:visHusks(),tries:0}; travel.timer=setTimeout(stepTravel,10); return true; }
function stopTravel(){ if(travel){ clearTimeout(travel.timer); travel=null; } }
function stepTravel(){
  if(!travel||S.status!=="playing"){ travel=null; return; }
  const next=travel.path[travel.i]; if(!next){ const th=travel.then; travel=null; if(th){ const p=me(); send({type:"move",dx:th.dx-p.x,dy:th.dy-p.y}); } return; }
  const p=me(), before=hpSum(p), dx=next[0]-p.x, dy=next[1]-p.y;
  if(Math.abs(dx)+Math.abs(dy)!==1){ travel=null; return; }
  if(!send({type:"move",dx,dy},true)){ travel=null; return; }
  if(!travel) return;
  if(me().x===next[0]&&me().y===next[1]){ travel.i++; travel.tries=0; } else if(++travel.tries>(typeof inSquad==="function"&&inSquad()?10:4)){ travel=null; return; }
  if(visHusks().some(id=>!travel.seen.includes(id))){ note("You stop. Something moved."); travel=null; return; }
  if(hpSum(me())<before){ travel=null; return; }
  travel.timer=setTimeout(stepTravel,S.mode==="ship"?85:(typeof inSquad==="function"&&inSquad()?260:130));
}

// ---------- input ----------
function tileAt(ev){ const r=screen.getBoundingClientRect(); const px=(ev.clientX-r.left)*view.dpr/view.scale+Math.round(camX), py=(ev.clientY-r.top)*view.dpr/view.scale+Math.round(camY); return {x:Math.floor(px/TS),y:Math.floor(py/TS)}; }
document.addEventListener("keydown",e=>{
  if(!S||(e.target&&e.target.tagName==="INPUT")) return;
  if(!$("panel").hidden){ if(e.key==="Escape"&&typeof closePanel==="function") closePanel(); return; }
  if(mode!=="pc") return;
  const k=e.key.toLowerCase(), mv={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[k];
  if(mv){ e.preventDefault(); send({type:"move",dx:mv[0],dy:mv[1]}); return; }
  if(k===" "||k==="."){ e.preventDefault(); send({type:"wait"}); return; }
  if(k==="escape"){ stopTravel(); return; }
  if(k==="r"&&S.mode==="raid"){ send({type:"swap"}); return; }
  if(k==="i"||k==="tab"){ e.preventDefault(); if(typeof openPanel==="function") openPanel("inventory"); return; }
  if(k==="escape"&&throwMode){ throwMode=null; return; }
  if(k==="f"||k==="e") send({type:"interact"}); else if(k==="g") send({type:"pickup"}); else if(k==="x") fire(); else if(k==="q") send({type:"extract"});
  else if(k==="t"){ overlay=!overlay; renderPanels(); }
  else if(/^[1-9]$/.test(k)) useSlot(+k-1);
});
screen.addEventListener("mousemove",ev=>{ if(mode!=="pc") return; const vr=$("vp").getBoundingClientRect(); mouse={x:ev.clientX-vr.left,y:ev.clientY-vr.top}; hover=tileAt(ev); renderTip(); });
screen.addEventListener("mouseleave",()=>{ hover=null; mouse=null; if(mode==="pc") renderTip(); });
screen.addEventListener("contextmenu",ev=>{ ev.preventDefault(); stopTravel(); throwMode=null; });
screen.addEventListener("pointerup",ev=>{
  if(throwMode&&S&&S.mode==="raid"&&ev.button!==2){ const t=tileAt(ev), p=me(); const tm=throwMode; throwMode=null; if(t.x===p.x&&t.y===p.y){ toast("Throw cancelled."); return; } send({type:"throw",index:tm.index,x:t.x,y:t.y}); return; }
  if(!S||S.status!=="playing"||ev.button===2) return;
  const {x,y}=tileAt(ev), p=me(); if(x<0||y<0||x>=S.W||y>=S.H) return;
  const d=Math.abs(x-p.x)+Math.abs(y-p.y), e=Sim.entAt(S,x,y);
  if(S.mode==="ship"){ const t=S.tiles[Sim.idx(S,x,y)];
    if(t.t==="terminal"){ if(d===1){ send({type:"move",dx:x-p.x,dy:y-p.y}); return; }
      let best=null; for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){ const pth=pathTo(x+dx,y+dy); if(pth&&(!best||pth.length<best.length)) best=pth; }
      if(best){ stopTravel(); travel={path:best,i:0,seen:[],tries:0,then:{dx:x,dy:y}}; travel.timer=setTimeout(stepTravel,10); } return; }
    if(d===1) send({type:"move",dx:x-p.x,dy:y-p.y}); else if(d>1) travelTo(x,y); return; }
  if(targetable(x,y)){
    if(e&&d===1){ target=null; send({type:"move",dx:x-p.x,dy:y-p.y}); return; }
    if(mode==="touch"&&!(target&&target.x===x&&target.y===y)){ target={x,y}; renderPanels(); return; }
    target=null; send({type:"shoot",x,y}); return;
  }
  target=null;
  if(d===1){ send({type:"move",dx:x-p.x,dy:y-p.y}); return; }
  if(d===0){ send({type:S.items.some(i=>i.x===x&&i.y===y)?"pickup":"wait"}); return; }
  if(!travelTo(x,y)&&mode==="touch") renderCard(describe(x,y));
  renderPanels();
});
document.querySelectorAll(".t-pad button").forEach(b=>{
  let iv=null; const [dx,dy]=b.dataset.d.split(",").map(Number);
  const go=()=>{ target=null; send(dx||dy?{type:"move",dx,dy}:{type:"wait"}); };
  b.addEventListener("pointerdown",ev=>{ ev.preventDefault(); go(); clearInterval(iv); iv=setInterval(go,230); });
  for(const n of ["pointerup","pointerleave","pointercancel"]) b.addEventListener(n,()=>{ clearInterval(iv); iv=null; });
});
$("t-fire").onclick=fire; $("t-use").onclick=()=>send({type:"interact"}); $("t-grab").onclick=()=>send({type:"pickup"}); $("t-ext").onclick=()=>send({type:"extract"});
$("t-air").onclick=()=>{ overlay=!overlay; renderPanels(); };
const drawer=$("drawer"); const openDrawer=o=>{ drawer.classList.toggle("open",o); drawer.setAttribute("aria-hidden",o?"false":"true"); };
$("t-bag").onclick=()=>openPanel("inventory"); $("tick").onclick=()=>openDrawer(true); $("dr-close").onclick=()=>openDrawer(false);
for(const id of ["dinv","thot","hotbar"]) $(id).addEventListener("click",ev=>{ const b=ev.target.closest("[data-use]"); if(b) useSlot(+b.dataset.use); });
// throwables go into targeting mode; everything else is used or equipped
function useSlot(i){ if(!S||S.mode!=="raid") return; const it=me().inv[i]; if(!it) return;
  if(Items.kind(it)==="throw"){ throwMode={index:i}; toast(`${mode==="pc"?"Click":"Tap"} a spot within 6 tiles to throw the ${Items.name(it)}. ${mode==="pc"?"Esc":"Tap your character"} to cancel.`); return; }
  send({type:"use",index:i}); }
$("b-inv").onclick=()=>openPanel("inventory"); $("b-swap").onclick=()=>send({type:"swap"}); $("t-swap").onclick=()=>send({type:"swap"});
function armAbandon(b,label){ if(b.dataset.armed==="1"){ b.dataset.armed=""; b.textContent=label; openDrawer(false); abandonRaid(); return; } b.dataset.armed="1"; b.textContent=mode==="pc"?"Click again":"Tap again to abandon"; setTimeout(()=>{ b.dataset.armed=""; b.textContent=label; },3000); }
function abandonRaid(){ if(!S||S.status!=="playing"||!me().alive) return; stopTravel(); send({type:"abandon"}); }
$("dr-new").onclick=()=>armAbandon($("dr-new"),"Abandon run");

$("b-fire").onclick=fire; $("b-int").onclick=()=>send({type:"interact"}); $("b-get").onclick=()=>send({type:"pickup"});
$("b-wait").onclick=()=>send({type:"wait"}); $("b-ext").onclick=()=>send({type:"extract"});
$("b-air").onclick=()=>{ overlay=!overlay; renderPanels(); };
$("b-new").onclick=()=>armAbandon($("b-new"),"Abandon");

function setMode(m){ mode=m; document.body.dataset.mode=m; try{ localStorage.setItem("hb-mode",m); }catch(e){} target=null; hover=null; stopTravel(); camInit=false; resize(); if(S) renderPanels(); }
