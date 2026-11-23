// Peak Idle: mine ore, smith weapons and armor, sell them, grow your mine.
// Everything lives in this one file. Progress is saved in your browser (localStorage).

const SAVE_KEY = "peakidle-save-v1";
const MAX_OFFLINE_SECONDS = 8 * 60 * 60; // offline mining is capped at 8 hours

// ---------- Game data ----------

const ORES = [
  { id: "copper",  name: "Copper",  icon: "🟠", perSecPerMiner: 1,   minerCost: 15,   unlockCost: 0 },
  { id: "iron",    name: "Iron",    icon: "⚪", perSecPerMiner: 0.5, minerCost: 120,  unlockCost: 100 },
  { id: "gold",    name: "Gold",    icon: "🟡", perSecPerMiner: 0.25, minerCost: 900, unlockCost: 1500 },
  { id: "mithril", name: "Mithril", icon: "🔷", perSecPerMiner: 0.1, minerCost: 6000, unlockCost: 20000 },
];

// type: "weapon" or "armor". cost: ore needed. price: coins when sold.
const RECIPES = [
  { id: "copperDagger", name: "Copper Dagger",     type: "weapon", ore: "copper",  cost: 10,  price: 12 },
  { id: "copperHelm",   name: "Copper Helmet",     type: "armor",  ore: "copper",  cost: 25,  price: 32 },
  { id: "ironSword",    name: "Iron Sword",        type: "weapon", ore: "iron",    cost: 15,  price: 90 },
  { id: "ironPlate",    name: "Iron Chestplate",   type: "armor",  ore: "iron",    cost: 40,  price: 260 },
  { id: "goldAxe",      name: "Gold Battleaxe",    type: "weapon", ore: "gold",    cost: 20,  price: 700 },
  { id: "goldShield",   name: "Gold Shield",       type: "armor",  ore: "gold",    cost: 50,  price: 1900 },
  { id: "mithrilBlade", name: "Mithril Blade",     type: "weapon", ore: "mithril", cost: 25,  price: 6500 },
  { id: "mithrilArmor", name: "Mithril Armor",     type: "armor",  ore: "mithril", cost: 60,  price: 17000 },
];

const MINER_COST_GROWTH = 1.15; // each extra miner costs 15% more

// ---------- State ----------

function freshState() {
  const s = {
    coins: 0,
    pickaxe: 1,           // ore per click
    anvil: 1,             // sell price multiplier level
    totalSmithed: 0,
    ore: {}, miners: {}, unlocked: {}, items: {},
    lastSaved: Date.now(),
  };
  for (const o of ORES) {
    s.ore[o.id] = 0;
    s.miners[o.id] = 0;
    s.unlocked[o.id] = o.unlockCost === 0;
  }
  for (const r of RECIPES) s.items[r.id] = 0;
  return s;
}

let state = load();

function load() {
  const s = freshState();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return s;
    const saved = JSON.parse(raw);
    // Merge so older saves still work when new ores or items are added.
    for (const key of ["coins", "pickaxe", "anvil", "totalSmithed", "lastSaved"]) {
      if (typeof saved[key] === "number") s[key] = saved[key];
    }
    for (const key of ["ore", "miners", "unlocked", "items"]) {
      Object.assign(s[key], saved[key] || {});
    }
  } catch (e) {
    console.warn("Could not load save", e);
  }
  return s;
}

function save() {
  state.lastSaved = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    // Private windows can block storage; the game still runs, it just won't remember.
  }
}

// ---------- Rules ----------

const oreById = Object.fromEntries(ORES.map(o => [o.id, o]));

function minerCost(ore) {
  return Math.ceil(ore.minerCost * Math.pow(MINER_COST_GROWTH, state.miners[ore.id]));
}
function orePerSecond(ore) {
  return state.miners[ore.id] * ore.perSecPerMiner;
}
function clickAmount(ore) {
  // Harder ores give less per click, but never less than a fraction.
  return state.pickaxe * ore.perSecPerMiner;
}
function pickaxeCost() { return Math.ceil(50 * Math.pow(3, state.pickaxe - 1)); }
function anvilCost()   { return Math.ceil(200 * Math.pow(4, state.anvil - 1)); }
function priceMultiplier() { return 1 + (state.anvil - 1) * 0.25; }
function sellPrice(recipe) { return Math.floor(recipe.price * priceMultiplier()); }

function addOre(dt) {
  for (const o of ORES) state.ore[o.id] += orePerSecond(o) * dt;
}

// ---------- Actions ----------

