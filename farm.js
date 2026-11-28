// ---------- Monster Farm ----------
// Bought once with Souls in the Souls panel, and kept forever (also when you reincarnate).
// Every monster you have caught lives here, once per element: a Blazing Rat and a Frozen Rat are
// two different farm animals, so a full farm holds 40 creatures x 5 elements = 200.
// Each one makes 1 essence of its own element per day, in real time (also while the game is closed).
// Catching the same one again doesn't add more. The essence waits in the farm until you tap Collect,
// so it is safe when you reincarnate.
//
// You can release a farm animal (tap it, then Release twice). It leaves the farm and stops making
// essence. Your Bestiary and its bonuses don't change, and catching that monster in that element
// again brings it back.
//
// Loaded before game.js. Uses state, ELEMENTS, TIERS, monsterArtHTML ... only when called.

const FARM = {
  price: 2000,              // Souls
  perDay: 1,                // essence per farm animal per day
};
const FARM_DAY_MS = 24 * 60 * 60 * 1000;

function freshFarm() { return { owned: false, last: 0, stash: {}, released: {} }; }

function normalizeFarm(saved) {
  const f = freshFarm();
  if (!saved || typeof saved !== "object") return f;
  f.owned = saved.owned === true;
  f.last = typeof saved.last === "number" ? saved.last : Date.now();
  for (const e of ELEMENTS) {
    const n = saved.stash && saved.stash[e.id];
    if (typeof n === "number" && n > 0 && isFinite(n)) f.stash[e.id] = n;
  }
  for (const [id, v] of Object.entries(saved.released || {})) if (v === true) f.released[id] = true;
  return f;
}

// Every caught creature + element pair: [{ key, tier, idx, name, element }].
function farmAnimals() {
  const out = [];
  for (const c of bestiaryList()) {
    const entry = state.bestiary[c.key];
    if (!entry || !entry.el) continue;
    for (const e of ELEMENTS) if (entry.el[e.id] > 0 && !farmReleased(`${c.key}|${e.id}`)) out.push({ ...c, element: e.id });
  }
  return out;
}

function farmReleased(id) { return !!(state.farm && state.farm.released && state.farm.released[id]); }

// Catching a monster again in the same element brings a released one back home (called by recordCatch).
function farmWelcomeBack(key, element) {
  if (state.farm && state.farm.released) delete state.farm.released[`${key}|${element}`];
}

