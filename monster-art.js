// ---------- Monsters and bosses: soft, round, fluffy pixel art ----------
// Every creature and boss is painted in code with the fluffy pixel painter (monster-pix.js):
// round furry bodies, a sketchy outline, soft shading, little dot eyes and pink cheeks.
//
// Random monsters (36x36) are colored by their element, so a "Blazing Rat" is a warm orange
// fluffball and a "Frozen Rat" an icy blue one. Their colors (materials):
//   m  = main fur (the element's color)     m2 = darker accent fur (stripes, ears, wings)
//   bl = light belly and face fur           ink = eyes, mouths and sketch marks
//   pink, beak, bone, white, dark, skin, stone = the same for every element
//   gl = the element's magic glow (flames, sparks)
// Bosses (64x64) have their own colors in `pal`, a name, a short description and a backstory.
//
// `anim` picks the creature's idle animation (see "Monster art" in style.css):
//   breathe, hop, float, flap, scuttle, sway, pulse
// Needs PixPainter from monster-pix.js.

// Soft fur colors for each element: [main, accent, glow].
const MONSTER_FUR = {
  fire:      ["#ff8f45", "#e5483a", "#ffd34a"],
  ice:       ["#6fc6f7", "#3d7fe0", "#e0f8ff"],
  wind:      ["#72de8e", "#2fa56e", "#dcffe6"],
  earth:     ["#d9a066", "#9c6336", "#ffe08a"],
  lightning: ["#ffdb3d", "#f29c1f", "#fff8b0"],
};
const MONSTER_FIXED = {
  ink: { c: "#3a241c", flat: true },
  pink: { c: "#f2a2ae", smooth: true },
  beak: { c: "#f2a646", smooth: true },
  bone: { c: "#f1e6cc", smooth: true },
  white: "#f7f1e8",
  dark: "#4e4048",
  skin: { c: "#f2cba8", smooth: true },
  stone: { c: "#9a9290", smooth: true },
  moss: "#86b45a",
  red: { c: "#d8505a", smooth: true },
};

function monsterMats(element) {
  const [m, m2, gl] = MONSTER_FUR[element] || MONSTER_FUR.earth;
  return { m, m2, bl: pxMix(m, "#fff6dc", 0.72), gl: { c: gl, smooth: true }, ...MONSTER_FIXED };
}

// ----- Little helpers used by many creatures -----
// Two stubby feet.
function pxFeet(p, cx, y, gap, mat = "m", rx = 2.4) {
  p.ell(cx - gap, y, rx, 1.5, mat, { flat: false });
  p.ell(cx + gap, y, rx, 1.5, mat, { flat: false });
}
// A face: eyes, cheeks and a mouth ("w" cat mouth, "smile", "o", "fang", "flat", "none").
// Placed on the grid, then drawn in whole pixels so tiny faces stay neat.
const PX_MOUTHS = {
  w: [[-2, 0], [-1, 1], [0, 0], [1, 1], [2, 0]],
  smile: [[-1, 0], [0, 1], [1, 0]],
  flat: [[-1, 0], [0, 0], [1, 0]],
  fang: [[-1, 0], [0, 0], [1, 0], [2, 0]],
  o: [[0, 0], [1, 0], [0, 1], [1, 1]],
};
function pxFace(p, cx, y, gap, mouth = "w", o = {}) {
  const k = p.s, size = o.big ? 3 : o.size || 2;
  const X = Math.round(cx * k), Y = Math.round(y * k), G = Math.max(2, Math.round(gap * k));
  p.s = 1;
  const lx = X - Math.floor(G / 2) - size, rx = X + Math.ceil(G / 2);
  p.eye(lx, Y, o); p.eye(rx, Y, o);
  if (!o.noBlush) { p.blush(lx - 2, Y + size, 2); p.blush(rx + size, Y + size, 2); }
  const my = Y + size + Math.max(0, Math.round(((o.mouthDrop || 1) - 1) * k));
  const pts = PX_MOUTHS[mouth];
  if (pts) for (const [dx, dy] of pts) p.dot(X + dx - (mouth === "o" || mouth === "fang" ? 1 : 0), my + dy, mouth === "o" ? "red" : "ink");
  if (mouth === "fang") { p.dot(X - 2, my + 1, "white"); p.dot(X + 1, my + 1, "white"); }
  p.s = k;
}
// A pointy horn from (x, y) going up, bent a little to one side.
function pxHorn(p, x, y, h, lean, mat = "bone", w = 2) {
  p.poly([[x - w, y], [x + w, y], [x + lean + 0.5, y - h], [x + lean - 0.5, y - h]], mat);
}
// A spark or twinkle on the glow layer.
function pxSpark(p, x, y, mat = "gl") {
  p.glow(() => { p.dot(x, y, mat); p.dot(x - 1, y, mat, { same: true }); p.dot(x + 1, y, mat, { same: true }); p.dot(x, y - 1, mat, { same: true }); p.dot(x, y + 1, mat, { same: true }); });
}

