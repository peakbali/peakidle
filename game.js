// Peak Idle: mine ore, smith weapons and armor, sell them, grow your mine.
// Everything lives in this one file. Progress is saved in your browser (localStorage).

const SAVE_KEY = "peakidle-save-v1"; // kept the same so old saves still load
const SAVE_VERSION = 3;                // bump when the save format changes (see migrate())
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
// Luck is your critical hit chance in % (a crit does double damage). It comes from Soul attributes later.
const STATS = [
  { id: "hp",      name: "HP",          icon: "❤️" },
  { id: "attack",  name: "Attack",      icon: "⚔️" },
  { id: "defense", name: "Defense",     icon: "🛡️" },
  { id: "agility", name: "Agility",     icon: "💨" },
  { id: "power",   name: "Skill power", icon: "✨" },
  { id: "luck",    name: "Luck",        icon: "🍀" },
];
const HERO_BASE_STATS = { hp: 50, attack: 2, defense: 0, agility: 5, power: 0, luck: 0 };

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

// ---------- Elements ----------

// Each element beats the next one in a loop:
// Fire beats Ice, Ice beats Wind, Wind beats Earth, Earth beats Lightning, Lightning beats Fire.
// Every element also has its own drop, which monsters of that element leave behind.
const ELEMENTS = [
  { id: "fire",      name: "Fire",      icon: "🔥", beats: "ice",       drop: "Fire Essence" },
  { id: "ice",       name: "Ice",       icon: "❄️", beats: "wind",      drop: "Ice Essence" },
  { id: "wind",      name: "Wind",      icon: "🌪️", beats: "earth",     drop: "Wind Essence" },
  { id: "earth",     name: "Earth",     icon: "🪨", beats: "lightning", drop: "Earth Essence" },
  { id: "lightning", name: "Lightning", icon: "⚡", beats: "fire",      drop: "Lightning Essence" },
];
const elementById = Object.fromEntries(ELEMENTS.map(e => [e.id, e]));
const WEAK_HIT = 1.5;   // hitting a monster's weakness does 50% more damage
const RESISTED_HIT = 0.5; // hitting an element it is strong against does half damage

// A monster is weak to the element that beats it, and strong against the element it beats.
function weaknessOf(elementId) { return ELEMENTS.find(e => e.beats === elementId).id; }
function strengthOf(elementId) { return elementById[elementId].beats; }

// Damage multiplier when an attack of `attackEl` (or null = neutral) hits a target of `targetEl`.
function elementMultiplier(attackEl, targetEl) {
  if (!attackEl || !targetEl) return 1;
  if (elementById[attackEl].beats === targetEl) return WEAK_HIT;
  if (elementById[targetEl].beats === attackEl) return RESISTED_HIT;
  return 1;
}

// ---------- Monsters ----------

