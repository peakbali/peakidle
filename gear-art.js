// ---------- Pixel-art gear pictures ----------
// The sword, the 5 armor pieces and the ring, drawn on a 16x16 pixel grid and colored with their ore's color,
// so copper gear looks orange, mithril gear blue, voidsteel gear purple, and so on.
// Each picture is a little text map: one letter = one pixel, "." = empty.
//   a b c d e = the ore's metal, from darkest to brightest (c is the ore's own color)
//   g         = the ore's gem (sword pommel and guard, helmet crest, chestplate, shield, ring stone)
//   L l       = dark and light leather (sword grip, glove cuff, boot sole)
//   k         = near-black (helmet eye slits)
// A dark outline is added around every picture automatically, like the other pixel icons.
// Needs ORE_COLORS and oaMix from ores-art.js, so this file is loaded after it.

const GEAR_ART = {
  sword: [
    "..............ed",
    ".............edb",
    "............edb.",
    "...........edb..",
    "..........edb...",
    ".........edb....",
    "........edb.....",
    "..dc...edb......",
    "..cdc.edb.......",
    "...cdgdb........",
    "....lLdc........",
    "...lL..cb.......",
    "..lL....b.......",
    ".lL.............",
    "gg..............",
    "g...............",
  ],
  helmet: [
    "................",
    "................",
    "......bggb......",
    "....bccdeecb....",
    "...bccdeeedcb...",
    "..bcccddddcccb..",
    "..bccccccccccb..",
    "..bkkkkbbkkkkb..",
    "..bccccbbccccb..",
    "..bcckcbbckccb..",
    "..bccccbbccccb..",
    "...bcccbbcccb...",
    "....bbbbbbbb....",
    "................",
    "................",
    "................",
  ],
  chestplate: [
    "................",
    "..bcd......dcb..",
    ".bccdb....bdccb.",
    ".bcccdbbbbdcccb.",
    ".bcccddeeddcccb.",
    ".bbccdeeeedccbb.",
    "..bccdeggedccb..",
    "..bccddeeddccb..",
    "..bcccddddcccb..",
    "..baaaaaaaaaab..",
    "..bccccbbccccb..",
    "..bcccb..bcccb..",
    "...bbb....bbb...",
    "................",
    "................",
    "................",
  ],
  gloves: [
    "................",
    "......d.d.d.....",
    ".....cdcdcdc....",
    ".....cdcdcdc....",
    ".....cdcdcdc....",
    "..dc.cccccccb...",
    "..dcccdddddcb...",
    "...bccdeeedcb...",
    "....bcdddddcb...",
    "....bcccccccb...",
    ".....bbbbbbb....",
    ".....lllllll....",
    ".....LLLLLLL....",
    "................",
    "................",
    "................",
  ],
  boots: [
    "................",
    "...bccccb.......",
    "...bcdecb.......",
    "...bcddcb.......",
    "...bcddcb.......",
    "...aaaaaa.......",
    "...bcddcb.......",
    "...bcddcbb......",
    "...bcdddccbb....",
    "...bcddddcccb...",
    "...bccccccccccb.",
    "...bbbbbbbbbbbb.",
    "...LLLLLLLLLLLL.",
    "................",
    "................",
    "................",
  ],
  shield: [
    "................",
    "..bbbbbbbbbbbb..",
    "..beddcbbcccab..",
    "..beddcbbcccab..",
    "..bddccbbcccab..",
    "..bbbbbggbbbbb..",
    "..bdddcbbcccab..",
    "..bddccbbcccab..",
    "...bdccbbccab...",
    "...bdccbbccab...",
    "....bccbbcab....",
    ".....bcbbcb.....",
    "......bbbb......",
    ".......bb.......",
    "................",
    "................",
  ],
  ring: [
    "................",
    "................",
    "......bggb......",
    ".....bgggeb.....",
    "......bggb......",
    ".....bdccdb.....",
    "....bdc..cdb....",
    "...bdc....cbb...",
    "...bc......cb...",
    "...bc......cb...",
    "...bc......ab...",
    "...bdc....cab...",
    "....bdc..cab....",
    ".....bbaaab.....",
    "................",
    "................",
  ],
};

