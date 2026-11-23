// ---------- Pixel-art zone backgrounds ----------
// A wide pixel landscape for each of the 10 danger levels, shown faintly behind the zone name in the
// Adventure panel. Each scene is painted on a small pixel grid (96 x 28) with a few simple helpers:
// rectangles, hills, discs and spikes. A seeded random number keeps every scene the same each time.

const ZONE_W = 96, ZONE_H = 28;

function zoneCanvas(seed) {
  const g = Array.from({ length: ZONE_H }, () => Array(ZONE_W).fill(null));
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < ZONE_W && y >= 0 && y < ZONE_H) g[y][x] = c; };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
  // Sky in bands from top to bottom.
  const sky = colors => colors.forEach((c, i) => rect(0, Math.floor(i * ZONE_H / colors.length), ZONE_W, Math.ceil(ZONE_H / colors.length) + 1, c));
  // Hills: top edge at base - height(x), filled down to the bottom. cap colors the top `capH` pixels.
  const hills = (base, amp, freq, phase, c, cap, capH = 1) => {
    for (let x = 0; x < ZONE_W; x++) {
      const top = Math.round(base - amp * (Math.sin(x * freq + phase) * 0.6 + Math.sin(x * freq * 2.3 + phase * 1.7) * 0.4));
      for (let y = top; y < ZONE_H; y++) px(x, y, cap && y < top + capH ? cap : c);
    }
  };
  // Rough rock edge hanging from the top (cave ceilings).
  const ceiling = (depth, c) => {
    for (let x = 0; x < ZONE_W; x++) { const d = Math.round(depth * (0.4 + rnd() * 0.6) * (0.6 + 0.4 * Math.sin(x * 0.3))); rect(x, 0, 1, d, c); }
  };
  const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(cx + x, cy + y, c); };
  // A spike (crystal, mountain, spire): width at the base, pointing up (dir -1) or down (dir 1).
  const spike = (x, baseY, w, h, dir, c, hi) => {
    for (let j = 0; j < h; j++) {
      const half = Math.max(0, Math.round((w / 2) * (1 - j / h)));
      for (let i = -half; i <= half; i++) px(x + i, baseY + dir * j, hi && i === -half + 1 ? hi : c);
    }
  };
  const dots = (n, c, yMax = ZONE_H, yMin = 0) => { for (let i = 0; i < n; i++) px(rnd() * ZONE_W, yMin + rnd() * (yMax - yMin), c); };
  return { g, rnd, px, rect, sky, hills, ceiling, disc, spike, dots };
}

