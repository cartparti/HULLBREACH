// ============================ CLIENT ================================
// World is drawn at native 24px tiles onto a small frame canvas, lit by a
// per-tile lightmap (multiply) + additive glow, then scaled up crisp.
let PID="p1", spectating=false; const TS=24;
const CREW_COL=["#9bc06a","#76c2c4","#e8b048","#d07ad0"];
const isHum=e=>e&&(e.kind==="player"||e.kind==="raider"||e.kind==="remains");
const ATT_COL={hostile:"#e0482f",wary:"#e8b048",friendly:"#7cc46a"};
const attOf=e=>e&&e.kind==="raider"&&S.crews&&S.crews[e.crew]?S.crews[e.crew].att:null;
function viewEnt(){ const m=me(); if(!S||S.mode!=="raid"||!m||m.alive||!spectating) return m; return S.ents.find(e=>e.kind==="player"&&e.alive)||m; }
let S=null, VIS=null, mode="pc", overlay=false;
const $=id=>document.getElementById(id);
const screen=$("screen"), sctx=screen.getContext("2d");
const frame=document.createElement("canvas"), fctx=frame.getContext("2d");
const lm=document.createElement("canvas"), lctx=lm.getContext("2d");
const staticLayer=document.createElement("canvas");
let fireContrib=[], rings=[], arcs=[], throwMode=null, bursts=[], GORE=[], goreS=null, deathT={}, recoilT={}, recoilA={};
let EMIT=[], LUMV=null, staticKey="", SOURCES=[], srcContrib=[], FLASH=null, AMB=null, view={dpr:1,scale:3,fw:0,fh:0};
let camX=0,camY=0,camInit=false, rp={}, flashT={}, atkT={}, dirH={}, parts=[], tracers=[], slashes=[], lightsT=[];
let shake=0, hurtFlash=0, powerFlicker=0, hover=null, mouse=null, target=null, travel=null, lastT=performance.now();
let sndT=0;
// low graphics: no cast shadows, light shafts or film grain, half the particles. Chosen in the menu,
// or switched on automatically if a phone can't keep up.
let LOWFX=(()=>{ try{ return localStorage.getItem("hb-low")==="1"; }catch(e){ return false; } })(), fpsT0=0, fpsN=0, fpsAuto=(()=>{ try{ return localStorage.getItem("hb-low")==null; }catch(e){ return true; } })();
function setLowFx(v,auto){ LOWFX=!!v; try{ localStorage.setItem("hb-low",LOWFX?"1":"0"); }catch(e){} fpsAuto=false; if(auto&&typeof toast==="function") toast("Switched to low graphics to keep things smooth. Change it in the main menu."); }
let vignette=null, grain=null, scan=null, conduit=null, conduitPat=null;
const me=()=>S.ents.find(e=>e.id===PID);

// ---------- helpers ----------
function hh(x,y,k=0){ let n=(x*73856093)^(y*19349663)^(k*83492791); n=Math.imul(n^(n>>>13),1274126177); n^=n>>>16; return n>>>0; }
const R=(g,x,y,w,h,c)=>{ g.fillStyle=c; g.fillRect(x,y,w,h); };
const hp=(g,x,y,c)=>R(g,x,y,.5,.5,c);  // one detail pixel (half a game pixel)
// Q: detail multiplier. Sprites, tiles and the frame are Q times the game's pixel grid, so art can use half-pixels
// (R(g,x+.5,...)) for fine detail while every coordinate stays in game pixels.
const Q=2;
const cvsRaw=(w,h)=>{ const c=document.createElement("canvas"); c.width=w; c.height=h; return c; };
const cvs=(w,h)=>{ const c=cvsRaw(Math.max(1,Math.round(w*Q)),Math.max(1,Math.round(h*Q))); c._q=1; c.lw=w; c.lh=h; c.getContext("2d").setTransform(Q,0,0,Q,0,0); return c; };
// hi-res canvases draw at their game-pixel size
(()=>{ const P=CanvasRenderingContext2D.prototype, di=P.drawImage;
  P.drawImage=function(img,...a){ if(img&&img._q){ if(a.length===2) return di.call(this,img,a[0],a[1],img.lw,img.lh);
      if(a.length===8) return di.call(this,img,a[0]*Q,a[1]*Q,a[2]*Q,a[3]*Q,a[4],a[5],a[6],a[7]); }
    return di.call(this,img,...a); }; })();
const T=(x,y)=>Sim.tileAt(S,x,y);
const isW=(x,y)=>{ const t=T(x,y).t; return t==="wall"||t==="window"||t==="door"; };
function disc(g,cx,cy,r,c){ for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++) if(x*x+y*y<=r*r+r*.6) R(g,cx+x,cy+y,1,1,c); }
// Material shading for every sprite, at full detail: a rim light from the top-left, form shadow on the
// bottom-right, a top-down falloff, brushed scratches on metal, grain on wood and leather, weave on cloth,
// pitting and grime everywhere. Skin and glowing colours are left clean.
const SKIN=new Set(); 
function shadeSprite(c,opt){
  const W=c.width, H=c.height, g=c.getContext("2d"), im=g.getImageData(0,0,W,H), d=im.data, A=(x,y)=>x<0||y<0||x>=W||y>=H?0:d[(y*W+x)*4+3];
  if(!SKIN.size&&typeof Items!=="undefined") for(const sk of Items.STYLE.skin) for(const f of [1,.78,.62,1.08,.85,.7]) SKIN.add(shade(sk,f));
  if(opt.round){ const cl=[]; for(let y=0;y<H;y++) for(let x=0;x<W;x++){ if(d[(y*W+x)*4+3]<128) continue; const u=A(x,y-1)>=128,dn=A(x,y+1)>=128,l=A(x-1,y)>=128,r=A(x+1,y)>=128;
      if((!u&&!l&&r&&dn)||(!u&&!r&&l&&dn)||(!dn&&!l&&r&&u)||(!dn&&!r&&l&&u)){ if((u?0:1)+(dn?0:1)+(l?0:1)+(r?0:1)===2) cl.push((y*W+x)*4+3); } } for(const o of cl) d[o]=0; }
  const out=new Uint8ClampedArray(d), seed=opt.seed||1;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const o=(y*W+x)*4; if(d[o+3]<128) continue;
    let r=d[o],gg=d[o+1],b=d[o+2]; const mx=Math.max(r,gg,b), mn=Math.min(r,gg,b), l=(mx+mn)/510, sat=mx?(mx-mn)/mx:0;
    const hex="#"+((1<<24)|(r<<16)|(gg<<8)|b).toString(16).slice(1);
    if(SKIN.has(hex)){ let f=1; if(!A(x,y-2)||!A(x-2,y)) f=1.1; if(!A(x+2,y)||!A(x,y+2)) f=.82; out[o]=Math.min(255,r*f); out[o+1]=Math.min(255,gg*f); out[o+2]=Math.min(255,b*f); continue; }
    if(l>.72||(sat>.55&&mx>200)) continue;           // emissive: visors, lights, flames
    const n=hh(x,y,seed)%1000/1000; let f=1;
    // rim + form shadow
    if(!A(x-1,y-1)||!A(x,y-1)) f*=1.22; else if(!A(x-2,y-2)) f*=1.08;
    if(!A(x+1,y+1)||!A(x,y+1)) f*=.68; else if(!A(x+2,y+2)) f*=.86;
    // inner edges: a darker neighbour above-left means we sit in its shadow
    const up=(Math.max(0,y-1)*W+x)*4; if(d[up+3]>128&&(d[up]+d[up+1]+d[up+2])<(r+gg+b)*.7) f*=.86;
    f*=1-.16*(y/H);                                   // light from above
    const metal=sat<.16, warm=r>gg&&gg>b&&sat>.25&&l<.45;
    if(metal){ if(hh(y>>1,x>>3,seed+7)%9===0) f*=.84; if(n>.985) f*=1.35; if(n<.03) f*=.7; }      // brushed scratches, specks, pits
    else if(warm){ if((hh(y>>0,x>>2,seed+3)%5)===0) f*=.84; }                                     // grain
    else if((x+y)%2===0) f*=.94;                                                                    // weave
    f*=.93+n*.12;                                                                                    // grit
    out[o]=Math.min(255,r*f); out[o+1]=Math.min(255,gg*f); out[o+2]=Math.min(255,b*f*1.02);
  }
  im.data.set(out); g.putImageData(im,0,0);
}
function outlined(w,h,draw,col="#060505",opt={}){
  const a=cvs(w,h), g=a.getContext("2d"); draw(g); if(!opt.flat) shadeSprite(a,opt);
  const o=cvs(w,h), og=o.getContext("2d"), t=1/Q;
  for(const [dx,dy] of [[t,0],[-t,0],[0,t],[0,-t],[t,t],[-t,t]]) og.drawImage(a,dx,dy);
  og.globalCompositeOperation="source-in"; og.fillStyle=col; og.fillRect(0,0,w,h);
  og.globalCompositeOperation="source-over"; og.drawImage(a,0,0); return o;
}
function whiteOf(c){ const w=c._q?cvs(c.lw,c.lh):cvsRaw(c.width,c.height), g=w.getContext("2d"); g.drawImage(c,0,0); g.globalCompositeOperation="source-in"; g.fillStyle="#fff"; g.fillRect(0,0,w.lw||w.width,w.lh||w.height); return w; }
function blackOf(c){ const w=cvs(c.lw,c.lh), g=w.getContext("2d"); g.drawImage(c,0,0); g.globalCompositeOperation="source-in"; g.fillStyle="#000"; g.fillRect(0,0,c.lw,c.lh); return w; }

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
    case "pistol": r(4,1,8,2,D); r(4,1,8,1,H); r(12,2,2,1,K); r(5,3,2,3,"#2a2018"); r(7,3,1,1,D); r(8,0,2,1,BR); R(g,x+4,y+1,8,.5,"#6a6a60"); for(let k=0;k<3;k++) R(g,x+5+k,y+1,.5,1,"#121210"); hp(g,x+13.5,y+2,"#000"); hp(g,x+9,y+1.5,"#8a8a80"); break;
    case "cannon": r(3,1,10,3,"#2e2f2a"); r(3,1,10,1,"#56574e"); r(13,2,3,1,K); r(4,4,3,3,WD); r(7,2,2,2,BR); R(g,x+3,y+1,10,.5,"#7a7b72"); hp(g,x+15.5,y+2,"#000"); for(let k=0;k<2;k++) R(g,x+8+k*2,y+2,.5,1,"#16160f"); break;
    case "widow": r(4,1,8,2,"#141414"); r(4,1,8,1,"#3a3a3a"); r(5,2,6,1,"#a01818"); r(12,2,2,1,K); r(5,3,2,3,"#1e1414"); r(9,0,1,1,"#ff3a30"); break;
    case "lastword": r(3,1,11,2,"#a07a2a"); r(3,1,11,1,"#e8c060"); r(14,2,2,1,"#6a5018"); r(4,3,2,3,"#3a2010"); for(let k=0;k<4;k++) r(5+k*2,2,1,1,"#5a3a10"); break;
    case "carbine": r(1,2,13,2,D); r(1,2,13,1,H); r(14,2,2,1,K); r(7,4,2,3,K); r(0,2,2,3,WD); r(5,1,2,1,K); for(let k=0;k<5;k++) hp(g,x+4+k*2,y+1.5,"#7a7a70"); R(g,x+9,y+2.5,2,.5,"#121210"); hp(g,x+15.5,y+2,"#000"); break;
    case "rivet": r(0,2,15,2,"#33352f"); r(0,2,15,1,"#5a5d54"); r(15,2,1,1,K); r(5,0,4,2,K); r(6,0,1,1,"#5ab0c0"); r(0,3,3,2,"#3a2a1a"); r(8,4,2,2,D); R(g,x+5,y+.5,4,.5,"#3a3c38"); hp(g,x+6,y,"#c8ffff"); for(let k=0;k<4;k++) hp(g,x+10+k,y+2,"#7a7d74"); break;
    case "lament": r(0,2,15,2,"#b8ad94"); r(0,2,15,1,"#e8dec8"); r(15,2,1,1,"#6a6050"); for(const k of [3,8,12]) r(k,2,1,2,"#c9a24a"); r(5,0,3,2,"#c9a24a"); r(12,4,2,2,"#6a5a40"); r(13,6,1,1,"#a8a8a0"); break;
    case "hymn": r(0,2,6,3,"#2a2a26"); r(0,2,6,1,"#4e4e46"); for(const yy of [1,3,5]) r(6,yy,10,1,yy===3?"#3a3a34":"#2a2a26"); r(2,2,1,3,BR); r(4,2,1,3,BR); r(3,5,2,2,K); break;
    case "scatter": r(2,1,11,3,"#2e2f2a"); r(2,1,11,1,"#55574e"); r(13,1,3,2,K); r(6,4,4,1,"#5a3a1e"); r(0,2,3,3,WD); for(let k=0;k<3;k++) R(g,x+6+k,y+4,.5,1,"#2a1a0e"); R(g,x+13,y+1.5,3,.5,"#000"); break;
    case "pump": r(2,2,12,2,D); r(2,2,12,1,H); r(14,2,2,1,K); r(8,4,4,1,"#5a3a1e"); r(0,2,3,3,WD); for(let k=0;k<3;k++) R(g,x+8+k*1.5,y+4,.5,1,"#2a1a0e"); hp(g,x+15.5,y+2,"#000"); R(g,x+3,y+2,9,.5,"#5a5a50"); break;
    case "gravedigger": r(0,1,3,5,"#6a5a40"); r(1,0,1,1,"#8a7a5a"); r(0,5,1,2,"#6a5a40"); r(3,2,10,2,"#2a2620"); r(3,2,10,1,"#4a443a"); r(13,2,3,2,K); r(7,4,3,1,"#5a1a12"); break;
    case "sweeper": r(2,1,12,3,"#30302a"); r(2,1,12,1,"#5a5a50"); r(14,0,2,5,K); r(6,4,4,3,"#4a4438"); r(7,5,2,1,BR); r(0,2,2,3,WD); break;
    case "longbore": r(0,3,16,1,"#2e302a"); r(2,2,8,2,"#33352f"); r(2,2,8,1,"#5a5d54"); r(4,0,5,2,K); r(5,0,1,1,"#5ab0c0"); r(12,4,1,2,D); r(0,3,2,3,WD); R(g,x+4,y,5,.5,"#3a3c38"); hp(g,x+5,y+.5,"#c8ffff"); R(g,x+10,y+3,6,.5,"#4a4c46"); break;
    case "goodbye": r(0,3,16,1,"#d8cfb8"); r(2,2,8,2,"#e8e0cc"); r(2,2,8,1,"#fbf6ea"); r(4,0,5,2,"#a07a2a"); r(5,0,1,1,"#5ab0c0"); r(15,3,1,1,"#121210"); r(0,3,2,3,"#cfc4aa"); break;
    case "voideye": r(0,3,16,1,"#121214"); r(2,2,8,2,"#18181c"); r(2,2,8,1,"#34343e"); r(4,0,5,2,"#1e1428"); r(5,0,2,1,"#c070ff"); r(12,4,1,2,"#18181c"); r(0,3,2,3,"#22222a"); break;
    case "launcher": r(1,1,14,3,"#3a4430"); r(1,1,14,1,"#56603c"); r(14,0,2,5,K); r(6,4,2,2,D); r(4,0,2,1,K); for(let k=0;k<6;k++) R(g,x+2+k*2,y+2,.5,1,k%2?"#e0c040":"#141210"); R(g,x+1,y+1,13,.5,"#6a7450"); break;
    case "hullbreaker": r(1,1,14,3,"#7a1a12"); r(1,1,14,1,"#a83020"); for(let k=0;k<4;k++) r(2+k*3,3,1,1,k%2?"#e0c040":"#141210"); r(14,0,2,5,K); r(6,4,2,2,D); break;
    case "judgement": r(1,1,14,3,"#a07a2a"); r(1,1,14,1,"#e8c060"); r(3,2,10,1,"#7a5a1a"); r(14,0,2,5,"#5a4010"); r(6,4,2,2,"#3a2810"); r(15,2,1,1,"#ff8a20"); break;
    case "knife": r(6,3,8,1,"#c8c8c0"); r(6,2,7,1,"#8a8a82"); r(2,3,4,2,"#2a2018"); r(6,2,1,3,"#4a4a40"); R(g,x+7,y+3,7,.5,"#f0f0e8"); hp(g,x+13,y+3,"#ffffff"); break;
    case "axe": r(1,3,12,1,"#5a3a1e"); r(11,0,4,6,"#8a2018"); r(14,0,1,6,"#d0d0c8"); r(11,0,4,1,"#b03020"); R(g,x+14,y,.5,6,"#ffffff"); for(let k=0;k<5;k++) hp(g,x+2+k*2,y+3,"#3a2410"); break;
    case "maul": r(1,3,10,1,"#2a2a2a"); r(10,1,5,5,"#3a4448"); r(10,1,5,1,"#5a666a"); r(11,3,3,1,"#5ad0d0"); R(g,x+10,y+1,5,.5,"#8a9a9e"); hp(g,x+12,y+3,"#e0ffff"); break;
    case "butcher": r(1,3,5,1,"#2a2018"); r(6,1,8,4,"#9a9a92"); r(6,1,8,1,"#c8c8c0"); r(9,3,3,2,"#6a1010"); r(13,1,1,4,"#e0e0d8"); break;
    case "splitter": r(1,3,9,1,"#1a1a1a"); r(9,0,7,7,"#2a1a3a"); r(9,0,7,1,"#4a2e66"); r(10,2,5,1,"#b070ff"); r(12,1,1,5,"#b070ff"); break;
    case "hornet": r(4,1,8,2,"#2a2c28"); r(4,1,8,1,"#4e5048"); r(12,2,1,1,K); r(7,3,2,4,"#1a1a18"); r(5,3,2,2,"#2a2018"); r(3,1,1,1,"#4e5048"); r(9,0,2,1,"#5a5a50"); for(let k=0;k<4;k++) hp(g,x+5+k,y+1,"#121210"); R(g,x+7,y+4,2,.5,"#3a3a34"); hp(g,x+12.5,y+2,"#000"); break;
    case "sixgun": r(3,1,9,2,"#6a6a64"); r(3,1,9,1,"#9a9a92"); r(12,1,2,1,"#4a4a44"); r(6,2,3,2,"#4a4a44"); r(6,2,3,1,"#8a8a82"); r(3,3,2,3,"#6a3a1e"); r(3,3,1,3,"#8a5030"); R(g,x+6,y+2.5,3,.5,"#2a2a26"); hp(g,x+7,y+2,"#c8c8c0"); R(g,x+3,y+4,1,.5,"#a06a40"); hp(g,x+13.5,y+1,"#000"); break;
    case "wasp": r(2,1,11,3,"#33352f"); r(2,1,11,1,"#5a5d54"); r(13,2,2,1,K); r(8,4,2,3,K); r(5,4,2,2,"#2a2018"); r(0,2,2,1,"#4a4a40"); r(0,3,1,2,"#4a4a40"); r(6,0,3,1,K); for(let k=0;k<5;k++) hp(g,x+3+k*2,y+1,"#121210"); R(g,x+9,y+2.5,2,.5,"#121210"); hp(g,x+14.5,y+2,"#000"); break;
    case "bullpup": r(1,1,13,3,"#3a3e36"); r(1,1,13,1,"#62685a"); r(14,2,2,1,K); r(9,4,2,2,"#2a2018"); r(3,4,3,3,K); r(7,0,4,1,K); r(8,0,1,1,"#e04030"); for(let k=0;k<5;k++) hp(g,x+3+k*2,y+.5,"#8a8a80"); R(g,x+4,y+5,1,.5,"#c9a24a"); hp(g,x+15.5,y+2,"#000"); break;
    case "warden": r(0,2,15,2,"#4a3a24"); r(0,2,15,1,"#6a5434"); r(5,1,9,2,"#2e302a"); r(5,1,9,1,"#55584e"); r(14,2,2,1,K); r(8,4,2,3,K); r(6,0,3,1,K); for(let k=0;k<6;k++) R(g,x+1+k*2,y+2.5,.5,.5,"#3a2a18"); R(g,x+6,y+1,7,.5,"#6a6d64"); hp(g,x+15.5,y+2,"#000"); break;
    case "hound": r(2,1,11,3,"#2a2c28"); r(2,1,11,1,"#50524a"); r(13,1,3,2,K); r(6,4,4,3,"#3a3a34"); r(7,4,2,2,"#5a5a50"); r(0,2,3,3,"#1e1e1a"); r(11,0,2,1,K); disc(g,x+8,y+5,1,"#1a1a16"); hp(g,x+8,y+5,"#8a8a80"); R(g,x+13,y+1.5,3,.5,"#000"); R(g,x+3,y+1,9,.5,"#6a6a60"); break;
    case "coachgun": r(0,2,4,3,WD); r(0,2,4,1,"#6a4a2c"); r(4,1,12,1,"#3a3a34"); r(4,2,12,1,"#2a2a26"); r(4,1,12,1,"#5a5a50"); r(4,3,4,1,BR); r(5,4,2,2,WD); hp(g,x+15.5,y+1,"#000"); hp(g,x+15.5,y+2,"#000"); R(g,x+5,y+3,3,.5,"#e8c868"); R(g,x+1,y+2.5,2,.5,"#3a2414"); break;
    case "pipe": r(1,2,13,2,"#5a5048"); r(1,2,13,1,"#8a7a68"); r(14,1,2,4,"#3a3430"); r(3,1,2,1,"#a83a20"); r(0,3,3,3,"#5a3a1e"); r(7,4,1,2,"#3a3430"); r(10,2,1,2,"#2a2420"); hp(g,x+3.5,y+1,"#e04a2a"); R(g,x+9,y+2.5,.5,1,"#1a1410"); R(g,x+5,y+2,.5,1,"#1a1410"); hp(g,x+15,y+2,"#000"); break;
    case "kestrel": r(0,3,16,1,"#2e302a"); r(0,3,6,2,"#5a3a1e"); r(0,3,6,1,"#7a5030"); r(4,0,6,2,K); r(5,0,1,1,"#5ab0c0"); r(9,2,2,1,"#8a8a80"); r(10,1,1,1,"#8a8a80"); r(13,4,1,2,D); hp(g,x+5,y+.5,"#c8ffff"); R(g,x+4,y,6,.5,"#2a2c28"); R(g,x+1,y+3.5,4,.5,"#8a5a34"); hp(g,x+9.5,y+1,"#e0e0d8"); break;
    case "rook": r(0,3,16,1,"#33352f"); r(2,2,9,2,"#3a3e36"); r(2,2,9,1,"#62685a"); r(4,0,5,2,K); r(5,0,1,1,"#e8b048"); r(7,4,2,3,K); r(0,2,2,4,"#3a3e36"); hp(g,x+5,y+.5,"#fff4c0"); R(g,x+4,y,5,.5,"#2a2c28"); for(let k=0;k<4;k++) hp(g,x+10+k,y+2,"#8a8e84"); break;
    case "thumper": r(1,1,10,4,"#3a4430"); r(1,1,10,1,"#56603c"); r(11,1,5,4,"#22261c"); r(12,2,3,2,K); r(4,5,2,2,WD); r(0,2,2,3,WD); R(g,x+1,y+1,10,.5,"#6a7450"); disc(g,x+13.5,y+2.5,1,"#000"); hp(g,x+4,y+3,"#e0c040"); break;
    case "machete": r(2,3,4,1,"#2a2018"); r(6,2,9,2,"#a8a8a0"); r(6,2,9,1,"#d0d0c8"); r(14,3,2,1,"#d0d0c8"); r(6,2,1,3,"#4a4a40"); R(g,x+7,y+2,8,.5,"#f0f0e8"); for(let k=0;k<3;k++) hp(g,x+9+k*2,y+3,"#7a7a72"); break;
    case "crowbar": r(1,3,13,1,"#8a2018"); r(1,3,13,1,"#a83020"); r(13,1,1,3,"#8a2018"); r(14,1,1,1,"#a83020"); r(1,4,2,1,"#6a1810"); R(g,x+2,y+3,11,.5,"#d04030"); break;
    case "ripsaw": r(1,3,4,2,"#2a2a26"); r(1,3,4,1,"#e0a020"); r(5,2,11,3,"#5a5a54"); r(5,2,11,1,"#8a8a82"); for(let k=0;k<6;k++){ r(5+k*2,1,1,1,"#c8c8c0"); r(6+k*2,5,1,1,"#c8c8c0"); } R(g,x+5,y+2,11,.5,"#b0b0a8"); hp(g,x+2,y+3,"#ffe080"); break;
    default: r(4,2,8,2,D);
  }
}
// ---------- contractors: big-headed, stocky, seen from the front, back and side ----------
// 24x32 game pixels (48x64 detail). View: "f" front (facing down), "b" back (facing up), "s" side (facing right).
const STY_NM=(arr,v,d)=>typeof v==="number"?(arr[v]||d):(v||d);
const CLOAK=L=>(Items.DYES.cloak[L.c]||Items.DYES.cloak.red), VISOR=L=>(Items.DYES.visor[L.v]||Items.DYES.visor.amber)[0];
// one leg piece over one leg: lx = left edge of the leg, lift = how far the foot is raised
function drawLegPiece(g,id,lx,lift,back){ const r=(x,y,w,h,c)=>R(g,x,y,w,h,back?shade(c,.82):c), y0=22.8, bot=27.6-lift, cx=lx+1.5;
  switch(id){
    case "cargo": r(lx,y0,3,bot-y0,"#5a5a44"); r(lx+.2,y0+1.4,2.6,1.8,"#4a4a38"); r(lx+.2,y0+1.4,2.6,.5,"#6e6e56"); break;
    case "kneepads": r(lx,y0,3,bot-y0,"#30363a"); ell(g,cx,y0+2.6,1.8,1.1,back?"#3a3a34":"#4a4a44"); ell(g,cx-.3,y0+2.3,1,.4,"#7a7a6e"); break;
    case "hazlegs": r(lx,y0,3,bot-y0,"#9a7a22"); for(let k=0;k<3;k++) r(lx+k,y0+2,1,.75,k%2?"#e0c040":"#141210"); break;
    case "greaves": r(lx,y0,3,bot-y0,"#2e322a"); poly(g,[[lx-.2,y0+1.6],[lx+3.2,y0+1.6],[lx+2.8,bot],[lx+.2,bot]],back?"#3e423a":"#565a50"); ell(g,cx,y0+1.8,1.8,1.1,back?"#4a4e46":"#6a6e64"); hp(g,cx-.4,y0+1.4,"#9a9e94"); break;
    case "bonegreaves": r(lx,y0,3,bot-y0,"#24262a"); for(let y=y0+.6;y<bot;y+=1.4){ r(lx-.3,y,3.6,1,"#3a3c40"); r(lx-.3,y,3.6,.35,"#5e6268"); } ell(g,cx,y0+2,1.9,1.2,"#3a3c40"); hp(g,cx,y0+2,"#8a8e94"); break;
    case "strider": r(lx,y0,3,bot-y0,"#26282a"); r(lx+2.5,y0,.75,bot-y0+1,"#8a8a80"); ell(g,cx-.4,y0+2.4,1,1,"#e8b048"); hp(g,cx-.6,y0+2.2,"#fff0a0"); break;
    case "aegislegs": r(lx,y0,3,bot-y0,"#1e2024"); r(lx+1.2,y0,.6,bot-y0,"#7a1a12"); ell(g,cx,y0+2.2,1.8,1.1,"#3a3e46"); hp(g,cx-.4,y0+1.9,"#8a8e94"); break;
    case "hardlegs": r(lx-.25,y0,3.5,bot-y0,"#b8bcb4"); ell(g,cx,y0+2.4,1.9,1.1,"#6a6e68"); break;
    case "magboots": r(lx,y0,3,bot-y0,"#2a3038"); break;
  }
  if(["greaves","bonegreaves","aegislegs","hardlegs","magboots","strider"].includes(id)){ const bc={greaves:"#4a4e46",bonegreaves:"#2e3034",aegislegs:"#1e2024",hardlegs:"#3a3e42",magboots:"#3a3e42",strider:"#3a3a34"}[id];
    poly(g,[[cx-1.7,bot-.8],[cx+1.7,bot-.8],[cx+2,bot+2.4],[cx-2,bot+2.4]],back?shade(bc,.8):bc); R(g,cx-2,bot-.8,4,.6,shade(bc,1.5)); if(id==="hardlegs"||id==="magboots") R(g,cx-2,bot+2,4,.5,"#5ad0d0"); if(id==="aegislegs") R(g,cx-2,bot+1.2,4,.4,"#7a1a12"); } }
// chest piece over the torso; returns the sleeve colour (null = keep the shirt)
function drawChest(g,id,b,L,view){ view=view||"f"; const r=(x,y,w,h,c)=>R(g,x,y+b,w,h,c), rr=(x,y,w,h,c)=>R(g,x,y,w,h,c), back=view==="b", sd=view==="s", f=view==="f";
  const X=sd?8:6, W=sd?8.5:12, mid=sd?13:12;
  switch(id){
    case "suit": r(X,14,W,9,"#4a5240"); r(X,14,W,.6,"#66705a"); if(!back){ limb(g,8.6,14.6+b,mid-.6,19.6+b,.45,.45,"#2a2c24"); limb(g,15.4,14.6+b,mid+.6,19.6+b,.45,.45,"#2a2c24"); r(mid-.5,19.4,1,3,"#2a2c24"); r(8.4,19.6,2.2,1.8,"#3a4030"); r(13.4,19.6,2.2,1.8,"#3a4030"); ell(g,12,14.2+b,2.8,.8,"#7a7e74"); }
      else { limb(g,8.4,14.6+b,15.6,21+b,.45,.45,"#2a2c24"); limb(g,15.6,14.6+b,8.4,21+b,.45,.45,"#2a2c24"); r(9.6,15.4,4.8,3,"#3a4030"); } rr(6,22,12,.9,"#2a2a22"); return "#4a5240";
    case "scrapvest": poly(g,[[7,14.6+b],[12.4,14.4+b],[12,19.6+b],[7.2,19+b]],"#5a5448"); poly(g,[[12.2,14.4+b],[17,14.8+b],[16.8,18.8+b],[12,19.4+b]],"#4a4038"); poly(g,[[7.4,19.2+b],[16.6,18.8+b],[16.2,22.2],[7.8,22.2]],"#6a4a2c");
      for(const [x,y] of [[8,15.4],[11.6,15.2],[13,15.4],[16,15.6],[8.4,20],[15.6,19.8],[12,21.4]]) hp(g,x,y+b,"#b0a890"); r(7,19.2,10,.4,"#2a2420"); hp(g,10,17+b,"#8a3a1a"); hp(g,14.6,21+b,"#8a3a1a"); return null;
    case "brigandine": { const c="#3a3428", d="#2a2620"; r(X,14,W,9,c); if(!back){ poly(g,[[9.4,14.2+b],[12,18.6+b],[10.4,18.6+b],[8,14.4+b]],d); poly(g,[[14.6,14.2+b],[12,18.6+b],[13.6,18.6+b],[16,14.4+b]],d); for(let k=0;k<3;k++){ hp(g,10.4,17.4+k*1.4+b,"#a07e38"); hp(g,13.4,17.4+k*1.4+b,"#a07e38"); } r(mid-.25,18.6,.5,4,d); ell(g,12,13.9+b,3.6,1,d); }
      else { r(11.8,14.6,.5,8,d); ell(g,12,14.2+b,3.8,1.1,d); } rr(6,21.4,12,1,"#1a1814"); rr(11.2,21.4,1.6,1,"#8a8a80"); return c; }
    case "flak": { const c="#4a5038", d="#363a28"; r(X,14,W,9,c); for(let y=15.4;y<22;y+=1.5) r(X,y,W,.4,d); ell(g,12,14.1+b,4.2,1.2,"#3a3e2c"); ell(g,12,13.8+b,3.4,.6,"#5a6048"); if(f) r(11.8,14.8,.4,7,"#6a6a60"); rr(6,22,12,.9,"#2a2a22"); return null; }
    case "carrier": { const c="#3a3e34", d="#24271f"; poly(g,[[8.4,15+b],[15.6,15+b],[15.8,21.8],[8.2,21.8]],c); r(8.4,15,7.2,.5,"#565c4c"); r(8.6,14.2,1.2,1.2,c); r(14.2,14.2,1.2,1.2,c);
      if(!back){ for(let k=0;k<3;k++){ r(9+k*2.1,18.4,1.8,3,d); r(9+k*2.1,18.4,1.8,.6,"#4a5040"); hp(g,9.7+k*2.1,18+b,"#c9a24a"); } r(9.4,16,5.2,1.2,"#2e3228"); } else { r(9,15.6,6,1,"#24271f"); r(11,15,2,.8,"#6a6e64"); }
      r(6,19,2.4,3,d); r(15.6,19,2.4,3,d); return null; }
    case "hazard": r(X,14,W,9,"#7a5e1a"); r(X,14,W,.6,"#a8842a"); for(let k=0;k<W*2;k++) r(X+k/2,19.4,.5,.7,k%2?"#141210":"#e0c040"); if(!back) ell(g,12,14.1+b,2.6,.8,"#141210");
      if(back){ ell(g,12,18+b,3.6,3.8,"#5a5a50"); ell(g,12,17.6+b,3.2,3.4,"#7a7a70"); r(9.8,15.4,1.6,5,"#3a4448"); r(12.6,15.4,1.6,5,"#3a4448"); } rr(6,22,12,1,"#2a2a24"); return "#7a5e1a";
    case "exo": r(X+1,14,W-2,8,"#26282a"); if(!back){ ell(g,12,17.4+b,1.2,1.2,"#5ad0d0"); hp(g,11.7,17.1+b,"#c8ffff"); limb(g,8.6,14.4+b,8.8,21.6+b,.4,.4,"#8a8a80"); limb(g,15.4,14.4+b,15.2,21.6+b,.4,.4,"#8a8a80"); } else { r(11.5,14,1,8,"#8a8a80"); for(let y=15;y<22;y+=2) r(10.5,y,3,.5,"#6a6a60"); } rr(6,21.5,12,1,"#6a6a60"); return "#26282a";
    case "hardsuit": r(X,13.5,W,9.5,"#c0c4bc"); r(X,13.5,W,.6,"#e8ece4"); r(X,18,W,.75,"#c8761a");
      if(!back){ r(9.5,15,5,3,"#3a3e42"); r(9.5,15,5,.5,"#6a7076"); for(let k=0;k<4;k++) hp(g,10+k*1.2,16.25+b,k%2?"#5ad06a":"#e04030"); hp(g,10,19.5+b,"#fff4c0"); hp(g,14,19.5+b,"#fff4c0"); } else { ell(g,12,18+b,3.8,4,"#9a9e98"); r(9.4,15.4,2,5,"#6a6e68"); r(12.6,15.4,2,5,"#6a6e68"); } rr(6,22.4,12,.8,"#3a3e42"); return "#b0b4ac";
    case "harness": r(X+2,14,1.5,8,"#9a7a22"); r(X+W-3.5,14,1.5,8,"#9a7a22"); if(!back){ r(9.5,17,5,2.5,"#4a4e46"); r(9.5,17,5,.5,"#7a7e76"); hp(g,11.75,18+b,"#e8b048"); } else { r(11.25,14,1.5,8,"#5a5e56"); for(let y=15;y<22;y+=2) r(10.5,y,3,.5,"#3a3e36"); } rr(6,21.5,12,1,"#3a2a1a"); return null;
    case "medcoat": r(X,14,W,9,"#c8c4b4"); if(!back){ r(11,14,2,9,"#2a2826"); for(const [bx,by] of [[8.5,19],[15,21]]) hp(g,bx,by+b,"#7a1410"); r(6.2,16,1.6,1.2,"#e8e4d4"); r(6.6,16.2,.8,.8,"#b02a1c"); } else r(11.75,15,.5,7,"#a8a494"); return "#c0bcac";
    case "ossuary": { const c="#3a3c40", hi="#5e6268", d="#24262a"; r(X,14,W,9,c); for(let y=15;y<22;y+=1.6){ r(X,y,W,.5,hi); r(X,y+.5,W,.4,d); } if(!back){ ell(g,12,16.4+b,2.4,1.6,d); ell(g,12,16.2+b,2,1.2,"#4a4e54"); for(let k=0;k<4;k++) hp(g,8+k*2.6,21.4+b,"#8a8e94"); } else { r(11.4,14,1.2,8,d); } rr(6,22,12,1,d); return c; }
    case "shroud": { const c="#4a4e3a"; r(X,14,W,9,c); rr(6,22,12,6,c); for(let k=0;k<26;k++){ const v=hh(k,11,4); R(g,6+(v%24)/2,14+((v>>>5)%26)/2+(k%2?b:0),1+(v>>>9)%2,.8,(v>>>3)%2?"#3a3e2c":"#5e6448"); } ell(g,12,14.3+b,4,1.3,"#3e4230"); for(let k=0;k<12;k++) rr(6.2+k,27.6,.5,.6+(k%3)*.3,c); return c; }
    case "aegis": { const c="#1e2024", hi="#4a4e56"; r(X,14,W,9,c); r(X,14,W,.6,hi); if(!back){ limb(g,15.6,14.4+b,8.6,21.6+b,.9,.9,"#7a1a12"); limb(g,15.2,14.2+b,8.2,21.4+b,.3,.3,"#a02a1c"); for(let k=0;k<3;k++){ r(8.2+k*1.1,15.6,.8,1,["#c02a1a","#2a5aa8","#c9a24a"][k]); ell(g,8.6+k*1.1,17.4+b,.45,.45,"#c9a24a"); } r(14,16,2,.6,"#8a8e94"); }
      else { r(11.4,14,1.2,8,"#121316"); } rr(6,22,12,1,"#7a1a12"); return c; }
  } return null; }
