// Peak Idle: mine ore, smith weapons and armor, sell them, grow your mine.
// Everything lives in this one file. Progress is saved in your browser (localStorage).

const SAVE_KEY = "peakidle-save-v1"; // kept the same so old saves still load
const SAVE_VERSION = 6;                // bump when the save format changes (see migrate())
const MAX_OFFLINE_SECONDS = 8 * 60 * 60; // offline mining is capped at 8 hours

// ---------- Game data ----------

// Each ore is also a gear material.
//   statMult: how much stronger gear of this material is than copper gear
//   costMult: how much more ore a piece of gear needs than the copper version
//   gearValue: coins per ore used when the gear is sold
//   infuseCost: essences needed to give one weapon of this material an element while smithing it
const ORES = [
//   minerCost / unlockCost: starting coin prices (they also go up after every reincarnation, see REINCARNATION)
  { id: "copper",  name: "Copper",  icon: "🟠", perSecPerMiner: 1,    minerCost: 20,    unlockCost: 0,      statMult: 1,   costMult: 1,   gearValue: 1.25, infuseCost: 3 },
  { id: "iron",    name: "Iron",    icon: "⚪", perSecPerMiner: 0.5,  minerCost: 200,   unlockCost: 400,    statMult: 2.2, costMult: 1.5, gearValue: 6,    infuseCost: 8 },
  { id: "gold",    name: "Gold",    icon: "🟡", perSecPerMiner: 0.25, minerCost: 1500,  unlockCost: 8000,   statMult: 4.5, costMult: 2,   gearValue: 36,   infuseCost: 20 },
  { id: "mithril", name: "Mithril", icon: "🔷", perSecPerMiner: 0.1,  minerCost: 10000, unlockCost: 150000, statMult: 9,   costMult: 2.5, gearValue: 270,  infuseCost: 50 },
];

// The hero's stats. "power" (skill power) makes your skills hit harder.
// Luck is your critical hit chance in % (a crit does double damage). It comes from Soul attributes.
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
// cost: ore needed. price: coins when sold. Weapons can get an element while smithing (see smith()).
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

// ---------- Prices (balance) ----------
// All coin prices grow exponentially, so a first run gets slow and reincarnating is how you push further.
const MINER_COST_GROWTH = 1.22;                 // each extra miner of an ore costs 22% more
const PICKAXE = { start: 60,  growth: 3.5 };    // pickaxe level 1 -> 2 costs 60, then x3.5 each level
const ANVIL   = { start: 300, growth: 5 };      // anvil level 1 -> 2 costs 300, then x5 each level

// ---------- Reincarnation and Souls ----------
// Reincarnating starts a new run: coins, ore, miners, mines, upgrades, gear, essences and monster
// progress reset. You keep learned skills, Souls and attributes, and you earn new Souls.
const REINCARNATION = {
  priceGrowth: 1.10,     // every reincarnation makes miners, mines and upgrades 10% pricier (stacks).
                         //   Skill prices never go up with reincarnation.
  soulsPerDepth: 2,      // Souls from monsters = soulsPerDepth x depth ^ depthPower, where depth = 5 per boss beaten
  depthPower: 1.4,       //   + 1 per win (up to 4) against monsters of your own tier. 1st boss = 19 Souls, last boss = 132 Souls
  coinsPerSoul: 500,     // Souls from coins = square root of (coins earned this run / coinsPerSoul)
};                       //   e.g. 50K coins = 10 Souls, 5M coins = 100 Souls

// Permanent attributes bought with Souls. Each point adds a flat bonus to the hero's stats.
// The Soul price of the next point = baseCost x growth ^ (points you already have), rounded up.
const ATTRIBUTE_MAX = 99;
const ATTRIBUTES = [
  { id: "hp",      perPoint: 10, baseCost: 1, growth: 1.15, desc: "+10 max HP per point" },
  { id: "attack",  perPoint: 1,  baseCost: 1, growth: 1.15, desc: "+1 attack per point" },
  { id: "defense", perPoint: 1,  baseCost: 1, growth: 1.15, desc: "+1 defense per point" },
  { id: "agility", perPoint: 1,  baseCost: 1, growth: 1.15, desc: "+1 agility per point (dodge more, strike first)" },
  { id: "luck",    perPoint: 1,  baseCost: 2, growth: 1.15, desc: "+1% critical hit chance per point (crits do 2x damage)" },
];
const attributeById = Object.fromEntries(ATTRIBUTES.map(a => [a.id, a]));

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

// ---------- Skills ----------

// The Skills panel sells 15 skills: 3 grades for each element.
// Grade 1/2/3 costs 1/2/3 mana in battle. Skills are bought and levelled up with essences of their element.
//   cost: essences to buy (rises steeply by grade)
const SKILL_GRADES = [
  { grade: 1, name: "Low",  mana: 1, cost: 8 },
  { grade: 2, name: "Mid",  mana: 2, cost: 50 },
  { grade: 3, name: "High", mana: 3, cost: 300 },
];
// Levelling: each level makes the skill 25% stronger (damage and healing).
// The essence cost of the next level grows by x1.7 each time.
const SKILL_LEVEL_BONUS = 0.25;
const SKILL_LEVEL_COST_START = 0.6; // level 1 -> 2 costs 60% of the buy price
const SKILL_LEVEL_COST_GROWTH = 1.7;

// What a skill can do (any mix):
//   power:    damage = (attack + skill power) x power. Skills never miss and can crit.
//   hits:     how many times it strikes (default 1)
//   heal:     heals this share of your max HP (also grows with skill power)
//   guard:    you guard this turn as well
//   stun:     chance (0-1) the monster loses its next turn
//   interrupt: cancels a heavy attack the monster is winding up
//   weaken:   monster deals 35% less damage for this many turns
//   critBonus: extra crit chance for this skill
const SKILLS = [
  // Fire: raw damage
  { id: "firebolt",      element: "fire",      grade: 1, name: "Firebolt",         power: 1.7, desc: "Hurl a bolt of flame." },
  { id: "flame_lash",    element: "fire",      grade: 2, name: "Flame Lash",       power: 2.4, hits: 2, desc: "Two burning whip strikes." },
  { id: "meteor",        element: "fire",      grade: 3, name: "Meteor",           power: 5.5, desc: "Call down a blazing rock. Huge damage." },
  // Ice: control
  { id: "ice_spear",     element: "ice",       grade: 1, name: "Ice Spear",        power: 1.5, desc: "A sharp spear of ice." },
  { id: "frost_armor",   element: "ice",       grade: 2, name: "Frost Armor",      power: 1.4, guard: true, desc: "Strike, then guard behind a shell of ice this turn." },
  { id: "glacial_prison",element: "ice",       grade: 3, name: "Glacial Prison",   power: 3.5, stun: 1, desc: "Freeze the foe solid. It loses its next turn." },
  // Wind: speed and healing
  { id: "gust",          element: "wind",      grade: 1, name: "Gust",             power: 1.3, interrupt: true, desc: "A sharp blast that breaks a heavy attack wind-up." },
  { id: "healing_breeze",element: "wind",      grade: 2, name: "Healing Breeze",   heal: 0.3, desc: "Heal 30% of your max HP (more with skill power)." },
  { id: "cyclone",       element: "wind",      grade: 3, name: "Cyclone",          power: 1.6, hits: 3, desc: "Three spinning slashes, each can crit." },
  // Earth: toughness
  { id: "stone_fist",    element: "earth",     grade: 1, name: "Stone Fist",       power: 1.6, desc: "A heavy punch of rock." },
  { id: "stone_skin",    element: "earth",     grade: 2, name: "Stone Skin",       power: 1.0, weaken: 3, desc: "Strike and harden: the foe deals 35% less damage for 3 turns." },
  { id: "earthquake",    element: "earth",     grade: 3, name: "Earthquake",       power: 4.5, interrupt: true, desc: "Shake the ground. Big damage and breaks a wind-up." },
  // Lightning: crits and stuns
  { id: "spark",         element: "lightning", grade: 1, name: "Spark",            power: 1.4, stun: 0.25, desc: "A quick zap. 25% chance to stun." },
  { id: "chain_lightning",element:"lightning", grade: 2, name: "Chain Lightning",  power: 2.9, critBonus: 0.2, desc: "Crackling bolt with +20% crit chance." },
  { id: "thunder_judgment",element:"lightning",grade: 3, name: "Thunder Judgment", power: 4.2, critBonus: 0.35, stun: 0.5, desc: "+35% crit chance and 50% chance to stun." },
];
const skillById = Object.fromEntries(SKILLS.map(sk => [sk.id, sk]));
function skillGrade(sk) { return SKILL_GRADES[sk.grade - 1]; }
const WEAKEN_MULT = 0.65; // weakened monsters deal 35% less damage