// Essence per day for each element: { fire: 12, ice: 3, ... }.
function farmRates() {
  const r = {};
  for (const e of ELEMENTS) r[e.id] = 0;
  for (const a of farmAnimals()) r[a.element] += FARM.perDay;
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
  for (const [k, v] of Object.entries(state.bestiary || {})) if (v && v.el) s += k + Object.keys(v.el).join("") + ";";
  return s + "|" + Object.keys((state.farm && state.farm.released) || {}).join(",");
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
// naps or hops. All the moving is CSS (transform and opacity only), so 200 of them stay smooth.
// JS only picks a new thing to do for a few animals now and then, and only while the pen is on screen.

const FARM_FLYERS = new Set(["float", "flap", "pulse"]); // these creatures hover instead of walking
const farmView = { pen: null, critters: [], sig: "", W: 0, H: 0, size: 24, visible: false, timer: null };

// The picture layers of a monster (body with closed eyes, open eyes), reused from the Bestiary art.
function farmSpriteLayers(a) {
  const html = monsterArtHTML(bestiaryMonster(a, a.element));
  const srcs = [...html.matchAll(/<img class="mp-l( m-eye| m-glow)?" src="([^"]+)"/g)];
  const body = srcs.find(m => !m[1]), eye = srcs.find(m => m[1] === " m-eye");
  return { body: body && body[2], eye: eye && eye[2] };
}

// Sprite size and pen height: the more animals, the smaller they get, so all fit at once.
function farmLayout(n, width) {
  const size = n <= 20 ? 34 : n <= 60 ? 28 : n <= 120 ? 24 : 21;
  const area = Math.max(1, n) * size * size * 2.4;
  const H = Math.round(Math.min(720, Math.max(170, area / Math.max(200, width))));
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
      <div class="farm-pen" data-k="pen"><div class="fm-empty small" data-k="empty"></div></div>
      <div class="farm-pick" data-k="pick" hidden>
        <span class="fm-pick-name" data-k="pickName"></span>
        <span class="buttons">
          <button class="danger" data-k="release">Release</button>
          <button data-k="pickClose">Close</button>
        </span>
      </div>
      <div class="farm-info">
        <div class="small" data-k="count"></div>
        <div class="farm-buy" data-k="buyBox">
          <div class="small">Buy the farm once and keep it forever. Each monster you've caught, in each element, makes <b>1 essence of its element per day</b>, even while the game is closed.</div>
          <div class="buttons"><button class="primary" data-k="buy"></button></div>
        </div>
        <div class="farm-made" data-k="madeBox">
          <div class="small">Makes per day:</div>
          <div class="drops farm-rates" data-k="rates"></div>
          <div class="small">Waiting to collect: <span data-k="next"></span></div>
          <div class="drops farm-stash" data-k="stash"></div>
          <div class="buttons"><button class="primary" data-k="collect">Collect</button></div>
        </div>
      </div>
    </div>`);
  refs.farmRates = {}; refs.farmStash = {};
  for (const e of ELEMENTS) {
    const r = el(`<div class="drop el-${e.id}" title="${e.drop} made per day">${e.icon} <span class="num" data-k="n"></span></div>`);
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
  pen.addEventListener("click", e => {
    const c = e.target.closest(".fm-c");
    if (c) farmPet(farmView.critters[+c.dataset.i]);
  });
  farmView.pen = pen;
  farmView.sig = "";
  farmView.critters = [];
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver(es => { farmView.visible = es.some(x => x.isIntersecting); }).observe(pen);
  } else farmView.visible = true;
  if (typeof ResizeObserver === "function") new ResizeObserver(() => farmResize()).observe(pen);
  if (!farmView.timer) farmView.timer = setInterval(farmStep, 400);
  farmFill();
}

// (Re)build the animals when a new one is caught.
function farmFill() {
  const pen = farmView.pen;
  if (!pen) return;
  const sig = farmSignature();
  if (sig === farmView.sig) return;
  farmView.sig = sig;
  const animals = farmAnimals();
  const old = new Map(farmView.critters.map(c => [c.id, c]));
  pen.querySelectorAll(".fm-c").forEach(n => n.remove());
  if (farmPicked) farmSelect(null);
  const width = pen.clientWidth || 300;
  const { size, H } = farmLayout(animals.length, width);
  farmView.size = size;
  pen.style.height = H + "px";
  pen.style.setProperty("--fm-size", size + "px");
  farmView.W = width; farmView.H = H;
  farmView.critters = animals.map((a, i) => {
    const id = `${a.key}|${a.element}`;
    const prev = old.get(id);
    const layers = farmSpriteLayers(a);
    const anim = (MONSTER_ART[a.key] || {}).anim || "breathe";
    const node = document.createElement("div");
    node.className = "fm-c";
    node.dataset.i = i;
    node.title = `${ELEMENT_ADJECTIVE[a.element]} ${a.name}`;
    node.innerHTML = `<span class="fm-sh"></span><span class="fm-f"><span class="fm-a">` +
      `<img class="fm-l" src="${layers.body}" alt="" draggable="false">` +
      (layers.eye ? `<img class="fm-l fm-eye" src="${layers.eye}" alt="" draggable="false" style="animation-delay:${-((i * 1.37) % 6).toFixed(2)}s">` : "") +
      `</span></span><span class="fm-z">z</span>`;
    const c = prev ? { ...prev, node, i } : {
      id, node, i, name: node.title, fly: FARM_FLYERS.has(anim),
      x: Math.random(), y: Math.random(), face: Math.random() < 0.5 ? 1 : -1, until: 0, state: "idle",
    };
    node.querySelector(".fm-a").style.animationDelay = `${-((i * 0.53) % 3).toFixed(2)}s`;
    pen.appendChild(node);
    farmPlace(c, 0);
    farmSetState(c, c.state === "walk" ? "idle" : c.state);
    c.until = performance.now() + 500 + Math.random() * 6000;
    return c;
  });
}

function farmResize() {
  const pen = farmView.pen;
  if (!pen || !pen.clientWidth || pen.clientWidth === farmView.W) return;
  const { size, H } = farmLayout(farmView.critters.length, pen.clientWidth);
  farmView.W = pen.clientWidth; farmView.H = H; farmView.size = size;
  pen.style.height = H + "px";
  pen.style.setProperty("--fm-size", size + "px");
  for (const c of farmView.critters) farmPlace(c, 0);
}

// Put an animal at its spot (x, y are 0..1 of the free area). Moving takes `secs` seconds.
function farmPlace(c, secs) {
  const s = farmView.size;
  const px = c.x * Math.max(0, farmView.W - s), py = 6 + c.y * Math.max(0, farmView.H - s - 10);
  c.node.style.transitionDuration = secs + "s";
  c.node.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
  c.node.style.zIndex = String(10 + Math.round(py));
  c.node.classList.toggle("fm-left", c.face < 0);
}

function farmSetState(c, st) {
  if (c.state === st && c.node.classList.contains("s-" + st)) return;
  c.node.classList.remove("s-" + c.state);
  c.state = st;
  c.node.classList.add("s-" + st);
  c.node.classList.toggle("fm-fly", c.fly && st !== "sleep");
}

// What to do next: mostly wander and chill, sometimes nibble grass, nap or do a happy hop.
function farmChoose(c, now) {
  const r = Math.random();
  if (c.state === "sleep" && r < 0.5) { c.until = now + 4000 + Math.random() * 6000; return; } // keep napping
  if (r < 0.42) {
    // Walk to a spot not too far away.
    const nx = Math.min(1, Math.max(0, c.x + (Math.random() - 0.5) * 0.6));
    const ny = Math.min(1, Math.max(0, c.y + (Math.random() - 0.5) * 0.6));
    const dist = Math.hypot((nx - c.x) * farmView.W, (ny - c.y) * farmView.H);
    if (Math.abs(nx - c.x) > 0.01) c.face = nx > c.x ? 1 : -1;
    c.x = nx; c.y = ny;
    const secs = Math.max(1.2, dist / (c.fly ? 16 : 11));
    farmSetState(c, "walk");
    farmPlace(c, secs);
    c.until = now + secs * 1000 + 200;
  } else if (r < 0.66) {
    farmSetState(c, c.fly ? "idle" : "eat");
    c.until = now + 3000 + Math.random() * 5000;
  } else if (r < 0.76) {
    farmSetState(c, "sleep");
    c.until = now + 6000 + Math.random() * 9000;
  } else if (r < 0.82) {
    farmSetState(c, "hop");
    c.until = now + 1300;
  } else if (r < 0.88) {
    c.face = -c.face; // look around
    farmSetState(c, "idle");
    farmPlace(c, 0);
    c.until = now + 1500 + Math.random() * 2500;
  } else {
    farmSetState(c, "idle");
    c.until = now + 2000 + Math.random() * 5000;
  }
}

function farmStep() {
  if (!farmView.visible || document.hidden || !farmView.pen) return;
  const now = performance.now();
  for (const c of farmView.critters) if (now >= c.until) farmChoose(c, now);
}

// The animal picked by a tap (shown in the bar under the pen, with Release).
let farmPicked = null, farmReleaseArmed = false;
function farmSelect(c) {
  if (farmPicked && farmPicked.node) farmPicked.node.classList.remove("fm-picked");
  farmPicked = c;
  farmReleaseArmed = false;
  const bar = refs.farm && refs.farm.querySelector('[data-k="pick"]');
  if (!bar) return;
  bar.hidden = !c;
  if (!c) return;
  c.node.classList.add("fm-picked");
  setIconHTML(bar.querySelector('[data-k="pickName"]'), `${elementById[c.id.split("|")[1]].icon} <b>${escapeHtml(c.name)}</b>`);
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
  state.farm.released[c.id] = true;
  farmSelect(null);
  log(`You released the ${c.name}. Bye bye! Catch it again to bring it back to the farm.`);
  // Run off the nearest side, then rebuild the herd.
  c.face = c.x < 0.5 ? -1 : 1;
  c.x = c.x < 0.5 ? -0.25 : 1.25;
  farmSetState(c, "walk");
  c.until = Infinity;
  farmPlace(c, 1.4);
  c.node.classList.add("fm-leaving");
  setTimeout(() => { save(); render(); }, 1400);
}

// Tap an animal: it hops and says its name.
function farmPet(c) {
  if (!c) return;
  farmSelect(c);
  farmSetState(c, "hop");
  c.until = performance.now() + 1300;
  const old = farmView.pen.querySelector(".fm-tag");
  if (old) old.remove();
  const tag = document.createElement("div");
  tag.className = "fm-tag";
  tag.innerHTML = emo(`${elementById[c.id.split("|")[1]].icon} ${escapeHtml(c.name)}`);
  const s = farmView.size;
  const px = c.x * Math.max(0, farmView.W - s) + s / 2, py = 6 + c.y * Math.max(0, farmView.H - s - 10);
  tag.style.left = Math.min(farmView.W - 60, Math.max(60, px)) + "px";
  tag.style.top = Math.max(0, py - 22) + "px";
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
  const full = bestiaryList().length * ELEMENTS.length;
  set(card, "count", `${animals} of ${full} monsters live here (every monster, once per element).`);
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
    set(refs.farmRates[e.id], "n", fmt(rates[e.id]));
    set(refs.farmStash[e.id], "n", fmt(have));
    refs.farmRates[e.id].classList.toggle("dim", !rates[e.id]);
    refs.farmStash[e.id].classList.toggle("dim", have < 1);
    if (have >= 1) any = true;
    if (rates[e.id] > 0) soonest = Math.min(soonest, (1 - (have % 1)) / rates[e.id] * FARM_DAY_MS);
  }
  set(card, "next", soonest < Infinity ? `next essence in ${farmTimeLeft(soonest)}` : "catch monsters to start");
  card.querySelector('[data-k="collect"]').disabled = !any;
}
