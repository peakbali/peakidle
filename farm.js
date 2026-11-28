// ---------- Monster Farm ----------
// Bought once with Souls in the Souls panel, and kept forever (also when you reincarnate).
// Every monster you have ever caught lives here: catch 5 Frozen Rats and 5 Frozen Rats roam the pen.
// Essence: each KIND of farm animal (creature + element, e.g. Frozen Rat) makes 1 essence of its element
// every 3 hours (8 a day), in real time (also while the game is closed). Extra copies don't make more, so the most is
// 40 creatures x 5 elements = 200 kinds, 40 per element every 3 hours. The essence waits in the farm until
// you tap Collect, so it is safe when you reincarnate.
//
// You can release a farm animal (tap it, then Release twice). One copy leaves the farm; if it was the
// last of its kind, that kind stops making essence. The farm and the Bestiary always match: releasing
// also takes one off its Bestiary count (milestones you already reached stay, with their bonus).
// Catching it again brings one back.
//
// Loaded before game.js. Uses state, ELEMENTS, TIERS, monsterArtHTML ... only when called.

const FARM = {
  price: 2000,              // Souls
  perDay: 8,                // essence per kind of farm animal per day (1 every 3 hours)
};
const FARM_DAY_MS = 24 * 60 * 60 * 1000;

function freshFarm() { return { owned: false, last: 0, stash: {} }; }

// bestiary is the loaded Bestiary. Older saves kept released monsters in a separate list
// ("creature|element" -> how many, or true = all); those are now taken off the Bestiary instead,
// so the farm and the Bestiary show the same monsters.
function normalizeFarm(saved, bestiary = {}) {
  const f = freshFarm();
  if (!saved || typeof saved !== "object") return f;
  f.owned = saved.owned === true;
  f.last = typeof saved.last === "number" ? saved.last : Date.now();
  for (const e of ELEMENTS) {
    const n = saved.stash && saved.stash[e.id];
    if (typeof n === "number" && n > 0 && isFinite(n)) f.stash[e.id] = n;
  }
  for (const [id, v] of Object.entries(saved.released || {})) {
    const [key, el] = id.split("|");
    const caught = (bestiary[key] && bestiary[key].el && bestiary[key].el[el]) || 0;
    const n = v === true ? caught : Math.floor(Number(v) || 0);
    if (n > 0) farmTakeFromBestiary(bestiary, key, el, Math.min(n, caught));
  }
  return f;
}

// Every kind of farm animal (creature + element) with how many live here:
// [{ key, tier, idx, name, element, count }].
function farmKinds() {
  const out = [];
  for (const c of bestiaryList()) {
    const entry = state.bestiary[c.key];
    if (!entry || !entry.el) continue;
    for (const e of ELEMENTS) {
      const count = entry.el[e.id] || 0;
      if (count > 0) out.push({ ...c, element: e.id, count });
    }
  }
  return out;
}

// One entry per animal in the pen (copies included), each with its own copy number n.
function farmAnimals() {
  const out = [];
  for (const k of farmKinds()) for (let n = 0; n < k.count; n++) out.push({ ...k, n });
  return out;
}

// Take n catches of a creature in one element off the Bestiary (used by Release).
function farmTakeFromBestiary(bestiary, key, el, n = 1) {
  const e = bestiary && bestiary[key];
  if (!e || !e.el || !(e.el[el] > 0)) return;
  const k = Math.min(n, e.el[el]);
  e.el[el] -= k;
  if (e.el[el] <= 0) delete e.el[el];
  e.caught = Math.max(0, (e.caught || 0) - k);
}

// Kept so recordCatch can tell the farm about a catch: a new catch adds a copy all by itself.
function farmWelcomeBack() {}

// Essence per day for each element: { fire: 12, ice: 3, ... }. One per kind, copies don't add.
function farmRates() {
  const r = {};
  for (const e of ELEMENTS) r[e.id] = 0;
  for (const k of farmKinds()) r[k.element] += FARM.perDay;
  return r;
}