// ---------- Monsters ----------

// Monsters appear at random. Your danger level ("tier") decides how strong they are.
// Each tier has a pool of creatures for the random spawns and one fixed boss.
// Beat the boss of your tier to go up one tier: spawns get stronger and the next boss appears.
// A random monster gets a random element, so its weakness, resistance and essence drop are random too.
const TIERS = [
  { name: "Mossy Tunnels", icon: "🌿",
    creatures: [{ name: "Rat", icon: "🐀" }, { name: "Beetle", icon: "🪲" }, { name: "Bat", icon: "🦇" }, { name: "Slime", icon: "🟢" }],
    boss: { id: "howling_wolf", name: "Howling Wolf", icon: "🐺", element: "wind" } },
  { name: "Deep Mine", icon: "🕳️",
    creatures: [{ name: "Lizard", icon: "🦎" }, { name: "Golem", icon: "🗿" }, { name: "Imp", icon: "👺" }, { name: "Eel", icon: "🐍" }],
    boss: { id: "glacier_troll", name: "Glacier Troll", icon: "🧌", element: "ice" } },
  { name: "Molten Halls", icon: "🌋",
    creatures: [{ name: "Hound", icon: "🐕" }, { name: "Hawk", icon: "🦅" }, { name: "Spider", icon: "🕷️" }, { name: "Harpy", icon: "🪶" }],
    boss: { id: "magma_wyrm", name: "Magma Wyrm", icon: "🐉", element: "fire" } },
  { name: "Sky Peak", icon: "🏔️",
    creatures: [{ name: "Giant", icon: "🥶" }, { name: "Behemoth", icon: "🦏" }, { name: "Djinn", icon: "🧞" }, { name: "Titan", icon: "⛈️" }],
    boss: { id: "peak_dragon", name: "Elder Peak Dragon", icon: "🐲", element: "earth" } },
];
// A random monster's name starts with a word for its element, e.g. "Blazing Rat" or "Frozen Bat".
const ELEMENT_ADJECTIVE = { fire: "Blazing", ice: "Frozen", wind: "Gusting", earth: "Rocky", lightning: "Charged" };

const SPAWN = {
  everyMs: 15 * 1000,     // a new monster appears every 15 seconds, even while the game is closed
  max: 5,                 // at most 5 monsters wait at once; the timer pauses while 5 are waiting
  newRun: 3,              // a new game or reincarnation starts with 3 monsters already waiting
  lowerTierChance: 0.4,   // 40% of spawns are one tier below yours (from tier 2 up), for variety
};

// Monster stats grow exponentially with tier: stat = start * growth ^ step.
// Random monsters of tier T use step (T-1)*5 + 2, the boss of tier T uses step T*5 - 1 (plus BOSS_MULT).
const MONSTER_SCALING = {
  hp:      { start: 30,  growth: 1.17 },
  attack:  { start: 4,   growth: 1.17 },
  defense: { start: 1.5, growth: 1.18 },
  agility: { start: 4,   growth: 1.12 },
  coins:   { start: 10,  growth: 1.4 }, // coins for a win
  drops:   { start: 1,   growth: 1.2 },  // element drops for a win
};
const BOSS_MULT = { hp: 1.6, attack: 1.15, defense: 1.15, agility: 1.1, coins: 3, drops: 3 };

// Battle rules
const BATTLE = {
  startMana: 3,
  manaPerTurn: 1,
  maxMana: 5,
  skillSlots: 3,          // equip skills from the Skills panel into these
  critMultiplier: 2,      // a critical hit does double damage; crit chance = luck %
  heavyEvery: 3,          // monsters wind up a heavy attack every 3rd turn
  heavyMultiplier: 1.8,
  guardMultiplier: 0.4,   // guarding takes only 40% damage
};

// Stats and rewards for a monster of this tier (1-4).
function monsterStats(tier, boss) {
  const step = boss ? tier * 5 - 1 : (tier - 1) * 5 + 2;
  const stat = key => MONSTER_SCALING[key].start * Math.pow(MONSTER_SCALING[key].growth, step) * (boss ? BOSS_MULT[key] : 1);
  return {
    stats: {
      hp: Math.round(stat("hp")),
      attack: Math.round(stat("attack")),
      defense: Math.round(stat("defense")),
      agility: Math.round(stat("agility")),
    },
    reward: { coins: Math.round(stat("coins")), drops: Math.round(stat("drops")) },
  };
}

// The full monster for a waiting spawn ({ uid, tier, creature, element }) or a boss tier.
function spawnMonster(sp) {
  const c = TIERS[sp.tier - 1].creatures[sp.creature];
  return { uid: sp.uid, tier: sp.tier, boss: false, element: sp.element,
    name: `${ELEMENT_ADJECTIVE[sp.element]} ${c.name}`, icon: c.icon, ...monsterStats(sp.tier, false) };
}
function bossMonster(tier) {
  const b = TIERS[tier - 1].boss;
  return { uid: "boss", tier, boss: true, element: b.element, name: b.name, icon: b.icon, ...monsterStats(tier, true) };
}

// Old saves (before random spawns) used a fixed ladder. Only needed to work out the tier of an old save.
const OLD_LADDER = [
  ["cinder_rat", "frost_beetle", "spark_bat", "mud_slime", "howling_wolf"],
  ["cave_gust", "stone_golem", "ember_imp", "volt_eel", "glacier_troll"],
  ["ash_hound", "thunder_hawk", "crystal_spider", "storm_harpy", "magma_wyrm"],
  ["frost_giant", "quake_behemoth", "tempest_djinn", "storm_titan", "peak_dragon"],
];

// ---------- State ----------

