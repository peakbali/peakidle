// ---------- Pixel sprite painter for monsters and bosses ----------
// Each monster is a small hand-drawn pixel map (see monster-art.js): one letter = one pixel,
// "." = empty. A dark outline is added all around automatically.
// The finished sprite is turned into tiny PNG pictures once and reused, so the page stays light.
//
// A sprite has up to three layers stacked on top of each other:
//   body  - everything, with the eyes drawn closed
//   eyes  - the open eyes; the game fades this layer out now and then, so the monster blinks
//   glow  - magic (flames, crystals, runes) that flickers
// Some creatures also get element particles that drift around them (embers, ice shards, rocks...).

const PX_OUTLINE = "#1a1016";

function pxHex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

// Turn a color grid into a PNG (as a data URL).
function pxGridPNG(grid, W, H) {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(W, H);
  let any = false;
  for (let i = 0; i < W * H; i++) {
    const c = grid[i]; if (!c) continue;
    any = true;
    const [r, g, b] = pxHex(c);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  if (!any) return null;
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}

// Cut away empty rows and columns around a map, so every creature fills its picture.
function pxTrimMap(map) {
  const rows = map.map((r, i) => /[^.]/.test(r) ? i : -1).filter(i => i >= 0);
  if (!rows.length) return map;
  let c0 = Infinity, c1 = -1;
  for (const r of map) { const a = r.search(/[^.]/); if (a >= 0) { c0 = Math.min(c0, a); c1 = Math.max(c1, r.length - 1 - [...r].reverse().join("").search(/[^.]/)); } }
  return map.slice(rows[0], rows[rows.length - 1] + 1).map(r => r.slice(c0, c1 + 1));
}

// Paint a pixel map. pal maps letters to colors. Special letters:
//   eye letters (o.eye, default "e" and "E")  - drawn on the blinking eye layer; the body shows o.lid there
//   glow letters (o.glow, default "F")        - drawn on the body and again on the flickering glow layer
// Returns the HTML of the stacked pictures (square, with one pixel of room for the outline).
function pxSpriteHTML(map, pal, className, o = {}) {
  map = pxTrimMap(map);
  const eyeCh = o.eye || "eE", glowCh = o.glow || "F";
  const mh = map.length, mw = map[0].length;
  const S = Math.max(mw, mh) + 2;              // square picture, centered left to right, sitting on the bottom
  const ox = 1 + Math.floor((S - 2 - mw) / 2), oy = S - 1 - mh;
  const N = S * S;
  const body = new Array(N).fill(null), eyes = new Array(N).fill(null), glow = new Array(N).fill(null);
  const solid = new Uint8Array(N);
  // Auto-shaded letters (o.auto, e.g. { m: [light, base, dark] }): lit where the top or left edge is
  // open, shaded where the bottom or right edge is, so a plain silhouette gets soft 3-tone shading.
  const auto = o.auto || {};
  const at = (r, c) => (r >= 0 && c >= 0 && r < mh && c < mw) ? map[r][c] : ".";
  const open = (r, c, ch) => { const q = at(r, c); return q === "." || (auto[q] && q !== ch && o.split && o.split.includes(ch)); };
  const shade = (r, c, ch) => {
    const [L, M, D] = auto[ch];
    if (open(r + 1, c, ch) || open(r, c + 1, ch) && !open(r - 1, c, ch)) return D;
    if (open(r - 1, c, ch) || open(r, c - 1, ch) || open(r - 1, c - 1, ch) && open(r - 2, c, ch)) return L;
    return M;
  };
  for (let r = 0; r < mh; r++) for (let c = 0; c < mw; c++) {
    const ch = map[r][c];
    if (ch === ".") continue;
    const i = (r + oy) * S + c + ox;
    solid[i] = 1;
    if (eyeCh.includes(ch)) { eyes[i] = pal[ch] || PX_OUTLINE; body[i] = pal[o.lid] || pal["2"] || pal.b || PX_OUTLINE; }
    else {
      body[i] = auto[ch] ? shade(r, c, ch) : pal[ch] || "#ff00ff";
      if (glowCh.includes(ch)) glow[i] = pal[ch];
    }
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    if (solid[i]) continue;
    const near = (dx, dy) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < S && Y < S && solid[Y * S + X]; };
    if (near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1)) body[i] = PX_OUTLINE;
  }
  const b = pxGridPNG(body, S, S), e = pxGridPNG(eyes, S, S), g = pxGridPNG(glow, S, S);
  return `<span class="${className}">` +
    (b ? `<img class="mp-l" src="${b}" alt="" draggable="false">` : "") +
    (e ? `<img class="mp-l m-eye" src="${e}" alt="" draggable="false">` : "") +
    (g ? `<img class="mp-l m-glow" src="${g}" alt="" draggable="false">` : "") +
    (o.fx ? pxParticlesHTML(o.fx, S) : "") +
    `</span>`;
}

// ----- Element particles -----
// Tiny pixel bits that move around a creature, like flames licking up or rocks floating beside a golem.
const PX_PARTICLES = {
  fire:      { map: [".a.", "aba", "aca"], pal: { a: "#e8452a", b: "#ffb43a", c: "#fff27a" }, move: "rise" },
  ice:       { map: [".a.", "aba", ".a."], pal: { a: "#4aa8f0", b: "#e6f8ff" }, move: "orbit" },
  earth:     { map: ["aa.", "abb", ".bb"], pal: { a: "#b88a56", b: "#6e4a2a" }, move: "bob" },
  wind:      { map: ["a..", ".ab", "..b"], pal: { a: "#c8f5a8", b: "#4fbf6a" }, move: "drift" },
  lightning: { map: ["a..", ".a.", "..a"], pal: { a: "#fff27a" }, move: "zap" },
};
const pxParticleCache = {};
function pxParticleImg(kind) {
  if (!pxParticleCache[kind]) {
    const p = PX_PARTICLES[kind], h = p.map.length, w = p.map[0].length;
    const grid = [];
    for (const row of p.map) for (const ch of row) grid.push(ch === "." ? null : p.pal[ch]);
    pxParticleCache[kind] = pxGridPNG(grid, w, h);
  }
  return pxParticleCache[kind];
}
// Three particles at set spots around the sprite (in % of its box), each with its own timing.
const PX_PARTICLE_SPOTS = [[6, 30, 0], [80, 18, -0.9], [86, 62, -1.7]];
function pxParticlesHTML(kind, S) {
  const p = PX_PARTICLES[kind];
  if (!p) return "";
  const src = pxParticleImg(kind), size = (300 / S).toFixed(2); // 3 pixels of the sprite
  return PX_PARTICLE_SPOTS.map(([x, y, d]) =>
    `<img class="mfx mfx-${p.move}" src="${src}" alt="" draggable="false" style="left:${x}%;top:${y}%;width:${size}%;animation-delay:${d}s">`).join("");
}