// Gear metal color per ore. Mostly the ore's own color, but a few ores that look alike in the mine
// get a slightly different metal here so every ore's gear is easy to tell apart.
const GEAR_METAL = {
  copper: "#c4673a", iron: "#a9b0b8", gold: "#f5c542", mithril: "#5fb0ff", adamant: "#3ecf5c",
  obsidian: "#4b3468", moonsilver: "#c9d6ff", sunstone: "#ffa21c", starmetal: "#fff0a8", voidsteel: "#7b3cf0",
};
// The little gem set into each ore's gear.
const GEAR_GEM = {
  copper: "#39b8a6", iron: "#d8432f", gold: "#e0283c", mithril: "#ffffff", adamant: "#f5c542",
  obsidian: "#c08bff", moonsilver: "#6fd2ff", sunstone: "#ff3a1a", starmetal: "#4ae0ff", voidsteel: "#ff4fd8",
};

// The 5 metal shades for one ore, plus the fixed colors.
function gearPalette(oreId) {
  const oreColor = GEAR_METAL[oreId] || ORE_COLORS[oreId] || "#9aa4ad";
  return {
    g: GEAR_GEM[oreId] || "#d8432f",
    a: oaMix(oreColor, "#000000", 0.62),
    b: oaMix(oreColor, "#000000", 0.38),
    c: oreColor,
    d: oaMix(oreColor, "#ffffff", 0.38),
    e: oaMix(oreColor, "#ffffff", 0.72),
    L: "#4a2e1a",
    l: "#7a4a28",
    k: "#140e0b",
  };
}

// Build an SVG for one gear type in one ore's colors. Cached, since the same pictures show up often.
const gearArtCache = {};
function gearArtSVG(typeId, oreId) {
  const key = typeId + "|" + oreId;
  if (gearArtCache[key]) return gearArtCache[key];
  const map = GEAR_ART[typeId];
  if (!map) return "";
  const svg = pixelArtSVG(map, gearPalette(oreId), "gear-art");
  gearArtCache[key] = svg;
  return svg;
}

// Turn a text map into an SVG. colors maps each letter to a color; a dark outline is added around
// the picture and it is centered top to bottom. Also used by the skill pictures (skill-art.js).
// classes (optional) gives some letters a CSS class, e.g. { E: "m-eye" } so glowing eyes can pulse.
function pixelArtSVG(map, pal, className, classes = null) {
  const { rects, H, W, shift } = pixelArtRects(map, pal, classes);
  return `<svg class="${className}" viewBox="0 ${-shift} ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

// The <rect>s of a text map with its outline, without the <svg> around them. The outline adds one
// pixel on every side, so map pixel (col, row) is drawn at (col + 1, row + 1).
// shift is how far to move it down to center it top to bottom.
function pixelArtRects(map, pal, classes = null) {
  // One pixel of room on every side for the outline.
  const H = map.length + 2, W = map[0].length + 2;
  const at = (r, c) => (r >= 1 && r <= map.length && c >= 1 && c <= map[0].length) ? map[r - 1][c - 1] : ".";
  const grid = [];
  for (let r = 0; r < H; r++) {
    grid.push([]);
    for (let c = 0; c < W; c++) {
      let ch = at(r, c);
      if (ch === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => at(r + dr, c + dc) !== ".")) ch = "O";
      grid[r].push(ch);
    }
  }
  const colors = { ...pal, O: "#120c09" };
  let rects = "";
  for (let r = 0; r < H; r++) {
    let c = 0;
    while (c < W) {
      const ch = grid[r][c];
      let end = c + 1;
      while (end < W && grid[r][end] === ch) end++;
      const cls = classes && classes[ch] ? ` class="${classes[ch]}"` : "";
      if (ch !== "." && colors[ch]) rects += `<rect x="${c}" y="${r}" width="${end - c}" height="1" fill="${colors[ch]}"${cls}/>`;
      c = end;
    }
  }
  // Center the picture top to bottom (most maps leave empty rows at the bottom).
  const used = grid.map(row => row.some(ch => ch !== "."));
  const top = used.indexOf(true), bottom = used.lastIndexOf(true);
  const shift = Math.round((H - (bottom - top + 1)) / 2) - top;
  return { rects, H, W, shift };
}