// A ladder of areas from easy to hard. Beating a monster unlocks the next one,
// and the last monster of each area is its boss.
const AREAS = [
  { id: "tunnels", name: "Mossy Tunnels", icon: "🌿", monsters: [
    { id: "cinder_rat",    name: "Cinder Rat",    icon: "🐀", element: "fire" },
    { id: "frost_beetle",  name: "Frost Beetle",  icon: "🪲", element: "ice" },
    { id: "spark_bat",     name: "Spark Bat",     icon: "🦇", element: "lightning" },
    { id: "mud_slime",     name: "Mud Slime",     icon: "🟤", element: "earth" },
    { id: "howling_wolf",  name: "Howling Wolf",  icon: "🐺", element: "wind", boss: true },
  ]},
  { id: "deep_mine", name: "Deep Mine", icon: "🕳️", monsters: [
    { id: "cave_gust",     name: "Cave Gust",     icon: "💨", element: "wind" },
    { id: "stone_golem",   name: "Stone Golem",   icon: "🗿", element: "earth" },
    { id: "ember_imp",     name: "Ember Imp",     icon: "👺", element: "fire" },
    { id: "volt_eel",      name: "Volt Eel",      icon: "🐍", element: "lightning" },
    { id: "glacier_troll", name: "Glacier Troll", icon: "🧌", element: "ice", boss: true },
  ]},
  { id: "molten_halls", name: "Molten Halls", icon: "🌋", monsters: [
    { id: "ash_hound",      name: "Ash Hound",      icon: "🐕", element: "fire" },
    { id: "thunder_hawk",   name: "Thunder Hawk",   icon: "🦅", element: "lightning" },
    { id: "crystal_spider", name: "Crystal Spider", icon: "🕷️", element: "ice" },
    { id: "storm_harpy",    name: "Storm Harpy",    icon: "🪶", element: "wind" },
    { id: "magma_wyrm",     name: "Magma Wyrm",     icon: "🐉", element: "fire", boss: true },
  ]},
  { id: "sky_peak", name: "Sky Peak", icon: "🏔️", monsters: [
    { id: "frost_giant",    name: "Frost Giant",    icon: "🥶", element: "ice" },
    { id: "quake_behemoth", name: "Quake Behemoth", icon: "🦏", element: "earth" },
    { id: "tempest_djinn",  name: "Tempest Djinn",  icon: "🧞", element: "wind" },
    { id: "storm_titan",    name: "Storm Titan",    icon: "⛈️", element: "lightning" },
    { id: "peak_dragon",    name: "Elder Peak Dragon", icon: "🐲", element: "earth", boss: true },
  ]},
];

// Monster stats grow exponentially along the ladder: stat = start * growth ^ (position in ladder).
const MONSTER_SCALING = {
  hp:      { start: 30,  growth: 1.17 },
  attack:  { start: 4,   growth: 1.17 },
  defense: { start: 1.5, growth: 1.18 },
  agility: { start: 4,   growth: 1.12 },
  coins:   { start: 10,  growth: 1.4 }, // coins for a win
  drops:   { start: 1,   growth: 1.2 },  // element drops for a win
};
const BOSS_MULT = { hp: 1.6, attack: 1.15, defense: 1.15, agility: 1.1, coins: 3, drops: 3 };
const MONSTER_COOLDOWN_MS = 15 * 60 * 1000; // each monster rests 15 minutes after a fight

// Battle rules
const BATTLE = {
  startMana: 3,
  manaPerTurn: 1,
  maxMana: 5,
  skillSlots: 3,          // skills arrive with the merchant (step 3)
  critMultiplier: 2,      // a critical hit does double damage; crit chance = luck %
  heavyEvery: 3,          // monsters wind up a heavy attack every 3rd turn
  heavyMultiplier: 1.8,
  guardMultiplier: 0.4,   // guarding takes only 40% damage
};

const MONSTERS = [];
AREAS.forEach(area => area.monsters.forEach(m => {
  const n = MONSTERS.length;
  const stat = key => MONSTER_SCALING[key].start * Math.pow(MONSTER_SCALING[key].growth, n) * (m.boss ? BOSS_MULT[key] : 1);
  MONSTERS.push({
    ...m,
    area: area.id,
    index: n,
    stats: {
      hp: Math.round(stat("hp")),
      attack: Math.round(stat("attack")),
      defense: Math.round(stat("defense")),
      agility: Math.round(stat("agility")),
    },
    reward: { coins: Math.round(stat("coins")), drops: Math.round(stat("drops")) },
  });
}));
const monsterById = Object.fromEntries(MONSTERS.map(m => [m.id, m]));
const areaById = Object.fromEntries(AREAS.map(a => [a.id, a]));

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
    drops: {},            // element id -> how many essences you have
    beaten: {},           // monster id -> how many times you've won against it
    cooldowns: {},        // monster id -> time (ms) when it can be fought again
    skillSlots: [null, null, null], // equipped skills (step 3)
    battle: null,         // the fight in progress, saved so a reload can't skip it
    lastSaved: Date.now(),
  };
  for (const e of ELEMENTS) s.drops[e.id] = 0;
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
  if (saved.version < 3) {
    // v2 -> v3: monsters, battles and drops. New fields start empty (freshState fills them in).
    saved.version = 3;
  }
  // Later versions add their steps here (skills, reincarnation...).
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
    for (const key of ["ore", "miners", "unlocked", "items", "drops"]) {
      for (const [k, v] of Object.entries(saved[key] || {})) {
        if (k in s[key]) s[key][k] = v;
      }
    }
    for (const slot of SLOTS) {
      const item = saved.equipped && saved.equipped[slot.id];
      const r = item && recipeById[item.id];
      if (r && r.slot === slot.id) s.equipped[slot.id] = { id: r.id, element: item.element || null };
    }
    for (const k of ["beaten", "cooldowns"]) {
      for (const [id, v] of Object.entries(saved[k] || {})) if (monsterById[id]) s[k][id] = v;
    }
    if (saved.battle && monsterById[saved.battle.monsterId]) s.battle = saved.battle;
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