// Add what the farm made since we last looked. Runs every tick and when the game opens.
let farmRateCache = null, farmRateSig = "";
function farmTick(now = Date.now()) {
  const f = state.farm;
  if (!f || !f.owned) return;
  const dt = (now - f.last) / FARM_DAY_MS;
  f.last = now;
  if (!(dt > 0)) return; // the clock went backwards: just start counting from now
  const sig = farmSignature();
  if (sig !== farmRateSig) { farmRateCache = farmRates(); farmRateSig = sig; }
  for (const e of ELEMENTS) {
    const r = farmRateCache[e.id];
    if (r > 0) f.stash[e.id] = (f.stash[e.id] || 0) + r * dt;
  }
}

// A short string that changes whenever a new creature + element is caught.
function farmSignature() {
  let s = "";
  for (const [k, v] of Object.entries(state.bestiary || {})) if (v && v.el) s += k + JSON.stringify(v.el) + ";";
  return s;
}

function buyFarm() {
  if (state.farm.owned || state.souls < FARM.price) return;
  state.souls -= FARM.price;
  state.farm.owned = true;
  state.farm.last = Date.now();
  if (typeof sfx === "function") sfx("souls");
  log(`You bought the Monster Farm! Your caught monsters now make essence every day.`);
  save();
  render();
}

function collectFarm() {
  const f = state.farm;
  const got = [];
  for (const e of ELEMENTS) {
    const whole = Math.floor(f.stash[e.id] || 0);
    if (whole < 1) continue;
    state.drops[e.id] += whole;
    f.stash[e.id] -= whole;
    got.push(`${whole} ${e.icon}`);
  }
  if (!got.length) return;
  if (typeof sfx === "function") sfx("sell");
  log(`Collected ${got.join(" ")} essence from the Monster Farm.`);
  save();
  render();
}

// ---------- The farm scene ----------
// A grassy pen where every farm animal is a tiny sprite that wanders, idles, nibbles grass,
// naps or hops. The whole herd is drawn on one canvas (about 30 times a second, only while the pen
// is on screen), so even hundreds of animals stay smooth on a phone.

const FARM_FLYERS = new Set(["float", "flap", "pulse"]); // these creatures hover instead of walking
const farmView = { pen: null, canvas: null, ctx: null, critters: [], sig: "", W: 0, H: 0, size: 24, dpr: 1, visible: false, raf: 0 };

// The picture layers of a monster (body with closed eyes, open eyes), reused from the Bestiary art.
function farmSpriteLayers(a) {
  const html = monsterArtHTML(bestiaryMonster(a, a.element));
  const srcs = [...html.matchAll(/<img class="mp-l( m-eye| m-glow)?" src="([^"]+)"/g)];
  const body = srcs.find(m => !m[1]), eye = srcs.find(m => m[1] === " m-eye");
  return { body: body && body[2], eye: eye && eye[2] };
}

// Sprite size and pen height: the more animals, the smaller they get, so all fit at once.
// With hundreds they crowd together more (they're farm animals, they don't mind).
function farmLayout(n, width) {
  const size = n <= 20 ? 34 : n <= 60 ? 28 : n <= 120 ? 24 : n <= 250 ? 21 : n <= 500 ? 18 : 16;
  const room = n <= 250 ? 2.4 : n <= 500 ? 1.8 : 1.3;
  const area = Math.max(1, n) * size * size * room;
  const H = Math.round(Math.min(n <= 250 ? 720 : 960, Math.max(170, area / Math.max(200, width))));
  return { size, H };
}

const FARM_GRASS_TILE = (() => {
  // A 16x16 grass tile: two greens with darker blades and a few light tips.
  if (typeof document === "undefined") return "";
  const A = "#3f7a34", B = "#4c8a3a", D = "#2f6229", L = "#79b452";
  const grid = new Array(256).fill(null).map((_, i) => ((i * 7 + (i >> 4) * 3) % 11 < 5 ? A : B));
  for (const [x, y] of [[2, 3], [9, 1], [13, 6], [5, 9], [11, 12], [1, 13], [7, 14], [14, 10]]) {
    grid[y * 16 + x] = D; grid[((y + 1) % 16) * 16 + x] = D; grid[((y + 15) % 16) * 16 + x] = L;
  }
  return pxGridPNG(grid, 16, 16);
})();

