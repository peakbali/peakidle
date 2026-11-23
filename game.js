// Peak Idle: mine ore, smith weapons and armor, sell them, grow your mine.
// Everything lives in this one file. Progress is saved in your browser (localStorage).

const SAVE_KEY = "peakidle-save-v1"; // kept the same so old saves still load
const SAVE_VERSION = 2;                // bump when the save format changes (see migrate())
const MAX_OFFLINE_SECONDS = 8 * 60 * 60; // offline mining is capped at 8 hours

// ---------- Game data ----------

// Each ore is also a gear material.
//   statMult: how much stronger gear of this material is than copper gear
//   costMult: how much more ore a piece of gear needs than the copper version
//   gearValue: coins per ore used when the gear is sold
const ORES = [
  { id: "copper",  name: "Copper",  icon: "🟠", perSecPerMiner: 1,    minerCost: 15,   unlockCost: 0,     statMult: 1,   costMult: 1,   gearValue: 1.25 },
  { id: "iron",    name: "Iron",    icon: "⚪", perSecPerMiner: 0.5,  minerCost: 120,  unlockCost: 100,   statMult: 2.2, costMult: 1.5, gearValue: 6 },
  { id: "gold",    name: "Gold",    icon: "🟡", perSecPerMiner: 0.25, minerCost: 900,  unlockCost: 1500,  statMult: 4.5, costMult: 2,   gearValue: 36 },
  { id: "mithril", name: "Mithril", icon: "🔷", perSecPerMiner: 0.1,  minerCost: 6000, unlockCost: 20000, statMult: 9,   costMult: 2.5, gearValue: 270 },
];

// The hero's stats. "power" boosts skills (skills arrive in a later update).
const STATS = [
  { id: "hp",      name: "HP",          icon: "❤️" },
  { id: "attack",  name: "Attack",      icon: "⚔️" },
  { id: "defense", name: "Defense",     icon: "🛡️" },
  { id: "agility", name: "Agility",     icon: "💨" },
  { id: "power",   name: "Skill power", icon: "✨" },
];
const HERO_BASE_STATS = { hp: 50, attack: 2, defense: 0, agility: 5, power: 0 };

// Where gear can be worn. One item per slot.
const SLOTS = [
  { id: "weapon",     name: "Weapon" },
  { id: "helmet",     name: "Helmet" },
  { id: "chestplate", name: "Chestplate" },
  { id: "gloves",     name: "Gloves" },
  { id: "boots",      name: "Boots" },
  { id: "shield",     name: "Shield" },
];

// Every gear type can be smithed from every ore.
//   cost:  copper ore needed (other ores multiply this by costMult)
//   stats: bonus for copper gear (other ores multiply this by statMult)
const GEAR_TYPES = [
  // Weapons
  { id: "sword",      name: "Sword",      slot: "weapon",     icon: "🗡️", cost: 12, stats: { attack: 5, agility: 1 },  note: "Balanced" },
  { id: "axe",        name: "Axe",        slot: "weapon",     icon: "🪓", cost: 15, stats: { attack: 8 },              note: "Hits hardest" },
  { id: "spear",      name: "Spear",      slot: "weapon",     icon: "🔱", cost: 13, stats: { attack: 6, defense: 1 },  note: "Keeps foes at a distance" },
  { id: "bow",        name: "Bow",        slot: "weapon",     icon: "🏹", cost: 10, stats: { attack: 4, agility: 4 },  note: "Quick and light" },
  { id: "staff",      name: "Staff",      slot: "weapon",     icon: "🪄", cost: 10, stats: { attack: 2, power: 6 },    note: "Boosts skills" },
  // Armor: heavy pieces give more defense, light pieces give more agility
  { id: "helmet",     name: "Helmet",     slot: "helmet",     icon: "🪖", cost: 15, stats: { defense: 2, hp: 5 },      note: "Medium" },
  { id: "chestplate", name: "Chestplate", slot: "chestplate", icon: "🥋", cost: 30, stats: { defense: 5, hp: 15 },     note: "Heavy" },
  { id: "gloves",     name: "Gloves",     slot: "gloves",     icon: "🧤", cost: 10, stats: { defense: 1, attack: 1, agility: 2 }, note: "Light" },
  { id: "boots",      name: "Boots",      slot: "boots",      icon: "🥾", cost: 12, stats: { defense: 1, agility: 3 }, note: "Light" },
  { id: "shield",     name: "Shield",     slot: "shield",     icon: "🛡️", cost: 20, stats: { defense: 4, hp: 10 },     note: "Heavy" },
];