function mine(oreId) {
  const ore = oreById[oreId];
  if (!state.unlocked[oreId]) return;
  state.ore[oreId] += clickAmount(ore);
  render();
}

function hireMiner(oreId) {
  const ore = oreById[oreId];
  const cost = minerCost(ore);
  if (state.coins < cost) return;
  state.coins -= cost;
  state.miners[oreId] += 1;
  render();
}

function unlockOre(oreId) {
  const ore = oreById[oreId];
  if (state.unlocked[oreId] || state.coins < ore.unlockCost) return;
  state.coins -= ore.unlockCost;
  state.unlocked[oreId] = true;
  log(`You opened a ${ore.name} mine!`);
  buildUI();
}

function smith(recipeId, count) {
  const r = RECIPES.find(x => x.id === recipeId);
  const canMake = Math.floor(state.ore[r.ore] / r.cost);
  const n = count === "max" ? canMake : Math.min(count, canMake);
  if (n <= 0) return;
  state.ore[r.ore] -= n * r.cost;
  state.items[r.id] += n;
  state.totalSmithed += n;
  render();
}

function sell(recipeId) {
  const r = RECIPES.find(x => x.id === recipeId);
  const n = state.items[r.id];
  if (n <= 0) return;
  state.items[r.id] = 0;
  state.coins += n * sellPrice(r);
  render();
}

function buyPickaxe() {
  const cost = pickaxeCost();
  if (state.coins < cost) return;
  state.coins -= cost;
  state.pickaxe += 1;
  render();
}

function buyAnvil() {
  const cost = anvilCost();
  if (state.coins < cost) return;
  state.coins -= cost;
  state.anvil += 1;
  render();
}

// ---------- UI ----------

function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  const units = ["K", "M", "B", "T"];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + units[i];
}
function fmtRate(n) { return n < 10 ? n.toFixed(2).replace(/\.?0+$/, "") : fmt(n); }

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

let logTimer;
function log(msg) {
  const box = document.getElementById("log");
  box.textContent = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(() => { box.textContent = ""; }, 6000);
}

// Elements we update every frame, so we don't rebuild buttons while you're clicking.
let refs = {};

function buildUI() {
  refs = { ores: {}, recipes: {} };

  const oresBox = document.getElementById("ores");
  oresBox.innerHTML = "";
  for (const o of ORES) {
    if (state.unlocked[o.id]) {
      const card = el(`
        <div class="card">
          <div class="row">
            <button class="ore-btn" title="Mine ${o.name}">${o.icon}</button>
            <div style="flex:1">
              <div class="name">${o.name} ore: <span class="num" data-k="amount"></span></div>
              <div class="small">Miners: <span data-k="miners"></span> · <span data-k="rate"></span>/sec · +<span data-k="click"></span> per click</div>
            </div>
          </div>
          <div class="buttons">
            <button data-k="hire">Hire miner (<span data-k="hireCost"></span> 🪙)</button>
          </div>
        </div>`);
      card.querySelector(".ore-btn").onclick = () => mine(o.id);
      card.querySelector('[data-k="hire"]').onclick = () => hireMiner(o.id);
      refs.ores[o.id] = card;
      oresBox.appendChild(card);
    } else {
      const card = el(`
        <div class="card locked">
          <div class="row">
            <span class="name">${o.icon} ${o.name} mine (locked)</span>
            <button data-k="unlock" class="primary">Open for ${fmt(o.unlockCost)} 🪙</button>
          </div>
        </div>`);
      card.querySelector('[data-k="unlock"]').onclick = () => unlockOre(o.id);
      refs.ores[o.id] = card;
      oresBox.appendChild(card);
      break; // only show the next locked mine, keep the rest a surprise
    }
  }

  const recipesBox = document.getElementById("recipes");
  recipesBox.innerHTML = "";
  for (const r of RECIPES) {
    if (!state.unlocked[r.ore]) continue;
    const ore = oreById[r.ore];
    const card = el(`
      <div class="card">
        <div class="row">
          <span class="name">${r.type === "weapon" ? "🗡️" : "🛡️"} ${r.name}</span>
          <span class="small">Owned: <span class="num" data-k="owned"></span></span>
        </div>
        <div class="small">Costs ${r.cost} ${ore.name.toLowerCase()} ore · sells for <span data-k="price"></span> 🪙</div>
        <div class="buttons">
          <button data-k="make1">Smith 1</button>
          <button data-k="makeMax">Smith max</button>
          <button data-k="sell" class="primary">Sell all</button>
        </div>
      </div>`);
    card.querySelector('[data-k="make1"]').onclick = () => smith(r.id, 1);
    card.querySelector('[data-k="makeMax"]').onclick = () => smith(r.id, "max");
    card.querySelector('[data-k="sell"]').onclick = () => sell(r.id);
    refs.recipes[r.id] = card;
    recipesBox.appendChild(card);
  }

  const upBox = document.getElementById("upgrades");
  upBox.innerHTML = "";
  refs.pickaxe = el(`
    <div class="card">
      <div class="name">⛏️ Better pickaxe (level <span data-k="lvl"></span>)</div>
      <div class="small">Mine more ore with each click.</div>
      <div class="buttons"><button data-k="buy">Upgrade for <span data-k="cost"></span> 🪙</button></div>
    </div>`);
  refs.pickaxe.querySelector('[data-k="buy"]').onclick = buyPickaxe;
  upBox.appendChild(refs.pickaxe);

  refs.anvil = el(`
    <div class="card">
      <div class="name">🔨 Master anvil (level <span data-k="lvl"></span>)</div>
      <div class="small">Your gear sells for +25% more per level. Now: ×<span data-k="mult"></span></div>
      <div class="buttons"><button data-k="buy">Upgrade for <span data-k="cost"></span> 🪙</button></div>
    </div>`);
  refs.anvil.querySelector('[data-k="buy"]').onclick = buyAnvil;
  upBox.appendChild(refs.anvil);

  refs.stats = el(`<div class="small">Items smithed so far: <span data-k="total"></span></div>`);
  upBox.appendChild(refs.stats);

  render();
}