// Little things lying around the pen (drawn once). Spots are in % of the pen.
const FARM_DECOR = [
  { map: ["..aaaa..", ".abbbba.", "abbcbbba", "abbbbcba", ".abbbba.", "..aaaa.."], pal: { a: "#2a5aa8", b: "#3f8ee0", c: "#d8f4ff" }, x: 78, y: 70, w: 16 }, // pond
  { map: [".ab.", "abba", "abba", "cccc"], pal: { a: "#e8c25a", b: "#c89a34", c: "#8a6420" }, x: 10, y: 22, w: 5 },     // hay
  { map: [".a.", "aba", ".a.", ".c."], pal: { a: "#f0909e", b: "#ffe27a", c: "#2f6229" }, x: 30, y: 80, w: 2.5 },         // flower
  { map: [".a.", "aba", ".a.", ".c."], pal: { a: "#c9b6ff", b: "#ffe27a", c: "#2f6229" }, x: 58, y: 18, w: 2.5 },
  { map: [".a.", "aba", ".a.", ".c."], pal: { a: "#f4f0e6", b: "#ffe27a", c: "#2f6229" }, x: 88, y: 32, w: 2.5 },
  { map: [".aa.", "abba", "abbb", ".bb."], pal: { a: "#a8a2ac", b: "#6e6874" }, x: 46, y: 55, w: 3.5 },                    // rock
];
function farmDecorHTML() {
  return FARM_DECOR.map(d => {
    const h = d.map.length, w = d.map[0].length, grid = [];
    for (const row of d.map) for (const ch of row) grid.push(ch === "." ? null : d.pal[ch]);
    return `<img class="fm-deco" src="${pxGridPNG(grid, w, h)}" alt="" draggable="false" style="left:${d.x}%;top:${d.y}%;width:${d.w}%">`;
  }).join("");
}

function buildFarm() {
  const box = document.getElementById("farm");
  if (!box) return;
  box.innerHTML = "";
  refs.farm = el(`
    <div class="card farm-card">
      <div class="farm-pen" data-k="pen"><canvas class="fm-canvas"></canvas><div class="fm-empty small" data-k="empty"></div></div>
      <div class="farm-pick" data-k="pick" hidden>
        <span class="fm-pick-name" data-k="pickName"></span>
        <span class="buttons">
          <button class="danger" data-k="release">Release</button>
          <button data-k="pickClose">Close</button>
        </span>
      </div>
      <div class="farm-info">
        <div class="farm-buy" data-k="buyBox">
          <div class="buttons"><button class="primary" data-k="buy"></button></div>
        </div>
        <div class="farm-made" data-k="madeBox">
          <div class="small">Makes every 3 hours:</div>
          <div class="drops farm-rates" data-k="rates"></div>
          <div class="small">Waiting to collect: <span data-k="next"></span></div>
          <div class="drops farm-stash" data-k="stash"></div>
          <div class="buttons"><button class="primary" data-k="collect">Collect</button></div>
        </div>
      </div>
    </div>`);
  refs.farmRates = {}; refs.farmStash = {};
  for (const e of ELEMENTS) {
    const r = el(`<div class="drop el-${e.id}" title="${e.drop} made every 3 hours">${e.icon} <span class="num" data-k="n"></span></div>`);
    const s = el(`<div class="drop el-${e.id}" title="${e.drop} waiting in the farm">${e.icon} <span class="num" data-k="n"></span></div>`);
    refs.farmRates[e.id] = r; refs.farmStash[e.id] = s;
    refs.farm.querySelector('[data-k="rates"]').appendChild(r);
    refs.farm.querySelector('[data-k="stash"]').appendChild(s);
  }
  refs.farm.querySelector('[data-k="buy"]').onclick = buyFarm;
  refs.farm.querySelector('[data-k="collect"]').onclick = collectFarm;
  refs.farm.querySelector('[data-k="release"]').onclick = farmReleaseTap;
  refs.farm.querySelector('[data-k="pickClose"]').onclick = () => farmSelect(null);
  box.appendChild(refs.farm);

  const pen = refs.farm.querySelector('[data-k="pen"]');
  pen.insertAdjacentHTML("afterbegin", farmDecorHTML());
  pen.style.backgroundImage = `url("${FARM_GRASS_TILE}")`;
  farmView.pen = pen;
  farmView.canvas = pen.querySelector(".fm-canvas");
  farmView.ctx = farmView.canvas.getContext("2d");
  farmView.sig = "";
  farmView.critters = [];
  farmView.canvas.addEventListener("click", e => {
    const r = farmView.canvas.getBoundingClientRect();
    farmPet(farmHit(e.clientX - r.left, e.clientY - r.top));
  });
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver(es => { farmView.visible = es.some(x => x.isIntersecting); if (farmView.visible) farmKick(); }).observe(pen);
  } else farmView.visible = true;
  if (typeof ResizeObserver === "function") new ResizeObserver(() => farmResize()).observe(pen);
  farmFill();
  farmKick();
}

