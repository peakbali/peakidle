// ---------- Fluffy pixel painter for monsters and bosses ----------
// Monsters are painted in code onto a small pixel grid (36x36 for monsters, 64x64 for bosses) in a
// soft, round, fluffy style: furry edges, a sketchy dark outline, soft shading, dot eyes and blush.
// The finished picture is turned into a tiny PNG once and reused, so the page stays light.
//
// A picture has three layers stacked on top of each other:
//   body  - everything, with the eyes drawn closed (a little line)
//   eyes  - the open eyes; the game fades this layer out now and then, so the monster blinks
//   glow  - magic (flames, sparks, crystals) that flickers
//
// Drawing tools (all positions are grid pixels, x to the right and y down):
//   p.fur(cx, cy, rx, ry, mat, o)   a fluffy oval with tufty edges
//   p.ell(cx, cy, rx, ry, mat, o)   a clean oval (shells, noses, bellies)
//   p.poly([[x,y],...], mat, o)     a filled shape (horns, ears, wings, fins)
//   p.rect(x, y, w, h, mat, o)      a box
//   p.line(x0, y0, x1, y1, mat, o)  a line (o.w = thickness)
//   p.dot(x, y, mat)                one pixel
//   p.eye(x, y, o) / p.eyes(cx, y, gap, o)   dot eyes that blink (o.big for 3x3 eyes)
//   p.blush(x, y, w)                pink cheeks
//   p.glow(fn)                      everything drawn inside fn also goes on the flickering glow layer
// A "mat" (material) is a key into the picture's colors; it says how the pixel is shaded.
// o.same = true keeps drawing on the last part (no line between them); o.edge = false skips the
// sketch line where this part covers another one; o.flat = true turns off the fur texture.