// All recipes, built from every ore x every gear type (e.g. "iron_bow").
// cost: ore needed. price: coins when sold. element: weapons will get one later (fire, water, ...).
const RECIPES = [];
for (const ore of ORES) {
  for (const type of GEAR_TYPES) {
    const cost = Math.round(type.cost * ore.costMult);
    const stats = {};
    for (const [k, v] of Object.entries(type.stats)) stats[k] = Math.round(v * ore.statMult);
    RECIPES.push({
      id: `${ore.id}_${type.id}`,
      name: `${ore.name} ${type.name}`,
      ore: ore.id,
      type: type.id,
      slot: type.slot,
      icon: type.icon,
      note: type.note,
      cost,
      price: Math.round(cost * ore.gearValue),
      stats,
      element: null, // not used yet
    });
  }
}

// Item names from the first version of the game, so old saves keep their gear.
const OLD_ITEM_IDS = {
  copperDagger: "copper_sword",  copperHelm: "copper_helmet",
  ironSword: "iron_sword",       ironPlate: "iron_chestplate",
  goldAxe: "gold_axe",           goldShield: "gold_shield",
  mithrilBlade: "mithril_sword", mithrilArmor: "mithril_chestplate",
};

const recipeById = Object.fromEntries(RECIPES.map(r => [r.id, r]));
const slotById = Object.fromEntries(SLOTS.map(s => [s.id, s]));

const MINER_COST_GROWTH = 1.15; // each extra miner costs 15% more

// ---------- State ----------

function freshState() {
  const s = {
    version: SAVE_VERSION,
    coins: 0,
    pickaxe: 1,           // ore per click
    anvil: 1,             // sell price multiplier level
    totalSmithed: 0,
    ore: {}, miners: {}, unlocked: {},
    items: {},            // smithed gear in your bag: recipe id -> how many
    equipped: {},         // slot id -> { id: recipe id, element } or null
    lastSaved: Date.now(),
  };
  for (const o of ORES) {
    s.ore[o.id] = 0;
    s.miners[o.id] = 0;
    s.unlocked[o.id] = o.unlockCost === 0;
  }
  for (const r of RECIPES) s.items[r.id] = 0;
  for (const slot of SLOTS) s.equipped[slot.id] = null;
  return s;
}

// Upgrade an old save to the current format, step by step.
function migrate(saved) {
  if (!saved.version || saved.version < 2) {
    // v1 -> v2: the 8 old items became the new gear types.
    const items = saved.items || {};
    for (const [oldId, newId] of Object.entries(OLD_ITEM_IDS)) {
      if (items[oldId]) items[newId] = (items[newId] || 0) + items[oldId];
      delete items[oldId];
    }
    saved.items = items;
    saved.version = 2;
  }
  // Later versions add their steps here (monsters, skills, reincarnation...).
  return saved;
}

let state = load();