// (Re)build the herd when something is caught or released. Animals that were already here keep their spot.
function farmFill() {
  const pen = farmView.pen;
  if (!pen) return;
  const sig = farmSignature();
  if (sig === farmView.sig) return;
  farmView.sig = sig;
  const animals = farmAnimals();
  // Animals already here keep their spot (matched by kind: the first Frozen Rat stays the first).
  const byKind = {};
  for (const c of farmView.critters) if (!c.leaving) (byKind[c.kind] = byKind[c.kind] || []).push(c);
  const leaving = farmView.critters.filter(c => c.leaving);
  if (farmPicked) farmSelect(null);
  const now = performance.now();
  farmView.critters = animals.map(a => {
    const id = `${a.key}|${a.element}|${a.n}`;
    const prev = (byKind[`${a.key}|${a.element}`] || []).shift();
    if (prev) return prev;
    const anim = (MONSTER_ART[a.key] || {}).anim || "breathe";
    const x = Math.random(), y = Math.random();
    return {
      id, kind: `${a.key}|${a.element}`, element: a.element, name: `${ELEMENT_ADJECTIVE[a.element]} ${a.name}`,
      pics: farmPics(a), fly: FARM_FLYERS.has(anim), face: Math.random() < 0.5 ? 1 : -1,
      x, y, fx: x, fy: y, t0: 0, t1: 0, state: "idle", since: now, until: now + Math.random() * 6000,
      blink: Math.random() * 6000, alpha: 1,
    };
  });
  // keep animals that are still running out of the pen until they're gone
  farmView.critters.push(...leaving);
  farmResize(true);
}

function farmResize(force) {
  const pen = farmView.pen;
  if (!pen) return;
  const width = pen.clientWidth;
  if (!width || (!force && width === farmView.W)) return;
  const n = farmView.critters.filter(c => !c.leaving).length;
  const { size, H } = farmLayout(n, width);
  farmView.W = width; farmView.H = H; farmView.size = size;
  pen.style.height = H + "px";
  const dpr = Math.min(2, window.devicePixelRatio || 1); // sharper than this costs a lot and looks the same
  const cv = farmView.canvas;
  cv.width = Math.round(width * dpr); cv.height = Math.round(H * dpr);
  cv.style.width = width + "px"; cv.style.height = H + "px";
  farmView.dpr = dpr;
  farmKick();
}

// Pictures (body with closed eyes, open eyes) for a creature + element, made once and shared by copies.
const farmPicCache = {};
function farmPics(a) {
  const k = `${a.key}|${a.element}`;
  if (!farmPicCache[k]) {
    const l = farmSpriteLayers(a);
    const load = src => { if (!src) return null; const im = new Image(); im.src = src; return im; };
    farmPicCache[k] = { body: load(l.body), eye: load(l.eye) };
  }
  return farmPicCache[k];
}

// Where an animal stands right now (top-left of its picture, in CSS pixels).
function farmPos(c, now) {
  let x = c.x, y = c.y;
  if (now < c.t1) {
    const t = Math.max(0, (now - c.t0) / (c.t1 - c.t0));
    x = c.fx + (c.x - c.fx) * t; y = c.fy + (c.y - c.fy) * t;
  }
  const s = farmView.size;
  return { px: x * (farmView.W - s), py: 6 + y * (farmView.H - s - 10), sy: y };
}