function pxHex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function pxToHex(c) { return "#" + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
function pxMix(a, b, t) { const A = pxHex(a), B = pxHex(b); return pxToHex(A.map((v, i) => v + (B[i] - v) * t)); }
function pxHash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The four shades of a material: line (sketch outline), shadow, base, light.
function pxTones(base) {
  return {
    line: pxMix(base, "#2a1220", 0.8),
    shadow: pxMix(base, "#5a2448", 0.24),
    base,
    light: pxMix(base, "#fff8ea", 0.34),
  };
}

class PixPainter {
  constructor(W, H, mats, seed = 1, scale = 1) {
    this.W = W; this.H = H; this.seed = seed; this.s = scale;
    this.mats = {};
    for (const k in mats) {
      const m = typeof mats[k] === "string" ? { c: mats[k] } : mats[k];
      this.mats[k] = { ...m, t: pxTones(m.c) };
    }
    const N = W * H;
    this.mat = new Array(N).fill(null);   // material per pixel
    this.part = new Int32Array(N);        // which drawing call painted it (0 = empty)
    this.flat = new Uint8Array(N);        // 1 = no fur texture, 2 = no texture and no inner line
    this.over = new Array(N).fill(null);  // an exact color that wins over the shading
    this.blushA = new Uint8Array(N);
    this.eyeL = new Array(N).fill(null);
    this.glowL = new Array(N).fill(null);
    this.partEdge = [false];
    this.partN = 0;
    this.glowing = false;
  }
  _part(o) {
    if (o && o.same && this.partN) return this.partN;
    this.partN++;
    this.partEdge[this.partN] = !(o && o.edge === false);
    return this.partN;
  }
  _set(x, y, mat, part, o) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = y * this.W + x;
    this.mat[i] = mat; this.part[i] = part; this.over[i] = (o && o.color) || null;
    this.flat[i] = (o && o.flat) || (this.mats[mat] && this.mats[mat].flat) ? 1 : 0;
    this.blushA[i] = 0;
    this.glowL[i] = this.glowing ? (o && o.color) || this.mats[mat].t.light : null;
  }
  // Fluffy oval: the edge is a ring of little rounded tufts.
  fur(cx, cy, rx, ry, mat, o = {}) {
    return this.ell(cx, cy, rx, ry, mat, o);
  }
  furOld(cx, cy, rx, ry, mat, o = {}) {
    const part = this._part(o);
    const fuzz = o.fuzz == null ? 1.3 : o.fuzz;
    const n = o.tufts || Math.max(6, Math.round((rx + ry) * 0.85));
    const s = (o.seed || 0) + this.seed + part * 7;
    const r = Math.ceil(Math.max(rx, ry) + fuzz + 1);
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const t = ((a / (Math.PI * 2)) + 1) * n + s * 0.37;
      const i = Math.floor(t), f = t - i;
      const amp = 0.55 + 0.45 * pxHash(i % n, 3, s);
      // Tufts are smaller underneath, where the monster sits.
      const under = o.flatBottom === false ? 1 : 1 - Math.max(0, Math.sin(a)) * 0.75;
      const bump = Math.sin(Math.PI * f) * amp * fuzz * under;
      const edgePx = (d - 1) * ((rx + ry) / 2);
      if (edgePx < bump - fuzz * 0.45) this._set(x, y, mat, part, o);
    }
  }
  ell(cx, cy, rx, ry, mat, o = {}) {
    const part = this._part(o), k = this.s;
    cx *= k; cy *= k; rx = Math.max(0.7, rx * k); ry = Math.max(0.7, ry * k);
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this._set(x, y, mat, part, o);
    }
  }
  poly(pts, mat, o = {}) {
    const part = this._part(o);
    pts = pts.map(([x, y]) => [x * this.s, y * this.s]);
    const ys = pts.map(p => p[1]), xs = pts.map(p => p[0]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this._set(x, y, mat, part, o);
    }
  }
  rect(x, y, w, h, mat, o = {}) {
    const part = this._part(o), k = this.s;
    x = Math.round(x * k); y = Math.round(y * k); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this._set(x + i, y + j, mat, part, o);
  }
  line(x0, y0, x1, y1, mat, o = {}) {
    const part = this._part(o), k = this.s;
    x0 *= k; y0 *= k; x1 *= k; y1 *= k;
    const w = Math.max(1, Math.round((o.w || 1) * k));
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let k = 0; k <= steps; k++) {
      const x = x0 + (x1 - x0) * k / steps, y = y0 + (y1 - y0) * k / steps;
      for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) this._set(Math.floor(x - (w - 1) / 2) + i, Math.floor(y - (w - 1) / 2) + j, mat, part, o);
    }
  }
  dot(x, y, mat, o = {}) { this._set(x * this.s, y * this.s, mat, this._part({ same: o.same, edge: false }), { flat: true, ...o }); }
  // Paint an exact color on what is already there (keeps the part, so no new outline).
  tint(x, y, color) { x = Math.round(x * this.s); y = Math.round(y * this.s); const i = y * this.W + x; if (x >= 0 && y >= 0 && x < this.W && y < this.H && this.mat[i]) this.over[i] = color; }
  // A dot eye. Underneath (body layer) the eye is drawn closed; the eye layer holds it open.
  eye(x, y, o = {}) {
    const ink = o.ink || "#2a1a16", hi = o.hi || "#ffffff";
    const size = o.big ? 3 : o.size || 2;
    const closed = this.mats[o.lid] ? this.mats[o.lid].t.line : "#3a241c";
    x = Math.round(x * this.s); y = Math.round(y * this.s);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const X = x + i, Y = y + j;
      if (X < 0 || Y < 0 || X >= this.W || Y >= this.H) continue;
      if (o.big && (i !== 1 && j !== 1) && o.round) continue;
      this.eyeL[Y * this.W + X] = ink;
      if (j === size - 1 && this.mat[Y * this.W + X]) this.over[Y * this.W + X] = closed;
    }
    if (size > 1 && !o.noHi) this.eyeL[y * this.W + x + (o.hiRight ? size - 1 : 0)] = hi;
    if (o.white) { // a white ring around a big eye (frogs, owls)
      for (let j = -1; j <= size; j++) for (let i = -1; i <= size; i++) {
        const X = x + i, Y = y + j;
        if (i >= 0 && j >= 0 && i < size && j < size) continue;
        if ((i === -1 || i === size) && (j === -1 || j === size)) continue;
        this.eyeL[Y * this.W + X] = o.white;
      }
    }
  }
  eyes(cx, y, gap, o = {}) {
    const size = (o.big ? 3 : o.size || 2) / this.s;
    this.eye(cx - gap / 2 - size, y, o);
    this.eye(cx + gap / 2, y, { ...o, hiRight: false });
  }
  blush(x, y, w = 2, h = 1) {
    x = Math.round(x * this.s); y = Math.round(y * this.s);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = x + i, Y = y + j;
      if (X >= 0 && Y >= 0 && X < this.W && Y < this.H && this.mat[Y * this.W + X]) this.blushA[Y * this.W + X] = 1;
    }
  }
  cheeks(cx, y, gap, w = 2) { this.blush(cx - gap / 2 - w / this.s, y, w); this.blush(cx + gap / 2, y, w); }
  glow(fn) { this.glowing = true; fn(); this.glowing = false; }
  // Everything drawn inside fn is mirrored left to right around column cx (for symmetric parts).
  mirror(cx, fn) {
    fn((x) => x);
    fn((x) => 2 * cx - x);
  }

  // ----- Turn the grid into colors -----
  colors() {
    const { W, H } = this;
    const body = new Array(W * H).fill(null);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -1 : y * W + x;
    const partAt = (x, y) => { const i = at(x, y); return i < 0 ? 0 : this.part[i]; };
    // Each part's top and bottom, for the soft top-to-bottom shading.
    const top = {}, bot = {};
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = this.part[y * W + x]; if (!p) continue;
      if (top[p] == null) top[p] = y; bot[p] = y;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, p = this.part[i];
      if (!p) continue;
      const m = this.mats[this.mat[i]], T = m.t;
      let c = T.base;
      if (this.over[i]) c = this.over[i];
      else {
        // Inner sketch line where this part sits on top of an earlier one.
        let edge = false;
        if (this.partEdge[p] && this.flat[i] !== 2) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const q = partAt(x + dx, y + dy);
            if (q && q < p && this.mat[at(x + dx, y + dy)] !== null) { edge = true; break; }
          }
        }
        if (edge) c = T.line;
        else {
          const rel = (y - top[p]) / Math.max(1, bot[p] - top[p]);
          const rimTL = partAt(x - 1, y - 1) !== p || partAt(x, y - 2) !== p;
          const rimBR = partAt(x + 1, y + 1) !== p && partAt(x, y + 1) !== p || partAt(x + 1, y + 1) !== p && partAt(x + 1, y) !== p;
          if (rimTL && !rimBR && m.shine) c = T.light;
          else if (rimBR || rel > 0.85) c = T.shadow;
          if (false) {
            // Fur: short up-and-down strokes of light and dark.
            const h = pxHash(x, Math.floor((y + (x % 3)) / 2), this.seed);
            if (h < 0.13) c = T.shadow;
            else if (h > 0.9 && c !== T.shadow) c = T.light;
            if (h > 0.993) c = T.line;
          }
        }
      }
      if (this.blushA[i]) c = pxMix(c, "#ff6f8e", 0.7);
      body[i] = c;
    }
    // Sketchy outline around everything, with a few stray fur hairs.
    const out = body.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (body[i]) continue;
      let best = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = partAt(x + dx, y + dy); if (q > best) best = q; }
      let line = best;
      if (!best) {
        // Diagonal corners get filled now and then, so the line looks hand drawn.
        for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const q = partAt(x + dx, y + dy);
          if (q > best) best = q;
        }
        line = 0;
      }
      if (line) {
        const j = this.part.indexOf(line);
        out[i] = this.mats[this.mat[j]].t.line;
      }
    }
    return { body: out, eyes: this.eyeL, glow: this.glowL };
  }
}

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

// Paint a picture and return its HTML (three stacked images).
function pxPictureHTML(W, H, mats, draw, className, seed, scale = 1) {
  const p = new PixPainter(W, H, mats, seed, scale);
  draw(p, p.mats);
  const { body, eyes, glow } = p.colors();
  const b = pxGridPNG(body, W, H), e = pxGridPNG(eyes, W, H), g = pxGridPNG(glow, W, H);
  return `<span class="${className}">` +
    (b ? `<img class="mp-l" src="${b}" alt="" draggable="false">` : "") +
    (e ? `<img class="mp-l m-eye" src="${e}" alt="" draggable="false">` : "") +
    (g ? `<img class="mp-l m-glow" src="${g}" alt="" draggable="false">` : "") +
    `</span>`;
}