const MONSTER_ART = {
  // ----- Danger level 1: Mossy Tunnels -----
  rat: { anim: "breathe", draw(p) {
    p.line(26, 29, 31, 27, "pink", { w: 2, edge: false }); p.line(31, 27, 33, 22, "pink", { w: 1, same: true });
    p.fur(10, 9, 4.5, 4.5, "m"); p.ell(10, 9.5, 2.4, 2.6, "pink", { edge: false });
    p.fur(26, 9, 4.5, 4.5, "m"); p.ell(26, 9.5, 2.4, 2.6, "pink", { edge: false });
    p.fur(18, 21, 11, 11, "m");
    p.fur(18, 26, 6.5, 5, "bl", { edge: false, fuzz: 0.8 });
    pxFace(p, 18, 17, 7, "w");
    pxFeet(p, 18, 32, 5, "m");
  } },
  beetle: { anim: "scuttle", draw(p) {
    for (const x of [8, 13, 23, 28]) p.line(x, 26, x + (x < 18 ? -2 : 2), 32, "dark", { w: 2 });
    p.line(14, 8, 10, 3, "dark"); p.line(22, 8, 26, 3, "dark");
    p.ell(9.5, 2.5, 1.5, 1.5, "m2"); p.ell(26.5, 2.5, 1.5, 1.5, "m2");
    p.fur(18, 13, 7, 5.5, "bl");
    p.ell(18, 23, 13, 9.5, "m", { flat: true });
    p.line(18, 15, 18, 32, "m2", { w: 1, same: true });
    p.ell(12, 19, 3, 1.4, "white", { edge: false, flat: true });
    p.tint(10, 19, "#ffffff"); p.tint(11, 18, "#ffffff");
    for (const [x, y] of [[11, 26], [13, 23], [24, 22], [26, 27], [22, 28]]) p.ell(x, y, 1.3, 1.3, "m2", { edge: false, same: false });
    pxFace(p, 18, 11, 5, "smile");
  } },
  bat: { anim: "flap", draw(p) {
    p.poly([[11, 14], [1, 8], [0, 22], [3, 19], [5, 23], [8, 20], [11, 24]], "m2");
    p.poly([[25, 14], [35, 8], [36, 22], [33, 19], [31, 23], [28, 20], [25, 24]], "m2");
    p.poly([[9, 13], [10, 3], [15, 9]], "m"); p.poly([[11, 11], [11, 6], [13, 9]], "pink", { edge: false });
    p.poly([[27, 13], [26, 3], [21, 9]], "m"); p.poly([[25, 11], [25, 6], [23, 9]], "pink", { edge: false });
    p.fur(18, 19, 9.5, 9.5, "m");
    p.fur(18, 23, 5.5, 4.5, "bl", { edge: false, fuzz: 0.8 });
    pxFace(p, 18, 16, 6, "fang");
    pxFeet(p, 18, 29, 3, "dark", 1.4);
  } },
  slime: { anim: "hop", draw(p) {
    p.fur(18, 22, 13, 10, "m", { fuzz: 0.6, tufts: 18 });
    p.poly([[18, 6], [23, 13], [13, 13]], "m", { same: true });
    p.ell(11, 16, 2.4, 1.6, "white", { edge: false }); p.ell(14, 14, 1, 1, "white", { edge: false });
    p.fur(18, 28, 9, 3.5, "bl", { edge: false, fuzz: 0.5 });
    pxFace(p, 18, 21, 8, "o");
  } },

  // ----- Danger level 2: Deep Mine -----
  lizard: { anim: "scuttle", draw(p) {
    p.poly([[24, 27], [34, 30], [35, 25], [32, 22], [31, 26], [24, 23]], "m");
    for (const [x, y] of [[12, 6], [17, 4], [22, 6], [27, 11]]) p.poly([[x - 2, y + 4], [x, y], [x + 2, y + 4]], "m2");
    p.fur(17, 20, 11, 11, "m", { fuzz: 0.7 });
    p.fur(16, 26, 7, 5, "bl", { edge: false, fuzz: 0.6 });
    pxFace(p, 16, 15, 9, "smile", { big: true });
    pxFeet(p, 17, 32, 6, "m");
  } },
  golem: { anim: "breathe", draw(p) {
    p.rect(4, 16, 6, 11, "stone"); p.rect(26, 16, 6, 11, "stone");
    p.rect(9, 8, 18, 22, "stone");
    for (const [x, y] of [[11, 20], [22, 25], [24, 12], [12, 27]]) p.dot(x, y, "dark");
    p.line(16, 26, 20, 29, "dark", { edge: false });
    p.fur(18, 8, 10.5, 4.5, "m", { flatBottom: false });
    p.fur(6, 15, 3.5, 2.5, "m"); p.fur(29, 15, 3.5, 2.5, "m");
    p.glow(() => { p.ell(18, 22, 3, 3, "gl"); });
    pxFace(p, 18, 13, 6, "flat", { lid: "stone" });
    p.rect(10, 30, 6, 3, "stone"); p.rect(20, 30, 6, 3, "stone");
  } },
  imp: { anim: "float", draw(p) {
    p.poly([[10, 18], [1, 11], [2, 20], [5, 18], [6, 23], [10, 22]], "m2");
    p.poly([[26, 18], [35, 11], [34, 20], [31, 18], [30, 23], [26, 22]], "m2");
    p.line(22, 29, 30, 30, "m2", { w: 1 }); p.poly([[29, 27], [33, 30], [29, 32]], "m2", { same: true });
    pxHorn(p, 12, 9, 6, -2); pxHorn(p, 24, 9, 6, 2);
    p.fur(18, 18, 9.5, 10, "m");
    p.fur(18, 23, 5, 4.5, "bl", { edge: false, fuzz: 0.7 });
    pxFace(p, 18, 15, 6, "fang");
    p.ell(13, 29, 1.8, 1.4, "m"); p.ell(23, 29, 1.8, 1.4, "m");
  } },
  eel: { anim: "sway", draw(p) {
    p.fur(25, 29, 8, 3.5, "m", { fuzz: 0.7 });
    p.fur(13, 27, 6, 4, "m", { fuzz: 0.7, same: true });
    p.fur(10, 21, 4.5, 4.5, "m", { fuzz: 0.7, same: true });
    p.poly([[8, 9], [4, 4], [6, 12]], "m2"); p.poly([[24, 9], [28, 4], [26, 12]], "m2");
    p.fur(16, 13, 9, 7.5, "m");
    p.fur(16, 17, 5, 3, "bl", { edge: false, fuzz: 0.6 });
    for (const x of [20, 24, 28]) p.poly([[x - 1, 27], [x + 1, 22], [x + 2, 27]], "m2");
    pxFace(p, 16, 11, 6, "o");
  } },

  // ----- Danger level 3: Molten Halls -----
  hound: { anim: "breathe", draw(p) {
    p.line(28, 24, 32, 18, "m", { w: 2 }); p.fur(32, 17, 2, 2, "m", { same: true });
    p.fur(19, 24, 10, 8, "m");
    p.fur(17, 13, 9, 8, "m");
    p.fur(8, 14, 3, 6, "m2"); p.fur(26, 14, 3, 6, "m2");
    p.fur(17, 17, 5, 3.5, "bl", { edge: false, fuzz: 0.6 });
    pxFace(p, 17, 11, 6, "w", { mouthDrop: 2 });
    p.ell(17, 15.5, 1.3, 1, "ink", { edge: false });
    pxFeet(p, 18, 32, 5, "m");
  } },
  hawk: { anim: "flap", draw(p) {
    p.poly([[10, 15], [1, 20], [3, 23], [1, 26], [6, 27], [11, 26]], "m2");
    p.poly([[26, 15], [35, 20], [33, 23], [35, 26], [30, 27], [25, 26]], "m2");
    p.poly([[15, 7], [16, 1], [18, 6], [21, 2], [21, 8]], "m2");
    p.fur(18, 18, 10, 11, "m");
    p.fur(18, 23, 6, 6, "bl", { edge: false });
    pxFace(p, 18, 14, 7, "none");
    p.poly([[16, 17], [20, 17], [18, 21]], "beak");
    p.line(15, 30, 15, 33, "beak", { w: 1 }); p.line(21, 30, 21, 33, "beak", { w: 1 });
    p.dot(14, 33, "beak"); p.dot(16, 33, "beak"); p.dot(20, 33, "beak"); p.dot(22, 33, "beak");
  } },
  spider: { anim: "scuttle", draw(p) {
    p.mirror(18, (f) => {
      for (const [a, b, c, d] of [[12, 18, 3, 12], [11, 21, 2, 22], [11, 24, 3, 30], [13, 27, 7, 33]]) {
        p.line(f(a), b, f(c), d, "dark", { w: 2 });
      }
    });
    p.fur(18, 21, 10, 10, "m");
    p.fur(18, 10, 4, 3, "m2");
    pxFace(p, 18, 17, 6, "fang");
    p.eye(14, 14, { size: 1 }); p.eye(21, 14, { size: 1 });
    p.fur(18, 28, 4, 2, "m2", { edge: false, fuzz: 0.5 });
  } },
  harpy: { anim: "flap", draw(p) {
    p.poly([[10, 14], [0, 10], [2, 16], [0, 19], [4, 21], [2, 24], [10, 24]], "m2");
    p.poly([[26, 14], [36, 10], [34, 16], [36, 19], [32, 21], [34, 24], [26, 24]], "m2");
    p.fur(18, 22, 9, 10, "m");
    p.fur(18, 12, 9, 8, "m2");
    p.ell(18, 14, 6, 5, "skin", { edge: false });
    p.fur(18, 7, 8, 3, "m2", { same: false, edge: false });
    pxFace(p, 18, 13, 5, "smile", { lid: "skin" });
    p.fur(18, 25, 5, 5, "bl", { edge: false });
    p.line(15, 31, 15, 33, "beak"); p.line(21, 31, 21, 33, "beak");
    p.dot(14, 33, "beak"); p.dot(22, 33, "beak");
  } },

  // ----- Danger level 4: Sky Peak -----
  giant: { anim: "breathe", draw(p) {
    p.fur(5, 22, 3.5, 6, "m"); p.fur(31, 22, 3.5, 6, "m");
    p.fur(18, 20, 13, 13, "m", { fuzz: 1.6 });
    p.ell(18, 16, 7, 5.5, "skin", { edge: true });
    p.fur(18, 10, 8, 3, "m", { edge: false, fuzz: 1.4 });
    pxFace(p, 18, 15, 6, "fang", { lid: "skin" });
    pxHorn(p, 9, 9, 5, -2); pxHorn(p, 27, 9, 5, 2);
    pxFeet(p, 18, 33, 6, "m", 3);
  } },
  behemoth: { anim: "breathe", draw(p) {
    p.fur(21, 21, 13, 10, "m");
    p.fur(9, 20, 8, 7.5, "m");
    pxHorn(p, 4, 18, 8, -2, "bone", 2.2); pxHorn(p, 9, 14, 4, 0, "bone", 1.4);
    p.fur(28, 12, 2.5, 2.5, "m2"); p.fur(15, 12, 2.5, 2.5, "m2");
    p.fur(9, 24, 5, 3, "bl", { edge: false });
    p.eye(7, 18); p.eye(12, 18); p.blush(5, 21, 2); p.blush(13, 21, 2);
    p.dot(9, 25, "ink"); p.dot(10, 25, "ink");
    for (const x of [12, 18, 26, 31]) p.rect(x - 2, 29, 4, 4, "m2");
  } },
  djinn: { anim: "float", draw(p) {
    p.fur(18, 29, 3.5, 3, "m", { fuzz: 0.8 }); p.fur(22, 33, 2.5, 2, "m", { same: true, fuzz: 0.6 });
    p.fur(18, 24, 6, 5, "m", { same: true });
    p.fur(18, 15, 9.5, 9, "m");
    p.ell(18, 6.5, 6, 3, "m2", { flat: true });
    p.glow(() => { p.ell(18, 6, 1.6, 1.6, "gl", { edge: false }); });
    p.fur(8, 19, 3, 2.5, "m"); p.fur(28, 19, 3, 2.5, "m");
    p.line(11, 22, 25, 22, "m2", { w: 2, edge: true });
    pxFace(p, 18, 13, 6, "smile");
    pxSpark(p, 4, 9); pxSpark(p, 31, 26);
  } },
  titan: { anim: "breathe", draw(p) {
    p.fur(18, 21, 12, 12, "m");
    p.fur(18, 8, 11, 4.5, "white", { flatBottom: false });
    p.glow(() => {
      for (const x of [11, 18, 25]) p.poly([[x - 2, 6], [x, 0], [x + 2, 6]], "gl");
    });
    p.fur(18, 26, 6, 5, "bl", { edge: false });
    pxFace(p, 18, 16, 7, "flat");
    p.line(8, 22, 5, 28, "m2", { w: 3 }); p.line(28, 22, 31, 28, "m2", { w: 3 });
    pxFeet(p, 18, 33, 5, "m", 3);
  } },

  // ----- Danger level 5: Crystal Caverns -----
  hedgehog: { anim: "breathe", draw(p) {
    for (let k = 0; k < 11; k++) {
      const a = Math.PI * (0.95 + k * 0.105), x = 20 + Math.cos(a) * 11, y = 21 + Math.sin(a) * 11;
      p.poly([[20 + Math.cos(a - 0.2) * 8, 21 + Math.sin(a - 0.2) * 8], [x + Math.cos(a) * 4, y + Math.sin(a) * 4], [20 + Math.cos(a + 0.2) * 8, 21 + Math.sin(a + 0.2) * 8]], "m2");
    }
    p.fur(20, 22, 11, 10, "m2");
    p.fur(14, 24, 8, 7.5, "bl");
    pxFace(p, 13, 21, 5, "smile");
    p.ell(8, 25, 1.2, 1, "ink", { edge: false });
    pxFeet(p, 18, 32, 6, "bl", 2);
  } },
  snail: { anim: "sway", draw(p) {
    p.fur(17, 28, 14, 4, "bl", { fuzz: 0.8 });
    p.line(6, 18, 4, 9, "bl", { w: 2 }); p.line(10, 18, 11, 9, "bl", { w: 2 });
    p.ell(4, 8, 1.6, 1.6, "ink"); p.ell(11, 8, 1.6, 1.6, "ink");
    p.fur(7, 22, 5, 6, "bl");
    p.fur(22, 18, 10, 10, "m");
    p.line(22, 18, 25, 18, "m2", { same: true, w: 2 }); p.line(25, 18, 25, 13, "m2", { same: true, w: 2 });
    p.line(25, 13, 19, 12, "m2", { same: true, w: 2 }); p.line(19, 12, 15, 17, "m2", { same: true, w: 2 });
    p.line(15, 17, 18, 24, "m2", { same: true, w: 2 }); p.line(18, 24, 27, 24, "m2", { same: true, w: 2 });
    p.line(27, 24, 30, 16, "m2", { same: true, w: 2 });
    p.eye(4, 22); p.eye(9, 22); p.blush(3, 25, 2); p.blush(10, 25, 2); p.dot(7, 26, "ink"); p.dot(6, 25, "ink"); p.dot(8, 25, "ink");
  } },
  scorpion: { anim: "scuttle", draw(p) {
    p.line(26, 24, 31, 16, "m", { w: 3 }); p.line(31, 16, 28, 8, "m", { w: 3, same: true }); p.line(28, 8, 22, 6, "m", { w: 3, same: true });
    p.poly([[22, 4], [17, 7], [22, 9]], "m2");
    p.mirror(17, (f) => { p.line(f(10), 27, f(6), 32, "m2", { w: 2 }); p.line(f(13), 28, f(11), 33, "m2", { w: 2 }); });
    p.line(9, 20, 5, 15, "m2", { w: 2 }); p.fur(4, 12, 3.5, 3, "m2"); p.dot(4, 10, "dark");
    p.line(25, 20, 29, 15, "m2", { w: 2 });
    p.fur(17, 23, 10, 8, "m");
    p.fur(17, 27, 6, 3, "bl", { edge: false, fuzz: 0.6 });
    pxFace(p, 17, 20, 6, "smile");
  } },
  wisp: { anim: "pulse", draw(p) {
    p.glow(() => {
      p.poly([[18, 1], [24, 12], [26, 20], [18, 31], [10, 20], [12, 12]], "gl", { edge: true });
      p.poly([[12, 6], [15, 12], [11, 14]], "gl", { same: true });
      p.poly([[25, 5], [24, 13], [21, 11]], "gl", { same: true });
    });
    p.fur(18, 22, 8.5, 8.5, "m", { fuzz: 1.6 });
    p.fur(18, 24, 5, 4.5, "white", { edge: false, fuzz: 1 });
    pxFace(p, 18, 20, 5, "o", { mouthDrop: 1 });
    pxSpark(p, 4, 26); pxSpark(p, 31, 20); pxSpark(p, 30, 32);
  } },

  // ----- Danger level 6: Sunken Ruins -----
  crab: { anim: "scuttle", draw(p) {
    p.mirror(18, (f) => {
      for (const x of [9, 12]) p.line(f(x), 25, f(x - 4), 32, "m2", { w: 2 });
      p.line(f(8), 20, f(5), 15, "m", { w: 2 });
      p.fur(f(5), 11, 4, 4, "m");
      p.poly([[f(5), 9], [f(5), 6], [f(8) - 0.5 * (f(8) - f(5)), 11]], "bl", { edge: false });
      p.line(f(14), 13, f(13), 8, "m2", { w: 1 });
    });
    p.fur(18, 22, 11, 8, "m");
    p.fur(18, 26, 6, 3, "bl", { edge: false, fuzz: 0.6 });
    p.eye(12, 6); p.eye(23, 6);
    p.cheeks(18, 22, 10, 2);
    pxFace(p, 18, 17, 6, "smile", { noBlush: true });
  } },
  ghoul: { anim: "sway", draw(p) {
    p.fur(18, 22, 10, 11, "m", { fuzz: 1.6 });
    p.fur(18, 12, 9, 8, "m", { same: true });
    p.line(6, 20, 3, 25, "m", { w: 3 }); p.fur(3, 26, 2.2, 2, "m", { same: true });
    p.line(30, 20, 33, 25, "m", { w: 3 }); p.fur(33, 26, 2.2, 2, "m", { same: true });
    p.ell(18, 13, 6, 5, "bl", { edge: false });
    p.eye(13, 11, { big: true }); p.eye(21, 12, { size: 2 });
    p.blush(12, 15, 2); p.blush(23, 15, 2);
    p.line(14, 17, 21, 17, "ink"); p.dot(16, 18, "ink"); p.dot(19, 18, "ink");
    p.line(27, 6, 25, 11, "ink"); p.line(24, 7, 28, 9, "ink");
    p.fur(18, 7, 8, 2.5, "m2", { edge: false, fuzz: 1.4 });
    pxFeet(p, 18, 33, 5, "m", 2.5);
  } },
  shark: { anim: "sway", draw(p) {
    p.poly([[27, 20], [35, 13], [33, 22], [35, 30], [27, 25]], "m2");
    p.poly([[15, 10], [19, 1], [22, 11]], "m2");
    p.fur(16, 21, 13, 10, "m", { fuzz: 0.8 });
    p.fur(15, 26, 9, 5, "bl", { edge: false, fuzz: 0.6 });
    pxFace(p, 12, 17, 8, "none");
    for (let x = 9; x <= 16; x++) p.dot(x, 22, "ink");
    for (const x of [9, 11, 13, 15]) p.dot(x, 23, "white");
  } },
  squid: { anim: "float", draw(p) {
    for (const [x, bend] of [[9, -3], [14, -2], [22, 2], [27, 3]]) {
      p.fur(x, 23, 2.6, 2.6, "m", { fuzz: 0.6 }); p.fur(x + bend * 0.4, 27, 2.2, 2.2, "m", { fuzz: 0.5, same: true });
      p.fur(x + bend, 30.5, 1.8, 1.8, "m", { fuzz: 0.4, same: true });
    }
    p.fur(18, 25, 2.8, 4, "m", { fuzz: 0.6 });
    p.poly([[18, 0], [28, 11], [8, 11]], "m2");
    p.fur(18, 15, 11, 9, "m");
    p.fur(18, 20, 7, 3, "bl", { edge: false, fuzz: 0.6 });
    pxFace(p, 18, 14, 7, "o");
  } },

  // ----- Danger level 7: Frostfang Tundra -----
  mammoth: { anim: "breathe", draw(p) {
    p.fur(22, 20, 12, 10, "m");
    for (const x of [14, 20, 26, 31]) p.rect(x - 2, 27, 4, 6, "m2");
    p.fur(6, 17, 4.5, 6.5, "m2"); p.fur(25, 17, 4.5, 6.5, "m2");
    p.fur(15, 16, 9, 8.5, "m");
    p.line(15, 22, 15, 29, "m", { w: 3 }); p.line(15, 29, 17, 31, "m", { w: 2, same: true });
    p.line(11, 22, 9, 27, "bone", { w: 2 }); p.line(19, 22, 21, 27, "bone", { w: 2 });
    p.fur(15, 9, 5, 2.5, "m2", { edge: false });
    pxFace(p, 15, 14, 6, "none");
  } },
  owl: { anim: "breathe", draw(p) {
    p.poly([[8, 12], [7, 3], [13, 9]], "m2"); p.poly([[28, 12], [29, 3], [23, 9]], "m2");
    p.fur(18, 19, 11, 12, "m");
    p.fur(6, 21, 3, 6, "m2"); p.fur(30, 21, 3, 6, "m2");
    p.fur(18, 25, 7, 6, "bl", { edge: false });
    p.ell(13, 14, 4, 4, "white"); p.ell(23, 14, 4, 4, "white");
    p.eye(12, 13, { big: true }); p.eye(22, 13, { big: true });
    p.poly([[17, 17], [19, 17], [18, 20]], "beak");
    p.line(14, 31, 14, 33, "beak"); p.line(22, 31, 22, 33, "beak");
  } },
  bear: { anim: "breathe", draw(p) {
    p.fur(9, 7, 3.5, 3.5, "m"); p.ell(9, 7.5, 1.6, 1.6, "m2", { edge: false });
    p.fur(27, 7, 3.5, 3.5, "m"); p.ell(27, 7.5, 1.6, 1.6, "m2", { edge: false });
    p.fur(18, 20, 12, 12.5, "m");
    p.fur(18, 26, 7, 5.5, "bl", { edge: false });
    p.ell(18, 17, 3.6, 2.6, "bl", { edge: false, flat: true });
    pxFace(p, 18, 12, 8, "smile", { mouthDrop: 3 });
    p.fur(6, 22, 2.5, 4, "m"); p.fur(30, 22, 2.5, 4, "m");
    pxFeet(p, 18, 32, 6, "m", 2.8);
  } },
  walrus: { anim: "breathe", draw(p) {
    p.poly([[4, 30], [0, 33], [8, 33]], "m2"); p.poly([[32, 30], [36, 33], [28, 33]], "m2");
    p.fur(18, 21, 13, 12, "m", { fuzz: 1 });
    p.ell(14.5, 20, 3.4, 2.5, "bl", { edge: false }); p.ell(21.5, 20, 3.4, 2.5, "bl", { edge: false });
    p.line(15, 22, 14.5, 26, "bone", { w: 2 }); p.line(21, 22, 21.5, 26, "bone", { w: 2 });
    for (const [x, y] of [[12, 20], [13, 21], [23, 20], [24, 21]]) p.dot(x, y, "ink");
    p.ell(18, 18, 1.6, 1.1, "ink", { edge: false });
    pxFace(p, 18, 13, 8, "none");
  } },

  // ----- Danger level 8: Ember Wastes -----
  fire_ant: { anim: "scuttle", draw(p) {
    for (const x of [13, 18, 23]) { p.line(x, 23, x - 3, 31, "dark", { w: 1 }); p.line(x, 23, x + 3, 31, "dark", { w: 1 }); }
    p.fur(27, 22, 7, 6.5, "m");
    p.fur(18, 22, 4, 3.5, "m2");
    p.line(6, 10, 3, 3, "dark"); p.line(10, 10, 12, 3, "dark");
    p.ell(3, 3, 1.3, 1.3, "m2"); p.ell(12, 3, 1.3, 1.3, "m2");
    p.fur(9, 16, 7.5, 7, "m");
    p.fur(9, 20, 4, 2.5, "bl", { edge: false, fuzz: 0.6 });
    pxFace(p, 9, 14, 5, "smile");
    p.dot(5, 21, "bone"); p.dot(12, 21, "bone");
  } },
  raptor: { anim: "breathe", draw(p) {
    p.poly([[24, 22], [35, 30], [34, 26], [27, 18]], "m");
    for (const [x, y] of [[20, 8], [24, 11], [27, 15]]) p.poly([[x - 2, y + 3], [x + 1, y - 2], [x + 2, y + 3]], "m2");
    p.fur(20, 23, 8.5, 9, "m");
    p.fur(14, 12, 9.5, 8, "m");
    p.fur(13, 16, 6, 3, "bl", { edge: false, fuzz: 0.6 });
    pxFace(p, 13, 10, 7, "smile");
    p.dot(9, 17, "white"); p.dot(16, 17, "white");
    p.line(14, 21, 11, 23, "m", { w: 2 }); p.line(14, 24, 12, 26, "m", { w: 2, same: true });
    p.fur(19, 26, 4, 4, "bl", { edge: false });
    pxFeet(p, 20, 32, 5, "m", 2.6);
  } },
  mantis: { anim: "sway", draw(p) {
    p.line(13, 26, 8, 33, "m2", { w: 1 }); p.line(23, 26, 28, 33, "m2", { w: 1 });
    p.fur(18, 25, 7, 7, "m");
    p.poly([[13, 9], [23, 9], [21, 18], [15, 18]], "m");
    p.line(13, 20, 6, 14, "m2", { w: 2 }); p.poly([[6, 14], [2, 22], [5, 22], [8, 16]], "m2", { same: true });
    p.line(23, 20, 30, 14, "m2", { w: 2 }); p.poly([[30, 14], [34, 22], [31, 22], [28, 16]], "m2", { same: true });
    p.line(13, 4, 9, 0, "m2"); p.line(23, 4, 27, 0, "m2");
    p.fur(18, 9, 8.5, 5.5, "m");
    p.eye(10, 6, { big: true, white: "#fffde8" }); p.eye(23, 6, { big: true, white: "#fffde8" });
    p.cheeks(18, 11, 9, 2); p.dot(17, 12, "ink"); p.dot(18, 12, "ink");
    p.fur(18, 27, 4, 3.5, "bl", { edge: false });
  } },
  boar: { anim: "breathe", draw(p) {
    for (let k = 0; k < 6; k++) p.poly([[14 + k * 3, 11], [16 + k * 3, 5 + (k % 2)], [18 + k * 3, 11]], "m2");
    p.fur(20, 20, 13, 11, "m");
    p.poly([[9, 10], [7, 4], [13, 8]], "m2");
    p.ell(9, 22, 4, 3, "pink");
    p.dot(8, 22, "ink"); p.dot(10, 22, "ink");
    p.poly([[5, 24], [3, 18], [6, 21]], "bone"); p.poly([[13, 24], [15, 18], [12, 21]], "bone");
    p.eye(6, 16); p.eye(12, 16); p.blush(4, 19, 2); p.blush(14, 19, 2);
    for (const x of [12, 18, 25, 30]) p.rect(x - 2, 29, 4, 4, "m2");
  } },

  // ----- Danger level 9: Shadow Abyss -----
  wraith: { anim: "float", draw(p) {
    p.poly([[7, 18], [7, 32], [11, 29], [14, 33], [18, 29], [22, 33], [25, 29], [29, 32], [29, 18]], "m");
    p.fur(18, 16, 11, 12, "m", { same: true });
    p.ell(18, 17, 6.5, 6, "dark", { edge: true, flat: true });
    p.glow(() => { p.eye(14, 15); p.eye(20, 15); });
    p.eye(14, 15, { ink: pxMix(MONSTER_FUR.ice[2], "#ffffff", 0.5), hi: "#ffffff" }); p.eye(20, 15, { ink: pxMix(MONSTER_FUR.ice[2], "#ffffff", 0.5), hi: "#ffffff" });
    p.dot(17, 20, "pink"); p.dot(18, 20, "pink");
    p.line(4, 21, 8, 24, "m", { w: 2 }); p.line(32, 21, 28, 24, "m", { w: 2 });
  } },
  shade: { anim: "float", draw(p) {
    p.fur(18, 19, 12, 13, "dark", { fuzz: 2 });
    p.fur(18, 23, 7, 6, "m2", { edge: false, fuzz: 1.6 });
    p.glow(() => {
      p.eye(12, 15, { big: true, ink: "#fff6c8" }); p.eye(21, 15, { big: true, ink: "#fff6c8" });
    });
    p.eye(12, 15, { big: true, ink: "#fff6c8", hi: "#ffffff", noHi: true, lid: "dark" }); p.eye(21, 15, { big: true, ink: "#fff6c8", noHi: true, lid: "dark" });
    p.dot(17, 20, "m"); p.dot(18, 20, "m"); p.dot(16, 19, "m");
    p.line(5, 23, 1, 27, "dark", { w: 2 }); p.line(31, 23, 35, 27, "dark", { w: 2 });
  } },
  skeleton: { anim: "sway", draw(p) {
    p.rect(17, 21, 2, 8, "bone");
    for (const y of [22, 25]) p.line(13, y, 23, y, "bone", { w: 1 });
    p.line(13, 21, 9, 27, "bone"); p.line(23, 21, 27, 27, "bone");
    p.line(16, 29, 14, 33, "bone", { w: 2 }); p.line(20, 29, 22, 33, "bone", { w: 2 });
    p.fur(18, 20, 8, 2.5, "m", { fuzz: 1 });
    p.poly([[22, 20], [27, 25], [24, 26], [21, 21]], "m", { same: true });
    p.ell(18, 11, 10, 9, "bone");
    p.ell(18, 18, 6, 3, "bone", { same: true });
    p.ell(13.5, 12, 2.8, 2.8, "dark", { edge: false }); p.ell(22.5, 12, 2.8, 2.8, "dark", { edge: false });
    p.eye(13, 11, { ink: "#fff3c4" }); p.eye(22, 11, { ink: "#fff3c4" });
    p.poly([[17, 16], [19, 16], [18, 18]], "dark", { edge: false });
    for (const x of [15, 17, 19, 21]) p.dot(x, 19, "dark");
    p.blush(9, 15, 2); p.blush(25, 15, 2);
  } },
  vampire: { anim: "breathe", draw(p) {
    p.poly([[3, 32], [8, 14], [28, 14], [33, 32], [26, 30], [18, 33], [10, 30]], "m2");
    p.poly([[6, 15], [2, 5], [12, 13]], "m2", { same: true }); p.poly([[30, 15], [34, 5], [24, 13]], "m2", { same: true });
    p.fur(18, 22, 8, 9, "dark");
    p.fur(18, 13, 9, 8.5, "m");
    p.ell(18, 15, 6, 4.5, "skin", { edge: false });
    p.poly([[11, 12], [18, 9], [25, 12], [24, 6], [12, 6]], "m", { edge: false });
    p.poly([[16, 10], [18, 13], [20, 10]], "m", { edge: false, same: true });
    pxFace(p, 18, 14, 5, "fang", { lid: "skin" });
    p.ell(18, 22, 1.4, 1.4, "red", { edge: false });
  } },

  // ----- Danger level 10: Starfall Crown -----
  comet: { anim: "pulse", draw(p) {
    p.glow(() => {
      p.poly([[24, 14], [36, 2], [35, 10], [30, 13], [36, 14], [30, 19], [26, 24]], "gl");
    });
    p.poly([[26, 15], [34, 5], [30, 17]], "m2", { edge: false });
    p.fur(17, 21, 10.5, 10.5, "m", { fuzz: 1.6 });
    p.fur(14, 24, 5, 4, "white", { edge: false });
    pxFace(p, 15, 19, 6, "o");
    pxSpark(p, 4, 6); pxSpark(p, 8, 33, "gl"); pxSpark(p, 33, 30);
  } },
  star_spirit: { anim: "pulse", draw(p) {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 7.5 : 16.5;
      pts.push([18 + Math.cos(a) * r, 19 + Math.sin(a) * r]);
    }
    p.poly(pts, "m");
    p.fur(18, 20, 8, 7.5, "m", { same: true });
    p.fur(18, 23, 4.5, 3, "bl", { edge: false, fuzz: 0.7 });
    pxFace(p, 18, 17, 5, "smile");
    p.glow(() => { p.dot(18, 5, "gl"); p.dot(18, 6, "gl", { same: true }); p.dot(5, 14, "gl"); p.dot(31, 14, "gl"); });
    pxSpark(p, 3, 31); pxSpark(p, 33, 31);
  } },
  void_eye: { anim: "float", draw(p) {
    p.poly([[9, 16], [0, 10], [2, 17], [0, 22], [9, 21]], "m2"); p.poly([[27, 16], [36, 10], [34, 17], [36, 22], [27, 21]], "m2");
    p.fur(18, 18, 11, 11, "m", { fuzz: 1.6 });
    p.ell(18, 17, 7, 6, "white");
    p.ell(18, 17, 4, 4.5, "m2", { edge: false });
    p.eye(16, 15, { big: true, ink: "#1e1422" }); p.dot(19, 19, "white", { color: "#ffffff" });
    for (const [x, y, dx] of [[11, 10, -1], [14, 9, 0], [18, 9, 0], [22, 9, 0], [25, 10, 1]]) { p.dot(x, y, "ink"); p.dot(x + dx, y - 1, "ink"); }
    p.cheeks(18, 24, 14, 2);
    p.dot(17, 26, "ink"); p.dot(18, 27, "ink"); p.dot(19, 26, "ink");
    p.fur(13, 29, 2, 2, "m"); p.fur(23, 29, 2, 2, "m");
  } },
  seraph: { anim: "float", draw(p) {
    p.poly([[11, 17], [0, 6], [1, 13], [0, 17], [2, 21], [1, 25], [11, 25]], "white");
    p.poly([[25, 17], [36, 6], [35, 13], [36, 17], [34, 21], [35, 25], [25, 25]], "white");
    for (const y of [12, 16, 20]) { p.line(3, y, 9, y + 2, "bone", { edge: false }); p.line(33, y, 27, y + 2, "bone", { edge: false }); }
    p.glow(() => { p.ell(18, 3.5, 7, 2.2, "gl"); });
    p.fur(18, 20, 9.5, 11, "m");
    p.fur(18, 15, 6, 5, "bl", { edge: false });
    pxFace(p, 18, 14, 5, "smile");
    p.fur(18, 27, 5, 4, "bl", { edge: false });
  } },
};