function drawChestPads(g,id,b,view){ if(view==="s"){ if(["flak","ossuary","aegis","hardsuit"].includes(id)){ const c={flak:"#4a5038",ossuary:"#3a3c40",aegis:"#1e2024",hardsuit:"#c0c4bc"}[id]; ell(g,12.4,15.4+b,2.6,2,shade(c,.8)); ell(g,12.2,15.1+b,2.4,1.7,c); } return; }
  const pad=(x,c,hi,lo,big)=>{ ell(g,x,15+b,big?2.9:2.4,big?2.2:1.8,lo); ell(g,x-.2,14.7+b,big?2.7:2.2,big?1.9:1.5,c); ell(g,x-.6,14+b,1.2,.5,hi); };
  switch(id){
    case "flak": for(const x of [6.8,17.2]){ pad(x,"#4a5038","#66705a","#30352a"); R(g,x-2,15+b,4,.35,"#30352a"); } break;
    case "ossuary": for(const x of [6.6,17.4]){ pad(x,"#3a3c40","#6a6e76","#1a1c1e",true); R(g,x-2.4,15.4+b,4.8,.4,"#5e6268"); hp(g,x,16.4+b,"#8a8e94"); } break;
    case "aegis": for(const x of [6.8,17.2]){ pad(x,"#1e2024","#4a4e56","#0e0f10"); for(let k=0;k<5;k++) R(g,x-1.8+k*.9,16.4+b,.4,1.2,"#c9a24a"); } break;
    case "hardsuit": for(const x of [6.8,17.2]) pad(x,"#c0c4bc","#f0f4ec","#7a7e78",true); break;
  } }
function drawCrest(g,b,L,col){ const vis=VISOR(L);
  switch(L.k||"plume"){
    case "plume": R(g,11.4,1.8+b,1.2,4,col); R(g,11.4,1.8+b,.4,4,shade(col,1.3)); break;                                          // painted stripe
    case "antenna": R(g,16.4,-1.5+b,.5,5,"#6a6a60"); hp(g,16.4,-1.5+b,vis); R(g,16,3+b,1.4,.8,"#3a3a34"); break;
    case "fin": ell(g,17.8,7.4+b,1,1.6,"#3a3c36"); R(g,17.4,6.4+b,.8,.5,"#6a6c64"); R(g,18.2,3.4+b,.4,3,"#5a5a50"); hp(g,17.6,8+b,"#5ad06a"); break;  // comms rig
    case "horns": for(const x of [8.6,12,15.4]) limb(g,x,3.2+b,x+(x-12)*.15,-.2+b,.7,.15,"#9a9e98"); break;                       // raider spikes
    case "halo": skull(g,10,3.2+b,"#e8e0d0","#1a1814"); break;                                                                     // skull decal
  } }
// helmets cover the head box (6.5..17.5 x 2.5..13)
function drawHelmet(g,id,b,L,view){ view=view||"f"; const r=(x,y,w,h,c)=>R(g,x,y+b,w,h,c), vis=VISOR(L), cl=CLOAK(L)[1], f=view==="f", bk=view==="b", sd=view==="s";
  const dome=(c,hi,lo,y0=2.5,y1=12.5)=>{ const cy=(y0+y1)/2, ry=(y1-y0)/2+.4; ell(g,12,cy+b,6,ry,lo); ell(g,11.6,cy-.2+b,5.8,ry-.2,c); ell(g,10,cy-ry*.45+b,2.6,ry*.35,hi); ell(g,10.4,cy-ry*.38+b,2.4,ry*.3,c); };
  const lens=(x,y,rx,c)=>{ ell(g,x,y+b,rx+.35,rx+.3,"#121410"); ell(g,x,y+b,rx,rx-.05,c); hp(g,x-rx*.5,y-rx*.4+b,"#ffffff"); };
  // stormer: flared steel helmet over a gas mask
  const stormer=(hc,hH,hS,maskC,lensC,skullPaint)=>{
    if(bk){ ell(g,12,6.4+b,6.1,4.8,hc); poly(g,[[5.2,7.2+b],[18.8,7.2+b],[19.4,12.4+b],[4.6,12.4+b]],hS); poly(g,[[5.6,7.2+b],[18.4,7.2+b],[18.9,11.8+b],[5.1,11.8+b]],hc); r(5.4,7,13.2,.6,hH); return; }
    if(sd){ ell(g,12.4,5.8+b,5.8,4.4,hc); poly(g,[[6,6.6+b],[12,6.6+b],[11.4,12.4+b],[5.2,12.6+b]],hc); r(6,6.6,11.6,.7,hH); ell(g,15.6,10+b,2.6,2.8,maskC); lens(15.8,8.8,.9,lensC); ell(g,17.4,12.2+b,1,1.1,"#3a3c36"); hp(g,17.4,12.2+b,"#121410"); return; }
    ell(g,12,5.6+b,6.2,4.2,hS); ell(g,11.8,5.3+b,6,3.9,hc); ell(g,10.2,3.8+b,2.4,1.2,hH);
    poly(g,[[5.6,6.6+b],[7.6,6.6+b],[7.4,11.6+b],[4.8,12.2+b]],hc); poly(g,[[16.4,6.6+b],[18.4,6.6+b],[19.2,12.2+b],[16.6,11.6+b]],hS);
    ell(g,12,10.5+b,4,2.9,maskC); ell(g,11.7,10.2+b,3.6,2.5,shade(maskC,1.12));
    if(skullPaint){ ell(g,12,10.3+b,3.2,2.4,"#d8cdb4"); ell(g,11.4,9.8+b,1.6,.8,"#f0e6d0"); r(11.6,10.6,.8,.8,"#1a1814"); for(let k=0;k<6;k++) r(9.6+k*.85,11.8,.45,.9,k%2?"#1a1814":"#e8dcc4"); }
    lens(10.1,9.3,1.05,lensC); lens(13.9,9.3,1.05,lensC); ell(g,12,12.7+b,1.15,1,"#3a3c36"); ell(g,12,12.7+b,.55,.5,"#121410");
    r(5.6,7,12.8,.7,hH); hp(g,6.6,8+b,"#9a9e96"); hp(g,17.4,8+b,"#6a6e66"); };
  switch(id){
    case "visor": dome("#4a4e44","#6e7366","#2c2f28",2,13);
      if(f){ r(7.6,7,8.8,1.8,"#0c0f0e"); r(8,7.4,8,1,vis); r(8.2,7.4,2.6,.4,"#ffffff"); ell(g,12,11.6+b,2.8,1.7,"#2e302a"); for(const x of [9.6,14.4]){ ell(g,x,12+b,1,1,"#3e403a"); ell(g,x,12+b,.45,.45,"#121410"); } ell(g,6.3,8.8+b,1,1.6,"#34362f"); ell(g,17.7,8.8+b,1,1.6,"#26281f"); }
      else if(sd){ r(11.4,7,6.4,1.8,"#0c0f0e"); r(11.8,7.4,5.8,1,vis); ell(g,15.2,11.6+b,2.2,1.6,"#2e302a"); ell(g,16.6,12+b,.9,.9,"#3e403a"); ell(g,9.8,8.8+b,1.2,1.7,"#34362f"); }
      else { r(8.6,5.6,6.8,4.6,"#34372f"); for(let k=0;k<3;k++) r(9.2,6.4+k*1.2,5.6,.4,"#1a1c18"); limb(g,12,10.2+b,12,13.4+b,.5,.5,"#2a2a26"); }
      drawCrest(g,b,L,cl); break;
    case "welder": r(6.2,7.4,11.6,.9,"#2a2016");
      if(f){ poly(g,[[7.8,5.4+b],[16.4,5+b],[17,10.8+b],[13.6,13+b],[10.4,13+b],[7.2,11+b]],"#5a5448"); poly(g,[[12,5.2+b],[16.4,5+b],[17,10.8+b],[13.6,13+b],[12,13+b]],"#4a463c"); r(7.8,5.4,8.6,.5,"#7a7262");
        lens(9.9,8.2,1.25,"#d8a040"); lens(14.1,8.2,1.25,"#d8a040"); for(let k=0;k<4;k++) r(10.6+k*.8,10.8,.4,1.6,"#121210"); for(const [x,y] of [[8.4,6.2],[15.8,6],[8.2,10.4],[16.2,10.2],[12,12.4]]) hp(g,x,y+b,"#a8a090"); hp(g,12,5.6+b,"#8a3a1a"); }
      else if(sd){ poly(g,[[12,5.4+b],[17.4,5.6+b],[17.6,11+b],[14.6,13+b],[12,12.6+b]],"#5a5448"); lens(15.2,8.2,1.2,"#d8a040"); for(let k=0;k<3;k++) r(15+k*.8,10.8,.4,1.6,"#121210"); }
      else { ell(g,12,7.8+b,1.2,.8,"#6a5a3a"); } break;
    case "flakhelm": ell(g,12,6.2+b,7.2,1.3,"#363c2e"); ell(g,12,5.9+b,7,1,"#4a5040"); ell(g,12,4.4+b,5.6,3.3,"#4a5040"); ell(g,10.4,3+b,2.2,1,"#626a56");
      for(let y=2;y<6;y+=1) for(let x=7.5;x<16.5;x+=1.2) hp(g,x+(y%2)*.6,y+b,"#2a2e22");
      if(!bk){ r(7,4,10,.9,"#2a2a24"); if(f){ lens(9.6,4.4,1,"#c9a24a"); lens(14.4,4.4,1,"#c9a24a"); r(7,6.8,.5,4.6,"#2a2a24"); r(16.5,6.8,.5,4.6,"#2a2a24"); } else { lens(15,4.4,1,"#c9a24a"); r(10,6.8,.5,4.6,"#2a2a24"); } } break;
    case "gasmask": dome("#2e3228","#4a5040","#1a1e16",2.2,13.4);
      if(f){ poly(g,[[7.4,3.4+b],[16.6,3.4+b],[16,5.8+b],[8,5.8+b]],"#4a4e44"); r(7.4,3.4,9.2,.5,"#6a6e64"); hp(g,8,4.6+b,"#9a9e96"); hp(g,16,4.6+b,"#9a9e96");
        ell(g,12,9.6+b,4.3,3.7,"#3e4038"); lens(9.8,8.6,1.35,vis); lens(14.2,8.6,1.35,vis);
        for(const x of [7.2,16.8]){ ell(g,x,11.4+b,1.6,1.4,"#55574e"); ell(g,x,11.4+b,1.1,.95,"#3a3c36"); for(let k=0;k<3;k++) R(g,x-.8+k*.6,11+b,.3,.9,"#1a1c18"); } ell(g,12,12.2+b,1.1,.9,"#2a2a24"); hp(g,12,12+b,"#6a6a60"); }
      else if(sd){ poly(g,[[10,3.4+b],[17,3.6+b],[16.6,5.8+b],[10,5.8+b]],"#4a4e44"); ell(g,14.6,9.8+b,3,3.4,"#3e4038"); lens(15.2,8.6,1.2,vis); ell(g,17.4,11.8+b,1.5,1.4,"#55574e"); ell(g,17.4,11.8+b,1,.9,"#3a3c36"); }
      else { limb(g,7.4,6+b,16.6,11+b,.3,.3,"#1a1c16"); limb(g,16.6,6+b,7.4,11+b,.3,.3,"#1a1c16"); ell(g,12,8.5+b,.9,.9,"#4a4e44"); } break;
    case "sallet": stormer("#4e5248","#72786a","#30332c","#3a3c34",vis,false); if(!bk) drawCrest(g,b,L,cl); break;
    case "deathmask": stormer("#1e1f22","#3e4046","#0e0f10","#1a1a1c","#ff3a26",true); break;
    case "cowl": dome("#1a1c1a","#2e302c","#0c0d0c",2,13.8); ell(g,12,.9+b,2,1.4,"#1a1c1a");
      if(f){ ell(g,12,9.2+b,4.1,3.8,"#060706"); r(10,6,4,1,"#3a3c38"); for(const [x,y] of [[9.4,8.5],[11.2,8],[12.8,8],[14.6,8.5]]){ ell(g,x,y+b,.95,.95,"#2a2c28"); ell(g,x,y+b,.55,.55,"#7cff7a"); hp(g,x-.2,y-.2+b,"#e0ffe0"); } }
      else if(sd){ ell(g,14,9.4+b,3.4,3.8,"#060706"); for(const y of [7.6,9]){ limb(g,14.4,y+b,17.6,y+b,.55,.5,"#2a2c28"); hp(g,17.8,y+b,"#7cff7a"); } }
      else { r(9,10.5,6,.5,"#2e302c"); } break;
    case "halohelm": dome("#24262a","#3e4146","#121316",2.5,13);
      if(!bk){ limb(g,10.2,11.6+b,8.4,15+b,.55,.5,"#2a2a26"); limb(g,13.8,11.6+b,15.6,15+b,.55,.5,"#2a2a26"); for(let k=0;k<4;k++){ hp(g,9.8-k*.45,12.4+k*.75+b,"#4a4a44"); hp(g,14.2+k*.45,12.4+k*.75+b,"#4a4a44"); }
        ell(g,12,11.4+b,2.5,1.6,"#3a3c40"); if(f){ lens(9.9,8.7,1.15,"#ff3a26"); lens(14.1,8.7,1.15,"#ff3a26"); } else lens(15,8.7,1.1,"#ff3a26"); }
      ell(g,12,4.4+b,6.6,2.9,"#2e3034"); ell(g,11.6,3.8+b,5.8,2.2,"#3a3d42"); r(5.6,5.4,12.8,1,"#7a1a12"); r(5.6,5.4,12.8,.4,"#a02a1c");
      if(!bk){ ell(g,sd?14:12,6.9+b,sd?4:5.6,.9,"#0e0e10"); skull(g,sd?12.6:10,2.6+b,"#c9a24a","#3a2a10"); } break;
    case "eva": { const ring="#a8d8e8"; R(g,5.5,1.5+b,13,.5,ring); R(g,5,2+b,.5,10.5,ring); R(g,18.5,2+b,.5,10.5,ring); R(g,6,1+b,12,.5,"rgba(168,216,232,.6)"); R(g,7,2.5+b,2,.5,"#ffffff"); R(g,6,3.5+b,.5,2,"#ffffff");
      ell(g,12,13.2+b,6,1,"#8a8e86"); r(6.4,12.6,11.2,.5,"#c0c4bc"); for(let k=0;k<5;k++) hp(g,7+k*2.4,13.4+b,"#3a3e42"); break; }
    case "hardhat": ell(g,12,6+b,7,1.1,"#9a7a1a"); ell(g,12,4.2+b,5.6,3.2,"#c8a02a"); ell(g,10.4,3+b,2.2,1,"#e8c050"); r(11.5,1.4,1,4.4,"#a8841e");
      if(!bk){ const lx2=sd?15:12; ell(g,lx2,3.8+b,1.5,1.2,"#3a3a34"); ell(g,lx2,3.8+b,.95,.75,"#fff4c0"); hp(g,lx2-.3,3.6+b,"#ffffff"); } break;
    case "pilothelm": dome("#2e3236","#4e5458","#16181a"); r(11,2,2,4,CLOAK(L)[0]); r(11,2,2,.5,CLOAK(L)[1]);
      if(f){ r(7.5,6,9,4.5,"#1a2a30"); r(7.5,6,9,.75,"#5aa0b8"); r(8,6.75,3,.5,"#c8f0ff"); r(16.5,9.5,1.5,1,"#3a3e42"); r(14.5,11.5,3,.5,"#3a3e42"); hp(g,14,11.25+b,"#e04030"); }
      else if(sd){ r(11.5,6,6,4.5,"#1a2a30"); r(11.5,6,6,.75,"#5aa0b8"); r(16,11.5,2,.5,"#3a3e42"); r(8,7,2,2.5,"#3a3e42"); } else { r(8.5,6,7,4,"#24282c"); for(let k=0;k<3;k++) r(9,7+k*1.2,6,.5,"#16181a"); } break;
  } }
function drawAccBack(g,id,b,L,view){ const cl=CLOAK(L), bk=view==="b", sd=view==="s";
  switch(id){
    case "cape": if(bk){ R(g,6.5,13.5+b,11,15-b,cl[0]); R(g,6.5,13.5+b,11,.75,cl[1]); for(let k=0;k<4;k++) R(g,8+k*2.5,15+b,.5,13-b,shade(cl[0],.75)); R(g,6.5,28,2,1,cl[0]); R(g,10,28,1.5,1.5,cl[0]); R(g,14,28,2,1,cl[0]); }
      else if(sd){ R(g,4.5,13.5+b,4.5,14-b,cl[0]); R(g,4.5,13.5+b,.75,13-b,cl[1]); R(g,3.5,25,2,2,cl[0]); }
      else { R(g,4.5,14+b,2,13.5-b,cl[0]); R(g,17.5,14+b,2,13.5-b,cl[0]); R(g,4.5,14+b,.75,13-b,cl[1]); } break;
    case "drone": { const y=(b?.5:0); R(g,0,1+y,6,.75,"#8a8a80"); R(g,1,1.75+y,4,3.5,"#d8cdb4"); R(g,1,1.75+y,4,.75,"#f0e8d4"); R(g,3.5,3+y,1,1,"#ff3a26"); R(g,1.5,3+y,1,1,"#0a0806"); R(g,1.5,4.75+y,3,.5,"#8a8068"); R(g,2.5,5.25+y,1,1.5,"#5a5a50"); break; }
    case "lamp": if(!bk){ R(g,sd?8:15.5,11.5+b,3,3,"#3a3a34"); R(g,sd?8:15.5,11.5+b,3,.75,"#5a5a50"); R(g,sd?10.5:16.5,12.5+b,1,1,"#ffe080"); } else { R(g,15.5,11.5+b,3,3,"#3a3a34"); } break;
    case "oxytank": if(sd){ R(g,4.5,13.5+b,3.5,8,"#d8dcd8"); R(g,4.5,13.5+b,.75,8,"#ffffff"); R(g,5,12.5+b,2.5,1,"#8a8e86"); } break;
    case "scarf": if(bk){ R(g,9,13+b,6,1.5,cl[0]); R(g,13,14+b,2,4,cl[0]); R(g,13,14+b,.5,4,cl[1]); } break;
  } }
function drawAccFront(g,id,b,L,view){ const r=(x,y,w,h,c)=>R(g,x,y+b,w,h,c), cl=CLOAK(L), bk=view==="b", sd=view==="s";
  switch(id){
    case "scarf": { const t="#a8946a", d="#5a4a30"; if(!bk){ ell(g,sd?13:12,13.4+b,sd?3.4:4.4,1.6,t); for(let k=0;k<6;k++) hp(g,(sd?10.6:8.6)+k*1.3,13.2+(k%2)*.6+b,d); r(sd?10:8.6,14.4,2,3.4,t); r(sd?10:8.6,14.4,2,.4,d); r(sd?10:8.6,15.6,2,.4,d); } break; }
    case "bandolier": for(let k=0;k<8;k++){ const x=bk?8+k:16-k; r(x,14+k,1.5,1,"#4a3020"); if(!bk&&k%2===0) r(x+.25,14+k,.75,.75,"#c9a24a"); } break;
    case "seals": if(!bk){ const x0=sd?13.4:13; for(let k=0;k<3;k++) r(x0+k*.9,15,.7,1,["#c02a1a","#2a5aa8","#c9a24a"][k]); ell(g,x0+.4,17+b,.5,.5,"#c9a24a"); ell(g,x0+1.6,17+b,.5,.5,"#a8acb0"); } break;
    case "charm": if(!bk){ limb(g,10.6,13.6+b,12,17+b,.15,.15,"#8a8e86"); limb(g,13.4,13.6+b,12,17+b,.15,.15,"#8a8e86"); r(11.4,17,1.2,1.6,"#b0b4ac"); r(12.2,17.4,1.1,1.5,"#9a9e96"); } break;
    case "censer": { const x=bk?15.4:7.6; ell(g,x,24.2,1.2,1.8,"#3a6a8a"); ell(g,x-.3,23.6,.5,1,"#7ac0e0"); R(g,x-1.2,22.2,2.4,.6,"#8a8e86"); limb(g,x,22.4,x+(bk?-2:2),21.6,.25,.25,"#2a2a26"); break; }
    case "oxytank": if(bk){ for(const tx of [8.5,12.5]){ r(tx,13.5,3,9,"#d8dcd8"); r(tx,13.5,.75,9,"#ffffff"); r(tx+2.25,14,.75,8.5,"#8a8e86"); r(tx,17,3,.75,"#2a6aa8"); r(tx+.75,12.5,1.5,1,"#8a8e86"); } } else if(!sd){ r(7.5,13.5,1,3,"#2a2a26"); r(15.5,13.5,1,3,"#2a2a26"); } break;
    case "toolbelt": R(g,7,21.75,10,1.5,"#4a3020"); R(g,7,21.75,10,.5,"#6a4a30"); if(!bk){ R(g,7.5,22.5,2,2.5,"#3a2414"); R(g,14.5,22.5,2,2.5,"#3a2414"); R(g,15.25,23,.5,3,"#8a8a80"); } else { R(g,9,22.5,2,2,"#3a2414"); R(g,13,22.5,2,2,"#3a2414"); } break;
  } }
// packs: carried on your back
function drawPackOn(g,pk,b,view){ if(!pk) return; const r=(x,y,w,h,c)=>R(g,x,y+b,w,h,c), bk=view==="b", sd=view==="s";
  const col={sling:["#4a3a26","#6a5436"],field:["#3e4a32","#5a6a48"],hauler:["#4a4a3a","#6a6a56"],mule:["#5a5a60","#8a8a92"],bottomless:["#2a1a3a","#4a2e66"]}[pk]||["#4a3a26","#6a5436"];
  if(bk){ if(pk==="sling"){ r(13,16,4,4.5,col[0]); r(13,16,4,.75,col[1]); r(8,14,1,8,"#2a2016"); return; }
    const big=pk==="hauler"||pk==="mule"; r(big?7.5:8.5,big?13:14.5,big?9:7,big?10:7.5,col[0]); r(big?7.5:8.5,big?13:14.5,big?9:7,.75,col[1]); r(9.5,16.5,5,2,shade(col[0],.75)); r(9.5,16.5,5,.5,col[1]);
    if(pk==="mule"){ r(7,12,.75,11.5,"#8a8a92"); r(16.25,12,.75,11.5,"#8a8a92"); r(7,12,10,.75,"#8a8a92"); }
    if(pk==="bottomless"){ hp(g,11.75,18+b,"#b070ff"); hp(g,12.25,18.5+b,"#e0b0ff"); }
    if(pk==="hauler"){ r(7,12.5,.5,11,"#3a3a2e"); r(16.5,12.5,.5,11,"#3a3a2e"); } return; }
  if(sd){ if(pk==="sling") r(7,18,2.5,4,col[0]); else { r(4,14,4.5,pk==="hauler"||pk==="mule"?9:7,col[0]); r(4,14,4.5,.75,col[1]); } return; }
  r(8.75,14,.75,6,"#2a2016"); r(14.5,14,.75,6,"#2a2016"); }
function drawPauldron(g,b,view){ const x=view==="s"?12.4:(view==="b"?6.6:17.4); ell(g,x,15+b,2.8,2.2,"#2a2a26"); ell(g,x-.2,14.7+b,2.6,1.9,"#5a5a54"); ell(g,x-.6,14+b,1.2,.5,"#8a8a82"); for(const dx of [-1.2,0,1.2]) limb(g,x+dx,13.2+b,x+dx*1.3,10.8+b,.45,.1,"#b8bcb4"); }
// ---------- smooth shape primitives (half-pixel accurate) ----------
const snap=v=>Math.round(v*2)/2;
function ell(g,cx,cy,rx,ry,c){ g.fillStyle=c; for(let y=-ry;y<=ry+.01;y+=.5){ const w=rx*Math.sqrt(Math.max(0,1-(y*y)/(ry*ry+.0001))); const x0=snap(cx-w), x1=snap(cx+w); if(x1>x0) g.fillRect(x0,snap(cy+y),x1-x0,.5); } }
function limb(g,x0,y0,x1,y1,r0,r1,c){ const L=Math.hypot(x1-x0,y1-y0), n=Math.max(1,Math.ceil(L*2)); for(let i=0;i<=n;i++){ const t=i/n, r=r0+(r1-r0)*t; ell(g,x0+(x1-x0)*t,y0+(y1-y0)*t,r,r,c); } }
function poly(g,pts,c){ g.fillStyle=c; let y0=1e9,y1=-1e9; for(const p of pts){ y0=Math.min(y0,p[1]); y1=Math.max(y1,p[1]); }
  for(let y=snap(y0);y<y1;y+=.5){ const yc=y+.25, xs=[]; for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; if((a[1]<=yc&&b[1]>yc)||(b[1]<=yc&&a[1]>yc)) xs.push(a[0]+(yc-a[1])*(b[0]-a[0])/(b[1]-a[1])); }
    xs.sort((p,q)=>p-q); for(let i=0;i+1<xs.length;i+=2){ const a=snap(xs[i]), b=snap(xs[i+1]); if(b>a) g.fillRect(a,y,b-a,.5); } } }