function freshState() {
  const s = {
    version: SAVE_VERSION,
    coins: 0,
    pickaxe: 1,           // ore per click
    anvil: 1,             // sell price multiplier level
    totalSmithed: 0,
    ore: {}, miners: {}, unlocked: {},
    items: {},            // smithed gear in your bag: item key -> how many (see itemKey)
    equipped: {},         // slot id -> { id: recipe id, element } or null
    drops: {},            // element id -> how many essences you have
    bossesBeaten: 0,      // bosses beaten this run; your tier (danger level) is this + 1
    tierWins: 0,          // wins against random monsters of your current tier (adds Souls)
    spawns: [],           // random monsters waiting to be fought: { uid, tier, creature, element }
    nextSpawnAt: null,    // time (ms) the next monster appears, null while the screen is full
    nextUid: 1,
    skills: {},           // skill id -> level (0 = not bought yet)
    skillSlots: [null, null, null], // skill ids equipped for battle
    battle: null,         // the fight in progress, saved so a reload can't skip it
    runCoins: 0,          // coins earned since the last reincarnation (gives Souls)
    // Kept when you reincarnate:
    souls: 0,             // Souls to spend on attributes
    attributes: {},       // attribute id -> points bought (0-99)
    reincarnations: 0,    // how many times you've reincarnated (prices go up each time)
    totalSouls: 0,        // all Souls ever earned
    lastSaved: Date.now(),
  };
  for (const a of ATTRIBUTES) s.attributes[a.id] = 0;
  for (const e of ELEMENTS) s.drops[e.id] = 0;
  for (const o of ORES) {
    s.ore[o.id] = 0;
    s.miners[o.id] = 0;
    s.unlocked[o.id] = o.unlockCost === 0;
  }
  for (const r of RECIPES) {
    s.items[r.id] = 0;
    if (r.slot === "weapon") for (const e of ELEMENTS) s.items[itemKey(r.id, e.id)] = 0;
  }
  for (const sk of SKILLS) s.skills[sk.id] = 0;
  for (const slot of SLOTS) s.equipped[slot.id] = null;
  for (let i = 0; i < SPAWN.newRun; i++) addSpawn(s);
  s.nextSpawnAt = Date.now() + SPAWN.everyMs;
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
  if (saved.version < 4) {
    // v3 -> v4: merchant skills and elemental weapons. New fields start empty.
    saved.skillSlots = [null, null, null];
    saved.version = 4;
  }
  if (saved.version < 5) {
    // v4 -> v5: reincarnation. Count the coins you have now as earned this run, so your first Souls aren't zero.
    saved.runCoins = saved.coins || 0;
    saved.version = 5;
  }
  if (saved.version < 6) {
    // v5 -> v6: random monster spawns and tiers replace the fixed ladder.
    // Your tier = the area you had reached; wins in that area count toward Souls like before.
    const beaten = saved.beaten || {};
    let bosses = 0;
    while (bosses < OLD_LADDER.length && beaten[OLD_LADDER[bosses][4]]) bosses++;
    saved.bossesBeaten = bosses;
    saved.tierWins = bosses < OLD_LADDER.length ? OLD_LADDER[bosses].slice(0, 4).filter(id => beaten[id]).length : 0;
    delete saved.beaten;
    delete saved.cooldowns;
    // A fight from the old ladder can't continue (losing or leaving it never cost anything anyway).
    if (saved.battle && !saved.battle.monster) saved.battle = null;
    saved.version = 6;
  }
  // Later versions add their steps here.
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
    for (const key of ["coins", "pickaxe", "anvil", "totalSmithed", "lastSaved", "runCoins", "souls", "reincarnations", "totalSouls", "bossesBeaten", "tierWins", "nextUid"]) {
      if (typeof saved[key] === "number") s[key] = saved[key];
    }
    for (const key of ["ore", "miners", "unlocked", "items", "drops", "skills", "attributes"]) {
      for (const [k, v] of Object.entries(saved[key] || {})) {
        if (k in s[key]) s[key][k] = v;
      }
    }
    for (const slot of SLOTS) {
      const item = saved.equipped && saved.equipped[slot.id];
      const r = item && recipeById[item.id];
      const element = slot.id === "weapon" && elementById[item && item.element] ? item.element : null;
      if (r && r.slot === slot.id) s.equipped[slot.id] = { id: r.id, element };
    }
    (saved.skillSlots || []).slice(0, BATTLE.skillSlots).forEach((id, i) => {
      if (skillById[id] && s.skills[id] > 0 && !s.skillSlots.includes(id)) s.skillSlots[i] = id;
    });
    s.bossesBeaten = Math.min(TIERS.length, Math.max(0, s.bossesBeaten));
    if (Array.isArray(saved.spawns)) {
      s.spawns = saved.spawns.filter(sp => sp && TIERS[sp.tier - 1] && TIERS[sp.tier - 1].creatures[sp.creature] && elementById[sp.element])
        .slice(0, SPAWN.max);
      s.nextSpawnAt = typeof saved.nextSpawnAt === "number" ? saved.nextSpawnAt : null;
    }
    if (saved.battle && saved.battle.monster) s.battle = saved.battle;
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

// Every reincarnation multiplies coin and skill prices by this (1 on your first run).
function runPriceMult() { return Math.pow(REINCARNATION.priceGrowth, state.reincarnations); }

function minerCost(ore) {
  return Math.ceil(ore.minerCost * Math.pow(MINER_COST_GROWTH, state.miners[ore.id]) * runPriceMult());
}
function unlockCost(ore) { return Math.ceil(ore.unlockCost * runPriceMult()); }
function orePerSecond(ore) {
  return state.miners[ore.id] * ore.perSecPerMiner;
}
function clickAmount(ore) {
  // Harder ores give less per click, but never less than a fraction.
  return state.pickaxe * ore.perSecPerMiner;
}
function pickaxeCost() { return Math.ceil(PICKAXE.start * Math.pow(PICKAXE.growth, state.pickaxe - 1) * runPriceMult()); }
function anvilCost()   { return Math.ceil(ANVIL.start * Math.pow(ANVIL.growth, state.anvil - 1) * runPriceMult()); }
function priceMultiplier() { return 1 + (state.anvil - 1) * 0.25; }
function sellPrice(recipe) { return Math.floor(recipe.price * priceMultiplier()); }

// Flat stat bonus from Soul attributes, e.g. { hp: 50, attack: 3, ... }.
function attributeStats() {
  const total = {};
  for (const a of ATTRIBUTES) total[a.id] = (state.attributes[a.id] || 0) * a.perPoint;
  return total;
}

// Stat bonus from equipped gear only.
function gearStats() {
  const total = {};
  for (const st of STATS) total[st.id] = 0;
  for (const slot of SLOTS) {
    const item = state.equipped[slot.id];
    if (!item) continue;
    for (const [k, v] of Object.entries(recipeById[item.id].stats)) total[k] += v;
  }
  return total;
}

// The hero's total stats: base stats + equipped gear + Soul attributes. Battles read their numbers from here.
function heroStats() {
  const total = { ...HERO_BASE_STATS };
  for (const [k, v] of Object.entries(attributeStats())) total[k] += v;
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

// Weapons with an element are kept apart in the bag: "iron_sword" is neutral, "iron_sword:fire" is a fire one.
function itemKey(recipeId, element) { return element ? `${recipeId}:${element}` : recipeId; }
// All bag keys for one recipe: the neutral one, plus one per element for weapons.
function itemKeysOf(r) {
  return r.slot === "weapon" ? [r.id, ...ELEMENTS.map(e => itemKey(r.id, e.id))] : [r.id];
}
function bagCount(r) { return itemKeysOf(r).reduce((n, k) => n + state.items[k], 0); }

// ---------- Skill rules ----------

function skillLevel(id) { return state.skills[id] || 0; }
function skillBuyCost(sk) { return skillGrade(sk).cost; } // same price in every run
function skillLevelCost(sk) {
  return Math.ceil(skillBuyCost(sk) * SKILL_LEVEL_COST_START * Math.pow(SKILL_LEVEL_COST_GROWTH, skillLevel(sk.id) - 1));
}
// Essences needed for the next step: buying it, or its next level.
function skillNextCost(sk) { return skillLevel(sk.id) > 0 ? skillLevelCost(sk) : skillBuyCost(sk); }
function skillLevelMult(level) { return 1 + SKILL_LEVEL_BONUS * (level - 1); }

function addOre(dt) {
  for (const o of ORES) state.ore[o.id] += orePerSecond(o) * dt;
}

// ---------- Monster rules ----------

// Your danger level. Goes up by one each time you beat your tier's boss.
function currentTier(s = state) { return Math.min(TIERS.length, s.bossesBeaten + 1); }
function peakCleared() { return state.bossesBeaten >= TIERS.length; }

// Put one new random monster on the screen: your tier, or sometimes one below, with a random element.
function addSpawn(s) {
  const top = currentTier(s);
  const tier = top > 1 && Math.random() < SPAWN.lowerTierChance ? top - 1 : top;
  const creature = Math.floor(Math.random() * TIERS[tier - 1].creatures.length);
  const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)].id;
  s.spawns.push({ uid: s.nextUid++, tier, creature, element });
}