// ---------- Bosses ----------
// 64x64, rounder and fluffier, but each still clearly a boss: crowns, horns, crystals and magic.
// pal: a = main fur, b = accent, c = belly, d = extra, F = magic glow; eyes use the painter's eyes.
const BOSS_ART = {
  howling_wolf: {
    title: "Alpha of the Mossy Tunnels",
    desc: "A huge grey wolf whose howl turns into a cutting wind.",
    story: "Miners once heard a lonely howl echo through the tunnels. The wolf that made it guarded the first vein of copper ever found, and it still believes every pickaxe is a thief.",
    pal: { a: "#9fb4ac", b: "#6a8780", c: "#eef2e6", d: "#e8a4b0", F: { c: "#8dffd0", smooth: true } },
    draw(p) {
      p.fur(48, 50, 9, 6, "a", { fuzz: 2 }); p.fur(56, 40, 5, 8, "a", { fuzz: 2, same: true });
      p.poly([[13, 24], [12, 4], [26, 17]], "a"); p.poly([[16, 20], [15, 9], [23, 17]], "d", { edge: false });
      p.poly([[51, 24], [52, 4], [38, 17]], "a"); p.poly([[48, 20], [49, 9], [41, 17]], "d", { edge: false });
      p.fur(32, 42, 20, 18, "a", { fuzz: 2.4 });
      p.fur(32, 28, 19, 15, "a", { fuzz: 2.4 });
      p.fur(32, 46, 13, 12, "c", { edge: false, fuzz: 2.2 });
      p.fur(32, 35, 8, 5.5, "c", { edge: false, fuzz: 1.2 });
      p.fur(24, 20, 6, 2, "b", { edge: false, fuzz: 1.2 }); p.fur(40, 20, 6, 2, "b", { edge: false, fuzz: 1.2 });
      pxFace(p, 32, 25, 14, "none", { size: 3 });
      p.ell(32, 32, 2.6, 1.8, "ink", { edge: false });
      p.dot(31, 35, "ink"); p.dot(32, 36, "ink"); p.dot(33, 35, "ink"); p.dot(30, 36, "ink"); p.dot(34, 36, "ink");
      p.ell(32, 39, 2, 2, "d", { edge: false });
      pxFeet(p, 32, 60, 11, "a", 5);
      p.glow(() => {
        for (const [x, y] of [[5, 30], [9, 45], [58, 26]]) { p.line(x - 3, y, x + 3, y - 2, "F"); p.line(x - 2, y + 3, x + 4, y + 1, "F"); }
      });
      pxSpark(p, 6, 56, "F"); pxSpark(p, 60, 54, "F");
    } },
  glacier_troll: {
    title: "The Frozen Brute",
    desc: "A hulking troll with ice crystals growing from its back.",
    story: "It fell asleep in the Deep Mine a thousand winters ago and froze solid. The dwarves' digging woke it up, and it is very, very grumpy about it.",
    pal: { a: "#8ab8e0", b: "#5a86c0", c: "#e6f4ff", d: "#c8ecff", F: { c: "#d6f8ff", smooth: true } },
    draw(p) {
      p.glow(() => {
        for (const [x, h, w] of [[12, 22, 4], [22, 28, 5], [32, 32, 5], [42, 28, 5], [52, 22, 4]]) p.poly([[x - w, 22], [x - 1, 22 - h + 6], [x + 1, 22 - h + 4], [x + w, 22]], "F");
      });
      p.fur(9, 40, 7, 12, "a", { fuzz: 2 }); p.fur(55, 40, 7, 12, "a", { fuzz: 2 });
      p.fur(8, 52, 5, 4, "b"); p.fur(56, 52, 5, 4, "b");
      p.fur(32, 38, 22, 22, "a", { fuzz: 2.4 });
      p.fur(32, 44, 13, 12, "c", { edge: false, fuzz: 2 });
      p.ell(32, 30, 11, 7, "d", { edge: true });
      p.fur(32, 22, 14, 3, "a", { edge: false, fuzz: 2 });
      pxFace(p, 32, 27, 10, "none", { size: 3, lid: "d" });
      p.line(27, 34, 37, 34, "ink"); p.poly([[28, 34], [30, 34], [29, 31]], "bone", { edge: false }); p.poly([[34, 34], [36, 34], [35, 31]], "bone", { edge: false });
      pxFeet(p, 32, 61, 10, "b", 5.5);
    } },
  magma_wyrm: {
    title: "Heart of the Molten Halls",
    desc: "A coiled dragon of rock, with lava running under its scales.",
    story: "The wyrm sleeps in the hottest hall, curled around the forge-fire that first heated the dwarves' anvils. Its breath can melt gold into soup.",
    pal: { a: "#e8744e", b: "#b84a36", c: "#ffd49a", d: "#7a3a36", F: { c: "#ffc23a", smooth: true } },
    draw(p) {
      p.glow(() => { p.ell(32, 60, 26, 3.2, "F"); });
      p.fur(15, 52, 12, 8, "a", { fuzz: 1.4 }); p.fur(49, 52, 12, 8, "a", { fuzz: 1.4, same: true });
      p.fur(32, 54, 14, 7, "a", { fuzz: 1.4, same: true });
      for (const x of [10, 18, 46, 54]) p.poly([[x - 3, 46], [x, 39], [x + 3, 46]], "b");
      p.fur(32, 38, 13, 15, "a", { fuzz: 1.8 });
      p.fur(32, 43, 8, 10, "c", { edge: false, fuzz: 1 });
      for (const y of [37, 42, 47]) p.line(26, y, 38, y, "a", { edge: false, color: pxMix("#ffd49a", "#e8744e", 0.4) });
      pxHorn(p, 21, 16, 12, -6, "bone", 3); pxHorn(p, 43, 16, 12, 6, "bone", 3);
      p.fur(32, 20, 15, 11, "a", { fuzz: 2 });
      p.fur(32, 25, 9, 5, "c", { edge: false, fuzz: 1 });
      pxFace(p, 32, 17, 12, "none", { size: 3 });
      p.line(28, 27, 36, 27, "ink"); p.dot(29, 28, "white"); p.dot(35, 28, "white");
      p.dot(29, 23, "ink"); p.dot(35, 23, "ink");
      p.glow(() => { p.poly([[30, 4], [32, 0], [34, 4], [33, 8], [31, 8]], "F"); });
      pxSpark(p, 6, 30, "F"); pxSpark(p, 58, 26, "F");
    } },
  peak_dragon: {
    title: "Elder of the Sky Peak",
    desc: "An ancient stone-scaled dragon with wings as wide as the mountain.",
    story: "Older than the mountain itself, the Elder Peak Dragon has watched over the summit since the first stone was laid. Only those who reach the top may face it.",
    pal: { a: "#b89468", b: "#7e6044", c: "#f2deb2", d: "#a6d77e", F: { c: "#bdf58a", smooth: true } },
    draw(p) {
      p.poly([[16, 30], [1, 6], [4, 18], [0, 24], [5, 30], [2, 38], [16, 42]], "b");
      p.poly([[48, 30], [63, 6], [60, 18], [64, 24], [59, 30], [62, 38], [48, 42]], "b");
      p.glow(() => { for (const [x0, y0, x1, y1] of [[4, 12, 13, 32], [3, 26, 12, 37], [60, 12, 51, 32], [61, 26, 52, 37]]) p.line(x0, y0, x1, y1, "F"); });
      p.fur(50, 54, 9, 5, "a", { fuzz: 1.4 });
      p.fur(32, 44, 17, 17, "a", { fuzz: 2 });
      p.fur(32, 48, 10, 11, "c", { edge: false, fuzz: 1.2 });
      for (const y of [42, 47, 52]) p.line(26, y, 38, y, "a", { edge: false, color: pxMix("#f2deb2", "#b89468", 0.4) });
      pxHorn(p, 22, 14, 12, -4, "bone", 2.5); pxHorn(p, 42, 14, 12, 4, "bone", 2.5);
      p.fur(32, 20, 14, 11, "a", { fuzz: 2 });
      p.fur(32, 26, 9, 5, "c", { edge: false, fuzz: 1 });
      p.glow(() => { for (const x of [26, 32, 38]) p.ell(x, 11, 1.2, 1.2, "F", { edge: false }); });
      pxFace(p, 32, 17, 12, "smile", { size: 3, mouthDrop: 5 });
      p.dot(29, 24, "ink"); p.dot(35, 24, "ink");
      pxFeet(p, 32, 61, 9, "b", 4.5);
    } },
  thunder_kraken: {
    title: "Storm of the Crystal Caverns",
    desc: "A giant squid that crackles with lightning in an underground lake.",
    story: "When the miners broke into a flooded crystal cave, the water started to glow. Then eight arms rose out of it, each one sparking like a storm.",
    pal: { a: "#a888dc", b: "#7458b4", c: "#e4d2ff", d: "#f2c4ec", F: { c: "#ffe24a", smooth: true } },
    draw(p) {
      const tent = [[8, 44, 3, 58], [16, 46, 12, 62], [25, 48, 24, 63], [39, 48, 40, 63], [48, 46, 52, 62], [56, 44, 61, 58]];
      for (const [x0, y0, x1, y1] of tent) {
        p.line(x0, y0, (x0 + x1) / 2 + (x0 < 32 ? -3 : 3), (y0 + y1) / 2, "a", { w: 5 });
        p.line((x0 + x1) / 2 + (x0 < 32 ? -3 : 3), (y0 + y1) / 2, x1, y1, "a", { w: 4, same: true });
        p.fur(x1 + (x0 < 32 ? -1 : 1), y1 - 1, 2.4, 1.8, "a", { same: true, fuzz: 0.6 });
      }
      p.fur(32, 28, 22, 20, "a", { fuzz: 2.2 });
      for (const [x, y] of [[20, 16], [32, 12], [44, 16], [25, 23], [40, 23]]) p.ell(x, y, 2.4, 2, "b", { edge: false });
      p.fur(32, 40, 13, 6, "c", { edge: false, fuzz: 1.2 });
      pxFace(p, 32, 31, 14, "o", { size: 3 });
      p.glow(() => {
        for (const [x, y] of [[4, 20], [58, 14]]) { p.line(x, y, x + 3, y + 5, "F", { w: 2 }); p.line(x + 3, y + 5, x, y + 8, "F", { w: 2, same: true }); p.line(x, y + 8, x + 4, y + 14, "F", { w: 2, same: true }); }
      });
      pxSpark(p, 12, 4, "F"); pxSpark(p, 52, 40, "F");
    } },
  tempest_leviathan: {
    title: "Lord of the Sunken Ruins",
    desc: "A sea serpent the size of a ship, wrapped in howling winds.",
    story: "The Sunken Ruins were once a proud city. One stormy night the Leviathan rose, the sea poured in, and the city sank. Its winds still whip the water into spray.",
    pal: { a: "#6cc8b2", b: "#3e9686", c: "#e6faf0", d: "#9fe4f4", F: { c: "#c8f8ff", smooth: true } },
    draw(p) {
      p.poly([[6, 18], [0, 4], [12, 14], [10, 4], [18, 14]], "b"); p.poly([[58, 18], [64, 4], [52, 14], [54, 4], [46, 14]], "b");
      for (const x of [20, 32, 44]) p.poly([[x - 4, 12], [x, 1], [x + 4, 12]], "b");
      p.fur(32, 34, 21, 22, "a", { fuzz: 2 });
      p.fur(32, 44, 12, 12, "c", { edge: false, fuzz: 1.4 });
      for (const y of [38, 44, 50]) p.line(24, y, 40, y, "a", { edge: false, color: pxMix("#e6faf0", "#6cc8b2", 0.35) });
      pxFace(p, 32, 25, 16, "none", { size: 3 });
      p.line(26, 32, 38, 32, "ink"); for (const x of [27, 30, 34, 37]) p.dot(x, 33, "white");
      p.glow(() => {
        for (let x = 0; x < 64; x += 2) { const y = 58 + Math.round(Math.sin(x / 3.5) * 2); p.rect(x, y, 2, 64 - y, "F"); }
      });
      p.fur(4, 44, 3, 3, "d", { fuzz: 1 }); p.fur(60, 40, 3, 3, "d", { fuzz: 1 });
    } },
  rime_sorceress: {
    title: "Queen of the Frostfang Tundra",
    desc: "A sorceress in a crown of ice who can freeze a heartbeat.",
    story: "She was the greatest mage of the north until she tried to stop winter forever. Winter won, and took her heart as its own. Now she guards the tundra so no fire may ever melt it.",
    pal: { a: "#6a82cc", b: "#46589c", c: "#f6f8ff", d: "#f6dccc", F: { c: "#aaf2ff", smooth: true } },
    draw(p) {
      p.line(56, 14, 56, 62, "b", { w: 2 });
      p.glow(() => { p.poly([[56, 2], [61, 9], [56, 18], [51, 9]], "F"); });
      p.poly([[14, 62], [20, 34], [44, 34], [50, 62]], "a");
      p.fur(32, 52, 17, 11, "a", { fuzz: 1.8, same: true });
      p.fur(32, 40, 6, 12, "c", { edge: false, fuzz: 1.4 });
      p.fur(48, 40, 4, 3, "d");
      p.fur(32, 22, 16, 18, "c", { fuzz: 2.2 });
      p.ell(32, 24, 10, 9, "d", { edge: true });
      p.fur(32, 15, 12, 4, "c", { edge: false, fuzz: 1.6 });
      p.glow(() => { for (const [x, h] of [[22, 8], [27, 11], [32, 13], [37, 11], [42, 8]]) p.poly([[x - 2, 10], [x, 10 - h], [x + 2, 10]], "F"); });
      pxFace(p, 32, 22, 9, "smile", { size: 2, lid: "d", mouthDrop: 4 });
      pxSpark(p, 7, 18, "F"); pxSpark(p, 10, 44, "F");
    } },
  inferno_lord: {
    title: "King of the Ember Wastes",
    desc: "A horned demon king crowned with living fire.",
    story: "The Ember Wastes were green fields until the Inferno Lord climbed out of a crack in the ground. Everything he walks on turns to ash, and he has walked a very long way.",
    pal: { a: "#dc5a46", b: "#9e3430", c: "#ffcf96", d: "#4a2a2a", F: { c: "#ffb43a", smooth: true } },
    draw(p) {
      p.glow(() => {
        for (const [x, h] of [[19, 12], [25.5, 17], [32, 21], [38.5, 17], [45, 12]]) {
          p.poly([[x - 3, 17], [x - 2.5, 17 - h * 0.5], [x + 0.5, 17 - h], [x + 1, 17 - h * 0.6], [x + 3, 17 - h * 0.4], [x + 3, 17]], "F");
          p.poly([[x - 1, 17], [x, 17 - h * 0.45], [x + 1, 17]], "c", { edge: false });
        }
      });
      pxHorn(p, 14, 20, 12, -6, "d", 3); pxHorn(p, 50, 20, 12, 6, "d", 3);
      p.fur(8, 40, 6, 10, "a", { fuzz: 1.6 }); p.fur(56, 40, 6, 10, "a", { fuzz: 1.6 });
      p.glow(() => { p.fur(7, 52, 5.5, 5, "F"); p.fur(57, 52, 5.5, 5, "F"); });
      p.fur(32, 38, 20, 21, "a", { fuzz: 2.2 });
      p.fur(32, 46, 11, 10, "c", { edge: false, fuzz: 1.6 });
      p.glow(() => { p.ell(32, 46, 3.5, 3.5, "F", { edge: false }); });
      pxFace(p, 32, 28, 12, "fang", { size: 3 });
      p.line(24, 25, 29, 27, "ink"); p.line(40, 25, 35, 27, "ink");
      pxFeet(p, 32, 61, 10, "b", 5);
    } },
  mountain_colossus: {
    title: "Guardian of the Shadow Abyss",
    desc: "A walking mountain with a glowing rune for a heart.",
    story: "The first dwarf kings carved the Colossus to guard the deepest gate. When the kings were gone, it kept guarding, and it has forgotten how to stop.",
    pal: { a: "#a6958a", b: "#6e6058", c: "#ccbfb2", d: "#8fbc5c", F: { c: "#c99aff", smooth: true } },
    draw(p) {
      p.rect(2, 26, 12, 24, "b"); p.rect(50, 26, 12, 24, "b");
      p.rect(12, 14, 40, 44, "a", { flat: true });
      for (const [x0, y0, x1, y1] of [[16, 22, 22, 26], [44, 18, 40, 24], [18, 50, 24, 54], [46, 48, 40, 54]]) p.line(x0, y0, x1, y1, "b", { edge: false });
      p.fur(32, 14, 22, 6, "d", { flatBottom: false, fuzz: 2 });
      p.fur(8, 26, 6, 3, "d", { fuzz: 1.6 }); p.fur(56, 26, 6, 3, "d", { fuzz: 1.6 });
      p.glow(() => { p.poly([[32, 32], [38, 38], [32, 46], [26, 38]], "F"); });
      p.eye(22, 22, { size: 3, ink: "#d8b8ff", lid: "a" }); p.eye(39, 22, { size: 3, ink: "#d8b8ff", lid: "a" });
      p.glow(() => { p.rect(22, 22, 3, 3, "F"); p.rect(39, 22, 3, 3, "F"); });
      p.cheeks(32, 27, 26, 3);
      p.rect(14, 58, 12, 5, "b"); p.rect(38, 58, 12, 5, "b");
    } },
  starfall_sovereign: {
    title: "Ruler of the Starfall Crown",
    desc: "A star-crowned king who wields falling stars like spears.",
    story: "He fell from the night sky long ago and landed on the highest peak in the world. He calls himself the Sovereign of everything below the stars, and he has never once been defeated.",
    pal: { a: "#5a6ccc", b: "#38428e", c: "#2c2c50", d: "#ffd45a", e: "#c8d4ff", F: { c: "#fff07a", smooth: true } },
    draw(p) {
      p.poly([[8, 62], [16, 30], [48, 30], [56, 62]], "a");
      p.fur(32, 52, 22, 11, "a", { fuzz: 1.8, same: true });
      p.fur(32, 32, 18, 6, "e", { fuzz: 2 });
      p.fur(10, 34, 5, 4, "d", { fuzz: 1 }); p.fur(54, 34, 5, 4, "d", { fuzz: 1 });
      p.fur(32, 22, 13, 12, "c", { fuzz: 1.6 });
      p.poly([[19, 14], [18, 2], [24, 8], [28, 0], [32, 7], [36, 0], [40, 8], [46, 2], [45, 14]], "d", { flat: true });
      p.glow(() => { for (const x of [18, 28, 36, 46]) p.dot(x, x === 18 || x === 46 ? 2 : 0, "F"); p.ell(32, 10, 2, 2, "F", { edge: false }); });
      p.eye(25, 21, { size: 3, ink: "#fff27a", hi: "#ffffff", lid: "c" }); p.eye(36, 21, { size: 3, ink: "#fff27a", hi: "#ffffff", lid: "c" });
      p.glow(() => { p.rect(25, 21, 3, 3, "F"); p.rect(36, 21, 3, 3, "F"); });
      p.fur(32, 44, 4, 4, "d", { edge: true, fuzz: 0.6 });
      p.glow(() => { p.ell(32, 44, 1.6, 1.6, "F", { edge: false }); });
      for (const [x, y] of [[20, 52], [44, 50], [30, 57]]) pxSpark(p, x, y, "F");
      pxSpark(p, 4, 12, "F"); pxSpark(p, 60, 18, "F");
    } },
};