// Soft oval shadows, drawn once and stamped under every animal (much cheaper than drawing ovals).
let farmShadowCache = null;
function farmShadows() {
  if (farmShadowCache) return farmShadowCache;
  const make = color => {
    const cv = document.createElement("canvas");
    cv.width = 32; cv.height = 10;
    const x = cv.getContext("2d");
    x.fillStyle = color;
    x.beginPath(); x.ellipse(16, 5, 16, 5, 0, 0, Math.PI * 2); x.fill();
    return cv;
  };
  return (farmShadowCache = { dark: make("rgba(0,0,0,0.28)"), light: make("rgba(0,0,0,0.17)"), picked: make("rgba(255,210,110,0.85)") });
}

// Draw the whole herd. Runs about 30 times a second, only while the pen is on screen.
function farmDraw(now) {
  const { ctx, dpr, size: s } = farmView;
  const cv = farmView.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const list = farmView.critters;
  for (const c of list) { const p = farmPos(c, now); c.px = p.px; c.py = p.py; }
  list.sort((a, b) => a.py - b.py);
  ctx.font = `${Math.round(s * 0.5)}px "Jersey 15", monospace`;
  const shadows = farmShadows();
  for (const c of list) {
    if (!c.pics.body.complete) continue;
    const t = now - c.since;
    let dy = 0, sx = 1, sy = 1, rot = 0, eyes = true;
    const flying = c.fly && c.state !== "sleep";
    if (c.state === "walk") {
      dy = flying ? -Math.sin(now / 250 + c.blink) * s * 0.1 : (Math.floor(now / 210 + c.blink) % 2) * -s * 0.09;
      rot = flying ? 0 : (Math.floor(now / 210 + c.blink) % 2 ? 0.05 : -0.05);
    } else if (c.state === "hop") {
      const k = (t % 600) / 600;
      dy = -Math.sin(Math.PI * k) * s * 0.45;
      if (k < 0.12 || k > 0.88) { sx = 1.1; sy = 0.88; }
    } else if (c.state === "eat") {
      const k = (t % 1100) / 1100;
      if (k > 0.6) rot = 0.2;
    } else if (c.state === "sleep") {
      sx = 1.06; sy = 0.82 + Math.sin(now / 600 + c.blink) * 0.03; eyes = false;
    } else {
      sy = 1 - (Math.sin(now / 420 + c.blink) + 1) * 0.02; // breathing
    }
    if (eyes && (now + c.blink) % 6000 < 130) eyes = false; // blink
    const lift = flying ? -s * 0.28 : 0;
    const cx = c.px + s / 2, base = c.py + s;
    ctx.globalAlpha = c.alpha;
    // shadow
    const sw = s * (flying ? 0.44 : 0.64), sh = s * 0.18;
    ctx.drawImage(c === farmPicked ? shadows.picked : flying ? shadows.light : shadows.dark, cx - sw / 2, base - s * 0.04 - sh / 2, sw, sh);
    // the animal itself: move to its feet, then tilt / squash / flip there
    const cos = rot ? Math.cos(rot * c.face) : 1, sin = rot ? Math.sin(rot * c.face) : 0;
    const a = sx * c.face;
    ctx.setTransform(dpr * cos * a, dpr * sin * a, -dpr * sin * sy, dpr * cos * sy, dpr * cx, dpr * (base + lift + dy));
    ctx.drawImage(c.pics.body, -s / 2, -s, s, s);
    if (eyes && c.pics.eye && c.pics.eye.complete) ctx.drawImage(c.pics.eye, -s / 2, -s, s, s);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (c.state === "eat" && !flying && (t % 1100) / 1100 > 0.6) {
      ctx.fillStyle = "#9ccf6a";
      const ex = cx + c.face * s * 0.42;
      ctx.fillRect(ex, base - 3, 2, 2); ctx.fillRect(ex - c.face * 4, base - 5, 2, 2);
    }
    if (c.state === "sleep") {
      const k = ((now + c.blink) % 2400) / 2400;
      ctx.globalAlpha = c.alpha * Math.min(1, (1 - k) * 2);
      ctx.fillStyle = "#e8f0ff";
      ctx.fillText("z", cx + s * 0.35 + k * 6, c.py + s * 0.15 - k * 10);
    }
  }
  ctx.globalAlpha = 1;
}