function drawHuman(g,{step=0,b=0,view="f"},L){
  const ST=Items.STYLE, pick=(arr,i,d)=>arr[i]!=null?arr[i]:arr[d];
  const SYN=!!L.syn, sk=SYN?["#8e989f","#c9cdcc","#34383e"][(L.s|0)%3]:pick(ST.skin,L.s,1), skS=shade(sk,.8), skD=shade(sk,.66), skH=shade(sk,1.1), hc=pick(ST.hairCol,L.hc,1), hcH=shade(hc,1.45), hcD=shade(hc,.62), eye=pick(ST.eyes,L.e,0);
  const tc=pick(ST.cloth,L.tc,0), tcH=shade(tc,1.3), tcS=shade(tc,.7), bc=pick(ST.cloth,L.bc,4), bt=pick(ST.cloth,L.bt,4), btD=shade(bt,.55), btH=shade(bt,.95);
  const top=STY_NM(ST.top,L.t,"coverall"), bot=STY_NM(ST.bottom,L.b,"fatigues"), boots=STY_NM(ST.boots,L.bs,"workboots"), hair=STY_NM(ST.hair,L.h,"short"), face=STY_NM(ST.face,L.f,"clean");
  const fem=STY_NM(ST.body,L.g,"male")==="female";
  const suitLegs=top==="coverall"||top==="undersuit", shorts=bot==="shorts"&&!suitLegs, lc=suitLegs?tc:bc, lcH=shade(lc,1.25), lcS=shade(lc,.72);
  const HD=L.hd, CH=L.a, LG=L.lg, AC=L.ac, f=view==="f", bk=view==="b", sd=view==="s", U=(x,y,w,h,c)=>R(g,x,y+b,w,h,c);
  const ov=cvs(24,32), og=ov.getContext("2d"), O=(x,y,w,h,c)=>R(og,x,y+b,w,h,c);       // overlay layer, trimmed to the body
  if(AC&&!(AC==="cape"&&bk)) drawAccBack(g,AC,b,L,view);
  if(CH==="hazard"&&sd){ ell(g,6.5,18+b,1.8,4,"#5a5a50"); }
  // ---------- legs ----------
  const legs=sd?[[9.5+(step===1?-1.5:step===2?1.5:0),0,true],[12.5+(step===1?1.5:step===2?-1.5:0),0,false]]:[[8.6,step===1?1:0,false],[12.4,step===2?1:0,false]];
  for(const [lx,lift,far] of legs){ const bt0=27.6-lift, cx=lx+1.5, k=far?.78:1, pc=shade(lc,k);
    limb(g,cx,23.2,cx+(sd?.3:0),25.8,fem?1.5:1.6,fem?1.3:1.45,pc); limb(g,cx+(sd?.3:0),25.8,cx+(sd?.2:0),bt0,1.45,1.25,shorts?shade(sk,k):pc);
    if(shorts) ell(g,cx,24.6,1.6,1.3,pc);
    // boots: rounded toe
    const toe=sd?1:0, bc2=boots==="magboots"?shade("#3a3e42",k):boots==="wraps"?shade("#6a604a",k):shade(btD,k);
    poly(g,[[cx-1.6,bt0-.6],[cx+1.6,bt0-.6],[cx+1.9+toe,bt0+2.4],[cx-1.9,bt0+2.4]],bc2); ell(g,cx+toe*.6,bt0+2.1,2+toe*.6,1,bc2); R(g,cx-2.1,bt0+2.6,4.2+toe,.5,"#0e0d0b");
    if(!far){ R(og,cx-1.4,23.2,.6,bt0-23.5,lcH); if(!LG){ if(bot==="fatigues"&&!suitLegs){ R(og,cx-.9,24.1,2,1.6,lcS); R(og,cx-.9,24.1,2,.5,lcH); } else if(bot==="workpants"&&!suitLegs){ ell(og,cx,25.8,1.4,.9,shade(lc,.6)); } else if(top==="undersuit") ell(og,cx,25.8,1.3,.8,"#3a3e42"); }
      if(boots==="magboots"){ R(og,cx-2,bt0,4.2,.7,"#6a7076"); R(og,cx-2,bt0+1.6,4.2,.6,shade(bt,1.2)); R(og,cx-2,bt0+2.1,4.4,.5,"#5ad0d0"); }
      else if(boots==="wraps"){ for(let i=0;i<3;i++) R(og,cx-2,bt0+i*.8,4.2,.4,shade(bt,1.1)); }
      else { R(og,cx-2,bt0-.6,4.2,.6,btH); if(f){ ell(og,cx,bt0+1.9,1.4,.6,"#7a7a72"); hp(og,cx-.5,bt0+.4,"#8a8070"); hp(og,cx+.3,bt0+.9,"#8a8070"); } } }
    if(LG) drawLegPiece(og,LG,lx,lift,far); }
  // coats and robes hang over the legs
  const skirt={shroud:27.8,medcoat:26.8,brigandine:27.2}[CH];
  if(skirt) poly(g,[[7.8,22.3],[16.2,22.3],[16.9,skirt],[7.1,skirt]],CH==="shroud"?"#4a4e3a":CH==="medcoat"?"#c8c4b4":"#3a3428");
  // ---------- torso ----------
  const tcol=top==="jacket"?shade(tc,.85):tc, cl2=CLOAK(L);
  if(sd){ poly(g,[[8.4,14.6+b],[15.4,14.6+b],[15.6,22.9],[8.6,22.9]],tcol); ell(g,14.6,17.2+b,1.5,2.3,tcol); ell(g,9.6,15.6+b,1.6,1.3,tcol); }
  else if(fem){ poly(g,[[7.7,14.8+b],[16.3,14.8+b],[15.3,20.4+b],[16,22.9],[8,22.9],[8.7,20.4+b]],tcol); ell(g,8.2,15.6+b,1.5,1.25,tcol); ell(g,15.8,15.6+b,1.5,1.25,tcol);
    if(f){ ell(og,10.3,17.3+b,1.7,1.2,shade(tcol,1.12)); ell(og,13.7,17.3+b,1.7,1.2,shade(tcol,1.06)); ell(og,10.3,18.5+b,1.4,.35,shade(tcol,.8)); ell(og,13.7,18.5+b,1.4,.35,shade(tcol,.8)); } }
  else { poly(g,[[7,14.7+b],[17,14.7+b],[16,22.9],[8,22.9]],tcol); ell(g,7.7,15.6+b,1.75,1.4,tcol); ell(g,16.3,15.6+b,1.75,1.4,tcol); }
  // shirt details (on the overlay, so they follow the body's shape)
  O(6,14.4,1.2,8.5,tcH); O(16.4,15,1.2,8,tcS);
  switch(top){
    case "coverall": if(f){ ell(og,12,14.6+b,2.6,.8,tcH); O(11.75,15,.5,7.5,"#8a8a80"); O(8.6,16,2,1.7,cl2[0]); O(8.6,16,2,.5,cl2[1]); O(13.2,16,2.4,.75,"#d8d0bc"); O(8.5,19.8,7,.5,tcS); } else if(bk){ ell(og,12,14.6+b,2.6,.8,tcH); O(9.5,15.8,5,2.5,shade(tc,.86)); O(10,16.4,4,.5,"#d8d0bc"); } else { O(13,14.4,3,.8,tcH); O(13.8,16.2,1.5,1.5,cl2[0]); } break;
    case "jacket": if(!bk){ ell(og,12,14.4+b,4.2,1.4,"#b8a078"); ell(og,11.4,14.1+b,3,.7,"#d8c098"); if(f){ O(11.75,15.5,.5,6.6,"#8a8a80"); O(8.6,17,2.4,1.4,shade(tc,.7)); O(13,17,2.4,1.4,shade(tc,.7)); } } else { ell(og,12,14.4+b,4,1.1,"#b8a078"); O(8.5,16.5,7,.5,shade(tc,.7)); }
      O(6,21.8,12,1,shade(tc,.6)); break;
    case "hivis": { const vc="#c8761a", ref="#d8dcd8"; if(f){ ell(og,12,14.6+b,1.6,1,sk); O(6,14,4.5,9,vc); O(13.5,14,4.5,9,vc); O(6,17.3,4.5,.75,ref); O(13.5,17.3,4.5,.75,ref); O(6,20.3,4.5,.75,ref); O(13.5,20.3,4.5,.75,ref); }
      else if(bk){ O(6,14,12,9,vc); O(6,17.3,12,.75,ref); O(6,20.3,12,.75,ref); } else { O(8.6,14,8,9,vc); O(8.6,17.3,8,.75,ref); } break; }
    case "undersuit": for(let y=15.5;y<22;y+=1) O(7,y,10,.25,tcS); if(!sd){ ell(og,12,14.2+b,2.9,.9,"#8a8e86"); ell(og,12,13.9+b,2.4,.4,"#c0c4bc"); } if(f){ O(11.5,15,1,7,shade(tc,.6)); hp(og,11.75,16+b,"#5ad0d0"); } break;
    case "singlet": if(f){ ell(og,7.7,15.4+b,1.9,1.6,sk); ell(og,16.3,15.4+b,1.9,1.6,sk); ell(og,12,14.6+b,2.3,1.2,sk); } else if(bk){ ell(og,7.7,15.4+b,1.9,1.5,sk); ell(og,16.3,15.4+b,1.9,1.5,sk); } else ell(og,14,15+b,1.8,1.2,sk);
      for(let k=0;k<8;k++){ O((bk?8:15.5)-k*.95,15.2+k,1,.75,"#4a3020"); O((bk?16:8.5)+k*.95,15.2+k,1,.75,"#4a3020"); } if(!sd) O(11.5,18.6,1,1,"#a07e38"); break; }
  O(6,22.1,12,.9,"#2e2418"); O(6,22.1,12,.4,"#3e3224"); if(f){ O(11.25,22.1,1.5,.9,"#a37a32"); hp(og,11.5,22.1+b,"#e8c868"); }
  const sleeve=CH?drawChest(og,CH,b,L,view):null;
  // ---------- arms (shoulder -> elbow -> wrist, rounded) ----------
  const full=top==="coverall"||top==="jacket"||top==="undersuit", tcA=top==="jacket"?shade(tc,.85):tc;
  const up=sleeve||(top==="singlet"?sk:tcA), low=sleeve||(full?tcA:sk), glove=top==="undersuit"&&!sleeve?"#2a2a26":null;
  const ar=fem?.88:1, fsx=fem&&!sd?.6:0;
  const arm=(s0,e0,w0,far)=>{ const sh=v=>[v[0]+(v[0]<12?fsx:-fsx),v[1]], s=sh(s0), e=sh(e0), w=sh(w0), k=far?.8:1; limb(g,s[0],s[1]+b,e[0],e[1]+b,1.25*ar,1.1*ar,shade(up,k)); limb(g,e[0],e[1]+b,w[0],w[1]+b,1.1*ar,.95*ar,shade(low,k)); ell(g,w[0],w[1]+.7+b,1.05*ar,.95*ar,glove||shade(sk,k));
    if(!far){ limb(og,s[0]-.5,s[1]+b,e[0]-.5,e[1]+b,.35,.3,shade(up,1.25)); } };
  const sw=step===1?.8:step===2?-.8:0;
  if(L.w){ if(f){ gunPix(g,L.w,4,17.5+b); arm([7,15.6],[5.9,18.3],[7.4,19.6]); arm([17,15.6],[18.1,18.3],[16.4,19.9]); }
    else if(sd){ arm([10.4,15.6],[10.2,18.4],[12,19.6],true); gunPix(g,L.w,9,16+b); arm([13,15.6],[13.6,18.4],[16.2,19.4]); }
    else { arm([7,15.6],[6.4,18.6],[6.6,21.3]); arm([17,15.6],[17.6,18.6],[17.4,21.3]); } }
  else if(sd){ arm([10.4,15.6],[10.2-sw,18.6],[10.6-sw*1.4,21.3],true); arm([13,15.6],[13.2+sw,18.6],[13+sw*1.4,21.3]); }
  else { arm([7,15.6],[6.4,18.6+sw],[6.6,21.3+sw]); arm([17,15.6],[17.6,18.6-sw],[17.4,21.3-sw]); }
  if(CH) drawChestPads(g,CH,b,view);
  if(L.w&&bk) gunPix(g,L.w,4,13.5+b);
  if(L.pk&&bk) drawPackOn(g,L.pk,b,view);
  if(AC==="cape"&&bk) drawAccBack(g,AC,b,L,view);
  // ---------- neck and head ----------
  g.save(); g.globalCompositeOperation="source-atop"; g.drawImage(ov,0,0); g.restore();     // clothes details, trimmed to the body
  ell(g,12,13.6+b,fem?1.6:1.9,1.3,skS);
  const hx=sd?12.3:12, open=!HD||HD==="welder"||HD==="flakhelm"||HD==="eva"||HD==="hardhat", hasHair=open&&hair!=="none";
  const jawR=fem?[3.9,3]:[4.6,3.3], headR=fem?[5.3,5.3]:[5.5,5.4];
  ell(g,hx,7.4+b,headR[0],headR[1],sk); ell(g,hx+(sd?.8:0),10.1+b,jawR[0],jawR[1],sk);
  if(f||bk){ ell(g,6.7,8.8+b,.75,1.2,sk); ell(g,17.3,8.8+b,.75,1.2,skS); hp(g,6.7,8.8+b,skD); hp(g,17.1,8.8+b,skD); } else { ell(g,10.3,9.2+b,.9,1.3,sk); hp(g,10.4,9.2+b,skD); }
  const hl=pick(ST.hairCol,L.hc,1), hlH=shade(hl,1.45), hlD=shade(hl,.62), FH=STY_NM(ST.facialHair,L.fh,"none"), FM=STY_NM(ST.marks,L.fm,"none"), EY=STY_NM(ST.eyeShape,L.ey,"normal"), BR=STY_NM(ST.brows,L.br,"normal"), MO=STY_NM(ST.mouth,L.mo,"neutral"), NO=STY_NM(ST.nose,L.no,"straight");
  // ---- hair volume behind the head
  if(hasHair){ const H=hl;
    if(bk){ const big=hair==="curly";
      if(hair==="mohawk"){ ell(g,12,6+b,1.6,6,H); for(let k=0;k<5;k++) hp(g,11.6+(k%2)*.6,1.6+k*1.6+b,hlH); }
      else if(hair==="undercut"){ ell(g,12,4.6+b,5.4,3,H); for(let k=0;k<18;k++){ const v=hh(k,5,9); hp(g,7.4+(v%18)/2,7+((v>>>5)%10)/2+b,shade(hl,.8)); } }
      else { ell(g,12,7+b,big?7.2:5.9,big?6.4:(hair==="buzz"?4.6:5.6),hair==="buzz"?shade(hl,.82):H);
        if(hair==="long") poly(g,[[6.6,8+b],[17.4,8+b],[17,16.6+b],[7,16.6+b]],H);
        if(hair==="bob") poly(g,[[6.2,8+b],[17.8,8+b],[17.8,12.6+b],[6.2,12.6+b]],H);
        if(hair==="ponytail"){ limb(g,12,8+b,12.2,17+b,1.3,.8,H); R(g,11.2,8.6+b,1.6,.7,"#2a2016"); }
        if(hair==="braid"){ for(let k=0;k<8;k++) ell(g,12+(k%2?.25:-.25),9+k*1.1+b,1,.7,k%2?H:hlD); }
        if(hair==="topknot") ell(g,12,1.4+b,1.9,1.6,H); if(hair==="buns"){ ell(g,7.6,2.8+b,1.8,1.6,H); ell(g,16.4,2.8+b,1.8,1.6,H); }
        if(hair==="slick") for(let k=0;k<5;k++) R(g,8.4+k*1.8,2.6+b,.5,7,hlH);
        else if(!big&&hair!=="buzz") for(let k=0;k<7;k++) R(g,7.6+k*1.3,4.5+((k*5)%3)+b,.5,3.2,hlD);
        if(big) for(let k=0;k<26;k++){ const v=hh(k,8,2); ell(g,5.6+(v%26)/2,1+((v>>>5)%24)/2+b,.6,.5,(v>>>3)%2?hlH:hlD); } } }
    else if(f){ if(hair==="long") { limb(g,7,7+b,6.8,16+b,1.6,1.2,H); limb(g,17,7+b,17.2,16+b,1.6,1.2,H); }
      if(hair==="bob"){ ell(g,7.2,9.8+b,1.8,3.4,H); ell(g,16.8,9.8+b,1.8,3.4,H); }
      if(hair==="curly"){ ell(g,12,6.4+b,7.4,6.2,H); for(let k=0;k<22;k++){ const v=hh(k,4,6); ell(g,5.4+(v%28)/2,1+((v>>>5)%22)/2+b,.55,.45,(v>>>3)%2?hlH:hlD); } }
      if(hair==="ponytail") limb(g,16.8,7+b,18,13.6+b,1,.6,H); }
    else { if(hair==="long") limb(g,8.8,7+b,8.6,16+b,2,1.4,H); if(hair==="bob") ell(g,9.6,10+b,2.6,3.2,H); if(hair==="ponytail") limb(g,7.2,6.6+b,5.6,14+b,1.2,.7,H);
      if(hair==="curly") ell(g,11,6.6+b,6.6,6,H); if(hair==="braid") for(let k=0;k<7;k++) ell(g,8.2-k*.15,9+k*1.1+b,.9,.65,k%2?H:hlD); } }
  // ---- the face: a full layer of skin, shading and features
  if(!bk){ const fc=cvs(24,32), q=fc.getContext("2d"), F=(x,y,w,h,c)=>R(q,x,y+b,w,h,c), lip=fem?"#b0645e":"#a0605a";
    ell(q,hx,7.4+b,headR[0]-.2,headR[1]-.2,sk); ell(q,hx+(sd?.8:0),10.1+b,jawR[0],jawR[1],sk);
    q.save(); q.globalCompositeOperation="source-atop"; ell(q,hx+1.8+(sd?.4:0),9+b,3.8,5,skS); ell(q,hx+.7+(sd?.4:0),8.6+b,4.3,5.2,sk); ell(q,hx-2.2,6.2+b,1.5,.9,skH); q.restore();
    if(f){
      if(FM==="warpaint") F(6.8,7.6,10.4,2,"rgba(20,10,10,.8)");
      for(const ex of [9.85,14.15]){ const L2=ex<12, rx=EY==="wide"?1.3:1.15, ry=EY==="narrow"?.42:EY==="wide"?.78:.62, ir=EY==="wide"?.7:.6;
        if(FM==="eyepatch"&&L2){ ell(q,ex,8.6+b,1.6,1.3,"#121212"); hp(q,ex-.6,8.1+b,"#3a3a3a"); continue; }
        ell(q,ex,8.65+b,rx,ry,"#ece4d4"); ell(q,ex+(L2?.25:-.25),8.7+b,ir,Math.min(ir,ry+.05),eye); hp(q,ex+(L2?.25:-.25),8.7+b,"#050404"); hp(q,ex+(L2?0:-.5),8.35+b,"#ffffff");
        F(ex-rx-.1,8.65-ry-.15,rx*2+.2,.5,EY==="heavy"?skS:skD); if(EY==="heavy") F(ex-rx,8.65-ry+.3,rx*2,.45,skS); if(EY==="narrow") F(ex-rx,8.65+ry-.1,rx*2,.4,skS); else F(ex-1,9.3,2,.4,skS);
        if(fem){ F(ex-rx-.2,8.65-ry-.25,rx*2+.4,.45,"#1a1210"); hp(q,L2?ex-rx-.6:ex+rx+.1,8.1+b,"#1a1210"); } }
      // brows
      for(const ex of [9.85,14.15]){ const L2=ex<12, th=BR==="thick"?.8:BR==="thin"||fem?.38:.5, c=BR==="thin"?shade(hl,.85):hlD;
        if(BR==="stern"){ for(let k=0;k<5;k++) F(ex+(L2?-1.4+k*.65:1.4-k*.65)-.3,6.4+k*.18,.7,th,c); }
        else if(BR==="arched"||fem){ for(let k=0;k<5;k++) F(ex-1.4+k*.65,6.7-Math.sin(k/4*Math.PI)*.45,.7,th,c); }
        else { F(ex-1.4,6.6+(L2?.2:0),1.4,th,c); F(ex,6.6+(L2?0:.2),1.4,th,c); } }
      // nose
      if(NO==="broad"){ F(12.2,8.9,.5,1.6,skS); ell(q,12,10.7+b,1.5,.55,skD); hp(q,10.8,10.8+b,shade(sk,.55)); hp(q,13,10.8+b,shade(sk,.55)); }
      else if(NO==="small"){ F(12.2,9.5,.4,1,skS); ell(q,12,10.6+b,.7,.35,skD); }
      else if(NO==="hooked"){ F(12.2,8.7,.5,2.2,skS); hp(q,11.8,9.4+b,skH); ell(q,12.1,11+b,1,.5,skD); }
      else { F(12.25,8.9,.5,1.8,skS); ell(q,12,10.7+b,1,.45,skD); hp(q,11.5,10.4+b,skH); }
      ell(q,9,11+b,.9,.45,fem?shade(sk,1.02):shade(sk,1.03)); ell(q,15,11+b,.9,.45,shade(sk,.95)); if(fem){ ell(q,9.2,10.9+b,.7,.3,"rgba(200,90,90,.25)"); ell(q,14.8,10.9+b,.7,.3,"rgba(200,90,90,.2)"); }
      // mouth
      const my=12.1;
      if(MO==="smirk"){ F(10.9,my,2,.45,shade(sk,.48)); hp(q,12.9,my-.3+b,shade(sk,.48)); F(11.3,my+.4,1.3,.4,lip); }
      else if(MO==="frown"){ F(11.2,my,1.6,.45,shade(sk,.48)); hp(q,10.7,my+.4+b,shade(sk,.48)); hp(q,12.8,my+.4+b,shade(sk,.48)); F(11.3,my+.45,1.4,.35,lip); }
      else if(MO==="full"||fem&&MO==="neutral"){ ell(q,12,my-.15+b,1.3,.38,shade(lip,.85)); F(10.8,my+.05,2.4,.35,shade(sk,.45)); ell(q,12,my+.55+b,1.15,.42,lip); hp(q,11.6,my+.45+b,shade(lip,1.3)); }
      else if(MO==="grim"){ F(10.6,my,2.8,.4,shade(sk,.4)); hp(q,10.2,my-.6+b,skS); hp(q,13.6,my-.6+b,skS); }
      else { F(10.9,my,2.2,.45,shade(sk,.48)); F(11.3,my+.4,1.4,.4,lip); }
      // marks
      if(FM==="scar") for(let k=0;k<7;k++) hp(q,14.8-k*.22,6+k*.8+b,"#c06a5a");
      else if(FM==="tattoo"){ F(9.6,9.7,.5,1.8,"#2a3a5a"); F(14.2,9.7,.5,1.8,"#2a3a5a"); hp(q,9.6,11.6+b,"#2a3a5a"); hp(q,14.2,11.6+b,"#2a3a5a"); }
      else if(FM==="freckles") for(let k=0;k<12;k++){ const v=hh(k,9,3); hp(q,9+(v%12)/2,9.8+((v>>>4)%4)/2+b,shade(sk,.72)); }
      else if(FM==="eyepatch") limb(q,7,6.6+b,17,10.6+b,.2,.2,"#121212");
      // facial hair
      const fhC=hl, fhD=hlD;
      if(FH==="stubble"){ for(let k=0;k<22;k++){ const v=hh(k,3,5); hp(q,8.2+(v%16)/2,10.6+((v>>>4)%7)/2+b,"rgba(30,22,16,.45)"); } }
      else if(FH==="shortbeard"){ ell(q,12,12+b,4.2,2.3,fhC); ell(q,12,10.9+b,4.4,1,sk); ell(q,12,11.6+b,1.6,.6,fhC); F(10.8,12.1,2.4,.5,shade(sk,.45)); for(let k=0;k<7;k++) hp(q,8.8+k,12.4+(k%2)*.5+b,fhD); }
      else if(FH==="fullbeard"){ ell(q,12,12.6+b,4.6,3,fhC); ell(q,12,14.6+b,3,1.4,fhC); ell(q,12,11.5+b,2.4,.7,fhC); F(10.9,12.2,2.2,.5,shade(sk,.4)); for(let k=0;k<9;k++) hp(q,8.4+k,12.6+(k%3)*.6+b,(k%2)?hlH:fhD); }
      else if(FH==="goatee"){ ell(q,12,13.2+b,1.5,1.3,fhC); ell(q,12,11.6+b,1.9,.5,fhC); F(10.9,12.1,2.2,.45,shade(sk,.45)); }
      else if(FH==="moustache"){ ell(q,12,11.55+b,2.3,.55,fhC); hp(q,9.8,11.95+b,fhC); hp(q,13.9,11.95+b,fhC); }
      else if(FH==="chops"){ limb(q,7.4,7.8+b,8.8,12.4+b,.75,1,fhC); limb(q,16.6,7.8+b,15.2,12.4+b,.75,1,fhC); ell(q,12,11.55+b,2.4,.5,fhC); }
    } else {   // side
      ell(q,14.6,8.65+b,1,EY==="narrow"?.42:.6,"#ece4d4"); ell(q,14.9,8.7+b,.55,.55,eye); hp(q,15,8.7+b,"#050404"); hp(q,14.6,8.4+b,"#fff"); F(13.4,7.8,2.4,.5,skD); if(fem) F(13.3,7.75,2.7,.4,"#1a1210"); F(13.4,6.7,2.6,BR==="thick"?.8:.5,hlD);
      ell(q,17.4,9.6+b,NO==="broad"?1.1:NO==="small"?.7:.9,1.1,sk); hp(q,17.6,10.4+b,skD); F(15.6,12.1,1.8,.45,shade(sk,.48)); F(15.9,12.5,1.1,.4,lip);
      if(FH==="fullbeard"||FH==="shortbeard") ell(q,14.6,12+b,3.2,FH==="fullbeard"?2.8:2.1,hl); else if(FH==="goatee") ell(q,16,13.1+b,1,1.1,hl); else if(FH==="moustache"||FH==="chops") ell(q,16.3,11.5+b,1.3,.5,hl);
      if(FH==="chops") limb(q,11.6,8+b,13,12+b,.7,.9,hl); if(FH==="stubble") for(let k=0;k<10;k++) hp(q,12.6+k*.5,10.8+(k%3)*.6+b,"rgba(30,22,16,.45)");
      if(FM==="scar") for(let k=0;k<6;k++) hp(q,15-k*.2,6.4+k*.75+b,"#c06a5a"); else if(FM==="freckles") for(let k=0;k<6;k++) hp(q,14.4+k*.5,10.2+(k%2)*.5+b,shade(sk,.72)); else if(FM==="warpaint") F(12.6,7.8,5.4,1.6,"rgba(20,10,10,.75)"); }
    g.drawImage(fc,0,0);
    if(SYN){ const glow=["#5ad0ff","#ff4a30","#7cff7a","#f2b648","#c070ff"][(L.e|0)%5], seam=shade(sk,.55), hi=shade(sk,1.25);
      if(f){ R(g,7.2,10.6+b,9.6,.4,seam); R(g,11.8,3.6+b,.4,3,seam); R(g,7.6,6.4+b,8.8,.35,hi); for(const ex of [9.85,14.15]){ ell(g,ex,8.7+b,1.25,.55,"#05080a"); ell(g,ex,8.7+b,.9,.32,glow); hp(g,ex-.3,8.55+b,"#ffffff"); }
        for(let k=0;k<4;k++) R(g,10.4+k*.9,12+b,.45,1,seam); hp(g,7.4,9+b,hi); hp(g,16.6,9+b,hi); }
      else if(sd){ R(g,12,10.6+b,5.4,.4,seam); ell(g,15,8.7+b,1,.5,"#05080a"); ell(g,15.2,8.7+b,.7,.3,glow); R(g,11.4,7.6+b,.4,3.2,seam); disc(g,11.6,9+b,.9,shade(sk,.7)); for(let k=0;k<3;k++) R(g,15+k*.8,12+b,.4,.9,seam); }
      else { R(g,11.8,3.6+b,.4,8,seam); R(g,8,9.6+b,8,.4,seam); disc(g,12,7+b,.8,glow); } }
    }
  // ---- hair on top: hairline, fringe, styles
  if(hasHair&&!bk){ const hc2=cvs(24,32), h=hc2.getContext("2d"), H=hl, P2=(x,y,rx,ry,c)=>ell(h,x,y+b,rx,ry,c);
    const fxo=sd?-1.2:0, cx=12+fxo;
    const cap=(col,ry=4.4,win=[4.5,4.4,9.8])=>{ P2(cx,5.6,6,ry,col); h.save(); h.globalCompositeOperation="destination-out"; ell(h,sd?13.8:12,win[2]+b,sd?win[0]-.6:win[0],win[1],"#000"); h.restore(); };
    switch(hair){
      case "buzz": cap(shade(hl,.82),3.8,[4.8,4.7,9.2]); for(let k=0;k<14;k++){ const v=hh(k,2,7); hp(h,7.6+(v%18)/2,2.6+((v>>>5)%6)/2+b,shade(hl,.65)); } break;
      case "short": cap(H); if(!sd){ for(const [x,y,r] of [[8.8,5.6,1.3],[10.6,5.3,1.2],[12.6,5.5,1.3],[14.6,5.3,1.2],[16,5.9,1]]) P2(x,y,r,1.05,H); P2(7.2,7.4,1,1.6,H); P2(16.8,7.4,1,1.6,H); } else { P2(13.2,5.4,1.6,1,H); P2(9.6,7.6,2.2,3,H); } break;
      case "long": cap(H); if(!sd){ limb(h,8,5.2+b,7.4,13+b,1,.7,H); limb(h,16,5.2+b,16.6,13+b,1,.7,H); R(h,11.9,2+b,.4,3.4,hlD); } else P2(9.6,7.8,2.4,3.4,H); break;
      case "mohawk": for(let k=0;k<6;k++){ const x=sd?10.2+k*1.1:12; const y=sd?2.8-Math.sin(k/5*Math.PI)*.6:4.6-k*.9; limb(h,x,y+b+(sd?0:0),x+(sd?.3:0),y-2.4+b,sd?.8:1.2-k*.08,.15,H); }
        for(let k=0;k<12;k++){ const v=hh(k,6,1); hp(h,(sd?9:7.4)+(v%(sd?10:18))/2,4+((v>>>5)%6)/2+b,shade(hl,.7)); } break;
      case "topknot": cap(H,4,[4.7,4.6,9.4]); P2(12+fxo*.5,1.3,1.9,1.6,H); P2(11.5+fxo*.5,.8,.7,.5,hlH); R(h,10.6+fxo*.5,2.4+b,2.8,.5,"#2a2016"); break;
      case "braid": cap(H,4.2,[4.6,4.5,9.6]); if(!sd) R(h,11.9,2+b,.4,3.2,hlD); if(f) for(let k=0;k<9;k++) ell(h,16.8+(k%2?.25:-.25),8.6+k*1+b,.95,.65,k%2?H:hlD); break;
      case "ponytail": cap(H,4.2,[4.6,4.5,9.6]); if(!sd) P2(10.4,5,2.6,.9,H); R(h,(sd?7:16.6),5.6+b,1.4,.6,"#2a2016"); break;
      case "bob": cap(H,4.6,[4.4,4.2,10.4]); if(!sd){ R(h,7.4,5.2+b,9.2,1.6,H); P2(7.2,9.8,1.5,3.2,H); P2(16.8,9.8,1.5,3.2,H); R(h,7.4,6.6+b,9.2,.4,hlD); } else { R(h,12,5.2+b,4.6,1.6,H); P2(9.4,9.6,2.4,3.4,H); } break;
      case "pixie": cap(H,4.2,[4.6,4.5,9.8]); if(!sd) poly(h,[[7.2,4.6+b],[15,4.4+b],[16.2,6.6+b],[12.6,7+b],[8.4,5.8+b]],H); else poly(h,[[11.4,4.4+b],[17,4.6+b],[17.4,6.8+b],[13.4,6.4+b]],H); P2(10,4.4,1.6,.5,hlH); break;
      case "undercut": P2(cx,4,5.4,2.6,H); if(!sd) P2(14.2,5,3.4,1.4,H); else P2(14.8,4.8,2.8,1.4,H); for(let k=0;k<16;k++){ const v=hh(k,7,8); hp(h,(sd?8.4:6.8)+(v%(sd?10:20))/2,5.6+((v>>>5)%6)/2+b,shade(hl,.7)); } P2(11.6,3,2.4,.5,hlH); break;
      case "curly": cap(H,4.8,[4.4,4.3,10]); for(let k=0;k<12;k++){ const v=hh(k,3,4); P2(7+(v%20)/2+fxo,2.6+((v>>>5)%6)/2,.7,.6,(v>>>3)%2?hlH:hlD); } if(!sd) for(let k=0;k<6;k++) P2(8.6+k*1.36,5.6+(k%2)*.4,.8,.7,H); break;
      case "slick": cap(H,4,[4.6,4.8,9.4]); for(let k=0;k<5;k++) R(h,8.6+k*1.6+fxo,2.4+b,.4,2.8,hlH); break;
      case "buns": cap(H,4.2,[4.6,4.5,9.6]); if(!sd){ P2(7.4,2.6,1.9,1.7,H); P2(16.6,2.6,1.9,1.7,H); P2(7,2.1,.7,.5,hlH); P2(16.2,2.1,.7,.5,hlH); R(h,11.9,2+b,.4,3,hlD); } else P2(9.2,2.6,1.9,1.7,H); break;
    }
    if(!["buzz","mohawk","undercut","slick","curly"].includes(hair)) for(let k=0;k<6;k++) P2(8.8+k*1.35+fxo,2.4+(k%2)*.4,.6,.25,hlH);
    g.drawImage(hc2,0,0);
  } else if(open&&hair==="none"&&!bk){ ell(g,10.4,4.2+b,1.6,.8,skH); }
  if(HD) drawHelmet(g,HD,b,L,view);
  if(L.pk&&!bk) drawPackOn(g,L.pk,b,view);
  if(AC) drawAccFront(g,AC,b,L,view);
  if(AC==="pauldron") drawPauldron(g,b,view);
  if(L.li&&!bk){ const lx=sd?14:8; U(lx,15.2,2.5,1.5,"#2a2a26"); U(lx,15.2,2.5,.5,"#5a5a50"); U(lx+(sd?2.5:.75),15.2+(sd?0:1.5),sd?.5:1,sd?1.5:.5,L.li===1?"#fff4c0":"#3a3a34"); }
}
// wounds and missing limbs, painted over a finished sprite. dm: head torso larm rarm lleg rleg; 0 fine, 1 hurt, 2 wrecked, 3 gone
const LIMB_ORDER=["head","torso","larm","rarm","lleg","rleg"];
function dmgKey(e){ if(!e||!e.hp) return "000000"; return LIMB_ORDER.map(l=>e.sev&&e.sev[l]?"3":e.hp[l]<=0?"2":(e.hp[l]<e.max[l]*.5||e.bleed[l])?"1":"0").join(""); }
function woundAt(g,x,y,w,h,lvl,seed){ if(lvl<1) return; const n=lvl===1?5:12;
  for(let k=0;k<n;k++){ const v=hh(seed,k,lvl*7), px=x+(v%(w*2))/2, py=y+((v>>>5)%(h*2))/2; R(g,px,py,lvl>1&&k%3===0?1:.5,.5+((v>>>9)%2)*.5,k%3?"#7a1410":"#3e0806"); }
  if(lvl>1){ const v=hh(seed,99,3); hp(g,x+(v%(w*2))/2,y+((v>>>4)%(h*2))/2,"#e8dcc0"); R(g,x,y+h-.5,w,.5,"rgba(90,10,6,.8)"); } }
function stump(g,x,y,w,h){ R(g,x,y,w,h,"#5a0e0a"); R(g,x,y,w,.5,"#a01e14"); hp(g,x+w/2-.25,y+h/2-.25,"#e8dcc0"); for(let k=0;k<3;k++) hp(g,x+k*.7,y+h+k*.5,"#6a1410"); }
function cut(g,x,y,w,h){ g.save(); g.globalCompositeOperation="destination-out"; g.fillStyle="#000"; g.fillRect(x,y,w,h); g.restore(); }
// limb boxes per view (character's right arm is on screen-left when facing you)
const HUMAN_BOX={f:{head:[5.5,-2,13,15.5],torso:[7.5,14,9,8],rarm:[4.5,14,3.5,10],larm:[16,14,3.5,10],rleg:[7.5,23,4.5,8],lleg:[12,23,4.5,8]},
  b:{head:[5.5,-2,13,15.5],torso:[7.5,14,9,8],larm:[4.5,14,3.5,10],rarm:[16,14,3.5,10],lleg:[7.5,23,4.5,8],rleg:[12,23,4.5,8]},
  s:{head:[5.5,-2,13,15.5],torso:[8,14,8.5,8],larm:[8.5,14,3,9],rarm:[12,14,3,9],lleg:[7.5,23,5,8],rleg:[11.5,23,5.5,8]}};
function damageBody(g,b,dm,box,L,seed){ if(!dm||dm==="000000") return; LIMB_ORDER.forEach((l,i)=>{ const v=+dm[i], bx=box[l]; if(!bx) return; const up=l==="head"||l==="torso"||l.endsWith("arm")?b:0;
  if(v===3&&l!=="torso"){ cut(g,bx[0],bx[1]+up,bx[2],bx[3]); if(l==="head") stump(g,10,12+b,4,1.5); else if(l.endsWith("arm")) stump(g,bx[0]+.5,bx[1]+up,2,1.5); else stump(g,bx[0]+.5,bx[1],3,1.5); }
  else woundAt(g,bx[0]+.5,bx[1]+up+(l==="head"?4:0),bx[2]-1,Math.min(bx[3],l==="head"?7:bx[3])-1,v,seed+i); }); }
function drawPlayer(g,o,L={}){ drawHuman(g,o,L); damageBody(g,o.b||0,L.dm,HUMAN_BOX[o.view||"f"],L,11); }
function lookOf(e){ const g=e&&(Sim.gun(e)||e.melee), d=k=>e&&e[k]?e[k].d:null; return {...((e&&e.look)||{}),hd:d("head"),a:d("armor"),lg:d("legs"),ac:d("acc"),li:e&&e.light?(e.lightOff?2:1):0,pk:d("pack"),w:g?g.d:null,dm:e&&e.hp?dmgKey(e):"000000"}; }

// side: hunched profile
function drawHusk(g,{step=0,b=0,lunge=0}){
  const P={f:"#a69679",fH:"#c7b899",fS:"#76654f",fD:"#4a3d30",raw:"#6e2620",rawH:"#9a3a2c",bone:"#d6cbb0",cl:"#2b3533",clH:"#3e4a47",bl:"#5a0e0a",eye:"#ff3a26"};
  const bl=step===1?-2:step===2?2:0, fl=-bl;
  limb(g,10+bl,22.6,9.6+bl,26,1.1,.95,P.fS); limb(g,9.6+bl,26,10+bl,29.2,.95,.8,P.fS); ell(g,10.6+bl,29.5,1.6,.75,P.fD);
  if(lunge){ limb(g,13,13.6,18,10.6,1.1,.9,P.fS); limb(g,18,10.6,21.6,8.6,.9,.8,P.fS); for(let k=0;k<3;k++) limb(g,21.4,8.2+k*.9,23.4,7.6+k*1.1,.3,.2,P.bone); }
  else { limb(g,13,14.4+b,14.4,18.4+b,1.1,.95,P.fS); limb(g,14.4,18.4+b,18.6,19.6+b,.95,.8,P.fS); for(let k=0;k<3;k++) limb(g,18.6,19+k*.8+b,20.8,18.8+k*1+b,.3,.2,P.bone); }
  poly(g,[[7.4,20.6],[15,20.6],[15.2,23.6],[7.2,23.6]],P.cl); R(g,7.4,20.6,7.6,.6,P.clH); for(let k=0;k<5;k++) R(g,7.4+k*1.6,23.4,.8,.5+(k%2)*.6,P.cl);
  poly(g,[[8,14.4+b],[13.6,12.4+b],[15.4,14.8+b],[14.6,21],[8.2,21]],P.f); ell(g,11,13.6+b,3,1.8,P.f); ell(g,9,17.6+b,1.3,3.4,P.fS); ell(g,9.4,17.6+b,1.2,3.4,P.f);
  for(let k=0;k<3;k++){ ell(g,12.6,15.4+k*1.6+b,1.9,.32,P.bone); ell(g,12.6,15.95+k*1.6+b,1.8,.28,P.raw); } ell(g,10,16+b,.8,.9,P.rawH);
  limb(g,13+fl,22.6,13.4+fl,26,1.15,.95,P.f); limb(g,13.4+fl,26,13+fl,29.2,.95,.8,P.f); ell(g,13.8+fl,29.5,1.7,.8,P.fS);
  const hx=lunge?17.6:16.6, hy=lunge?8.4:10.2+b;
  ell(g,hx,hy,3.2,3.3,P.f); ell(g,hx+.9,hy+1.9,2.4,1.6,P.f); ell(g,hx+.6,hy+.6,2.5,2.9,P.fS); ell(g,hx-.2,hy+.2,2.6,3,P.f); ell(g,hx-.6,hy-1.6,1.4,.7,P.fH);
  ell(g,hx+1.2,hy-.1,.9,.8,"#1a0e0a"); ell(g,hx+1.4,hy,.45,.42,P.eye); ell(g,hx+1.6,hy+2.1,1.5,.8,P.raw); for(let k=0;k<3;k++) hp(g,hx+.8+k*.7,hy+1.8,"#fff4dc"); R(g,hx+1.4,hy+2.9,.5,1.4,P.bl);
  if(!lunge){ limb(g,13.8,14+b,15.2,18+b,1.1,.95,P.f); limb(g,15.2,18+b,19.6,18.8+b,.95,.8,P.f); for(let k=0;k<3;k++) limb(g,19.6,18.2+k*.8+b,21.8,17.8+k*1+b,.3,.2,P.bone); }
  else { limb(g,14,12,19,9.6,1.1,.9,P.f); limb(g,19,9.6,22.4,7.2,.9,.8,P.f); for(let k=0;k<3;k++) limb(g,22.2,6.8+k*.9,24,6.2+k*1.1,.3,.2,P.bone); }
}
function buildChar(fn){ const fr={}; for(const [k,o] of Object.entries({idle0:{b:0},idle1:{b:1},walk1:{step:1},walk2:{step:2},lunge:{lunge:1}})){ fr[k]=outlined(24,32,g=>fn(g,o),"#060505",{round:1}); fr[k+"W"]=whiteOf(fr[k]); } return fr; }
function damageHusk(g,o,dm){ if(!dm||dm==="000000") return; const D=i=>+dm[i], b=o.b||0, step=o.step||0, bl=step===1?-2:step===2?2:0, fl=-bl, lunge=o.lunge, hx=lunge?16:15, hy=lunge?7:9+b;
  if(D(4)===3){ cut(g,7+bl,21.5,4.5+(D(5)===3?2:0),9); stump(g,8.5+bl,21,2.5,1.5); } else woundAt(g,9+bl,21,2,6,D(4),21);
  if(D(5)===3){ cut(g,11.2+fl-(D(4)===3?2:0),21.5,5+(D(4)===3?2:0),9); stump(g,12+fl,21,2.5,1.5); } else woundAt(g,12+fl,21,2,6,D(5),22);
  woundAt(g,8,13+b,7,8,D(1),23);
  if(D(3)===3){ cut(g,14.5,lunge?8:16.5+b,10,lunge?3:3); stump(g,14,lunge?9:15+b,2,1.5); } else woundAt(g,14,13+b,5,6,D(3),24);
  if(D(2)===3){ cut(g,14,lunge?10:19+b,9,2.5); }
  if(D(0)===3){ cut(g,hx-1,hy-2,9,10); stump(g,hx,hy+4,3,1.5); } else woundAt(g,hx,hy,6,6,D(0),25); }