const monsterArtCache = {};

// The art key for a monster: its creature name ("rat", "fire_ant") or the boss id.
function monsterArtKey(m) {
  if (m.art) return m.art;
  // Fights saved before the art existed: work it out from the name.
  const tier = typeof TIERS !== "undefined" && TIERS[(m.tier || 1) - 1];
  if (!tier) return null;
  if (m.boss) return tier.boss.id;
  const c = tier.creatures.find(c => m.name && m.name.endsWith(c.name));
  return c ? c.name.toLowerCase().replace(/ /g, "_") : null;
}

// A stable number from a word, so each creature's fur pattern is always the same.
function monsterSeed(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) % 1000; }

// The pixel picture for a monster object ({ boss, element, tier, name, art }).
// Wrapped in a span that runs the creature's idle animation.
function monsterArtHTML(m, extraClass = "") {
  const key = monsterArtKey(m);
  const boss = m.boss && BOSS_ART[key];
  const art = boss || MONSTER_ART[key];
  if (!art) return `<span class="mon-art mon-emoji ${extraClass}">${m.icon || "👾"}</span>`;
  const cacheKey = boss ? key : `${key}|${m.element}`;
  let pic = monsterArtCache[cacheKey];
  if (!pic) {
    const size = boss ? 48 : 30;
    const mats = boss ? { ...MONSTER_FIXED, ...art.pal } : monsterMats(m.element);
    pic = pxPictureHTML(size, size, mats, art.draw, boss ? "mon-svg mon-pix boss-svg" : "mon-svg mon-pix", monsterSeed(key), size / (boss ? 64 : 36));
    monsterArtCache[cacheKey] = pic;
  }
  const anim = boss ? "boss" : art.anim || "breathe";
  return `<span class="mon-art anim-${anim} el-glow-${m.element} ${extraClass}">${pic}</span>`;
}

// Turn a half map into a full one (the right half is the left half, flipped).
function mirrorMap(map) { return map.map(row => row + [...row].reverse().join("")); }

// A small treasure chest for the monster cards (tap it to see the rewards).
const CHEST_MAP = [
  "..LLLL",
  ".Lllll",
  "Llllll",
  "yyyyyy",
  "LllllY",
  "Llllly",
  "Llllll",
  "yyyyyy",
];
let chestSvgCache = null;
function chestSVG() {
  if (!chestSvgCache) {
    chestSvgCache = pixelArtSVG(mirrorMap(CHEST_MAP), { L: "#5a3418", l: "#a5622c", y: "#ffd34d", Y: "#140e0b" }, "chest-svg");
  }
  return chestSvgCache;
}
