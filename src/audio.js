// ============================ SOUND ============================
// Everything here is synthesised with WebAudio at runtime: no audio files.
// Snd.play(name, {x,y}) for one-shots (panned and muffled by distance and line of
// sight from whoever you're viewing), Snd.scene(state) every frame for the
// ambience bed (station hum, dark rumble, fire, ship engines) and music.
const Snd = (() => {
  let ctx = null, master, sfx, mus, amb, noiseBuf = null, unlocked = false;
  const LS = "hb-sound"; let S0 = { vol: .8, music: .5, on: true };
  try { const v = JSON.parse(localStorage.getItem(LS) || "null"); if (v) S0 = { ...S0, ...v }; } catch (e) {}
  const saveCfg = () => { try { localStorage.setItem(LS, JSON.stringify(S0)); } catch (e) {} };
  const last = {};
  let listener = null; // {x,y,see(x,y)}
  function init() {
    if (ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = S0.on ? S0.vol : 0; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(comp);
    amb = ctx.createGain(); amb.gain.value = .55; amb.connect(comp);
    mus = ctx.createGain(); mus.gain.value = S0.music; mus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function unlock() { init(); if (ctx && ctx.state === "suspended") ctx.resume(); unlocked = true; }
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => window.addEventListener(ev, unlock, { capture: true, passive: true }));
  // ---- building blocks ----
  const T = () => ctx.currentTime;
  function env(g, t, a, peak, d, end = .0001) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  function tone(dest, { type = "sine", f = 440, f1 = null, t = 0, a = .005, d = .2, v = .3, det = 0 }) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, T() + t); if (det) o.detune.value = det;
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), T() + t + a + d); env(g, T() + t, a, v, d); o.connect(g); g.connect(dest); o.start(T() + t); o.stop(T() + t + a + d + .05); return o; }
  function noise(dest, { t = 0, a = .003, d = .2, v = .3, type = "lowpass", f = 2000, f1 = null, q = .8, rate = 1 }) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.playbackRate.value = rate; s.loop = true;
    fl.type = type; fl.frequency.setValueAtTime(f, T() + t); fl.Q.value = q; if (f1) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), T() + t + a + d);
    env(g, T() + t, a, v, d); s.connect(fl); fl.connect(g); g.connect(dest); const off = Math.random() * 1.5; s.start(T() + t, off); s.stop(T() + t + a + d + .05); }
  // where a sound sits: distance falloff, stereo pan, and a low-pass when it's behind walls
  function place(o) {
    const out = ctx.createGain(); let vol = 1, pan = 0, muf = 22000;
    if (o && o.x != null && listener) { const dx = o.x - listener.x, dy = o.y - listener.y, d = Math.hypot(dx, dy);
      vol = Math.max(0, 1 - d / (o.r || 18)); vol = vol * vol; pan = Math.max(-.8, Math.min(.8, dx / 9));
      if (listener.see && !listener.see(o.x, o.y)) { muf = 900; vol *= .7; } }
    if (vol < .02) return null; out.gain.value = vol * (o && o.v != null ? o.v : 1);
    let node = out; if (muf < 20000) { const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = muf; lp.connect(node); node = lp; }
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(node); node = p; }
    out.connect(sfx); return node;
  }
  const R = (a, b) => a + Math.random() * (b - a);
  // ---- the sounds ----
  const LIB = {
    pistol: (n) => { noise(n, { d: .12, v: .7, f: 3200, f1: 500 }); tone(n, { type: "square", f: 160, f1: 50, d: .09, v: .25 }); },
    smg: (n) => { for (let k = 0; k < 3; k++) { noise(n, { t: k * .07, d: .07, v: .5, f: 3600, f1: 700 }); tone(n, { t: k * .07, type: "square", f: 180, f1: 70, d: .05, v: .15 }); } },
    rifle: (n) => { noise(n, { d: .16, v: .8, type: "highpass", f: 900, f1: 300 }); noise(n, { d: .25, v: .5, f: 900, f1: 120 }); tone(n, { f: 110, f1: 40, d: .18, v: .45 }); },
    shotgun: (n) => { noise(n, { d: .38, v: 1, f: 2200, f1: 200 }); tone(n, { f: 85, f1: 32, d: .3, v: .7 }); noise(n, { t: .25, d: .12, v: .12, type: "bandpass", f: 1800 }); },
    sniper: (n) => { noise(n, { d: .05, v: 1, type: "highpass", f: 2500 }); noise(n, { d: .7, v: .7, f: 700, f1: 80 }); tone(n, { f: 70, f1: 28, d: .5, v: .7 }); },
    launcher: (n) => { noise(n, { d: .6, v: .6, type: "bandpass", f: 400, f1: 2400, q: 2 }); tone(n, { f: 60, f1: 40, d: .3, v: .4 }); },
    turret: (n) => { tone(n, { type: "square", f: 1800, d: .04, v: .15 }); noise(n, { t: .05, d: .1, v: .55, type: "highpass", f: 1400, f1: 400 }); },
    explode: (n) => { noise(n, { a: .01, d: 1.4, v: 1, f: 1400, f1: 60 }); tone(n, { f: 55, f1: 22, a: .01, d: 1.1, v: .9 }); noise(n, { t: .1, d: 1.2, v: .25, type: "highpass", f: 3000, f1: 800 }); },
    melee: (n) => { noise(n, { d: .09, v: .5, type: "bandpass", f: 700, q: 1.5 }); tone(n, { f: 130, f1: 60, d: .12, v: .45 }); },
    claw: (n) => { noise(n, { d: .16, v: .55, type: "highpass", f: 3000, f1: 1200 }); noise(n, { t: .06, d: .1, v: .3, type: "bandpass", f: 900 }); },
    shriek: (n) => { const f = R(800, 1000); for (const det of [0, 30, -45]) tone(n, { type: "sawtooth", f, f1: f * 1.6, a: .05, d: .75, v: .12, det }); noise(n, { d: .6, v: .15, type: "bandpass", f: 2500, q: 3 }); },
    growl: (n) => { for (const det of [0, 25]) tone(n, { type: "sawtooth", f: R(55, 75), f1: R(45, 55), a: .1, d: .9, v: .14, det }); noise(n, { d: .8, v: .12, f: 300 }); },
    chitter: (n) => { for (let k = 0; k < 6; k++) tone(n, { t: k * .045, type: "square", f: R(2200, 3200), d: .02, v: .1 }); },
    stomp: (n) => { tone(n, { f: 62, f1: 30, d: .28, v: .8 }); noise(n, { d: .2, v: .4, f: 220 }); },
    spit: (n) => { noise(n, { d: .12, v: .45, type: "bandpass", f: 1500, q: 2 }); tone(n, { t: .04, f: 320, f1: 110, d: .14, v: .3 }); },
    roar: (n) => { for (const det of [0, 18, -22]) tone(n, { type: "sawtooth", f: 70, f1: 42, a: .15, d: 1.6, v: .2, det }); noise(n, { a: .1, d: 1.5, v: .3, f: 380, f1: 160 }); },
    door: (n) => { noise(n, { a: .02, d: .38, v: .3, type: "bandpass", f: 1200, f1: 500, q: 1.2 }); tone(n, { type: "triangle", f: 210, f1: 170, a: .02, d: .3, v: .12 }); },
    bash: (n) => { tone(n, { f: 95, f1: 45, d: .2, v: .7 }); tone(n, { f: R(320, 380), d: .45, v: .12 }); tone(n, { f: R(510, 560), d: .35, v: .08 }); },
    glass: (n) => { noise(n, { d: .3, v: .4, type: "highpass", f: 3500 }); for (let k = 0; k < 5; k++) tone(n, { t: k * .03, f: R(2400, 4800), d: .15, v: .07 }); },
    breach: (n) => { noise(n, { a: .05, d: 2.4, v: .7, f: 700, f1: 200 }); },
    step: (n) => { noise(n, { d: .035, v: .1, f: R(500, 800) }); },
    pickup: (n) => { tone(n, { f: 620, f1: 980, d: .08, v: .18 }); tone(n, { t: .06, f: 1240, d: .06, v: .08 }); },
    search: (n) => { for (let k = 0; k < 3; k++) noise(n, { t: k * .11, d: .08, v: .25, type: "bandpass", f: R(900, 1600), q: 1.4 }); tone(n, { t: .32, f: 140, f1: 90, d: .1, v: .2 }); },
    hurt: (n) => { noise(n, { d: .14, v: .45, f: 1100, f1: 300 }); tone(n, { type: "square", f: 190, f1: 120, d: .14, v: .12 }); },
    die: (n) => { tone(n, { f: 210, f1: 38, a: .02, d: .9, v: .35 }); noise(n, { d: .6, v: .2, f: 500, f1: 90 }); },
    spark: (n) => { for (let k = 0; k < 4; k++) noise(n, { t: k * .03, d: .025, v: .35, type: "highpass", f: 4500 }); tone(n, { type: "square", f: 1300, f1: 600, d: .07, v: .1 }); },
    robot: (n) => { tone(n, { type: "square", f: 600, f1: 300, d: .12, v: .12 }); tone(n, { t: .08, type: "square", f: 900, d: .06, v: .08 }); },
    klaxon: (n) => { for (let k = 0; k < 3; k++) { tone(n, { t: k * .7, type: "sawtooth", f: 440, f1: 330, a: .02, d: .55, v: .14 }); tone(n, { t: k * .7, type: "square", f: 220, f1: 165, a: .02, d: .55, v: .05 }); } },
    horn: (n) => { for (const det of [0, 12, -15]) tone(n, { type: "sawtooth", f: 58, f1: 46, a: .4, d: 2.4, v: .16, det }); noise(n, { a: .3, d: 2.2, v: .2, f: 300, f1: 120 }); },
    meow: (n) => { tone(n, { type: "triangle", f: R(620, 700), f1: R(900, 1000), a: .03, d: .14, v: .14 }); tone(n, { t: .13, type: "triangle", f: 950, f1: 520, d: .28, v: .12 }); },
    purr: (n) => { for (let k = 0; k < 10; k++) noise(n, { t: k * .09, a: .02, d: .07, v: .18, f: 180 }); },
    weld: (n) => { noise(n, { a: .02, d: .9, v: .3, type: "highpass", f: 2500 }); for (let k = 0; k < 8; k++) noise(n, { t: k * .1, d: .03, v: .3, type: "highpass", f: 5000 }); tone(n, { type: "sawtooth", f: 90, d: .9, v: .04 }); },
    vent: (n) => { for (let k = 0; k < 5; k++) tone(n, { t: k * .12, type: "square", f: R(120, 180), f1: 80, d: .08, v: .12 }); noise(n, { d: .7, v: .12, type: "bandpass", f: 600, q: 1.5 }); },
    tick: (n) => { tone(n, { type: "square", f: 1800, d: .03, v: .12 }); tone(n, { t: .05, type: "square", f: 1400, d: .03, v: .08 }); },
    geiger: (n) => { noise(n, { d: .008, v: .25, type: "highpass", f: 3000 }); },
    takedown: (n) => { noise(n, { d: .12, v: .5, f: 600, f1: 150 }); tone(n, { f: 110, f1: 50, d: .2, v: .4 }); noise(n, { t: .08, d: .2, v: .25, type: "bandpass", f: 900, q: 2 }); },
    casing: (n) => { tone(n, { f: R(3200, 4200), d: .06, v: .05 }); tone(n, { t: .05, f: R(2600, 3400), d: .05, v: .03 }); },
    hull: (n) => { tone(n, { type: "triangle", f: R(500, 700), d: .06, v: .06 }); noise(n, { d: .03, v: .05, type: "bandpass", f: 1200 }); },
    pump: (n) => { noise(n, { d: .06, v: .3, type: "bandpass", f: 900, q: 2 }); tone(n, { f: 180, f1: 120, d: .05, v: .15 }); noise(n, { t: .12, d: .07, v: .35, type: "bandpass", f: 1300, q: 2 }); tone(n, { t: .12, f: 220, f1: 150, d: .05, v: .15 }); },
    bolt: (n) => { noise(n, { d: .05, v: .3, type: "bandpass", f: 1600, q: 3 }); tone(n, { t: .1, type: "square", f: 300, f1: 200, d: .04, v: .08 }); noise(n, { t: .16, d: .05, v: .3, type: "bandpass", f: 1900, q: 3 }); },
    ricochet: (n) => { tone(n, { type: "sine", f: R(2400, 3200), f1: R(900, 1400), d: .28, v: .07 }); },
    beep: (n) => { tone(n, { type: "square", f: 1500, d: .05, v: .1 }); },
    click: (n) => { tone(n, { f: 1300, d: .025, v: .07 }); },
    open: (n) => { tone(n, { type: "triangle", f: 280, f1: 560, d: .12, v: .12 }); },
    toast: (n) => { tone(n, { f: 880, d: .07, v: .08 }); tone(n, { t: .07, f: 1320, d: .09, v: .07 }); },
    radio: (n) => { noise(n, { d: .05, v: .2, type: "bandpass", f: 2400, q: 3 }); tone(n, { t: .02, type: "square", f: 1100, d: .03, v: .05 }); },
    synth: (n) => { const k = 3 + (Math.random() * 3 | 0); for (let i = 0; i < k; i++) tone(n, { t: i * .07, type: "square", f: R(300, 900), d: .05, v: .07 }); },
    holo: (n) => { noise(n, { d: .6, v: .2, type: "bandpass", f: 3000, q: .6 }); tone(n, { type: "triangle", f: 180, f1: 900, a: .05, d: .6, v: .1 }); },
    powerdown: (n) => { tone(n, { type: "sawtooth", f: 140, f1: 25, a: .02, d: 1.4, v: .25 }); noise(n, { d: .4, v: .25, f: 600 }); },
    powerup: (n) => { tone(n, { type: "sawtooth", f: 30, f1: 160, a: .02, d: 1.2, v: .22 }); tone(n, { t: 1, f: 880, d: .12, v: .08 }); },
    stinger: (n) => { for (const f of [73, 110, 146]) tone(n, { type: "sawtooth", f, a: .02, d: 1.2, v: .08 }); noise(n, { d: .8, v: .1, f: 400 }); },
    legend: (n) => { [523, 659, 784, 1047].forEach((f, i) => tone(n, { t: i * .09, type: "triangle", f, d: .4, v: .1 })); },
    levelup: (n) => { [392, 523, 659, 784].forEach((f, i) => tone(n, { t: i * .12, type: "triangle", f, d: .6, v: .12 })); },
    coin: (n) => { tone(n, { f: 1046, d: .08, v: .1 }); tone(n, { t: .07, f: 1568, d: .14, v: .09 }); },
    heal: (n) => { noise(n, { d: .25, v: .15, type: "bandpass", f: 1800, q: 2 }); tone(n, { t: .1, f: 520, f1: 780, d: .2, v: .07 }); },
  };
  function play(name, o) {
    if (!ctx || !S0.on || !LIB[name]) return; const now = performance.now(); if (now - (last[name] || 0) < 35) return; last[name] = now;
    try { const n = place(o); if (n) LIB[name](n); } catch (e) {}
  }
  // ---- ambience and music beds ----
  const bed = {};
  function loop(name, make) { if (bed[name]) return bed[name]; const g = ctx.createGain(); g.gain.value = 0; g.connect(name === "music" ? mus : amb); make(g); bed[name] = g; return g; }
  function hum(g) { for (const [f, v] of [[55, .14], [110, .06], [165, .025]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f; og.gain.value = v; o.connect(og); og.connect(g); o.start(); }
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), ng = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; fl.type = "bandpass"; fl.frequency.value = 2200; fl.Q.value = .4; ng.gain.value = .03; s.connect(fl); fl.connect(ng); ng.connect(g); s.start(); }
  function rumble(g) { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = .5; fl.type = "lowpass"; fl.frequency.value = 140; s.connect(fl); fl.connect(g); s.start();
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 38; og.gain.value = .3; o.connect(og); og.connect(g); o.start(); }
  function engine(g) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "triangle"; o.frequency.value = 42; og.gain.value = .25; o.connect(og); og.connect(g); o.start();
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(); s.buffer = noiseBuf; s.loop = true; fl.type = "lowpass"; fl.frequency.value = 260; s.connect(fl); fl.connect(g); s.start(); }
  function crackle(g) { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain(), vg = ctx.createGain(); s.buffer = noiseBuf; s.loop = true;
    fl.type = "bandpass"; fl.frequency.value = 1400; fl.Q.value = .7; lfo.frequency.value = 13; lg.gain.value = .5; vg.gain.value = .5; lfo.connect(lg); lg.connect(vg.gain); s.connect(fl); fl.connect(vg); vg.connect(g); s.start(); lfo.start(); }
  function wind(g) { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(); s.buffer = noiseBuf; s.loop = true; fl.type = "bandpass"; fl.frequency.value = 500; fl.Q.value = .5; s.connect(fl); fl.connect(g); s.start(); }
  function pad(g) { // slow minor drone for the menu and the ship
    for (const [f, det] of [[55, 0], [55, 8], [82.4, -6], [110, 4]]) { const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), og = ctx.createGain(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det; fl.type = "lowpass"; fl.frequency.value = 420; og.gain.value = .05; o.connect(fl); fl.connect(og); og.connect(g); o.start(); } }
  const SCALE = [220, 261.6, 293.7, 329.6, 392, 440, 523.3]; let nextBell = 0, nextCreak = 0, lastDanger = false, heat = 0, nextBeat = 0, beatN = 0;
  function setG(g, v, tc = .8) { g.gain.setTargetAtTime(v, T(), tc); }
  // st: {scene:"menu"|"ship"|"raid", power, fire (0..1), breach, danger}
  function scene(st) {
    if (!ctx || !unlocked) return;
    const raid = st.scene === "raid", menu = st.scene === "menu";
    setG(loop("hum", hum), raid && st.power ? .5 : 0); setG(loop("rumble", rumble), raid ? (st.power ? .12 : .45) : 0);
    setG(loop("engine", engine), st.scene === "ship" ? .35 : 0); setG(loop("fire", crackle), raid ? Math.min(.6, st.fire || 0) : 0, .4); setG(loop("wind", wind), raid && st.breach ? .5 : 0, .3);
    setG(loop("music", pad), menu ? .9 : st.scene === "ship" ? .45 : 0, 1.5);
    const now = T();
    if ((menu || st.scene === "ship") && now > nextBell) { nextBell = now + R(2.6, 5); const f = SCALE[Math.random() * SCALE.length | 0] * (Math.random() < .3 ? .5 : 1); tone(mus, { type: "triangle", f, a: .02, d: 3.2, v: menu ? .08 : .04 }); tone(mus, { type: "sine", f: f * 2.01, a: .02, d: 2.2, v: menu ? .03 : .015 }); }
    if (raid && now > nextCreak) { nextCreak = now + R(st.power ? 9 : 4, st.power ? 20 : 10); const k = Math.random();
      if (k < .4) { tone(amb, { type: "sawtooth", f: R(70, 110), f1: R(50, 70), a: .3, d: 1.4, v: .05 }); } // hull groan
      else if (k < .7) { tone(amb, { f: R(1800, 2600), d: .25, v: .04 }); } // drip
      else noise(amb, { a: .2, d: 1.2, v: .06, type: "bandpass", f: R(300, 700), q: 3 }); } // vent breath
    if (raid && st.danger && !lastDanger) play("stinger"); lastDanger = raid && !!st.danger;
    const want = raid ? Math.min(1, (st.threat || 0) / 4) : 0; heat += (want - heat) * (want > heat ? .5 : .08);
    if (heat > .05 && S0.music > 0) { while (nextBeat < now + .4) { if (nextBeat < now) nextBeat = now + .02; const step = beatN++ % 8, v = heat * S0.music * 1.4;
        if (step % 4 === 0) { tone(mus, { t: nextBeat - now, f: 62, f1: 30, d: .28, v: .35 * v }); }
        if (step % 4 === 2 && heat > .35) noise(mus, { t: nextBeat - now, d: .1, v: .18 * v, type: "bandpass", f: 1800, q: .8 });
        if (heat > .55) noise(mus, { t: nextBeat - now, d: .03, v: .06 * v, type: "highpass", f: 6000 });
        const bass = [55, 55, 65.4, 55, 49, 55, 73.4, 65.4][step]; tone(mus, { t: nextBeat - now, type: "sawtooth", f: bass, d: .2, v: .07 * v });
        nextBeat += heat > .6 ? .2 : .26; } } else nextBeat = now;
  }
  function setListener(l) { listener = l; }
  function cfg() { return { ...S0 }; }
  function setVol(v) { S0.vol = Math.max(0, Math.min(1, v)); S0.on = S0.vol > 0; if (master) master.gain.setTargetAtTime(S0.on ? S0.vol : 0, T(), .05); saveCfg(); }
  function setMusic(v) { S0.music = Math.max(0, Math.min(1, v)); if (mus) mus.gain.setTargetAtTime(S0.music, T(), .05); saveCfg(); }
  function toggle() { S0.on = !S0.on; if (S0.on && !S0.vol) S0.vol = .8; if (master) master.gain.setTargetAtTime(S0.on ? S0.vol : 0, T(), .05); saveCfg(); return S0.on; }
  function selfTest(){ unlock(); const bad=[]; for(const k of Object.keys(LIB)){ try{ LIB[k](sfx); }catch(e){ bad.push(k+': '+e.message); } } try{ for(const sc of ['menu','ship','raid']) scene({scene:sc,power:sc==='raid',fire:.5,breach:true,danger:true}); }catch(e){ bad.push('scene: '+e.message); } return {n:Object.keys(LIB).length,bad,state:ctx&&ctx.state}; }
  return { play, scene, setListener, cfg, setVol, setMusic, toggle, unlock, selfTest };
})();