function load() {
  const s = freshState();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return s;
    const saved = migrate(JSON.parse(raw));
    // Merge so older saves still work when new ores or items are added.
    for (const key of ["coins", "pickaxe", "anvil", "totalSmithed", "lastSaved"]) {
      if (typeof saved[key] === "number") s[key] = saved[key];
    }
    for (const key of ["ore", "miners", "unlocked", "items"]) {
      for (const [k, v] of Object.entries(saved[key] || {})) {
        if (k in s[key]) s[key][k] = v;
      }
    }
    for (const slot of SLOTS) {
      const item = saved.equipped && saved.equipped[slot.id];
      const r = item && recipeById[item.id];
      if (r && r.slot === slot.id) s.equipped[slot.id] = { id: r.id, element: item.element || null };
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

// The hero's total stats: base stats plus everything equipped.
// Battles (coming later) read their numbers from here.
function heroStats() {
  const total = { ...HERO_BASE_STATS };
  for (const slot of SLOTS) {
    const item = state.equipped[slot.id];
    if (!item) continue;
    for (const [k, v] of Object.entries(recipeById[item.id].stats)) total[k] += v;
  }
  return total;
}

function statsText(stats) {
  return STATS.filter(st => stats[st.id]).map(st => `+${stats[st.id]} ${st.name.toLowerCase()}`).join(", ");
}

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
  const r = recipeById[recipeId];
  const canMake = Math.floor(state.ore[r.ore] / r.cost);
  const n = count === "max" ? canMake : Math.min(count, canMake);
  if (n <= 0) return;
  state.ore[r.ore] -= n * r.cost;
  state.items[r.id] += n;
  state.totalSmithed += n;
  render();
}

// Selling only sells gear in your bag. Equipped gear is safe. Sold gear is gone for good.
function sell(recipeId) {
  const r = recipeById[recipeId];
  const n = state.items[r.id];
  if (n <= 0) return 0;
  state.items[r.id] = 0;
  const coins = n * sellPrice(r);
  state.coins += coins;
  render();
  return coins;
}

function sellAllOf(oreId) {
  let coins = 0;
  for (const r of RECIPES) if (r.ore === oreId) coins += sell(r.id);
  if (coins > 0) log(`Sold all your ${oreById[oreId].name.toLowerCase()} gear for ${fmt(coins)} coins.`);
}

// Wear one item from your bag. Whatever was in that slot goes back to your bag.
function equip(recipeId) {
  const r = recipeById[recipeId];
  if (state.items[r.id] <= 0) return;
  unequip(r.slot);
  state.items[r.id] -= 1;
  state.equipped[r.slot] = { id: r.id, element: null };
  render();
}

function unequip(slotId) {
  const item = state.equipped[slotId];
  if (!item) return;
  state.items[item.id] += 1;
  state.equipped[slotId] = null;
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

// Which material tab the forge is showing.
let forgeOre = "copper";

function buildForge() {
  refs.recipes = {};
  if (!state.unlocked[forgeOre]) forgeOre = "copper";

  const tabs = document.getElementById("forge-tabs");
  tabs.innerHTML = "";
  for (const o of ORES) {
    if (!state.unlocked[o.id]) continue;
    const b = el(`<button class="tab${o.id === forgeOre ? " active" : ""}">${o.icon} ${o.name}</button>`);
    b.onclick = () => { forgeOre = o.id; buildForge(); render(); };
    tabs.appendChild(b);
  }
  const ore = oreById[forgeOre];
  const sellAllBtn = el(`<button class="tab sell-all">Sell all ${ore.name.toLowerCase()} gear</button>`);
  sellAllBtn.onclick = () => sellAllOf(forgeOre);
  tabs.appendChild(sellAllBtn);
  refs.sellAll = sellAllBtn;

  const box = document.getElementById("recipes");
  box.innerHTML = "";
  let lastGroup = null;
  for (const r of RECIPES) {
    if (r.ore !== forgeOre) continue;
    const group = r.slot === "weapon" ? "Weapons" : "Armor";
    if (group !== lastGroup) {
      box.appendChild(el(`<h3>${group}</h3>`));
      lastGroup = group;
    }
    const card = el(`
      <div class="card">
        <div class="row">
          <span class="name">${r.icon} ${r.name} <span class="tag" data-k="worn" hidden>Equipped</span></span>
          <span class="small">In bag: <span class="num" data-k="owned"></span></span>
        </div>
        <div class="stats-line">${statsText(r.stats)} <span class="small">· ${r.note}</span></div>
        <div class="small">Costs ${r.cost} ${ore.name.toLowerCase()} ore · sells for <span data-k="price"></span> 🪙</div>
        <div class="buttons">
          <button data-k="make1">Smith 1</button>
          <button data-k="makeMax">Smith max</button>
          <button data-k="equip">Equip</button>
          <button data-k="sell" class="primary">Sell all</button>
        </div>
      </div>`);
    card.querySelector('[data-k="make1"]').onclick = () => smith(r.id, 1);
    card.querySelector('[data-k="makeMax"]').onclick = () => smith(r.id, "max");
    card.querySelector('[data-k="equip"]').onclick = () => equip(r.id);
    card.querySelector('[data-k="sell"]').onclick = () => sell(r.id);
    refs.recipes[r.id] = card;
    box.appendChild(card);
  }
}

function buildHero() {
  const statsBox = document.getElementById("hero-stats");
  statsBox.innerHTML = "";
  refs.stats = {};
  for (const st of STATS) {
    const row = el(`
      <div class="stat">
        <span>${st.icon} ${st.name}</span>
        <span><b class="num" data-k="total"></b> <span class="small bonus" data-k="bonus"></span></span>
      </div>`);
    refs.stats[st.id] = row;
    statsBox.appendChild(row);
  }

  const slotsBox = document.getElementById("hero-slots");
  slotsBox.innerHTML = "";
  refs.slots = {};
  for (const slot of SLOTS) {
    const row = el(`
      <div class="slot">
        <div>
          <div class="small">${slot.name}</div>
          <div class="name" data-k="item"></div>
          <div class="small" data-k="itemStats"></div>
        </div>
        <button data-k="remove">Unequip</button>
      </div>`);
    row.querySelector('[data-k="remove"]').onclick = () => unequip(slot.id);
    refs.slots[slot.id] = row;
    slotsBox.appendChild(row);
  }
}

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

  buildForge();
  buildHero();

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

  refs.smithed = el(`<div class="small">Items smithed so far: <span data-k="total"></span></div>`);
  upBox.appendChild(refs.smithed);

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
    const worn = state.equipped[r.slot] && state.equipped[r.slot].id === r.id;
    card.querySelector('[data-k="worn"]').hidden = !worn;
    card.querySelector('[data-k="equip"]').disabled = state.items[r.id] <= 0;
  }
  if (refs.sellAll) {
    refs.sellAll.disabled = !RECIPES.some(r => r.ore === forgeOre && state.items[r.id] > 0);
  }

  set(refs.pickaxe, "lvl", String(state.pickaxe));
  set(refs.pickaxe, "cost", fmt(pickaxeCost()));
  refs.pickaxe.querySelector('[data-k="buy"]').disabled = state.coins < pickaxeCost();

  set(refs.anvil, "lvl", String(state.anvil));
  set(refs.anvil, "mult", priceMultiplier().toFixed(2));
  set(refs.anvil, "cost", fmt(anvilCost()));
  refs.anvil.querySelector('[data-k="buy"]').disabled = state.coins < anvilCost();

  set(refs.smithed, "total", fmt(state.totalSmithed));

  const hero = heroStats();
  for (const st of STATS) {
    const bonus = hero[st.id] - HERO_BASE_STATS[st.id];
    set(refs.stats[st.id], "total", fmt(hero[st.id]));
    set(refs.stats[st.id], "bonus", bonus > 0 ? `(+${fmt(bonus)} from gear)` : "");
  }
  for (const slot of SLOTS) {
    const row = refs.slots[slot.id];
    const item = state.equipped[slot.id];
    const r = item && recipeById[item.id];
    set(row, "item", r ? `${r.icon} ${r.name}` : "Empty");
    set(row, "itemStats", r ? statsText(r.stats) : "Smith something in the Forge and press Equip.");
    row.classList.toggle("empty", !r);
    row.querySelector('[data-k="remove"]').hidden = !r;
  }
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