// Add every monster that should have appeared by now (also covers time the game was closed).
// The timer stops while the screen is full and starts again when a spot opens up.
function updateSpawns(now = Date.now()) {
  let added = 0;
  while (state.spawns.length < SPAWN.max) {
    if (state.nextSpawnAt === null) state.nextSpawnAt = now + SPAWN.everyMs;
    if (now < state.nextSpawnAt) break;
    addSpawn(state);
    added++;
    state.nextSpawnAt += SPAWN.everyMs;
  }
  if (state.spawns.length >= SPAWN.max) state.nextSpawnAt = null;
  return added;
}

function canFight() { return !state.battle; }

// The element your basic attack uses: the equipped weapon's (null = neutral).
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

// All coin income goes through here, so we know how much you earned this run (for Souls).
function earnCoins(n) {
  state.coins += n;
  state.runCoins += n;
}

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
  const cost = unlockCost(ore);
  if (state.unlocked[oreId] || state.coins < cost) return;
  state.coins -= cost;
  state.unlocked[oreId] = true;
  log(`You opened a ${ore.name} mine!`);
  buildUI();
}

// How many of a recipe you can smith right now. Elemental weapons also need essences.
function smithLimit(r, element) {
  let n = Math.floor(state.ore[r.ore] / r.cost);
  if (element) n = Math.min(n, Math.floor(state.drops[element] / oreById[r.ore].infuseCost));
  return n;
}

// element: only for weapons. The weapon is infused with it while it's made, for essences.
function smith(recipeId, count, element = null) {
  const r = recipeById[recipeId];
  if (r.slot !== "weapon") element = null;
  const canMake = smithLimit(r, element);
  const n = count === "max" ? canMake : Math.min(count, canMake);
  if (n <= 0) return;
  state.ore[r.ore] -= n * r.cost;
  if (element) state.drops[element] -= n * oreById[r.ore].infuseCost;
  state.items[itemKey(r.id, element)] += n;
  state.totalSmithed += n;
  render();
}

// Selling only sells gear in your bag. Equipped gear is safe. Sold gear is gone for good.
// Elemental weapons sell for the same as plain ones (the essences are not refunded).
function sell(recipeId) {
  const r = recipeById[recipeId];
  const n = bagCount(r);
  if (n <= 0) return 0;
  for (const k of itemKeysOf(r)) state.items[k] = 0;
  const coins = n * sellPrice(r);
  earnCoins(coins);
  render();
  return coins;
}

function sellAllOf(oreId) {
  let coins = 0;
  for (const r of RECIPES) if (r.ore === oreId) coins += sell(r.id);
  if (coins > 0) log(`Sold all your ${oreById[oreId].name.toLowerCase()} gear for ${fmt(coins)} coins.`);
}

// Wear one item from your bag. Whatever was in that slot goes back to your bag.
function equip(recipeId, element = null) {
  const r = recipeById[recipeId];
  if (r.slot !== "weapon") element = null;
  const key = itemKey(r.id, element);
  if (state.items[key] <= 0) return;
  unequip(r.slot);
  state.items[key] -= 1;
  state.equipped[r.slot] = { id: r.id, element };
  render();
}

function unequip(slotId) {
  const item = state.equipped[slotId];
  if (!item) return;
  state.items[itemKey(item.id, item.element)] += 1;
  state.equipped[slotId] = null;
  render();
}

// ---------- Skills actions ----------

// Buy a skill, or level it up if you already own it. Paid with essences of its element.
function buySkill(skillId) {
  const sk = skillById[skillId];
  const cost = skillNextCost(sk);
  if (state.drops[sk.element] < cost) return;
  state.drops[sk.element] -= cost;
  state.skills[sk.id] = skillLevel(sk.id) + 1;
  if (state.skills[sk.id] === 1) {
    log(`You learned ${sk.name}!`);
    const free = state.skillSlots.indexOf(null);
    if (free >= 0) state.skillSlots[free] = sk.id; // put it straight into an empty slot
  } else {
    log(`${sk.name} is now level ${state.skills[sk.id]}.`);
  }
  save();
  render();
}

// Put an owned skill into the first empty slot. New fights use the new slots.
function equipSkill(skillId) {
  if (skillLevel(skillId) <= 0 || state.skillSlots.includes(skillId)) return;
  const free = state.skillSlots.indexOf(null);
  if (free < 0) return;
  state.skillSlots[free] = skillId;
  render();
}

function unequipSkill(index) {
  state.skillSlots[index] = null;
  render();
}

// ---------- Battle ----------
// A battle is plain data in state.battle, so it's saved and survives a page reload.
// Your stats are locked in when the fight starts.