function set(root, key, text) {
  const node = root.querySelector(`[data-k="${key}"]`);
  if (node && node.textContent !== text) node.textContent = text;
}

function render() {
  document.getElementById("coins").textContent = fmt(state.coins);

  for (const o of ORES) {
    const card = refs.ores[o.id];
    if (!card) continue;
    if (state.unlocked[o.id]) {
      set(card, "amount", fmt(state.ore[o.id]));
      set(card, "miners", String(state.miners[o.id]));
      set(card, "rate", fmtRate(orePerSecond(o)));
      set(card, "click", fmtRate(clickAmount(o)));
      const cost = minerCost(o);
      set(card, "hireCost", fmt(cost));
      card.querySelector('[data-k="hire"]').disabled = state.coins < cost;
    } else {
      card.querySelector('[data-k="unlock"]').disabled = state.coins < o.unlockCost;
    }
  }

  for (const r of RECIPES) {
    const card = refs.recipes[r.id];
    if (!card) continue;
    const canMake = state.ore[r.ore] >= r.cost;
    set(card, "owned", fmt(state.items[r.id]));
    set(card, "price", fmt(sellPrice(r)));
    card.querySelector('[data-k="make1"]').disabled = !canMake;
    card.querySelector('[data-k="makeMax"]').disabled = !canMake;
    card.querySelector('[data-k="sell"]').disabled = state.items[r.id] <= 0;
  }

  set(refs.pickaxe, "lvl", String(state.pickaxe));
  set(refs.pickaxe, "cost", fmt(pickaxeCost()));
  refs.pickaxe.querySelector('[data-k="buy"]').disabled = state.coins < pickaxeCost();

  set(refs.anvil, "lvl", String(state.anvil));
  set(refs.anvil, "mult", priceMultiplier().toFixed(2));
  set(refs.anvil, "cost", fmt(anvilCost()));
  refs.anvil.querySelector('[data-k="buy"]').disabled = state.coins < anvilCost();

  set(refs.stats, "total", fmt(state.totalSmithed));
}

// ---------- Main loop ----------

function start() {
  // Offline progress: miners kept working while the page was closed.
  const away = Math.min((Date.now() - state.lastSaved) / 1000, MAX_OFFLINE_SECONDS);
  if (away > 10 && ORES.some(o => state.miners[o.id] > 0)) {
    const before = { ...state.ore };
    addOre(away);
    const gained = ORES
      .filter(o => state.ore[o.id] - before[o.id] >= 1)
      .map(o => `${fmt(state.ore[o.id] - before[o.id])} ${o.name.toLowerCase()}`);
    if (gained.length) log(`Welcome back! Your miners dug up ${gained.join(", ")} ore.`);
  }

  buildUI();

  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    addOre((now - last) / 1000);
    last = now;
    render();
  }, 100);

  setInterval(save, 5000);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });

  document.getElementById("reset").onclick = () => {
    if (!confirm("Start over? This erases all your progress.")) return;
    state = freshState();
    save();
    buildUI();
  };
}

start();