// Start the draw loop if it isn't running. It stops by itself when the pen is off screen.
function farmKick() {
  if (farmView.raf || !farmView.ctx) return;
  let last = 0;
  const loop = now => {
    if (!farmView.visible || document.hidden || !farmView.pen || !farmView.pen.isConnected) { farmView.raf = 0; return; }
    farmView.raf = requestAnimationFrame(loop);
    const gap = farmView.critters.length > 300 ? 50 : 33; // 30 frames a second (20 for big herds) is plenty for tiny pixel animals
    if (now - last < gap) return;
    last = now;
    for (const c of farmView.critters) if (now >= c.until) farmChoose(c, now);
    farmDraw(now);
  };
  farmView.raf = requestAnimationFrame(loop);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) farmKick(); });

function farmSetState(c, st, now) {
  c.state = st;
  c.since = now;
}

// What to do next: mostly wander and chill, sometimes nibble grass, nap or do a happy hop.
function farmChoose(c, now) {
  if (c.leaving) { farmView.critters = farmView.critters.filter(x => x !== c); return; }
  const r = Math.random();
  if (c.state === "sleep" && r < 0.5) { c.until = now + 4000 + Math.random() * 6000; return; } // keep napping
  if (r < 0.42) {
    const nx = Math.min(1, Math.max(0, c.x + (Math.random() - 0.5) * 0.6));
    const ny = Math.min(1, Math.max(0, c.y + (Math.random() - 0.5) * 0.6));
    farmWalk(c, nx, ny, now, c.fly ? 16 : 11);
  } else if (r < 0.66) {
    farmSetState(c, c.fly ? "idle" : "eat", now);
    c.until = now + 3000 + Math.random() * 5000;
  } else if (r < 0.76) {
    farmSetState(c, "sleep", now);
    c.until = now + 6000 + Math.random() * 9000;
  } else if (r < 0.82) {
    farmSetState(c, "hop", now);
    c.until = now + 1200;
  } else if (r < 0.88) {
    c.face = -c.face; // look around
    farmSetState(c, "idle", now);
    c.until = now + 1500 + Math.random() * 2500;
  } else {
    farmSetState(c, "idle", now);
    c.until = now + 2000 + Math.random() * 5000;
  }
}

function farmWalk(c, nx, ny, now, speed) {
  const p = farmPos(c, now), s = farmView.size;
  c.fx = p.px / Math.max(1, farmView.W - s); c.fy = (p.py - 6) / Math.max(1, farmView.H - s - 10);
  const dist = Math.hypot((nx - c.fx) * farmView.W, (ny - c.fy) * farmView.H);
  if (Math.abs(nx - c.fx) > 0.01) c.face = nx > c.fx ? 1 : -1;
  c.x = nx; c.y = ny;
  const ms = Math.max(1200, dist / speed * 1000);
  c.t0 = now; c.t1 = now + ms;
  farmSetState(c, "walk", now);
  c.until = c.t1 + 200;
}

// Which animal is under a tap (the one drawn on top wins).
function farmHit(x, y) {
  const s = farmView.size, list = farmView.critters;
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i];
    if (c.leaving || c.px === undefined) continue;
    const top = c.py - (c.fly ? s * 0.28 : 0);
    if (x >= c.px - 3 && x <= c.px + s + 3 && y >= top - 3 && y <= top + s + 3) return c;
  }
  return null;
}