const ZONE_SCENES = [
  // 1. Mossy Tunnels: a green cave with hanging vines, moss and mushrooms.
  z => {
    z.sky(["#15251a", "#1b3020", "#213a25", "#1b3020"]);
    z.hills(24, 2, 0.16, 1, "#2a2a22", "#4f8a3a", 2);
    z.ceiling(6, "#2a2a22");
    for (let x = 3; x < ZONE_W; x += 5 + Math.floor(z.rnd() * 5)) {
      const len = 3 + Math.floor(z.rnd() * 8);
      for (let y = 2; y < len; y++) z.px(x + (y % 4 === 0 ? 1 : 0), y, y % 3 ? "#4f8a3a" : "#7cc35a");
    }
    for (let i = 0; i < 6; i++) {
      const x = 6 + Math.floor(z.rnd() * 86);
      z.rect(x, 21, 1, 2, "#e8dcc0");
      z.rect(x - 1, 20, 3, 1, i % 2 ? "#d8432f" : "#c9a060");
    }
    z.dots(10, "#9fe07a", 18, 8);
  },
  // 2. Deep Mine: timber supports, rails and lanterns.
  z => {
    z.sky(["#14131a", "#1a1822", "#201d2a", "#1a1822"]);
    z.hills(23, 1, 0.3, 0, "#2e2620", "#4a3c30", 1);
    z.ceiling(4, "#2e2620");
    for (let x = 4; x < ZONE_W; x += 22) {
      z.rect(x, 4, 2, 19, "#6a4a2a"); z.rect(x + 14, 4, 2, 19, "#6a4a2a");
      z.rect(x - 1, 3, 18, 2, "#7a5a34");
      z.rect(x + 7, 5, 2, 2, "#ffd34d"); z.px(x + 7, 7, "#ffefa0");
    }
    for (let x = 0; x < ZONE_W; x += 3) z.rect(x, 25, 2, 1, "#5a3e24");
    z.rect(0, 24, ZONE_W, 1, "#8a8f98");
    z.dots(6, "#ffd34d", 20, 8);
  },
  // 3. Molten Halls: rock pillars over a river of lava, with floating embers.
  z => {
    z.sky(["#2a0d08", "#3a120a", "#4a180c", "#5a1e0e"]);
    for (let x = 8; x < ZONE_W; x += 18) { z.rect(x, 0, 5, 21, "#3a1a12"); z.rect(x, 0, 1, 21, "#5a2a1a"); }
    z.hills(22, 1, 0.4, 2, "#ff7a1a");
    for (let x = 0; x < ZONE_W; x++) { if ((x + 3) % 7 < 3) z.px(x, 23, "#ffd34d"); if ((x + 1) % 11 < 4) z.px(x, 25, "#ffb020"); }
    z.rect(0, 26, ZONE_W, 2, "#c43a10");
    z.dots(16, "#ffb020", 20, 2);
  },
  // 4. Sky Peak: snowy mountains above the clouds.
  z => {
    z.sky(["#3a5a80", "#4a6e98", "#5f86ae", "#7aa0c4"]);
    for (let x = 4; x < ZONE_W; x += 20) z.spike(x, 27, 26, 18, -1, "#8aa6c4", "#a8c2dc");
    for (let x = 14; x < ZONE_W; x += 24) { z.spike(x, 27, 24, 22, -1, "#4a5a72", "#5f7090"); }
    for (let x = 14; x < ZONE_W; x += 24) z.spike(x, 10, 7, 6, -1, "#f4f8ff");
    for (let i = 0; i < 5; i++) { const x = 4 + i * 20 + Math.floor(z.rnd() * 6); z.rect(x, 20, 12, 2, "#e8f0fa"); z.rect(x + 3, 19, 6, 1, "#ffffff"); }
  },
  // 5. Crystal Caverns: glowing crystals from the floor and ceiling.
  z => {
    z.sky(["#0e1e24", "#132830", "#18323c", "#132830"]);
    z.hills(24, 1, 0.2, 0, "#1e2a30");
    z.ceiling(3, "#1e2a30");
    for (let x = 4; x < ZONE_W; x += 9) {
      const c = x % 2 ? ["#4ae0ff", "#b8f6ff"] : ["#b06ae8", "#e0b8ff"];
      z.spike(x, 24, 4 + (x % 3) * 2, 6 + (x % 5) * 2, -1, c[0], c[1]);
      if (x % 3 === 1) z.spike(x + 4, 2, 4, 5 + (x % 4), 1, c[0], c[1]);
    }
    z.dots(14, "#b8f6ff", 22, 4);
  },
  // 6. Sunken Ruins: broken columns under the sea, with bubbles.
  z => {
    z.sky(["#0e3a40", "#0f4248", "#104a50", "#0c3a3e"]);
    for (let x = 0; x < ZONE_W; x++) if ((x + 2) % 9 < 4) z.px(x, 1, "#4fc2a2");
    z.hills(24, 1, 0.25, 0, "#a89a70", "#c8b888", 1);
    [4, 20, 34, 52, 66, 82].forEach((x, i) => {
      const h = [16, 10, 18, 7, 14, 12][i];
      z.rect(x, 24 - h, 5, h, "#7a8a86"); z.rect(x + 1, 24 - h, 1, h, "#9aaaa6");
      z.rect(x - 1, 24 - h - 1, 7, 2, "#8a9a96");
      if (i % 2) z.rect(x + 5, 22, 3, 2, "#6a7a76");
    });
    z.rect(30, 6, 26, 2, "#8a9a96"); z.rect(30, 8, 2, 2, "#7a8a86"); z.rect(54, 8, 2, 2, "#7a8a86");
    z.dots(14, "#9ff0e0", 22, 2);
    for (let x = 8; x < ZONE_W; x += 13) { z.rect(x, 25, 1, 3, "#2f8a5a"); z.rect(x + 1, 24, 1, 2, "#3fae6a"); }
  },
  // 7. Frostfang Tundra: snowy hills, pine trees and falling snow.
  z => {
    z.sky(["#4a5866", "#5a6a7a", "#6a7c8e", "#7a8ea2"]);
    z.hills(18, 3, 0.09, 0.5, "#b8c8d8", "#dfe8f2", 1);
    for (let x = 6; x < ZONE_W; x += 11) {
      const base = 22 + (x % 3);
      z.spike(x, base, 7, 9, -1, "#1f4a3a", "#2f6a4a");
      z.spike(x, base - 4, 5, 4, -1, "#e8f2fa");
      z.rect(x, base, 1, 2, "#4a3020");
    }
    z.hills(25, 1, 0.2, 2, "#e8f2fa", "#ffffff", 1);
    z.dots(30, "#ffffff", 20, 0);
  },
  // 8. Ember Wastes: a burning sun over dunes and dead trees.
  z => {
    z.sky(["#5a2a14", "#7a3a18", "#9a4a1c", "#b85a20"]);
    z.disc(70, 9, 6, "#ffb020"); z.disc(70, 9, 4, "#ffd34d");
    z.hills(19, 2, 0.11, 1, "#7a3e1c", "#9a5226", 1);
    z.hills(24, 2, 0.08, 3, "#4a2410", "#6a3418", 1);
    [14, 40, 84].forEach(x => {
      z.rect(x, 12, 1, 9, "#2a140a");
      z.px(x - 1, 14, "#2a140a"); z.px(x - 2, 13, "#2a140a"); z.px(x + 1, 15, "#2a140a"); z.px(x + 2, 14, "#2a140a"); z.px(x + 1, 12, "#2a140a");
    });
    z.dots(14, "#ffb020", 24, 2);
  },
  // 9. Shadow Abyss: dark spires, purple fog and glowing eyes.
  z => {
    z.sky(["#100c18", "#161022", "#1c142c", "#140e20"]);
    for (let x = 3; x < ZONE_W; x += 8) z.spike(x, 27, 6, 10 + Math.floor(z.rnd() * 12), -1, "#08060e");
    for (let x = 8; x < ZONE_W; x += 13) z.spike(x, 0, 5, 4 + Math.floor(z.rnd() * 6), 1, "#08060e");
    for (let x = 0; x < ZONE_W; x++) { if ((x + 5) % 13 < 7) z.px(x, 22, "#3a2a5a"); if ((x + 9) % 17 < 9) z.px(x, 24, "#4a3470"); }
    [[20, 12], [55, 9], [80, 15], [38, 17]].forEach(([x, y]) => { z.px(x, y, "#c38aff"); z.px(x + 3, y, "#c38aff"); });
    z.dots(8, "#7a5aaa", 26, 2);
  },
  // 10. Starfall Crown: a starry night, a moon and a golden crown-shaped peak.
  z => {
    z.sky(["#0c0e22", "#12163a", "#1a1f45", "#22285a"]);
    z.dots(50, "#ffffff", 20, 0); z.dots(14, "#ffe94a", 18, 0);
    z.disc(16, 7, 4, "#f4f0d8"); z.disc(18, 6, 3, "#12163a");
    for (let i = 0; i < 8; i++) z.px(60 + i * 2, 3 + i, i < 2 ? "#ffffff" : "#ffe94a");
    z.hills(24, 3, 0.12, 0, "#1a1430");
    [40, 47, 54].forEach((x, i) => z.spike(x, 18, 6, i === 1 ? 9 : 6, -1, "#ffd34d", "#fff0a0"));
    z.rect(36, 18, 23, 4, "#ffd34d"); z.rect(36, 18, 23, 1, "#fff0a0");
    z.px(47, 13, "#ff4fd8"); z.px(40, 15, "#4ae0ff"); z.px(54, 15, "#4ae0ff");
    z.rect(30, 22, 35, 6, "#1a1430");
  },
];

// The SVG for one danger level (1-10). Cached, it never changes.
const zoneArtCache = {};
function zoneArtSVG(tier) {
  if (zoneArtCache[tier]) return zoneArtCache[tier];
  const scene = ZONE_SCENES[tier - 1];
  if (!scene) return "";
  const z = zoneCanvas(tier * 7919 + 13);
  scene(z);
  let rects = "";
  for (let y = 0; y < ZONE_H; y++) {
    let x = 0;
    while (x < ZONE_W) {
      const c = z.g[y][x];
      let end = x + 1;
      while (end < ZONE_W && z.g[y][end] === c) end++;
      if (c) rects += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${c}"/>`;
      x = end;
    }
  }
  const svg = `<svg class="zone-svg" viewBox="0 0 ${ZONE_W} ${ZONE_H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  zoneArtCache[tier] = svg;
  return svg;
}