// ---------- Monster rules ----------

// A monster can be fought once the one before it in the ladder has been beaten.
function monsterUnlocked(m) {
  return m.index === 0 || (state.beaten[MONSTERS[m.index - 1].id] || 0) > 0;
}
function areaUnlocked(area) { return monsterUnlocked(monsterById[area.monsters[0].id]); }
function cooldownLeft(m) { return Math.max(0, (state.cooldowns[m.id] || 0) - Date.now()); }
function canFight(m) { return !state.battle && monsterUnlocked(m) && cooldownLeft(m) === 0; }

// The element your basic attack uses: the equipped weapon's (null = neutral, until enchanting arrives).
function weaponElement() {
  const w = state.equipped.weapon;
  return (w && w.element) || null;
}

// Damage from one hit. Scales the same at every level, so exponential stats stay fair:
// equal attack and defense take off half; much more defense takes off much more.
function baseDamage(attack, defense) {
  if (attack <= 0) return 0;
  return attack * attack / (attack + Math.max(0, defense));
}

// Chance to dodge: 5% when equally quick, more when you're quicker, never above 30%.
function dodgeChance(defenderAgility, attackerAgility) {
  const d = defenderAgility, a = attackerAgility;
  if (d + a <= 0) return 0.05;
  return Math.min(0.3, Math.max(0, 0.05 + 0.25 * (d - a) / (d + a)));
}