// The animal picked by a tap (shown in the bar under the pen, with Release).
let farmPicked = null, farmReleaseArmed = false;
function farmSelect(c) {
  farmPicked = c;
  farmReleaseArmed = false;
  const bar = refs.farm && refs.farm.querySelector('[data-k="pick"]');
  if (!bar) return;
  bar.hidden = !c;
  if (!c) return;
  setIconHTML(bar.querySelector('[data-k="pickName"]'), `${elementById[c.element].icon} <b>${escapeHtml(c.name)}</b>`);
  setIconText(bar.querySelector('[data-k="release"]'), "Release");
}

// First tap asks, second tap lets it go: it runs out of the pen and is gone.
function farmReleaseTap() {
  const c = farmPicked;
  if (!c) return;
  if (!farmReleaseArmed) {
    farmReleaseArmed = true;
    setIconText(refs.farm.querySelector('[data-k="release"]'), "Tap again to release");
    return;
  }
  farmTick(); // count what it made up to now
  const [key, el] = c.kind.split("|");
  farmTakeFromBestiary(state.bestiary, key, el, 1);
  farmSelect(null);
  log(`You released a ${c.name}. Bye bye! Catch it again to bring it back.`);
  const now = performance.now();
  c.leaving = true;
  farmWalk(c, c.x < 0.5 ? -0.3 : 1.3, c.y, now, 60);
  c.t1 = now + 1400; c.until = c.t1;
  const fade = () => { c.alpha = Math.max(0, 1 - (performance.now() - now) / 1400); if (c.alpha > 0) requestAnimationFrame(fade); };
  requestAnimationFrame(fade);
  save();
  render();
}

// Tap an animal: it hops and says its name.
function farmPet(c) {
  if (!c) return;
  farmSelect(c);
  const now = performance.now();
  farmSetState(c, "hop", now);
  c.t1 = 0; c.fx = c.x = c.px / Math.max(1, farmView.W - farmView.size); c.fy = c.y = (c.py - 6) / Math.max(1, farmView.H - farmView.size - 10);
  c.until = now + 1200;
  const old = farmView.pen.querySelector(".fm-tag");
  if (old) old.remove();
  const tag = document.createElement("div");
  tag.className = "fm-tag";
  tag.innerHTML = emo(`${elementById[c.element].icon} ${escapeHtml(c.name)}`);
  const s = farmView.size;
  tag.style.left = Math.min(farmView.W - 60, Math.max(60, c.px + s / 2)) + "px";
  tag.style.top = Math.max(0, c.py - 22) + "px";
  farmView.pen.appendChild(tag);
  setTimeout(() => tag.remove(), 1800);
}

function farmTimeLeft(ms) {
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function renderFarm() {
  const card = refs.farm;
  if (!card) return;
  farmFill();
  const f = state.farm;
  const animals = farmView.critters.length;
  set(card, "empty", animals ? "" : "Catch monsters in Adventure and they move in here.");
  card.querySelector('[data-k="empty"]').hidden = animals > 0;
  card.querySelector('[data-k="buyBox"]').hidden = f.owned;
  card.querySelector('[data-k="madeBox"]').hidden = !f.owned;
  card.classList.toggle("farm-locked", !f.owned);
  if (!f.owned) {
    const btn = card.querySelector('[data-k="buy"]');
    setIconText(btn, `Buy Monster Farm for ${fmt(FARM.price)} 👻`);
    btn.disabled = state.souls < FARM.price;
    return;
  }
  const rates = farmRateCache && farmRateSig === farmSignature() ? farmRateCache : farmRates();
  let any = false, soonest = Infinity;
  for (const e of ELEMENTS) {
    const have = f.stash[e.id] || 0;
    set(refs.farmRates[e.id], "n", fmt(rates[e.id] / 8));
    set(refs.farmStash[e.id], "n", fmt(have));
    refs.farmRates[e.id].classList.toggle("dim", !rates[e.id]);
    refs.farmStash[e.id].classList.toggle("dim", have < 1);
    if (have >= 1) any = true;
    if (rates[e.id] > 0) soonest = Math.min(soonest, (1 - (have % 1)) / rates[e.id] * FARM_DAY_MS);
  }
  set(card, "next", soonest < Infinity ? `next essence in ${farmTimeLeft(soonest)}` : "catch monsters to start");
  card.querySelector('[data-k="collect"]').disabled = !any;
}
