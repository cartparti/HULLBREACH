// =====================================================================
// GEN — procedural derelict stations. Pure and deterministic: the same
// seed builds the same station on every page (squads stay in lockstep).
// Returns {rows, rooms, spawn, loot, husks, decals} for Sim.newGame.
// =====================================================================
const Gen = (() => {
  function rng32(seed) { let s = seed | 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const TYPES = {
    medbay:   { name: "Medbay", w: 2 },
    crew:     { name: "Crew quarters", w: 3 },
    security: { name: "Security office", w: 1, max: 2 },
    captain:  { name: "Captain's cabin", w: 0, max: 1 },
    engineering: { name: "Engineering", w: 0, max: 1 },
    cargo:    { name: "Cargo hold", w: 3 },
    lab:      { name: "Xenolab", w: 1.2 },
    fuel:     { name: "Fuel storage", w: 1 },
    armory:   { name: "Armory", w: 1, max: 2 },
    shrine:   { name: "Shrine", w: .7, max: 1 },
    mess:     { name: "Mess hall", w: 1.2, max: 2 },
    workshop: { name: "Workshop", w: 1, max: 2 },
    vault:    { name: "Vault", w: 0, max: 1 },
  };

  function station(seed, o = {}) {
    const R = rng32(seed ^ 0x5bd1e995), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = (p) => R() < p, pick = (a) => a[Math.floor(R() * a.length)];
    const tier = o.tier || 1, SZ = { small: [[44, 50], [30, 34]], medium: [[54, 64], [36, 42]], large: [[66, 74], [42, 48]] }[o.size] || [[54, 64], [36, 42]], W = ri(SZ[0][0], SZ[0][1]), H = ri(SZ[1][0], SZ[1][1]);
    const G = Array.from({ length: H }, () => Array(W).fill("~"));
    const rooms = [], corridors = [];
    const inb = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
    const isInt = (c) => c !== "~" && c !== "#" && c !== "=" && c !== "+" && c !== "L";
    function fits(x0, y0, x1, y1) {
      if (x0 < 1 || y0 < 1 || x1 > W - 2 || y1 > H - 2 || x1 - x0 < 4 || y1 - y0 < 4) return false;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = G[y][x], edge = x === x0 || x === x1 || y === y0 || y === y1; if (edge ? isInt(c) : c !== "~") return false; }
      return true;
    }
    function carve(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const edge = x === x0 || x === x1 || y === y0 || y === y1; if (edge) { if (G[y][x] === "~") G[y][x] = "#"; } else G[y][x] = "."; } }
    function corridor(x0, y0, x1, y1, name) { carve(x0, y0, x1, y1); corridors.push({ x0, y0, x1, y1, name }); rooms.push([name, x0 + 1, y0 + 1, x1 - 1, y1 - 1]); }

    // ---- docking bay + main corridor ----
    const midY = Math.floor(H / 2) - 1, dockH = ri(9, 11), dockY0 = midY + 1 - Math.floor(dockH / 2), dockW = ri(10, 12);
    carve(1, dockY0, dockW, dockY0 + dockH);
    const dock = { type: "dock", name: "Docking bay", x0: 1, y0: dockY0, x1: dockW, y1: dockY0 + dockH, doors: [] };
    const mainX1 = W - ri(3, 6);
    corridor(dockW, midY, mainX1, midY + 3, "Main corridor");
    G[midY + 1][dockW] = "+"; G[midY + 2][dockW] = "+"; dock.doors.push([dockW, midY + 1], [dockW, midY + 2]);
    for (let y = midY + 1; y <= midY + 2; y++) for (let x = dockW + 1; x < mainX1; x++) G[y][x] = ".";
    // ---- branch corridors (up and/or down) ----
    const branches = [];
    for (const dir of [-1, 1]) {
      if (!ch(.8)) continue;
      const cx = ri(dockW + 10, mainX1 - 12), len = ri(7, 10), y0 = dir < 0 ? midY - len : midY + 3, y1 = dir < 0 ? midY : midY + 3 + len;
      if (y0 < 4 || y1 > H - 5) continue;
      corridor(cx, y0, cx + 3, y1, "Service shaft");
      const yy = dir < 0 ? midY : midY + 3; G[yy][cx + 1] = "."; G[yy][cx + 2] = ".";
      for (let y = y0 + 1; y < y1; y++) { G[y][cx + 1] = "."; G[y][cx + 2] = "."; }
      const hy = dir < 0 ? y0 - 3 : y1, hx0 = Math.max(dockW + 2, cx - ri(8, 16)), hx1 = Math.min(W - 3, cx + 3 + ri(8, 16));
      if (hy > 1 && hy + 3 < H - 1) { corridor(hx0, hy, hx1, hy + 3, "Lower corridor"); const jy = dir < 0 ? hy + 3 : hy; G[jy][cx + 1] = "."; G[jy][cx + 2] = "."; for (let y = hy + 1; y <= hy + 2; y++) for (let x = hx0 + 1; x < hx1; x++) G[y][x] = "."; branches.push({ x0: hx0, y0: hy, x1: hx1, y1: hy + 3 }); }
    }
    // re-open every corridor interior (later corridors may have walled over earlier ones)
    for (const c of corridors) for (let y = c.y0 + 1; y < c.y1; y++) for (let x = c.x0 + 1; x < c.x1; x++) if (G[y][x] === "#") G[y][x] = ".";

    // ---- pack rooms along every corridor side ----
    function packAlong(c) {
      const horiz = c.x1 - c.x0 > c.y1 - c.y0;
      for (const side of [-1, 1]) {
        if (horiz) {
          let x = c.x0 + (c.name === "Main corridor" ? 1 : 0);
          while (x < c.x1 - 5) {
            let w = ri(7, 12), h = ri(6, 9), placed = false;
            for (let tries = 0; tries < 6 && !placed; tries++) {
              const x0 = x, x1 = Math.min(c.x1, x + w), y0 = side < 0 ? c.y0 - h : c.y1, y1 = side < 0 ? c.y0 : c.y1 + h;
              if (fits(x0, y0, x1, y1)) { carve(x0, y0, x1, y1); const wy = side < 0 ? y1 : y0, cy = wy + (side < 0 ? 1 : -1);
                const opts = []; for (let dx = x0 + 1; dx < x1; dx++) if (G[cy][dx] === "." && G[wy - (side < 0 ? 1 : -1)][dx] === ".") opts.push(dx);
                if (opts.length) { const dx = pick(opts); G[wy][dx] = "+"; rooms.push(["", x0 + 1, y0 + 1, x1 - 1, y1 - 1]); placed = true; roomsMeta.push({ x0, y0, x1, y1, doors: [[dx, wy]] }); x = x1; }
                else { for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) if (G[yy][xx] === "." || (G[yy][xx] === "#" && !(yy === wy))) { /* undo: leave */ } }
              }
              if (!placed) { h--; w--; if (h < 5 || w < 6) break; }
            }
            if (!placed) x += 3;
          }
        } else {
          let y = c.y0 + 1;
          while (y < c.y1 - 5) {
            let h = ri(6, 9), w = ri(7, 10), placed = false;
            for (let tries = 0; tries < 6 && !placed; tries++) {
              const y0 = y, y1 = Math.min(c.y1, y + h), x0 = side < 0 ? c.x0 - w : c.x1, x1 = side < 0 ? c.x0 : c.x1 + w;
              if (fits(x0, y0, x1, y1)) { carve(x0, y0, x1, y1); const wx = side < 0 ? x1 : x0, cx = wx + (side < 0 ? 1 : -1);
                const opts = []; for (let dy = y0 + 1; dy < y1; dy++) if (G[dy][cx] === "." && G[dy][wx - (side < 0 ? 1 : -1)] === ".") opts.push(dy);
                if (opts.length) { const dy = pick(opts); G[dy][wx] = "+"; rooms.push(["", x0 + 1, y0 + 1, x1 - 1, y1 - 1]); placed = true; roomsMeta.push({ x0, y0, x1, y1, doors: [[wx, dy]] }); y = y1; }
              }
              if (!placed) { h--; w--; if (h < 5 || w < 6) break; }
            }
            if (!placed) y += 3;
          }
        }
      }
    }
    const roomsMeta = [];
    for (const c of corridors) packAlong(c);
    // carving can stomp a corridor wall into floor at junctions: fix corridor interiors again
    for (const c of corridors) for (let y = c.y0 + 1; y < c.y1; y++) for (let x = c.x0 + 1; x < c.x1; x++) if (G[y][x] === "#") G[y][x] = ".";

    // ---- interconnecting doors between neighbouring rooms ----
    for (const a of roomsMeta) for (const b of roomsMeta) {
      if (a === b || !ch(.3)) continue;
      if (a.x1 === b.x0) { const ys = []; for (let y = Math.max(a.y0, b.y0) + 1; y < Math.min(a.y1, b.y1); y++) if (G[y][a.x1 - 1] === "." && G[y][a.x1 + 1] === ".") ys.push(y); if (ys.length) { const y = pick(ys); G[y][a.x1] = "+"; a.doors.push([a.x1, y]); b.doors.push([a.x1, y]); } }
      if (a.y1 === b.y0) { const xs = []; for (let x = Math.max(a.x0, b.x0) + 1; x < Math.min(a.x1, b.x1); x++) if (G[a.y1 - 1][x] === "." && G[a.y1 + 1][x] === ".") xs.push(x); if (xs.length) { const x = pick(xs); G[a.y1][x] = "+"; a.doors.push([x, a.y1]); b.doors.push([x, a.y1]); } }
    }

    // ---- room types ----
    const bfs = (sx, sy) => { const d = new Map([[sy * W + sx, 0]]), q = [[sx, sy]]; while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = ny * W + nx; if (!d.has(k) && inb(nx, ny) && G[ny][nx] !== "#" && G[ny][nx] !== "~" && G[ny][nx] !== "=") { d.set(k, d.get(y * W + x) + 1); q.push([nx, ny]); } } } return d; };
    const spawn = [Math.max(2, Math.min(dockW - 2, 5)), dockY0 + dockH - 2];
    const dist = bfs(spawn[0], spawn[1]);
    const meta = roomsMeta.map((m) => ({ ...m, area: (m.x1 - m.x0 - 1) * (m.y1 - m.y0 - 1), far: dist.get(((m.y0 + m.y1) >> 1) * W + ((m.x0 + m.x1) >> 1)) || 0 }));
    meta.sort((a, b) => b.far - a.far);
    const used = {}, assign = (m, t) => { m.type = t; used[t] = (used[t] || 0) + 1; };
    const single = meta.filter((m) => m.doors.length === 1);
    if (meta.length) assign(single[0] || meta[0], "vault");
    const rest = () => meta.filter((m) => !m.type);
    const mid = rest().sort((a, b) => Math.abs(a.far - meta[0].far / 2) - Math.abs(b.far - meta[0].far / 2));
    if (mid[0]) assign(mid[0], "engineering");
    const cap = rest().filter((m) => m.area >= 12); if (cap.length) assign(pick(cap), ch(.5) ? "captain" : "security");
    // what kind of station this is shifts which rooms it has
    const KW = { hospital: { medbay: 4, lab: 2.5, crew: 1.2, shrine: 1.4, cargo: .5, armory: .3, fuel: .4 }, mining: { cargo: 2.6, fuel: 3, workshop: 2.4, crew: 1.3, medbay: .5, lab: .2, shrine: .3 },
      fortress: { armory: 3.5, cargo: 1.6, workshop: 1.6, crew: 1.6, mess: 1.2, lab: .2, shrine: .2, medbay: .5 }, hive: { lab: 3.2, workshop: 2.2, fuel: 1.5, cargo: 1.2, crew: .15, mess: .1, shrine: .1 },
      outpost: { security: 3.5, armory: 2.2, crew: 1.6, mess: 1.2, lab: .4, shrine: .2 },
      research: { lab: 4, medbay: 1.6, workshop: 1.3, engineering: 1, crew: .6, cargo: .5, shrine: .1 }, freighter: { cargo: 4.5, fuel: 1.8, crew: 1, mess: 1, armory: .7, lab: .15, shrine: .2, medbay: .5 },
      colony: { crew: 3.6, mess: 2.6, shrine: 1.6, medbay: 1.3, workshop: 1, cargo: 1, armory: .3, lab: .3 } }[o.kind] || {};
    const MX = o.kind === "outpost" ? { security: 4, armory: 3 } : o.kind === "fortress" ? { armory: 4 } : o.kind === "hospital" ? { medbay: 5 } : o.kind === "colony" ? { mess: 3, shrine: 2 } : {};
    const wOf = (t, T) => T.w * (KW[t] == null ? 1 : KW[t]), maxOf = (t, T) => MX[t] || T.max;
    for (const m of rest()) { const pool = Object.entries(TYPES).filter(([t, T]) => wOf(t, T) > 0 && !(maxOf(t, T) && (used[t] || 0) >= maxOf(t, T))); let x = R() * pool.reduce((a, [t, T]) => a + wOf(t, T), 0); for (const [t, T] of pool) { if ((x -= wOf(t, T)) < 0) { assign(m, t); break; } } if (!m.type) assign(m, "cargo"); }
    // vault: keep only one door, maglocked
    const vault = meta.find((m) => m.type === "vault");
    if (vault) { vault.doors.forEach(([x, y], i) => { G[y][x] = i === 0 ? "L" : "#"; }); vault.doors = vault.doors.slice(0, 1); }
    // name rooms
    for (const m of meta) { const r = rooms.find((q) => q[1] === m.x0 + 1 && q[2] === m.y0 + 1); if (r) r[0] = TYPES[m.type].name; }
    rooms.unshift(["Docking bay", dock.x0 + 1, dock.y0 + 1, dock.x1 - 1, dock.y1 - 1]);

    // ---- windows on hull walls ----
    const allBoxes = [dock, ...meta, ...corridors];
    for (const m of allBoxes) {
      const cand = [];
      for (let x = m.x0 + 1; x < m.x1; x++) { if (G[m.y0][x] === "#" && m.y0 - 1 >= 0 && G[m.y0 - 1][x] === "~") cand.push([x, m.y0]); if (G[m.y1][x] === "#" && m.y1 + 1 < H && G[m.y1 + 1][x] === "~") cand.push([x, m.y1]); }
      for (let y = m.y0 + 1; y < m.y1; y++) { if (G[y][m.x0] === "#" && m.x0 - 1 >= 0 && G[y][m.x0 - 1] === "~") cand.push([m.x0, y]); if (G[y][m.x1] === "#" && m.x1 + 1 < W && G[y][m.x1 + 1] === "~") cand.push([m.x1, y]); }
      const n = m.type === "vault" ? 0 : Math.min(cand.length, ri(0, 3));
      for (let i = 0; i < n && cand.length; i++) { const [x, y] = cand.splice(Math.floor(R() * cand.length), 1)[0]; G[y][x] = "="; if (ch(.5) && cand.length) { const nb = cand.findIndex(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1); if (nb >= 0) { const [a, b] = cand.splice(nb, 1)[0]; G[b][a] = "="; } } }
    }

    // ---- contents ----
    const loot = [], husks = [], decals = [], fires = [];
    const isDoorAdj = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => "+L".includes(G[y + dy][x + dx]));
    const interior = (m) => { const a = []; for (let y = m.y0 + 1; y < m.y1; y++) for (let x = m.x0 + 1; x < m.x1; x++) if (G[y][x] === ".") a.push([x, y]); return a; };
    const edges = (m) => interior(m).filter(([x, y]) => (x === m.x0 + 1 || x === m.x1 - 1 || y === m.y0 + 1 || y === m.y1 - 1) && !isDoorAdj(x, y));
    const takeFrom = (arr) => arr.length ? arr.splice(Math.floor(R() * arr.length), 1)[0] : null;
    const putProps = (m, chars, n) => { const e = edges(m); for (let i = 0; i < n; i++) { const p = takeFrom(e); if (!p) break; G[p[1]][p[0]] = pick(chars); } };
    // ---- furniture that sits where it should ----
    const nearDoor = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2 && G[y + dy] && "+L".includes(G[y + dy][x + dx])) return true; return false; };
    const free = (x, y) => G[y] && G[y][x] === "." && !nearDoor(x, y) && !loot.some((l) => l.x === x && l.y === y) && !husks.some((h) => h[0] === x && h[1] === y);
    // along the back (top) wall, left to right, with an optional gap between pieces
    const backRow = (m, chars, n, gap = 0, from = "left") => { let xs = []; for (let x = m.x0 + 1; x < m.x1; x++) xs.push(x); if (from === "right") xs.reverse(); if (from === "mid") { const c = (m.x0 + m.x1) >> 1; xs.sort((a, b) => Math.abs(a - c) - Math.abs(b - c)); }
      let k = 0, skip = 0; for (const x of xs) { if (k >= n) break; if (skip) { skip--; continue; } if (free(x, m.y0 + 1)) { G[m.y0 + 1][x] = chars[k % chars.length]; k++; skip = gap; } } return k; };
    const sideCol = (m, chars, n, side = "left") => { const x = side === "left" ? m.x0 + 1 : m.x1 - 1; let k = 0; for (let y = m.y0 + 2; y < m.y1 && k < n; y++) if (free(x, y)) { G[y][x] = chars[k % chars.length]; k++; } return k; };
    // packed into a corner: nearest tiles to that corner first
    const corner = (m, chars, n, which) => { const cx = which.includes("r") ? m.x1 - 1 : m.x0 + 1, cy = which.includes("b") ? m.y1 - 1 : m.y0 + 1;
      const t = interior(m).filter(([x, y]) => free(x, y)).sort((a, b) => (Math.abs(a[0] - cx) + Math.abs(a[1] - cy)) - (Math.abs(b[0] - cx) + Math.abs(b[1] - cy)));
      for (let i = 0; i < n && i < t.length; i++) G[t[i][1]][t[i][0]] = pick(chars); };
    // a small arrangement in the middle, with a free ring around it so nothing gets walled off
    const centre = (m, pat) => { const w = pat[0].length, h = pat.length, iw = m.x1 - m.x0 - 1, ih = m.y1 - m.y0 - 1; if (iw < w + 2 || ih < h + 3) return false;
      const x0 = m.x0 + 1 + ((iw - w) >> 1), y0 = m.y0 + 2 + ((ih - 1 - h) >> 1);
      for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) if (G[y][x] !== "." || ((y >= y0 && y < y0 + h && x >= x0 && x < x0 + w) && !free(x, y) && pat[y - y0][x - x0] !== ".")) return false;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pat[y][x] !== ".") G[y0 + y][x0 + x] = pat[y][x]; return true; };
    // desks against the back wall with a chair pulled up in front
    const desks = (m, n, desk = "t") => { let k = 0; for (let x = m.x0 + 2; x < m.x1 - 1 && k < n; x += 3) if (free(x, m.y0 + 1) && free(x, m.y0 + 2)) { G[m.y0 + 1][x] = desk; G[m.y0 + 2][x] = "n"; k++; } return k; };
    // rows of stock with walkways between them (a free ring is kept at the walls)
    const aisles = (m, chars, step = 3) => { for (let y = m.y0 + 3; y < m.y1 - 1; y += step) for (let x = m.x0 + 2; x < m.x1 - 1; x++) if (free(x, y) && free(x, y - 1) && free(x, y + 1) && (x - m.x0) % 6 !== 0) G[y][x] = pick(chars); };
    const bottomBunks = (m, n) => { let k = 0; for (let x = m.x0 + 1; x < m.x1 && k < n; x += 2) if (free(x, m.y1 - 1) && free(x, m.y1 - 2)) { G[m.y1 - 1][x] = "B"; G[m.y1 - 2][x] = "y"; k++; } return k; };
    const bunks = (m, n) => { let k = 0; for (let x = m.x0 + 1; x < m.x1 && k < n; x += 2) if (free(x, m.y0 + 1) && free(x, m.y0 + 2)) { G[m.y0 + 1][x] = "B"; G[m.y0 + 2][x] = "y"; k++; } return k; };
    const freeTile = (m) => { const a = interior(m).filter(([x, y]) => !loot.some((l) => l.x === x && l.y === y) && !husks.some((h) => h[0] === x && h[1] === y)); return takeFrom(a); };
    const addLoot = (m, cat, n, t = tier) => { for (let i = 0; i < n; i++) { const p = freeTile(m); if (p) loot.push({ x: p[0], y: p[1], item: Items.roll(R, t, cat) }); } };
    const addHusks = (m, n) => { for (let i = 0; i < n; i++) { const p = freeTile(m); if (p) husks.push(p); } };
    // docking bay: spawn, shuttle pad, crates
    G[spawn[1]][spawn[0]] = "@";
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) G[dock.y0 + 2 + dy][2 + dx] = "E";
    corner(dock, ["c", "%"], ri(2, 3), "tr"); corner(dock, ["r", "8"], ri(1, 2), "br");
    addLoot(dock, "med", 1); addLoot(dock, "ammo", 1);
    for (const m of meta) {
      const a = m.area, k = Math.max(1, Math.round(a / 14));
      switch (m.type) {
        case "medbay": backRow(m, ["!", "!", "S"], 2 + k, 0); centre(m, ["i"]) || corner(m, ["i"], 1, "br"); if (m.x1 - m.x0 > 6) sideCol(m, ["5"], 1, "right"); addLoot(m, "med", ri(2, 3)); break;
        case "crew": bunks(m, 2 + k); corner(m, ["l"], 2, "br"); addLoot(m, "val", ri(1, 2)); addLoot(m, "any", 1); addLoot(m, "food", 1); break;
        case "security": desks(m, 1 + (k > 1 ? 1 : 0)); backRow(m, ["l"], 2 + k, 0, "right"); corner(m, ["0"], 1, "bl"); addLoot(m, "ammo", ri(1, 2)); addLoot(m, ch(.6) ? "weapon" : "throw", 1); break;
        case "captain": desks(m, 1); backRow(m, ["$"], 2, 0, "right"); corner(m, ["B"], 1, "bl"); corner(m, ["f"], 1, "br"); addLoot(m, "val", ri(1, 2), tier + 1); break;
        case "engineering": backRow(m, ["D", "9", "D", "g"], 3 + k, 0); corner(m, ["r"], 2, "bl"); sideCol(m, ["g"], 1, "right"); addLoot(m, "mat", ri(2, 3)); addLoot(m, "part", ri(1, 2)); break;
        case "cargo": backRow(m, ["%", "%", "c"], 2 + k, 1); corner(m, ["c", "c", "%"], 2 + k, "bl"); corner(m, ["c", "r"], 2, "br"); if (ch(.4)) corner(m, ["^"], 1, "tr"); addLoot(m, "any", ri(2, 3)); addLoot(m, "mat", 1); if (ch(.5)) addLoot(m, "part", 1); if (ch(.4)) addLoot(m, "food", 1); if (o.fireStart && !fires.length) { const p = freeTile(m); if (p) fires.push(p); } break;
        case "lab": backRow(m, ["S", "S", "5"], 2 + k, 1); centre(m, ["ti"]) || desks(m, 1); addLoot(m, "val", 1); addLoot(m, ch(.5) ? "med" : "dye", 1); break;
        case "fuel": corner(m, ["r"], 3 + k, "tl"); corner(m, ["r", "r", "8"], 2 + k, "br"); backRow(m, ["9"], 1, 0, "right"); addLoot(m, "mat", 1); addLoot(m, "ammo", 1); break;
        case "armory": backRow(m, ["j", "l", "j", "l"], 3 + k, 0); corner(m, ["0"], 2, "br"); if (ch(.35)) addLoot(m, "light", 1); addLoot(m, "weapon", 1, tier + (ch(.3) ? 1 : 0)); addLoot(m, "ammo", ri(2, 3)); addLoot(m, ch(.5) ? "throw" : "armor", 1); break;
        case "shrine": { const c = (m.x0 + m.x1) >> 1; if (free(c, m.y0 + 1)) { G[m.y0 + 1][c] = "6"; if (free(c - 1, m.y0 + 1)) G[m.y0 + 1][c - 1] = "f"; if (free(c + 1, m.y0 + 1)) G[m.y0 + 1][c + 1] = "f"; }
          centre(m, ["7.7", "...", "7.7"]) || centre(m, ["7.7"]); decals.push({ type: "ritual", x: c - 1, y: m.y1 - 3 }); addLoot(m, "val", 1, tier + 1); if (ch(.4)) addLoot(m, "dye", 1, tier + 1); break; }
        case "mess": addLoot(m, "food", ri(2, 3)); backRow(m, ["q", "V", "s"], 2 + (k > 1 ? 1 : 0), 0, "right"); centre(m, ["nnn", "TTT", "nnn"]) || centre(m, ["nn", "TT", "nn"]) || centre(m, ["T"]); addLoot(m, "med", 1); addLoot(m, "any", 1); break;
        case "workshop": backRow(m, ["U", "D", "U"], 2 + k, 1); corner(m, ["c", "%"], 2, "br"); if (ch(.5)) corner(m, ["^"], 1, "bl"); addLoot(m, "mat", ri(2, 4)); addLoot(m, "part", 1); addLoot(m, ch(.5) ? "pack" : "throw", 1); break;
        case "vault": corner(m, ["c", "$"], 2, "tl"); corner(m, ["c"], 1, "tr"); { const p = freeTile(m); if (p) loot.push({ x: p[0], y: p[1], item: { d: "blackbox", r: 0 } }); } addLoot(m, "val", ri(2, 4), tier + 1); addLoot(m, "part", 1, tier + 1); if (ch(.5)) addLoot(m, ch(.5) ? "armor" : "pack", 1, tier + 1); break;
      }
      const big = a >= 30, huge = a >= 56;
      switch (m.type) {
        case "medbay": if (big) { sideCol(m, ["!", "5"], 2, "left"); centre(m, ["i.i"]); } break;
        case "crew": if (big) bottomBunks(m, 2 + k); break;
        case "security": if (big) { centre(m, ["nnn", "TTT", "nnn"]) || centre(m, ["T", "n"]); sideCol(m, ["l"], huge ? 3 : 2, "left"); } break;
        case "captain": centre(m, ["uTu"]) || centre(m, ["T"]); sideCol(m, ["$"], 1, "right"); break;
        case "engineering": if (big) centre(m, ["9(9"]) || centre(m, ["("]); sideCol(m, ["D", "g"], huge ? 3 : 2, "left"); break;
        case "cargo": if (big) aisles(m, ["c", "c", "%", "%", "r"]); break;
        case "lab": if (big) { sideCol(m, ["S", "!"], 2, "right"); centre(m, ["S.i.S"]) || centre(m, ["S.S"]); } break;
        case "fuel": if (big) aisles(m, ["r", "r", "r", "8"], 3); break;
        case "armory": if (big) { centre(m, ["0.0"]) || centre(m, ["0"]); sideCol(m, ["j", "l"], 2, "left"); } break;
        case "shrine": sideCol(m, ["f"], 1, "left"); sideCol(m, ["f"], 1, "right"); if (huge) centre(m, ["7.7", "...", "7.7", "...", "7.7"]); break;
        case "mess": if (huge) centre(m, ["nnn.nnn", "TTT.TTT", "nnn.nnn"]); sideCol(m, ["p"], 1, "left"); break;
        case "workshop": if (big) { centre(m, ["^"]); sideCol(m, ["U", "D"], 2, "left"); } break;
        case "vault": backRow(m, ["$", "c", "$"], 3, 0, "mid"); break;
      }
      if (m.type === "vault") corner(m, ["["], 2, "br"); else if ((m.type === "captain" || m.type === "armory" || m.type === "security") && ch(.6)) corner(m, ["["], 1, m.type === "captain" ? "tl" : "bl");
      else if ((m.type === "crew" || m.type === "lab" || m.type === "workshop") && ch(.18)) corner(m, ["["], 1, "bl");
      if (m.type === "engineering") { const e = edges(m), p = takeFrom(e); if (p) G[p[1]][p[0]] = "P"; }
      if (m.type !== "vault" && m.type !== "dock") addHusks(m, R() < .35 + tier * .12 ? ri(1, Math.max(1, Math.round(a / 22))) : 0);
    }
    // dressing that says whose station this is
    if (o.kind) for (const m of meta) { const tiles = interior(m).filter(([x, y]) => G[y][x] === "."); const n = o.kind === "fortress" || o.kind === "hive" ? ri(1, 3) : ri(0, 2);
      for (let i = 0; i < n && tiles.length; i++) { const [x, y] = takeFrom(tiles); decals.push({ type: { hospital: "bloodtrail", mining: "ore", fortress: ch(.5) ? "graffiti" : "spikes", hive: "cables", outpost: "tape", research: ch(.5) ? "cables" : "bloodtrail", freighter: ch(.6) ? "ore" : "tape", colony: ch(.5) ? "bloodtrail" : "graffiti" }[o.kind], x, y, r: ri(0, 3) }); } }
    // keycard: captain's cabin or security office, else any room except the vault
    const kr = meta.find((m) => m.type === "captain") || meta.find((m) => m.type === "security") || meta.find((m) => m.type !== "vault");
    if (kr) { const p = freeTile(kr); if (p) loot.push({ x: p[0], y: p[1], item: { d: "keycard", r: 0 } }); }
    // corridors: a few husks and pickups
    for (const c of corridors) { const tiles = []; for (let y = c.y0 + 1; y < c.y1; y++) for (let x = c.x0 + 1; x < c.x1; x++) if (G[y][x] === "." && Math.abs(x - spawn[0]) + Math.abs(y - spawn[1]) > 10) tiles.push([x, y]);
      for (let i = 0; i < Math.round(tiles.length / 40) + tier - 1; i++) { const p = takeFrom(tiles); if (p) husks.push(p); }
      if (ch(.6)) { const p = takeFrom(tiles); if (p) loot.push({ x: p[0], y: p[1], item: Items.roll(R, tier, "ammo") }); } }

    // ---- make sure every pickup is reachable (props can wall one off) ----
    const walkable = (c) => c === "." || c === "+" || c === "L" || c === "E" || c === "@";
    function reach() { const seen = new Set([spawn[1] * W + spawn[0]]), q = [spawn]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = ny * W + nx; if (!seen.has(k) && inb(nx, ny) && walkable(G[ny][nx])) { seen.add(k); q.push([nx, ny]); } } } return seen; }
    let seen = reach();
    for (const l of loot.slice()) if (!seen.has(l.y * W + l.x)) {
      const m = meta.find((q) => l.x > q.x0 && l.x < q.x1 && l.y > q.y0 && l.y < q.y1);
      // open a path by clearing the nearest props first, widening until it's reachable
      const PR = "cBtlrfgSuTnqVGwsxjpdyUe!iD%56789 0$;*(^[";
      for (let r = 1; r <= 6 && m && !seen.has(l.y * W + l.x); r++) { for (let y = Math.max(m.y0 + 1, l.y - r); y <= Math.min(m.y1 - 1, l.y + r); y++) for (let x = Math.max(m.x0 + 1, l.x - r); x <= Math.min(m.x1 - 1, l.x + r); x++) if (Math.abs(x - l.x) + Math.abs(y - l.y) <= r && PR.includes(G[y][x])) G[y][x] = "."; seen = reach(); }
      if (!seen.has(l.y * W + l.x)) loot.splice(loot.indexOf(l), 1);
    }
    for (const h of husks.slice()) if (!seen.has(h[1] * W + h[0])) husks.splice(husks.indexOf(h), 1);
    // ---- what's inside the lockers, crates and cabinets ----
    // Only containers you can stand next to get anything; contents suit the room and the box.
    const caches = [], CONT = "lcy0!$[%j";
    const BOX = { l: ["any", "food", "light", "armor", "val"], c: ["mat", "any", "ammo", "food", "part"], y: ["val", "any", "food", "ammo"], "0": ["ammo", "ammo", "throw"], "!": ["med", "med", "med", "food"],
      "$": ["mat", "val", "food", "any"], "[": ["val", "val", "part", "weapon", "armor", "pack"], "%": ["mat", "mat", "food", "part"], j: ["weapon", "ammo"] };
    const ROOMBIAS = { medbay: "med", crew: "food", security: "ammo", captain: "val", engineering: "part", cargo: "mat", lab: "med", fuel: "mat", armory: "ammo", shrine: "val", mess: "food", workshop: "mat", vault: "val", dock: "ammo" };
    const touch = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((y + dy) * W + x + dx));
    for (const m of [dock, ...meta]) for (let y = m.y0 + 1; y < m.y1; y++) for (let x = m.x0 + 1; x < m.x1; x++) {
      const c = G[y][x]; if (!CONT.includes(c) || !touch(x, y)) continue;
      const empty = c === "[" ? 0 : c === "j" ? .45 : .3; if (R() < empty) { caches.push({ x, y, items: [] }); continue; }
      const n = c === "[" ? ri(2, 3) : R() < .3 ? 2 : 1, items = [], t = tier + (c === "[" || m.type === "vault" ? 1 : 0);
      for (let i = 0; i < n; i++) { const cat = R() < .35 && ROOMBIAS[m.type] && c !== "j" && c !== "0" ? ROOMBIAS[m.type] : pick(BOX[c]); items.push(Items.roll(R, t, cat)); }
      caches.push({ x, y, items }); }
    return { rows: G.map((r) => r.join("")), rooms, spawn, loot, husks, decals, fires, caches, size: [W, H] };
  }
  return { station };
})();
