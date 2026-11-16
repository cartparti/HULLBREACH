// ============================ APP TRANSPORT =========================
// Outside claude.ai there is no `room` capability, so the app connects to
// the Hullbreach relay (server/index.mjs) and gets the same interface:
// a lobby room with join(name) for squads, presence, emit/on, onPeers.
// Identity is a random id kept on the device plus a callsign the player picks.
const HB = {
  serverUrl(){ let u=""; try{ const q=new URLSearchParams(location.search).get("server"); if(q){ localStorage.setItem("hb-server",q); } u=localStorage.getItem("hb-server")||""; }catch(e){}
    return u||(typeof window.HB_SERVER==="string"?window.HB_SERVER:""); },
  setServer(u){ try{ localStorage.setItem("hb-server",u); }catch(e){} },
  playerId(){ let id=null; try{ id=localStorage.getItem("hb-player"); }catch(e){} if(!id||!/^[A-Za-z0-9_-]{4,64}$/.test(id)){ id="a_"+Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>(b%36).toString(36)).join(""); try{ localStorage.setItem("hb-player",id); }catch(e){} } return id; },
  callsign(){ let n=""; try{ n=localStorage.getItem("hb-callsign")||""; }catch(e){} return n||("Contractor-"+HB.playerId().slice(-4).toUpperCase()); },
  setCallsign(n){ n=String(n||"").replace(/[^\p{L}\p{N} _.'-]/gu,"").trim().slice(0,20); if(!n) return; try{ localStorage.setItem("hb-callsign",n); }catch(e){} if(HB.live) HB.live.rename(n); },
  live:null,
};
function wsTransport(url){
  return new Promise(resolve=>{
    let ws, myPeer=null, done=false, name=HB.callsign(); const myId=HB.playerId(), rooms={}, names={};
    const finish=v=>{ if(!done){ done=true; resolve(v); } };
    const send=o=>{ if(ws&&ws.readyState===1) ws.send(JSON.stringify(o)); };
    function makeRoom(rn){
      const R={peers:Object.freeze([]),ph:[],mh:{}}; rooms[rn]=R;
      const api={ name:rn,
        emit:(topic,data)=>{ if(JSON.stringify(data??null).length>4096) return Promise.reject({code:"invalid_argument",message:"Message too large"}); send({op:"emit",room:rn,topic,data}); return Promise.resolve(); },
        on:(topic,fn)=>{ (R.mh[topic]=R.mh[topic]||[]).push(fn); return ()=>{ R.mh[topic]=(R.mh[topic]||[]).filter(f=>f!==fn); }; },
        presence:(patch)=>{ send({op:"presence",room:rn,patch:{...patch,nm:name}}); return Promise.resolve(); },
        peers:()=>R.peers,
        onPeers:(fn)=>{ R.ph.push(fn); if(R.peers.length) setTimeout(()=>fn({peers:R.peers,joined:R.peers,left:[],updated:[]}),0); return ()=>{ R.ph=R.ph.filter(f=>f!==fn); }; },
        connected:()=>!!ws&&ws.readyState===1, onConnection:()=>()=>{},
        leave:()=>{ send({op:"leave",room:rn}); delete rooms[rn]; return Promise.resolve(); },
      };
      R.api=api; send({op:"join",room:rn}); send({op:"presence",room:rn,patch:{nm:name}}); return api;
    }
    const user={ id:async()=>myId, me:async()=>({id:myId,name}), profiles:async(ids)=>Object.fromEntries(ids.map(i=>[i,{id:i,name:i===myId?name:(names[i]||"")}])) };
    try{ ws=new WebSocket(url); }catch(e){ finish(null); return; }
    const timer=setTimeout(()=>{ finish(null); try{ ws.close(); }catch(e){} },7000);
    ws.onopen=()=>send({op:"hello",id:myId,name});
    ws.onerror=()=>{ clearTimeout(timer); finish(null); };
    ws.onclose=()=>{ clearTimeout(timer); if(!done) return finish(null); HB.live=null; if(typeof onTransportLost==="function") onTransportLost(); };
    ws.onmessage=e=>{
      let m; try{ m=JSON.parse(e.data); }catch(err){ return; }
      if(m.op==="welcome"){ clearTimeout(timer); myPeer=m.peer; const lobby=makeRoom(""); lobby.join=n=>Promise.resolve(rooms[n]?rooms[n].api:makeRoom(n));
        HB.live={ rename(n){ name=n; for(const rn of Object.keys(rooms)) send({op:"presence",room:rn,patch:{nm:n}}); } };
        finish({room:lobby,user}); return; }
      if(m.op==="peers"){ const R=rooms[m.room]; if(!R) return; const prev=new Map(R.peers.map(p=>[p.peer,p]));
        const now=Object.freeze(m.peers.map(p=>{ if(p.by&&p.presence&&typeof p.presence.nm==="string") names[p.by]=p.presence.nm.slice(0,20);
          const old=prev.get(p.peer), same=old&&JSON.stringify(old.presence)===JSON.stringify(p.presence);
          return same?old:Object.freeze({peer:p.peer,by:p.by,presence:Object.freeze(p.presence||{}),isMe:p.by===myId,sameTab:p.peer===myPeer,kind:"viewer",guest:false,updatedAt:Date.now()}); }));
        const joined=now.filter(p=>!prev.has(p.peer)), left=R.peers.filter(p=>!now.some(q=>q.peer===p.peer)), updated=now.filter(p=>prev.has(p.peer)&&prev.get(p.peer)!==p);
        R.peers=now; for(const f of R.ph) f({peers:now,joined,left,updated}); return; }
      if(m.op==="msg"){ const R=rooms[m.room]; if(!R) return; const msg={...m.msg,isMe:m.msg.by===myId,sameTab:m.msg.peer===myPeer,kind:"viewer",guest:false};
        for(const f of (R.mh[msg.topic]||[])) f(msg); return; }
    };
  });
}
function onTransportLost(){ Net.avail=false; Net.room=null; if(Net.sq) leaveSquad("Lost connection to the squad server."); if(panelKind==="crew") renderPanel(); }