// uid: a waiting monster's uid, or "boss" for your tier's boss.
function startBattle(uid) {
  if (!canFight()) return;
  let m;
  if (uid === "boss") {
    if (peakCleared()) return;
    m = bossMonster(currentTier());
  } else {
    const sp = state.spawns.find(x => x.uid === uid);
    if (!sp) return;
    m = spawnMonster(sp);
  }
  const hero = heroStats();
  state.battle = {
    monster: m,        // a copy of the monster, so the fight survives a reload
    hero: { ...hero, element: weaponElement() },
    // Skills you brought, with their level, locked in like your stats.
    skills: state.skillSlots.map(id => id ? { id, level: skillLevel(id) } : null),
    stunned: false,    // the monster loses its next turn
    weakTurns: 0,      // turns left that the monster deals less damage
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
  const m = b.monster;

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
  } else if (/^skill[0-9]$/.test(action)) {
    const slot = (b.skills || [])[Number(action.slice(5))];
    const sk = slot && skillById[slot.id];
    if (!sk || b.mana < skillGrade(sk).mana) return;
    b.mana -= skillGrade(sk).mana;
    castSkill(sk, slot.level, m);
  } else {
    return; // unknown action
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

// Use a skill. Mana is already paid. Skills never miss.
function castSkill(sk, level, m) {
  const b = state.battle;
  const e = elementById[sk.element];
  const lvl = skillLevelMult(level);
  battleLog(`You cast ${e.icon} ${sk.name}!`);
  if (sk.guard) b.guarding = true;
  if (sk.power) {
    // Skill power adds to your attack for skills, so a staff makes skills much stronger.
    const attack = (b.hero.attack + b.hero.power) * sk.power * lvl;
    for (let i = 0; i < (sk.hits || 1) && b.monsterHp > 0; i++) {
      const hit = rollHit({
        attack, defense: m.stats.defense,
        attackEl: sk.element, targetEl: m.element,
        critChance: b.hero.luck / 100 + (sk.critBonus || 0),
        dodge: 0,
      });
      b.monsterHp = Math.max(0, b.monsterHp - hit.damage);
      let msg = `${sk.name} hits ${m.name} for ${hit.damage}.`;
      if (hit.crit) msg += " Critical hit!";
      if (hit.mult > 1) msg += " It's weak to that!";
      if (hit.mult < 1) msg += " It resists that.";
      battleLog(msg);
    }
  }
  if (sk.heal) {
    const amount = Math.round(b.hero.hp * sk.heal * lvl * (1 + b.hero.power / 100));
    const before = b.heroHp;
    b.heroHp = Math.min(b.hero.hp, b.heroHp + amount);
    battleLog(`You heal ${b.heroHp - before} HP.`);
  }
  if (b.monsterHp <= 0) return;
  if (sk.guard) battleLog("Ice forms around you. You are guarding this turn.");
  if (sk.interrupt && b.charging) {
    b.charging = false;
    battleLog(`${m.name}'s heavy attack is broken!`);
  }
  if (sk.weaken) {
    b.weakTurns = sk.weaken;
    battleLog(`${m.name} is weakened for ${sk.weaken} turns.`);
  }
  if (sk.stun && Math.random() < sk.stun) {
    b.stunned = true;
    battleLog(`${m.name} is stunned!`);
  }
}

function monsterTurn() {
  const b = state.battle;
  const m = b.monster;
  if (b.stunned) {
    b.stunned = false;
    battleLog(`${m.name} is stunned and can't move.`);
    return;
  }
  const weak = b.weakTurns > 0;
  if (weak) b.weakTurns -= 1;
  const heavy = b.charging;
  b.charging = false;
  const hit = rollHit({
    attack: m.stats.attack, defense: b.hero.defense,
    attackEl: m.element, targetEl: null, // armor has no element (yet)
    critChance: 0,
    dodge: dodgeChance(b.hero.agility, m.stats.agility),
    extra: (heavy ? BATTLE.heavyMultiplier : 1) * (b.guarding ? BATTLE.guardMultiplier : 1) * (weak ? WEAKEN_MULT : 1),
  });
  const what = heavy ? "unleashes a heavy attack" : "attacks";
  if (hit.dodged) {
    battleLog(`${m.name} ${what}, but you dodge!`);
  } else {
    b.heroHp = Math.max(0, b.heroHp - hit.damage);
    const notes = [b.guarding && "guarded", weak && "weakened"].filter(Boolean).join(", ");
    battleLog(`${m.name} ${what} for ${hit.damage}${notes ? ` (${notes})` : ""}.`);
  }
  if (!heavy && b.heroHp > 0 && b.turn % BATTLE.heavyEvery === BATTLE.heavyEvery - 1) {
    b.charging = true;
    battleLog(`${m.name} is winding up a heavy attack! Guard to soften it.`);
  }
}

function endBattle(result) {
  const b = state.battle;
  const m = b.monster;
  b.result = result;
  if (result === "win") {
    state.drops[m.element] += m.reward.drops;
    earnCoins(m.reward.coins);
    const e = elementById[m.element];
    battleLog(`You win! You get ${m.reward.drops} ${e.icon} ${e.drop} and ${fmt(m.reward.coins)} 🪙.`);
    if (m.boss) {
      // The milestone: move up a tier. Monsters already waiting stay as they are.
      if (m.tier === currentTier() && !peakCleared()) {
        state.bossesBeaten += 1;
        state.tierWins = 0;
        if (peakCleared()) battleLog("You conquered the Sky Peak! Reincarnate in the Souls panel for a big Souls reward.");
        else {
          const t = TIERS[currentTier() - 1];
          battleLog(`Danger level ${currentTier()}: ${t.icon} ${t.name}! Stronger monsters will appear, and a new boss awaits.`);
        }
      }
    } else {
      const before = state.spawns.length;
      state.spawns = state.spawns.filter(x => x.uid !== m.uid);
      if (m.tier === currentTier()) state.tierWins += 1;
      if (before >= SPAWN.max && state.spawns.length < SPAWN.max) state.nextSpawnAt = Date.now() + SPAWN.everyMs;
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

// ---------- Reincarnation ----------

// How far you got this run: 5 per boss beaten, plus 1 per win (up to 4) against monsters of your
// own tier. 0 = no wins yet, 20 = beat the last boss.
function deepestBeaten() {
  if (peakCleared()) return TIERS.length * 5;
  return state.bossesBeaten * 5 + Math.min(4, state.tierWins);
}

// Souls you'd get if you reincarnated right now, and where they come from.
function soulsPreview() {
  const depth = deepestBeaten();
  const fromMonsters = Math.floor(REINCARNATION.soulsPerDepth * Math.pow(depth, REINCARNATION.depthPower));
  const fromCoins = Math.floor(Math.sqrt(state.runCoins / REINCARNATION.coinsPerSoul));
  return { depth, fromMonsters, fromCoins, total: fromMonsters + fromCoins };
}

function attributeLevel(id) { return state.attributes[id] || 0; }
function attributeCost(a) { return Math.ceil(a.baseCost * Math.pow(a.growth, attributeLevel(a.id))); }

// Spend Souls on one point of an attribute. Points are permanent.
function buyAttribute(id) {
  const a = attributeById[id];
  const cost = attributeCost(a);
  if (attributeLevel(id) >= ATTRIBUTE_MAX || state.souls < cost) return;
  state.souls -= cost;
  state.attributes[id] = attributeLevel(id) + 1;
  save();
  render();
}

// Start a new run. Keeps skills, skill slots, Souls, attributes and lifetime counters.
function reincarnate() {
  if (state.battle) return; // finish the fight first
  const gained = soulsPreview().total;
  const keep = {
    skills: state.skills,
    skillSlots: state.skillSlots,
    attributes: state.attributes,
    souls: state.souls + gained,
    totalSouls: state.totalSouls + gained,
    reincarnations: state.reincarnations + 1,
    totalSmithed: state.totalSmithed,
  };
  state = Object.assign(freshState(), keep);
  forgeOre = "copper";
  forgeElement = null;
  save();
  renderBattle();
  buildUI();
  log(`You are reborn! +${fmt(gained)} 👻 Souls. Spend them on attributes.`);
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
// Which element new weapons get when you smith them (null = neutral, free).
let forgeElement = null;

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
      if (group === "Weapons") box.appendChild(buildInfusePicker(ore));
    }
    const isWeapon = r.slot === "weapon";
    const card = el(`
      <div class="card">
        <div class="row">
          <span class="name">${r.icon} ${r.name} <span class="tag" data-k="worn" hidden>Equipped</span></span>
          <span class="small">In bag: <span class="num" data-k="owned"></span></span>
        </div>
        <div class="stats-line">${statsText(r.stats)} <span class="small">· ${r.note}</span></div>
        <div class="small">Costs ${r.cost} ${ore.name.toLowerCase()} ore${isWeapon && forgeElement ? ` + ${ore.infuseCost} ${elementById[forgeElement].icon} ${elementById[forgeElement].drop}` : ""} · sells for <span data-k="price"></span> 🪙</div>
        ${isWeapon ? `<div class="small" data-k="bagEls"></div>` : ""}
        <div class="buttons">
          <button data-k="make1">Smith 1</button>
          <button data-k="makeMax">Smith max</button>
          <button data-k="equip">Equip${isWeapon && forgeElement ? ` ${elementById[forgeElement].icon}` : ""}</button>
          <button data-k="sell" class="primary">Sell all</button>
        </div>
      </div>`);
    card.querySelector('[data-k="make1"]').onclick = () => smith(r.id, 1, forgeElement);
    card.querySelector('[data-k="makeMax"]').onclick = () => smith(r.id, "max", forgeElement);
    card.querySelector('[data-k="equip"]').onclick = () => equip(r.id, forgeElement);
    card.querySelector('[data-k="sell"]').onclick = () => sell(r.id);
    refs.recipes[r.id] = card;
    box.appendChild(card);
  }
}

// Buttons above the weapons: pick an element to infuse new weapons with.
function buildInfusePicker(ore) {
  const box = el(`<div class="infuse">
      <div class="small">Infuse new weapons with an element (costs ${ore.infuseCost} essences each). Your basic attack uses your weapon's element.</div>
      <div class="tabs" data-k="els"></div>
    </div>`);
  const tabs = box.querySelector('[data-k="els"]');
  for (const e of [null, ...ELEMENTS]) {
    const id = e ? e.id : null;
    const label = e ? `${e.icon} ${e.name}` : "Neutral";
    const b = el(`<button class="tab${forgeElement === id ? " active" : ""}">${label}</button>`);
    b.onclick = () => { forgeElement = id; buildForge(); render(); };
    tabs.appendChild(b);
  }
  return box;
}

// "Neutral 1 · 🔥 2" for the weapons of one recipe in your bag.
function bagElementsText(r) {
  const parts = [];
  if (state.items[r.id] > 0) parts.push(`Neutral ${fmt(state.items[r.id])}`);
  for (const e of ELEMENTS) {
    const n = state.items[itemKey(r.id, e.id)];
    if (n > 0) parts.push(`${e.icon} ${fmt(n)}`);
  }
  return parts.length ? `Bag: ${parts.join(" · ")}` : "";
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

// "15 seconds" or "5 minutes", from SPAWN.everyMs.
function spawnEveryText() {
  const s = SPAWN.everyMs / 1000;
  return s < 60 ? `${s} seconds` : `${s / 60} minutes`;
}

function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// One monster card for the Adventure panel.
function monsterCard(m) {
  const e = elementById[m.element];
  const weak = elementById[weaknessOf(m.element)];
  const strong = elementById[strengthOf(m.element)];
  const lower = !m.boss && m.tier < currentTier();
  const card = el(`
    <div class="card monster${m.boss ? " boss" : ""}">
      <div class="row">
        <span class="name">${m.icon} ${m.name}${m.boss ? ` <span class="tag boss-tag">Boss</span>` : ""}
          <span class="tag${lower ? " tier-low" : ""}" title="Danger level of this monster">Lv ${m.tier}</span></span>
        ${elementTag(m.element)}
      </div>
      <div class="small">Weak to ${weak.icon} ${weak.name} · resists ${strong.icon} ${strong.name}</div>
      <div class="small">❤️ ${fmt(m.stats.hp)} · ⚔️ ${fmt(m.stats.attack)} · 🛡️ ${fmt(m.stats.defense)} · 💨 ${fmt(m.stats.agility)}</div>
      <div class="small">Win: ${m.reward.drops} ${e.icon} ${e.drop} + ${fmt(m.reward.coins)} 🪙</div>
      <div class="buttons"><button data-k="fight" class="primary">Fight</button></div>
    </div>`);
  card.querySelector('[data-k="fight"]').onclick = () => startBattle(m.uid);
  return card;
}

// What the Adventure panel was last built for, so it only rebuilds when monsters change.
function adventureKey() {
  return `${state.bossesBeaten}|${state.spawns.map(sp => sp.uid).join(",")}`;
}

function buildAdventure() {
  refs.monsters = [];
  refs.drops = {};
  refs.adventureKey = adventureKey();

  const dropsBox = document.getElementById("drops");
  dropsBox.innerHTML = "";
  for (const e of ELEMENTS) {
    const chip = el(`<div class="drop el-${e.id}" title="${e.drop}: dropped by ${e.name} monsters">${e.icon} <span class="num" data-k="n"></span> <span class="small">${e.drop}</span></div>`);
    refs.drops[e.id] = chip;
    dropsBox.appendChild(chip);
  }

  const box = document.getElementById("areas");
  box.innerHTML = "";
  const tier = TIERS[currentTier() - 1];
  box.appendChild(el(`<div class="card danger-level">
    <div class="row"><span class="name">⚠️ Danger level ${currentTier()} of ${TIERS.length}</span><span>${tier.icon} ${tier.name}</span></div>
    <div class="small">${peakCleared() ? "You conquered every boss. Reincarnate for Souls and climb again!" : "Beat the boss below to raise the danger level."}</div>
  </div>`));

  refs.spawnTimer = el(`<h3 class="spawn-head"><span>Monsters <span class="num" data-k="count"></span></span> <span class="num" data-k="timer"></span></h3>`);
  box.appendChild(refs.spawnTimer);
  if (state.spawns.length === 0) {
    box.appendChild(el(`<div class="card locked small">No monsters around right now. A new one appears every ${spawnEveryText()}.</div>`));
  }
  for (const sp of state.spawns) {
    const card = monsterCard(spawnMonster(sp));
    refs.monsters.push(card);
    box.appendChild(card);
  }

  box.appendChild(el(`<h3>Boss</h3>`));
  if (peakCleared()) {
    const last = TIERS[TIERS.length - 1].boss;
    box.appendChild(el(`<div class="card boss small">🏆 ${last.icon} ${last.name} is defeated. The Sky Peak is yours!</div>`));
  } else {
    const card = monsterCard(bossMonster(currentTier()));
    refs.monsters.push(card);
    box.appendChild(card);
  }
}

function renderAdventure() {
  if (refs.adventureKey !== adventureKey()) buildAdventure();
  for (const e of ELEMENTS) set(refs.drops[e.id], "n", fmt(state.drops[e.id]));
  set(refs.spawnTimer, "count", `${state.spawns.length}/${SPAWN.max}`);
  set(refs.spawnTimer, "timer", state.nextSpawnAt === null
    ? "Full: timer paused"
    : `Next in ${fmtTime(Math.max(0, state.nextSpawnAt - Date.now()))}`);
  for (const card of refs.monsters) {
    const btn = card.querySelector('[data-k="fight"]');
    const label = state.battle ? "In a fight" : "Fight";
    if (btn.textContent !== label) btn.textContent = label;
    btn.disabled = !canFight();
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
  const m = b.monster;
  const tier = TIERS[m.tier - 1];
  const box = overlay.querySelector(".battle-box");

  const mana = Array.from({ length: BATTLE.maxMana }, (_, i) =>
    `<span class="pip${i < b.mana ? " full" : ""}"></span>`).join("");
  const skills = Array.from({ length: BATTLE.skillSlots }, (_, i) => {
    const slot = (b.skills || [])[i];
    const sk = slot && skillById[slot.id];
    if (!sk) return `<button class="skill" disabled title="Buy skills in the Skills panel and equip them before a fight">Empty skill slot ${i + 1}</button>`;
    const mana = skillGrade(sk).mana;
    return `<button class="skill ready el-${sk.element}" data-a="skill${i}" ${b.mana < mana ? "disabled" : ""}
      title="${sk.desc}">${elementById[sk.element].icon} ${sk.name} <span class="small">Lv ${slot.level} · 💧${mana}</span></button>`;
  }).join("");

  let footer;
  if (b.result) {
    const titles = { win: "🏆 Victory!", lose: "💫 Knocked out", fled: "🏃 You got away" };
    footer = `<div class="result ${b.result}">${titles[b.result]}</div>
      <div class="small">${b.result === "win"
        ? (m.boss ? "" : `A new monster appears every ${spawnEveryText()}.`)
        : `${m.name} is still waiting for you in Adventure. Try again any time.`}</div>
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
    <div class="small">${tier.icon} ${tier.name} · Danger level ${m.tier} · Turn ${b.turn}</div>
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

// ---------- Skills panel ----------

function buildMerchant() {
  refs.skillSlots = [];
  refs.skills = {};
  const slotsBox = document.getElementById("skill-slots");
  slotsBox.innerHTML = "";
  for (let i = 0; i < BATTLE.skillSlots; i++) {
    const row = el(`
      <div class="slot">
        <div>
          <div class="small">Skill slot ${i + 1}</div>
          <div class="name" data-k="skill"></div>
          <div class="small" data-k="info"></div>
        </div>
        <button data-k="remove">Remove</button>
      </div>`);
    row.querySelector('[data-k="remove"]').onclick = () => unequipSkill(i);
    refs.skillSlots.push(row);
    slotsBox.appendChild(row);
  }

  const box = document.getElementById("skills");
  box.innerHTML = "";
  for (const e of ELEMENTS) {
    box.appendChild(el(`<h3>${e.icon} ${e.name} skills</h3>`));
    for (const sk of SKILLS) {
      if (sk.element !== e.id) continue;
      const g = skillGrade(sk);
      const card = el(`
        <div class="card skill-card">
          <div class="row">
            <span class="name">${e.icon} ${sk.name} <span class="tag" data-k="lvl" hidden></span></span>
            <span class="small">${g.name} · 💧 ${g.mana} mana</span>
          </div>
          <div class="small">${sk.desc}</div>
          <div class="stats-line" data-k="effect"></div>
          <div class="buttons">
            <button class="primary" data-k="buy"></button>
            <button data-k="equip">Equip</button>
            <span class="have" data-k="have"></span>
          </div>
        </div>`);
      card.querySelector('[data-k="buy"]').onclick = () => buySkill(sk.id);
      card.querySelector('[data-k="equip"]').onclick = () => equipSkill(sk.id);
      refs.skills[sk.id] = card;
      box.appendChild(card);
    }
  }
}

// What a skill does at a level, in numbers, using your current stats.
function skillEffectText(sk, level) {
  const hero = heroStats();
  const lvl = skillLevelMult(Math.max(1, level));
  const parts = [];
  if (sk.power) {
    const per = Math.round((hero.attack + hero.power) * sk.power * lvl);
    parts.push(`${sk.hits ? `${sk.hits} × ` : ""}${fmt(per)} strength`);
  }
  if (sk.heal) parts.push(`heals ${fmt(Math.round(hero.hp * sk.heal * lvl * (1 + hero.power / 100)))} HP`);
  return parts.join(", ");
}

function renderMerchant() {
  state.skillSlots.forEach((id, i) => {
    const row = refs.skillSlots[i];
    const sk = id && skillById[id];
    set(row, "skill", sk ? `${elementById[sk.element].icon} ${sk.name} (Lv ${skillLevel(id)})` : "Empty");
    set(row, "info", sk ? `💧 ${skillGrade(sk).mana} mana · ${skillEffectText(sk, skillLevel(id))}` : "Buy a skill below and press Equip.");
    row.classList.toggle("empty", !sk);
    row.querySelector('[data-k="remove"]').hidden = !sk;
  });
  const slotsFull = !state.skillSlots.includes(null);
  for (const sk of SKILLS) {
    const card = refs.skills[sk.id];
    const level = skillLevel(sk.id);
    const cost = skillNextCost(sk);
    const e = elementById[sk.element];
    const lvlTag = card.querySelector('[data-k="lvl"]');
    lvlTag.hidden = level === 0;
    set(card, "lvl", `Lv ${level}`);
    set(card, "effect", level > 0
      ? `Now: ${skillEffectText(sk, level)}`
      : skillEffectText(sk, 1));
    const buy = card.querySelector('[data-k="buy"]');
    const label = `${level > 0 ? `Level up to ${level + 1}` : "Buy"} for ${fmt(cost)} ${e.icon}`;
    if (buy.textContent !== label) buy.textContent = label;
    const have = state.drops[sk.element] || 0;
    buy.disabled = have < cost;
    // How many essences of this element you have, green if enough, red if not.
    set(card, "have", `you have ${fmt(have)} ${e.icon}`);
    const haveEl = card.querySelector('[data-k="have"]');
    haveEl.classList.toggle("enough", have >= cost);
    haveEl.classList.toggle("short", have < cost);
    const equip = card.querySelector('[data-k="equip"]');
    const equipped = state.skillSlots.includes(sk.id);
    const eqLabel = equipped ? "Equipped" : "Equip";
    if (equip.textContent !== eqLabel) equip.textContent = eqLabel;
    equip.hidden = level === 0;
    equip.disabled = equipped || slotsFull;
    equip.title = !equipped && slotsFull ? "All 3 slots are full. Remove a skill first." : "";
    card.classList.toggle("owned", level > 0);
  }
}

// ---------- Souls panel ----------

let reincarnateOpen = false; // is the "are you sure?" box showing

function buildSouls() {
  refs.attrs = {};
  const box = document.getElementById("attributes");
  box.innerHTML = "";
  for (const a of ATTRIBUTES) {
    const st = STATS.find(x => x.id === a.id);
    const card = el(`
      <div class="card attr">
        <div class="row">
          <span class="name">${st.icon} ${st.name} <span class="small num">Lv <span data-k="lvl"></span>/${ATTRIBUTE_MAX}</span></span>
          <span class="stats-line" data-k="bonus"></span>
        </div>
        <div class="small">${a.desc}</div>
        <div class="buttons"><button class="primary" data-k="buy"></button></div>
      </div>`);
    card.querySelector('[data-k="buy"]').onclick = () => buyAttribute(a.id);
    refs.attrs[a.id] = card;
    box.appendChild(card);
  }

  const r = document.getElementById("reincarnate");
  r.innerHTML = "";
  refs.rebirth = el(`
    <div class="card rebirth">
      <div class="name">🔁 Reincarnate</div>
      <div class="small">Start over to earn Souls. The deeper you got in Adventure and the more coins you earned this run, the more Souls you get.</div>
      <div class="souls-preview">
        <div class="row"><span>Progress this run</span><span class="num" data-k="depth"></span></div>
        <div class="row"><span>Souls from monsters</span><span class="num" data-k="fromMonsters"></span></div>
        <div class="row"><span>Coins earned this run</span><span class="num" data-k="runCoins"></span></div>
        <div class="row"><span>Souls from coins</span><span class="num" data-k="fromCoins"></span></div>
        <div class="row total"><span>You would gain</span><span class="num" data-k="gain"></span></div>
      </div>
      <div class="small" data-k="priceNote"></div>
      <div class="buttons"><button class="danger" data-k="open">Reincarnate…</button></div>
      <div class="confirm" data-k="confirm" hidden>
        <div class="name">Are you sure?</div>
        <div class="small"><b>You lose:</b> coins, ore, miners, opened mines, pickaxe and anvil upgrades, all gear (in your bag and equipped), unspent essences, danger level and waiting monsters.</div>
        <div class="small"><b>You keep:</b> learned skills and their levels, skill slots, Souls and attributes.</div>
        <div class="small"><b>Next run:</b> <span data-k="nextPrices"></span></div>
        <div class="buttons">
          <button class="primary" data-k="yes"></button>
          <button data-k="no">Cancel</button>
        </div>
      </div>
    </div>`);
  refs.rebirth.querySelector('[data-k="open"]').onclick = () => { reincarnateOpen = true; render(); };
  refs.rebirth.querySelector('[data-k="no"]').onclick = () => { reincarnateOpen = false; render(); };
  refs.rebirth.querySelector('[data-k="yes"]').onclick = () => { reincarnateOpen = false; reincarnate(); };
  r.appendChild(refs.rebirth);
}

function renderSouls() {
  set(document.getElementById("souls-bar"), "souls", fmt(state.souls));
  set(document.getElementById("souls-bar"), "lives", String(state.reincarnations));
  set(document.getElementById("souls-bar"), "priceMult", runPriceMult().toFixed(2));
  for (const a of ATTRIBUTES) {
    const card = refs.attrs[a.id];
    const lvl = attributeLevel(a.id);
    set(card, "lvl", String(lvl));
    set(card, "bonus", lvl > 0 ? `+${fmt(lvl * a.perPoint)}${a.id === "luck" ? "%" : ""}` : "");
    const btn = card.querySelector('[data-k="buy"]');
    const maxed = lvl >= ATTRIBUTE_MAX;
    const label = maxed ? "Maxed" : `+1 for ${fmt(attributeCost(a))} 👻`;
    if (btn.textContent !== label) btn.textContent = label;
    btn.disabled = maxed || state.souls < attributeCost(a);
  }

  const p = soulsPreview();
  const rb = refs.rebirth;
  set(rb, "depth", p.depth > 0 ? `Danger level ${currentTier()}, ${p.depth} of ${TIERS.length * 5}` : "None yet");
  set(rb, "fromMonsters", fmt(p.fromMonsters));
  set(rb, "runCoins", fmt(state.runCoins));
  set(rb, "fromCoins", fmt(p.fromCoins));
  set(rb, "gain", `+${fmt(p.total)} 👻`);
  const nextMult = runPriceMult() * REINCARNATION.priceGrowth;
  set(rb, "priceNote", `Each reincarnation makes miners, mines and upgrades ${Math.round((REINCARNATION.priceGrowth - 1) * 100)}% pricier. Skills always keep the same price. Prices now: ×${runPriceMult().toFixed(2)}.`);
  set(rb, "nextPrices", `miners, mines and upgrades cost ×${nextMult.toFixed(2)} of their starting price. Skill prices stay the same.`);
  set(rb, "yes", `Yes, reincarnate for +${fmt(p.total)} 👻`);
  const openBtn = rb.querySelector('[data-k="open"]');
  openBtn.hidden = reincarnateOpen;
  openBtn.disabled = !!state.battle;
  openBtn.title = state.battle ? "Finish your fight first." : "";
  rb.querySelector('[data-k="confirm"]').hidden = !reincarnateOpen;
  rb.querySelector('[data-k="yes"]').disabled = !!state.battle;
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
            <button data-k="unlock" class="primary">Open for <span data-k="unlockCost"></span> 🪙</button>
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
  buildMerchant();
  buildSouls();

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

// Header: how much of each opened ore you have, next to your coins.
function renderOreBar() {
  const bar = document.getElementById("ore-bar");
  if (!bar.children.length) {
    for (const o of ORES) bar.appendChild(el(`<span class="ore-chip" data-ore="${o.id}" title="${o.name} ore" hidden>${o.icon} <span class="num" data-k="n">0</span></span>`));
  }
  for (const o of ORES) {
    const chip = bar.querySelector(`[data-ore="${o.id}"]`);
    chip.hidden = !state.unlocked[o.id];
    if (!chip.hidden) set(chip, "n", fmt(state.ore[o.id]));
  }
}

function render() {
  document.getElementById("coins").textContent = fmt(state.coins);
  renderOreBar();

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
      set(card, "unlockCost", fmt(unlockCost(o)));
      card.querySelector('[data-k="unlock"]').disabled = state.coins < unlockCost(o);
    }
  }

  for (const r of RECIPES) {
    const card = refs.recipes[r.id];
    if (!card) continue;
    const element = r.slot === "weapon" ? forgeElement : null;
    const canMake = smithLimit(r, element) > 0;
    set(card, "owned", fmt(bagCount(r)));
    if (r.slot === "weapon") set(card, "bagEls", bagElementsText(r));
    set(card, "price", fmt(sellPrice(r)));
    card.querySelector('[data-k="make1"]').disabled = !canMake;
    card.querySelector('[data-k="makeMax"]').disabled = !canMake;
    card.querySelector('[data-k="sell"]').disabled = bagCount(r) <= 0;
    const worn = state.equipped[r.slot] && state.equipped[r.slot].id === r.id;
    card.querySelector('[data-k="worn"]').hidden = !worn;
    card.querySelector('[data-k="equip"]').disabled = state.items[itemKey(r.id, element)] <= 0;
  }
  if (refs.sellAll) {
    refs.sellAll.disabled = !RECIPES.some(r => r.ore === forgeOre && bagCount(r) > 0);
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
  renderMerchant();

  const hero = heroStats();
  const gear = gearStats();
  const attrs = attributeStats();
  for (const st of STATS) {
    const parts = [];
    if (gear[st.id] > 0) parts.push(`+${fmt(gear[st.id])} gear`);
    if (attrs[st.id] > 0) parts.push(`+${fmt(attrs[st.id])} souls`);
    set(refs.stats[st.id], "total", fmt(hero[st.id]) + (st.id === "luck" ? "%" : ""));
    set(refs.stats[st.id], "bonus", parts.length ? `(${parts.join(", ")})` : "");
  }
  renderSouls();
  for (const slot of SLOTS) {
    const row = refs.slots[slot.id];
    const item = state.equipped[slot.id];
    const r = item && recipeById[item.id];
    set(row, "item", r ? `${r.icon} ${r.name}` : "Empty");
    if (slot.id === "weapon") set(row, "element", r ? `Element: ${item.element ? `${elementById[item.element].icon} ${elementById[item.element].name}` : "Neutral"}` : "");
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

  const spawned = updateSpawns();
  if (spawned > 0) {
    const before = document.getElementById("log").textContent;
    log(`${before} ${spawned} new monster${spawned > 1 ? "s" : ""} appeared while you were away.`.trim());
  }

  buildUI();
  if (state.battle) openBattle(); // pick up a fight that was going on when the page closed

  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    addOre((now - last) / 1000);
    last = now;
    updateSpawns();
    render();
  }, 100);

  setInterval(save, 5000);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });

  document.getElementById("reset").onclick = () => {
    if (!confirm("Start over? This erases ALL your progress, including Souls, attributes and skills. (To start a new run and keep them, use Reincarnate instead.)")) return;
    reincarnateOpen = false;
    state = freshState();
    save();
    renderBattle();
    buildUI();
  };
}

if (typeof document !== "undefined") start();