// husks: rounded, hunched, front/back
function drawHuskFB(g,{step=0,b=0,lunge=0,view="f"}){
  const P={f:"#a69679",fH:"#c7b899",fS:"#76654f",fD:"#4a3d30",raw:"#6e2620",rawH:"#9a3a2c",bone:"#d6cbb0",cl:"#2b3533",clH:"#3e4a47",bl:"#5a0e0a",eye:"#ff3a26"}, bk=view==="b";
  for(const [lx,lift] of [[9.6,step===1?1:0],[14.4,step===2?1:0]]){ limb(g,lx,22.8,lx-.3,26,1.25,1,P.fS); limb(g,lx-.3,26,lx,29.3-lift,1,.85,P.fS); ell(g,lx+.2,29.6-lift,1.6,.8,P.fD); hp(g,lx+1.3,29.6-lift,P.bone); }
  poly(g,[[7.6,20.8],[16.4,20.8],[16.8,24.2],[7.2,24.2]],P.cl); for(let k=0;k<6;k++) R(g,7.4+k*1.6,24,.8,.5+(k%3)*.5,P.cl); R(g,7.6,20.8,8.8,.6,P.clH);
  poly(g,[[7.2,13.6+b],[16.8,13.6+b],[15.8,21.4],[8.2,21.4]],P.f); ell(g,7.8,14.6+b,1.9,1.5,P.f); ell(g,16.2,14.6+b,1.9,1.5,P.f);
  ell(g,13.6,17.6+b,3,4.2,P.fS); ell(g,12.6,17.4+b,3.6,4.4,P.f);
  if(!bk){ for(let k=0;k<4;k++){ ell(g,12,15.6+k*1.45+b,3.2,.32,P.bone); ell(g,12,16.15+k*1.45+b,3,.28,P.raw); } R(g,11.75,15,.5,5.5,P.fD); ell(g,8.6,17.8+b,.9,1.1,P.rawH); hp(g,8.6,17.6+b,"#d05a40"); }
  else { for(let k=0;k<6;k++) ell(g,12,14.2+k*1.25+b,.6,.35,P.bone); ell(g,9.6,15.6+b,1.6,1.8,P.fS); ell(g,14.4,15.6+b,1.6,1.8,P.fS); ell(g,9.8,19.6+b,.8,.8,P.raw); }
  if(lunge){ for(const s of [-1,1]){ const sx=12+s*7.2; limb(g,12+s*4.6,14.6+b,sx,10+b,1.2,1,P.fS); limb(g,sx,10+b,sx+s*.4,5.6+b,1,.85,P.fS); for(let k=0;k<3;k++) limb(g,sx-.8+k*.8,5.6+b,sx-1+k*1,3.4+b-(k%2)*.4,.3,.2,P.bone); } }
  else { const sw=step===1?.8:step===2?-.8:0; for(const s of [-1,1]){ const sx=12+s*7, d=s<0?sw:-sw; limb(g,12+s*4.8,14.6+b,sx,19+b+d,1.25,1.05,P.fS); limb(g,sx,19+b+d,sx-s*.2,24+b+d,1.05,.9,P.fS); limb(g,sx+.3*s,14.8+b,sx+.2*s,23.5+b+d,.3,.25,P.f);
      for(let k=0;k<3;k++) limb(g,sx-.9+k*.9,24.2+b+d,sx-1.1+k*1.1,26.6+b+d+(k%2)*.4,.3,.2,P.bone); } }
  // head, low and forward
  ell(g,12,9.6+b,4.6,4.9,P.f); ell(g,12,12.2+b,3.8,2.6,P.f); ell(g,13.2,10.4+b,3.6,4.4,P.fS); ell(g,12.3,10+b,3.8,4.5,P.f); ell(g,10.6,7.2+b,1.6,1,P.fH);
  if(!bk){ R(g,8.2,8.4+b,7.6,.9,P.fD); ell(g,9.9,9.8+b,1.3,1,"#1a0e0a"); ell(g,14.1,9.8+b,1.3,1,"#1a0e0a"); ell(g,14.2,9.9+b,.55,.5,P.eye); hp(g,14.1,9.7+b,"#ffd0a0"); hp(g,9.9,10+b,"#5a1a12");
    ell(g,12,12.4+b,2.8,1.3,P.raw); R(g,9.4,11.8+b,5.2,.5,P.rawH); for(let k=0;k<6;k++) hp(g,9.7+k*.9,12+b,"#fff4dc"); for(let k=0;k<5;k++) hp(g,10.1+k*.9,12.9+b,"#fff4dc"); R(g,11.8,13.6+b,.5,1.4,P.bl); ell(g,10.4,7+b,.6,.6,P.raw); }
  else { ell(g,12,8+b,3,.3,P.fS); R(g,10.6,9.4+b,2.4,.5,P.raw); R(g,12.8,9.8+b,.5,2.6,P.raw); hp(g,10.6,11+b,P.bone); }
}
const HUSK_BOX={f:{head:[7,4,10,11],torso:[7.5,13,9,8.5],rarm:[3.5,12,4,16],larm:[16.5,12,4,16],rleg:[8,23,3.5,8],lleg:[13,23,3.5,8]},b:{head:[7,4,10,11],torso:[7.5,13,9,8.5],larm:[3.5,12,4,16],rarm:[16.5,12,4,16],lleg:[8,23,3.5,8],rleg:[13,23,3.5,8]}};
function buildViews(fn){ const fr=buildChar((g,o)=>fn(g,{...o,view:"f"})); fr.back=buildChar((g,o)=>fn(g,{...o,view:"b"})); fr.side=buildChar((g,o)=>fn(g,{...o,view:"s"})); return fr; }
const HUSKF={}; function huskFrames(dm){ dm=dm||"000000"; return HUSKF[dm]||(HUSKF[dm]=buildViews((g,o)=>{ if(o.view==="s"){ drawHusk(g,o); damageHusk(g,o,dm); } else { drawHuskFB(g,o); damageBody(g,o.b||0,dm,HUSK_BOX[o.view],null,21); } })); }
const CH={husk:huskFrames("000000")}, CHP={};
function playerFrames(L){ L=L||{}; const k=["dm","hd","a","lg","ac","li","pk","bs","w","c","v","k","s","h","hc","f","e","t","tc","b","bc","bt","g","fh","fm","ey","br","mo","no"].map(f=>L[f]==null?"":L[f]).join("|"); return CHP[k+"|"+(L.syn?1:0)]||(CHP[k+"|"+(L.syn?1:0)]=buildViews((g,o)=>drawPlayer(g,o,L))); }
const CORPSE={
  husk:outlined(24,16,g=>{ R(g,4,6,13,4,"#a69679"); R(g,4,6,13,1,"#c7b899"); for(let k=0;k<3;k++) R(g,7+k*3,7,1,3,"#d6cbb0"); R(g,7,9,8,1,"#6e2620"); R(g,17,4,5,5,"#a69679"); R(g,19,6,2,2,"#4a3d30"); R(g,2,10,5,2,"#76654f"); R(g,10,2,2,4,"#76654f"); R(g,11,1,3,1,"#d6cbb0"); R(g,6,10,6,2,"#2b3533"); }),
  player:outlined(24,16,g=>{ R(g,3,7,4,4,"#5e1a12"); R(g,6,5,11,6,"#525849"); R(g,6,5,11,1,"#7a816d"); R(g,17,5,5,5,"#3b3f38"); R(g,19,7,2,1,"#6a5020"); R(g,8,11,9,2,"#1b1a17"); R(g,9,3,10,2,"#20201b"); }),
};

// ---------- main menu art: a skull over two crossed rifles ----------
function rifleDiag(g,x0,y0,sx,sy,len){ // pixel-stepped 45-degree rifle, stock end at (x0,y0)
  for(let t=0;t<len;t+=.5){ const x=x0+t*sx, y=y0+t*sy;
    let top=0,bot=0,c="#2a2a26",hi="#6a6a60";
    if(t<26){ top=3.5; bot=3; c=t<4?"#2a1a10":"#5a3418"; hi="#9a6a3a"; if(t>=8&&t<10) c="#3a2210"; }       // stock with a butt-plate and grip line
    else if(t<56){ top=3; bot=3; c="#2e302c"; hi="#72766a"; }                                            // receiver
    else if(t<len-6){ top=1.5; bot=1.25; c="#1e201c"; hi="#55574e"; }                                    // barrel
    else { top=2.25; bot=2.25; c="#121210"; hi="#3a3a34"; }                                               // muzzle brake
    R(g,x,y-top,.5,top+bot,c); R(g,x,y-top,.5,.75,hi); R(g,x,y+bot-.5,.5,.5,shade(c,.6));
    if(t>=33&&t<41) R(g,x,y+bot,.5,8,"#1a1a16");                                                            // magazine
    if(t>=30&&t<50) R(g,x,y-top-2.5,.5,2,t<32||t>47?"#2a2a26":"#1a1c18");                                   // scope
    if(t>=47&&t<48) R(g,x,y-top-2.5,.5,2,"#e04030");
    if(t>=56&&t<74) R(g,x,y+bot,.5,1.25,"#3a3a34");                                                         // rail under the barrel
    if(t>=22&&t<26) R(g,x,y+bot,.5,4,"#3a2414");                                                            // pistol grip
  } }
function drawEmblem(g){
  rifleDiag(g,6,98,1,-1,108); rifleDiag(g,114,98,-1,-1,108);
  // cranium
  const bone="#d8ccb0", boneH="#f0e6d0", boneS="#9a8c70", boneD="#5a4e3c";
  for(let y=-26;y<=26;y+=.5) for(let x=-24;x<=24;x+=.5){ const inC=(x*x)/(24*24)+((y+2)*(y+2))/(26*26)<=1; if(!inC) continue; const yy=y+40, xx=x+60;
    if(y>14&&Math.abs(x)>15) continue; R(g,xx,yy,.5,.5,y<-14&&x<-6?boneH:x>12||y>10?boneS:bone); }
  // cheekbones + jaw
  R(g,40,52,40,8,bone); R(g,42,60,36,9,bone); R(g,44,68,32,5,boneS); R(g,42,60,36,.75,boneS); R(g,40,52,40,1,boneH);
  // eye sockets with a red burn
  for(const ex of [48,72]){ for(let y=-6;y<=6;y+=.5) for(let x=-8;x<=8;x+=.5) if(x*x/64+y*y/36<=1) R(g,ex+x,40+y,.5,.5,"#0a0606"); for(let y=-2;y<=2;y+=.5) for(let x=-2;x<=2;x+=.5) if(x*x+y*y<=4) R(g,ex+x,41+y,.5,.5,"#e02a14"); R(g,ex-1,40,1.5,1,"#ffb090"); }
  R(g,40,34,16,1.5,boneD); R(g,64,34,16,1.5,boneD);              // heavy brow
  // nose
  for(let k=0;k<7;k++) R(g,60-k*.6,50+k,1.2+k*1.2,.5,"#0a0606");
  // teeth
  R(g,44,59,32,1,boneD); for(let k=0;k<8;k++){ R(g,45+k*4,60,3,5,"#e8dcc4"); R(g,45+k*4,60,3,.75,"#fff6e4"); R(g,48+k*4,60,1,5,boneD); } R(g,44,65,32,1,boneD);
  for(let k=0;k<7;k++){ R(g,46+k*4,67,3,3,"#d0c4a8"); R(g,49+k*4,67,1,3,boneD); }
  // cracks and grime
  for(const [x,y,d] of [[52,18,1],[53,19,1],[54,21,0],[54,22,1],[55,24,0],[70,22,-1],[69,24,-1],[68,26,0],[66,57,1],[67,58,0]]) R(g,x,y,.75,1.5,boneD);
  for(let k=0;k<40;k++){ const v=hh(k,7,3); R(g,38+v%44,16+(v>>>6)%54,.5,.5,"rgba(60,40,20,.35)"); }
  // a riveted iron band across the brow, and a small cog on the forehead
  R(g,38,28,44,3,"#3a3a34"); R(g,38,28,44,.75,"#6a6a60"); for(let k=0;k<9;k++) R(g,40+k*5,29,1,1,"#a07e38");
  disc(g,60,22,4,"#5a4a22"); disc(g,60,22,2,"#a07e38"); for(let a=0;a<8;a++) R(g,60+Math.cos(a*.785)*5-.5,22+Math.sin(a*.785)*5-.5,1.5,1.5,"#5a4a22"); disc(g,60,22,1,"#1a1408");
}
let EMBLEM=null;
function emblemURL(){ if(!EMBLEM) EMBLEM=outlined(120,100,drawEmblem,"#020101",{seed:7}).toDataURL(); return EMBLEM; }
function paintMenuStars(c){ const w=c.width=Math.max(300,innerWidth*.7|0), h=c.height=Math.max(300,innerHeight*.7|0), g=c.getContext("2d"); let sd=19; const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  g.fillStyle="#000"; g.fillRect(0,0,w,h);
  for(let k=0;k<5;k++){ const x=rnd()*w, y=rnd()*h, r=80+rnd()*220, gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,k%2?"rgba(120,10,6,.35)":"rgba(60,10,30,.28)"); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(0,0,w,h); }
  for(let k=0;k<w*h/260;k++){ const v=rnd(); g.fillStyle=v>.985?"#ffe8d8":v>.92?"#a08a80":v>.7?"#4a3a3a":"#241a1a"; g.fillRect(rnd()*w|0,rnd()*h|0,v>.985?2:1,v>.985?2:1); }
  for(let k=0;k<6;k++){ const x=rnd()*w, y=rnd()*h; g.fillStyle="rgba(255,200,180,.7)"; g.fillRect(x-3,y,7,1); g.fillRect(x,y-3,1,7); } }
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
// ---------- machinery and furniture added for ships and stations ----------
Object.assign(PROP,{
  cogitator:outlined(24,34,g=>{ R(g,2,4,20,28,"#24262a"); R(g,2,4,20,2,"#3a3e44"); R(g,2,4,1,28,"#3a3e44"); R(g,21,6,1,26,"#121416"); R(g,3,2,18,3,"#5a4a22"); R(g,3,2,18,.5,"#a07e38"); skull(g,10,1,"#c8bca0","#1a1408");
    for(let k=0;k<3;k++){ R(g,4,8+k*6,16,4,"#06120a"); R(g,4,8+k*6,16,.5,"#1a2a1e"); for(let j=0;j<4;j++) R(g,5,8.5+k*6+j,4+((k*7+j*5)%9),.5,j%2?"#3f8a52":"#6ad07a"); }
    for(let k=0;k<5;k++) hp(g,5+k*3,27,k%2?"#e04030":"#e8b048"); R(g,3,29,18,1,"#a07e38"); R(g,4,31,2,1,"#141414"); R(g,18,31,2,1,"#141414"); for(const yy of [8,14,20]) R(g,20,yy,1,3,"#5a4a22"); }),
  medcab:outlined(24,30,g=>{ R(g,3,4,18,24,"#8a9094"); R(g,3,4,18,1,"#b8c0c4"); R(g,3,4,1,24,"#b0b8bc"); R(g,20,5,1,23,"#4a5054"); R(g,5,7,6,14,"#1a2426"); R(g,13,7,6,14,"#1a2426"); R(g,11.5,7,1,14,"#6a7074");
    for(const [bx,by,c] of [[6,9,"#a83a2a"],[8,9,"#e8e0c0"],[14,9,"#4a8a5a"],[16,9,"#e8e0c0"],[6,15,"#e8b048"],[15,15,"#a83a2a"],[17,15,"#c8c8c0"]]){ R(g,bx,by,1.5,3,c); hp(g,bx,by,"#fff"); }
    R(g,5,13,6,.5,"#3a4446"); R(g,13,13,6,.5,"#3a4446"); R(g,10,22,4,4,"#e8e8e0"); R(g,11.5,22.5,1,3,"#c02a1a"); R(g,10.5,23.5,3,1,"#c02a1a"); hp(g,5.5,7.5,"rgba(255,255,255,.5)"); }),
  surgery:outlined(24,22,g=>{ R(g,10,14,4,7,"#3a3e40"); R(g,6,19,12,2,"#2a2e30"); R(g,2,8,20,6,"#5a6266"); R(g,2,8,20,1,"#8a9296"); R(g,3,6,18,3,"#c8ccc4"); R(g,3,6,18,.5,"#f0f2ea"); R(g,4,6,4,3,"#e8eae0");
    R(g,12,7,5,1.5,"#7a1a12"); hp(g,14,8.5,"#5a0e0a"); hp(g,9,9,"#5a0e0a"); R(g,2,13,20,1,"#2a2e30"); R(g,20,2,1,6,"#4a4e50"); R(g,17,1,5,2,"#3a3e40"); R(g,18,3,3,.5,"#fff4c0"); }),
  pipes:outlined(24,34,g=>{ for(const [x,c] of [[4,"#4a4438"],[9,"#3a4448"],[15,"#4a3a2a"]]){ R(g,x,0,4,32,c); R(g,x,0,1,32,shade(c,1.4)); R(g,x+3,0,1,32,shade(c,.6)); for(let y=4;y<32;y+=8){ R(g,x-.5,y,5,1.5,shade(c,.75)); R(g,x-.5,y,5,.5,shade(c,1.3)); } }
    disc(g,11,14,3,"#8a1a12"); disc(g,11,14,2,"#5a0e0a"); R(g,10.5,11,1,6,"#b02a1c"); R(g,8,13.5,6,1,"#b02a1c"); disc(g,18,22,2,"#a07e38"); disc(g,18,22,1.4,"#1a1810"); R(g,18,21,.5,1.2,"#e04030"); hp(g,17,21,"#f0e0b0"); R(g,20,8,3,2,"#2a2a26"); hp(g,21,8.5,"#5ad06a"); }),
  pallet:outlined(24,26,g=>{ R(g,1,21,22,4,"#5a3a20"); for(const x of [1,10,19]) R(g,x,22,4,3,"#3a2414"); R(g,1,21,22,.5,"#7a5030");
    R(g,2,9,10,12,"#46412f"); R(g,2,9,10,2,"#5f583f"); R(g,12,11,10,10,"#3e4a32"); R(g,12,11,10,2,"#56603c"); R(g,4,1,14,9,"#4a4430"); R(g,4,1,14,2,"#6a6040");
    for(const [x,y,w,h] of [[6,1,1,20],[16,1,1,20]]) R(g,x,y,w,h,"rgba(20,16,10,.8)"); R(g,2,15,20,1,"rgba(20,16,10,.8)"); R(g,13,15,6,2,"#c9a24a"); R(g,4,5,5,1,"#d8d0bc"); R(g,4,6.5,3,.5,"#d8d0bc"); }),
  stasis:outlined(24,36,g=>{ R(g,3,2,18,32,"#2a2e32"); R(g,3,2,18,2,"#4a5054"); R(g,4,0,16,3,"#3a4044"); R(g,6,5,12,24,"#0a2a2e"); R(g,7,6,10,22,"#1a5a5e"); R(g,7,6,3,22,"#3a8a8a");
    R(g,10,8,4,4,"#0e3a3e"); R(g,9,12,6,9,"#0e3a3e"); R(g,10,21,1.5,6,"#0e3a3e"); R(g,12.5,21,1.5,6,"#0e3a3e"); for(let y=7;y<28;y+=3) hp(g,8+(y%5),y,"#c8ffff"); R(g,6,30,12,2,"#121618"); R(g,8,30.5,2,1,"#5ad0d0"); R(g,14,30.5,2,1,"#e8b048"); }),
  altar:outlined(24,26,g=>{ R(g,2,12,20,13,"#4a4440"); R(g,2,12,20,1,"#6a645c"); R(g,2,23,20,2,"#2a2622"); R(g,1,9,22,4,"#6a1812"); R(g,1,9,22,1,"#8a2a1c"); R(g,10,13,4,10,"#6a1812"); R(g,10,13,4,.5,"#c9a24a"); R(g,10,22.5,4,.5,"#c9a24a");
    skull(g,9.5,4,"#d8cdb4","#1a1410"); R(g,9,8,6,1,"#3a3430"); for(const cx of [4,7,17,20]){ R(g,cx,4,1.5,5,"#e8dcc0"); hp(g,cx+.5,3,"#ffd060"); hp(g,cx+.5,2.5,"#fff4c0"); } for(let k=0;k<4;k++) R(g,4+k*5,15,2,6,"#3a3430"); }),
  pew:outlined(24,20,g=>{ R(g,1,4,22,7,"#4a3020"); R(g,1,4,22,1,"#6a4a30"); for(let k=0;k<5;k++) R(g,2+k*4.5,5,.5,6,"#3a2414"); R(g,1,11,22,4,"#5a3a24"); R(g,1,11,22,1,"#7a5434"); R(g,2,15,2,4,"#2a1a10"); R(g,20,15,2,4,"#2a1a10"); R(g,1,3,2,9,"#3a2414"); R(g,21,3,2,9,"#3a2414"); }),
  o2rack:outlined(24,30,g=>{ R(g,2,26,20,3,"#2a2e30"); R(g,2,8,20,2,"#3a3e40"); for(const [x,c] of [[3,"#2a4a6a"],[9,"#e0e0d8"],[15,"#2a4a6a"]]){ R(g,x,3,5,23,c); R(g,x,3,1.5,23,shade(c,1.3)); R(g,x+4,3,1,23,shade(c,.6)); R(g,x+1.5,0,2,3,"#8a8a80"); R(g,x+1,1,3,.5,"#c8c8c0"); R(g,x,14,5,1,"#e8b048"); } }),
  pump:outlined(24,26,g=>{ R(g,2,10,20,15,"#3a3e36"); R(g,2,10,20,1,"#5a5e54"); R(g,2,10,1,15,"#5a5e54"); for(let k=0;k<20;k++) R(g,2+k,22,1,2,((k>>1)%2)?"#9a7a22":"#121008"); disc(g,8,13,5,"#2a2c28"); disc(g,8,13,4,"#4a4e46"); disc(g,8,13,1,"#8a8a80");
    for(let a=0;a<6;a++) R(g,8+Math.cos(a*1.047)*3-.25,13+Math.sin(a*1.047)*3-.25,.5,.5,"#1a1c18"); R(g,15,2,3,10,"#5a5e54"); R(g,15,2,1,10,"#8a8e84"); R(g,19,4,2,8,"#4a4e46"); R(g,14,0,5,3,"#2a2c28"); R(g,16,16,4,3,"#121410"); hp(g,17,17,"#5ad06a"); }),
  ammocrate:outlined(24,20,g=>{ R(g,2,6,20,13,"#3e4a2c"); R(g,2,6,20,1,"#56603c"); R(g,2,6,1,13,"#56603c"); R(g,21,7,1,12,"#262e1a"); R(g,3,2,18,5,"#2a3220"); R(g,3,2,18,.5,"#4a5434");
    for(let k=0;k<7;k++){ R(g,4.5+k*2.3,3,1.5,3,"#c9a24a"); hp(g,4.5+k*2.3,3,"#f0d890"); } R(g,6,11,12,4,"#2e3820"); R(g,7,12,2,2,"#d8d0bc"); R(g,10,12,2,2,"#d8d0bc"); R(g,13,12,4,.5,"#d8d0bc"); R(g,13,13.5,3,.5,"#d8d0bc"); R(g,2,17,20,2,"#1e2414"); }),
  shelf:outlined(24,32,g=>{ R(g,2,2,20,29,"#3a2a1c"); R(g,2,2,20,1,"#5a4430"); for(let k=0;k<4;k++){ const y=4+k*7; R(g,3,y,18,6,"#1a120c"); R(g,2,y+6,20,1,"#4a3424");
      for(let j=0;j<8;j++){ const v=hh(j,k,9); if(v%5===0){ R(g,3.5+j*2.2,y+3,2,3,"#d8cdb4"); R(g,3.5+j*2.2,y+3,2,.5,"#f0e8d4"); } else { const c=["#6a1a12","#2a3a5a","#4a5a2a","#5a4a20","#3a2a3a"][v%5]; R(g,3.5+j*2.2,y+1+(v%2),1.8,5-(v%2),c); hp(g,3.5+j*2.2,y+2+(v%2),"#c9a24a"); } } } }),
  cot:outlined(24,16,g=>{ R(g,2,4,20,7,"#4a5048"); R(g,2,4,20,1,"#6a7066"); R(g,3,3,6,4,"#8a8a80"); R(g,10,5,11,5,"#3a4038"); for(let k=0;k<4;k++) R(g,11+k*3,5,.5,5,"#2a3028"); R(g,2,11,20,1,"#2a2e2a"); R(g,3,12,1,3,"#5a5a54"); R(g,20,12,1,3,"#5a5a54"); }),
  drive:outlined(24,40,g=>{ R(g,3,6,18,32,"#2a2e32"); R(g,3,6,18,2,"#4a5056"); R(g,3,6,2,32,"#3e444a"); R(g,19,8,2,30,"#16191c"); for(let k=0;k<4;k++){ const y=11+k*6; R(g,5,y,14,3,"#0a1a2a"); R(g,6,y+1,12,1,"#3a8ad0"); R(g,6,y+1,4,.5,"#a8e0ff"); }
    R(g,6,2,12,5,"#3a3e42"); R(g,6,2,12,.5,"#6a7076"); R(g,8,0,8,3,"#4a4e52"); for(let k=0;k<5;k++) hp(g,5+k*3.5,36,"#e8b048"); R(g,3,36.5,18,1.5,"#121416"); R(g,0,20,3,3,"#4a4438"); R(g,21,26,3,3,"#4a4438"); }),
  reactor:outlined(24,40,g=>{ R(g,2,33,20,6,"#2a2a24"); for(let k=0;k<20;k++) R(g,2+k,35,1,2,((k>>1)%2)?"#9a7a22":"#121008"); R(g,5,6,14,28,"#33383c"); R(g,5,6,2,28,"#4e555a"); R(g,17,6,2,28,"#1a1d20");
    R(g,8,10,8,18,"#062a2e"); R(g,9,11,6,16,"#2ad0d0"); R(g,10,11,2,16,"#a8ffff"); R(g,9,11,6,1,"#e8ffff"); for(let y=13;y<27;y+=3) R(g,8,y,8,.5,"#0a3a3e"); R(g,4,2,16,5,"#2a2e32"); R(g,4,2,16,.5,"#5a6268"); R(g,7,0,10,3,"#3a4044");
    R(g,0,14,5,2,"#4a4438"); R(g,19,20,5,2,"#4a4438"); R(g,0,14,5,.5,"#7a705a"); R(g,19,20,5,.5,"#7a705a"); }),
  counter:outlined(24,24,g=>{ R(g,0,6,24,17,"#4a2c18"); R(g,0,6,24,1.5,"#8a6a40"); R(g,0,7.5,24,.5,"#2a1810"); R(g,2,10,9,11,"#3a2214"); R(g,13,10,9,11,"#3a2214"); R(g,0,21,24,2,"#1a100a"); R(g,4,3,2,4,"#6a1a12"); hp(g,4,3,"#fff"); R(g,16,4,3,3,"#d8cdb4"); R(g,16.5,4.5,2,1,"#3a2010"); }),
  strongbox:outlined(24,22,g=>{ R(g,2,5,20,16,"#3a3d40"); R(g,2,5,20,1.5,"#6a7076"); R(g,2,5,1,16,"#5a6066"); R(g,21,5,1,16,"#1a1c1e"); R(g,2,19,20,2,"#16181a");
    for(let k=0;k<20;k+=2) R(g,2+k,17,1,1.5,(k>>1)%2?"#c9a24a":"#141210"); R(g,4,7,16,9,"#2c2f32"); R(g,4,7,16,.5,"#50565c");
    disc(g,9,11.5,3,"#1a1c1e"); disc(g,9,11.5,2.2,"#6a7076"); disc(g,9,11.5,.8,"#141618"); for(let a=0;a<8;a++) hp(g,9+Math.cos(a*.785)*2.6,11.5+Math.sin(a*.785)*2.6,"#a8b0b6");
    R(g,14,9,5,5,"#1a1c1e"); R(g,15,10,3,1,"#5ad06a"); R(g,15,12,3,.5,"#3a3e42"); for(const [a,b] of [[3,6],[20,6],[3,19],[20,19]]) hp(g,a,b,"#8a9096"); },"#0c0d0e"),
  fridge:outlined(24,34,g=>{ R(g,3,2,18,31,"#8a9094"); R(g,3,2,18,1,"#c0c8cc"); R(g,3,2,1,31,"#b0b8bc"); R(g,20,3,1,30,"#4a5054"); R(g,3,13,18,.5,"#4a5054"); R(g,17,6,1,5,"#3a4044"); R(g,17,16,1,8,"#3a4044"); R(g,6,5,6,2,"#e8e0c0"); R(g,6,5.5,4,.5,"#a83a2a"); hp(g,6,28,"#5ad06a"); }),
  loader:outlined(24,36,g=>{ R(g,5,28,5,7,"#7a5e1a"); R(g,14,28,5,7,"#7a5e1a"); R(g,4,33,7,2,"#2a2a24"); R(g,13,33,7,2,"#2a2a24"); R(g,6,12,12,16,"#9a7a22"); R(g,6,12,12,1,"#c9a240"); R(g,7,14,10,9,"#1a1a16"); R(g,8,15,8,7,"#2a3a3e"); R(g,8,15,3,7,"#4a5a5e");
    for(let k=0;k<4;k++) R(g,7+k*3,13,1,10,"#5a4612"); R(g,1,14,5,3,"#7a5e1a"); R(g,18,14,5,3,"#7a5e1a"); R(g,0,17,3,8,"#5a5a50"); R(g,21,17,3,8,"#5a5a50"); R(g,0,25,2,2,"#2a2a24"); R(g,22,25,2,2,"#2a2a24"); for(let k=0;k<12;k++) R(g,6+k,25,1,2,((k>>1)%2)?"#141210":"#e0c040"); R(g,10,9,4,3,"#3a3a34"); hp(g,11,10,"#e04030"); }),
});
const PROP_NAME={strongbox:"Strongbox",crate:"Cargo crate",bed:"Bunk",desk:"Console desk",locker:"Locker",barrel:"Fuel drum",brazier:"Brazier",generator:"Generator",tank:"Specimen tank",couch:"Couch",table:"Mess table",chair:"Chair",coffee:"Coffee machine",vending:"Vending machine",arcade:"Arcade cabinet",toilet:"Toilet",sink:"Sink and mirror",shower:"Shower",bars:"Brig bars",captive:"Gerald",gunrack:"Weapon rack",plant:"Plant",captchair:"Captain's chair",footlocker:"Footlocker",workbench:"Workbench",counter:"Bar counter",fridge:"Galley fridge",cogitator:"Cogitator bank",medcab:"Medical cabinet",surgery:"Surgical table",pipes:"Pipe manifold",pallet:"Cargo pallet",stasis:"Stasis pod",altar:"Altar",pew:"Pew",o2rack:"Oxygen rack",pump:"Coolant pump",ammocrate:"Ammo crate",shelf:"Archive shelf",cot:"Cot",drive:"Drive housing",reactor:"Reactor core",loader:"Power loader"};
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
TERM.oldbench=outlined(24,26,g=>{ R(g,1,10,22,6,"#4a3a28"); R(g,1,10,22,1,"#6a5434"); R(g,3,2,18,8,"#2a2620"); R(g,3,2,18,1,"#45403a"); for(let k=0;k<5;k++) R(g,5+k*3,4,1,4,k%2?"#8a8a80":"#a37a32");
  R(g,4,11,6,1,"#8a8a80"); R(g,12,11,2,3,"#a32a1d"); R(g,16,11,5,2,"#3a3c38"); R(g,17,11,1,1,"#e8b048"); R(g,2,16,2,10,"#2a2018"); R(g,20,16,2,10,"#2a2018"); R(g,2,21,20,2,"#33281c"); R(g,6,19,4,2,"#9a7a22"); });
TERM.wardrobe=outlined(24,34,g=>{ R(g,3,2,18,30,"#3a2e24"); R(g,3,2,18,2,"#5a4834"); R(g,11,4,2,28,"#241c16"); R(g,5,6,5,22,"#5e1a12"); R(g,5,6,5,2,"#8a2a1c"); R(g,14,6,5,9,"#3a4448"); R(g,15,8,3,2,"#f2b648");
  R(g,14,17,5,11,"#2e3336"); R(g,15,18,3,3,"#4a5054"); R(g,9,16,1,2,"#c9a24a"); R(g,14,16,1,2,"#c9a24a"); });
TERM.workbench=outlined(24,40,g=>{ R(g,1,8,22,30,"#2e2a24"); R(g,1,8,22,2,"#4a4436"); R(g,1,8,2,30,"#3e382e"); R(g,21,10,2,28,"#16140f"); R(g,3,2,18,7,"#3a3428"); R(g,3,2,18,.5,"#a07e38"); skull(g,10,3,"#c8bca0","#1a1408");
    R(g,4,12,16,12,"#0a0806"); R(g,5,13,14,10,"#1e140a"); R(g,7,20,10,2,"#ff8a20"); R(g,8,20.5,8,1,"#ffe080"); for(let k=0;k<3;k++){ R(g,6+k*5,13,1.5,6,"#6a6458"); R(g,6.5+k*5,19,.5,1,"#ff6a20"); }
    R(g,3,26,18,3,"#4a4436"); R(g,3,26,18,.5,"#7a705a"); for(let k=0;k<6;k++) hp(g,5+k*2.5,27.5,k%2?"#5ad06a":"#e8b048"); for(let k=0;k<18;k++) R(g,3+k,34,1,2,((k>>1)%2)?"#9a7a22":"#121008"); R(g,0,16,2,10,"#4a4438"); R(g,22,14,2,12,"#4a4438"); });
TERM.bar=outlined(24,32,g=>{ R(g,1,2,22,10,"#1a120c"); for(let k=0;k<9;k++){ const c=["#6a1a12","#2a5a3a","#c9a24a","#3a2a5a","#8a6a20"][k%5]; R(g,2+k*2.3,4+(k%2),1.5,6-(k%2),c); hp(g,2+k*2.3,4+(k%2),"#fff"); } R(g,1,11,22,1,"#3a2414");
    R(g,1,16,22,14,"#4a2c18"); R(g,1,16,22,1.5,"#8a6a40"); R(g,1,17.5,22,.5,"#2a1810"); for(let k=0;k<4;k++) R(g,3+k*5,19,4,9,"#3a2214"); R(g,1,28,22,2,"#1a100a");
    for(const x of [6,11,16]){ R(g,x,12,2,4,"#a07e38"); R(g,x,12,2,.5,"#f0d890"); R(g,x+.5,15.5,1,.5,"#e8b048"); } R(g,19,13,3,3,"#d8cdb4"); R(g,19.5,13.5,2,2,"#5a3a1a"); });
TERM.navtable=outlined(48,26,g=>{ R(g,20,20,8,6,"#141a1c"); R(g,4,9,40,12,"#1e2628"); R(g,2,7,44,4,"#3a4448"); R(g,2,7,44,1,"#5a6a70"); R(g,6,8,36,2,"#0a3a40"); R(g,4,19,40,2,"#0e1214");
  for(let k=0;k<6;k++) R(g,8+k*6,15,3,2,k%2?"#5ad0d0":"#2a6a70"); R(g,22,12,4,2,"#e8b048"); });