// Work out one attack. Returns { damage, dodged, crit, mult } and doesn't change anything.
function rollHit({ attack, defense, attackEl, targetEl, critChance, dodge, extra = 1 }) {
  if (Math.random() < dodge) return { damage: 0, dodged: true, crit: false, mult: 1 };
  const mult = elementMultiplier(attackEl, targetEl);
  const crit = Math.random() < critChance;
  const spread = 0.9 + Math.random() * 0.2; // ±10% so fights aren't identical
  let damage = baseDamage(attack, defense) * mult * spread * extra * (crit ? BATTLE.critMultiplier : 1);
  damage = Math.max(1, Math.round(damage));
  return { damage, dodged: false, crit, mult };
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

// ---------- Battle ----------
// A battle is plain data in state.battle, so it's saved and survives a page reload.
// Your stats are locked in when the fight starts.

function startBattle(monsterId) {
  const m = monsterById[monsterId];
  if (!m || !canFight(m)) return;
  const hero = heroStats();
  state.battle = {
    monsterId: m.id,
    hero: { ...hero, element: weaponElement() },
    heroHp: hero.hp,
    monsterHp: m.stats.hp,
    mana: BATTLE.startMana,
    turn: 1,
    guarding: false,
    charging: false,   // the monster is winding up a heavy attack
    log: [`A wild ${m.name} appears!`],
    result: null,      // "win", "lose" or "fled" once it's over
  };
  // Quicker monsters strike first.
  if (m.stats.agility > hero.agility) {
    state.battle.log.push(`${m.name} is quicker and strikes first!`);
    monsterTurn();
  }
  save();
  openBattle();
}

function battleLog(msg) {
  const b = state.battle;
  b.log.push(msg);
  if (b.log.length > 60) b.log.shift();
}

// Everything you can do on your turn goes through here, so skills can plug in later.
function battleAction(action) {
  const b = state.battle;
  if (!b || b.result) return;
  const m = monsterById[b.monsterId];

  if (action === "attack") {
    const hit = rollHit({
      attack: b.hero.attack, defense: m.stats.defense,
      attackEl: b.hero.element, targetEl: m.element,
      critChance: b.hero.luck / 100,
      dodge: dodgeChance(m.stats.agility, b.hero.agility),
    });
    if (hit.dodged) {
      battleLog(`You attack, but ${m.name} dodges!`);
    } else {
      b.monsterHp = Math.max(0, b.monsterHp - hit.damage);
      let msg = `You hit ${m.name} for ${hit.damage}.`;
      if (hit.crit) msg += " Critical hit!";
      if (hit.mult > 1) msg += " It's weak to that!";
      if (hit.mult < 1) msg += " It resists that.";
      battleLog(msg);
    }
  } else if (action === "guard") {
    b.guarding = true;
    battleLog("You raise your guard.");
  } else if (action === "flee") {
    battleLog("You run away. No harm done.");
    return endBattle("fled");
  } else {
    return; // unknown action (skills come later)
  }

  if (b.monsterHp <= 0) return endBattle("win");
  monsterTurn();
  if (b.heroHp <= 0) return endBattle("lose");

  b.turn += 1;
  b.guarding = false;
  b.mana = Math.min(BATTLE.maxMana, b.mana + BATTLE.manaPerTurn);
  save();
  renderBattle();
}

function monsterTurn() {
  const b = state.battle;
  const m = monsterById[b.monsterId];
  const heavy = b.charging;
  b.charging = false;
  const hit = rollHit({
    attack: m.stats.attack, defense: b.hero.defense,
    attackEl: m.element, targetEl: null, // armor has no element (yet)
    critChance: 0,
    dodge: dodgeChance(b.hero.agility, m.stats.agility),
    extra: (heavy ? BATTLE.heavyMultiplier : 1) * (b.guarding ? BATTLE.guardMultiplier : 1),
  });
  const what = heavy ? "unleashes a heavy attack" : "attacks";
  if (hit.dodged) {
    battleLog(`${m.name} ${what}, but you dodge!`);
  } else {
    b.heroHp = Math.max(0, b.heroHp - hit.damage);
    battleLog(`${m.name} ${what} for ${hit.damage}${b.guarding ? " (guarded)" : ""}.`);
  }
  if (!heavy && b.heroHp > 0 && b.turn % BATTLE.heavyEvery === BATTLE.heavyEvery - 1) {
    b.charging = true;
    battleLog(`${m.name} is winding up a heavy attack! Guard to soften it.`);
  }
}

function endBattle(result) {
  const b = state.battle;
  const m = monsterById[b.monsterId];
  b.result = result;
  state.cooldowns[m.id] = Date.now() + MONSTER_COOLDOWN_MS;
  if (result === "win") {
    const firstWin = !state.beaten[m.id];
    state.beaten[m.id] = (state.beaten[m.id] || 0) + 1;
    state.drops[m.element] += m.reward.drops;
    state.coins += m.reward.coins;
    const e = elementById[m.element];
    battleLog(`You win! You get ${m.reward.drops} ${e.icon} ${e.drop} and ${fmt(m.reward.coins)} 🪙.`);
    const next = MONSTERS[m.index + 1];
    if (firstWin && next) {
      battleLog(next.area !== m.area
        ? `A new area opens: ${areaById[next.area].name}!`
        : `${next.name} can now be fought.`);
    }
  } else if (result === "lose") {
    battleLog(`${m.name} knocks you out. You wake up back at camp, nothing lost.`);
  }
  save();
  renderBattle();
  buildAdventure();
  render();
}

function closeBattle() {
  if (state.battle && !state.battle.result) return; // finish or run away first
  state.battle = null;
  save();
  document.getElementById("battle").hidden = true;
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
          ${slot.id === "weapon" ? `<div class="small" data-k="element"></div>` : ""}
        </div>
        <button data-k="remove">Unequip</button>
      </div>`);
    row.querySelector('[data-k="remove"]').onclick = () => unequip(slot.id);
    refs.slots[slot.id] = row;
    slotsBox.appendChild(row);
  }
}

function elementTag(elementId) {
  if (!elementId) return `<span class="el el-none">Neutral</span>`;
  const e = elementById[elementId];
  return `<span class="el el-${e.id}">${e.icon} ${e.name}</span>`;
}

function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function buildAdventure() {
  refs.monsters = {};
  refs.drops = {};

  const dropsBox = document.getElementById("drops");
  dropsBox.innerHTML = "";
  for (const e of ELEMENTS) {
    const chip = el(`<div class="drop el-${e.id}" title="${e.drop}: dropped by ${e.name} monsters">${e.icon} <span class="num" data-k="n"></span> <span class="small">${e.drop}</span></div>`);
    refs.drops[e.id] = chip;
    dropsBox.appendChild(chip);
  }

  const box = document.getElementById("areas");
  box.innerHTML = "";
  for (const area of AREAS) {
    if (!areaUnlocked(area)) {
      const prevBoss = MONSTERS[monsterById[area.monsters[0].id].index - 1];
      box.appendChild(el(`<div class="card locked"><span class="name">${area.icon} ${area.name} (locked)</span>
        <div class="small">Beat ${prevBoss.icon} ${prevBoss.name} to open it.</div></div>`));
      break; // keep later areas a surprise
    }
    box.appendChild(el(`<h3>${area.icon} ${area.name}</h3>`));
    for (const am of area.monsters) {
      const m = monsterById[am.id];
      if (!monsterUnlocked(m)) {
        box.appendChild(el(`<div class="card locked small">❔ Beat ${MONSTERS[m.index - 1].name} to find the next monster.</div>`));
        break;
      }
      const e = elementById[m.element];
      const weak = elementById[weaknessOf(m.element)];
      const strong = elementById[strengthOf(m.element)];
      const card = el(`
        <div class="card monster${m.boss ? " boss" : ""}">
          <div class="row">
            <span class="name">${m.icon} ${m.name}${m.boss ? ` <span class="tag boss-tag">Boss</span>` : ""} <span class="tag" data-k="won" hidden></span></span>
            ${elementTag(m.element)}
          </div>
          <div class="small">Weak to ${weak.icon} ${weak.name} · resists ${strong.icon} ${strong.name}</div>
          <div class="small">❤️ ${fmt(m.stats.hp)} · ⚔️ ${fmt(m.stats.attack)} · 🛡️ ${fmt(m.stats.defense)} · 💨 ${fmt(m.stats.agility)}</div>
          <div class="small">Win: ${m.reward.drops} ${e.icon} ${e.drop} + ${fmt(m.reward.coins)} 🪙</div>
          <div class="buttons"><button data-k="fight" class="primary">Fight</button></div>
        </div>`);
      card.querySelector('[data-k="fight"]').onclick = () => startBattle(m.id);
      refs.monsters[m.id] = card;
      box.appendChild(card);
    }
  }
}

function renderAdventure() {
  for (const e of ELEMENTS) set(refs.drops[e.id], "n", fmt(state.drops[e.id]));
  for (const [id, card] of Object.entries(refs.monsters)) {
    const m = monsterById[id];
    const left = cooldownLeft(m);
    const btn = card.querySelector('[data-k="fight"]');
    const label = left > 0 ? `Resting ${fmtTime(left)}` : state.battle ? "In a fight" : "Fight";
    if (btn.textContent !== label) btn.textContent = label;
    btn.disabled = !canFight(m);
    const wins = state.beaten[m.id] || 0;
    const won = card.querySelector('[data-k="won"]');
    won.hidden = wins === 0;
    set(card, "won", `Beaten ×${wins}`);
  }
}

function hpBar(now, max) {
  const pct = Math.max(0, Math.min(100, (now / max) * 100));
  return `<div class="hpbar"><div class="hpfill${pct < 30 ? " low" : ""}" style="width:${pct}%"></div></div>
    <div class="small num">${fmt(now)} / ${fmt(max)} HP</div>`;
}

function openBattle() {
  document.getElementById("battle").hidden = false;
  renderBattle();
  render();
}

// Redraws the battle window. Only called when something happens, not every frame.
function renderBattle() {
  const b = state.battle;
  const overlay = document.getElementById("battle");
  if (!b) { overlay.hidden = true; return; }
  const m = monsterById[b.monsterId];
  const area = areaById[m.area];
  const box = overlay.querySelector(".battle-box");

  const mana = Array.from({ length: BATTLE.maxMana }, (_, i) =>
    `<span class="pip${i < b.mana ? " full" : ""}"></span>`).join("");
  const skills = Array.from({ length: BATTLE.skillSlots }, (_, i) =>
    `<button class="skill" disabled title="Skills can be bought from the merchant (coming soon)">Empty skill slot ${i + 1}</button>`).join("");

  let footer;
  if (b.result) {
    const titles = { win: "🏆 Victory!", lose: "💫 Knocked out", fled: "🏃 You got away" };
    footer = `<div class="result ${b.result}">${titles[b.result]}</div>
      <div class="small">${m.name} rests for 15 minutes before you can fight it again.</div>
      <div class="buttons"><button class="primary" data-k="close">Back to the game</button></div>`;
  } else {
    footer = `
      <div class="actions">
        <button class="primary" data-a="attack">⚔️ Attack ${elementTag(b.hero.element)}</button>
        <button data-a="guard" title="Take much less damage this turn">🛡️ Guard</button>
        ${skills}
        <button class="danger" data-a="flee">🏃 Run away</button>
      </div>`;
  }

  box.innerHTML = `
    <div class="small">${area.icon} ${area.name} · Turn ${b.turn}</div>
    <h2 id="battle-title">${m.icon} ${m.name}${m.boss ? ` <span class="tag boss-tag">Boss</span>` : ""}</h2>
    <div class="fighters">
      <div class="fighter">
        <div class="row"><span class="name">🧝 You</span>${elementTag(b.hero.element)}</div>
        ${hpBar(b.heroHp, b.hero.hp)}
        <div class="mana" title="Mana: used by skills. Start with ${BATTLE.startMana}, +${BATTLE.manaPerTurn} each turn, max ${BATTLE.maxMana}.">💧 ${mana}</div>
      </div>
      <div class="fighter">
        <div class="row"><span class="name">${m.icon} ${m.name}</span>${elementTag(m.element)}</div>
        ${hpBar(b.monsterHp, m.stats.hp)}
        <div class="small">${b.charging && !b.result ? "⚠️ Winding up a heavy attack!" : "&nbsp;"}</div>
      </div>
    </div>
    <div class="battle-log" data-k="log">${b.log.map(l => `<div>${l}</div>`).join("")}</div>
    ${footer}`;

  box.querySelectorAll("[data-a]").forEach(btn => { btn.onclick = () => battleAction(btn.dataset.a); });
  const close = box.querySelector('[data-k="close"]');
  if (close) close.onclick = closeBattle;
  const logBox = box.querySelector('[data-k="log"]');
  logBox.scrollTop = logBox.scrollHeight;
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
  buildAdventure();

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

  renderAdventure();

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
    if (slot.id === "weapon") set(row, "element", r ? `Element: ${item.element ? elementById[item.element].name : "Neutral"}` : "");
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
  if (state.battle) openBattle(); // pick up a fight that was going on when the page closed

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
    renderBattle();
    buildUI();
  };
}

if (typeof document !== "undefined") start();
