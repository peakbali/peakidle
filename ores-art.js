// ---------- Ore icons ----------
// Each ore gets its own little pixel-art picture, drawn in code (no image files).
// Every icon is a 20 x 20 pixel grid: rounded lumps get light from the top left,
// a bit of random "pitting" for a rough rocky texture, and gems get flat shiny facets.
// The colors come from each ore's own color, so copper stays orange, gold stays yellow, and so on.
// Purely for looks: nothing here touches the game or the save.

const ORE_ART_SIZE = 20;

// Each ore's main color (the same colors the ores had before).
const ORE_COLORS = {
  copper: "#e07b39", iron: "#c8ccd2", gold: "#f5c542", mithril: "#5fb0ff", adamant: "#3ecf5c",
  obsidian: "#8e4fd6", moonsilver: "#cfd8ff", sunstone: "#ffb020", starmetal: "#ffe27a", voidsteel: "#a66bff",
};

// Grey-brown stone that some ores sit in, and a near-black purple stone for voidsteel.
const ROCK_PAL = ["#1b1714", "#332d28", "#4b443d", "#665d54", "#80766b", "#9a9084"];
const VOID_PAL = ["#09060f", "#171024", "#241a38", "#33264f", "#433366", "#55427f"];

function oaMix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// Six shades of one color: [outline, darkest, dark, main, light, shine]
function oaPalette(base) {
  return [oaMix(base, "#120a0e", 0.8), oaMix(base, "#140c10", 0.55), oaMix(base, "#000000", 0.27),
    base, oaMix(base, "#ffffff", 0.35), oaMix(base, "#ffffff", 0.7)];
}

// Same "random" number every time for the same pixel, so the texture never flickers.
function oaHash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const OA_LIGHT = (() => { const v = [-0.55, -0.65, 0.55], n = Math.hypot(...v); return v.map((c) => c / n); })();

function oaGrid() {
  return Array.from({ length: ORE_ART_SIZE }, () => Array(ORE_ART_SIZE).fill(null));
}
function oaSet(g, x, y, c, o) {
  if (x >= 0 && y >= 0 && x < ORE_ART_SIZE && y < ORE_ART_SIZE) g[y][x] = { c, o };
}

// Paint a mask. sep = draw a dark line where this shape overlaps what is already behind it.
function oaPaint(g, inside, colorAt, outline, sep) {
  const hit = [];
  for (let y = 0; y < ORE_ART_SIZE; y++) for (let x = 0; x < ORE_ART_SIZE; x++) if (inside(x + 0.5, y + 0.5)) hit.push([x, y]);
  const mine = new Set(hit.map(([x, y]) => x + "," + y));
  for (const [x, y] of hit) { const c = colorAt(x, y); if (c) oaSet(g, x, y, c, outline); }
  if (sep) {
    for (const [x, y] of hit) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!mine.has(nx + "," + ny) && g[ny] && g[ny][nx]) oaSet(g, nx, ny, sep, outline);
    }
  }
}