const SEAT=outlined(24,24,g=>{ R(g,8,16,8,6,"#1a1e20"); R(g,5,10,14,7,"#3a3f42"); R(g,5,10,14,1,"#5a6266"); R(g,6,11,12,5,"#2a2f32"); });
const SEAT_BACK={}; for(const [k,c] of Object.entries({pilot:"#7a2416",copilot:"#2a5a5a",nav:"#2a5a5a",eng:"#5a4a20"})) SEAT_BACK[k]=outlined(24,14,g=>{ R(g,5,1,14,11,"#2e3336"); R(g,5,1,14,2,c); R(g,7,4,10,6,"#3a3f42"); R(g,3,6,3,7,"#1e2224"); R(g,18,6,3,7,"#1e2224"); });
const SEAT_NAME={pilot:"Pilot's seat",copilot:"Co-pilot's seat",nav:"Navigator's seat",eng:"Engineer's seat"};
TERM.comms=outlined(24,18,g=>{ ell(g,12,12,10,4.5,"#22262a"); ell(g,12,11,10,4,"#3a4046"); ell(g,12,10.6,8.4,3.2,"#14181c"); ell(g,12,10.4,5,1.8,"#5ad0d0"); ell(g,12,10.4,3,1,"#c8ffff");
  for(let k=0;k<6;k++){ const a=k*1.047; hp(g,12+Math.cos(a)*8.6,11+Math.sin(a)*3.4,"#7a8288"); } R(g,3,13,2,3,"#2a2e32"); R(g,19,13,2,3,"#2a2e32"); });
const TERM_NAME={comms:"Hologram comms",workbench:"Fabricator",bar:"Galley bar",wardrobe:"Wardrobe",navtable:"Star map table",helm:"Helm",rack:"Loadout rack",stash:"Stash locker",records:"Records terminal",board:"Contract board",airlock:"Airlock control"};

// ---------- space backdrop (ship view) ----------
const BD={};
function shade(hex,f){ const n=parseInt(hex.slice(1),16); return "#"+[16,8,0].map(s=>Math.round(((n>>s)&255)*f).toString(16).padStart(2,"0")).join(""); }
function backdrop(scene,w,h){
  const key=JSON.stringify(scene)+"|"+w+"x"+h; if(BD.key===key) return BD.c;
  const c=cvs(w,h), g=c.getContext("2d"); R(g,0,0,w,h,"#020305");
  let sd=7; const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const tint=scene.hue||scene.glow||scene.a||"#6f9b8c";
  for(let k=0;k<5;k++){ const x=rnd()*w, y=rnd()*h, r=60+rnd()*140, gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,tint+"18"); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(0,0,w,h); }
  for(let k=0;k<w*h/14;k++){ const v=rnd(); R(g,rnd()*w,rnd()*h,.5,.5,v>.985?"#e8eef8":v>.9?"#6a7486":v>.6?"#2a3040":"#161a24"); }
  for(let k=0;k<3;k++){ const y0=rnd()*h, gr2=g.createLinearGradient(0,y0-40,0,y0+40); gr2.addColorStop(0,"rgba(0,0,0,0)"); gr2.addColorStop(.5,"rgba(0,0,0,.35)"); gr2.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr2; g.fillRect(0,y0-40,w,80); }
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
  const D=Items.def(it.d)||{k:"?"}, r=(a,b,w,h,c)=>R(g,x+a,y+b,w,h,c), h2=(a,b,c)=>R(g,x+a,y+b,.5,.5,c);
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
      if(part==="head"){ L.hd=it.d; drawHuman(mg,{b:0,view:"f"},L); } else if(part==="legs"){ drawLegPiece(mg,it.d,8.5,0,false); drawLegPiece(mg,it.d,12.5,0,false); }
      else if(part==="body"){ drawChest(mg,it.d,0,L,it.d==="hazard"?"b":"f"); }
      else { const v=it.d==="cape"?"b":"f"; drawAccBack(mg,it.d,0,L,v); drawAccFront(mg,it.d,0,L,v); if(it.d==="pauldron") drawPauldron(mg,0,"f"); }
      let bx=[26,0,36,0]; if(part==="head") bx=[5,20,1,17]; else { const PW=26*Q, PH=36*Q, px=mg.getImageData(0,0,PW,PH).data; for(let yy=0;yy<PH;yy++) for(let xx=0;xx<PW;xx++) if(px[(yy*PW+xx)*4+3]){ bx[0]=Math.min(bx[0],xx/Q); bx[1]=Math.max(bx[1],xx/Q); bx[2]=Math.min(bx[2],yy/Q); bx[3]=Math.max(bx[3],yy/Q); } bx=bx.map(Math.floor); }
      const cw=Math.max(1,bx[1]-bx[0]+1), ch=Math.max(1,bx[3]-bx[2]+1), sc=Math.min(14/cw,14/ch,2); g.imageSmoothingEnabled=false;
      g.drawImage(m,bx[0],bx[2],cw,ch,x+Math.round((16-cw*sc)/2),y+Math.round((16-ch*sc)/2),cw*sc,ch*sc); break; }
    case "light": { const lens=it.d==="seraphlight"?"#fff4c0":it.d==="lumen"?"#c8f0ff":"#ffe8a0", body=it.d==="seraphlight"?"#a07e38":it.d==="floodlamp"?"#3a4a3a":"#3a3a34";
      if(it.d==="floodlamp"){ r(3,5,10,8,body); r(3,5,10,1,shade(body,1.5)); r(4,6,8,6,lens); r(4,6,8,1,"#fff"); r(7,13,2,2,"#2a2a24"); r(5,3,6,2,"#2a2a24"); }
      else { r(2,6,8,4,body); r(2,6,8,1,shade(body,1.5)); r(10,5,4,6,shade(body,1.2)); r(13,5.5,1,5,lens); h2(13,6,"#fff"); r(4,10,2,2,"#e04030"); for(let k=0;k<3;k++) r(3+k*2,7.5,.5,1.5,shade(body,.6)); }
      if(blink) { r(14,6,2,4,"rgba(255,240,180,.35)"); } break; }
    case "food": { const D2=Items.def(it.d);
      if(it.d==="ration"||it.d==="jerky"){ r(2,6,12,5,it.d==="jerky"?"#6a3a1e":"#7a7262"); r(2,6,12,1,"#a8a08a"); r(3,7.5,7,1,"#3a3428"); r(10,7,3,3,"#c9a24a"); }
      else if(it.d==="paste"){ r(4,3,7,10,"#8a9a7a"); r(4,3,7,1,"#b8c8a8"); r(6,13,3,2,"#4a4a40"); r(5,6,5,2,"#e8e0c0"); }
      else if(it.d==="stew"||it.d==="feast"){ r(3,5,10,9,it.d==="feast"?"#8a6a20":"#6a6e70"); r(3,5,10,1.5,"#a8acae"); r(4,8,8,3,it.d==="feast"?"#e8c868":"#a83a2a"); r(5,8.5,4,1,"#fff"); }
      else if(it.d==="recaf"){ r(4,6,7,8,"#d8cdb4"); r(4,6,7,1,"#f0e8d4"); r(5,7,5,2,"#3a2010"); r(11,8,2,3,"#d8cdb4"); h2(6,4,"#c8c8c0"); h2(8,3,"#c8c8c0"); }
      else if(it.d==="amber"){ r(6,2,4,3,"#3a2a1a"); r(5,5,6,10,"#8a5a1a"); r(5,5,2,10,"#c88a3a"); r(6,9,4,3,"#e8dcc0"); }
      else { r(5,2,6,2,"#2a2a26"); r(4,4,8,11,it.d==="purewater"?"#4a8ad0":"#5a6a7a"); r(4,4,2,11,"#a8c8e8"); r(5,8,6,3,"#e8e0c0"); }
      break; }
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
      else if(it.d==="splint"){ r(3,3,3,11,"#8a7a5a"); r(10,3,3,11,"#8a7a5a"); r(3,3,1,11,"#b8a880"); r(10,3,1,11,"#b8a880"); r(2,6,12,2,"#d8d0b8"); r(2,10,12,2,"#d8d0b8"); }
      else if(it.d==="antibiotic"){ r(5,4,6,10,"#d8e0e0"); r(5,4,1,10,"#ffffff"); r(5,2,6,2,"#3a7ab0"); r(6,8,4,3,"#3a7ab0"); r(7,9,2,1,"#ffffff"); }
      else if(it.d==="o2"){ r(5,3,6,11,"#36545a"); r(5,3,1,11,"#6a9aa0"); r(6,1,4,2,"#8a8a80"); r(5,7,6,1,"#c9a24a"); }
      else { r(2,7,10,3,"#cfd8d8"); r(2,7,10,1,"#ffffff"); r(4,8,6,1,"#e04060"); r(12,8,3,1,"#8a8a80"); r(0,7,2,3,"#4a5056"); }
      break;
    case "mod": if(it.d==="mod_scope"){ r(2,5,12,4,"#2a2e32"); r(2,5,12,1,"#5a6268"); r(1,4,2,6,"#3a4046"); r(13,4,2,6,"#3a4046"); r(13,6,1,2,"#5ad0d0"); r(6,9,3,3,"#2a2e32"); }
      else if(it.d==="mod_suppressor"){ r(1,6,14,4,"#24282c"); r(1,6,14,1,"#4a5258"); for(let k=3;k<14;k+=3) r(k,6,1,4,"#141618"); }
      else if(it.d==="mod_laser"){ r(3,6,8,4,"#2a2e32"); r(3,6,8,1,"#5a6268"); r(11,7,4,1,"#ff3a20"); r(10,7,1,2,"#ff6a4a"); }
      else { r(3,5,8,6,"#3a3e42"); r(3,5,8,1,"#6a7076"); r(11,6,3,4,"#2a2e32"); r(14,7,1,2,"#141618"); }
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
FL["Engine room"]={type:"grate",base:"#3a3832",hi:"#504c44",lo:"#26241f",seam:"#121110",inner:"#2e2c27",riv:"#6a6458",mesh:"#2a2824"};
FL["Infirmary"]=FL["Medbay"];
FL["Workshop"]={type:"plate",base:"#3e3a30",hi:"#524c3e",lo:"#2a2720",seam:"#141210",inner:"#383428",riv:"#6a6450",mesh:"#2a2620",oil:true};
FL["Galley"]=FL["Mess hall"]; FL["Fabrication bay"]=FL["Workshop"];
FL._=FL["Main corridor"];
const AMBC={"Docking bay":[.44,.47,.5],"Medbay":[.42,.52,.58],"Crew quarters":[.5,.42,.33],"Security office":[.4,.42,.48],"Captain's cabin":[.5,.32,.25],
  "Main corridor":[.34,.43,.43],"Lower corridor":[.32,.4,.42],"Service shaft":[.38,.38,.34],"Fuel storage":[.5,.4,.26],"Armory":[.38,.42,.48],"Shrine":[.42,.22,.2],"Mess hall":[.62,.5,.38],"Workshop":[.5,.46,.36],"Bridge":[.5,.58,.66],"Break room":[.66,.54,.42],"Bathroom":[.62,.68,.72],"Brig":[.54,.34,.32],"Comms":[.56,.5,.4],"Main hall":[.5,.56,.56],"Ship hold":[.52,.5,.44],"Quarters":[.6,.5,.4],"Airlock":[.5,.5,.54],"Engineering":[.52,.42,.29],"Engine room":[.46,.44,.4],"Fabrication bay":[.56,.46,.34],"Galley":[.66,.52,.38],"Infirmary":[.58,.66,.7],"Cargo hold":[.42,.42,.38],"Xenolab":[.3,.5,.38],"Vault":[.48,.4,.24],_:[.34,.4,.4]};
FL.corrPlate={type:"plate",base:"#323b3b",hi:"#465250",lo:"#212929",seam:"#101515",inner:"#2c3535",riv:"#5a6a68",mesh:"#26302f"};
function styleAt(x,y){ const n=Sim.roomName(x,y); if((n==="Main corridor"||n==="Lower corridor"||n==="Main hall")&&(x%6)>1) return FL.corrPlate; return FL[n]||FL._; }
function bevel(g,x,y,w,h,base,hi,lo,seam){ R(g,x,y,w,h,seam); R(g,x+1,y+1,w-2,h-2,base); R(g,x+1,y+1,w-2,1,hi); R(g,x+1,y+1,1,h-2,hi); R(g,x+1,y+h-2,w-2,1,lo); R(g,x+w-2,y+1,1,h-2,lo); }
function drawFloor(g,x,y,force){
  const st=force||styleAt(x,y), ox=x*TS, oy=y*TS, h=hh(x,y);
  switch(st.type){
    case "plate": bevel(g,ox,oy,24,24,st.base,st.hi,st.lo,st.seam); R(g,ox+6,oy+6,12,12,st.inner); R(g,ox+6,oy+6,12,1,st.lo); R(g,ox+6,oy+17,12,1,st.hi);
      for(const [a,b] of [[3,3],[20,3],[3,20],[20,20]]) R(g,ox+a,oy+b,1,1,st.riv);
      if(st.oil&&h%4===0){ g.save(); g.globalAlpha=.4; g.fillStyle="#080603"; g.beginPath(); g.ellipse(ox+12,oy+13,4,2.2,0,0,6.283); g.fill(); g.restore(); } break;
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
  for(let k=0;k<6;k++){ const v=hh(x,y,k+11); if(v%3===0) R(g,ox+v%22+1,oy+(v>>>6)%22+1,1+(v>>>12)%2,1,(v>>>3)%2?"rgba(0,0,0,.35)":"rgba(255,235,200,.05)"); }
  if(h%7===0){ let cx=ox+4+(h>>5)%14, cy=oy+4+(h>>9)%14; for(let k=0;k<9;k++){ R(g,cx,cy,1,1,"rgba(0,0,0,.5)"); const v=hh(x,y,k+60); if(v%2) cx+=v%4<2?1:-1; else cy+=1; } }
  if(h%9===0) disc(g,ox+6+(h>>4)%12,oy+6+(h>>8)%12,3,"rgba(30,22,10,.18)");
  { const v=hh(x,y,333)%100; if(v<35) R(g,ox,oy,24,24,`rgba(0,0,0,${.04+v/500})`); else if(v>88) R(g,ox,oy,24,24,"rgba(255,235,210,.035)"); }   // panel-to-panel variation
  // mesh border against walls
  const mesh=(sx,sy,w,hh2)=>{ for(let j=0;j<hh2;j++)for(let i=0;i<w;i++) R(g,sx+i,sy+j,1,1,((i+j)%2)?st.mesh:st.seam); };
  if(isW(x,y-1)) mesh(ox,oy,24,4); if(isW(x,y+1)) mesh(ox,oy+20,24,4); if(isW(x-1,y)) mesh(ox,oy,4,24); if(isW(x+1,y)) mesh(ox+20,oy,4,24);
  floorDetail(g,x,y,st);
  if(!force&&S.mode!=="ship") floorMarks(g,x,y);
}
// Paint on the deck that tells you what the room is for.
function roomRect(x,y){ const RS=S.rooms||(Sim.MAPS[S.map]||{}).rooms||[]; for(const r of RS) if(x>=r[1]&&x<=r[3]&&y>=r[2]&&y<=r[4]) return r; return null; }
function floorMarks(g,x,y){ const r=roomRect(x,y); if(!r) return; const [n,x0,y0,x1,y1]=r, ox=x*TS, oy=y*TS, cx=(x0+x1)>>1, cy=(y0+y1)>>1, a="rgba(";
  const paint=(f)=>{ g.save(); g.globalAlpha=.55; f(); g.restore(); };
  if(/Cargo|Docking/.test(n)){ if(x===x0+1||x===x1-1) paint(()=>{ for(let k=0;k<24;k+=6) R(g,x===x0+1?ox+2:ox+19,oy+k,3,3,"#b8901e"); });
    if(y===y1&&x>x0&&x<x1) paint(()=>R(g,ox,oy+20,24,1.5,"#b8901e")); if(/Docking/.test(n)&&(x+y)%9===0) paint(()=>{ for(let k=0;k<3;k++) R(g,ox+7+k*2,oy+8+k*2,8-k*4>0?8-k*4:1,1.5,"#c9a24a"); }); }
  else if(/Medbay|Infirmary/.test(n)){ if(x===cx&&y===cy) paint(()=>{ R(g,ox+9,oy+3,6,18,"#2a8a4a"); R(g,ox+3,oy+9,18,6,"#2a8a4a"); R(g,ox+10,oy+4,4,16,"#e8f0e8"); R(g,ox+4,oy+10,16,4,"#e8f0e8"); }); }
  else if(/Xenolab/.test(n)){ if(y===y0||y===y1) paint(()=>{ for(let k=0;k<24;k+=4) R(g,ox+k,y===y0?oy+1:oy+21,2,2,"#c9a24a"); }); }
  else if(/Armory|Security/.test(n)){ if((x===x0||x===x1)&&y===y0) paint(()=>{ for(let k=0;k<5;k++) R(g,ox+2+k*4,oy+2,2,20,k%2?"#e8e0d0":"#9a1a12"); }); if(x===cx&&y===y1&&/Armory/.test(n)) paint(()=>{ R(g,ox+3,oy+6,18,12,"#7a1a12"); R(g,ox+5,oy+8,14,8,"rgba(0,0,0,.4)"); }); }
  else if(/Fuel|Engineering/.test(n)){ if(y===y1||x===x0||x===x1) paint(()=>{ const vrt=x===x0||x===x1; for(let k=0;k<24;k+=4) vrt?R(g,x===x0?ox+1:ox+20,oy+k,3,2,(k>>2)%2?"#0d0b08":"#c9a24a"):R(g,ox+k,oy+20,2,3,(k>>2)%2?"#0d0b08":"#c9a24a"); }); }
  else if(/Captain|Shrine/.test(n)){ if(x>x0&&x<x1&&y>y0+1&&y<y1&&x===cx) paint(()=>{ R(g,ox+5,oy,14,24,/Shrine/.test(n)?"#4a1410":"#4a1a14"); R(g,ox+6,oy,1,24,"#a37a32"); R(g,ox+17,oy,1,24,"#a37a32"); }); }
  else if(/Vault/.test(n)){ if(x===x0||x===x1||y===y0||y===y1) paint(()=>R(g,ox+((x===x0)?1:0),oy+((y===y0)?1:0),x===x0||x===x1?2:24,y===y0||y===y1?2:24,"#8a6a2a")); }
  else if(/corridor|hall/i.test(n)){ const hz=x1-x0>=y1-y0; if(hz&&y===cy&&x%2===0) paint(()=>R(g,ox+4,oy+11,12,1.5,"#9a8a4a")); if(!hz&&x===cx&&y%2===0) paint(()=>R(g,ox+11,oy+4,1.5,12,"#9a8a4a"));
    if(hz&&y===cy&&x%12===5) paint(()=>{ for(let k=0;k<5;k++) R(g,ox+8+k,oy+7+k,1.5,1,"#d8d0b0"), R(g,ox+8+k,oy+16-k,1.5,1,"#d8d0b0"); }); }
}
// Room plate over a door: an icon in the room's colour.
const PLATE=[[/Medbay|Infirmary/,"#2a9a4a","cross"],[/Xenolab/,"#c9a020","bio"],[/Armory/,"#b82a1a","ammo"],[/Security/,"#3a6aaa","eye"],[/Captain/,"#c9a24a","star"],[/Engineering|Workshop/,"#d07a20","gear"],
  [/Cargo/,"#b8901e","box"],[/Fuel/,"#b82a1a","drop"],[/Mess/,"#c08a40","cup"],[/Crew/,"#7a8a9a","bed"],[/Shrine/,"#8a1a12","skull"],[/Vault/,"#c9a24a","lock"]];
function doorPlate(g,x,y,ox,oy){ let n=""; for(const [a,b] of [[x,y+1],[x,y-1],[x+1,y],[x-1,y]]){ const rn=Sim.roomName(a,b); if(!/corridor|hall|shaft|crawl/i.test(rn)){ n=rn; break; } } const P=PLATE.find(p=>p[0].test(n)); if(!P) return;
  const px=ox+7, py=oy+1, c=P[1]; R(g,px,py,10,6,"#0a0909"); R(g,px+.5,py+.5,9,5,"#1e1c1a"); R(g,px+.5,py+.5,9,.5,c); const cx=px+5, cy=py+3.2;
  switch(P[2]){ case "cross": R(g,cx-.6,cy-2,1.2,4,c); R(g,cx-2,cy-.6,4,1.2,c); break; case "bio": disc(g,cx,cy,1.8,c); disc(g,cx,cy,.7,"#1e1c1a"); break;
    case "ammo": for(let k=0;k<3;k++) R(g,cx-2.5+k*1.8,cy-1.5,1.2,3,c); break; case "eye": R(g,cx-2.5,cy-.6,5,1.2,c); disc(g,cx,cy,.9,c); break;
    case "star": for(let k=0;k<5;k++){ const an=k*1.2566-1.57; R(g,cx+Math.cos(an)*1.6-.4,cy+Math.sin(an)*1.6-.4,.8,.8,c); } hp(g,cx,cy,c); break;
    case "gear": disc(g,cx,cy,1.8,c); disc(g,cx,cy,.7,"#1e1c1a"); for(let k=0;k<4;k++) R(g,cx+Math.cos(k*1.57)*2.1-.4,cy+Math.sin(k*1.57)*2.1-.4,.8,.8,c); break;
    case "box": R(g,cx-2,cy-1.5,4,3,c); R(g,cx-2,cy-.2,4,.4,"#1e1c1a"); break; case "drop": disc(g,cx,cy+.5,1.4,c); R(g,cx-.4,cy-2,.8,1.5,c); break;
    case "cup": R(g,cx-1.5,cy-1.5,3,3,c); R(g,cx+1.5,cy-.8,.8,1.5,c); break; case "bed": R(g,cx-2.5,cy,5,1.4,c); R(g,cx-2.5,cy-1.2,1.4,1.2,c); break;
    case "skull": skull(g,cx-2.5,cy-2,c,"#1e1c1a"); break; case "lock": R(g,cx-1.5,cy-.5,3,2.5,c); R(g,cx-1,cy-2,.6,1.6,c); R(g,cx+.4,cy-2,.6,1.6,c); break; } }
// ---------- baked shading for the static layer ----------
let GRIME=null;
function grimeTex(){ if(GRIME) return GRIME; const S2=192, c=cvs(S2,S2), g=c.getContext("2d"); let sd=97; const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  for(let i=0;i<70;i++){ const x=rnd()*S2, y=rnd()*S2, r=3+rnd()*16; for(const [ox,oy] of [[0,0],[S2,0],[0,S2],[-S2,0],[0,-S2]]){ const gr=g.createRadialGradient(x+ox,y+oy,0,x+ox,y+oy,r); const rust=rnd()<.25;
      gr.addColorStop(0,rust?`rgba(70,34,12,${.1+rnd()*.14})`:`rgba(0,0,0,${.12+rnd()*.22})`); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(x+ox-r,y+oy-r,r*2,r*2); } }
  for(let i=0;i<260;i++){ const x=rnd()*S2, y=rnd()*S2, a=rnd()*6.283, L=2+rnd()*9, light=rnd()<.35; g.fillStyle=light?"rgba(230,220,200,.09)":"rgba(0,0,0,.32)";
    for(let k=0;k<L*2;k++) g.fillRect(((x+Math.cos(a)*k/2)%S2+S2)%S2,((y+Math.sin(a)*k/2)%S2+S2)%S2,.5,.5); }
  for(let i=0;i<2600;i++){ const v=rnd(); g.fillStyle=v<.75?`rgba(0,0,0,${.15+rnd()*.3})`:`rgba(220,210,190,${.05+rnd()*.07})`; g.fillRect(rnd()*S2,rnd()*S2,.5,.5); }
  return GRIME=c; }
function bakeShading(g){
  const fl=t=>!(t.t==="wall"||t.t==="window"||t.t==="space"||t.t==="breach");
  const lg=(x0,y0,x1,y1,a)=>{ const gr=g.createLinearGradient(x0,y0,x1,y1); gr.addColorStop(0,`rgba(0,0,0,${a})`); gr.addColorStop(1,"rgba(0,0,0,0)"); return gr; };
  for(let y=0;y<S.H;y++)for(let x=0;x<S.W;x++){ const t=T(x,y); if(!fl(t)) continue; const ox=x*TS, oy=y*TS;
    if(!fl(T(x,y-1))){ g.fillStyle=lg(0,oy,0,oy+11,.78); g.fillRect(ox,oy,24,11); }
    if(!fl(T(x-1,y))){ g.fillStyle=lg(ox,0,ox+7,0,.6); g.fillRect(ox,oy,7,24); }
    if(!fl(T(x+1,y))){ g.fillStyle=lg(ox+24,0,ox+18,0,.5); g.fillRect(ox+18,oy,6,24); }
    if(!fl(T(x,y+1))){ g.fillStyle=lg(0,oy+24,0,oy+19,.4); g.fillRect(ox,oy+19,24,5); } }
  const pat=g.createPattern(grimeTex(),"repeat"); try{ pat.setTransform(new DOMMatrix().scale(1/Q)); }catch(e){}
  g.save(); g.globalCompositeOperation="source-atop"; g.fillStyle=pat; g.fillRect(0,0,S.W*TS,S.H*TS); g.globalAlpha=.6; g.fillRect(0,0,S.W*TS,S.H*TS); g.restore();
}
function floorDetail(g,x,y,st){ const ox=x*TS, oy=y*TS, h=hh(x,y,77), k=h%23;
  // worn panel edges and scuffs
  for(let i=0;i<10;i++){ const v=hh(x,y,i+120); hp(g,ox+1+(v%44)/2,oy+1+((v>>>6)%44)/2,(v>>>3)%3?"rgba(0,0,0,.45)":"rgba(255,240,215,.12)"); }
  if(k===0){ const yy=oy+4+(h>>5)%14; R(g,ox,yy,24,1.5,"#0b0b0a"); R(g,ox,yy,24,.5,"#33302a"); for(let i=2;i<24;i+=7) R(g,ox+i,yy-.5,1,2.5,"#1a1916"); }                       // cable
  else if(k===1){ R(g,ox+7,oy+7,10,10,"#0a0b0b"); for(let i=0;i<5;i++) R(g,ox+7.5,oy+8+i*2,9,.5,"#2c3232"); R(g,ox+7,oy+7,10,.5,"#4a5050"); }                                         // drain
  else if(S.mode==="ship"&&k>=1&&k<=5){ }
  else if(k===2||k===3){ for(let i=0;i<3;i++){ const v=hh(x,y,i+140); R(g,ox+4+v%15,oy+6+(v>>>5)%12,1,.5,"#c9a24a"); hp(g,ox+4+v%15,oy+6+(v>>>5)%12,"#f0d890"); } }                // spent casings
  else if(k===4){ const px=ox+5+(h>>4)%10, py=oy+6+(h>>8)%10; R(g,px,py,6,4,"#b8ae96"); R(g,px,py,6,.5,"#d8d0bc"); R(g,px+1,py+1.5,4,.5,"#5a5246"); R(g,px+1,py+2.5,3,.5,"#5a5246"); }   // dropped paper
  else if(k===5){ const px=ox+8+(h>>6)%8, py=oy+9+(h>>9)%7; g.save(); g.globalAlpha=.55; g.fillStyle="#060504"; g.beginPath(); g.ellipse(px,py,4.5,2.2,0,0,6.283); g.ellipse(px+3,py+1.5,2.5,1.4,0,0,6.283); g.fill(); g.restore(); R(g,px-2.5,py-1,2.5,.5,"rgba(150,170,190,.3)"); hp(g,px+1.5,py-.5,"rgba(200,120,220,.25)"); } // oil slick
  else if(k===6&&st.type==="plate"){ skull(g,ox+10,oy+10,"#5a5650","#1a1816"); R(g,ox+8,oy+9,9,.5,"#4a4640"); R(g,ox+8,oy+14.5,9,.5,"#1a1816"); }                                   // engraved skull plaque
  else if(k===7){ for(let i=0;i<4;i++){ const v=hh(x,y,i+150); R(g,ox+3+v%17,oy+3+(v>>>5)%17,.5+((v>>>9)%3)*.5,.5,"#6a6458"); } }                                                       // bolts and grit
}
function wallDetail(g,x,y,fy,fh,ext){ const ox=x*TS, h=hh(x,y,31);
  const gr=g.createLinearGradient(0,fy,0,fy+fh); gr.addColorStop(0,"rgba(255,240,220,.06)"); gr.addColorStop(.55,"rgba(0,0,0,.05)"); gr.addColorStop(1,"rgba(0,0,0,.55)"); g.fillStyle=gr; g.fillRect(ox,fy,24,fh);
  for(let i=1;i<24;i+=4){ hp(g,ox+i,fy+1.5,"#5a564e"); hp(g,ox+i+.5,fy+2,"#0c0b0a"); }                                                 // rivet row
  for(let i=0;i<3;i++){ const v=hh(x,y,i+200); if(v%3) continue; const dx=ox+2+v%20, L=3+(v>>>5)%9; for(let j=0;j<L*2;j++) R(g,dx,fy+1+j/2,.5,.5,`rgba(0,0,0,${.5-j/(L*5)})`); } // drips
  if(!ext&&h%5===0){ R(g,ox+2+(h>>4)%14,fy+fh-6,6,4,"#4a2a14"); for(let i=0;i<14;i++){ const v=hh(x,y,i+230); hp(g,ox+1+(h>>4)%14+v%9,fy+fh-7+(v>>>5)%6,(v>>>3)%2?"#6a3a1a":"#2a160a"); } } // rust bloom
  R(g,ox,fy+fh-2.5,24,.5,"rgba(255,230,200,.07)");
}
function drawSpace(g,x,y){ const ox=x*TS, oy=y*TS; R(g,ox,oy,24,24,"#030305"); for(let k=0;k<6;k++){ const v=hh(x,y,k+70); if(v%3===0) hp(g,ox+(v%48)/2,oy+((v>>>6)%48)/2,v%5?"#1e2230":"#5a6274"); }
  for(let k=0;k<4;k++){ const v=hh(x,y,k+50); if(v%4===0) R(g,ox+v%24,oy+(v>>>5)%24,1,1,v%7===0?"#c9cfdc":"#3c4252"); } }
function capEdges(g,x,y,h){ const ox=x*TS, oy=y*TS;
  if(!isW(x-1,y)){ R(g,ox,oy,1,h,"#6a6458"); R(g,ox+1,oy,1,h,"#0c0b0a"); }
  if(!isW(x+1,y)){ R(g,ox+23,oy,1,h,"#6a6458"); R(g,ox+22,oy,1,h,"#0c0b0a"); }
  if(!isW(x,y-1)){ R(g,ox,oy,24,1,"#6a6458"); R(g,ox,oy+1,24,1,"#0c0b0a"); } }
function wallCap(g,x,y,h){ const ox=x*TS, oy=y*TS; R(g,ox,oy,24,h,"#151413");
  for(let k=0;k<3;k++){ const v=hh(x,y,k+30); const vx=ox+(v%5)*5, vy=oy+((v>>>4)%Math.max(1,h-3)); R(g,vx,vy,6,2,"#1f1d1b"); R(g,vx,vy,6,1,"#2a2825"); }
  capEdges(g,x,y,h); }
function skull(g,x,y,c,d){ [".ccc.","cdcdc","ccccc",".c.c."].forEach((r,j)=>[...r].forEach((ch,i)=>{ if(ch==="c") R(g,x+i,y+j,1,1,c); else if(ch==="d") R(g,x+i,y+j,1,1,d); })); }
// Light fittings that a working station would actually have: one per few tiles of every room's back wall,
// spaced lamps down corridors, sconces on the side walls of long narrow rooms. Some are dead or flicker.
let FIX=new Map();
const COOLROOM=/Medbay|Xenolab|Infirmary|Security|Armory|Vault|Bridge|Comms/, WARMROOM=/Mess|Crew|Captain|Quarters|Galley|Shrine|Break/;
function lampCol(n){ return COOLROOM.test(n)?[.82,.92,1]:WARMROOM.test(n)?[1,.78,.5]:[1,.88,.7]; }
function planFixtures(){ const M=new Map(); if(S.mode==="ship") return M; const RS=S.rooms||(Sim.MAPS[S.map]||{}).rooms||[];
  const st=(x,y)=>{ const v=hh(x,y,909)%20; return {dead:v<2,flick:v>=2&&v<5,emerg:v%3===0}; };
  for(const r of RS){ const [n,x0,y0,x1,y1]=r, w=x1-x0+1, ht=y1-y0+1, wy=y0-1, cor=/corridor|shaft|hall|crawl/i.test(n), step=cor?6:(w<=5?99:4), col=lampCol(n);
    const xs=[]; if(step===99) xs.push((x0+x1)>>1); else for(let x=x0+((w-1)%step>>1)+(cor?2:1);x<=x1;x+=step) xs.push(x);
    for(const x of xs){ for(const dx of [0,1,-1]){ const xx=x+dx; if(T(xx,wy).t==="wall"&&T(xx,wy+1).t!=="wall"&&xx>=x0&&xx<=x1){ M.set(xx+","+wy,{...st(xx,wy),col,room:n,cor}); break; } } }
    if(ht>=w*1.6&&ht>=7) for(let y=y0+3;y<=y1;y+=6){ for(const [sx,side] of [[x0-1,1],[x1+1,-1]]){ if(T(sx,y).t==="wall"){ M.set(sx+","+y,{...st(sx,y),col,room:n,cor:true,side}); break; } } } }
  return M; }
function drawFixture(g,x,y,F,fy){ const ox=x*TS;
  if(F.side){ const bx=F.side>0?ox+19:ox+1; R(g,bx,y*TS+8,4,6,"#2a2620"); R(g,bx+(F.side>0?1:0),y*TS+9,3,4,F.dead?"#3a3428":"#d8c8a0"); R(g,bx,y*TS+8,4,.5,"#5a5446");
    SOURCES.push({kind:"lamp",x:x+F.side,y,bx:bx+2,by:y*TS+11,emerg:F.emerg,flick:F.flick,dead:F.dead,ph:(hh(x,y)%628)/100,r:5,i:1.05,col:F.col}); return; }
  if(F.cor){ R(g,ox+7,fy,10,4,"#1a1916"); R(g,ox+7,fy,10,.5,"#4a463e"); R(g,ox+8,fy+1,8,2,F.dead?"#2e2a22":"#e8dcb8"); R(g,ox+8,fy+1,8,.5,F.dead?"#3a3428":"#fff8e0"); R(g,ox+6,fy+3.5,12,1,"#0c0b0a"); }
  else { R(g,ox+3,fy,18,4,"#1c1b18"); R(g,ox+3,fy,18,.5,"#55504a"); R(g,ox+4,fy+1,16,2,F.dead?"#2e2a22":"#ece2c4"); R(g,ox+4,fy+1,16,.5,F.dead?"#3a3428":"#fffaf0");
    for(let k=6;k<20;k+=4) R(g,ox+k,fy+1,.5,2,"rgba(0,0,0,.35)"); R(g,ox+2,fy+3.5,20,1,"#0c0b0a"); if(F.dead){ R(g,ox+9,fy+1,3,2,"#121110"); hp(g,ox+10,fy+4,"#6a6050"); } }
  SOURCES.push({kind:"lamp",x,y:y+1,bx:ox+12,by:fy+4,emerg:F.emerg,flick:F.flick,dead:F.dead,ph:(hh(x,y)%628)/100,r:F.cor?6:7.5,i:F.cor?1.15:1.4,col:F.col,strip:!F.cor}); }
// Things you'd expect on the walls of each kind of room.
function themedDecor(g,x,y,ox,fy,fh,n,h){ const v=h%7, top=fy+5;
  const plaque=(px,w,c,c2)=>{ R(g,px,top,w,7,"#0c0b0a"); R(g,px+.5,top+.5,w-1,6,c); R(g,px+.5,top+.5,w-1,.5,c2); };
  if(/Medbay|Infirmary/.test(n)){ if(v<3){ plaque(ox+7,10,"#c8ccd0","#f0f4f8"); R(g,ox+11,top+1.5,2,4,"#2a9a4a"); R(g,ox+10,top+2.5,4,2,"#2a9a4a"); return true; }
    if(v===3){ R(g,ox+4,top-1,16,8,"#0a1210"); R(g,ox+4,top-1,16,.5,"#3a4a44"); let px=ox+5; for(let k=0;k<14;k++){ const yy=top+3+((k%5===2)?-2:(k%5===3)?2:0); R(g,px+k,yy,1,1,"#4aff7a"); } SOURCES.push({kind:"screen",x,y:y+1,bx:ox+12,by:top+3,r:2.2,i:.4,col:[.3,1,.5]}); return true; } }
  if(/Xenolab/.test(n)&&v<3){ R(g,ox+8,top-1,8,8,"#0c0b0a"); for(let k=0;k<4;k++) R(g,ox+12-k-.5,top+k*1.7,1+k*2,1.8,"#d8b030"); disc(g,ox+12,top+4,1.2,"#1a1608"); return true; }
  if(/Security/.test(n)&&v<4){ for(let k=0;k<2;k++){ const mx=ox+3+k*10; R(g,mx,top-2,8,7,"#0a0c0e"); R(g,mx+.5,top-1.5,7,6,k?"#14262a":"#1a2420"); for(let j=0;j<3;j++) R(g,mx+1,top+j*1.6,6,.5,"rgba(140,220,200,.35)"); } SOURCES.push({kind:"screen",x,y:y+1,bx:ox+12,by:top+2,r:2.4,i:.45,col:[.4,.9,.9]}); return true; }
  if(/Armory/.test(n)&&v<4){ plaque(ox+4,16,"#3a1a14","#6a2a1e"); for(let k=0;k<3;k++){ R(g,ox+6+k*4.5,top+2,3,2,"#c9a24a"); R(g,ox+6+k*4.5,top+4,3,1,"#8a6a2a"); } for(let k=0;k<24;k+=3) R(g,ox+k,fy+fh-5,1.5,2,"#7a1a12"); return true; }
  if(/Cargo|Docking/.test(n)&&v<4){ R(g,ox+5,top-1,14,8,"#2a2618"); R(g,ox+5,top-1,14,.5,"#4a4428"); const dg=(h>>4)%10; for(const [i,b] of [[0,dg],[1,(dg+3)%10]]) for(let j=0;j<5;j++) if(((b+1)*37>>j)&1) R(g,ox+8+i*5,top+j*1.2,3,1,"#d8b030"); for(let k=0;k<24;k++) R(g,ox+k,fy+fh-5,1,3,((k>>1)%2)?"#a8841e":"#0d0b08"); return true; }
  if(/Fuel/.test(n)&&v<4){ g.save(); g.translate(ox+12,top+3); g.rotate(.785); R(g,-3.5,-3.5,7,7,"#0c0b0a"); R(g,-3,-3,6,6,"#b82a1a"); g.restore(); R(g,ox+11,top+1.5,2,3,"#ffd060"); hp(g,ox+12,top+1,"#fff0b0"); return true; }
  if(/Engineering|Workshop|Engine/.test(n)&&v<4){ for(let k=0;k<2;k++){ const cx=ox+7+k*10; disc(g,cx,top+2,3.2,"#0c0b0a"); disc(g,cx,top+2,2.6,"#c8c0a8"); const a=(h>>(k*3))%5*.6-1.2; R(g,cx-.25,top+2-.25,.5,.5,"#111"); g.save(); g.translate(cx,top+2); g.rotate(a); R(g,-.25,-2.2,.5,2.2,"#a32a1d"); g.restore(); }
    R(g,ox,fy+fh-6,24,2,"#3c3329"); R(g,ox,fy+fh-6,24,.5,"#56483a"); R(g,ox+12,top+5,1.5,fh-11,"#3c3329"); return true; }
  if(/Mess|Galley/.test(n)&&v<3){ R(g,ox+4,top-2,16,9,"#141a14"); R(g,ox+4,top-2,16,.5,"#4a4030"); R(g,ox+3.5,top-2.5,17,.5,"#5a4a30"); for(let k=0;k<4;k++){ R(g,ox+6,top+k*1.8,6+((h>>k)%4),.6,"#d8d0b0"); R(g,ox+16,top+k*1.8,2,.6,"#e8b048"); } return true; }
  if(/Crew|Quarters/.test(n)&&v<3){ const c=["#7a3a2a","#2a4a6a","#5a6a3a"][(h>>3)%3]; R(g,ox+6,top-2,9,11,"#0c0b0a"); R(g,ox+6.5,top-1.5,8,10,c); R(g,ox+8,top,5,4,"rgba(255,230,200,.35)"); R(g,ox+7.5,top+5,6,.5,"#d8d0b0"); R(g,ox+7.5,top+6.5,4,.5,"#d8d0b0"); R(g,ox+16,top+1,4,3,"#c8c0a8"); R(g,ox+16.5,top+1.5,3,2,"#5a4a3a"); return true; }
  if(/Captain/.test(n)&&v<3){ R(g,ox+6,top-3,12,12,"#6a4a1a"); R(g,ox+6,top-3,12,.5,"#c9a24a"); R(g,ox+7,top-2,10,10,"#1a1210"); disc(g,ox+12,top+1,2,"#8a6a50"); R(g,ox+9,top+3,6,4,"#2a1a14"); R(g,ox+11,top+3,2,3,"#a32a1d"); return true; }
  if(/Vault/.test(n)){ R(g,ox+2,top-2,20,10,"#2a2418"); for(const [a,b] of [[3,-1],[20,-1],[3,6],[20,6]]) disc(g,ox+a,top+b,1,"#8a7040"); R(g,ox+4,top+2,16,2,"#5a4520"); return true; }
  if(/corridor|hall/i.test(n)&&v<2){ plaque(ox+5,14,"#1a2a28","#3a5a52"); const L=(h>>5)%2; for(let k=0;k<3;k++) R(g,ox+(L?8+k:16-k),top+3-k,1,1+k*2,"#d8d0b0"); R(g,ox+(L?10:8),top+3,6,1,"#d8d0b0"); return true; }
  return false; }
function drawWall(g,x,y){
  const ox=x*TS, oy=y*TS, below=T(x,y+1).t, front=!(below==="wall"||below==="window"), ext=below==="space", h=hh(x,y);
  if(!front){ wallCap(g,x,y,24); const F=FIX.get(x+","+y); if(F&&F.side) drawFixture(g,x,y,F,0); return; }
  wallCap(g,x,y,8); const fy=oy+8, fh=16;
  R(g,ox,fy,24,fh,ext?"#141312":"#2c2b28"); R(g,ox,fy,24,1,ext?"#222120":"#4b4842");
  if(ext){ for(let k=3;k<24;k+=8) R(g,ox+k,fy+1,1,fh-1,"#0b0a0a"); wallDetail(g,x,y,fy,fh,true); return; }
  for(let k=0;k<24;k+=8){ R(g,ox+k,fy+1,1,fh-3,"#191816"); R(g,ox+k+1,fy+1,1,fh-3,"#3b3935"); }
  R(g,ox,fy+8,24,1,"#1f1e1b"); R(g,ox,oy+22,24,2,"#121110");
  const rn=S.mode==="ship"?"":Sim.roomName(x,y+1), F=FIX.get(x+","+y);
  if(F&&!F.side){ drawFixture(g,x,y,F,fy); if(h%3===0) themedDecor(g,x,y,ox,fy+2,fh,rn,h>>2); wallDetail(g,x,y,fy,fh,false); return; }
  if(F) drawFixture(g,x,y,F,fy);
  if(rn&&themedDecor(g,x,y,ox,fy,fh,rn,h)){ wallDetail(g,x,y,fy,fh,false); return; }
  const d=S.mode==="ship"||!S.power?h%15:(h%15===0?4:h%15);
  if(d===0){ R(g,ox+8,fy+2,8,2,"#5a4526"); R(g,ox+9,fy+4,6,1,"#3a2c18"); R(g,ox+10,fy+5,4,3,"#2a2015"); SOURCES.push({kind:"lamp",x,y:y+1,bx:ox+12,by:fy+6,emerg:h%3===0,ph:(h%628)/100,flick:h%4===0,r:7,i:1.45}); }
  else if(d===1||d===2){ if(h%3===0) EMIT.push({type:"steam",x,y:y+1,bx:ox+((h>>4)%18)+1,by:fy+5,rate:.9}); R(g,ox,fy+3,24,3,"#3c3329"); R(g,ox,fy+3,24,1,"#56483a"); R(g,ox+(h>>4)%18,fy+2,3,5,"#1a1611"); if(d===2){ R(g,ox,fy+10,24,2,"#2e2419"); R(g,ox,fy+10,24,1,"#3f3224"); } }
  else if(d===3){ R(g,ox+7,fy+2,10,9,"#2b241b"); R(g,ox+7,fy+2,10,1,"#4a3d2a"); R(g,ox+7,fy+10,10,1,"#120f0b"); skull(g,ox+9+1,fy+4,"#b3a68c","#0b0908"); R(g,ox+9,fy+11,1,3,"#5a1812"); R(g,ox+15,fy+11,1,4,"#5a1812"); }
  else if(d===4){ R(g,ox+5,fy+3,14,9,"#0b0a08"); for(let k=0;k<4;k++) R(g,ox+5,fy+4+k*2,14,1,"#34302a"); }
  else if(d===5){ R(g,ox+3,fy,1,fh-2,"#2b1a12"); R(g,ox+5,fy,1,fh-4,"#3a2a14"); R(g,ox+18,fy+2,1,fh-4,"#14202a"); R(g,ox+19,fy+fh-3,3,1,"#14202a"); }
  else if(d===6){ for(let k=0;k<24;k++) R(g,ox+k,fy+fh-5,1,3,((k>>1)%2)?"#8a6a1e":"#0d0b08"); }
  else if(d===7){ const c=4+(h>>3)%14; R(g,ox+c,fy+2,2,1,"#6a140e"); R(g,ox+c+1,fy+3,1,6,"#5a100a"); R(g,ox+c+3,fy+3,3,1,"#6a140e"); R(g,ox+c+4,fy+4,1,4,"#5a100a"); R(g,ox+c-2,fy+6,1,5,"#4a0c08"); }
  else if(d===8){ R(g,ox+4,fy+2,16,9,"#0a120c"); R(g,ox+4,fy+2,16,1,"#2a3a2c"); for(let k=0;k<3;k++) R(g,ox+6,fy+4+k*2,4+((h>>k)%8),1,"#3f8a52"); SOURCES.push({kind:"screen",x,y:y+1,bx:ox+12,by:fy+6,r:2.6,i:.45,col:[.3,.9,.45]}); }
  else if(d===9){ R(g,ox+6,fy+1,12,13,"#100e0c"); R(g,ox+7,fy+2,10,1,"#2a2620"); R(g,ox+8,fy+1,8,1,"#2a2620"); R(g,ox+9,fy+0,6,1,"#2a2620"); R(g,ox+6,fy+13,12,1,"#3a342a");   // shrine niche + candles
    for(const cx of [9,12,15]){ R(g,ox+cx,fy+9,1.5,4,"#d8cdb4"); R(g,ox+cx,fy+9,.5,4,"#f0e8d4"); hp(g,ox+cx+.5,fy+8,"#ffd060"); hp(g,ox+cx+.5,fy+7.5,"#fff0b0"); }
    R(g,ox+10,fy+3,4,3,"#8a7e66"); hp(g,ox+11,fy+4,"#100e0c"); hp(g,ox+12.5,fy+4,"#100e0c"); SOURCES.push({kind:"fire",x,y:y+1,bx:ox+12,by:fy+8,r:3.2,i:.55,col:[1,.62,.3],ph:h%100}); }
  else if(d===10){ EMIT.push({type:"sparks",x,y:y+1,bx:ox+7+(h%3)*4,by:fy+10,rate:.25}); for(let k=0;k<4;k++){ const cx=ox+5+k*4, L=6+((h>>k)%6); R(g,cx,fy,1.5,L,["#14140f","#2a1410","#14202a","#1a1a14"][k]); R(g,cx,fy,.5,L,"rgba(255,255,255,.1)"); R(g,cx-.5,fy+L,2.5,1,"#3a3a34"); } } // hanging cables
  else if(d===11){ EMIT.push({type:"steam",x,y:y+1,bx:ox+12,by:fy+9,rate:.7,down:1}); disc(g,ox+12,fy+7,6,"#0e0d0c"); disc(g,ox+12,fy+7,5,"#1e1c1a"); for(let a=0;a<6;a++){ const an=a*1.047; R(g,ox+12+Math.cos(an)*2.5-.5,fy+7+Math.sin(an)*2.5-.5,1.5,1,"#3a3832"); } disc(g,ox+12,fy+7,1,"#5a564e"); } // vent fan
  wallDetail(g,x,y,fy,fh,false);
}
function drawWindow(g,x,y,t){
  const ox=x*TS, oy=y*TS, below=T(x,y+1).t, front=!(below==="wall"||below==="window");
  if(front){ wallCap(g,x,y,8); const fy=oy+8; R(g,ox,fy,24,16,"#3b2f1d"); R(g,ox,fy,24,1,"#5a4a2c"); R(g,ox+2,fy+2,20,11,"#05080b");
    for(let k=0;k<4;k++){ const v=hh(x,y,k+3); R(g,ox+3+v%18,fy+3+(v>>>4)%9,1,1,"#8a9eb0"); }
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
      if(t.broken){ R(g,ox+5,oy+13,5,2,"#4a463f"); R(g,ox+13,oy+18,6,2,"#3a3732"); R(g,ox+16,oy+9,3,3,"#2a2825"); } if(S.mode!=="ship") doorPlate(g,x,y,ox,oy); return; }
    wallCap(g,x,y,8); if(S.mode!=="ship") doorPlate(g,x,y,ox,oy);
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
  for(let k=0;k<10;k++){ const v=hh(x,y,k+90); R(g,ox+4+v%16,oy+6+(v>>>5)%14,1+(v>>>9)%3,1,(v>>>3)%3?"#2a2622":"#3a2a1e"); }
  if(kind==="barrel"){ R(g,ox+7,oy+10,10,2,"#3a2412"); R(g,ox+6,oy+15,4,2,"#2a1a0e"); R(g,ox+15,oy+16,3,2,"#2a1a0e"); }
  else { R(g,ox+6,oy+12,9,2,"#2a2017"); R(g,ox+12,oy+9,2,7,"#2a2017"); R(g,ox+14,oy+15,4,1,"#5a2a10"); } }
function makeConduit(){ const c=cvs(96,96), g=c.getContext("2d"); R(g,0,0,96,96,"#0a0a09"); let seed=11; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let i=0;i<16;i++){ let x=Math.floor(rnd()*24)*4, y=Math.floor(rnd()*24)*4, dir=rnd()<.5; const len=6+Math.floor(rnd()*12);
    for(let k=0;k<len;k++){ if(dir){ R(g,x%96,y%96,4,3,"#161513"); R(g,x%96,y%96,4,1,"#211f1c"); x+=4; } else { R(g,x%96,y%96,3,4,"#161513"); R(g,x%96,y%96,1,4,"#211f1c"); y+=4; } if(rnd()<.18) dir=!dir; }
    R(g,x%96,y%96,5,5,"#1b1916"); R(g,x%96,y%96,5,1,"#2a2723"); }
  for(let i=0;i<7;i++){ const x=Math.floor(rnd()*88), y=Math.floor(rnd()*88); R(g,x,y,8,6,"#121110"); R(g,x,y,8,1,"#24221f"); }
  return c; }

