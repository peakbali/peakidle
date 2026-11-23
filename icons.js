// ---------- Pixel-art icons ----------
// Small 16x16 pictures for the menu, the tab bar, the panel titles and the header.
// Each icon is a little text map: one letter = one pixel, "." = empty.
// A dark outline is added around every icon automatically, so the maps only hold colors.

const PX_COLORS = {
  k: "#1a1310", // outline
  w: "#7a4a22", W: "#b07a3c", // wood
  s: "#9aa4ad", S: "#dfe5ea", d: "#5c6670", // steel
  g: "#f2b632", G: "#ffe58f", o: "#b0741a", // gold
  p: "#ead8a8", P: "#c4a466", // parchment
  r: "#c8432f", R: "#8e2a1e", // red
  h: "#ece6ff", H: "#a99be0", b: "#2b2140", // ghost
  a: "#ff9a3a", f: "#ffd36b", // fire
  t: "#6b4a2e", T: "#4a3020", // dark wood / door
};

const PX_ICONS = {
  mine: [
    "................",
    "................",
    "...SSSS.........",
    "....ddSSS.......",
    "......ddSS......",
    "........dSS.....",
    ".......W.dSS....",
    "......Ww..dS....",
    ".....Ww....dS...",
    "....Ww.....dS...",
    "...Ww.......S...",
    "..Ww............",
    ".Ww.............",
    "................",
    "................",
    "................",
  ],
  forge: [
    "................",
    "........a.......",
    ".......afa......",
    "........a.......",
    "................",
    ".SSSSSSSSSSSSSS.",
    "..ssssssssssssd.",
    "....dsssssssdd..",
    "......dsssd.....",
    "......dsssd.....",
    ".....ssssssd....",
    "...sssssssssdd..",
    "...ddddddddddd..",
    "................",
    "................",
    "................",
  ],
  hero: [
    "................",
    ".SSSSSSSSSSSSSd.",
    ".SrrrrrggRRRRRd.",
    ".SrrrrrggRRRRRd.",
    ".Sggggggggggood.",
    ".Sggggggggggood.",
    ".SrrrrrggRRRRRd.",
    ".SrrrrrggRRRRRd.",
    "..SrrrrggRRRRd..",
    "..SrrrrggRRRRd..",
    "...SrrrggRRRd...",
    "....SrrggRRd....",
    ".....SrggRd.....",
    "......Sggd......",
    ".......dd.......",
    "................",
  ],
  adventure: [
    "................",
    ".S............S.",
    ".SS..........SS.",
    "..sS........Ss..",
    "...sS......Ss...",
    "....sS....Ss....",
    ".....sS..Ss.....",
    "......sSSs......",
    "......sSSs......",
    "....osS..Sso....",
    ".....o....o.....",
    "....w.o..o.w....",
    "...w........w...",
    "..g..........g..",
    "................",
    "................",
  ],
  merchant: [
    "................",
    "..PpppppppppP...",
    ".PpPPPPPPPPPpP..",
    "..pppppppppppP..",
    "..pPPPPPPP.ppP..",
    "..ppppppppppPP..",
    "..pPPPPP..pppP..",
    "..ppppppppppPP..",
    "..pPPPPPPP.ppP..",
    "..ppppppppppPP..",
    "..pPPPP..rr.pP..",
    "..pppppprRRrpP..",
    ".PpPPPPPPrrPPpP.",
    "..PpppppppppP...",
    "................",
    "................",
  ],
  upgrades: [
    "................",
    ".......G........",
    "......Ggg.......",
    ".....Ggggo......",
    "....Gggggoo.....",
    "...Gggggggoo....",
    "..ooooggooooo...",
    "......ggo.......",
    "......ggo.......",
    "......ggo.......",
    "......ggo.......",
    "......ggo.......",
    "......ooo.......",
    "................",
    "................",
    "................",
  ],
  souls: [
    "................",
    "......hhhh......",
    ".....hhhhhh.....",
    "....hhhhhhhH....",
    "....hbbhhbbH....",
    "....hbbhhbbH....",
    "....hhhhhhhH....",
    "....hhhbbhhH....",
    "....hhhhhhhH....",
    "....hhhhhhhH....",
    "....hhhhhhHH....",
    "....hHhhHhHH....",
    "....H.HH.HH.....",
    "................",
    "................",
    "................",
  ],
  coin: [
    "................",
    "......gggg......",
    "....ggGGGGgg....",
    "...gGGggggGgo...",
    "...gGgGGGGgoo...",
    "..gGggGggggogo..",
    "..gGggGggggogo..",
    "..gGggGggggogo..",
    "..gGggGggggogo..",
    "...gGgoooooooo..",
    "...ggGggggooo...",
    "....ggooooog....",
    "......oooo......",
    "................",
    "................",
    "................",
  ],
  gear: [
    "................",
    "......ss........",
    "..ss.ssss.ss....",
    "..ssssssssss....",
    "...ssdddddss....",
    ".ssssd...dssss..",
    ".sssd.....dsss..",
    "...sd.....ds....",
    ".sssd.....dsss..",
    ".ssssd...dssss..",
    "...ssdddddss....",
    "..ssssssssss....",
    "..ss.ssss.ss....",
    "......ss........",
    "................",
    "................",
  ],
  home: [
    "................",
    ".......rr.......",
    "......rrrr......",
    ".....rrRRrr.....",
    "....rrRRRRrr....",
    "...rrRRRRRRrr...",
    "..rrrrrrrrrrrr..",
    "...WWWWWWWWWW...",
    "...WWWWTTWWWW...",
    "...WWWWTTWWWW...",
    "...WWWWTTWWWW...",
    "...WWWWTTWWWW...",
    "...wwwwTTwwww...",
    "................",
    "................",
    "................",
  ],
};

// Build an SVG for one icon: a dark outline around the colored pixels, then the pixels.
const pxCache = {};
function pxIcon(name, cls = "") {
  const key = name + "|" + cls;
  if (pxCache[key]) return pxCache[key];
  const map = PX_ICONS[name];
  if (!map) return "";
  const H = map.length, W = map[0].length;
  const at = (r, c) => (r >= 0 && r < H && c >= 0 && c < W) ? map[r][c] : ".";
  // Grow the picture by one pixel in every direction for the outline.
  const grid = [];
  for (let r = 0; r < H; r++) {
    grid.push([]);
    for (let c = 0; c < W; c++) {
      let ch = at(r, c);
      if (ch === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => at(r + dr, c + dc) !== ".")) ch = "k";
      grid[r].push(ch);
    }
  }
  // One <rect> per run of same-colored pixels in a row keeps the SVG small.
  let rects = "";
  for (let r = 0; r < H; r++) {
    let c = 0;
    while (c < W) {
      const ch = grid[r][c];
      let end = c + 1;
      while (end < W && grid[r][end] === ch) end++;
      if (ch !== "." && PX_COLORS[ch]) rects += `<rect x="${c}" y="${r}" width="${end - c}" height="1" fill="${PX_COLORS[ch]}"/>`;
      c = end;
    }
  }
  const svg = `<svg class="px-icon ${cls}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  pxCache[key] = svg;
  return svg;
}