// A rounded lump, shaded like a little ball, with rough pitted texture.
// opts: pal (6 shades), seed, rough (0..1 how many pits), sep (draw seam behind), cut (pixels to skip)
function oaLump(g, cx, cy, rx, ry, pal, opts = {}) {
  const seed = opts.seed || 1, rough = opts.rough ?? 0.22;
  const inside = (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1 && !(opts.cut && opts.cut(px, py));
  oaPaint(g, inside, (x, y) => {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const s = nx * OA_LIGHT[0] + ny * OA_LIGHT[1] + nz * OA_LIGHT[2];
    let lv = s < -0.15 ? 1 : s < 0.3 ? 2 : s < 0.62 ? 3 : s < 0.88 ? 4 : 5;
    const r = oaHash(x, y, seed);
    if (r < rough) lv -= 1;                 // little pits and dents
    else if (r > 1 - rough * 0.35) lv += 1; // tiny bumps catching the light
    lv = Math.max(1, Math.min(5, lv));
    return pal[lv];
  }, pal[0], opts.sep ? pal[0] : null);
}

function oaInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A flat polished face of a gem or crystal, all one shade.
function oaFacet(g, pts, color, outline) {
  oaPaint(g, (px, py) => oaInPoly(px, py, pts), () => color, outline);
}

// A crystal spike from base point (bx,by) to tip (tx,ty): left face light, right face dark.
function oaShard(g, bx, by, tx, ty, w, pal) {
  const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, px = -uy * w, py = ux * w;
  const sx = tx - ux * w * 1.6, sy = ty - uy * w * 1.6; // where the point starts
  const L = [[bx + px, by + py], [sx + px, sy + py], [tx, ty], [bx, by]];
  const R = [[bx, by], [tx, ty], [sx - px, sy - py], [bx - px, by - py]];
  const leftIsLit = px < 0 || (px === 0 && py < 0);
  oaFacet(g, L, leftIsLit ? pal[4] : pal[2], pal[0]);
  oaFacet(g, R, leftIsLit ? pal[2] : pal[4], pal[0]);
  // a bright edge down the middle ridge
  for (let t = 0.2; t < 0.9; t += 0.08) oaSet(g, Math.floor(bx + dx * t + px * 0.3), Math.floor(by + dy * t + py * 0.3), pal[5], pal[0]);
}

function oaDots(g, dots, outline) {
  for (const [x, y, c] of dots) oaSet(g, x, y, c, outline);
}

// Dark outline around everything, then a soft shadow under it.
function oaOutline(g) {
  const out = [];
  for (let y = 0; y < ORE_ART_SIZE; y++) for (let x = 0; x < ORE_ART_SIZE; x++) {
    if (g[y][x]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = g[y + dy] && g[y + dy][x + dx];
      if (n) { out.push([x, y, n.o]); break; }
    }
  }
  for (const [x, y, o] of out) g[y][x] = { c: o, o };
}

// ---- The 10 ore drawings ----
const ORE_DRAW = {
  // Copper: a chunk of stone with orange copper lumps poking out of it.
  copper(g, p) {
    oaLump(g, 10, 11.5, 8.6, 7.2, ROCK_PAL, { seed: 3, rough: 0.3 });
    oaLump(g, 7, 8, 3, 2.6, p, { seed: 4, sep: true, rough: 0.15 });
    oaLump(g, 13.5, 10, 2.6, 2.4, p, { seed: 5, sep: true, rough: 0.15 });
    oaLump(g, 9, 14.5, 2.8, 2.2, p, { seed: 6, sep: true, rough: 0.15 });
    oaLump(g, 15, 15, 1.8, 1.6, p, { seed: 7, sep: true, rough: 0.1 });
    oaLump(g, 4.5, 12.5, 1.5, 1.4, p, { seed: 8, sep: true, rough: 0.1 });
  },
  // Iron: a pile of three heavy grey-white lumps.
  iron(g, p) {
    oaLump(g, 10.5, 8, 5.2, 4.6, p, { seed: 11, rough: 0.28 });
    oaLump(g, 5.8, 13.5, 5, 4.4, p, { seed: 12, rough: 0.28, sep: true });
    oaLump(g, 14.6, 14, 4.6, 4.2, p, { seed: 13, rough: 0.28, sep: true });
  },
  // Gold: one big lumpy nugget with a little one next to it.
  gold(g, p) {
    oaLump(g, 4.6, 15.6, 2.4, 2.1, p, { seed: 21, rough: 0.12 });
    const blobs = [[11, 10, 6.6, 5.4], [8, 12.5, 5, 4.2], [13.5, 13.5, 4.6, 3.8], [12, 6.5, 3.6, 3]];
    const inside = (px, py) => blobs.some(([cx, cy, rx, ry]) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1);
    // shade the whole nugget like one ball, but keep the bumpy outline
    oaPaint(g, inside, (x, y) => {
      let best = -9;
      for (const [cx, cy, rx, ry] of blobs) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
        if (d > 1) continue;
        const s = nx * OA_LIGHT[0] + ny * OA_LIGHT[1] + Math.sqrt(1 - d) * OA_LIGHT[2];
        best = Math.max(best, s);
      }
      let lv = best < -0.15 ? 1 : best < 0.3 ? 2 : best < 0.62 ? 3 : best < 0.88 ? 4 : 5;
      const r = oaHash(x, y, 22);
      if (r < 0.16) lv -= 1; else if (r > 0.95) lv += 1;
      return p[Math.max(1, Math.min(5, lv))];
    }, p[0], p[0]);
    oaDots(g, [[8, 8, "#ffffff"], [12, 4, "#ffffff"]], p[0]);
  },
  // Mithril: pointy blue crystals growing out of a stone.
  mithril(g, p) {
    oaShard(g, 13.5, 15, 16.5, 5, 2.2, p);
    oaShard(g, 6.5, 15, 3.6, 6.5, 2.2, p);
    oaShard(g, 10, 15, 10, 1.5, 3, p);
    oaLump(g, 10, 16.5, 8.4, 3.6, ROCK_PAL, { seed: 31, rough: 0.3, sep: true });
    oaDots(g, [[9, 4, "#ffffff"], [9, 5, p[5]]], p[0]);
  },
  // Adamant: a green emerald-cut gem.
  adamant(g, p) {
    const O = p[0];
    oaFacet(g, [[6, 2], [14, 2], [17, 5], [17, 15], [14, 18], [6, 18], [3, 15], [3, 5]], p[2], O);
    oaFacet(g, [[6, 2], [14, 2], [17, 5], [14, 6], [6, 6], [3, 5]], p[4], O);
    oaFacet(g, [[3, 5], [6, 6], [6, 14], [3, 15]], p[3], O);
    oaFacet(g, [[3, 15], [6, 14], [14, 14], [17, 15], [14, 18], [6, 18]], p[1], O);
    oaFacet(g, [[6, 6], [14, 6], [14, 14], [6, 14]], p[3], O);
    oaFacet(g, [[6, 6], [11, 6], [6, 11]], p[4], O);
    oaFacet(g, [[14, 9], [14, 14], [9, 14]], p[2], O);
    oaDots(g, [[7, 3, "#ffffff"], [8, 3, p[5]], [7, 7, "#ffffff"], [8, 7, p[5]], [7, 8, p[5]]], O);
  },
  // Obsidian: sharp shards of dark purple volcanic glass.
  obsidian(g, p) {
    const O = p[0];
    oaFacet(g, [[13, 6], [18.5, 11], [17, 18.5], [12, 18.5]], p[2], O);
    oaFacet(g, [[13, 6], [15.5, 12], [17, 18.5], [12, 18.5]], p[3], O);
    oaFacet(g, [[8, 1], [12.5, 7], [12, 18.5], [5, 18.5], [3.5, 9]], p[1], O);
    oaFacet(g, [[8, 1], [8.8, 18.5], [5, 18.5], [3.5, 9]], p[3], O);
    oaFacet(g, [[8, 1], [6, 9], [5, 18.5], [3.5, 9]], p[4], O);
    for (let y = 3; y < 17; y++) oaSet(g, Math.floor(8 + (y - 1) * 0.04), y, y % 5 === 0 ? "#ffffff" : p[5], O);
    oaDots(g, [[14, 9, p[5]], [14, 10, p[5]], [15, 12, "#ffffff"]], O);
  },
  // Moonsilver: a silvery crescent moon nugget.
  moonsilver(g, p) {
    const cut = (px, py) => ((px - 14.2) / 7) ** 2 + ((py - 7) / 7) ** 2 <= 1;
    oaLump(g, 9.5, 10.5, 8.4, 8.4, p, { seed: 41, rough: 0.2, cut });
    oaDots(g, [[4, 8, "#ffffff"], [5, 7, p[5]], [3, 10, p[5]], [15, 17, "#ffffff"]], p[0]);
  },
  // Sunstone: a round sparkling gem cut like a little sun.
  sunstone(g, p) {
    const cx = 10, cy = 10, R = 8.6, O = p[0], la = Math.atan2(-1, -1);
    oaPaint(g, (px, py) => {
      const x = Math.abs(px - cx), y = Math.abs(py - cy);
      return Math.max(x, y, (x + y) / Math.SQRT2) <= R;
    }, (x, y) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, ax = Math.abs(dx), ay = Math.abs(dy);
      const a = Math.atan2(dy, dx);
      if (Math.max(ax, ay, (ax + ay) / Math.SQRT2) <= 3.8) { // the flat top
        return dx + dy < -2 ? p[5] : dx + dy < 2 ? p[4] : p[3];
      }
      const sector = Math.floor((a + Math.PI) / (Math.PI / 8));
      let lv = Math.cos(a - la) > 0.5 ? 4 : Math.cos(a - la) > -0.3 ? 3 : 2;
      if (sector % 2) lv -= 1;
      return p[Math.max(1, lv)];
    }, O);
    oaDots(g, [[7, 7, "#ffffff"], [8, 7, p[5]], [7, 8, p[5]], [5, 4, "#ffffff"], [14, 14, p[5]]], O);
  },
  // Starmetal: a fallen star, a five-pointed chunk of glowing metal.
  starmetal(g, p) {
    const cx = 10, cy = 10.8, R = 9.6, r = 4.1, O = p[0], la = Math.atan2(-1, -1);
    const pt = (i, rad) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]; };
    for (let k = 0; k < 5; k++) {
      const P = pt(2 * k, R), Qa = pt(2 * k - 1, r), Qb = pt(2 * k + 1, r);
      const arm = -Math.PI / 2 + (2 * k * Math.PI) / 5;
      const lit = Math.cos(arm - la);
      const hi = lit > 0.3 ? 5 : lit > -0.4 ? 4 : 3;
      oaFacet(g, [[cx, cy], Qa, P], p[hi], O);
      oaFacet(g, [[cx, cy], P, Qb], p[Math.max(1, hi - 2)], O);
    }
    oaDots(g, [[10, 3, "#ffffff"], [9, 9, "#ffffff"], [10, 9, p[5]], [3, 8, p[5]]], O);
  },
  // Voidsteel: a pitch-dark stone with glowing purple cracks.
  voidsteel(g, p) {
    oaLump(g, 10, 11, 8.8, 7.8, VOID_PAL, { seed: 51, rough: 0.3 });
    const vein = [[5, 6], [6, 7], [7, 8], [8, 8], [9, 9], [10, 10], [10, 11], [11, 12], [12, 12], [13, 13], [14, 14], [14, 15],
      [10, 9], [11, 8], [12, 7], [13, 7], [14, 6], [8, 12], [7, 13], [6, 14], [11, 13], [11, 14]];
    oaDots(g, vein.map(([x, y], i) => [x, y, i % 4 === 0 ? p[5] : p[3]]), VOID_PAL[0]);
    oaDots(g, [[10, 10, "#ffffff"], [4, 12, p[4]], [16, 9, p[4]], [7, 4, p[2]], [15, 12, p[2]], [12, 17, p[4]]], VOID_PAL[0]);
  },
};

const oreArtCache = {};

// Returns the <svg> picture for one ore (cached, it never changes).
function oreArtSVG(oreId) {
  if (oreArtCache[oreId]) return oreArtCache[oreId];
  const draw = ORE_DRAW[oreId];
  if (!draw) return "";
  const g = oaGrid();
  draw(g, oaPalette(ORE_COLORS[oreId]));
  oaOutline(g);
  // Join neighbouring pixels of the same color into one rectangle to keep the picture small.
  let rects = "";
  for (let y = 0; y < ORE_ART_SIZE; y++) {
    for (let x = 0; x < ORE_ART_SIZE;) {
      const cell = g[y][x];
      if (!cell) { x++; continue; }
      let w = 1;
      while (x + w < ORE_ART_SIZE && g[y][x + w] && g[y][x + w].c === cell.c) w++;
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${cell.c}"/>`;
      x += w;
    }
  }
  const svg = `<svg class="ore-art" viewBox="0 0 ${ORE_ART_SIZE} ${ORE_ART_SIZE}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  oreArtCache[oreId] = svg;
  return svg;
}