function buildStatic(){
  staticLayer.width=S.W*TS*Q; staticLayer.height=S.H*TS*Q; staticLayer._q=1; staticLayer.lw=S.W*TS; staticLayer.lh=S.H*TS; const g=staticLayer.getContext("2d"); g.setTransform(Q,0,0,Q,0,0); SOURCES=[]; EMIT=[]; FIX=planFixtures();
  AMB=new Float32Array(S.W*S.H*3);
  for(let y=0;y<S.H;y++)for(let x=0;x<S.W;x++){
    const t=S.tiles[Sim.idx(S,x,y)];
    switch(t.t){
      case "space": if(S.mode!=="ship") drawSpace(g,x,y); break;
      case "wall": drawWall(g,x,y); break;
      case "window": drawWindow(g,x,y,t); break;
      case "breach": drawBreach(g,x,y); break;
      case "door": drawDoor(g,x,y,t); if(t.broken) EMIT.push({type:"sparks",x,y,bx:x*TS+(doorVert(x,y)?12:3),by:y*TS+(doorVert(x,y)?3:8),rate:.4}); break;
      case "console": drawConsole(g,x,y); EMIT.push({type:"sparks",x,y,bx:x*TS+12,by:y*TS+10,rate:.35,dead:1}); break;
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
      if(t.kind==="pipes") EMIT.push({type:"steam",x,y,bx:x*TS+6+(hh(x,y)%10),by:y*TS-4,rate:1.2});
      if(t.kind==="pump") EMIT.push({type:"steam",x,y,bx:x*TS+16,by:y*TS-2,rate:.8});
      if(t.kind==="drive") EMIT.push({type:"steam",x,y,bx:x*TS+12,by:y*TS-14,rate:.6,cold:1});
      if(t.kind==="reactor") EMIT.push({type:"motes",x,y,bx:x*TS+12,by:y*TS-4,rate:4});
      if(t.kind==="cogitator") EMIT.push({type:"sparks",x,y,bx:x*TS+12,by:y*TS-4,rate:.05,dead:1});
      if(t.kind==="cogitator") SOURCES.push({kind:"screen",x,y,bx:x*TS+12,by:y*TS-2,r:2.6,i:.5,col:[.3,.9,.45]});
      if(t.kind==="reactor") SOURCES.push({kind:"tank",x,y,bx:x*TS+12,by:y*TS-4,r:6,i:1.1,col:[.2,.9,1],ph:hh(x,y)%100});
      if(t.kind==="drive") SOURCES.push({kind:"tank",x,y,bx:x*TS+12,by:y*TS-2,r:3.6,i:.7,col:[.25,.55,1],ph:hh(x,y)%100});
      if(t.kind==="stasis") SOURCES.push({kind:"tank",x,y,bx:x*TS+12,by:y*TS-2,r:3,i:.6,col:[.3,1,1],ph:hh(x,y)%100});
      if(t.kind==="altar") SOURCES.push({kind:"fire",x,y,bx:x*TS+12,by:y*TS+2,r:3.6,i:.7,col:[1,.6,.28],ph:hh(x,y)%100});
    }
  }
  for(const d of S.decals||[]){ if(d.type==="ritual") drawRitual(g,d.x,d.y); else drawKindDecal(g,d); }
  // a colour grade that says whose station this is
  { const K={hospital:"rgba(150,190,200,.07)",mining:"rgba(200,140,60,.08)",fortress:"rgba(160,40,20,.09)",hive:"rgba(60,200,90,.07)",outpost:"rgba(70,110,200,.07)",research:"rgba(90,200,220,.06)",freighter:"rgba(190,160,90,.06)",colony:"rgba(210,170,120,.06)"}[S.kind]; if(K){ g.fillStyle=K; g.fillRect(0,0,S.W*TS,S.H*TS); } }
  if(S.mode==="ship") for(let y=0;y<S.H;y++)for(let x=0;x<S.W;x++){ const t=S.tiles[Sim.idx(S,x,y)]; if(!(t.t==="prop"&&t.kind==="drive")) continue;
    let wx=x-1; while(wx>0&&T(wx,y).t!=="wall") wx--; const nx=wx-1; if(T(nx,y).t!=="space") continue; const ox=nx*TS, oy=y*TS;
    R(g,ox+10,oy+4,14,16,"#2a2e32"); R(g,ox+10,oy+4,14,1.5,"#5a6268"); R(g,ox+4,oy+2,8,20,"#3a3e42"); R(g,ox+4,oy+2,8,1,"#6a7278"); R(g,ox+2,oy+1,3,22,"#22262a"); R(g,ox+2,oy+1,1,22,"#4a5056");
    for(let k=0;k<4;k++) R(g,ox+12+k*3,oy+4.5,.5,15,"#1a1d20"); R(g,ox+1,oy+5,1.5,14,"#0a1a2a"); EMIT.push({type:"exhaust",x,y,bx:ox+1,by:oy+12}); }
  for(let y=0;y<S.H;y++)for(let x=0;x<S.W;x++){ const t=S.tiles[Sim.idx(S,x,y)]; if(t.t!=="terminal") continue;
    const L={comms:[.35,.9,1,3],navtable:[.3,.85,1,3.8],helm:[.3,.9,.9,3.2],board:[1,.7,.35,2.6],records:[1,.7,.3,2.2],airlock:[1,.2,.1,2.4],stash:[.3,1,.4,1.8],rack:[1,.75,.4,2],workbench:[1,.55,.2,3],wardrobe:[.9,.75,.5,1.6],bar:[1,.7,.4,3]}[t.kind];
    if(L) SOURCES.push({kind:"term",x,y,bx:x*TS+12,by:y*TS+4,r:L[3],i:.7,col:[L[0],L[1],L[2]],tk:t.kind}); }
  for(let y=0;y<S.H;y++)for(let x=0;x<S.W;x++){ const i=Sim.idx(S,x,y), t=S.tiles[i]; let c=null;
    if(t.t!=="wall"&&t.t!=="window"&&t.t!=="space") c=AMBC[Sim.roomName(x,y)]||AMBC._;
    else { let n=0,a=[0,0,0]; for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){ const tt=T(x+dx,y+dy).t; if(tt!=="wall"&&tt!=="window"&&tt!=="space"){ const cc=AMBC[Sim.roomName(x+dx,y+dy)]||AMBC._; a[0]+=cc[0];a[1]+=cc[1];a[2]+=cc[2];n++; } } c=n?a.map(v=>v/n):[.2,.21,.22]; }
    const dk=S.mode==="ship"?1.05:.5; AMB[i*3]=c[0]*dk; AMB[i*3+1]=c[1]*dk; AMB[i*3+2]=c[2]*dk*1.06; }
  bakeShading(g);
}
const tileKey=()=>S.tiles.map(t=>t.t[0]+(t.open?1:0)+(t.hp??"")+(t.broken?"b":"")+(t.searched?"s":"")).join("");

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
  FLASH=new Float32Array(N); const [fx,fy]=p.face||[1,0], LS=p.light&&!p.lightOff?Items.stats(p.light):null, rng=LS?LS.range:0, cone=LS?LS.cone:1;
  for(let i=0;i<N;i++){ if(!VIS[i]) continue; const x=i%W,y=(i/W)|0, dx=x-p.x, dy=y-p.y, d=Math.hypot(dx,dy);
    let v=0; if(d<3.2) v+=(1-d/3.2)*(LS?.7:.3);
    if(LS&&d>0&&d<rng){ const cos=(dx*fx+dy*fy)/d, e0=cone-.1; if(cos>e0){ const edge=Math.min(1,(cos-e0)/.22); v+=Math.pow(1-d/rng,.55)*2.15*edge*edge*(3-2*edge); } }
    if(LS&&d<rng*.55) v+=.16*(1-d/(rng*.55));   // light bouncing off the walls around you
    FLASH[i]=v; }
}
const imgCache={};
function buildLightmap(cx,cy,now){
  const ox=Math.floor(cx/TS)-1, oy=Math.floor(cy/TS)-1, lw=Math.ceil(view.fw/TS)+3, lh=Math.ceil(view.fh/TS)+3, W=S.W, N=W*S.H;
  if(lm.width!==lw||lm.height!==lh||!imgCache.d){ lm.width=lw; lm.height=lh; imgCache.d=lctx.createImageData(lw,lh); }
  const Lr=new Float32Array(N), Lg=new Float32Array(N), Lb=new Float32Array(N), p=viewEnt(), pw=S.power;
  SOURCES.forEach((L,k)=>{
    let f=1, c=L.col||[1,.7,.4];
    if(L.kind==="lamp"){ if(pw&&L.dead) f=0; else if(pw){ if(L.flick){ const n=Math.sin(now*.013+L.ph*7)+Math.sin(now*.031+L.ph); if(n>1.55) f=.25; } if(powerFlicker>0) f*=Math.random()<.5?.15:1; c=L.col||[1,.72,.42]; }
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
  const d=imgCache.d.data, am=pw?(S.mode==="ship"?1:1.3):.33; if(!LUMV||LUMV.length!==N) LUMV=new Float32Array(N);
  for(let k=0;k<N;k++) LUMV[k]=VIS[k]?(AMB[k*3]*am+Lr[k]+AMB[k*3+1]*am+Lg[k]+AMB[k*3+2]*am+Lb[k])/3+(FLASH[k]||0)*.3:0;
  for(let j=0;j<lh;j++)for(let i=0;i<lw;i++){
    const x=ox+i, y=oy+j, o=(j*lw+i)*4; let r=0,g=0,b=0;
    if(x>=0&&y>=0&&x<W&&y<S.H){ const k=y*W+x, t=S.tiles[k];
      if(p.seen[k]){
        if(VIS[k]){ const fl=FLASH[k]||0; r=AMB[k*3]*am+Lr[k]+fl*1.05; g=AMB[k*3+1]*am+Lg[k]+fl*1.0; b=AMB[k*3+2]*am+Lb[k]+fl*.9;
          if(t.t==="space"||t.t==="window"||t.t==="breach"){ r+=.35; g+=.38; b+=.45; }
          if(t.t==="console"){ r+=pw?.12:.3; g+=pw?.35:.05; b+=pw?.15:.03; }
          if(t.t==="extract"){ const bl=(Math.sin(now*.004)+1)/2; r+=.22*bl; g+=.13*bl; b+=.03*bl; } }
        else { r=AMB[k*3]*.3; g=AMB[k*3+1]*.32; b=AMB[k*3+2]*.4; if(t.t==="space"){ r=.12; g=.13; b=.18; } }
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
// what each simulated event sounds like, placed in the world
function soundFx(f){ if(typeof Snd==="undefined") return; const at=(x,y,r,v)=>({x,y,r,v});
  switch(f.type){
    case "shot": { const e=S.ents.find(q=>q.alive&&q.x===f.x0&&q.y===f.y0), g=e&&e.kind!=="bot"&&Sim.gun(e), c=e&&e.kind==="bot"?"turret":g?Items.stats(g).cls:"pistol";
      Snd.play({smg:"smg",rifle:"rifle",shotgun:"shotgun",sniper:"sniper",launcher:"launcher",turret:"turret"}[c]||"pistol",at(f.x0,f.y0,28)); break; }
    case "explode": Snd.play("explode",at(f.x,f.y,34)); break;
    case "hurt": Snd.play(f.syn?"spark":"hurt",at(f.x,f.y,12,f.id===PID?1:.55)); break;
    case "die": Snd.play("die",at(f.x,f.y,14)); break;
    case "claw": Snd.play("claw",at(f.x,f.y)); break;
    case "melee": Snd.play("melee",at(f.x,f.y)); break;
    case "shriek": Snd.play("shriek",at(f.x,f.y,26)); break;
    case "door": Snd.play("door",at(f.x,f.y,12)); break;
    case "bash": Snd.play("bash",at(f.x,f.y,22)); break;
    case "glass": Snd.play("glass",at(f.x,f.y)); break;
    case "breach": Snd.play("glass",at(f.x,f.y)); Snd.play("breach",at(f.x,f.y,30)); break;
    case "search": Snd.play("search",at(f.x,f.y,10)); break;
    case "power": Snd.play(S.power?"powerup":"powerdown"); break;
    case "cookoff": Snd.play("pistol",at(f.x,f.y,20,.6)); break;
    case "legend": Snd.play("legend"); break;
    case "flare": Snd.play("explode",at(f.x,f.y,20,.45)); break;
    case "speech": { const e=S.ents.find(q=>q.id===f.id); if(e&&e.kind==="raider") Snd.play(e.syn?"synth":"radio",at(f.x,f.y,14)); break; }
    case "revive": Snd.play("heal",at(f.x,f.y)); break;
    case "spit": Snd.play("spit",at(f.x,f.y,18)); break;
    case "stomp": Snd.play("stomp",at(f.x,f.y,20)); break;
    case "roar": Snd.play("roar",at(f.x,f.y,40)); break;
    case "chitter": Snd.play("chitter",at(f.x,f.y,16)); break;
    case "robot": Snd.play("robot",at(f.x,f.y,14)); break;
    case "levelup": Snd.play("levelup"); break;
  } }
function processFx(){
  const p=me(), now=performance.now();
  for(const f of S.fx||[]) soundFx(f);
  for(const f of S.fx||[]){
    const vis=()=>VIS&&VIS[Sim.idx(S,f.x,f.y)];
    switch(f.type){
      case "shot": { const x0=cpx(f.x0),y0=cpx(f.y0)-6; let x1=cpx(f.x1),y1=cpx(f.y1)-6; const a=Math.atan2(y1-y0,x1-x0);
        if(f.what==="wall"){ x1-=Math.cos(a)*12; y1-=Math.sin(a)*12; }
        const mx=x0+Math.cos(a)*12, my=y0+Math.sin(a)*12;
        tracers.push({x0:mx,y0:my,x1,y1,t:0,dur:.09});
        spawn(8,mx,my,{col:["#fff2b0","#ffc050","#ffffff"],speed:110,life:.12,dir:a,spread:.9,emit:true});
        spawn(3,mx,my,{col:["rgba(120,110,100,.25)"],speed:12,life:.9,dir:a,spread:1.2,size:2});
        bursts.push({x:mx,y:my,a,t:0,dur:.075,big:f.what==="rocket"});
        lightsT.push({x:f.x0,y:f.y0,r:8,i:2.3,c:[1,.8,.45],t:0,dur:.11});
        { const sh=S.ents.find(q=>q.alive&&q.x===f.x0&&q.y===f.y0); if(sh){ recoilT[sh.id]=now; recoilA[sh.id]=a; } }
        if(f.what==="flesh") splat(x1+Math.cos(a)*6,y1+12+Math.sin(a)*4,7,a,.7);
        if(f.what==="wall") spawn(10,x1,y1,{col:["#ffd070","#ff9a30","#fff"],speed:80,life:.25,dir:a+Math.PI,spread:2.2,emit:true});
        if(f.what==="flesh") spawn(16,x1,y1,{col:["#5a0e0a","#8a1a12","#3a0806"],speed:60,life:.55,dir:a,spread:1.6,size:2});
        if(f.what==="glass") spawn(14,x1,y1,{col:["#cfe8ee","#7ab0bc","#ffffff"],speed:70,life:.5});
        if(f.x0===p.x&&f.y0===p.y) shake=Math.max(shake,1.5); break; }
      case "hurt": if(f.syn){ flashT[f.id]=now; if(vis()){ spawn(14,cpx(f.x),cpx(f.y)-4,{col:["#fff2b0","#7ad0ff","#ffffff","#3a3e42"],speed:90,life:.35,emit:true}); spawn(4,cpx(f.x),cpx(f.y),{col:["rgba(30,34,40,.6)"],speed:14,life:1,size:2}); } break; }
      { flashT[f.id]=now; if(f.id===PID){ hurtFlash=1; shake=Math.max(shake,5); } if(vis()){ const n=Math.min(10,2+((f.dmg|0)>>2)); splat(cpx(f.x)+(Math.random()-.5)*6,cpx(f.y)+8,n);
          spawn(4+n,cpx(f.x),cpx(f.y)-6,{col:["#7a1410","#a01e14","#3e0806"],speed:55,life:.4,size:1,dir:-Math.PI/2,spread:2.6}); } break; }
      case "sever": { const e=S.ents.find(q=>q.id===f.id); if(!e) break; const spr=limbSprite(e,f.limb), a=Math.random()*6.283, d=10+Math.random()*12, px=cpx(f.x), py=cpx(f.y)+6;
          addGore({type:"limb",spr,x:px,y:py,tx:px+Math.cos(a)*d,ty:py+Math.sin(a)*d*.6,rot:Math.random()*6.283,t0:now});
          setTimeout(()=>{ const o=GORE[GORE.length-1]; },0); splat(px,py,14); splat(px+Math.cos(a)*d*.6,py+Math.sin(a)*d*.4,8,a,.8);
          spawn(26,px,py-8,{col:["#7a1410","#a01e14","#3e0806","#e8dcc0"],speed:85,life:.6,size:1.5,dir:-Math.PI/2,spread:3}); shake=Math.max(shake,3); break; }
      case "shriek": if(vis()){ rings.push({x:cpx(f.x),y:cpx(f.y)-6,t:0,dur:.5,col:"255,60,40"}); atkT[f.id]=now; } break;
      case "die": spawn(26,cpx(f.x),cpx(f.y),{col:["#5a0e0a","#7a140e","#2a0504"],speed:45,life:.7,size:2}); splat(cpx(f.x),cpx(f.y)+8,12); break;
      case "breach": spawn(34,cpx(f.x),cpx(f.y),{col:["#cfe8ee","#7ab0bc","#4a3a24","#fff"],speed:120,life:.8}); lightsT.push({x:f.x,y:f.y,r:5,i:1.2,c:[.8,.9,1],t:0,dur:.25}); shake=Math.max(shake,9); break;
      case "glass": spawn(10,cpx(f.x),cpx(f.y),{col:["#cfe8ee","#7ab0bc"],speed:50,life:.4}); break;
      case "bash": if(vis()){ spawn(8,cpx(f.x),cpx(f.y),{col:["#6a5f50","#3a332a"],speed:35,life:.5}); shake=Math.max(shake,1.2); } break;
      case "spit": { const x0=cpx(f.x),y0=cpx(f.y)-8,x1=cpx(f.x1),y1=cpx(f.y1)-6; for(let k=0;k<10;k++){ const t=k/9; parts.push({x:x0+(x1-x0)*t,y:y0+(y1-y0)*t-Math.sin(t*Math.PI)*10,vx:0,vy:3,life:.25+t*.2,max:.45,col:k%2?"#9ae83a":"#4a8a1a",size:2,emit:true,drag:2}); } spawn(10,x1,y1,{col:["#9ae83a","#4a8a1a","#d8ff90"],speed:40,life:.5}); break; }
      case "claw": slashes.push({x:f.x,y:f.y,t:0,dur:.28}); atkT[f.id]=now; break;
      case "melee": spawn(7,cpx(f.x),cpx(f.y)-6,{col:["#5a0e0a","#8a1a12"],speed:40,life:.35,size:2}); shake=Math.max(shake,1.5); break;
      case "spaced": spawn(18,cpx(f.x),cpx(f.y),{col:["#5a0e0a","#a39379"],speed:90,life:.6,size:2}); break;
      case "power": powerFlicker=.7; break;
      case "throw": arcs.push({x0:cpx(f.x0),y0:cpx(f.y0)-8,x1:cpx(f.x1),y1:cpx(f.y1),t:0,dur:.35,d:f.d}); break;
      case "decoy": spawn(14,cpx(f.x),cpx(f.y),{col:["#e8b048","#ffffff"],speed:40,life:.6,emit:true}); rings.push({x:cpx(f.x),y:cpx(f.y),t:0,dur:.6}); break;
      case "legend": { const c=Items.RAR[f.r].col; spawn(30,cpx(f.x),cpx(f.y)-6,{col:[c,"#ffffff",c],speed:70,life:.9,emit:true}); lightsT.push({x:f.x,y:f.y,r:4,i:1.4,c:[1,.85,.5],t:0,dur:.6}); shake=Math.max(shake,2); break; }
      case "flavor": if(f.pid===PID&&typeof onFlavor==="function") setTimeout(()=>onFlavor(f.kind,f.x,f.y),0); flavorFx(f.kind,f.x,f.y,true); break;
      case "sit": if(f.pid===PID&&typeof onSit==="function") setTimeout(()=>onSit(f.kind),0); break;
      case "lootbody": if(f.pid===PID&&typeof openPanel==="function") setTimeout(()=>openPanel("body",f.id),0); break;
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
  for(const q of parts){ if(q.g) q.vy+=q.g*dt; q.x+=q.vx*dt; q.y+=q.vy*dt; const k=Math.exp(-q.drag*dt); q.vx*=k; q.vy*=k; q.life-=dt; if(q.grow) q.size=Math.min(q.grow,q.size+dt*3); }
  parts=parts.filter(q=>q.life>0); if(parts.length>700) parts.splice(0,parts.length-700);
  for(const a of [tracers,slashes,lightsT,rings,arcs,bursts]) for(const q of a) q.t+=dt;
  bursts=bursts.filter(q=>q.t<q.dur); rings=rings.filter(q=>q.t<q.dur); arcs=arcs.filter(q=>q.t<q.dur); tracers=tracers.filter(q=>q.t<q.dur); slashes=slashes.filter(q=>q.t<q.dur); lightsT=lightsT.filter(q=>q.t<q.dur);
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
  if(!LOWFX||((now/16)|0)%2) runEmitters(dt);
  for(const e of S.ents){ if(!e.alive||!e.bleed||!Object.keys(e.bleed).length||!VIS[Sim.idx(S,e.x,e.y)]) continue; const r=rp[e.id]; if(!r) continue;
    if(Math.random()<dt*5) parts.push({x:r.x+10+Math.random()*4,y:r.y+8+Math.random()*8,vx:(Math.random()-.5)*6,vy:10,life:.5,max:.5,col:"#8a1a12",size:.5,emit:false,drag:0,g:60});
    if(Math.random()<dt*1.5) splat(r.x+12,r.y+21,1); }
}

function runEmitters(dt){
  for(const E of EMIT){ if(!VIS[Sim.idx(S,E.x,E.y)]) continue;
    if(E.type==="steam"){ if(E.cold&&!S.power&&S.mode!=="ship") continue; if(Math.random()<dt*E.rate*6) parts.push({x:E.bx+(Math.random()-.5)*3,y:E.by,vx:(Math.random()-.5)*6,vy:E.down?6+Math.random()*4:-8-Math.random()*8,life:1.8,max:1.8,col:E.cold?"rgba(150,190,230,.16)":"rgba(200,200,190,.16)",size:1,grow:4,emit:false,drag:.6}); }
    else if(E.type==="motes"){ if(Math.random()<dt*E.rate) parts.push({x:E.bx+(Math.random()-.5)*8,y:E.by+Math.random()*16,vx:(Math.random()-.5)*4,vy:-6-Math.random()*6,life:1.4,max:1.4,col:"#8affff",size:.5,emit:true,drag:.3}); }
    else if(E.type==="sparks"){ if(E.dead&&S.power) continue; if(Math.random()<dt*E.rate){ const n=5+(Math.random()*8|0);
        for(let k=0;k<n;k++){ const a=-Math.PI/2+(Math.random()-.5)*2.6, sp=30+Math.random()*60; parts.push({x:E.bx,y:E.by,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.35+Math.random()*.4,max:.7,col:Math.random()<.5?"#fff4c0":"#ffb040",size:.5,emit:true,drag:1.2,g:180}); }
        lightsT.push({x:E.bx/TS-.5,y:E.by/TS-.5,r:2.2,i:.8,c:[1,.8,.45],t:0,dur:.12}); } } }
}
// light shafts: lamp cones with dust, beams through open doors and windows
function drawShafts(g,cx,cy,now){
  const beam=(x0,y0,dx,dy,len,w0,w1,col,a)=>{ const px=-dy, py=dx, gr=g.createLinearGradient(x0,y0,x0+dx*len,y0+dy*len); gr.addColorStop(0,col+a+")"); gr.addColorStop(1,col+"0)"); g.fillStyle=gr;
    g.beginPath(); g.moveTo(x0+px*w0,y0+py*w0); g.lineTo(x0-px*w0,y0-py*w0); g.lineTo(x0+dx*len-px*w1,y0+dy*len-py*w1); g.lineTo(x0+dx*len+px*w1,y0+dy*len+py*w1); g.fill(); };
  for(const L of SOURCES){ if(L.kind!=="lamp"||!L.lit) continue; if(!VIS[Sim.idx(S,L.x,L.y)]) continue; const bx=L.bx-cx, by=L.by-cy+2, warm=S.power;
    beam(bx,by,0,1,34,2.5,15,warm?"rgba(255,190,110,":"rgba(255,50,30,",(.12*L.lit).toFixed(3));
    for(let k=0;k<6;k++){ const ph=(now/2600+k*.37+(L.ph||0))%1, mx=bx+Math.sin(now/1300+k*2.1)*(3+ph*9), my=by+4+ph*28; g.fillStyle=`rgba(255,220,170,${(.5*(1-ph)*L.lit).toFixed(3)})`; g.fillRect(mx,my,.5,.5); } }
  if(!LUMV) return;
  for(let y=0;y<S.H;y++)for(let x=0;x<S.W;x++){ const i=Sim.idx(S,x,y); if(!VIS[i]) continue; const t=S.tiles[i];
    if(t.t==="door"&&t.open){ const v=doorVert(x,y), A=v?[x-1,y]:[x,y-1], B=v?[x+1,y]:[x,y+1]; const la=LUMV[Sim.idx(S,A[0],A[1])]||0, lb=LUMV[Sim.idx(S,B[0],B[1])]||0, diff=la-lb;
      if(Math.abs(diff)>.22){ const dir=diff>0?1:-1, dx=v?dir:0, dy=v?0:dir; beam(x*TS-cx+12-dx*10,y*TS-cy+12-dy*10,dx,dy,58,9,20,"rgba(255,210,150,",Math.min(.16,Math.abs(diff)*.22).toFixed(3)); } }
    if(t.t==="window"&&S.mode!=="ship"){ for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){ const a=T(x-dx,y-dy).t, b=T(x+dx,y+dy).t; if(a==="space"&&(b==="floor"||b==="prop")){ beam(x*TS-cx+12-dx*8,y*TS-cy+12-dy*8,dx,dy,44,7,16,"rgba(120,160,230,",".08"); break; } } } }
}
// ---------- dynamic drawing ----------
function drawBlood(g,x,y,n,ox,oy){ for(let k=0;k<n;k++){ const v=hh(x,y,k+300), r=2+(v>>>7)%3+(n>3?1:0), cx=ox+5+v%14, cy=oy+5+(v>>>5)%14;
  disc(g,cx,cy,r,"#4a0a07"); disc(g,cx-1,cy-1,Math.max(1,r-2),"#6a140e"); R(g,cx-r+1,cy-1,1,1,"#8e2216"); } }
// soft contact shadow + a long shadow thrown away from the strongest light on this tile
const SHADOW_BLOB=(()=>{ const c=cvs(18,8), g=c.getContext("2d"), gr=g.createRadialGradient(9,4,0,9,4,9); gr.addColorStop(0,"rgba(0,0,0,.72)"); gr.addColorStop(.6,"rgba(0,0,0,.4)"); gr.addColorStop(1,"rgba(0,0,0,0)"); g.save(); g.scale(1,.45); g.fillStyle=gr; g.fillRect(0,0,18,18); g.restore(); return c; })();
const BLACKS=new WeakMap();
function lightFor(e){ let best=null, bv=0; const vw=viewEnt();
  for(const L of SOURCES){ if(!L.lit) continue; const dx=e.x-L.x, dy=e.y-L.y, d=Math.hypot(dx,dy); if(d>L.r||d<.3) continue; const v=(1-d/L.r)*L.i*L.lit; if(v>bv){ bv=v; best={x:L.bx/TS-.5,y:L.by/TS,v}; } }
  if(vw&&e!==vw&&FLASH&&(FLASH[Sim.idx(S,e.x,e.y)]||0)>bv) best={x:vw.x,y:vw.y,v:FLASH[Sim.idx(S,e.x,e.y)]};
  return best; }
function castShadow(g,e,spr,x,y,left){ if(S.mode==="ship") return; const L=lightFor(e); if(!L||L.v<.12) return;
  let dx=e.x+.0-L.x, dy=e.y+.0-L.y; const d=Math.hypot(dx,dy)||1; dx/=d; dy/=d; const k=.35+Math.min(.55,d*.12);
  let b=BLACKS.get(spr); if(!b){ b=blackOf(spr); BLACKS.set(spr,b); }
  g.save(); g.globalAlpha=Math.min(.55,.2+L.v*.4); g.translate(x+12,y+22); g.transform(left?-1:1,0,-dx*k*(left?-1:1),-dy*k,0,0); g.drawImage(b,-12,-30); g.restore(); }
// husk variants: the same body, tinted and scaled, with their own features drawn on top
const HV={stalker:{sc:.86,tint:"rgba(70,10,24,.42)"},brute:{sc:1.32,tint:"rgba(80,78,64,.38)"},spitter:{sc:1,tint:"rgba(40,90,20,.36)"},matriarch:{sc:1.8,tint:"rgba(50,6,30,.5)"}};
const TINTED=new Map();
function tinted(spr,type){ const V=HV[type]; if(!V) return spr; let m=TINTED.get(spr); if(!m){ m={}; TINTED.set(spr,m); } if(m[type]) return m[type];
  const c=cvsRaw(spr.width,spr.height), g=c.getContext("2d"); g.drawImage(spr,0,0,c.width,c.height); g.globalCompositeOperation="source-atop"; g.fillStyle=V.tint; g.fillRect(0,0,c.width,c.height); c._q=spr._q; c.lw=spr.lw; c.lh=spr.lh; return m[type]=c; }
function huskExtras(g,e,view,now){ const t=e.type, f=view==="f", sd=view==="s";
  if(t==="stalker"){ for(let k=0;k<4;k++) R(g,(sd?-4:-3)+k*2,-22+k*1.2-(k%2),1,3,"#c8b8a0"); }
  else if(t==="brute"){ R(g,-9,-20,6,3,"#9a9280"); R(g,3,-20,6,3,"#9a9280"); R(g,-9,-20,6,.6,"#c8c0aa"); R(g,3,-20,6,.6,"#c8c0aa"); R(g,-5,-13,10,4,"#7a7262"); for(let k=0;k<3;k++) R(g,-4+k*3.5,-12,.6,2,"#3a3428"); }
  else if(t==="spitter"){ const a=.55+.3*Math.sin(now/180); g.fillStyle=`rgba(140,230,60,${a})`; g.beginPath(); g.ellipse(sd?2:0,-15,sd?3:4,3,0,0,6.283); g.fill(); g.fillStyle="rgba(200,255,120,.7)"; g.fillRect(sd?2:-1,-16,1,1); if(f){ g.fillStyle="rgba(140,230,60,.8)"; g.fillRect(-.5,-12,1,2+((now/300)|0)%2); } }
  else if(t==="matriarch"){ for(let k=-3;k<=3;k++){ const h=4+(3-Math.abs(k))*1.6; g.fillStyle="#d8c8b0"; g.beginPath(); g.moveTo(k*2-1,-27); g.lineTo(k*2+1,-27); g.lineTo(k*2+(k*.3),-27-h); g.fill(); }
    if(view!=="b"){ for(const [ex,ey] of (f?[[-3,-22],[3,-22],[-1.5,-24],[1.5,-24]]:[[3,-22],[1.5,-24]])) { g.fillStyle="#ff3a20"; g.fillRect(ex,ey,1.2,1); } } } }
// station security: a tripod turret and a hovering drone
function drawBot(g,e,x,y,now){ const off=!S.power, fc=e.face||[0,1], a=Math.atan2(fc[1],fc[0]), led=off?"#3a3a34":(Sim.botHostile(S,e,me())?"#ff3a20":"#5ad06a"), hit=flashT[e.id]&&now-flashT[e.id]<110;
  g.drawImage(SHADOW_BLOB,x+3,y+18);
  if(e.type==="turret"){ const cx=x+12, cy=y+14; R(g,cx-7,cy+6,14,3,"#22262a"); for(const dx of [-6,0,6]){ g.strokeStyle="#3a4046"; g.lineWidth=1.4; g.beginPath(); g.moveTo(cx,cy+2); g.lineTo(cx+dx,cy+8); g.stroke(); }
    disc(g,cx,cy,5,hit?"#ffffff":"#4a5258"); disc(g,cx,cy,4,hit?"#ffffff":"#2e3438"); g.save(); g.translate(cx,cy); g.rotate(a); R(g,0,-1.5,10,3,"#1a1e22"); R(g,0,-1.5,10,1,"#5a6268"); R(g,9,-1,2,2,"#0a0a0a"); g.restore();
    disc(g,cx,cy-1,1.4,led); if(!off&&((now/500)|0)%2) disc(g,cx,cy-1,.7,"#fff"); }
  else { const by=y+8+(off?8:Math.sin(now/260+e.x)*1.5), cx=x+12; if(!off){ g.fillStyle="rgba(140,200,255,.18)"; g.beginPath(); g.ellipse(cx,by+1,10,2,0,0,6.283); g.fill(); }
    disc(g,cx,by,5.5,hit?"#ffffff":"#3a4248"); disc(g,cx,by,4.4,hit?"#ffffff":"#22282c"); R(g,cx-9,by-1,4,2,"#2a3034"); R(g,cx+5,by-1,4,2,"#2a3034");
    if(!off){ const r=((now/40)|0)%2; R(g,cx-10,by-2,6,.6,r?"rgba(200,220,240,.6)":"rgba(200,220,240,.2)"); R(g,cx+4,by-2,6,.6,r?"rgba(200,220,240,.2)":"rgba(200,220,240,.6)"); }
    disc(g,cx+Math.cos(a)*2,by+Math.sin(a)*1.5,1.5,led); } }
function drawKindDecal(g,d){ const ox=d.x*TS, oy=d.y*TS, h=hh(d.x,d.y,555);
  switch(d.type){
    case "bloodtrail": for(let k=0;k<5;k++){ const y=oy+4+k*3+(h>>k)%3; g.fillStyle=`rgba(${70+k*6},8,6,${.55-k*.06})`; g.fillRect(ox+(k*4)%10,y,14+((h>>(k+2))%8),1.6); } disc(g,ox+18,oy+16,2.5,"rgba(60,6,4,.7)"); break;
    case "ore": for(let k=0;k<7;k++){ const v=hh(d.x,d.y,k+600), x=ox+3+v%17, y=oy+6+(v>>>5)%14; disc(g,x,y,1.2+(v>>>9)%2,"#4a4440"); hp(g,x-.4,y-.4,"#6a625a"); if(v%3===0) hp(g,x+.4,y,"#e8b048"); } break;
    case "graffiti": { const c="rgba(200,30,20,.55)"; g.fillStyle=c; for(const [x,y,w,hh2] of [[6,6,2,10],[16,6,2,10],[6,6,12,2],[9,16,2,4],[13,16,2,4]]) g.fillRect(ox+x,oy+y,w,hh2); for(let k=0;k<6;k++) hp(g,ox+4+((h>>k)%16),oy+20+((h>>(k+3))%3),c); break; }
    case "spikes": for(let k=0;k<4;k++){ const x=ox+4+k*4+((h>>k)%2); g.fillStyle="#5a564e"; g.beginPath(); g.moveTo(x,oy+20); g.lineTo(x+3,oy+20); g.lineTo(x+1.5+((h>>(k+4))%3-1),oy+9+((h>>(k+6))%4)); g.fill(); hp(g,x+1,oy+18,"#8a2a1a"); } R(g,ox+3,oy+19,18,2,"#3a3630"); break;
    case "cables": { g.strokeStyle="rgba(20,40,24,.95)"; g.lineWidth=2; g.beginPath(); g.moveTo(ox,oy+6+h%10); g.bezierCurveTo(ox+8,oy+20,ox+16,oy+2,ox+24,oy+8+(h>>4)%10); g.stroke(); g.strokeStyle="rgba(124,255,122,.55)"; g.lineWidth=.6; g.stroke(); disc(g,ox+12,oy+12,2,"#1a2a1c"); disc(g,ox+12,oy+12,1,"#7cff7a");
      SOURCES.push({kind:"tank",x:d.x,y:d.y,bx:ox+12,by:oy+12,r:2.4,i:.35,col:[.35,1,.45],ph:h%100}); break; }
    case "tape": { g.save(); g.translate(ox+12,oy+12); g.rotate(((h%5)-2)*.3); for(let k=-12;k<12;k+=3) g.fillStyle=(k/3|0)%2?"#e8c020":"#141210", g.fillRect(k,-1,3,2); g.restore(); R(g,ox+4,oy+17,3,4,"#e8c020"); R(g,ox+4,oy+17,3,1,"#141210"); hp(g,ox+15,oy+18,"#c9a24a"); hp(g,ox+17,oy+19,"#c9a24a"); break; }
  } }
function drawCorpse(g,e,x,y,now,downed){
  if(e.kind==="bot"){ R(g,x+5,y+16,14,4,"#1a1e22"); R(g,x+7,y+14,6,3,"#3a4046"); R(g,x+13,y+17,5,2,"#2a3034"); hp(g,x+9,y+15,"#5a2a1a"); if(((now/300)|0)%7===0) hp(g,x+11,y+14,"#ffd070"); return; }
  if(deathT[e.id]==null) deathT[e.id]=downed?now-1000:now;
  const t=Math.min(1,(now-deathT[e.id])/380), k=1-Math.pow(1-t,3), left=(dirH[e.id]??1)<0, dir=left?-1:1;
  const set=isHum(e)?playerFrames({...lookOf(e),w:null}):huskFrames(dmgKey(e)), spr=e.kind==="husk"?tinted(set.idle0,e.type):set.idle0, csc=e.kind==="husk"&&HV[e.type]?HV[e.type].sc:1;
  if(t>=1&&!downed&&!e._pooled){ e._pooled=1; addGore({type:"pool",x:x+cx0+12-dir*4,y:y+cy0+20,t0:now,r:7+Math.random()*4}); }
  g.save(); g.translate(x+12-dir*11*k,y+22-3*k+(t<1?Math.sin(t*Math.PI)*-2:0)); g.rotate(dir*k*Math.PI/2); if(left) g.scale(-1,1); if(csc!==1) g.scale(csc,csc); g.globalAlpha=1; g.drawImage(spr,-12,-30,set.idle0.lw||24,set.idle0.lh||32);
  g.globalCompositeOperation="source-atop"; g.fillStyle=`rgba(20,8,6,${.35*k})`; g.fillRect(-12,-30,24,32); g.restore(); }
let cx0=0, cy0=0;
// ---------- gore: splats, pools, severed limbs (cosmetic, client-side) ----------
function addGore(o){ GORE.push(o); if(GORE.length>420) GORE.splice(0,GORE.length-420); }
function splat(px,py,n,a,spread){ for(let k=0;k<n;k++){ const an=a==null?Math.random()*6.283:a+(Math.random()-.5)*(spread||1), d=Math.random()*(a==null?6:14);
  addGore({type:"drop",x:px+Math.cos(an)*d,y:py+Math.sin(an)*d*.6,s:.5+Math.random()*(k<2?1.5:1),c:Math.random()<.5?"#5a0a06":"#7a1410"}); } }
const LIMB_RECT={player:{head:[5.5,1,13,13],rarm:[4.5,14,3.5,10],larm:[16,14,3.5,10],rleg:[7.5,23,4.5,8],lleg:[12,23,4.5,8]},husk:{head:[7,4,10,11],rarm:[3.5,12,4,16],larm:[16.5,12,4,16],rleg:[8,23,3.5,8],lleg:[13,23,3.5,8]}};
function limbSprite(e,limb){ const kind=isHum(e)?"player":"husk", rc=LIMB_RECT[kind][limb]; if(!rc) return null;
  const src=(kind==="player"?playerFrames({...lookOf(e),dm:"000000",w:null}):huskFrames("000000")).idle0, c=cvs(rc[2]+2,rc[3]+2), g=c.getContext("2d");
  g.drawImage(src,rc[0],rc[1],rc[2],rc[3],1,1,rc[2],rc[3]); const end=limb==="head"?[rc[2]/2-1,rc[3]-.5]:limb.endsWith("leg")?[1,1]:[1,1];
  g.fillStyle="#7a1410"; g.fillRect(end[0],end[1],3,1.5); g.fillStyle="#e8dcc0"; g.fillRect(end[0]+1,end[1]+.5,.5,.5); return c; }
function drawGore(g,cx,cy,now){ cx0=cx; cy0=cy;
  for(const o of GORE){ const X=o.x-cx, Y=o.y-cy; if(X<-30||Y<-30||X>view.fw+30||Y>view.fh+30) continue;
    if(o.type==="drop"){ g.fillStyle=o.c; g.fillRect(X,Y,o.s,o.s*.7); }
    else if(o.type==="pool"){ const r=o.r*Math.min(1,.25+(now-o.t0)/5000); g.fillStyle="rgba(60,6,4,.82)"; g.beginPath(); g.ellipse(X,Y,r,r*.55,0,0,6.283); g.fill(); g.fillStyle="rgba(140,30,20,.35)"; g.beginPath(); g.ellipse(X-r*.3,Y-r*.15,r*.35,r*.15,0,0,6.283); g.fill(); }
    else if(o.type==="limb"&&o.spr){ const t=Math.min(1,(now-o.t0)/420), px=X+(o.tx-o.x)*(t-1), py=Y+(o.ty-o.y)*(t-1)-Math.sin(t*Math.PI)*10;
      g.save(); g.translate(px,py); g.rotate(o.rot+(1-t)*7); g.drawImage(o.spr,-o.spr.lw/2,-o.spr.lh/2); g.restore(); } } }
function drawEnt(g,e,x,y,now){
  if(e.kind==="bot"){ drawBot(g,e,x,y,now); return; }
  if(e.downed){ const t=now/400; drawCorpse(g,e,x,y,now,true); g.strokeStyle=`rgba(224,72,47,${.5+.4*Math.sin(t*3)})`; g.lineWidth=1; g.beginPath(); g.ellipse(x+12,y+16,10+Math.sin(t*3),5,0,0,6.283); g.stroke(); return; }
  const isP=isHum(e), set=isP?playerFrames(lookOf(e)):huskFrames(dmgKey(e)), r=rp[e.id];
  const moving=r&&(Math.abs(r.x-e.x*TS)>.6||Math.abs(r.y-e.y*TS)>.6);
  let k=moving?(((now/110)|0)%2?"walk1":"walk2"):(((now/(isP?650:420)+(isP?0:e.x*.37))|0)%2?"idle1":"idle0");
  if(!isP&&atkT[e.id]&&now-atkT[e.id]<260) k="lunge";
  if(flashT[e.id]&&now-flashT[e.id]<110) k+="W";
  if(e.face&&e.face[0]) dirH[e.id]=e.face[0]; const fc=e.face||[0,1], view=Math.abs(fc[1])>Math.abs(fc[0])?(fc[1]<0?"b":"f"):"s", left=view==="s"&&fc[0]<0;
  if(isP&&S.mode==="ship"&&T(e.x,e.y).t==="seat"&&r&&Math.abs(r.x-e.x*TS)<1&&Math.abs(r.y-e.y*TS)<1) y+=3;
  const spr=(view==="b"?set.back:view==="s"?set.side:set)[k]; if(!LOWFX) castShadow(g,e,spr,x,y,left); g.drawImage(SHADOW_BLOB,x+3,y+18);
  // body language: flinch from hits, kick from your own gun, lean into a walk, husks twitch
  const dir=left?-1:1; let ox=0, oy=0, rot=0;
  const ht=flashT[e.id]?(now-flashT[e.id])/220:9; if(ht<1){ const f=1-ht; ox-=dir*2.2*f; rot-=dir*.16*f; oy-=f; }
  const rt=recoilT[e.id]?(now-recoilT[e.id])/110:9; if(rt<1){ const f=1-rt; ox-=Math.cos(recoilA[e.id]||0)*1.6*f; oy-=Math.sin(recoilA[e.id]||0)*1.6*f; rot-=dir*.06*f; }
  if(moving){ rot+=dir*(isP?.05:.09)+(isP?0:Math.sin(now/90)*.07); oy+=Math.abs(Math.sin(now/55))*-.7; }
  else if(!isP&&((now/700+e.x*1.7)|0)%9===0) rot+=Math.sin(now/30)*.05;
  const V=e.kind==="husk"&&HV[e.type];
  g.save(); g.translate(x+12+ox,y+22+oy); g.rotate(rot); if(left) g.scale(-1,1); if(V){ g.scale(V.sc,V.sc); g.drawImage(tinted(spr,e.type),-12,-30,spr.lw||24,spr.lh||32); huskExtras(g,e,view,now); } else g.drawImage(spr,-12,-30); g.restore();
  if(Object.keys(e.bleed||{}).length&&((now/300+x)%3)<1) R(g,x+12,y+22,1,1,"#9a1a12");
  if(e.surr){ const a=.6+.4*Math.sin(now/200); R(g,x+5,y-3,2,5,`rgba(232,220,192,${a})`); R(g,x+17,y-3,2,5,`rgba(232,220,192,${a})`); }
}
function drawProp(g,t,x,y,now){
  if(t.kind==="captive"){ const lunge=flavorT.captive&&now-flavorT.captive<700, k=lunge?"lunge":(((now/380)|0)%2?"idle1":"idle0"), sp=CH.husk[k], left=((now/2600)|0)%2===0;
    R(g,x+4,y+21,16,2,"rgba(0,0,0,.5)"); R(g,x+2,y+18,1,5,"#4a4842"); R(g,x+3,y+18,6,1,"#4a4842");
    if(left){ g.save(); g.translate(x+24+(lunge?0:0),y-8-(lunge?2:0)); g.scale(-1,1); g.drawImage(sp,0,0); g.restore(); } else g.drawImage(sp,x,y-8-(lunge?2:0)); return; }
  const s=PROP[t.kind]; if(!s) return; g.save(); g.globalAlpha=.8; g.drawImage(SHADOW_BLOB,x,y+15,24,10); g.restore(); g.drawImage(s,x,y+24-s.lh);
  if(t.kind==="arcade"){ const f=(now/120)|0; for(let k=0;k<6;k++) R(g,x+7+((k*5+f)%10),y+24-34+8+((k*3+f*2)%8),1,1,["#e04030","#62cfe0","#e8b048","#9bc06a"][k%4]); R(g,x+7+(f%10),y+24-34+15,2,1,"#ffffff"); }
  if(t.kind==="vending"&&((now/1300)|0)%2) R(g,x+17,y+24-34+9,1,1,"#c8ffd0");
  if(t.kind==="coffee"&&((now/900)|0)%2) R(g,x+15,y+24-28+8,2,2,"#ff7050");
  if(t.kind==="shower"&&flavorT.shower&&now-flavorT.shower<2500) for(let k=0;k<10;k++) R(g,x+9+((k*7+((now/40)|0))%7),y+24-34+8+((k*11+((now/30)|0))%20),1,2,"#9ad0e0");
  if(t.kind==="brazier"){ for(let k=0;k<7;k++){ const fx=x+6+((k*5+((now/70)|0))%12), h=3+((k*7+((now/90)|0))%6); R(g,fx,y+11-h,1,h,k%3?"#ff8a20":"#ffd060"); R(g,fx,y+11-h,1,1,"#fff0b0"); } }
  if(t.kind==="generator"&&S.power&&(now%800)<400) R(g,x+18,y+6+14,2,1,"#5ad06a");
  if(t.kind==="strongbox"&&!t.searched&&((now/700)|0)%2) R(g,x+15,y+24-22+10,3,1,S.power?"#9affa8":"#ff6040");
  if(t.searched&&BOXES.has(t.kind)) drawOpened(g,t.kind,x,y+24-s.lh,s.lh);
}
// a searched container: doors hang open, lids are up, and it's dark inside
function drawOpened(g,k,x,top,h){
  if(h>=28){ const ix=x+5, iy=top+4, iw=13, ih=h-8;
    R(g,ix,iy,iw,ih,"#07080a"); R(g,ix,iy,iw,1,"#000"); for(let j=iy+6;j<iy+ih-2;j+=7){ R(g,ix,j,iw,1,"#2a2a26"); R(g,ix,j+1,iw,.5,"#0a0a09"); }
    R(g,ix+2,iy+ih-3,4,2,"#3a3428"); hp(g,ix+9,iy+ih-2,"#5a5446");
    R(g,x+19,top+3,3,h-6,k==="medcab"||k==="fridge"?"#a0a8ac":"#4a5656"); R(g,x+19,top+3,1,h-6,"rgba(255,255,255,.18)"); R(g,x+22,top+3,1,h-6,"rgba(0,0,0,.5)"); return; }
  const lid=k==="strongbox"?"#4a4e52":k==="ammocrate"?"#4a5836":k==="footlocker"?"#4a5038":"#6a6248";
  R(g,x+3,top+5,18,4,"#050505"); R(g,x+4,top+6,4,2,"#2a2620"); hp(g,x+12,top+7,"#4a4436");
  R(g,x+3,top,18,4,lid); R(g,x+3,top,18,1,"rgba(255,255,255,.2)"); R(g,x+3,top+4,18,1,"rgba(0,0,0,.6)"); }
function drawUI(g,cx,cy,now){
  const p=me();
  { const m=S.boss&&S.ents.find(e=>e.id===S.boss&&e.alive); if(m&&m.aware&&VIS[Sim.idx(S,m.x,m.y)]){ const f=Sim.LIMBS.reduce((a,l)=>a+Math.max(0,m.hp[l]),0)/Sim.LIMBS.reduce((a,l)=>a+m.max[l],0), w=Math.min(110,view.fw-40), bx=(view.fw-w)/2, by=view.fh*.2;
      R(g,bx-1,by-1,w+2,4,"#000"); R(g,bx,by,w,2,"#2a0806"); R(g,bx,by,w*f,2,"#c22a1a"); R(g,bx,by,w*f,.6,"#ff6a4a"); g.fillStyle="#e8d8c0"; g.font="5px serif"; g.textAlign="center"; g.fillText("THE MATRIARCH",view.fw/2,by-2); g.textAlign="left"; } }
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
  if(fpsAuto&&!LOWFX&&S.mode==="raid"&&document.visibilityState==="visible"){ if(!fpsT0){ fpsT0=now; fpsN=0; } fpsN++; if(now-fpsT0>6000){ const fps=fpsN*1000/(now-fpsT0); fpsT0=now; fpsN=0; if(fps<26) setLowFx(true,true); } }
  const dt=Math.min(.05,(now-lastT)/1000); lastT=now; const p=viewEnt();
  for(const e of S.ents){ const tx=e.x*TS, ty=e.y*TS, r=rp[e.id]||(rp[e.id]={x:tx,y:ty});
    if(Math.abs(r.x-tx)>72||Math.abs(r.y-ty)>72){ r.x=tx; r.y=ty; } const step=dt*TS*8; r.x+=Math.max(-step,Math.min(step,tx-r.x)); r.y+=Math.max(-step,Math.min(step,ty-r.y)); }
  const pr=rp[p.id]||rp[PID], fw=view.fw, fh=view.fh, mw=S.W*TS, mh=S.H*TS;
  let tx=pr.x+12-fw/2, ty=pr.y+12-fh*(mode==="touch"?.47:.5);
  tx=mw>fw?Math.max(-TS*2,Math.min(mw-fw+TS*2,tx)):(mw-fw)/2;
  ty=Math.max(-fh*.3,Math.min(mh-fh*.7,ty));
  if(!camInit){ camX=tx; camY=ty; camInit=true; } const ck=1-Math.exp(-dt*8); camX+=(tx-camX)*ck; camY+=(ty-camY)*ck;
  updateFx(dt,now);
  const cx=Math.round(camX), cy=Math.round(camY), g=fctx;
  g.setTransform(Q,0,0,Q,0,0); g.imageSmoothingEnabled=false; g.globalCompositeOperation="source-over"; g.globalAlpha=1;
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
    if(S.scorch&&S.scorch[i]&&t.t!=="space"&&t.t!=="wall"){ for(let k=0;k<5;k++){ const v=hh(x,y,k+400); disc(g,ox+5+v%14,oy+5+(v>>>5)%14,3+(v>>>8)%3,"rgba(12,10,8,.5)"); } }
    if(S.blood[i]&&t.t!=="space") drawBlood(g,x,y,S.blood[i],ox,oy);
    if(t.t==="console") R(g,ox+5,oy+10,14,6,S.power?(((now/90)|0)%7?"#1d5a2a":"#2a7a3a"):"#4a0e0a");
    if(t.t==="door"&&!t.open){ const c=!S.power?"#2a1a10":(t.locked?"#e04030":"#5ad06a"); if(doorVert(x,y)) R(g,ox+11,oy+3,2,2,c); else R(g,ox+20,oy+10,2,2,c); }
  }
  if(goreS!==S){ GORE=[]; goreS=S; deathT={}; }
  drawGore(g,cx,cy,now);
  for(const e of S.ents){ if(e.alive||e.extracted||e.spaced) continue; const i=Sim.idx(S,e.x,e.y); if(p.seen[i]) drawCorpse(g,e,e.x*TS-cx,e.y*TS-cy,now); }
  for(const it of S.items){ const i=Sim.idx(S,it.x,it.y); if(!VIS[i]) continue; const x=it.x*TS-cx+4, y=it.y*TS-cy+5; g.fillStyle="rgba(0,0,0,.5)"; g.fillRect(x+3,y+14,10,1); const rr=Items.rarOf(it); if(rr>=1){ g.fillStyle=Items.RAR[rr].col+"55"; g.fillRect(x+2,y+13,12,2); } itemIcon(g,it,x,y,(now%900)<450); if(((now/1000+it.id*.37)%2.6)<.12) R(g,x+5+((it.id*3)%6),y+6,1,1,"#fff"); }
  // y-sorted props + characters
  const draws=[];
  for(let y=y0;y<=Math.min(S.H-1,y1+1);y++)for(let x=x0;x<=x1;x++){ const i=Sim.idx(S,x,y), t=S.tiles[i]; if(t.t==="prop"&&p.seen[i]) draws.push({y:y*TS,f:()=>drawProp(g,t,x*TS-cx,y*TS-cy,now)});
    if(t.t==="seat"){ draws.push({y:y*TS-1,f:()=>g.drawImage(SEAT,x*TS-cx,y*TS-cy)}); draws.push({y:y*TS+1,f:()=>g.drawImage(SEAT_BACK[t.kind]||SEAT_BACK.nav,x*TS-cx,y*TS-cy+12)}); }
    if(t.t==="terminal"&&t.kind==="navtable"&&T(x-1,y).t==="terminal"&&T(x-1,y).kind==="navtable") continue;
    if(t.t==="terminal") draws.push({y:y*TS,f:()=>{ const sp=TERM[t.kind], ox=x*TS-cx, oy=y*TS-cy; g.drawImage(sp,ox,oy+24-sp.lh); if(t.kind==="helm"&&((now/400)|0)%2) R(g,ox+16,oy+5,1,1,"#e8ffff"); if(t.kind==="airlock"&&((now/700)|0)%2) R(g,ox+9,oy+7,6,1,"#ff8060"); }}); }
  for(const e of S.ents){ if(!e.alive) continue; const i=Sim.idx(S,e.x,e.y); if(!(VIS[i]||e.id===PID)) continue; const r=rp[e.id]; draws.push({y:r.y+.5,f:()=>drawEnt(g,e,Math.round(r.x)-cx,Math.round(r.y)-cy,now)}); }
  draws.sort((a,b)=>a.y-b.y).forEach(d=>d.f());
  for(const q of parts) if(!q.emit){ g.fillStyle=q.col; g.globalAlpha=q.grow?Math.max(0,q.life/q.max):1; g.fillRect(Math.round((q.x-cx)*2)/2-q.size/2*(q.grow?1:0),Math.round((q.y-cy)*2)/2,q.size,q.size); } g.globalAlpha=1;
  for(const s of slashes){ const ox=s.x*TS-cx, oy=s.y*TS-cy-6, a=1-s.t/s.dur; g.fillStyle=`rgba(230,40,30,${a})`; for(let k=0;k<3;k++) for(let j=0;j<10;j++) g.fillRect((ox+5+k*5+j*.6)|0,oy+4+j,1,1); }
  // lighting
  const L=buildLightmap(cx,cy,now);
  g.save(); g.imageSmoothingEnabled=true; g.globalCompositeOperation="multiply"; g.drawImage(lm,0,0,L.lw,L.lh,L.ox*TS-cx,L.oy*TS-cy,L.lw*TS,L.lh*TS);
  if(S.mode!=="ship"){ g.globalCompositeOperation="soft-light"; g.fillStyle="rgba(16,44,52,.55)"; g.fillRect(0,0,fw,fh); g.globalCompositeOperation="multiply"; g.fillStyle="#d4d2cc"; g.fillRect(0,0,fw,fh); }
  g.restore();
  // unexplored: dark machinery
  if(!conduit){ conduit=makeConduit(); conduitPat=g.createPattern(conduit,"repeat"); }
  try{ conduitPat.setTransform(new DOMMatrix().translate(-cx,-cy).scale(1/Q)); }catch(e){}
  g.fillStyle=conduitPat; g.globalAlpha=S.mode==="ship"?0:.4;
  const gx0=Math.floor(cx/TS)-1, gy0=Math.floor(cy/TS)-1, gx1=Math.ceil((cx+fw)/TS), gy1=Math.ceil((cy+fh)/TS);
  for(let y=gy0;y<=gy1;y++)for(let x=gx0;x<=gx1;x++){ const off=x<0||y<0||x>=S.W||y>=S.H; if(off||!p.seen[Sim.idx(S,x,y)]) g.fillRect(x*TS-cx,y*TS-cy,TS,TS); }
  g.globalAlpha=1;
  // flames (self-lit)
  for(const k of Object.keys(S.fire||{})){ const i=+k; if(!VIS[i]) continue; const lv=S.fire[i], x=i%S.W, y=(i/S.W)|0, ox=x*TS-cx, oy=y*TS-cy;
    for(let c=0;c<6+lv*2;c++){ const fx2=ox+3+((c*7+hh(x,y,c))%18), ph=(now/80+c*1.7+x)|0, hgt=4+lv*3+((ph*13+c*5)%(5+lv*2)), base=oy+20-((c*3)%5);
      R(g,fx2,base-hgt,2,hgt,"#c22a0c"); R(g,fx2,base-hgt+2,2,Math.max(1,hgt-4),"#ff6a18"); R(g,fx2,base-Math.floor(hgt*.55),1,Math.max(1,Math.floor(hgt*.4)),"#ffc040"); R(g,fx2,base-hgt,1,1,"#fff0a0"); } }
  // glow
  g.save(); g.globalCompositeOperation="lighter"; if(!LOWFX) drawShafts(g,cx,cy,now);
  const glow=(x,y,r,c)=>{ const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,c); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2); };
  for(const E of EMIT){ if(E.type!=="exhaust") continue; const fl=.75+.25*Math.sin(now*.03+E.y)+.1*Math.sin(now*.11+E.y*3), x=E.bx-cx, y=E.by-cy, burn=warp?2.2:1;
    const gr=g.createLinearGradient(x,y,x-60*burn,y); gr.addColorStop(0,`rgba(140,200,255,${.55*fl})`); gr.addColorStop(.3,`rgba(60,120,255,${.3*fl})`); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr;
    g.beginPath(); g.moveTo(x,y-6); g.lineTo(x-60*burn,y-11*burn); g.lineTo(x-60*burn,y+11*burn); g.lineTo(x,y+6); g.fill(); glow(x,y,10,`rgba(170,220,255,${.5*fl})`); R(g,x-1,y-5,1.5,10,`rgba(230,245,255,${.8*fl})`); }
  for(const Lp of SOURCES){ if(!Lp.lit) continue; const i=Sim.idx(S,Lp.x,Lp.y); if(!VIS[i]) continue; const bx=Lp.bx-cx, by=Lp.by-cy;
    if(Lp.kind==="lamp"){ if(S.power){ glow(bx,by,16,`rgba(255,180,90,${.35*Lp.lit})`); R(g,bx-2,by-1,4,2,`rgba(255,225,160,${Lp.lit})`); } else { glow(bx,by,14,`rgba(255,40,20,${.45*Lp.lit})`); R(g,bx-2,by-1,4,2,`rgba(255,60,40,${Lp.lit})`); } }
    else if(Lp.kind==="fire") glow(bx,by,22,`rgba(255,140,50,${.3*Lp.lit})`);
    else if(Lp.kind==="tank") glow(bx,by+10,14,`rgba(80,255,160,${.18*Lp.lit})`);
    else if(Lp.kind==="screen") glow(bx,by,10,"rgba(80,220,110,.16)");
    else if(Lp.kind==="term"&&Lp.tk==="navtable"){ const ox=Lp.x*TS-cx, oy=Lp.y*TS-cy; if(T(Lp.x-1,Lp.y).kind==="navtable") continue;
      const hx=ox+24, hy=oy-6; glow(hx,hy+8,30,"rgba(80,220,255,.16)"); g.fillStyle="rgba(90,208,208,.12)"; g.beginPath(); g.moveTo(ox+6,oy+9); g.lineTo(ox+42,oy+9); g.lineTo(ox+34,oy-16); g.lineTo(ox+14,oy-16); g.fill();
      const a0=now/2400; World.LOCS.forEach((l,i)=>{ const a=a0+i*0.698, rx=14+(i%3)*2, px=hx+Math.cos(a)*rx, py=hy-2+Math.sin(a)*rx*.35-(i%3)*3; const col=l.type==="station"?"#76c2c4":l.type==="outpost"?"#c79a4a":"#e0482f"; R(g,Math.round(px),Math.round(py),2,2,col); });
      R(g,hx-1,hy-3,3,3,"#e8f8ff"); }
    else if(Lp.kind==="term"&&Lp.tk==="comms"){ const ox=Lp.x*TS-cx+12, oy=Lp.y*TS-cy+16, Fs=Object.values(Sim.FACTIONS), F=Fs[((now/3000)|0)%Fs.length], a=.5+.2*Math.sin(now/170);
      glow(ox,oy-10,22,"rgba(80,220,255,.14)"); g.fillStyle="rgba(90,208,208,.10)"; g.beginPath(); g.moveTo(ox-7,oy); g.lineTo(ox+7,oy); g.lineTo(ox+11,oy-26); g.lineTo(ox-11,oy-26); g.fill();
      g.save(); g.globalAlpha=a*(Math.random()<.05?.3:1); g.translate(ox,oy-15); g.scale(Math.cos(now/700),1); drawEmblemF(g,F.emblem,0,0,7,F.col); g.restore(); }
    else if(Lp.kind==="term") glow(bx,by,12,`rgba(${Lp.col[0]*255|0},${Lp.col[1]*255|0},${Lp.col[2]*255|0},.22)`); }
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){ const i=Sim.idx(S,x,y), t=S.tiles[i]; if(!VIS[i]) continue; const ox=x*TS-cx, oy=y*TS-cy;
    if(t.t==="console") glow(ox+12,oy+13,12,S.power?"rgba(60,200,90,.25)":"rgba(220,40,20,.3)");
    if(t.t==="door"&&!t.open&&S.power){ const v=doorVert(x,y); glow(v?ox+12:ox+21,v?oy+4:oy+11,4,t.locked?"rgba(255,60,40,.55)":"rgba(80,220,100,.45)"); }
    if(t.t==="extract"&&(now%1400)<700) glow(ox+12,oy+12,10,"rgba(255,160,50,.16)"); }
  for(const e of S.ents){ if(!e.alive) continue; const i=Sim.idx(S,e.x,e.y); if(!(VIS[i]||e.id===PID)) continue; const r=rp[e.id], left=(dirH[e.id]??1)<0, X=Math.round(r.x)-cx, Y=Math.round(r.y)-cy-8;
    const lunge=atkT[e.id]&&now-atkT[e.id]<260, bob=((now/(isHum(e)?650:420)+(isHum(e)?0:e.x*.37))|0)%2;
    const fc=e.face||[0,1], view=Math.abs(fc[1])>Math.abs(fc[0])?(fc[1]<0?"b":"f"):"s", L2=view==="s"&&fc[0]<0;
    if(e.kind==="bot"){ if(S.power) glow(X+12,Y+14,6,Sim.botHostile(S,e,me())?"rgba(255,60,30,.35)":"rgba(80,220,100,.3)"); }
    else if(e.kind==="husk"&&HV[e.type]){ if(e.type==="spitter") glow(X+12,Y+15,8,"rgba(140,230,60,.35)"); if(e.type==="matriarch") glow(X+12,Y-6,16,"rgba(255,40,20,.35)"); }
    else if(e.kind==="husk"){ if(view!=="b"){ const ex=view==="f"?14.25:(lunge?20:19), ey=view==="f"?9.5+bob:(lunge?9:11+bob), px=L2?23-ex:ex; R(g,X+px,Y+ey,1,1,e.aware?"#ff5a3a":"#8a2010"); glow(X+px+.5,Y+ey+.5,e.aware?7:4,e.aware?"rgba(255,50,30,.5)":"rgba(160,20,10,.25)"); } }
    else { const hd=e.head&&e.head.d; if(hd==="hardhat"&&view!=="b"){ glow(X+(view==="f"?12:(L2?23-15.5:15.5)),Y+4+bob,9,"rgba(255,240,190,.55)"); }
      if(hd&&view!=="b"&&!["welder","flakhelm","eva","hardhat"].includes(hd)){ const vx=view==="f"?12:(L2?23-15:15), vy=8+bob, col=hd==="cowl"?"rgba(190,110,255,.45)":hd==="deathmask"?"rgba(255,60,40,.4)":"rgba(242,182,72,.35)"; glow(X+vx,Y+vy,view==="f"?7:5,col); }
      const ci=S.ents.filter(q=>q.kind==="player").indexOf(e); if(ci>=0&&S.ents.filter(q=>q.kind==="player").length>1){ const c=CREW_COL[ci%4]; R(g,X+10,Y-3,5,1,c); R(g,X+11,Y-2,3,1,c); R(g,X+12,Y-1,1,1,c); } } }
  for(const k of Object.keys(S.fire||{})){ const i=+k; if(!VIS[i]) continue; const lv=S.fire[i]; glow((i%S.W)*TS-cx+12,((i/S.W)|0)*TS-cy+12,14+lv*5,`rgba(255,110,30,${.16+.06*lv+.04*Math.sin(now*.03+i)})`); }
  for(const B of bursts){ const a=1-B.t/B.dur, x=B.x-cx, y=B.y-cy, L=(B.big?16:9)*(.6+a*.6); glow(x,y,B.big?18:11,`rgba(255,220,140,${.7*a})`);
    g.fillStyle=`rgba(255,250,220,${a})`; for(const [da,len,w] of [[0,L,1.5],[.55,L*.55,1],[-.55,L*.55,1],[2.4,L*.3,.7],[-2.4,L*.3,.7]]){ g.save(); g.translate(x,y); g.rotate(B.a+da); g.fillRect(0,-w/2,len,w); g.restore(); }
    g.fillStyle=`rgba(255,255,255,${a})`; g.fillRect(x-1.5,y-1.5,3,3); }
  for(const r of rings){ const a=1-r.t/r.dur, rad=4+r.t/r.dur*52; g.strokeStyle=`rgba(${r.col||"255,200,120"},${a*.8})`; g.lineWidth=2; g.beginPath(); g.arc(r.x-cx,r.y-cy,rad,0,6.283); g.stroke(); }
  for(const it of S.items){ if(!VIS[Sim.idx(S,it.x,it.y)]) continue; const rr=Items.rarOf(it), X=it.x*TS-cx+12, Y=it.y*TS-cy+16;
    if(it.d==="blackbox"&&(now%900)<450) glow(X+4,Y-4,7,"rgba(255,100,40,.5)");
    if(rr>=2){ const c=Items.RAR[rr].col, h=rr>=3?70:30, a=.25+.12*Math.sin(now*.004+it.id); const gr=g.createLinearGradient(0,Y-h,0,Y); gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(1,c); g.globalAlpha=a; g.fillStyle=gr; g.fillRect(X-2,Y-h,4,h); g.globalAlpha=1; glow(X,Y-2,rr>=3?12:7,c+"66"); } }
  for(const q of parts) if(q.emit){ if(q.clipY!=null&&q.y<q.clipY) continue; g.fillStyle=q.col; g.globalAlpha=Math.max(0,q.life/q.max); g.fillRect(Math.round((q.x-cx)*2)/2,Math.round((q.y-cy)*2)/2,q.size,q.size); }
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
  sctx.drawImage(frame,0,0,fw*Q,fh*Q,sx,sy,fw*sc,fh*sc);
  if(scan&&sc>=3){ sctx.fillStyle=scan; sctx.fillRect(0,0,sw,shh); }
  if(grain&&!LOWFX){ sctx.save(); sctx.globalAlpha=.1; sctx.globalCompositeOperation="overlay"; const ox=(Math.random()*128)|0, oy=(Math.random()*128)|0; sctx.translate(-ox,-oy); sctx.fillStyle=grain; sctx.fillRect(0,0,sw+128,shh+128); sctx.restore(); }
  if(vignette) sctx.drawImage(vignette,0,0);
  const danger=p.alive&&(p.blood<40||(p.o2<=12&&S.P[Sim.idx(S,p.x,p.y)]<45));
  if(hurtFlash>0||danger){ const a=Math.max(hurtFlash*.35,danger?(.12+.08*Math.sin(now*.006)):0); const gr=sctx.createRadialGradient(sw/2,shh/2,Math.min(sw,shh)*.25,sw/2,shh/2,Math.max(sw,shh)*.7); gr.addColorStop(0,"rgba(120,0,0,0)"); gr.addColorStop(1,`rgba(150,10,0,${a*2})`); sctx.fillStyle=gr; sctx.fillRect(0,0,sw,shh); }
  if(typeof drawEdges==="function") drawEdges(cx,cy);
  if(typeof updateTags==="function") updateTags(cx,cy);
  if(typeof Snd!=="undefined"&&now-(sndT||0)>200){ sndT=now; const v=viewEnt();
    Snd.setListener({x:v.x,y:v.y,see:(x,y)=>S.mode==="ship"||(VIS&&VIS[Sim.idx(S,x,y)])});
    const nf=Object.keys(S.fire||{}).filter(k=>{ const i=+k; return Math.hypot(i%S.W-v.x,((i/S.W)|0)-v.y)<9; }).length, br=S.mode==="raid"&&S.windStr&&(S.windStr[Sim.idx(S,v.x,v.y)]||0)>2;
    const danger=S.mode==="raid"&&S.ents.some(e=>e.alive&&VIS&&VIS[Sim.idx(S,e.x,e.y)]&&(e.kind==="husk"||e.kind==="bot"||(e.kind==="raider"&&attOf(e)==="hostile"&&!e.surr)));
    Snd.scene({scene:!$("menu").hidden?"menu":S.mode,power:S.power,fire:nf/6,breach:br,danger}); }
}
function loop(now){ try{ render(now); }catch(e){ console.error(e); } requestAnimationFrame(loop); }

function resize(){
  const r=$("vp").getBoundingClientRect(), dpr=window.devicePixelRatio||1;
  view.dpr=dpr; screen.width=Math.max(1,Math.round(r.width*dpr)); screen.height=Math.max(1,Math.round(r.height*dpr));
  const tiles=mode==="touch"?8:12.5;
  view.scale=Math.max(1/Q,Math.round(screen.width/(TS*tiles)*Q)/Q);
  view.fw=Math.ceil(screen.width/view.scale); view.fh=Math.ceil(screen.height/view.scale);
  frame.width=view.fw*Q; frame.height=view.fh*Q;
  vignette=cvsRaw(screen.width,screen.height);
  { const g=vignette.getContext("2d"), w=screen.width, h=screen.height, gr=g.createRadialGradient(w/2,h/2,Math.min(w,h)*.35,w/2,h/2,Math.hypot(w,h)*.55); gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(.7,"rgba(0,0,0,.35)"); gr.addColorStop(1,"rgba(0,0,0,.86)"); g.fillStyle=gr; g.fillRect(0,0,w,h); }
  const sl=cvsRaw(1,view.scale), sg=sl.getContext("2d"); sg.fillStyle="rgba(0,0,0,.14)"; sg.fillRect(0,view.scale-1,1,1); scan=sctx.createPattern(sl,"repeat");
  if(!grain){ const n=cvsRaw(128,128), ng=n.getContext("2d"), id=ng.createImageData(128,128); for(let i=0;i<id.data.length;i+=4){ const v=Math.random()*255; id.data[i]=id.data[i+1]=id.data[i+2]=v; id.data[i+3]=255; } ng.putImageData(id,0,0); grain=sctx.createPattern(n,"repeat"); }
  conduitPat=null; conduit=null;
}

// ---------- state refresh ----------
function afterChange(){
  Sim.bind(S); document.body.dataset.scene=S.mode==="ship"?"ship":"raid";
  const p=viewEnt(); VIS=Sim.fov(S,p); if(typeof shareVision==="function") shareVision();
  const k=tileKey(); if(k!==staticKey){ staticKey=k; buildStatic(); }
  computeLights(); processFx(); if(typeof harvestChat==="function") harvestChat();
  if(target&&!targetable(target.x,target.y)) target=null;
  renderPanels();
}

// ---------- panels ----------
const limbCol=(e,l)=>{ const f=e.hp[l]/e.max[l]; return f<=0?"#262320":f>.66?"#4f7a46":f>.33?"#c79a4a":"#e0482f"; };
function figHTML(p){ return Sim.LIMBS.map(l=>`<i class="${l}${p.bleed[l]?" bleed":""}" style="background:${limbCol(p,l)}" title="${Sim.LNAME[l]} ${p.hp[l]}/${p.max[l]}"></i>`).join(""); }
function vitHTML(p){ const pr=S.P[Sim.idx(S,p.x,p.y)], bl=Sim.LIMBS.filter(l=>p.bleed[l]);
  const m=(lbl,val,max,col,txt)=>`<span class="lbl">${lbl}</span><div class="meter"><i style="width:${Math.max(0,Math.min(100,val/max*100))}%;background:${col}"></i></div><span class="num">${txt}</span>`;
  const fr=Object.keys(p.frac||{}), st=!p.alive?"Flatline":bl.length?`Bleeding: ${bl.map(l=>Sim.LNAME[l]).join(", ")}`:fr.length?`Broken ${fr.map(l=>Sim.LNAME[l]).join(", ")}`:(p.inf>=25?"Feverish · infected":p.inf?"Infected wound":pr<45?"Suit sealed · on tank air":"Stable");
  return `<span class="big" style="color:${p.blood>60?"var(--bile)":p.blood>35?"var(--brass)":"var(--blood2)"}">${Math.max(0,p.blood)}</span><canvas class="ekg" width="200" height="26"></canvas>`+
    m("O₂",p.o2,p.o2max||100,p.o2>20?"var(--cold)":"var(--blood2)",p.o2)+m("Air",pr,101,pr>70?"var(--cold)":pr>40?"var(--brass)":"var(--blood2)",Math.round(pr)+" kPa")+
    (p.food!=null?m("Food",p.food,100,p.food>30?"#b08a4a":"var(--blood2)",Math.round(p.food))+m("Water",p.water,100,p.water>30?"#5a9ad0":"var(--blood2)",Math.round(p.water)):"")+
    `<span class="state ${bl.length||p.blood<40?"bad":""}">${st}</span>`; }
function drawEkg(root,p){ root.querySelectorAll("canvas.ekg").forEach(c=>{ const g=c.getContext("2d"), w=c.width, h=c.height; g.clearRect(0,0,w,h); g.fillStyle=p.blood>60?"#7fa86a":p.blood>35?"#c79a4a":"#e0482f";
  const amp=Math.max(.2,p.blood/100), rate=p.blood<50?14:20; for(let x=0;x<w;x+=2){ const ph=(x+S.turn*7)%rate; let y=h/2; if(ph===4) y=h/2-9*amp; else if(ph===6) y=h/2+7*amp; else if(ph===2) y=h/2+2; g.fillRect(x,Math.round(y),2,2); if(ph===4||ph===6){ const y0=Math.min(y,h/2), y1=Math.max(y,h/2); g.fillRect(x,y0,1,y1-y0); } } }); }
function contractRows(p){ const vis=S.ents.filter(e=>e.kind==="husk"&&e.alive&&VIS[Sim.idx(S,e.x,e.y)]).length, bb=p.inv.some(i=>i.d==="blackbox");
  return [...(S.jobs||[]).map(J=>[J.title.length>24?J.title.slice(0,23)+"…":J.title,J.done?"DONE":J.type==="purge"?`${J.prog}/${J.n}`:"open",J.done?"good":""]),["Black box",bb?"SECURED":"in the vault",bb?"good":""],["Haul",Sim.lootValue(p)+" cr",""],["Station power",S.power?"ON":"OFF",S.power?"good":"bad"],["Location",Sim.roomName(p.x,p.y),""],["Husks in sight",vis,vis?"bad":""],...(()=>{ const rs=S.ents.filter(e=>e.kind==="raider"&&e.alive&&VIS[Sim.idx(S,e.x,e.y)]); if(!rs.length) return []; const h=rs.filter(e=>attOf(e)==="hostile"&&!e.surr).length; return [["Raiders in sight",h?`${rs.length} (${h} hostile)`:rs.length,h?"bad":""]]; })(),["Fires",Object.keys(S.fire||{}).length,Object.keys(S.fire||{}).length?"bad":""],...crewRows(),["Turn",S.turn,""]]
    .map(([a,b,c])=>`<span>${a}</span><span class="${c}">${b}</span>`).join(""); }
function crewRows(){ const crew=S.ents.filter(e=>e.kind==="player"); if(crew.length<2) return [];
  const aboard=crew.filter(e=>e.alive).length, waiting=crew.filter(e=>e.alive&&!e.acted&&e.id!==PID).map(e=>typeof nameOf==="function"?nameOf(e.id):e.id);
  return [["Crew",`${aboard} aboard · ${crew.length-aboard} out`,""],...(me().alive&&me().acted&&waiting.length?[["Waiting on",waiting.join(", ").slice(0,28),"bad"]]:[])]; }
function logText(l){ if(l.kind==="chat"){ const raider=l.fac!=null, nm=raider?l.who:(l.from===PID?"You":(typeof nameOf==="function"?nameOf(l.from):l.who)), c=raider?ATT_COL[l.att]||"#e8b048":(typeof colorOf==="function"?colorOf(l.from):"#c9a24a"); return `<b style="color:${c}">${esc(nm)}:</b> “${esc(l.msg)}”`; }
  if(!l.pid||l.pid===PID||typeof nameOf!=="function") return l.msg; const n=nameOf(l.pid);
  const verb=w=>w==="have"?"has":/(s|sh|ch|x|z)$/.test(w)?w+"es":w+"s";
  return l.msg.replace(/^You die\./,n+" dies.").replace(/^You're /,n+" is ").replace(/^Your /,n+"'s ").replace(/^You ([a-z]+)\b(?!')/,(m,w)=>n+" "+verb(w)).replace(/^You /,n+" ").replace(/\byour\b/g,"their").replace(/\bYou\b/g,n).replace(/\byou\b/g,n); }
function logHTML(n){ return S.log.slice(-n).map(l=>`<div class="${l.kind}"><span class="t">${String(l.t).padStart(3,"0")}</span>${logText(l)}</div>`).join(""); }
function hotHTML(p,n,keys){ let s=""; for(let i=0;i<Math.max(n,p.inv.length);i++){ const it=p.inv[i];
  s+=it?`<button class="hotslot" data-use="${i}" title="${Items.name(it)} · ${Items.RAR[Items.rarOf(it)].name}${Items.kind(it)==="throw"?" · click, then pick a spot":""}"><div class="slot" style="border-color:${rarCol(it)}"><img alt="${Items.name(it)}" src="${iconFor(it)}">${Items.kind(it)==="throw"?`<span class="v">THROW</span>`:""}</div>${keys?`<span class="kb">${i+1}</span>`:""}</button>`
       :`<div class="hotslot empty"><div class="slot"></div>${keys?`<span class="kb">${i+1}</span>`:""}</div>`; } return s; }
const BOXES=new Set(["locker","crate","footlocker","ammocrate","medcab","shelf","strongbox","pallet","gunrack","fridge"]);
function useLabel(p){ if(!p||!p.alive) return "Use";
  for(const [dx,dy] of [p.face||[0,-1],[1,0],[-1,0],[0,1],[0,-1]]){ const t=Sim.tileAt(S,p.x+dx,p.y+dy); if(t.t==="prop"&&BOXES.has(t.kind)&&!t.searched) return t.kind==="strongbox"?"Crack":"Search"; }
  for(const [dx,dy] of [p.face||[0,-1],[1,0],[-1,0],[0,1],[0,-1]]){ const t=Sim.tileAt(S,p.x+dx,p.y+dy); if(t.t==="door") return t.open?"Close":"Open"; if(t.t==="console") return "Breaker"; }
  return "Use"; }
function renderPanels(){
  if(typeof tutTick==="function") tutTick();
  if(typeof renderCrew==="function") renderCrew();
  if(S.mode==="raid"&&typeof panelKind!=="undefined"&&(panelKind==="inventory"||panelKind==="body")) renderPanel();
  if(S.mode==="ship"){ $("end").hidden=true; if(typeof renderShipHud==="function") renderShipHud(); return; }
  const p=me(), onPad=Sim.tileAt(S,p.x,p.y).t==="extract"&&S.status==="playing";
  { const lb=useLabel(p); const bi=$("b-int"); if(bi&&bi.dataset.l!==lb){ bi.dataset.l=lb; bi.innerHTML=`<span class="key">F</span>${lb}`; } const tu=$("t-use"); if(tu&&tu.textContent!==lb) tu.textContent=lb; }
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
    $("b-ext").disabled=!onPad; $("b-air").classList.toggle("on",overlay); $("b-light").classList.toggle("on",!!p.light&&!p.lightOff); $("b-light").disabled=!p.light; renderTip();
  } else {
    const pr=S.P[Sim.idx(S,p.x,p.y)];
    const m=(lbl,val,max,col,txt)=>`<span class="lbl">${lbl}</span><div class="meter"><i style="width:${Math.max(0,Math.min(100,val/max*100))}%;background:${col}"></i></div><span class="num">${txt}</span>`;
    const mm=(l,v,mx,c,t)=>`<div class="mm"><span>${l}</span><i><b style="width:${Math.max(0,Math.min(100,v/mx*100))}%;background:${c}"></b></i><em>${t}</em></div>`, G=Sim.gun(p), at=G&&Items.stats(G).ammo;
    $("tvit").innerHTML=`<div class="mm-grid">${mm("BLD",p.blood,100,p.blood>60?"#c9a24a":p.blood>35?"#c07a2a":"var(--blood2)",Math.max(0,p.blood))}${mm("O₂",p.o2,p.o2max||100,p.o2>20?"var(--cold)":"var(--blood2)",p.o2)}${p.food!=null?mm("FOOD",p.food,100,p.food>30?"#b08a4a":"var(--blood2)",Math.round(p.food))+mm("H₂O",p.water,100,p.water>30?"#5a9ad0":"var(--blood2)",Math.round(p.water)):""}${pr<90?mm("AIR",pr,101,pr>40?"#c07a2a":"var(--blood2)",Math.round(pr)):""}</div>
      <div class="t-ammo"><span>${G?esc(Items.name(G)):"Unarmed"}</span><b>${at?(p.ammo[at]|0):"–"}</b><span>${at?Items.AMMO[at].short:""}</span><span style="margin-left:auto;color:${S.power?"#8a8a70":"var(--blood2)"}">${S.power?"power on":"power off"}</span></div>`;
    $("tfig").innerHTML=figHTML(p); $("tick").innerHTML=logHTML(2);
    $("thot").innerHTML=hotHTML(p,Math.min(6,Math.max(4,p.inv.length)),false);
    $("dfig").innerHTML=figHTML(p); $("dvit").innerHTML=vitHTML(p); drawEkg($("dvit"),p);
    $("dinv").innerHTML=p.inv.length?p.inv.map((it,i)=>`<button data-use="${i}" style="border-color:${rarCol(it)}"><span><img alt="" src="${iconFor(it)}">${Items.name(it)}</span><span style="color:${rarCol(it)}">${Items.RAR[Items.rarOf(it)].name}</span></button>`).join(""):`<div class="empty">Empty.</div>`;
    $("dfacts").innerHTML=contractRows(p);
    const dl=$("dlog"); dl.innerHTML=logHTML(60); dl.scrollTop=dl.scrollHeight;
    $("t-ext").disabled=!onPad; $("t-ext").hidden=!onPad; $("t-air").classList.toggle("on",overlay); $("t-light").classList.toggle("on",!!p.light&&!p.lightOff);
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
  if(VIS[i]){ const e=Sim.entAt(S,x,y); if(e&&e.kind==="raider"){ const at=attOf(e), F=Sim.FACTIONS[e.fac]; s=`<b style="color:${ATT_COL[at]}">${esc(e.name)}</b> · ${F.name}`; sub=`${e.surr?"Surrendered · F to search":at[0].toUpperCase()+at.slice(1)} · ${Items.name(Sim.gun(e)||e.melee||{d:"knife"})} · ${Math.round(Sim.hitChance(S,p,x,y)*100)}% to hit`; }
    else if(e&&e.kind==="bot"){ const hos=Sim.botHostile(S,e,p); s=`<b style="color:${hos?"#e0482f":"#7cc46a"}">${e.type==="turret"?"Turret":"Security drone"}</b> · ${Math.round(Sim.hitChance(S,p,x,y)*100)}% to hit`; sub=!S.power?"Offline (no station power)":hos?"Hostile · cut the power to shut it down":"Friendly to you"; }
    else if(e&&e.kind==="husk"&&e.type&&e.type!=="husk"){ const T0=Sim.HTYPES[e.type], hurt=Sim.LIMBS.filter(l=>e.hp[l]<e.max[l]).length; s=`<b>${T0.name[0].toUpperCase()+T0.name.slice(1)}</b> · ${Math.round(Sim.hitChance(S,p,x,y)*100)}% to hit`; sub={stalker:"Fast, fragile, hunts in packs",brute:"Armoured. Smashes doors. Hits hard enough to floor you",spitter:"Spits burning acid from range",matriarch:"The nest's queen. Her roar staggers and calls stalkers"}[e.type]+(hurt?" · wounded":""); }
    else if(e&&e.kind==="husk"){ const hurt=Sim.LIMBS.filter(l=>e.hp[l]<e.max[l]).length; s=`<b>Husk</b> · ${Math.round(Sim.hitChance(S,p,x,y)*100)}% to hit`; sub=hurt?"Wounded":"Unharmed"; }
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
function targetable(x,y){ if(!VIS||x<0||y<0||x>=S.W||y>=S.H) return false; const i=Sim.idx(S,x,y); if(!VIS[i]) return false; const e=Sim.entAt(S,x,y); const t=S.tiles[i]; return (e&&(e.kind==="husk"||e.kind==="raider"||e.kind==="bot"))||t.t==="window"||(t.t==="prop"&&t.kind==="barrel"); }
function send(a,keepTravel){ if(!S||S.status!=="playing") return false; if(!keepTravel) stopTravel();
  if(S.mode==="raid"&&typeof inSquad==="function"&&inSquad()){ if(a.type==="move"&&typeof tutMoved!=="undefined") tutMoved++; return netRaidAction(a); }
  const ok=Sim.act(S,PID,a); afterChange();
  if(ok&&a.type==="move"&&typeof tutMoved!=="undefined") tutMoved++;
  if(ok&&typeof Snd!=="undefined"){ if(a.type==="move") Snd.play("step"); else if(a.type==="pickup") Snd.play("pickup"); else if(a.type==="use") Snd.play("heal"); else if(a.type==="loot") Snd.play("pickup"); } if(S.mode==="ship"&&a.type==="move"&&typeof netShipMoved==="function") netShipMoved(); return ok; }
function note(msg){ S.log.push({t:S.turn,msg,kind:"info"}); renderPanels(); }
function nearestHusk(){ const p=me(); let best=null,bd=1e9; for(const e of S.ents){ if(!(e.kind==="husk"||(e.kind==="bot"&&S.power&&Sim.botHostile(S,e,p))||(e.kind==="raider"&&attOf(e)==="hostile"&&!e.surr))||!e.alive||!VIS[Sim.idx(S,e.x,e.y)]) continue; const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<bd){bd=d;best=e;} } return best; }
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
const visHusks=()=>S.ents.filter(e=>(e.kind==="husk"||(e.kind==="bot"&&S.power&&Sim.botHostile(S,e,me()))||(e.kind==="raider"&&attOf(e)==="hostile"&&!e.surr))&&e.alive&&VIS[Sim.idx(S,e.x,e.y)]).map(e=>e.id);
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
  if(!$("menu").hidden){ if(e.key==="Enter"){ e.preventDefault(); $("m-play").click(); } return; }
  if(!$("panel").hidden){ const kk=e.key.toLowerCase(); if((kk==="escape"||((kk==="i"||kk==="tab")&&panelKind==="inventory"))&&typeof closePanel==="function"){ e.preventDefault(); closePanel(); } return; }
  if(mode!=="pc") return;
  const k=e.key.toLowerCase(), mv={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[k];
  if(mv){ e.preventDefault(); send({type:"move",dx:mv[0],dy:mv[1]}); return; }
  if(k===" "||k==="."){ e.preventDefault(); send({type:"wait"}); return; }
  if(k==="escape"){ stopTravel(); return; }
  if(k==="r"&&S.mode==="raid"){ send({type:"swap"}); return; }
  if(k==="l"){ toggleLight(); return; }
  if(k==="m"&&typeof Snd!=="undefined"){ const on=Snd.toggle(); note(on?"Sound on.":"Sound muted. Press M to turn it back on."); return; }
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
function setPadMode(off){ document.body.dataset.pad=off?"off":"on"; try{ localStorage.setItem("hb-pad",off?"off":"on"); }catch(e){} $("t-padmode").textContent=off?"Show d-pad":"Hide d-pad (tap to move)"; }
$("t-padmode").onclick=()=>setPadMode(document.body.dataset.pad!=="off");
try{ setPadMode(localStorage.getItem("hb-pad")==="off"); }catch(e){ setPadMode(false); }
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
function toggleLight(){ if(!S) return; const p=me(); if(!p||!p.light){ toast("No light equipped. Put a flashlight in your Light slot from your kit."); return; }
  if(S.mode==="raid") send({type:"light"}); else { p.lightOff=!p.lightOff; computeLights(); renderPanels(); toast(p.lightOff?"Light off.":"Light on."); } }
$("b-light").onclick=toggleLight; $("t-light").onclick=toggleLight;
$("b-help").onclick=()=>{ $("help").hidden=!$("help").hidden; };
$("b-new").onclick=()=>armAbandon($("b-new"),"Abandon");

function setMode(m){ mode=m; document.body.dataset.mode=m; try{ localStorage.setItem("hb-mode",m); }catch(e){} target=null; hover=null; stopTravel(); camInit=false; resize(); if(S) renderPanels(); }
