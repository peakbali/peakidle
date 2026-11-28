// Peak Idle: mine ore, smith swords and armor, sell them, grow your mine.
// Everything lives in this one file. Progress is saved in your browser (localStorage).

const SAVE_KEY = "peakidle-save-v1"; // kept the same so old saves still load
const SAVE_VERSION = 14;                // bump when the save format changes (see migrate())
const MAX_OFFLINE_SECONDS = 8 * 60 * 60; // offline mining is capped at 8 hours
// A message for the player about what the last save upgrade changed (shown once when the game opens).
let loadNote = "";

// ---------- Game data ----------

// Each ore is also a gear material.
//   statMult: how much stronger gear of this material is than copper gear
//   costMult: how much more ore a piece of gear needs than the copper version
//   gearValue: coins per ore used when the gear is sold
const ORES = [
//   minerCost / unlockCost: starting coin prices (they also go up after every reincarnation, see REINCARNATION)
  { id: "copper",  name: "Copper",  icon: "🟠", perSecPerMiner: 1,    minerCost: 20,    unlockCost: 0,      statMult: 1,   costMult: 1,   gearValue: 1.25 },
  { id: "iron",    name: "Iron",    icon: "⚪", perSecPerMiner: 0.5,  minerCost: 200,   unlockCost: 400,    statMult: 2.2, costMult: 1.5, gearValue: 6 },
  { id: "gold",    name: "Gold",    icon: "🟡", perSecPerMiner: 0.25, minerCost: 1500,  unlockCost: 8000,   statMult: 4.5, costMult: 2,   gearValue: 36 },
  { id: "mithril", name: "Mithril", icon: "🔷", perSecPerMiner: 0.1,  minerCost: 10000, unlockCost: 150000, statMult: 9,   costMult: 2.5, gearValue: 270 },
  // Deeper ores. Each mine costs about 9x the last and its gear is about 2.4x stronger, so every new
  // ore takes clearly longer to reach (roughly 2 days of mining for Voidsteel on a first run).
  { id: "adamant",    name: "Adamant",    icon: "🟩", perSecPerMiner: 0.06,  minerCost: 70000,     unlockCost: 2e6,    statMult: 21,   costMult: 3,   gearValue: 1900 },
  { id: "obsidian",   name: "Obsidian",   icon: "🟣", perSecPerMiner: 0.04,  minerCost: 450000,    unlockCost: 18e6,   statMult: 52,   costMult: 3.5, gearValue: 13500 },
  { id: "moonsilver", name: "Moonsilver", icon: "🌙", perSecPerMiner: 0.03,  minerCost: 3e6,       unlockCost: 160e6,  statMult: 128,  costMult: 4,   gearValue: 95000 },
  { id: "sunstone",   name: "Sunstone",   icon: "🌞", perSecPerMiner: 0.02,  minerCost: 20e6,      unlockCost: 1.4e9,  statMult: 315,  costMult: 4.5, gearValue: 670e3 },
  { id: "starmetal",  name: "Starmetal",  icon: "🌟", perSecPerMiner: 0.015, minerCost: 130e6,     unlockCost: 12e9,   statMult: 780,  costMult: 5,   gearValue: 4.7e6 },
  { id: "voidsteel",  name: "Voidsteel",  icon: "🌌", perSecPerMiner: 0.01,  minerCost: 900e6,     unlockCost: 100e9,  statMult: 1900, costMult: 5.5, gearValue: 33e6 },
];

// The pixel-art picture for an ore (drawn in ores-art.js), or its emoji if that file is missing.
function oreIcon(o) {
  return typeof oreArtSVG === "function" ? oreArtSVG(o.id) || o.icon : o.icon;
}

// The hero's stats.
// Luck is your critical hit chance in % (a crit does double damage). It comes from rings, Soul attributes
// and the Storm Charm boon, all added together. Above 100% luck every hit is a crit.

const STATS = [
  { id: "hp",      name: "HP",          icon: "❤️" },
  { id: "attack",  name: "Attack",      icon: "⚔️" },
  { id: "defense", name: "Defense",     icon: "🛡️" },
  { id: "agility", name: "Agility",     icon: "💨" },
  { id: "luck",    name: "Luck",        icon: "🍀" },
];
const HERO_BASE_STATS = { hp: 100, attack: 2, defense: 0, agility: 5, luck: 0 };

// Where gear can be worn. One item per slot.
const SLOTS = [
  { id: "weapon",     name: "Weapon" },
  { id: "helmet",     name: "Helmet" },
  { id: "chestplate", name: "Chestplate" },
  { id: "gloves",     name: "Gloves" },
  { id: "boots",      name: "Boots" },
  { id: "shield",     name: "Shield" },
  { id: "ring",       name: "Ring" },
];

// Every gear type can be smithed from every ore.
//   cost:  copper ore needed (other ores multiply this by costMult)
//   stats: bonus for copper gear (other ores multiply this by statMult)
const GEAR_TYPES = [
  // The one weapon
  { id: "sword",      name: "Sword",      slot: "weapon",     icon: "🗡️", cost: 12, stats: { attack: 5, agility: 1 } },
  // Armor: heavy pieces give more defense, light pieces give more agility
  { id: "helmet",     name: "Helmet",     slot: "helmet",     icon: "🪖", cost: 15, stats: { defense: 2, hp: 10 } },
  { id: "chestplate", name: "Chestplate", slot: "chestplate", icon: "🥋", cost: 30, stats: { defense: 5, hp: 30 } },
  { id: "gloves",     name: "Gloves",     slot: "gloves",     icon: "🧤", cost: 10, stats: { defense: 1, attack: 1, agility: 2 } },
  { id: "boots",      name: "Boots",      slot: "boots",      icon: "🥾", cost: 12, stats: { defense: 1, agility: 3 } },
  { id: "shield",     name: "Shield",     slot: "shield",     icon: "🛡️", cost: 20, stats: { defense: 4, hp: 20 } },
  // Rings: the gear that gives luck (critical hit chance). Luck doesn't use statMult (that would pass
  // 100% at once), it follows its own list instead: copper 5%, iron 10% ... voidsteel 50%.
  // Ring stats are read from this list every time, so rings you already own get the new values too.
  { id: "ring",       name: "Ring",       slot: "ring",       icon: "💍", cost: 8,  stats: {}, luckByOre: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] },
];

// All recipes, built from every ore x every gear type (e.g. "iron_bow").
// cost: ore needed. price: coins when sold.
const RECIPES = [];
for (const ore of ORES) {
  for (const type of GEAR_TYPES) {
    const cost = Math.round(type.cost * ore.costMult);
    const stats = {};
    for (const [k, v] of Object.entries(type.stats)) stats[k] = Math.round(v * ore.statMult);
    if (type.luckByOre) stats.luck = type.luckByOre[ORES.indexOf(ore)];
    RECIPES.push({
      id: `${ore.id}_${type.id}`,
      name: `${ore.name} ${type.name}`,
      ore: ore.id,
      type: type.id,
      slot: type.slot,
      icon: type.icon,
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

// Weapons that were removed in save version 11 (the sword is now the only weapon), with their old ore cost,
// and the essences it used to cost to infuse a weapon of each ore with an element. Only migrate() uses these.
const OLD_WEAPON_COST = { axe: 15, spear: 13, bow: 10, staff: 10 };
const OLD_INFUSE_COST = { copper: 3, iron: 8, gold: 20, mithril: 50, adamant: 120, obsidian: 300,
  moonsilver: 750, sunstone: 1800, starmetal: 4500, voidsteel: 11000 };
const slotById = Object.fromEntries(SLOTS.map(s => [s.id, s]));

// ---------- Prices (balance) ----------
// All coin prices grow exponentially, so a first run gets slow and reincarnating is how you push further.
const MINER_COST_GROWTH = 1.22;                 // each extra miner of an ore costs 22% more
const PICKAXE = { start: 60,  growth: 3.5 };    // pickaxe level 1 -> 2 costs 60, then x3.5 each level
const ANVIL   = { start: 300, growth: 5 };      // anvil level 1 -> 2 costs 300, then x5 each level

// ---------- Reincarnation and Souls ----------
// Reincarnating starts a new run: coins, ore, miners, mines, upgrades, gear, essences and monster
// progress reset. You keep learned skills (back at level 1), Souls and attributes, and earn new Souls.
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
  { id: "hp",      perPoint: 20, baseCost: 1, growth: 1.15, desc: "+20 max HP per point" },
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
//   cost:  essences to buy (rises steeply by grade)
//   boost: multiplies the skill's damage and healing. High (3 mana) skills hit twice as hard.
const SKILL_GRADES = [
  { grade: 1, name: "Low",  mana: 1, cost: 8,   boost: 1 },
  { grade: 2, name: "Mid",  mana: 2, cost: 50,  boost: 1 },
  { grade: 3, name: "High", mana: 3, cost: 300, boost: 2 },
];
// Levelling: each level makes the skill 25% stronger (damage and healing).
// The essence cost of the next level grows by x1.7 each time.
const SKILL_LEVEL_BONUS = 0.25;
const SKILL_LEVEL_COST_START = 0.6; // level 1 -> 2 costs 60% of the buy price
const SKILL_LEVEL_COST_GROWTH = 1.7;

// What a skill can do (any mix):
//   power:    damage = attack x power. Skills never miss and can crit.
//   hits:     how many times it strikes (default 1)
//   status:   a status effect it can cause (see STATUS), with `chance` (0-1) per hit
//   heal:     heals this share of your max HP
//   cleanse:  also cures your own status effects
//   guard:    you guard this turn as well
//   interrupt: cancels a heavy attack the monster is winding up
//   critBonus: extra crit chance for this skill
// Each element causes its own status effect: fire burns, ice freezes, wind poisons,
// earth stuns or weakens, lightning shocks.
const SKILLS = [
  // Fire: raw damage and burns
  { id: "firebolt",      element: "fire",      grade: 1, name: "Firebolt",         power: 1.7, status: "burn", chance: 0.3, desc: "Hurl a bolt of flame. 30% chance to burn." },
  { id: "flame_lash",    element: "fire",      grade: 2, name: "Flame Lash",       power: 2.4, hits: 2, status: "burn", chance: 0.35, desc: "Two burning whip strikes. Each has a 35% chance to burn." },
  { id: "meteor",        element: "fire",      grade: 3, name: "Meteor",           power: 5.5, status: "burn", chance: 1, desc: "Call down a blazing rock. Huge damage and always burns." },
  // Ice: control
  { id: "ice_spear",     element: "ice",       grade: 1, name: "Ice Spear",        power: 1.5, status: "frozen", chance: 0.15, desc: "A sharp spear of ice. 15% chance to freeze." },
  { id: "frost_armor",   element: "ice",       grade: 2, name: "Frost Armor",      power: 1.4, guard: true, status: "frozen", chance: 0.2, desc: "Strike, then guard behind a shell of ice this turn. 20% chance to freeze." },
  { id: "glacial_prison",element: "ice",       grade: 3, name: "Glacial Prison",   power: 3.5, status: "frozen", chance: 1, desc: "Freeze the foe solid. It loses its next turn." },
  // Wind: poison, speed and healing
  { id: "gust",          element: "wind",      grade: 1, name: "Gust",             power: 1.3, interrupt: true, status: "poison", chance: 0.5, desc: "A toxic blast that breaks a heavy attack wind-up. 50% chance to poison." },
  { id: "healing_breeze",element: "wind",      grade: 2, name: "Healing Breeze",   heal: 0.3, cleanse: true, desc: "Heal 30% of your max HP and cure your status effects." },
  { id: "cyclone",       element: "wind",      grade: 3, name: "Cyclone",          power: 1.6, hits: 3, status: "poison", chance: 0.5, desc: "Three spinning slashes. Each can crit and has a 50% chance to add poison." },
  // Earth: toughness, stuns and weaken
  { id: "stone_fist",    element: "earth",     grade: 1, name: "Stone Fist",       power: 1.6, status: "stun", chance: 0.2, desc: "A heavy punch of rock. 20% chance to stun." },
  { id: "stone_skin",    element: "earth",     grade: 2, name: "Stone Skin",       power: 1.0, status: "weaken", chance: 1, desc: "Strike and harden: the foe is weakened (deals 35% less damage) for 3 turns." },
  { id: "earthquake",    element: "earth",     grade: 3, name: "Earthquake",       power: 4.5, interrupt: true, status: "stun", chance: 0.4, desc: "Shake the ground. Big damage, breaks a wind-up, 40% chance to stun." },
  // Lightning: crits and shock
  { id: "spark",         element: "lightning", grade: 1, name: "Spark",            power: 1.4, status: "shock", chance: 0.35, desc: "A quick zap. 35% chance to shock." },
  { id: "chain_lightning",element:"lightning", grade: 2, name: "Chain Lightning",  power: 2.9, critBonus: 0.2, status: "shock", chance: 0.5, desc: "Crackling bolt with +20% crit chance. 50% chance to shock." },
  { id: "thunder_judgment",element:"lightning",grade: 3, name: "Thunder Judgment", power: 4.2, critBonus: 0.35, status: "shock", chance: 1, desc: "+35% crit chance and always shocks." },
];
const skillById = Object.fromEntries(SKILLS.map(sk => [sk.id, sk]));
function skillGrade(sk) { return SKILL_GRADES[sk.grade - 1]; }
function skillBoost(sk) { return skillGrade(sk).boost || 1; }

// ---------- Status effects ----------
// Both you and monsters can get these. `turns` counts the turns of whoever has it:
// it goes down by 1 at the end of each of their turns.
//   Burn and poison hurt at the end of each turn. Their damage is based on the hit that caused them.
//   Frozen and stun make you lose your next turn. Afterwards you are "steady" for a turn and can't be frozen or stunned again right away.
//   Shock gives a chance to fail to act. Weaken means you deal 35% less damage.
//   Monsters can't get the effect of their own element (a fire monster can't burn).
const STATUS = {
  burn:   { name: "Burn",   icon: "🔥", turns: 3, dot: 0.25,  desc: "Takes fire damage at the end of each turn." },
  poison: { name: "Poison", icon: "☠️", turns: 4, dot: 0.12, maxStacks: 5, desc: "Takes poison damage at the end of each turn. Stacks up to 5 times." },
  frozen: { name: "Frozen", icon: "🧊", turns: 1, skip: true, desc: "Frozen solid: loses the next turn." },
  stun:   { name: "Stun",   icon: "💫", turns: 1, skip: true, desc: "Dazed: loses the next turn." },
  shock:  { name: "Shock",  icon: "⚡", turns: 3, fail: 0.3,  desc: "30% chance to fail to act each turn." },
  weaken: { name: "Weaken", icon: "🥀", turns: 3, mult: 0.65, desc: "Deals 35% less damage." },
  bleed:  { name: "Bleed",  icon: "🩸", turns: 3, maxStacks: 3, desc: "Loses a share of max HP at the end of each turn, for every stack. Stacks up to 3." },
  steady: { name: "Steady", icon: "🧱", turns: 2, desc: "Just shook off a freeze or stun: can't be frozen or stunned right now." },
};
// The status effect that goes with each element.
const ELEMENT_STATUS = { fire: "burn", ice: "frozen", wind: "poison", earth: "stun", lightning: "shock" };

// ---------- Element Mastery (Upgrades panel) ----------
// One mastery track per element, bought with that element's essence. Mastery is PERMANENT:
// it stays when you reincarnate, so essence always has somewhere lasting to go.
// Each level of, say, Fire Mastery:
//   - makes your fire skills hit harder
//   - makes fire's status effect stronger: higher chance to cause it, and burn/poison hurt more
// The essence price of the next level = baseCost x growth ^ (levels you already have), rounded up.
const MASTERY = {
  max: 25,
  damage: 0.06,        // +6% damage per level (+150% at level 25)
  statusChance: 0.04,  // the chance to cause the status goes up 4% of itself per level (never above 100%)
  dot: 0.05,           // burn and poison damage +5% per level
  baseCost: 15,        // level 1 costs 15 essences
  growth: 1.5,         // each level costs 50% more than the last
};
const STATUS_ELEMENT = Object.fromEntries(Object.entries(ELEMENT_STATUS).map(([el, st]) => [st, el]));

// ---------- Run Boons (Upgrades panel) ----------
// Boosts to your stats for THIS RUN ONLY: they reset when you reincarnate (Souls attributes are the
// permanent ones). Each boon has 10 levels. Level N is paid with the ore of danger level N
// (level 1 copper, level 5 adamant, level 10 voidsteel) plus essence of the boon's element,
// so deeper levels open up as you reach the matching ore and boss.
//   pct: the stat goes up by this share per level (on top of gear and attributes); flat: added per level
const BOONS = [
  { id: "hp",      name: "Heartstone Tonic", icon: "❤️", element: "earth",     pct: 0.05, desc: "+5% max HP per level" },
  { id: "attack",  name: "Ember Whetstone",  icon: "⚔️", element: "fire",      pct: 0.04, desc: "+4% attack per level" },
  { id: "defense", name: "Frost Rivets",     icon: "🛡️", element: "ice",       pct: 0.04, desc: "+4% defense per level" },
  { id: "agility", name: "Gale Feather",     icon: "💨", element: "wind",      pct: 0.04, desc: "+4% agility per level" },
  { id: "luck",    name: "Storm Charm",      icon: "🍀", element: "lightning", flat: 1,   desc: "+1% critical hit chance per level" },
];
const BOON_COST = {
  ore: 150,            // ore for level N = 150 x that ore's costMult (150 copper ... 825 voidsteel)
  essence: 5,          // essence for level N = 5 x 1.2 ^ (5N - 3): about 5 wins' worth of essence at danger level N
};
const boonById = Object.fromEntries(BOONS.map(b => [b.id, b]));

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
  // Danger levels 5-10: you need gear from the newer ores to stand a chance here.
  { name: "Crystal Caverns", icon: "💎",
    creatures: [{ name: "Hedgehog", icon: "🦔" }, { name: "Snail", icon: "🐌" }, { name: "Scorpion", icon: "🦂" }, { name: "Wisp", icon: "🔮" }],
    boss: { id: "thunder_kraken", name: "Thunder Kraken", icon: "🐙", element: "lightning" } },
  { name: "Sunken Ruins", icon: "🏛️",
    creatures: [{ name: "Crab", icon: "🦀" }, { name: "Ghoul", icon: "🧟" }, { name: "Shark", icon: "🦈" }, { name: "Squid", icon: "🦑" }],
    boss: { id: "tempest_leviathan", name: "Tempest Leviathan", icon: "🐋", element: "wind" } },
  { name: "Frostfang Tundra", icon: "🌨️",
    creatures: [{ name: "Mammoth", icon: "🦣" }, { name: "Owl", icon: "🦉" }, { name: "Bear", icon: "🐻" }, { name: "Walrus", icon: "🦭" }],
    boss: { id: "rime_sorceress", name: "Rime Sorceress", icon: "🧙", element: "ice" } },
  { name: "Ember Wastes", icon: "🏜️",
    creatures: [{ name: "Fire Ant", icon: "🐜" }, { name: "Raptor", icon: "🦖" }, { name: "Mantis", icon: "🦗" }, { name: "Boar", icon: "🐗" }],
    boss: { id: "inferno_lord", name: "Inferno Lord", icon: "👹", element: "fire" } },
  { name: "Shadow Abyss", icon: "🌑",
    creatures: [{ name: "Wraith", icon: "👻" }, { name: "Shade", icon: "👤" }, { name: "Skeleton", icon: "💀" }, { name: "Vampire", icon: "🧛" }],
    boss: { id: "mountain_colossus", name: "Mountain Colossus", icon: "⛰️", element: "earth" } },
  { name: "Starfall Crown", icon: "🌌",
    creatures: [{ name: "Comet", icon: "☄️" }, { name: "Star Spirit", icon: "🌠" }, { name: "Void Eye", icon: "👁️" }, { name: "Seraph", icon: "😇" }],
    boss: { id: "starfall_sovereign", name: "Starfall Sovereign", icon: "👑", element: "lightning" } },
];
// A random monster's name starts with a word for its element, e.g. "Blazing Rat" or "Frozen Bat".
const ELEMENT_ADJECTIVE = { fire: "Blazing", ice: "Frozen", wind: "Gusting", earth: "Rocky", lightning: "Charged" };

const SPAWN = {
  max: 3,                 // 3 monsters wait at once. Beat (or catch) one and a new one takes its place right away.
  newRun: 3,              // a new game or reincarnation starts with 3 monsters already waiting
  lowerTierChance: 0.3,   // 30% of spawns are one tier below yours (from tier 2 up), for variety; 70% are your tier
};

// Monster stats grow exponentially with tier: stat = start * growth ^ step.
// Random monsters of tier T use step (T-1)*5 + 2, the boss of tier T uses step T*5 - 1 (plus BOSS_MULT).
const MONSTER_SCALING = {
  hp:      { start: 42,  growth: 1.22 }, // battles last about 8 to 12 turns with skills, bosses about 20
  attack:  { start: 4,   growth: 1.17 },
  defense: { start: 1.5, growth: 1.18 },
  agility: { start: 4,   growth: 1.12 },
  coins:   { start: 10,  growth: 1.4 }, // coins for a win
  drops:   { start: 1,   growth: 1.2 },  // element drops for a win
};
// Bosses: hp was 1.6 and attack 1.15 before normal monsters got tougher (see NORMAL_TOUGHER); raised a
// little so a boss is still clearly stronger than the normal monsters of its level.
const BOSS_MULT = { hp: 1.75, attack: 1.22, defense: 1.15, agility: 1.1, coins: 3, drops: 3 };

// From danger level 5 on, monster HP, attack and defense grow at the same speed as the gear of the
// matching ore (danger level N goes with ore N), so a hero in that ore's gear always has a fair fight.
// Before this, monster HP grew faster than gear: the level 5 boss had ~7,900 HP and a boss fight took
// 30-45 turns. The numbers below scale each stat on top of that. Coins, drops and agility don't change.
const LATE_TIERS = {
  fromTier: 5,
  hp: 0.6,       // 60% of what the level 4 numbers grown by gear would give: level 5 boss ~4,100 HP
  attack: 1.0,
  defense: 1.0,
};

// Normal (non-boss) monsters are tougher than the formulas above give. Players found that after a few
// gear and skill upgrades they beat every normal monster in one hit (a level-1 Meteor did more than a
// normal monster's whole HP). These multiply normal monsters only (bosses got a smaller bump in BOSS_MULT).
//   hp: one number per danger level (1-10). Level 4 gets less because its monsters were already the
//       toughest for their gear.
//   With gear of your danger level and level-1 skills, a normal fight now takes about 3-12 turns
//   instead of 1-7, and a Meteor one-shot needs gear about one ore ahead.
//   Coins and drops for a win are not changed.
const NORMAL_TOUGHER = {
  hp: [1.7, 1.7, 1.7, 1.3, 1.7, 1.7, 1.7, 1.7, 1.7, 1.7],
  attack: 1.3,   // they hit harder, so a fight costs some HP
  defense: 1.15,
};

// Monster attack by danger level (1-10), for normal monsters and bosses. Hero HP and defense grow
// faster than monster attack (gear, Soul attributes, boons), so from level 3 up monsters hit too softly:
// a level 6 boss hit about 500 into a hero with 9,000 HP. This multiplies their attack on top of
// everything above. Monster HP is not changed.
const MONSTER_ATTACK_BY_LEVEL = [1, 1, 1.3, 1.6, 1.8, 2, 2, 2, 2, 2];

// Bleed: from danger level 3, monster attacks make you bleed. Each stack takes a share of your MAX HP at the
// end of your turn, so it hurts just as much however strong you are: the difference is how fast you win.
//   Bosses add 1 stack every attack (2 for a heavy attack). Normal monsters have a chance to add 1.
//   Dodge and parry don't stop it. Healing Breeze washes it off; Frost Armor's guard blocks new stacks.
//   Each new stack resets the 3-turn timer. Old fights in a save simply have no bleed yet.
const BLEED = {
  fromTier: 3,
  perStack: 0.03,       // 3% of your max HP per stack, per turn
  maxStacks: 3,         // so at most 9% per turn (was 5; Khen found 5 too hard)
  normalChance: 0.3,    // normal monsters: 30% chance per attack to add a stack
  bossStacks: 1,        // bosses: stacks per attack
  bossHeavyStacks: 2,   // bosses: stacks per heavy attack
};

// Battle rules
const BATTLE = {
  startMana: 3,
  manaPerTurn: 1,
  maxMana: 5,
  skillSlots: 3,          // equip skills from the Skills panel into these
  critMultiplier: 2,      // a critical hit does double damage; crit chance = luck %
  heavyEvery: 3,          // monsters wind up a heavy attack every 3rd turn
  heavyMultiplier: 1.8,
  heavyStunChance: 0.35,  // a heavy attack that lands (not guarded) can stun you
  guardMultiplier: 0.4,   // guarding (the Frost Armor skill) takes only 40% damage, and blocks status effects
  specialChance: 0.35,    // how often a monster uses its element move instead of a normal attack
  warCryChance: 0.2,      // bosses sometimes roar to weaken you
};

// Dodge and parry: when a monster attacks, buttons may pop up. Tap one in time to react.
//   Dodge: avoid the whole hit. Parry: take only 30% damage and strike back (not against heavy attacks).
//   Not every attack gives you a chance: sometimes no button appears and the hit just lands.
//   When they do appear, you get only Dodge, only Parry, or both, each at its own random spot.
const REACTION = {
  chance: 0.6,                 // 60% of normal attacks show buttons
  heavyChance: 0.85,           // 85% of heavy attacks do (only Dodge, since heavy hits can't be parried)
  windowMin: 600,              // the window is 0.6 to 1 second: longer when you're quicker than the monster
  windowMax: 1000,
  heavyWindow: 0.85,           // heavy attacks give a shorter window
  bossWindow: 0.9,             // and so do bosses
  parryTaken: 0.3,             // a parried hit does 30% damage
  parryCounter: 0.6,           // your counterattack: 60% of a normal attack
};

// Catch: try to tame the monster instead of fighting on. Costs your turn.
//   The chance goes up the more HP it has lost: 5% at full HP, 85% when it's almost down.
//   Luck adds a bit, and a frozen or stunned monster is easier to catch. Bosses can't be caught.
//   A caught monster goes into your Bestiary and gives the same rewards as beating it.
const CATCH = {
  base: 0.05,
  fromHpLost: 0.8,       // + up to 80% as its HP drops
  luckShare: 0.25,       // + a quarter of your luck (20 luck = +5%)
  helpless: 0.1,         // + 10% while it's frozen or stunned
  max: 0.95,
};

// Bestiary milestones: small permanent bonuses for filling in the Bestiary. Kept through reincarnation.
// There are 10 danger levels with 4 kinds of monster each (40 kinds), and every monster comes in
// 5 colors (its element: Fire, Ice, Wind, Earth, Lightning), so 200 monster + color pairs in all.
//   pct:  added to HP, Attack, Defense and Agility, as a % on top of gear and Soul attributes
//   luck: added to luck (crit chance %)
// If you got every milestone it adds up to +37% stats and +5% luck: nice, but less than one new ore of gear.
const BESTIARY_REWARDS = {
  row:      { pct: 0.01,   luck: 0 }, // x10: catch all 4 kinds of one danger level (any color)
  rainbow:  { pct: 0.0025, luck: 0 }, // x40: catch one kind of monster in all 5 colors
  tierAll:  { pct: 0.01,   luck: 0 }, // x10: catch all 4 kinds of one danger level in all 5 colors
  kinds:    { pct: 0.02,   luck: 0 }, // x1:  catch all 40 kinds (any color)
  complete: { pct: 0.05,   luck: 5 }, // x1:  the whole Bestiary, every kind in every color
};

// Each monster has a special move of its own element, which can cause that element's status effect.
const MONSTER_MOVES = {
  fire:      { name: "Flame Breath", power: 1.15, status: "burn",   chance: 0.6 },
  ice:       { name: "Frost Fang",   power: 1.1,  status: "frozen", chance: 0.3 },
  wind:      { name: "Venom Gust",   power: 1.0,  status: "poison", chance: 0.7 },
  earth:     { name: "Boulder Slam", power: 1.2,  status: "stun",   chance: 0.3 },
  lightning: { name: "Static Claw",  power: 1.1,  status: "shock",  chance: 0.5 },
};

// Stats and rewards for a monster of this tier (1-10).
function monsterStats(tier, boss) {
  const step = boss ? tier * 5 - 1 : (tier - 1) * 5 + 2;
  const grow = (key, st) => MONSTER_SCALING[key].start * Math.pow(MONSTER_SCALING[key].growth, st) * (boss ? BOSS_MULT[key] : 1);
  const stat = key => {
    if (tier < LATE_TIERS.fromTier || !LATE_TIERS[key]) return grow(key, step);
    // Late tiers: start from the last early tier and grow with the matching ore's gear.
    const base = LATE_TIERS.fromTier - 1;
    const gear = ORES[tier - 1].statMult / ORES[base - 1].statMult;
    return grow(key, step - 5 * (tier - base)) * gear * LATE_TIERS[key];
  };
  const tough = key => boss ? 1 : key === "hp" ? NORMAL_TOUGHER.hp[tier - 1] || 1 : NORMAL_TOUGHER[key] || 1;
  return {
    stats: {
      hp: Math.round(stat("hp") * tough("hp")),
      attack: Math.round(stat("attack") * tough("attack") * (MONSTER_ATTACK_BY_LEVEL[tier - 1] || 1)),
      defense: Math.round(stat("defense") * tough("defense")),
      agility: Math.round(stat("agility")),
    },
    reward: { coins: Math.round(stat("coins")), drops: Math.round(stat("drops")) },
  };
}

// The full monster for a waiting spawn ({ uid, tier, creature, element }) or a boss tier.
function spawnMonster(sp) {
  const c = TIERS[sp.tier - 1].creatures[sp.creature];
  return { uid: sp.uid, tier: sp.tier, boss: false, element: sp.element,
    name: `${ELEMENT_ADJECTIVE[sp.element]} ${c.name}`, icon: c.icon, art: c.name.toLowerCase().replace(/ /g, "_"),
    ...monsterStats(sp.tier, false) };
}
function bossMonster(tier) {
  const b = TIERS[tier - 1].boss;
  return { uid: "boss", tier, boss: true, element: b.element, name: b.name, icon: b.icon, art: b.id, ...monsterStats(tier, true) };
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
    items: {},            // smithed gear in your bag: recipe id -> how many
    equipped: {},         // slot id -> { id: recipe id } or null
    drops: {},            // element id -> how many essences you have
    bossesBeaten: 0,      // bosses beaten this run; your tier (danger level) is this + 1
    tierWins: 0,          // wins against random monsters of your current tier (adds Souls)
    spawns: [],           // random monsters waiting to be fought: { uid, tier, creature, element }
    nextUid: 1,
    skills: {},           // skill id -> level (0 = not bought yet)
    skillSlots: [null, null, null], // skill ids equipped for battle
    battle: null,         // the fight in progress, saved so a reload can't skip it
    runCoins: 0,          // coins earned since the last reincarnation (gives Souls)
    boons: {},            // boon id -> level (0-10), this run only
    // Kept when you reincarnate:
    souls: 0,             // Souls to spend on attributes
    attributes: {},       // attribute id -> points bought (0-99)
    mastery: {},          // element id -> Element Mastery level (permanent)
    reincarnations: 0,    // how many times you've reincarnated (prices go up each time)
    totalSouls: 0,        // all Souls ever earned
    profile: normalizeProfile(null), // your hero's name and look (see avatar.js), also kept on Reset
    bestiary: {},         // monsters you've caught or met, by creature (art key): { seen, caught, el: { element: count } }
    milestones: {},       // Bestiary milestones reached: id -> when (kept forever, see BESTIARY_REWARDS)
    milestonesNew: [],    // milestones reached but not celebrated yet (the Congratulations window shows them)
    welcomed: false,      // has seen the Welcome window (it opens once by itself, then from the [?] button)
    farm: freshFarm(),    // Monster Farm (farm.js): bought with Souls, kept forever, its essence waits to be collected
    lastSaved: Date.now(),
  };
  for (const a of ATTRIBUTES) s.attributes[a.id] = 0;
  for (const e of ELEMENTS) { s.drops[e.id] = 0; s.mastery[e.id] = 0; }
  for (const bn of BOONS) s.boons[bn.id] = 0;
  for (const o of ORES) {
    s.ore[o.id] = 0;
    s.miners[o.id] = 0;
    s.unlocked[o.id] = o.unlockCost === 0;
  }
  for (const r of RECIPES) s.items[r.id] = 0;
  for (const sk of SKILLS) s.skills[sk.id] = 0;
  for (const slot of SLOTS) s.equipped[slot.id] = null;
  for (let i = 0; i < SPAWN.newRun; i++) addSpawn(s);
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
  if (saved.version < 7) {
    // v6 -> v7: full-screen battles with status effects. Nothing is reset; a fight in progress
    // is converted by normalizeBattle() when it loads.
    saved.version = 7;
  }
  if (saved.version < 8) {
    // v7 -> v8: 6 new ores, danger levels 5-10 and weapon skills. Nothing is reset: the new mines
    // start locked (freshState fills them in), and if you had beaten the Sky Peak dragon you are
    // now at danger level 5 with the next boss waiting.
    saved.version = 8;
  }
  if (saved.version < 9) {
    // v8 -> v9: Element Mastery and Run Boons in the Upgrades panel. Nothing is reset: both start
    // at level 0 (freshState fills them in).
    saved.version = 9;
  }
  if (saved.version < 10) {
    // v9 -> v10: player profile (name and look). Nothing is reset: you get the default look and
    // the name "Hero", and can change both from the settings menu.
    saved.version = 10;
  }
  if (saved.version < 11) migrateToSwordsOnly(saved);
  if (saved.version < 12) {
    // v11 -> v12: rings and a ring slot. Nothing is reset: the ring slot starts empty
    // (freshState fills it in) and all your gear stays where it was.
    saved.version = 12;
  }
  if (saved.version < 13) {
    // v12 -> v13: 3 monsters with no timer, Catch and the Bestiary.
    // Monsters already waiting all stay, even if there are more than 3: no new ones come until
    // you're below 3. The spawn timer is gone. Monsters on screen count as "seen" in the Bestiary.
    delete saved.nextSpawnAt;
    saved.bestiary = {};
    for (const sp of saved.spawns || []) markSeen(saved, sp);
    if (saved.battle && saved.battle.monster && !saved.battle.monster.boss) markSeen(saved, saved.battle.monster);
    saved.version = 13;
  }
  if (saved.version < 14) {
    // v13 -> v14: the Welcome window and Bestiary milestones. Nothing is reset. Players who already
    // have a save see the Welcome window once too. Milestones you had already reached are worked out
    // from your Bestiary when the game loads (checkMilestones in load()), give their bonus straight
    // away, and are shown together in one Congratulations window.
    saved.welcomed = false;
    saved.version = 14;
  }
  // Later versions add their steps here.
  return saved;
}

// v10 -> v11: the sword is the only weapon, weapon skills are gone and weapons no longer carry an element.
// Nothing is lost:
//   - Axes, spears, bows and staffs in your bag are sold for their full sell price (with your anvil bonus).
//   - If one was equipped, you now wear a sword of the same ore instead. If the old weapon was worth
//     more than the sword, you also get the difference in coins.
//   - Every weapon that had an element (in your bag or equipped) gives back the essences it cost to infuse,
//     and stays as a plain sword (swords) or is sold like the rest (other weapons).
//   - Weapon skills were free, so there's nothing to refund; a fight in progress just loses them.
function migrateToSwordsOnly(saved) {
  const items = saved.items || {};
  const drops = saved.drops = saved.drops || {};
  const priceMult = 1 + ((saved.anvil || 1) - 1) * 0.25;
  const refunded = {};
  // What a weapon type of this ore is worth when sold, or null if the ore or type is unknown.
  const worth = (oreId, type) => {
    const ore = ORES.find(o => o.id === oreId);
    const cost = type === "sword" ? GEAR_TYPES[0].cost : OLD_WEAPON_COST[type];
    return ore && cost ? Math.floor(Math.round(Math.round(cost * ore.costMult) * ore.gearValue) * priceMult) : null;
  };
  const refundInfusion = (oreId, el, n) => {
    if (n > 0 && el && OLD_INFUSE_COST[oreId] && ELEMENTS.some(e => e.id === el)) {
      drops[el] = (drops[el] || 0) + n * OLD_INFUSE_COST[oreId];
      refunded[el] = (refunded[el] || 0) + n * OLD_INFUSE_COST[oreId];
    }
  };
  let coins = 0, sold = 0;
  for (const [key, count] of Object.entries(items)) {
    const [recipeId, el] = key.split(":");
    const [oreId, type] = recipeId.split("_");
    const n = Math.max(0, Math.floor(count || 0));
    if (type === "sword" && el) {
      refundInfusion(oreId, el, n);
      items[recipeId] = (items[recipeId] || 0) + n;
      delete items[key];
    } else if (OLD_WEAPON_COST[type]) {
      refundInfusion(oreId, el, n);
      const each = worth(oreId, type);
      if (each !== null) { coins += n * each; sold += n; }
      delete items[key];
    }
  }
  const w = saved.equipped && saved.equipped.weapon;
  if (w && typeof w.id === "string") {
    const [oreId, type] = w.id.split("_");
    refundInfusion(oreId, w.element, 1);
    if (OLD_WEAPON_COST[type]) {
      const oldWorth = worth(oreId, type), swordWorth = worth(oreId, "sword");
      if (oldWorth !== null && swordWorth !== null) coins += Math.max(0, oldWorth - swordWorth);
      saved.equipped.weapon = { id: `${oreId}_sword` };
    } else {
      saved.equipped.weapon = { id: w.id };
    }
  }
  saved.items = items;
  saved.coins = (saved.coins || 0) + coins;
  saved.runCoins = (saved.runCoins || 0) + coins;
  // A fight in progress keeps going, with a plain sword and no weapon skills.
  const b = saved.battle;
  if (b && b.hero) {
    b.hero.element = null;
    const [oreId, type] = String(b.hero.weapon || "").split("_");
    if (OLD_WEAPON_COST[type]) b.hero.weapon = `${oreId}_sword`;
    delete b.empower;
    delete b.riposte;
  }
  const parts = [];
  if (sold > 0) parts.push(`your ${sold} other weapon${sold > 1 ? "s were" : " was"} sold`);
  if (coins > 0) parts.push(`you got ${fmt(coins)} coins`);
  const essences = Object.entries(refunded).map(([el, n]) => `${n} ${el}`);
  if (essences.length) parts.push(`infusion essences refunded (${essences.join(", ")})`);
  if (parts.length) loadNote = `Swords are now the only weapon: ${parts.join(", ")}.`;
  saved.version = 11;
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
    for (const key of ["ore", "miners", "unlocked", "items", "drops", "skills", "attributes", "mastery", "boons"]) {
      for (const [k, v] of Object.entries(saved[key] || {})) {
        if (k in s[key]) s[key][k] = v;
      }
    }
    for (const slot of SLOTS) {
      const item = saved.equipped && saved.equipped[slot.id];
      const r = item && recipeById[item.id];
      if (r && r.slot === slot.id) s.equipped[slot.id] = { id: r.id };
    }
    (saved.skillSlots || []).slice(0, BATTLE.skillSlots).forEach((id, i) => {
      if (skillById[id] && s.skills[id] > 0 && !s.skillSlots.includes(id)) s.skillSlots[i] = id;
    });
    s.bossesBeaten = Math.min(TIERS.length, Math.max(0, s.bossesBeaten));
    if (Array.isArray(saved.spawns)) {
      // Keep every waiting monster, even past 3 (older saves could have 5).
      s.spawns = saved.spawns.filter(sp => sp && TIERS[sp.tier - 1] && TIERS[sp.tier - 1].creatures[sp.creature] && elementById[sp.element]);
    }
    s.bestiary = normalizeBestiary(saved.bestiary);
    for (const [id, when] of Object.entries(saved.milestones || {})) if (milestoneById(id)) s.milestones[id] = when;
    s.milestonesNew = (Array.isArray(saved.milestonesNew) ? saved.milestonesNew : []).filter(id => s.milestones[id]);
    if (typeof saved.welcomed === "boolean") s.welcomed = saved.welcomed;
    checkMilestones(s); // anything already reached (older saves) is added and celebrated once
    s.profile = normalizeProfile(saved.profile);
    s.farm = normalizeFarm(saved.farm);
    if (saved.battle && saved.battle.monster) s.battle = normalizeBattle(saved.battle);
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

// The hero's total stats: base stats + equipped gear + Soul attributes, then Run Boons on top.
// Battles read their numbers from here.
function heroStats() { return heroStatsParts().total; }

// The same, plus how much of it came from the Bestiary bonus (for the Hero panel).
// Order: base + Soul attributes + gear, then the Bestiary bonus (% on top), then Run Boons.
function heroStatsParts() {
  const total = { ...HERO_BASE_STATS };
  for (const [k, v] of Object.entries(attributeStats())) total[k] += v;
  for (const slot of SLOTS) {
    const item = state.equipped[slot.id];
    if (!item) continue;
    for (const [k, v] of Object.entries(recipeById[item.id].stats)) total[k] += v;
  }
  const bonus = bestiaryBonus();
  const fromBestiary = {};
  for (const st of STATS) {
    const before = total[st.id];
    if (st.id === "luck") total.luck += bonus.luck;
    else total[st.id] = Math.round(total[st.id] * (1 + bonus.pct));
    fromBestiary[st.id] = total[st.id] - before;
  }
  for (const bn of BOONS) {
    const lvl = boonLevel(bn.id);
    if (!lvl) continue;
    if (bn.pct) total[bn.id] = Math.round(total[bn.id] * (1 + bn.pct * lvl));
    if (bn.flat) total[bn.id] += bn.flat * lvl;
  }
  return { total, fromBestiary };
}

// ---------- Mastery and boon rules ----------

function masteryLevel(elId) { return (state.mastery && state.mastery[elId]) || 0; }
function masteryCost(elId) { return Math.ceil(MASTERY.baseCost * Math.pow(MASTERY.growth, masteryLevel(elId))); }
// Mastery levels locked in for the current fight (older fights in a save have none).
function battleMastery(elId) {
  const b = state.battle;
  return (elId && b && b.mastery && b.mastery[elId]) || 0;
}
// Damage multiplier for your hits of this element in the current fight.
function masteryDamage(elId) { return 1 + MASTERY.damage * battleMastery(elId); }
// A status chance made stronger by the mastery of the status's element.
function masteryChance(chance, statusId) {
  return Math.min(1, chance * (1 + MASTERY.statusChance * battleMastery(STATUS_ELEMENT[statusId])));
}

function boonLevel(id) { return (state.boons && state.boons[id]) || 0; }
function boonMaxed(id) { return boonLevel(id) >= ORES.length; }
// What the next level of a boon costs: { ore, oreAmount, essence }.
function boonCost(id) {
  const n = Math.min(ORES.length, boonLevel(id) + 1);
  const ore = ORES[n - 1];
  return {
    ore,
    oreAmount: Math.ceil(BOON_COST.ore * ore.costMult),
    essence: Math.max(BOON_COST.essence, Math.ceil(BOON_COST.essence * Math.pow(1.2, 5 * n - 3))),
  };
}
function canBuyBoon(id) {
  if (boonMaxed(id)) return false;
  const c = boonCost(id);
  return state.ore[c.ore.id] >= c.oreAmount && state.drops[boonById[id].element] >= c.essence;
}

function statsText(stats) {
  return STATS.filter(st => stats[st.id]).map(st => `+${stats[st.id]}${st.id === "luck" ? "%" : ""} ${st.name.toLowerCase()}`).join(", ");
}

function bagCount(r) { return state.items[r.id] || 0; }

// The pixel picture of an item, in its ore's color (see gear-art.js). Falls back to the emoji.
function gearIcon(r) {
  return (typeof gearArtSVG === "function" && gearArtSVG(r.type, r.ore)) || r.icon;
}

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
  const sp = { uid: s.nextUid++, tier, creature, element };
  s.spawns.push(sp);
  markSeen(s, sp);
  return sp;
}

// A monster left the screen (beaten or caught). A new one takes its spot right away,
// unless an old save still has more than 3 waiting: then the spot just closes.
function replaceSpawn(uid) {
  const i = state.spawns.findIndex(x => x.uid === uid);
  if (i < 0) return;
  if (state.spawns.length > SPAWN.max) { state.spawns.splice(i, 1); return; }
  state.spawns.splice(i, 1);
  const sp = addSpawn(state);
  state.spawns.pop();
  state.spawns.splice(i, 0, sp);
}

// Keep 3 monsters waiting. A free spot is filled straight away (no timer).
function updateSpawns() {
  let added = 0;
  while (state.spawns.length < SPAWN.max) { addSpawn(state); added++; }
  return added;
}

// ---------- Bestiary ----------
// One entry per kind of creature (40 in all), by its art key, e.g. "rat" or "fire_ant".

function creatureKey(name) { return name.toLowerCase().replace(/ /g, "_"); }

// The art key of a waiting spawn ({ tier, creature }) or a monster (has .art or .name).
function bestiaryKeyOf(x) {
  if (x.art) return x.art;
  const t = TIERS[(x.tier || 1) - 1];
  const c = t && (typeof x.creature === "number" ? t.creatures[x.creature] : t.creatures.find(c => x.name && x.name.endsWith(c.name)));
  return c ? creatureKey(c.name) : null;
}

function bestiaryEntry(s, key) {
  if (!s.bestiary) s.bestiary = {};
  if (!s.bestiary[key]) s.bestiary[key] = { seen: true, caught: 0, el: {} };
  return s.bestiary[key];
}

function markSeen(s, x) {
  const key = bestiaryKeyOf(x);
  if (key) bestiaryEntry(s, key).seen = true;
}

function recordCatch(m) {
  const e = bestiaryEntry(state, bestiaryKeyOf(m));
  e.caught += 1;
  e.el[m.element] = (e.el[m.element] || 0) + 1;
  if (!e.first) e.first = Date.now();
  checkMilestones(state);
}

function normalizeBestiary(saved) {
  const out = {};
  const keys = new Set(TIERS.flatMap(t => t.creatures.map(c => creatureKey(c.name))));
  for (const [k, v] of Object.entries(saved || {})) {
    if (!keys.has(k) || !v) continue;
    const el = {};
    for (const [id, n] of Object.entries(v.el || {})) if (elementById[id] && n > 0) el[id] = Math.floor(n);
    out[k] = { seen: true, caught: Math.max(0, Math.floor(v.caught || 0)), el };
    if (v.first) out[k].first = v.first;
  }
  return out;
}

// Chance (0-1) that Catch works right now.
function catchChance(b = state.battle) {
  if (!b || b.monster.boss) return 0;
  const lost = 1 - b.monsterHp / b.monster.stats.hp;
  let c = CATCH.base + CATCH.fromHpLost * lost + CATCH.luckShare * (b.hero.luck || 0) / 100;
  if (hasEffect("monster", "frozen") || hasEffect("monster", "stun")) c += CATCH.helpless;
  return Math.max(0, Math.min(CATCH.max, c));
}

function canFight() { return !state.battle; }

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
// Play a sound effect (sound.js makes them). Does nothing if sound is off or not loaded.
function sfx(name, extra) {
  if (typeof window !== "undefined" && typeof window.peakSfx === "function") window.peakSfx(name, extra);
}

function earnCoins(n) {
  state.coins += n;
  state.runCoins += n;
}

function mine(oreId) {
  const ore = oreById[oreId];
  if (!state.unlocked[oreId]) return;
  state.ore[oreId] += clickAmount(ore);
  sfx("mine", ORES.indexOf(ore));
  // Only refresh the numbers that changed. The whole screen is redrawn 10 times a second
  // anyway, and redrawing it on every tap made fast tapping laggy on slower phones.
  const card = refs.ores[oreId];
  if (card) set(card, "amount", fmt(state.ore[oreId]));
  const chip = document.querySelector(`#ore-bar [data-ore="${oreId}"]`);
  if (chip) {
    set(chip, "n", fmt(state.ore[oreId]));
    set(chip, "s", fmtShort(state.ore[oreId]));
  }
}

function hireMiner(oreId) {
  const ore = oreById[oreId];
  const cost = minerCost(ore);
  if (state.coins < cost) return;
  state.coins -= cost;
  state.miners[oreId] += 1;
  sfx("buy");
  render();
}

function unlockOre(oreId) {
  const ore = oreById[oreId];
  const cost = unlockCost(ore);
  if (state.unlocked[oreId] || state.coins < cost) return;
  state.coins -= cost;
  state.unlocked[oreId] = true;
  sfx("unlock");
  log(`You opened a ${ore.name} mine!`);
  buildUI();
}

// How many of a recipe you can smith right now.
function smithLimit(r) { return Math.floor(state.ore[r.ore] / r.cost); }

function smith(recipeId, count) {
  const r = recipeById[recipeId];
  const canMake = smithLimit(r);
  const n = count === "max" ? canMake : Math.min(count, canMake);
  if (n <= 0) return;
  state.ore[r.ore] -= n * r.cost;
  state.items[r.id] += n;
  state.totalSmithed += n;
  sfx("forge");
  render();
}

// Selling only sells gear in your bag. Equipped gear is safe. Sold gear is gone for good.
function sell(recipeId) {
  const r = recipeById[recipeId];
  const n = bagCount(r);
  if (n <= 0) return 0;
  state.items[r.id] = 0;
  const coins = n * sellPrice(r);
  earnCoins(coins);
  sfx("sell");
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
  state.equipped[r.slot] = { id: r.id };
  sfx("equip");
  render();
}

function unequip(slotId) {
  const item = state.equipped[slotId];
  if (!item) return;
  state.items[item.id] += 1;
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
  sfx("buy");
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
//
// A round goes like this:
//   1. Your turn (phase "hero"): pick an action. Then your burn/poison hurt you and your effects count down.
//   2. The monster's turn (phase "monster"): it picks a move (monsterChooseMove), you get a moment to dodge
//      or parry (see REACTION), then the move lands (monsterResolve) and its own effects count down.
// The rules below never wait for anything; the screen adds the pauses and the dodge prompt.

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
    hero: { ...hero, weapon: state.equipped.weapon ? state.equipped.weapon.id : null },
    // Skills you brought, with their level, locked in like your stats.
    skills: state.skillSlots.map(id => id ? { id, level: skillLevel(id) } : null),
    mastery: { ...state.mastery }, // Element Mastery levels, locked in too
    effects: { hero: {}, monster: {} }, // status effects: id -> { turns, dmg, stacks }
    heroHp: hero.hp,
    monsterHp: m.stats.hp,
    mana: BATTLE.startMana,
    turn: 1,
    phase: "hero",     // whose turn it is: "hero" or "monster"
    pending: null,     // the monster's chosen move while you get the chance to react
    guarding: false,
    charging: false,   // the monster is winding up a heavy attack
    log: [`A wild ${m.name} appears!`, "When it attacks, Dodge or Parry buttons may pop up. Tap them fast!"],
    result: null,      // "win", "lose" or "fled" once it's over
  };
  // Quicker monsters strike first.
  if (m.stats.agility > hero.agility) {
    state.battle.log.push(`${m.name} is quicker and strikes first!`);
    state.battle.phase = "monster";
  }
  save();
  sfx("roar", !!m.boss);
  openBattle();
}

// Fill in anything an older save's battle is missing, so a fight in progress carries on.
function normalizeBattle(b) {
  if (!b.effects) {
    b.effects = { hero: {}, monster: {} };
    if (b.stunned) b.effects.monster.stun = { turns: 1 };
    if (b.weakTurns > 0) b.effects.monster.weaken = { turns: b.weakTurns };
  }
  delete b.stunned;
  delete b.weakTurns;
  if (b.hero) b.hero.element = null; // weapons have no element any more
  delete b.empower;  // weapon skills are gone
  delete b.riposte;
  if (b.phase !== "monster") b.phase = "hero";
  if (b.phase === "hero") b.pending = null;
  if (!b.pending) b.pending = null;
  return b;
}

function battleLog(msg) {
  const b = state.battle;
  b.log.push(msg);
  if (b.log.length > 80) b.log.shift();
}

// Little floating numbers and shakes for the battle screen. The screen reads and clears this list.
let battleFxQueue = [];
function battleFx(side, text, kind) { battleFxQueue.push({ side, text, kind }); }

function foeName(side) { return side === "hero" ? "You" : state.battle.monster.name; }
function hasEffect(side, id) { const e = state.battle.effects[side][id]; return !!(e && e.turns > 0); }

// Try to give `side` a status effect. srcDamage is the hit that caused it (burn and poison damage come from it).
function applyStatus(side, id, srcDamage = 0) {
  const b = state.battle;
  const st = STATUS[id];
  const fx = b.effects[side];
  const who = side === "hero" ? "You are" : `${b.monster.name} is`;
  if (st.skip && (hasEffect(side, "steady") || hasEffect(side, "frozen") || hasEffect(side, "stun"))) return false;
  // Monsters shrug off the effect of their own element: fire monsters don't burn, ice monsters don't freeze...
  if (side === "monster" && ELEMENT_STATUS[b.monster.element] === id) {
    battleLog(`${b.monster.name} is ${elementById[b.monster.element].name.toLowerCase()}-born and shrugs off ${st.name.toLowerCase()}.`);
    return false;
  }
  // Your Fire/Wind Mastery makes the burn/poison you cause hurt more.
  if (side === "monster") srcDamage *= 1 + MASTERY.dot * battleMastery(STATUS_ELEMENT[id]);
  if (id === "poison") {
    const cur = fx.poison && fx.poison.turns > 0 ? fx.poison : { stacks: 0, dmg: 0 };
    if (cur.stacks >= st.maxStacks) { cur.turns = st.turns; fx.poison = cur; return true; }
    cur.stacks += 1;
    cur.dmg += Math.max(1, Math.round(srcDamage * st.dot));
    cur.turns = st.turns;
    fx.poison = cur;
    battleLog(`☠️ ${who} poisoned${cur.stacks > 1 ? ` (×${cur.stacks})` : ""}!`);
  } else if (id === "burn") {
    const dmg = Math.max(1, Math.round(srcDamage * st.dot));
    fx.burn = { turns: st.turns, dmg: Math.max(dmg, fx.burn && fx.burn.turns > 0 ? fx.burn.dmg : 0) };
    battleLog(`🔥 ${who} burning!`);
  } else {
    fx[id] = { turns: st.turns };
    const words = { frozen: "frozen solid", stun: "stunned", shock: "shocked", weaken: "weakened" };
    battleLog(`${st.icon} ${who} ${words[id] || id}!`);
  }
  battleFx(side, `${st.icon} ${st.name}`, "status");
  return true;
}

// The monster's attack makes you bleed (see BLEED). Works even if you dodged or parried the hit.
function monsterBleeds(heavy) {
  const b = state.battle, m = b.monster;
  if (m.tier < BLEED.fromTier || b.heroHp <= 0) return;
  const n = m.boss ? (heavy ? BLEED.bossHeavyStacks : BLEED.bossStacks) : (Math.random() < BLEED.normalChance ? 1 : 0);
  if (!n) return;
  if (b.guarding) { battleLog("🩸 Your ice shell keeps the wound from opening."); return; }
  const fx = b.effects.hero;
  const cur = fx.bleed && fx.bleed.turns > 0 ? fx.bleed : { stacks: 0 };
  const before = cur.stacks;
  cur.stacks = Math.min(BLEED.maxStacks, cur.stacks + n);
  cur.turns = STATUS.bleed.turns;
  fx.bleed = cur;
  if (cur.stacks > before) {
    battleLog(`🩸 You are bleeding (×${cur.stacks})!`);
    battleFx("hero", `🩸 Bleed ×${cur.stacks}`, "status");
  }
}
// What one turn of bleed costs: a share of max HP per stack.
function bleedDamage(stacks, maxHp) { return Math.max(1, Math.round(maxHp * BLEED.perStack * stacks)); }

// End of `side`'s turn: burn, poison and bleed hurt, then every effect counts down by one.
function endOfTurnEffects(side) {
  const b = state.battle;
  const fx = b.effects[side];
  for (const id of ["burn", "poison"]) {
    const e = fx[id];
    if (!e || e.turns <= 0) continue;
    if (side === "hero") b.heroHp = Math.max(0, b.heroHp - e.dmg);
    else b.monsterHp = Math.max(0, b.monsterHp - e.dmg);
    battleLog(`${STATUS[id].icon} ${side === "hero" ? "You take" : `${b.monster.name} takes`} ${e.dmg} ${id} damage.`);
    battleFx(side, `-${e.dmg}`, id);
  }
  const bl = fx.bleed;
  if (bl && bl.turns > 0 && bl.stacks > 0) {
    const maxHp = side === "hero" ? b.hero.hp : b.monster.stats.hp;
    const dmg = bleedDamage(bl.stacks, maxHp);
    if (side === "hero") b.heroHp = Math.max(0, b.heroHp - dmg);
    else b.monsterHp = Math.max(0, b.monsterHp - dmg);
    battleLog(`🩸 ${side === "hero" ? "You bleed" : `${b.monster.name} bleeds`} for ${dmg} (×${bl.stacks}).`);
    battleFx(side, `-${dmg}`, "bleed");
  }
  for (const [id, e] of Object.entries(fx)) {
    e.turns -= 1;
    if (e.turns <= 0) delete fx[id];
  }
}

// Is `side` frozen or stunned at the start of its turn? Uses up the effect and makes it steady.
function skipsTurn(side) {
  const fx = state.battle.effects[side];
  const id = hasEffect(side, "frozen") ? "frozen" : hasEffect(side, "stun") ? "stun" : null;
  if (!id) return null;
  fx.steady = { turns: STATUS.steady.turns };
  return id;
}

function damageMult(side) { return hasEffect(side, "weaken") ? STATUS.weaken.mult : 1; }

function hitText(hit) {
  let msg = "";
  if (hit.crit) msg += " Critical hit!";
  if (hit.mult > 1) msg += " It's weak to that!";
  if (hit.mult < 1) msg += " It resists that.";
  return msg;
}

// A normal sword attack from you (no element). extra scales the damage (used by parry counters).
function heroAttack(extra = 1, label = "You hit") {
  const b = state.battle;
  const m = b.monster;
  const hit = rollHit({
    attack: b.hero.attack, defense: m.stats.defense,
    attackEl: null, targetEl: m.element,
    critChance: b.hero.luck / 100,
    dodge: extra === 1 ? dodgeChance(m.stats.agility, b.hero.agility) : 0,
    extra: extra * damageMult("hero"),
  });
  if (hit.dodged) {
    battleLog(`You attack, but ${m.name} dodges!`);
    battleFx("monster", "Miss", "miss");
    return;
  }
  b.monsterHp = Math.max(0, b.monsterHp - hit.damage);
  battleLog(`${label} ${m.name} for ${hit.damage}.${hitText(hit)}`);
  battleFx("monster", `-${hit.damage}${hit.crit ? "!" : ""}`, hit.crit ? "crit" : "hit");
}

// Your turn. action: "attack", "catch", "flee", "skill0".."skill2", or "wait" (only while frozen or stunned).
// Returns true if the turn happened.
function battleAction(action) {
  const b = state.battle;
  if (!b || b.result || b.phase !== "hero") return false;
  const m = b.monster;
  const skip = hasEffect("hero", "frozen") || hasEffect("hero", "stun");

  if (action === "flee") {
    battleLog("You run away. No harm done.");
    endBattle("fled");
    return true;
  }
  if (skip) {
    if (action !== "wait") return false;
    const id = skipsTurn("hero");
    battleLog(id === "frozen" ? "🧊 You're frozen solid and can't move!" : "💫 You're stunned and can't move!");
  } else if (action === "attack" || action === "catch" || /^skill[0-9]$/.test(action)) {
    let sk = null, slot = null;
    if (action.startsWith("skill")) {
      slot = (b.skills || [])[Number(action.slice(5))];
      sk = slot && skillById[slot.id];
      if (!sk || b.mana < skillGrade(sk).mana) return false;
    }
    if (action === "catch" && m.boss) return false; // bosses can't be caught
    if (hasEffect("hero", "shock") && Math.random() < STATUS.shock.fail) {
      battleLog("⚡ You're shocked and your body won't move!");
      battleFx("hero", "⚡ Shocked", "status");
    } else if (action === "attack") {
      heroAttack();
    } else if (action === "catch") {
      const chance = catchChance(b);
      if (Math.random() < chance) {
        battleLog(`🪤 You throw your net... Gotcha! ${m.name} is caught!`);
        battleFx("monster", "Caught!", "status");
        endBattle("caught");
        return true;
      }
      battleLog(`🪤 You throw your net... ${m.name} breaks free! (${Math.round(chance * 100)}% chance)`);
      battleFx("monster", "Broke free", "miss");
    } else {
      b.mana -= skillGrade(sk).mana;
      castSkill(sk, slot.level, m);
    }
  } else {
    return false; // unknown action
  }

  if (b.monsterHp <= 0) { endBattle("win"); return true; }
  endOfTurnEffects("hero");
  if (b.heroHp <= 0) { endBattle("lose"); return true; }
  if (b.monsterHp <= 0) { endBattle("win"); return true; }
  b.phase = "monster";
  b.pending = null;
  save();
  return true;
}

// Use a skill. Mana is already paid. Skills never miss.
function castSkill(sk, level, m) {
  const b = state.battle;
  const e = elementById[sk.element];
  const lvl = skillLevelMult(level);
  battleLog(`You cast ${e.icon} ${sk.name}!`);
  sfx("magic");
  if (sk.guard) b.guarding = true;
  if (sk.power) {
    const attack = b.hero.attack * sk.power * lvl;
    for (let i = 0; i < (sk.hits || 1) && b.monsterHp > 0; i++) {
      const hit = rollHit({
        attack, defense: m.stats.defense,
        attackEl: sk.element, targetEl: m.element,
        critChance: b.hero.luck / 100 + (sk.critBonus || 0),
        dodge: 0,
        extra: damageMult("hero") * masteryDamage(sk.element) * skillBoost(sk),
      });
      b.monsterHp = Math.max(0, b.monsterHp - hit.damage);
      battleLog(`${sk.name} hits ${m.name} for ${hit.damage}.${hitText(hit)}`);
      battleFx("monster", `-${hit.damage}${hit.crit ? "!" : ""}`, hit.crit ? "crit" : "hit");
      if (sk.status && b.monsterHp > 0 && Math.random() < masteryChance(sk.chance, sk.status)) applyStatus("monster", sk.status, hit.damage);
    }
  }
  if (sk.heal) {
    const amount = Math.round(b.hero.hp * sk.heal * lvl * skillBoost(sk));
    const before = b.heroHp;
    b.heroHp = Math.min(b.hero.hp, b.heroHp + amount);
    battleLog(`You heal ${b.heroHp - before} HP.`);
    battleFx("hero", `+${b.heroHp - before}`, "heal");
  }
  if (sk.cleanse) {
    const bad = ["burn", "poison", "bleed", "frozen", "stun", "shock", "weaken"].filter(id => hasEffect("hero", id));
    for (const id of bad) delete b.effects.hero[id];
    if (bad.length) battleLog("The breeze washes away your status effects.");
  }
  if (b.monsterHp <= 0) return;
  if (sk.guard) battleLog("Ice forms around you. You are guarding this turn.");
  if (sk.interrupt && b.charging) {
    b.charging = false;
    battleLog(`${m.name}'s heavy attack is broken!`);
  }
}

// Start of the monster's turn: decide what it does. Stored in b.pending so a reload doesn't change it.
//   pending.kind: "skip" (frozen/stunned), "fail" (shocked), "warcry", or "attack" (needs a reaction)
function monsterChooseMove() {
  const b = state.battle;
  if (!b || b.result || b.phase !== "monster") return null;
  if (b.pending) return b.pending;
  const m = b.monster;
  let p;
  const skip = skipsTurn("monster");
  if (skip) {
    p = { kind: "skip", text: skip === "frozen" ? `🧊 ${m.name} is frozen solid and can't move!` : `💫 ${m.name} is stunned and can't move!` };
  } else if (hasEffect("monster", "shock") && Math.random() < STATUS.shock.fail) {
    p = { kind: "fail", text: `⚡ ${m.name} is shocked and can't move!` };
  } else if (b.charging) {
    p = { kind: "attack", heavy: true, name: "Heavy Attack", power: BATTLE.heavyMultiplier };
  } else if (m.boss && !hasEffect("hero", "weaken") && Math.random() < BATTLE.warCryChance) {
    p = { kind: "warcry", text: `📣 ${m.name} lets out a terrifying war cry!` };
  } else if (Math.random() < BATTLE.specialChance) {
    const mv = MONSTER_MOVES[m.element];
    p = { kind: "attack", name: mv.name, power: mv.power, status: mv.status, chance: mv.chance };
  } else {
    p = { kind: "attack", name: "Attack", power: 1 };
  }
  b.pending = p;
  save();
  return p;
}

// How long the dodge/parry window lasts (ms) for the pending attack.
function reactionWindow() {
  const b = state.battle;
  const h = Math.max(0, b.hero.agility), a = Math.max(0, b.monster.stats.agility);
  const share = h + a > 0 ? h / (h + a) : 0.5;
  let ms = REACTION.windowMin + (REACTION.windowMax - REACTION.windowMin) * share;
  if (b.pending && b.pending.heavy) ms *= REACTION.heavyWindow;
  if (b.monster.boss) ms *= REACTION.bossWindow;
  return Math.round(ms);
}

// The monster's move lands. reaction: "dodge", "parry", "early" (pressed too soon) or null (no press / too late).
function monsterResolve(reaction = null) {
  const b = state.battle;
  if (!b || b.result || b.phase !== "monster") return;
  const p = b.pending || monsterChooseMove();
  const m = b.monster;

  if (p.kind === "skip" || p.kind === "fail") {
    battleLog(p.text);
  } else if (p.kind === "warcry") {
    battleLog(p.text);
    if (b.guarding) battleLog("Your guard holds firm.");
    else applyStatus("hero", "weaken");
  } else {
    const heavy = !!p.heavy;
    b.charging = false;
    const what = heavy ? "unleashes a heavy attack" : p.name === "Attack" ? "attacks" : `uses ${p.name}`;
    if (reaction === "parry" && heavy) reaction = null; // heavy attacks can't be parried
    if (reaction === "dodge") {
      battleLog(`${m.name} ${what}, but you dodge it perfectly!`);
      battleFx("hero", "Dodged!", "miss");
    } else {
      const hit = rollHit({
        attack: m.stats.attack, defense: b.hero.defense,
        attackEl: m.element, targetEl: null, // armor has no element (yet)
        critChance: 0,
        dodge: reaction === "parry" ? 0 : dodgeChance(b.hero.agility, m.stats.agility),
        extra: p.power * (b.guarding ? BATTLE.guardMultiplier : 1) * damageMult("monster")
          * (reaction === "parry" ? REACTION.parryTaken : 1),
      });
      if (hit.dodged) {
        battleLog(`${m.name} ${what}, but you sidestep it!`);
        battleFx("hero", "Miss", "miss");
      } else {
        b.heroHp = Math.max(0, b.heroHp - hit.damage);
        const notes = [reaction === "parry" && "parried", b.guarding && "guarded", hasEffect("monster", "weaken") && "weakened"].filter(Boolean).join(", ");
        battleLog(`${m.name} ${what} for ${hit.damage}${notes ? ` (${notes})` : ""}.`);
        battleFx("hero", `-${hit.damage}`, "hit");
        if (b.heroHp > 0 && reaction !== "parry" && !b.guarding) {
          if (p.status && Math.random() < p.chance) applyStatus("hero", p.status, hit.damage);
          if (heavy && Math.random() < BATTLE.heavyStunChance) applyStatus("hero", "stun");
        }
      }
      if (reaction === "parry" && b.heroHp > 0) heroAttack(REACTION.parryCounter, "You parry and counter");
    }
    if (b.monsterHp > 0) monsterBleeds(heavy);
    // Every few turns the monster winds up a heavy attack for its next turn.
    if (!heavy && b.heroHp > 0 && b.turn % BATTLE.heavyEvery === BATTLE.heavyEvery - 1) {
      b.charging = true;
      battleLog(`⚠️ ${m.name} is winding up a heavy attack! Dodge it or break it with a skill.`);
    }
  }
  b.pending = null;

  if (b.heroHp <= 0) return endBattle("lose");
  if (b.monsterHp <= 0) return endBattle("win");
  endOfTurnEffects("monster");
  if (b.monsterHp <= 0) return endBattle("win");

  // New round.
  b.turn += 1;
  b.guarding = false;
  b.mana = Math.min(BATTLE.maxMana, b.mana + BATTLE.manaPerTurn);
  b.phase = "hero";
  save();
}

function endBattle(result) {
  const b = state.battle;
  const m = b.monster;
  b.result = result;
  b.pending = null;
  if (result === "caught") recordCatch(m);
  // A short wait so the last hit's sound plays first.
  const endSound = { win: "win", caught: "catch", lose: "lose" }[result];
  if (endSound && typeof setTimeout !== "undefined") setTimeout(() => sfx(endSound), 350);
  if (result === "win" || result === "caught") {
    state.drops[m.element] += m.reward.drops;
    earnCoins(m.reward.coins);
    const e = elementById[m.element];
    battleLog(`${result === "caught" ? "It joins your Bestiary!" : "You win!"} You get ${m.reward.drops} ${e.icon} ${e.drop} and ${fmt(m.reward.coins)} 🪙.`);
    if (m.boss) {
      // The milestone: move up a tier. Monsters already waiting stay as they are.
      if (m.tier === currentTier() && !peakCleared()) {
        state.bossesBeaten += 1;
        state.tierWins = 0;
        b.tierUp = currentTier(); // shown in the victory window
        if (peakCleared()) battleLog(`You conquered the ${TIERS[TIERS.length - 1].name}! Reincarnate in the Souls panel for a big Souls reward.`);
        else {
          const t = TIERS[currentTier() - 1];
          battleLog(`Danger level ${currentTier()}: ${t.icon} ${t.name}! Stronger monsters will appear, and a new boss awaits.`);
        }
      }
    } else {
      replaceSpawn(m.uid);
      if (m.tier === currentTier()) state.tierWins += 1;
    }
  } else if (result === "lose") {
    battleLog(`${m.name} knocks you out. You wake up back at camp, nothing lost.`);
  }
  save();
  if (typeof document !== "undefined") {
    buildAdventure();
    render();
  }
}

function closeBattle() {
  if (state.battle && !state.battle.result) return; // finish or run away first
  state.battle = null;
  save();
  hideBattleScreen();
  render();
}

function buyPickaxe() {
  const cost = pickaxeCost();
  if (state.coins < cost) return;
  state.coins -= cost;
  state.pickaxe += 1;
  sfx("buy");
  render();
}

function buyAnvil() {
  const cost = anvilCost();
  if (state.coins < cost) return;
  state.coins -= cost;
  state.anvil += 1;
  sfx("buy");
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
  sfx("buy");
  save();
  render();
}

// Level up an element's mastery with its essence. Permanent.
function buyMastery(elId) {
  const cost = masteryCost(elId);
  if (masteryLevel(elId) >= MASTERY.max || state.drops[elId] < cost) return;
  state.drops[elId] -= cost;
  state.mastery[elId] = masteryLevel(elId) + 1;
  sfx("buy");
  log(`${elementById[elId].icon} ${elementById[elId].name} Mastery is now level ${state.mastery[elId]}.`);
  save();
  render();
}

// Level up a Run Boon with ore and essence. Lasts until you reincarnate.
function buyBoon(id) {
  if (!canBuyBoon(id)) return;
  const c = boonCost(id);
  state.ore[c.ore.id] -= c.oreAmount;
  state.drops[boonById[id].element] -= c.essence;
  state.boons[id] = boonLevel(id) + 1;
  sfx("buy");
  log(`${boonById[id].name} is now level ${state.boons[id]} for this run.`);
  save();
  render();
}

// Start a new run. Keeps skills, skill slots, Souls, attributes, Element Mastery, your look and lifetime counters.
function reincarnate() {
  if (state.battle) return; // finish the fight first
  const gained = soulsPreview().total;
  // Learned skills stay learned but go back to level 1 (the essence spent on levels is not refunded).
  const skills = {};
  for (const [id, lvl] of Object.entries(state.skills)) skills[id] = lvl > 0 ? 1 : 0;
  const keep = {
    skills,
    skillSlots: state.skillSlots,
    attributes: state.attributes,
    mastery: state.mastery,
    souls: state.souls + gained,
    totalSouls: state.totalSouls + gained,
    reincarnations: state.reincarnations + 1,
    totalSmithed: state.totalSmithed,
    profile: state.profile,
    bestiary: state.bestiary, // your collection stays
    milestones: state.milestones, // and so do its milestones and their bonus
    milestonesNew: state.milestonesNew,
    welcomed: state.welcomed,
    farm: state.farm, // the Monster Farm and the essence waiting in it
  };
  state = Object.assign(freshState(), keep);
  sfx("souls");
  forgeOre = "copper";
  save();
  renderBattle();
  buildUI();
  log(`You are reborn! +${fmt(gained)} 👻 Souls. Spend them on attributes.`);
}

// ---------- UI ----------

function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx"];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + units[i];
}
function fmtRate(n) { return n < 10 ? n.toFixed(2).replace(/\.?0+$/, "") : fmt(n); }

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = emo(html.trim());
  return t.content.firstChild;
}

let logTimer;
function log(msg) {
  const box = document.getElementById("log");
  box.innerHTML = emo(escapeHtml(msg));
  box.dataset.msg = msg;
  clearTimeout(logTimer);
  logTimer = setTimeout(() => { box.textContent = ""; box.dataset.msg = ""; }, 6000);
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
    const b = el(`<button class="tab${o.id === forgeOre ? " active" : ""}">${oreIcon(o)} ${o.name}</button>`);
    b.onclick = () => { forgeOre = o.id; buildForge(); render(); };
    tabs.appendChild(b);
  }
  const ore = oreById[forgeOre];
  const sellAllBtn = el(`<button class="tab sell-all">Sell all ${ore.name.toLowerCase()} gear</button>`);
  sellAllBtn.onclick = () => sellAllOf(forgeOre);
  tabs.appendChild(sellAllBtn);
  refs.sellAll = sellAllBtn;

  // One card per item: picture with Equip under it on the left; name, stats, price and the
  // Smith 1 / Smith max / Sell all buttons on the right.
  const coin = (typeof pxIcon === "function" && pxIcon("coin")) || "🪙";
  const box = document.getElementById("recipes");
  box.innerHTML = "";
  for (const r of RECIPES) {
    if (r.ore !== forgeOre) continue;
    const card = el(`
      <div class="card item-row">
        <div class="item-side">
          <div class="item-icon" aria-hidden="true">${gearIcon(r)}</div>
          <button data-k="equip" class="equip-btn">Equip</button>
        </div>
        <div class="item-main">
          <div class="row">
            <span class="name">${r.name} <span class="tag" data-k="worn" hidden>Worn</span></span>
            <span class="small" title="How many you have in your bag">Bag <b class="num bag-num" data-k="owned"></b></span>
          </div>
          <div class="stats-line">${statsText(r.stats)}</div>
          <div class="small item-cost">
            <span title="Ore needed to smith one">${oreIcon(ore)} ${fmt(r.cost)}</span>
            <span title="Coins when you sell one"><span class="item-coin">${coin}</span> <span data-k="price"></span></span>
          </div>
          <div class="buttons item-actions">
            <button data-k="make1">Smith 1</button>
            <button data-k="makeMax">Smith max</button>
            <button data-k="sell" class="primary">Sell all</button>
          </div>
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

  // Equipment: one framed square per slot, laid out around the body like a paper doll.
  // Tap a square to pick what to wear there from your bag (or to take it off).
  const slotsBox = document.getElementById("hero-slots");
  slotsBox.innerHTML = "";
  slotsBox.className = "eq-grid";
  refs.slots = {};
  for (const slot of SLOTS) {
    const type = GEAR_TYPES.find(t => t.slot === slot.id);
    const btn = el(`
      <button type="button" class="eq-slot eq-${slot.id}" data-slot="${slot.id}">
        <span class="eq-frame"><span class="eq-art" data-k="art"></span></span>
        <span class="eq-label" data-k="label"></span>
      </button>`);
    btn.dataset.empty = gearArtEmpty(type);
    btn.onclick = () => openGearPicker(slot.id);
    refs.slots[slot.id] = btn;
    slotsBox.appendChild(btn);
  }
  refs.slotsShown = {};
}

// A grey picture of the gear type, shown faintly in an empty slot.
function gearArtEmpty(type) {
  return (typeof gearArtSVG === "function" && gearArtSVG(type.id, "")) || type.icon;
}

function renderEquipSlots() {
  for (const slot of SLOTS) {
    const btn = refs.slots[slot.id];
    const item = state.equipped[slot.id];
    const r = item && recipeById[item.id];
    const type = GEAR_TYPES.find(t => t.slot === slot.id);
    const have = RECIPES.some(x => x.slot === slot.id && bagCount(x) > 0);
    const key = `${r ? r.id : ""}|${have}`;
    if (refs.slotsShown[slot.id] === key) continue; // only redraw when something changed
    refs.slotsShown[slot.id] = key;
    btn.classList.toggle("empty", !r);
    btn.classList.toggle("can-equip", !r && have);
    btn.querySelector('[data-k="art"]').innerHTML = r ? gearIcon(r) : btn.dataset.empty;
    set(btn, "label", r ? oreById[r.ore].name : type.name);
    btn.title = r ? `${r.name}: ${statsText(r.stats)}. Tap to change.`
      : have ? `${type.name}: empty. Tap to pick one from your bag.` : `${type.name}: empty. Smith one in the Forge.`;
    btn.setAttribute("aria-label", r ? `${slot.name}: ${r.name}` : `${slot.name}: empty`);
  }
  if (gearPickerSlot) renderGearPicker();
}

// ---------- Gear picker: choose what to wear in one slot ----------

let gearPickerSlot = null;
let gearPickerShown = "";

function openGearPicker(slotId) {
  gearPickerSlot = slotId;
  gearPickerShown = "";
  document.getElementById("gear-picker").hidden = false;
  document.body.classList.add("in-editor");
  renderGearPicker();
}

function closeGearPicker() {
  gearPickerSlot = null;
  const box = document.getElementById("gear-picker");
  box.hidden = true;
  box.innerHTML = "";
  document.body.classList.remove("in-editor");
}

function renderGearPicker() {
  const slotId = gearPickerSlot;
  const box = document.getElementById("gear-picker");
  const type = GEAR_TYPES.find(t => t.slot === slotId);
  const worn = state.equipped[slotId] && recipeById[state.equipped[slotId].id];
  // Strongest ore first.
  const choices = RECIPES.filter(r => r.slot === slotId && bagCount(r) > 0).reverse();
  const key = `${slotId}|${worn ? worn.id : ""}|${choices.map(r => r.id + ":" + bagCount(r)).join(",")}`;
  if (key === gearPickerShown) return; // nothing changed
  gearPickerShown = key;

  const plural = type.name.toLowerCase() + (type.id === "gloves" || type.id === "boots" ? "" : "s");
  const row = (r, worn) => `
    <div class="gp-item${worn ? " worn" : ""}">
      <span class="gp-icon">${gearIcon(r)}</span>
      <span class="gp-text">
        <span class="gp-name">${r.name}${worn ? ` <span class="tag">Worn</span>` : ` <span class="small">×${fmt(bagCount(r))}</span>`}</span>
        <span class="stats-line">${statsText(r.stats)}</span>
      </span>
      ${worn ? `<button type="button" data-unequip>Unequip</button>` : `<button type="button" class="primary" data-equip="${r.id}">Equip</button>`}
    </div>`;
  box.innerHTML = emo(`
    <div class="av-card gp-card" role="dialog" aria-modal="true" aria-label="Choose ${type.name.toLowerCase()}">
      <div class="gp-head">
        <h3>${type.name}</h3>
        <button type="button" class="gp-close" data-close aria-label="Close">✕</button>
      </div>
      ${worn ? row(worn, true) : ""}
      <div class="small gp-sub">${choices.length ? "In your bag:" : ""}</div>
      <div class="gp-list">
        ${choices.map(r => row(r, false)).join("") ||
          `<div class="gp-none">You have no ${plural} in your bag.<br>Smith one in the Forge first.
            <div class="buttons"><button type="button" data-go="forge" data-close>Go to the Forge</button></div></div>`}
      </div>
    </div>`);
  box.querySelectorAll("[data-equip]").forEach(b => { b.onclick = () => { equip(b.dataset.equip); closeGearPicker(); }; });
  const un = box.querySelector("[data-unequip]");
  if (un) un.onclick = () => { unequip(slotId); closeGearPicker(); };
  box.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeGearPicker));
}

if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    const box = document.getElementById("gear-picker");
    if (box && !box.hidden && e.target === box) closeGearPicker(); // tap outside the card
  });
  document.addEventListener("keydown", e => {
    const box = document.getElementById("gear-picker");
    if (e.key === "Escape" && box && !box.hidden) closeGearPicker();
  });
}

function elementTag(elementId) {
  if (!elementId) return `<span class="el el-none">Neutral</span>`;
  const e = elementById[elementId];
  return `<span class="el el-${e.id}">${e.icon} ${e.name}</span>`;
}


// The reward for beating a monster, as one line of text.
function rewardText(m) {
  const e = elementById[m.element];
  return `${m.reward.drops} ${e.icon} ${e.drop} + ${fmt(m.reward.coins)} 🪙`;
}

// "Weak ⚡ Lightning · Resists ❄️ Ice" and the monster's stats, kept short so cards stay small.
function weakLine(m) {
  const weak = elementById[weaknessOf(m.element)], strong = elementById[strengthOf(m.element)];
  return `<div class="small mon-line"><span title="Weak to ${weak.name}: your ${weak.name} skills do extra damage">Weak ${weak.icon} ${weak.name}</span>
    <span title="Resists ${strong.name}: your ${strong.name} skills do less damage">Resists ${strong.icon} ${strong.name}</span></div>`;
}
function statsLine(m) {
  return `<div class="small mon-line"><span title="HP">❤️ ${fmt(m.stats.hp)}</span><span title="Attack">⚔️ ${fmt(m.stats.attack)}</span>
    <span title="Defense">🛡️ ${fmt(m.stats.defense)}</span><span title="Agility">💨 ${fmt(m.stats.agility)}</span></div>`;
}

// A little treasure chest. Tap it (or hover on a computer) to see what a monster gives when you win.
function chestButton(m) {
  return `<button class="chest-btn" data-k="chest" title="Win: ${rewardText(m)}" aria-label="Show rewards">${chestSVG()}</button>`;
}

// One monster card for the Adventure panel: a big picture on the left, the details on the right.
function monsterCard(m) {
  const lower = m.tier < currentTier();
  const card = el(`
    <div class="card monster mon-card">
      <div class="mon-pic mon-bg-${m.element}" data-info="mon:${m.uid}">${monsterArtHTML(m)}<span class="info-dot" aria-hidden="true">i</span>${caughtOrb(m)}</div>
      <div class="mon-body">
        <div class="mon-name"><span class="name" data-info="mon:${m.uid}">${m.name}</span>
          <span class="tag${lower ? " tier-low" : ""}" title="Danger level of this monster">Lv ${m.tier}</span></div>
        <div class="mon-tags">${elementTag(m.element)}${chestButton(m)}</div>
        <div class="mon-reward" data-k="reward" hidden>🎁 Win: ${rewardText(m)}</div>
        ${weakLine(m)}
        ${statsLine(m)}
        <div class="buttons"><button data-k="fight" class="primary">Fight</button></div>
      </div>
    </div>`);
  card.dataset.uid = m.uid;
  wireMonsterCard(card, m);
  return card;
}

// Has this exact monster (kind and color) been caught before?
function caughtBefore(m) {
  const e = state.bestiary[bestiaryKeyOf(m)];
  return !!(e && e.el && e.el[m.element] > 0);
}
// The little catch cage in the bottom-left corner of a monster's picture: bright once caught, a dim shadow until then.
function caughtOrb(m) {
  const got = caughtBefore(m);
  return `<span class="caught-orb${got ? " got" : ""}" data-k="orb" title="${got ? "Already in your Bestiary" : "Not caught yet in this color"}">${pxIcon("cage")}</span>`;
}

function wireMonsterCard(card, m) {
  card.querySelector('[data-k="fight"]').onclick = () => startBattle(m.uid);
  const chest = card.querySelector('[data-k="chest"]');
  const reward = card.querySelector('[data-k="reward"]');
  chest.onclick = () => {
    reward.hidden = !reward.hidden;
    chest.classList.toggle("open", !reward.hidden);
  };
}

// Sparks that float up around a boss, in its element's color.
function bossParticles(n) {
  return Array.from({ length: n }, (_, i) =>
    `<i style="--x:${Math.round(6 + (i * 37) % 88)}%;--d:${(i * 0.53) % 3.2}s;--s:${2.6 + (i % 4) * 0.5}s"></i>`).join("");
}

// The boss gets the whole width of the panel: big animated picture, name, description and backstory.
function bossShowcase(m) {
  const info = BOSS_ART[m.art] || {};
  const next = TIERS[m.tier];
  const card = el(`
    <div class="boss-show mon-bg-${m.element}">
      <div class="boss-top"><span class="tag boss-tag">Boss</span><span class="tag">Lv ${m.tier}</span>${elementTag(m.element)}</div>
      <div class="boss-stage" data-info="boss:${m.tier}">
        <div class="boss-aura"></div>
        <div class="boss-sparks">${bossParticles(14)}</div>
        ${monsterArtHTML(m)}
        <span class="info-dot" aria-hidden="true">i</span>
      </div>
      <div class="boss-name" data-info="boss:${m.tier}">${m.name}</div>
      ${info.title ? `<div class="boss-title">${info.title}</div>` : ""}
      ${info.desc ? `<div class="boss-desc">${info.desc}</div>` : ""}
      ${info.story ? `<div class="boss-story">${info.story}</div>` : ""}
      <div class="boss-facts">
        ${weakLine(m)}
        ${statsLine(m)}
      </div>
      <div class="mon-tags boss-loot">${chestButton(m)}<span class="small">Tap the chest to see the rewards</span></div>
      <div class="mon-reward" data-k="reward" hidden>🎁 Win: ${rewardText(m)}${next ? ` + opens ${next.icon} ${next.name}` : ""}</div>
      <button data-k="fight" class="primary big wide boss-fight">⚔️ Fight the boss</button>
    </div>`);
  wireMonsterCard(card, m);
  return card;
}

// After the last boss: it stays on show, beaten.
function bossConquered() {
  const last = TIERS[TIERS.length - 1];
  const m = bossMonster(TIERS.length);
  return el(`
    <div class="boss-show beaten mon-bg-${m.element}">
      <div class="boss-stage" data-info="boss:${m.tier}"><div class="boss-aura"></div>${monsterArtHTML(m)}<div class="boss-trophy">🏆</div></div>
      <div class="boss-name">${m.name} is defeated</div>
      <div class="boss-desc">The ${last.icon} ${last.name} is yours! Reincarnate in the Souls panel for a big Souls reward and climb again.</div>
    </div>`);
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
    const chip = el(`<div class="drop el-${e.id}" title="${e.drop}: dropped by ${e.name} monsters">${e.icon} <span class="num" data-k="n"></span></div>`);
    refs.drops[e.id] = chip;
    dropsBox.appendChild(chip);
  }

  const box = document.getElementById("areas");
  box.innerHTML = "";
  const tier = TIERS[currentTier() - 1];
  // The current zone, with its own pixel landscape faintly behind it (zone-art.js).
  box.appendChild(el(`<div class="danger-level zone-${currentTier()}">
    <div class="zone-bg">${zoneArtSVG(currentTier())}</div>
    <div class="dl-level"><span class="dl-small">Danger level</span><span class="dl-big">${currentTier()}</span><span class="dl-small">of ${TIERS.length}</span></div>
    <div class="dl-zone">
      <div class="dl-name">${tier.name}</div>
      <div class="small">${peakCleared() ? "You conquered every boss. Reincarnate for Souls and climb again!" : "Beat the boss below to raise the danger level."}</div>
    </div>
  </div>`));

  box.appendChild(el(`<h3 class="spawn-head"><span>Monsters</span></h3>`));
  for (const sp of state.spawns) {
    const card = monsterCard(spawnMonster(sp));
    refs.monsters.push(card);
    box.appendChild(card);
  }

  box.appendChild(el(`<h3>Boss</h3>`));
  if (peakCleared()) {
    box.appendChild(bossConquered());
  } else {
    const card = bossShowcase(bossMonster(currentTier()));
    refs.monsters.push(card);
    box.appendChild(card);
  }
}

function renderAdventure() {
  if (refs.adventureKey !== adventureKey()) buildAdventure();
  for (const e of ELEMENTS) set(refs.drops[e.id], "n", fmtShort(state.drops[e.id]));
  renderBestiaryButton();
  const spawnByUid = Object.fromEntries(state.spawns.map(sp => [sp.uid, sp]));
  for (const card of refs.monsters) {
    const orb = card.querySelector('[data-k="orb"]');
    const sp = orb && spawnByUid[card.dataset.uid];
    if (sp) {
      const got = caughtBefore(spawnMonster(sp));
      if (orb.classList.contains("got") !== got) {
        orb.classList.toggle("got", got);
        orb.title = got ? "Already in your Bestiary" : "Not caught yet in this color";
      }
    }
    const btn = card.querySelector('[data-k="fight"]');
    const label = state.battle ? "In a fight" : card.classList.contains("boss-show") ? "⚔️ Fight the boss" : "Fight";
    setIconText(btn, label);
    btn.disabled = !canFight();
  }
}

// ---------- Bestiary milestones ----------
// All 62 milestones (see BESTIARY_REWARDS), in the order they're listed:
// per danger level: "row:3" (all 4 kinds), "rainbow:hound" (one kind in 5 colors), "tierall:3" (all 4 in 5 colors),
// then "kinds" (all 40 kinds) and "complete" (all 200).
var milestoneCache = null; // "var", not "let": load() needs it before this line runs
function milestoneList() {
  if (milestoneCache) return milestoneCache;
  const list = [];
  TIERS.forEach((t, ti) => {
    const tier = ti + 1;
    const keys = t.creatures.map(c => creatureKey(c.name));
    list.push({ id: `row:${tier}`, kind: "row", tier, keys });
    t.creatures.forEach(c => list.push({ id: `rainbow:${creatureKey(c.name)}`, kind: "rainbow", tier, keys: [creatureKey(c.name)], name: c.name }));
    list.push({ id: `tierall:${tier}`, kind: "tierAll", tier, keys });
  });
  const all = list.filter(m => m.kind === "rainbow").map(m => m.keys[0]);
  list.push({ id: "kinds", kind: "kinds", keys: all });
  list.push({ id: "complete", kind: "complete", keys: all });
  milestoneCache = list;
  return list;
}
function milestoneById(id) { return milestoneList().find(m => m.id === id); }

// Caught at least once (any color), and caught in every one of the 5 colors.
function caughtAny(bestiary, key) { return ((bestiary && bestiary[key]) || {}).caught > 0; }
function caughtAllColors(bestiary, key) {
  const e = bestiary && bestiary[key];
  return !!e && ELEMENTS.every(el => (e.el || {})[el.id] > 0);
}
function milestoneReached(bestiary, m) {
  const anyColor = m.kind === "row" || m.kind === "kinds";
  return m.keys.every(k => anyColor ? caughtAny(bestiary, k) : caughtAllColors(bestiary, k));
}

// Add every milestone that's been reached but isn't recorded yet. New ones wait in milestonesNew
// for the Congratulations window. Returns how many were added.
function checkMilestones(s) {
  if (!s.milestones) s.milestones = {};
  if (!Array.isArray(s.milestonesNew)) s.milestonesNew = [];
  let added = 0;
  for (const m of milestoneList()) {
    if (s.milestones[m.id] || !milestoneReached(s.bestiary, m)) continue;
    s.milestones[m.id] = Date.now();
    s.milestonesNew.push(m.id);
    added++;
  }
  return added;
}

// The total bonus from all milestones reached: { pct, luck, count }.
function bestiaryBonus(s = state) {
  const out = { pct: 0, luck: 0, count: 0 };
  for (const id of Object.keys((s && s.milestones) || {})) {
    const m = milestoneById(id);
    if (!m) continue;
    const r = BESTIARY_REWARDS[m.kind];
    out.pct += r.pct; out.luck += r.luck; out.count++;
  }
  out.pct = Math.round(out.pct * 10000) / 10000; // no 0.30000000000000004
  return out;
}

// "+1.25%" without trailing zeros.
function pctText(p) { return `+${+(p * 100).toFixed(2)}%`; }
function bonusText(r) {
  const parts = [];
  if (r.pct) parts.push(`${pctText(r.pct)} HP, Attack, Defense and Agility`);
  if (r.luck) parts.push(`+${r.luck}% Luck`);
  return parts.join(" and ");
}

// What a milestone is called, and a sentence about it.
function milestoneText(m) {
  const t = m.tier && TIERS[m.tier - 1];
  if (m.kind === "row") return { title: `Level ${m.tier} Collected!`, short: `Level ${m.tier}: every kind`,
    msg: `You caught every monster of <b>${t.name}</b>, one of each kind.` };
  if (m.kind === "rainbow") return { title: "All 5 Colors!", short: `${m.name} in all 5 colors`,
    msg: `You caught a <b>${m.name}</b> in every color: Fire, Ice, Wind, Earth and Lightning.` };
  if (m.kind === "tierAll") return { title: `Level ${m.tier} Mastered!`, short: `Level ${m.tier}: all 5 colors`,
    msg: `You caught all 4 monsters of <b>${t.name}</b> in all 5 colors.` };
  if (m.kind === "kinds") return { title: "Every Kind Caught!", short: "All 40 kinds",
    msg: `All <b>40</b> kinds of monster are in your Bestiary.` };
  return { title: "Bestiary Complete!", short: "Bestiary complete",
    msg: `Every monster in every color, all <b>200</b>. You are a true monster master!` };
}

// Bestiary bonus line in the Hero panel.
function renderBestiaryBonus() {
  const box = document.getElementById("bestiary-bonus");
  if (!box) return;
  const b = bestiaryBonus();
  setIconHTML(box, b.count
    ? `📖 <b>Bestiary bonus:</b> ${bonusText(b)} <span class="num">(${b.count}/${milestoneList().length} milestones)</span>`
    : `📖 <b>Bestiary bonus:</b> none yet. Catch monsters in Adventure to earn small permanent stat bonuses.`);
}

// ---------- Congratulations window (Bestiary milestones) ----------
// Opens by itself once nothing else is on screen (not during a fight). Several milestones reached
// at once (or by an older save) are shown together in one window.

// Most special first: the biggest one is the headline.
const MILESTONE_RANK = { complete: 0, kinds: 1, tierAll: 2, row: 3, rainbow: 4 };

function congratsArt(m) {
  if (m.kind === "kinds" || m.kind === "complete") return `<div class="cg-trophy">${emo("🏆")}</div>`;
  const list = bestiaryList();
  let mons;
  if (m.kind === "rainbow") {
    const c = list.find(x => x.key === m.keys[0]);
    mons = ELEMENTS.map(el => bestiaryMonster(c, el.id));
  } else {
    mons = m.keys.map((k, i) => {
      const c = list.find(x => x.key === k);
      return bestiaryMonster(c, m.kind === "tierAll" ? ELEMENTS[i % ELEMENTS.length].id : bestiaryElement(state.bestiary[k]));
    });
  }
  return `<div class="cg-mons">${mons.map(x => `<span class="cg-mon mon-bg-${x.element}">${monsterArtHTML(x)}</span>`).join("")}</div>`;
}

function openCongrats() {
  const box = document.getElementById("congrats");
  if (!box) return;
  const ms = state.milestonesNew.map(milestoneById).filter(Boolean)
    .sort((a, b) => MILESTONE_RANK[a.kind] - MILESTONE_RANK[b.kind]);
  if (!ms.length) { state.milestonesNew = []; return; }
  const top = ms[0];
  const text = milestoneText(top);
  const colors = ["#ffd34d", "#ff8a3a", "#7dffc4", "#7ac8ff", "#ff6bd0", "#ffffff"];
  const confetti = Array.from({ length: 30 }, (_, i) =>
    `<i style="--x:${(i * 29) % 100}%;--d:${((i * 0.37) % 2.4).toFixed(2)}s;--s:${(2.4 + (i % 5) * 0.45).toFixed(2)}s;--r:${(i * 47) % 360}deg;background:${colors[i % colors.length]}"></i>`).join("");
  const rows = ms.map(m => {
    const r = BESTIARY_REWARDS[m.kind];
    return `<div class="vic-row cg-row"><span>${milestoneText(m).short}</span><span class="cg-gain">${pctText(r.pct)}${r.luck ? `, +${r.luck}% Luck` : ""}</span></div>`;
  }).join("");
  const total = bestiaryBonus();
  box.innerHTML = emo(`
    <div class="vic-rays"></div>
    <div class="vic-confetti">${confetti}</div>
    <div class="vic-card cg-card" role="dialog" aria-modal="true" aria-labelledby="cg-title">
      <div class="vic-kicker">Congratulations!</div>
      <div class="vic-title cg-title" id="cg-title">${ms.length > 1 ? `${ms.length} Milestones!` : text.title}</div>
      ${congratsArt(top)}
      <div class="vic-msg">${ms.length > 1 ? `You filled in more of your Bestiary. ${text.msg}` : text.msg}</div>
      <div class="cg-label">Permanent bonus${ms.length > 1 ? "es" : ""}</div>
      <div class="vic-rewards cg-rows">${rows}</div>
      <div class="cg-total">📖 Your Bestiary bonus is now <b>${bonusText(total)}</b>. It stays forever, even when you reincarnate.</div>
      <button class="primary big wide" type="button" data-k="cgClose">Hooray!</button>
    </div>`);
  box.querySelector('[data-k="cgClose"]').onclick = closeCongrats;
  box.hidden = false;
  document.body.classList.add("in-editor");
  if (typeof sfx === "function") sfx("win");
}
function closeCongrats() {
  const box = document.getElementById("congrats");
  if (!box || box.hidden) return;
  box.hidden = true;
  box.innerHTML = "";
  document.body.classList.remove("in-editor");
  state.milestonesNew = [];
  save();
}

// Nothing else on screen: no fight, no other window, settings closed.
function screenIsFree() {
  const open = id => { const x = document.getElementById(id); return x && !x.hidden; };
  return !["battle", "avatar-editor", "gear-picker", "bestiary", "reset-confirm", "welcome", "congrats", "info-pop"].some(open);
}

// Called after every render: the Welcome window first (once), then any Congratulations waiting.
function showWaitingPopups() {
  if (!screenIsFree()) return;
  if (!state.welcomed) { if (typeof openWelcome === "function") openWelcome(); return; }
  if (state.milestonesNew && state.milestonesNew.length) openCongrats();
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", e => {
    const box = document.getElementById("congrats");
    if (e.key === "Escape" && box && !box.hidden) closeCongrats();
  });
}

// ---------- Bestiary window ----------
// Every kind of monster, grouped by danger level. Caught ones show in color, the rest as dark shapes.

// All 40 creatures in order: { key, tier, idx, name }.
function bestiaryList() {
  return TIERS.flatMap((t, ti) => t.creatures.map((c, idx) => ({ key: creatureKey(c.name), tier: ti + 1, idx, name: c.name })));
}

function bestiaryCounts() {
  const list = bestiaryList();
  const caught = list.filter(c => (state.bestiary[c.key] || {}).caught > 0).length;
  const total = list.reduce((n, c) => n + ((state.bestiary[c.key] || {}).caught || 0), 0);
  return { caught, kinds: list.length, total };
}

function renderBestiaryButton() {
  const btn = document.getElementById("bestiary-btn");
  if (!btn) return;
  const { caught, kinds } = bestiaryCounts();
  setIconText(btn, `📖 Bestiary ${caught}/${kinds}`);
}

// The element you caught most of this creature in (its picture uses that color).
function bestiaryElement(entry) {
  const els = Object.entries((entry && entry.el) || {}).sort((a, b) => b[1] - a[1]);
  return els.length ? els[0][0] : "earth";
}

// A creature as a monster, for its picture and info window.
function bestiaryMonster(c, element) {
  return spawnMonster({ uid: 0, tier: c.tier, creature: c.idx, element });
}

let bestiaryShown = "";
function openBestiary() {
  bestiaryShown = "";
  document.getElementById("bestiary").hidden = false;
  document.body.classList.add("in-editor");
  renderBestiary();
}
function closeBestiary() {
  const box = document.getElementById("bestiary");
  box.hidden = true;
  box.innerHTML = "";
  document.body.classList.remove("in-editor");
  if (typeof closeInfoPop === "function") closeInfoPop();
}

function renderBestiary() {
  const box = document.getElementById("bestiary");
  if (!box || box.hidden) return;
  const key = JSON.stringify(state.bestiary) + Object.keys(state.milestones).length;
  if (key === bestiaryShown) return;
  bestiaryShown = key;
  const { caught, kinds, total } = bestiaryCounts();
  const bonus = bestiaryBonus();
  const list = bestiaryList();
  const sections = TIERS.map((t, ti) => {
    const cards = list.filter(c => c.tier === ti + 1).map(c => {
      const e = state.bestiary[c.key];
      const got = e && e.caught > 0;
      const seen = e && e.seen;
      const m = bestiaryMonster(c, bestiaryElement(e));
      const dots = ELEMENTS.map(el => `<i class="bs-dot${e && e.el[el.id] ? ` on el-${el.id}` : ""}" title="${el.name}${e && e.el[el.id] ? `: ${e.el[el.id]} caught` : ": not caught yet"}"></i>`).join("");
      const rainbow = state.milestones[`rainbow:${c.key}`];
      return `
        <div class="bs-card${got ? " got" : " missing"}${rainbow ? " rainbow" : ""}" data-info="best:${c.key}"${rainbow ? ` title="Caught in all 5 colors"` : ""}>
          <div class="bs-pic${got ? ` mon-bg-${m.element}` : ""}">${monsterArtHTML(m)}</div>
          <div class="bs-name">${got || seen ? c.name : "???"}</div>
          <div class="bs-count small num">${got ? `×${fmt(e.caught)}` : seen ? "Seen" : "Not seen"}</div>
          <div class="bs-dots">${dots}</div>
        </div>`;
    }).join("");
    const here = ti + 1 <= currentTier();
    const badges = [
      state.milestones[`row:${ti + 1}`] ? `<span class="bs-badge" title="Every kind caught">🏆 All kinds</span>` : "",
      state.milestones[`tierall:${ti + 1}`] ? `<span class="bs-badge gold" title="Every kind caught in all 5 colors">👑 All colors</span>` : "",
    ].join("");
    return `<div class="bs-zone"><span class="tag">Lv ${ti + 1}</span> <span class="bs-zone-name">${here ? t.name : "???"}</span>${badges}</div><div class="bs-grid">${cards}</div>`;
  }).join("");
  box.innerHTML = emo(`
    <div class="av-card bs-card-box" role="dialog" aria-modal="true" aria-label="Bestiary">
      <div class="gp-head">
        <h3>📖 Bestiary</h3>
        <button type="button" class="gp-close" data-close aria-label="Close">✕</button>
      </div>
      <div class="bs-sum"><span><b class="num">${caught}</b> / ${kinds} kinds caught</span><span><b class="num">${fmt(total)}</b> caught in all</span></div>
      <div class="small">Use 🪤 Catch in a fight to add a monster. Each dot is a color (element) you've caught it in. Tap a monster to see more.</div>
      <details class="hint bs-rewards"><summary>📖 Rewards: <b class="num">${bonus.count}</b>/${milestoneList().length} milestones${bonus.count ? `, ${pctText(bonus.pct)} stats${bonus.luck ? `, +${bonus.luck}% luck` : ""}` : ""}</summary>
        <p>Each milestone gives a small bonus to HP, Attack, Defense and Agility that lasts forever:</p>
        <ul>
          <li>Catch all 4 kinds of one danger level (any color): <b>${pctText(BESTIARY_REWARDS.row.pct)}</b></li>
          <li>Catch one kind of monster in all 5 colors: <b>${pctText(BESTIARY_REWARDS.rainbow.pct)}</b></li>
          <li>Catch all 4 kinds of one danger level in all 5 colors: <b>${pctText(BESTIARY_REWARDS.tierAll.pct)}</b></li>
          <li>Catch all 40 kinds: <b>${pctText(BESTIARY_REWARDS.kinds.pct)}</b></li>
          <li>Complete the Bestiary (all 40 kinds in all 5 colors): <b>${bonusText(BESTIARY_REWARDS.complete)}</b></li>
        </ul>
      </details>
      ${sections}
    </div>`);
  box.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeBestiary));
}

// The info window for a Bestiary card ("best:<key>"). Uses the normal monster window once it's caught.
function bestiaryInfoHTML(key) {
  const c = bestiaryList().find(x => x.key === key);
  if (!c) return "";
  const e = state.bestiary[key];
  const t = TIERS[c.tier - 1];
  if (!e || !e.caught) {
    return `
      <div class="ip-head">
        <div class="ip-pic ip-mon bs-shadow">${monsterArtHTML(bestiaryMonster(c, "earth"))}</div>
        <div class="ip-title">
          <div class="ip-name">${e && e.seen ? c.name : "???"}</div>
          <div class="ip-tags"><span class="tag">Lv ${c.tier}</span></div>
          <div class="ip-dim">${c.tier <= currentTier() ? `${t.icon} ${t.name}` : "A place you haven't reached yet"}</div>
        </div>
      </div>
      <div class="ip-note">${e && e.seen ? "You've met it, but not caught it yet." : "You haven't met this monster yet."} Lower its HP, then use 🪤 Catch.</div>`;
  }
  const caughtIn = ELEMENTS.map(el => `${el.icon} ${el.name}: <b>${e.el[el.id] || 0}</b>`).join("<br>");
  return `${monsterInfoHTML(bestiaryMonster(c, bestiaryElement(e)), false)}
    <div class="ip-sub">🪤 Your catches: ${fmt(e.caught)}</div>
    <div class="ip-note ip-list">${caughtIn}</div>`;
}

if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    if (e.target.closest && e.target.closest("#bestiary-btn")) return openBestiary();
    const box = document.getElementById("bestiary");
    if (box && !box.hidden && e.target === box) closeBestiary(); // tap outside the card
  });
  document.addEventListener("keydown", e => {
    const box = document.getElementById("bestiary");
    if (e.key === "Escape" && box && !box.hidden) closeBestiary();
  });
}

function hpBar(now, max) {
  const pct = Math.max(0, Math.min(100, (now / max) * 100));
  return `<div class="hpbar"><div class="hpfill${pct < 30 ? " low" : pct < 60 ? " mid" : ""}" style="width:${pct}%"></div></div>
    <div class="small num bt-hpnum">${fmt(now)} / ${fmt(max)} HP</div>`;
}

// ---------- Battle screen ----------
// Fights take over the whole screen. The rules above decide what happens; this part adds the pauses,
// the dodge/parry prompt, floating numbers and shakes.

const battleUi = { busy: false, timers: [], reaction: null, built: null };

function battleScreen() { return document.getElementById("battle"); }
function battlePart(key) { return battleScreen().querySelector(`[data-k="${key}"]`); }
function later(ms, fn) { battleUi.timers.push(setTimeout(fn, ms)); }
function clearBattleTimers() {
  battleUi.timers.forEach(clearTimeout);
  battleUi.timers = [];
  battleUi.reaction = null;
  battleUi.busy = false;
}

function openBattle() {
  clearBattleTimers();
  battleScreen().hidden = false;
  document.body.classList.add("in-battle");
  buildBattleScreen();
  renderBattle();
  render();
  // A fight that was reloaded on the monster's turn carries on from there.
  const b = state.battle;
  if (b && !b.result && b.phase === "monster") {
    battleUi.busy = true;
    later(900, runMonsterTurn);
  }
}

// goAdventure: on phones, land on the Adventure panel afterwards.
function hideBattleScreen(goAdventure = true) {
  clearBattleTimers();
  battleUi.built = null;
  battleScreen().hidden = true;
  document.body.classList.remove("in-battle");
  if (goAdventure && typeof showView === "function") showView("adventure");
}

// The parts of the screen that stay put for the whole fight (sprites, layout).
function buildBattleScreen() {
  const b = state.battle;
  if (!b) return;
  const m = b.monster;
  const tier = TIERS[m.tier - 1];
  const weapon = b.hero.weapon && recipeById[b.hero.weapon];
  battleUi.built = b;
  battleScreen().innerHTML = emo(`
    <div class="bt-wrap bt-tier-${m.tier}">
      <div class="bt-top">
        <span>${tier.icon} ${tier.name} · Danger level ${m.tier}</span>
        <span class="num" data-k="turn"></span>
      </div>
      <div class="bt-arena">
        <div class="bt-info foe" data-k="foeInfo"></div>
        <div class="bt-spot foe${m.boss ? " boss" : ""} mon-bg-${m.element}">
          ${m.boss ? `<div class="boss-aura"></div><div class="boss-sparks">${bossParticles(12)}</div>` : ""}
          <div class="bt-sprite" data-k="foeSprite" data-info="foe">${monsterArtHTML(m)}</div>
          <div class="bt-pad"></div>
          <div class="bt-fx" data-k="foeFx"></div>
        </div>
        <div class="bt-spot you">
          <div class="bt-sprite bt-hero" data-k="youSprite">${avatarSVG(state.profile, "full", "", weapon)}</div>
          <div class="bt-pad"></div>
          <div class="bt-fx" data-k="youFx"></div>
        </div>
        <div class="bt-info you" data-k="youInfo"></div>
        <div class="bt-prompt" data-k="prompt" hidden></div>
      </div>
      <div class="bt-bottom">
        <div class="bt-log" data-k="log" aria-live="polite"></div>
        <div class="bt-menu" data-k="menu"></div>
      </div>
    </div>`);
}

// Small icons for status effects, with turns left (and stacks for poison).
function statusChips(side) {
  const fx = state.battle.effects[side];
  return Object.entries(fx).filter(([, e]) => e.turns > 0).map(([id, e]) => {
    const st = STATUS[id];
    const extra = (id === "poison" || id === "bleed") && e.stacks > 1 ? `×${e.stacks} ` : "";
    const per = id === "bleed" ? bleedDamage(e.stacks, side === "hero" ? state.battle.hero.hp : state.battle.monster.stats.hp) : e.dmg;
    const dmg = per ? ` ${per} damage per turn.` : "";
    return `<span class="st st-${id}" title="${st.name}: ${st.desc}${dmg} ${e.turns} turn${e.turns > 1 ? "s" : ""} left.">${st.icon}<span class="num">${extra}${e.turns}</span></span>`;
  }).join("");
}

// Redraws the parts of the battle screen that change.
function renderBattle() {
  const b = state.battle;
  if (!b) { if (!battleScreen().hidden) hideBattleScreen(false); return; }
  if (battleUi.built !== b) buildBattleScreen();
  const m = b.monster;

  battlePart("turn").textContent = b.result ? "" : `Turn ${b.turn}`;

  battlePart("foeInfo").innerHTML = emo(`
    <div class="row"><span class="name" data-info="foe">${m.name}<span class="info-i inline" aria-hidden="true">i</span>${m.boss ? ` <span class="tag boss-tag">Boss</span>` : ""}<span class="tag">Lv ${m.tier}</span></span>${elementTag(m.element)}</div>
    ${hpBar(b.monsterHp, m.stats.hp)}
    <div class="bt-status">${statusChips("monster")}${b.charging && !b.result ? `<span class="st st-heavy" title="Its next attack is a heavy one. Dodge it, or break it with Gust or Earthquake.">⚠️ Heavy</span>` : ""}</div>`);

  const mana = Array.from({ length: BATTLE.maxMana }, (_, i) =>
    `<span class="pip${i < b.mana ? " full" : ""}"></span>`).join("");
  battlePart("youInfo").innerHTML = emo(`
    <div class="row"><span class="name">${avatarNameHTML(normalizeProfile(state.profile).name)}</span></div>
    ${hpBar(b.heroHp, b.hero.hp)}
    <div class="mana" title="Mana: used by skills. Start with ${BATTLE.startMana}, +${BATTLE.manaPerTurn} each turn, max ${BATTLE.maxMana}.">💧 ${mana}</div>
    <div class="bt-status">${statusChips("hero")}${b.guarding && !b.result ? `<span class="st st-guard" title="Ice shell: less damage and no status effects this turn">🛡️</span>` : ""}</div>`);

  const youSprite = battlePart("youSprite"), foeSprite = battlePart("foeSprite");
  youSprite.classList.toggle("guarding", b.guarding && !b.result);
  for (const [sprite, side] of [[youSprite, "hero"], [foeSprite, "monster"]]) {
    for (const id of ["frozen", "stun", "burn", "poison", "bleed", "shock"]) sprite.classList.toggle(`is-${id}`, hasEffect(side, id));
  }
  foeSprite.classList.toggle("fainted", b.result === "win");
  foeSprite.classList.toggle("caught", b.result === "caught");
  youSprite.classList.toggle("fainted", b.result === "lose");

  const logBox = battlePart("log");
  logBox.innerHTML = emo(b.log.map(l => `<div>${l}</div>`).join(""));
  logBox.scrollTop = logBox.scrollHeight;

  renderBattleMenu();
  if (typeof refreshInfoPop === "function") refreshInfoPop();
}

function renderBattleMenu() {
  const b = state.battle;
  const m = b.monster;
  const menu = battlePart("menu");
  if (b.result) {
    const titles = { win: "🏆 Victory!", caught: "🪤 Caught!", lose: "💫 Knocked out", fled: "🏃 You got away" };
    const e = elementById[m.element];
    menu.innerHTML = emo(`
      <div class="bt-result">
        <div class="result ${b.result}">${titles[b.result]}</div>
        <div class="small">${b.result === "caught"
          ? `${m.name} joined your Bestiary. You got ${m.reward.drops} ${e.icon} ${e.drop} and ${fmt(m.reward.coins)} 🪙.`
          : b.result === "win"
          ? `You got ${m.reward.drops} ${e.icon} ${e.drop} and ${fmt(m.reward.coins)} 🪙.`
          : `${m.name} is still waiting for you in Adventure. Try again any time.`}</div>
        <button class="primary big" data-k="close">Back to Adventure</button>
      </div>`);
    battlePart("close").onclick = closeBattle;
    if (b.result === "win" && m.boss) showBossVictory();
    return;
  }

  const myTurn = b.phase === "hero" && !battleUi.busy;
  const skipped = hasEffect("hero", "frozen") || hasEffect("hero", "stun");
  let html;
  if (b.phase === "hero" && skipped && !battleUi.busy) {
    const frozen = hasEffect("hero", "frozen");
    html = `<button class="primary big wide" data-a="wait">${frozen ? "🧊 You're frozen solid! Tap to continue" : "💫 You're stunned! Tap to continue"}</button>`;
  } else {
    const skills = Array.from({ length: BATTLE.skillSlots }, (_, i) => {
      const slot = (b.skills || [])[i];
      const sk = slot && skillById[slot.id];
      if (!sk) return `<button class="skill" disabled title="Buy skills in the Skills panel and equip them before a fight">Empty skill slot</button>`;
      const cost = skillGrade(sk).mana;
      const st = sk.status ? ` ${STATUS[sk.status].icon}` : "";
      // Tap = cast. The little "i" (or press and hold, or hover on a computer) opens the skill's info window.
      return `<div class="sk-act" data-info="skill:${sk.id}" data-info-level="${slot.level}">
        <button class="skill ready el-${sk.element}" data-a="skill${i}" data-info-press ${!myTurn || b.mana < cost ? "disabled" : ""}><span class="sk-mini">${skillArtSVG(sk.id)}</span> ${sk.name}${st} <span class="small">Lv ${slot.level} · 💧${cost}</span></button>
        <button class="info-i" type="button" aria-label="About ${sk.name}" data-info="skill:${sk.id}" data-info-level="${slot.level}">i</button>
      </div>`;
    }).join("");
    html = `
      <button class="primary" data-a="attack" ${myTurn ? "" : "disabled"}>⚔️ Attack</button>
      ${m.boss
        ? `<button class="catch" disabled title="Bosses are too strong to catch">🪤 Catch <span class="small">Boss</span></button>`
        : `<button class="catch" data-a="catch" ${myTurn ? "" : "disabled"} title="Try to catch it for your Bestiary. Easier when its HP is low. Uses your turn.">🪤 Catch <span class="small num">${Math.round(catchChance(b) * 100)}%</span></button>`}
      ${skills}`;
  }
  menu.innerHTML = emo(`
    <div class="bt-hint small">${b.phase === "monster" || battleUi.busy ? `${m.name}'s turn…` : "Your turn. Pick an action."}</div>
    <div class="actions">${html}
      <button class="danger" data-a="flee" ${myTurn ? "" : "disabled"}>🏃 Run away</button></div>`);
  menu.querySelectorAll("[data-a]").forEach(btn => { btn.onclick = () => onHeroAction(btn.dataset.a); });
}

// After beating a boss: a big victory window with sparks, confetti and the rewards.
function showBossVictory() {
  const b = state.battle;
  if (!b || battleScreen().querySelector(".vic-overlay")) return;
  const m = b.monster;
  const info = BOSS_ART[monsterArtKey(m)] || {};
  const e = elementById[m.element];
  const colors = ["#ffd34d", "#ff8a3a", "#7dffc4", "#7ac8ff", "#ff6bd0", "#ffffff"];
  const confetti = Array.from({ length: 36 }, (_, i) =>
    `<i style="--x:${(i * 29) % 100}%;--d:${((i * 0.37) % 2.4).toFixed(2)}s;--s:${(2.4 + (i % 5) * 0.45).toFixed(2)}s;--r:${(i * 47) % 360}deg;background:${colors[i % colors.length]}"></i>`).join("");
  let unlock = "";
  if (b.tierUp && b.tierUp > m.tier) {
    const t = TIERS[b.tierUp - 1];
    unlock = `<div class="vic-row new"><span>⚠️ Danger level ${b.tierUp}</span><span>${t.icon} ${t.name} opened!</span></div>`;
  } else if (peakCleared() && m.tier === TIERS.length) {
    unlock = `<div class="vic-row new"><span>👑 Every boss beaten</span><span>Reincarnate for Souls!</span></div>`;
  }
  const overlay = el(`
    <div class="vic-overlay mon-bg-${m.element}" role="dialog" aria-label="Boss defeated">
      <div class="vic-rays"></div>
      <div class="vic-confetti">${confetti}</div>
      <div class="vic-card">
        <div class="vic-kicker">Congratulations!</div>
        <div class="vic-title">Victory!</div>
        <div class="vic-stage">
          <div class="vic-burst"></div>
          ${monsterArtHTML(m, "vic-boss")}
          <div class="vic-stamp">Defeated</div>
        </div>
        <div class="vic-msg">You defeated <b>${m.name}</b>${info.title ? `, ${info.title.charAt(0).toLowerCase() + info.title.slice(1)}` : ""}!</div>
        <div class="vic-rewards">
          <div class="vic-row"><span>${e.icon} ${e.drop}</span><span class="num">+${m.reward.drops}</span></div>
          <div class="vic-row"><span>🪙 Coins</span><span class="num">+${fmt(m.reward.coins)}</span></div>
          ${unlock}
        </div>
        <button class="primary big wide" data-k="vicClose">Continue</button>
      </div>
    </div>`);
  overlay.querySelector('[data-k="vicClose"]').onclick = closeBattle;
  battleScreen().appendChild(overlay);
}

// Floating numbers and shakes for what just happened. Shown one after another.
// Which sound goes with a battle pop-up.
function battleSound(f) {
  const k = f.kind;
  if (k === "hit") sfx(f.side === "hero" ? "hurt" : "hit");
  else if (k === "crit") sfx(f.side === "hero" ? "hurt" : "crit");
  else if (k === "burn" || k === "poison" || k === "bleed") sfx("tick");
  else if (k === "heal") sfx("heal");
  else if (k === "miss") sfx(f.text === "Broke free" ? "escape" : "miss");
  else if (k === "status" && f.text !== "Caught!") sfx("status");
}

function playBattleFx() {
  const queue = battleFxQueue;
  battleFxQueue = [];
  queue.forEach((f, i) => later(i * 220, () => {
    const box = battlePart(f.side === "hero" ? "youFx" : "foeFx");
    const sprite = battlePart(f.side === "hero" ? "youSprite" : "foeSprite");
    if (!box) return;
    battleSound(f);
    const pop = el(`<div class="bt-pop pop-${f.kind}">${f.text}</div>`);
    pop.style.marginLeft = `${[0, -36, 36][i % 3]}px`; // spread out numbers that land together
    box.appendChild(pop);
    setTimeout(() => pop.remove(), 1100);
    if (["hit", "crit", "burn", "poison", "bleed"].includes(f.kind)) restartAnim(sprite, "hurt");
  }));
}

function restartAnim(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth; // restart the CSS animation
  node.classList.add(cls);
}

function onHeroAction(action) {
  if (battleUi.busy) return;
  const b = state.battle;
  if (!b || b.result) return;
  if (action !== "flee" && action !== "wait") restartAnim(battlePart("youSprite"), "lunge");
  if (!battleAction(action)) return;
  renderBattle();
  playBattleFx();
  if (state.battle && !state.battle.result && state.battle.phase === "monster") {
    battleUi.busy = true;
    renderBattleMenu();
    later(950, runMonsterTurn);
  }
}

// The monster's turn: show what it's doing, maybe give you a chance to dodge or parry, then let it land.
function runMonsterTurn() {
  const b = state.battle;
  if (!b || b.result || b.phase !== "monster") { battleUi.busy = false; if (b) renderBattle(); return; }
  battleUi.busy = true;
  const p = monsterChooseMove();
  renderBattle();
  if (p.kind === "attack") {
    const kinds = reactionKinds(p);
    if (kinds.length) startReaction(p, kinds);
    else {
      // No buttons this time: the attack just lands (your agility can still make it miss).
      showPromptBanner(attackTitle(p));
      restartAnim(battlePart("foeSprite"), "winding");
      later(1000, () => finishMonsterTurn(null));
    }
  } else {
    showPromptBanner(p.text);
    later(1100, () => finishMonsterTurn(null));
  }
}

// Which reaction buttons pop up for this attack: none, only Dodge, only Parry, or both.
function reactionKinds(p) {
  if (Math.random() >= (p.heavy ? REACTION.heavyChance : REACTION.chance)) return [];
  if (p.heavy) return ["dodge"]; // heavy attacks can't be parried
  const r = Math.random();
  return r < 1 / 3 ? ["dodge"] : r < 2 / 3 ? ["parry"] : ["dodge", "parry"];
}

function attackTitle(p) {
  const m = state.battle.monster;
  return p.heavy ? `💥 ${m.name} unleashes a heavy attack!` : p.name === "Attack" ? `${m.name} attacks!` : `${m.name} uses ${p.name}!`;
}

function showPromptBanner(text) {
  if (typeof closeInfoPop === "function") closeInfoPop();
  const prompt = battlePart("prompt");
  prompt.hidden = false;
  prompt.className = "bt-prompt banner";
  prompt.innerHTML = emo(`<div class="bt-prompt-card"><div class="bt-prompt-title">${text}</div></div>`);
}

// The dodge/parry buttons. A banner at the top says what's coming and runs the timer; each button
// pops up at its own random spot and stays for reactionWindow() ms.
function startReaction(p, kinds) {
  const prompt = battlePart("prompt");
  const windowMs = reactionWindow();
  if (typeof closeInfoPop === "function") closeInfoPop(); // never cover the dodge prompt
  const label = { dodge: "💨 Dodge <kbd>D</kbd>", parry: "⚔️ Parry <kbd>P</kbd>" };
  prompt.hidden = false;
  prompt.className = "bt-prompt now";
  prompt.innerHTML = emo(`
    <div class="bt-prompt-card bt-react-banner">
      <div class="bt-prompt-title">${attackTitle(p)}</div>
      <div class="bt-prompt-state" data-k="promptState">${kinds.length > 1 ? "Dodge or parry!" : kinds[0] === "dodge" ? "Dodge!" : "Parry!"}</div>
      <div class="bt-timer"><div class="bt-timer-fill" data-k="timerFill"></div></div>
      ${p.heavy ? `<div class="small">Too heavy to parry: dodge it!</div>` : ""}
    </div>
    ${kinds.map(k => `<button type="button" class="react-btn react-float react-${k}" data-r="${k}">${label[k]}</button>`).join("")}`);
  restartAnim(battlePart("foeSprite"), "winding");

  const r = { open: false, done: false, p, kinds };
  battleUi.reaction = r;
  const btns = [...prompt.querySelectorAll("[data-r]")];
  btns.forEach(btn => {
    btn.addEventListener("pointerdown", e => { e.preventDefault(); pressReaction(btn.dataset.r); });
    btn.addEventListener("click", e => { if (e.detail === 0) pressReaction(btn.dataset.r); }); // keyboard Enter/Space
  });

  placeReactButtons(btns, prompt.querySelector(".bt-react-banner"));
  r.open = true;
  const fill = battlePart("timerFill");
  fill.style.transition = "none";
  fill.style.width = "100%";
  void fill.offsetWidth;
  fill.style.transition = `width ${windowMs}ms linear`;
  fill.style.width = "0%";
  later(windowMs, () => { if (!r.done) settleReaction(null, "Too slow!"); });
}

// Put each button somewhere random below the banner, fully on screen, never on top of each other.
function placeReactButtons(btns, banner) {
  const margin = 12, gap = 18;
  const w = window.innerWidth, h = window.innerHeight;
  const top = Math.min(h / 2, banner.getBoundingClientRect().bottom + margin);
  const placed = [];
  for (const btn of btns) {
    const bw = btn.offsetWidth, bh = btn.offsetHeight;
    const maxLeft = Math.max(margin, w - bw - margin), maxTop = Math.max(top, h - bh - margin);
    let x = margin, y = top;
    for (let tries = 0; tries < 40; tries++) {
      x = Math.round(margin + Math.random() * (maxLeft - margin));
      y = Math.round(top + Math.random() * (maxTop - top));
      const clash = placed.some(o => x < o.x + o.w + gap && o.x < x + bw + gap && y < o.y + o.h + gap && o.y < y + bh + gap);
      if (!clash) break;
    }
    placed.push({ x, y, w: bw, h: bh });
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
  }
}

function pressReaction(kind) {
  const r = battleUi.reaction;
  if (!r || r.done || !r.kinds.includes(kind)) return;
  if (kind === "parry" && r.p.heavy) return;
  if (!r.open) { sfx("fail"); return settleReaction("early", "Too early!"); }
  sfx(kind);
  const btn = battlePart("prompt").querySelector(`[data-r="${kind}"]`);
  if (btn) btn.classList.add("picked");
  settleReaction(kind, kind === "dodge" ? "Dodge!" : "Parry!");
}

function settleReaction(reaction, text) {
  const r = battleUi.reaction;
  r.done = true;
  battleUi.reaction = null;
  const prompt = battlePart("prompt");
  prompt.className = `bt-prompt ${reaction === "dodge" || reaction === "parry" ? "good" : "bad"}`;
  battlePart("promptState").textContent = text;
  const fill = battlePart("timerFill");
  fill.style.width = getComputedStyle(fill).width;
  fill.style.transition = "none";
  later(450, () => finishMonsterTurn(reaction));
}

function finishMonsterTurn(reaction) {
  const prompt = battlePart("prompt");
  prompt.hidden = true;
  restartAnim(battlePart("foeSprite"), "lunge");
  monsterResolve(reaction);
  battleUi.busy = false;
  renderBattle();
  playBattleFx();
}

// Keyboard: D to dodge, P to parry (only when that button is showing).
if (typeof document !== "undefined") document.addEventListener("keydown", e => {
  if (!battleUi.reaction || e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === "d") { e.preventDefault(); pressReaction("dodge"); }
  if (k === "p") { e.preventDefault(); pressReaction("parry"); }
});

// ---------- Skills panel ----------

function buildMerchant() {
  refs.skillSlots = [];
  refs.skills = {};
  refs.skillHave = {};
  // Your 3 equipped skills: one row of 3, each with a big picture.
  const slotsBox = document.getElementById("skill-slots");
  slotsBox.innerHTML = "";
  for (let i = 0; i < BATTLE.skillSlots; i++) {
    const slot = el(`
      <div class="sk-slot">
        <div class="eq-frame sk-frame" data-k="frame"><div class="sk-art" data-k="art"></div><span class="info-dot" aria-hidden="true">i</span></div>
        <div class="sk-name" data-k="skill"></div>
        <div class="sk-meta" data-k="info"></div>
        <button class="sk-btn" data-k="remove">Remove</button>
      </div>`);
    slot.querySelector('[data-k="remove"]').onclick = () => unequipSkill(i);
    refs.skillSlots.push(slot);
    slotsBox.appendChild(slot);
  }

  // The shop: one row of 3 per element (low, mid, high), with your essences beside the title.
  const box = document.getElementById("skills");
  box.innerHTML = "";
  for (const e of ELEMENTS) {
    const head = el(`<div class="sk-head"><h3>${e.icon} ${e.name} skills</h3><span class="sk-have" data-k="have"></span></div>`);
    refs.skillHave[e.id] = head;
    box.appendChild(head);
    const row = el(`<div class="sk-row"></div>`);
    for (const sk of SKILLS) {
      if (sk.element !== e.id) continue;
      const g = skillGrade(sk);
      const card = el(`
        <div class="sk-card el-${e.id}">
          <div class="eq-frame sk-frame" data-info="skill:${sk.id}"><div class="sk-art">${skillArtSVG(sk.id)}</div><span class="info-dot" aria-hidden="true">i</span></div>
          <div class="sk-name" data-info="skill:${sk.id}">${sk.name}</div>
          <div class="sk-meta" data-k="meta"></div>
          <button class="primary sk-btn" data-k="buy"></button>
          <button class="sk-btn" data-k="equip">Equip</button>
        </div>`);
      card.querySelector('[data-k="buy"]').onclick = () => buySkill(sk.id);
      card.querySelector('[data-k="equip"]').onclick = () => equipSkill(sk.id);
      refs.skills[sk.id] = card;
      row.appendChild(card);
    }
    box.appendChild(row);
  }
}

// "Lv 3 💧1": level (or grade) and mana cost, each part kept on one line.
function skillMetaHTML(first, mana) {
  return `<span class="nw">${first}</span> <span class="nw">💧${mana}</span>`;
}

function renderMerchant() {
  state.skillSlots.forEach((id, i) => {
    const slot = refs.skillSlots[i];
    const sk = id && skillById[id];
    const art = slot.querySelector('[data-k="art"]');
    if (art.dataset.id !== (id || "")) {
      art.dataset.id = id || "";
      art.innerHTML = sk ? skillArtSVG(sk.id) : "";
    }
    set(slot, "skill", sk ? sk.name : "Empty");
    const info = sk ? skillMetaHTML(`Lv ${skillLevel(id)}`, skillGrade(sk).mana) : "Pick one below";
    const infoEl = slot.querySelector('[data-k="info"]');
    setIconHTML(infoEl, info);
    // Tap or hover the picture of an equipped skill for its info window.
    for (const part of [slot.querySelector('[data-k="frame"]'), slot.querySelector('[data-k="skill"]')]) {
      if (sk) part.dataset.info = `skill:${sk.id}`;
      else delete part.dataset.info;
    }
    slot.className = "sk-slot" + (sk ? ` el-${sk.element}` : " empty");
    slot.querySelector('[data-k="remove"]').hidden = !sk;
  });
  for (const e of ELEMENTS) set(refs.skillHave[e.id], "have", `You have ${fmt(state.drops[e.id] || 0)} ${e.icon}`);
  const slotsFull = !state.skillSlots.includes(null);
  for (const sk of SKILLS) {
    const card = refs.skills[sk.id];
    const level = skillLevel(sk.id);
    const cost = skillNextCost(sk);
    const e = elementById[sk.element];
    const meta = skillMetaHTML(level > 0 ? `Lv ${level}` : skillGrade(sk).name, skillGrade(sk).mana);
    const metaEl = card.querySelector('[data-k="meta"]');
    setIconHTML(metaEl, meta);
    // The full description and numbers are in the info window (tap or hover the picture, see info-pop.js).
    const buy = card.querySelector('[data-k="buy"]');
    const label = `${level > 0 ? "Level up" : "Buy"} <span class="nw">${fmt(cost)} ${e.icon}</span>`;
    setIconHTML(buy, label);
    buy.disabled = (state.drops[sk.element] || 0) < cost;
    const equip = card.querySelector('[data-k="equip"]');
    const equipped = state.skillSlots.includes(sk.id);
    const eqLabel = equipped ? "Equipped" : "Equip";
    setIconText(equip, eqLabel);
    equip.hidden = level === 0;
    equip.disabled = equipped || slotsFull;
    equip.title = !equipped && slotsFull ? "All 3 slots are full. Remove a skill first." : "";
    card.classList.toggle("owned", level > 0);
    card.classList.toggle("equipped", equipped);
  }
}

// ---------- Souls panel ----------

let reincarnateOpen = false; // is the "are you sure?" box showing

function buildSouls() {
  buildFarm();
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
        <div class="small"><b>You lose:</b> coins, ore, miners, opened mines, pickaxe and anvil upgrades, Run Boons, all gear (in your bag and equipped), unspent essences, danger level and waiting monsters.</div>
        <div class="small"><b>You keep:</b> learned skills (they go back to level 1), skill slots, Element Mastery, Souls, attributes, the Monster Farm and the essence waiting in it.</div>
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
  renderFarm();
  set(document.getElementById("souls-bar"), "souls", fmt(state.souls));
  set(document.getElementById("settings-pop"), "lives", String(state.reincarnations));
  set(document.getElementById("settings-pop"), "priceMult", runPriceMult().toFixed(2));
  for (const a of ATTRIBUTES) {
    const card = refs.attrs[a.id];
    const lvl = attributeLevel(a.id);
    set(card, "lvl", String(lvl));
    set(card, "bonus", lvl > 0 ? `+${fmt(lvl * a.perPoint)}${a.id === "luck" ? "%" : ""}` : "");
    const btn = card.querySelector('[data-k="buy"]');
    const maxed = lvl >= ATTRIBUTE_MAX;
    const label = maxed ? "Maxed" : `+1 for ${fmt(attributeCost(a))} 👻`;
    setIconText(btn, label);
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

// Upgrades panel: Element Mastery (permanent, essence) and Run Boons (this run, ore + essence).
function buildMastery(box) {
  refs.mastery = {};
  box.appendChild(el(`<h3>Element Mastery</h3>`));
  box.appendChild(el(`<div class="small up-note">Permanent: mastery stays when you reincarnate. Each level makes that element's skills hit ${Math.round(MASTERY.damage * 100)}% harder and makes its status effect stronger.</div>`));
  for (const e of ELEMENTS) {
    const st = STATUS[ELEMENT_STATUS[e.id]];
    const dot = ELEMENT_STATUS[e.id] === "burn" || ELEMENT_STATUS[e.id] === "poison";
    const card = el(`
      <div class="card attr up-card" data-el="${e.id}">
        <div class="row">
          <span class="name">${e.icon} ${e.name} Mastery <span class="small num">Lv <span data-k="lvl"></span>/${MASTERY.max}</span></span>
          <span class="stats-line" data-k="bonus"></span>
        </div>
        <div class="small">+${Math.round(MASTERY.damage * 100)}% ${e.name.toLowerCase()} damage per level. ${st.icon} ${st.name}: +${Math.round(MASTERY.statusChance * 100)}% chance${dot ? ` and +${Math.round(MASTERY.dot * 100)}% damage` : ""} per level.</div>
        <div class="buttons">
          <button class="primary" data-k="buy"></button>
          <span class="have" data-k="have"></span>
        </div>
      </div>`);
    card.querySelector('[data-k="buy"]').onclick = () => buyMastery(e.id);
    refs.mastery[e.id] = card;
    box.appendChild(card);
  }
}

function buildBoons(box) {
  refs.boons = {};
  box.appendChild(el(`<h3>Run Boons</h3>`));
  box.appendChild(el(`<div class="small up-note">This run only: boons reset when you reincarnate. Level N costs the ore of danger level N (copper, iron, gold… up to voidsteel) plus essence.</div>`));
  for (const bn of BOONS) {
    const e = elementById[bn.element];
    const card = el(`
      <div class="card attr up-card boon">
        <div class="row">
          <span class="name">${bn.icon} ${bn.name} <span class="small num">Lv <span data-k="lvl"></span>/${ORES.length}</span></span>
          <span class="stats-line" data-k="bonus"></span>
        </div>
        <div class="small">${bn.desc}. Paid with ore and ${e.icon} ${e.drop}.</div>
        <div class="small boon-price" data-k="price"></div>
        <div class="buttons">
          <button class="primary" data-k="buy"></button>
        </div>
      </div>`);
    card.querySelector('[data-k="buy"]').onclick = () => buyBoon(bn.id);
    refs.boons[bn.id] = card;
    box.appendChild(card);
  }
}

function renderUpgrades() {
  for (const e of ELEMENTS) {
    const card = refs.mastery[e.id];
    const lvl = masteryLevel(e.id);
    set(card, "lvl", String(lvl));
    set(card, "bonus", lvl > 0 ? `+${Math.round(lvl * MASTERY.damage * 100)}% dmg` : "");
    const btn = card.querySelector('[data-k="buy"]');
    const maxed = lvl >= MASTERY.max;
    const cost = masteryCost(e.id);
    const have = state.drops[e.id] || 0;
    const label = maxed ? "Maxed" : `Level up for ${fmt(cost)} ${e.icon}`;
    setIconText(btn, label);
    btn.disabled = maxed || have < cost;
    set(card, "have", maxed ? "" : `you have ${fmt(have)} ${e.icon}`);
    const haveEl = card.querySelector('[data-k="have"]');
    haveEl.classList.toggle("enough", have >= cost);
    haveEl.classList.toggle("short", have < cost);
  }
  for (const bn of BOONS) {
    const card = refs.boons[bn.id];
    const lvl = boonLevel(bn.id);
    const e = elementById[bn.element];
    set(card, "lvl", String(lvl));
    set(card, "bonus", lvl > 0 ? (bn.pct ? `+${Math.round(lvl * bn.pct * 100)}%` : `+${lvl * bn.flat}%`) : "");
    const btn = card.querySelector('[data-k="buy"]');
    const price = card.querySelector('[data-k="price"]');
    if (boonMaxed(bn.id)) {
      setIconText(btn, "Maxed");
      btn.disabled = true;
      price.hidden = true;
      continue;
    }
    const c = boonCost(bn.id);
    const oreOk = state.ore[c.ore.id] >= c.oreAmount;
    const essOk = state.drops[bn.element] >= c.essence;
    const label = `Buy level ${lvl + 1}`;
    setIconText(btn, label);
    btn.disabled = !(oreOk && essOk);
    price.hidden = false;
    const html = `Needs <span class="${oreOk ? "enough" : "short"}">${fmt(c.oreAmount)} ${c.ore.name.toLowerCase()}</span> + <span class="${essOk ? "enough" : "short"}">${fmt(c.essence)} ${e.icon}</span> (you have ${fmt(state.ore[c.ore.id])} and ${fmt(state.drops[bn.element])})`;
    setIconHTML(price, html);
  }
}

function buildUI() {
  refs = { ores: {}, recipes: {} };

  const oresBox = document.getElementById("ores");
  oresBox.innerHTML = "";
  for (const o of ORES) {
    if (state.unlocked[o.id]) {
      const card = el(`
        <div class="card ore-card" data-ore="${o.id}">
          <div class="ore-info">
            <div class="ore-dwarf">${typeof dwarfHTML === "function" ? dwarfHTML(o.id, o.name) : ""}</div>
            <div class="name ore-title">${o.name} ore: <span class="num" data-k="amount"></span></div>
            <div class="small ore-stats">Miners: <span data-k="miners"></span> · <span data-k="rate"></span>/sec</div>
          </div>
          <button class="ore-btn" title="Mine ${o.name}" aria-label="Mine ${o.name}" style="--i:${ORES.indexOf(o)}">
            <span class="ore-glow"></span><span class="ore-shadow"></span>
            <span class="ore-bob">${typeof oreArtBigSVG === "function" ? oreArtBigSVG(o.id) || oreIcon(o) : oreIcon(o)}</span>
            <span class="ore-sparkles"><i></i><i></i><i></i></span>
          </button>
          <div class="ore-hire">
            <button data-k="hire">Hire miner (<span data-k="hireCost"></span> 🪙)</button>
          </div>
        </div>`);
      const oreBtn = card.querySelector(".ore-btn");
      const hitOre = e => {
        const spot = oreSpot(oreBtn, e); // measure before anything on the page changes
        const before = state.ore[o.id];
        mine(o.id);
        const got = state.ore[o.id] - before;
        oreHit(oreBtn, o.id, spot, got > 0 ? `+${fmtRate(got)}` : "");
      };
      oreBtn.onclick = hitOre;
      card.querySelector('[data-k="hire"]').onclick = () => hireMiner(o.id);
      refs.ores[o.id] = card;
      oresBox.appendChild(card);
    } else {
      const card = el(`
        <div class="card locked">
          <div class="row">
            <span class="name">${oreIcon(o)} ${o.name} mine (locked)</span>
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
  renderProfile();
  buildAdventure();
  buildMerchant();
  buildSouls();

  const upBox = document.getElementById("upgrades");
  upBox.innerHTML = "";
  upBox.appendChild(el(`<h3>Tools</h3>`));
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

  buildMastery(upBox);
  buildBoons(upBox);

  render();
}

// The ore squashes and flashes when you hit it, little ore chips fly out from where you
// tapped and a big "+5" in the ore's own colors pops out and floats away.
// Kept cheap for phones: sizes are read once (oreSpot) before anything on the page changes,
// the pieces are made without parsing HTML, and old pieces are dropped when you tap fast.
const FX_CHIPS = 6;     // chips per tap
const FX_MAX_CHIPS = 24; // at most this many flying at once per ore
const FX_MAX_POPS = 5;   // at most this many "+N" at once per ore
// Where the ore is and where you tapped it. Measured before the numbers change, because
// measuring after a change makes the phone lay out the whole page again first.
function oreSpot(btn, e) {
  const g = { bx: btn.offsetLeft, by: btn.offsetTop, bw: btn.offsetWidth, bh: btn.offsetHeight };
  g.x = g.bw / 2; g.y = g.bh / 2;
  if (e && e.clientX && e.clientY) {
    const r = btn.getBoundingClientRect();
    g.x = Math.min(g.bw, Math.max(0, e.clientX - r.left));
    g.y = Math.min(g.bh, Math.max(0, e.clientY - r.top));
  }
  return g;
}
function oreHit(btn, oreId, g, text) {
  const spot = btn.parentElement;
  const { bx, by, bw, bh, x, y } = g;
  // Restart the squash by switching between two copies of the animation, no layout needed.
  const odd = btn.classList.contains("hit");
  btn.classList.toggle("hit", !odd);
  btn.classList.toggle("hit2", odd);

  const sh = typeof oreShades === "function" ? oreShades(oreId) : ["#4a2306", "#7a3a10", "#b05a20", "#e07b39", "#f0a070", "#ffe0c0"];
  const frag = document.createDocumentFragment();
  for (let k = 0; k < FX_CHIPS; k++) {
    const a = (k / FX_CHIPS) * Math.PI * 2 + Math.random() * 0.7;
    const d = 26 + Math.random() * 30;
    const chip = document.createElement("span");
    chip.className = k % 2 ? "ore-chip-fx" : "ore-chip-fx sm";
    chip.style.cssText = `left:${bx + x}px;top:${by + y}px;--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d - 14).toFixed(1)}px;--c:${sh[3 + (k % 3)]};--o:${sh[0]};animation-duration:${(0.5 + Math.random() * 0.25).toFixed(2)}s`;
    chip.addEventListener("animationend", () => chip.remove());
    setTimeout(() => chip.remove(), 1200); // in case animations are switched off
    frag.appendChild(chip);
  }
  if (text) {
    const pop = document.createElement("span");
    pop.className = "float-num";
    const inner = document.createElement("span");
    inner.textContent = text;
    pop.appendChild(inner);
    pop.style.cssText = `left:${(bx + bw / 2 + (Math.random() * 24 - 12)).toFixed(1)}px;top:${(by + bh * 0.18).toFixed(1)}px;--drift:${(Math.random() * 30 - 15).toFixed(1)}px;--tilt:${(Math.random() * 16 - 8).toFixed(1)}deg;--fc:${sh[4]};--fm:${sh[3]};--fo:${sh[0]}`;
    pop.addEventListener("animationend", ev => { if (ev.target === pop) pop.remove(); });
    setTimeout(() => pop.remove(), 1600);
    frag.appendChild(pop);
  }
  spot.appendChild(frag);
  // Tapping really fast: drop the oldest pieces so the phone never has too many to animate.
  const chips = spot.getElementsByClassName("ore-chip-fx");
  while (chips.length > FX_MAX_CHIPS) chips[0].remove();
  const pops = spot.getElementsByClassName("float-num");
  while (pops.length > FX_MAX_POPS) pops[0].remove();
}

// A short glow on buy buttons the moment you can afford them.
const wasDisabled = new WeakMap();
function glowAffordable() {
  for (const b of document.querySelectorAll('main button[data-k="hire"], main button[data-k="unlock"], main button[data-k="buy"]')) {
    const before = wasDisabled.get(b);
    if (before === true && !b.disabled) {
      b.classList.remove("glow");
      void b.offsetWidth; // restart the animation
      b.classList.add("glow");
    }
    wasDisabled.set(b, b.disabled);
  }
}

function set(root, key, text) {
  setIconText(root.querySelector(`[data-k="${key}"]`), text);
}

// Header: how much of each opened ore you have, next to your coins.
// Every ore gets a chip. Desktop hides the locked ones; phones show them dimmed
// so the 2 x 5 grid never jumps around. Phones also use a shorter number (1.2K).
function fmtShort(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx"];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return (n < 10 ? Math.floor(n * 10) / 10 : Math.floor(n)) + units[i];
}
function renderOreBar() {
  const bar = document.getElementById("ore-bar");
  if (!bar.children.length) {
    for (const o of ORES) bar.appendChild(el(`<span class="ore-chip locked" data-ore="${o.id}" title="${o.name} ore">${oreIcon(o)} <span class="num ore-long" data-k="n">0</span><span class="num ore-short" data-k="s">0</span></span>`));
  }
  for (const o of ORES) {
    const chip = bar.querySelector(`[data-ore="${o.id}"]`);
    const open = !!state.unlocked[o.id];
    chip.classList.toggle("locked", !open);
    chip.title = open ? `${o.name} ore` : `${o.name} ore (mine not opened yet)`;
    set(chip, "n", open ? fmt(state.ore[o.id]) : "");
    set(chip, "s", open ? fmtShort(state.ore[o.id]) : "-");
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
      if (typeof updateDwarf === "function") updateDwarf(card.querySelector(".dwarf-box"), o.id, state.miners[o.id]);
      set(card, "rate", fmtRate(orePerSecond(o)));
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
    const canMake = smithLimit(r) > 0;
    set(card, "owned", fmt(bagCount(r)));
    set(card, "price", fmt(sellPrice(r)));
    card.querySelector('[data-k="make1"]').disabled = !canMake;
    card.querySelector('[data-k="makeMax"]').disabled = !canMake;
    card.querySelector('[data-k="sell"]').disabled = bagCount(r) <= 0;
    const worn = state.equipped[r.slot] && state.equipped[r.slot].id === r.id;
    card.querySelector('[data-k="worn"]').hidden = !worn;
    card.querySelector('[data-k="equip"]').disabled = bagCount(r) <= 0;
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
  renderUpgrades();

  renderAdventure();
  renderBestiary();
  renderMerchant();
  if (typeof refreshInfoPop === "function") refreshInfoPop();

  const { total: hero, fromBestiary } = heroStatsParts();
  const gear = gearStats();
  const attrs = attributeStats();
  for (const st of STATS) {
    const parts = [];
    if (gear[st.id] > 0) parts.push(`+${fmt(gear[st.id])} gear`);
    if (attrs[st.id] > 0) parts.push(`+${fmt(attrs[st.id])} souls`);
    if (fromBestiary[st.id] > 0) parts.push(`+${fmt(fromBestiary[st.id])} bestiary`);
    const boon = hero[st.id] - HERO_BASE_STATS[st.id] - gear[st.id] - (attrs[st.id] || 0) - fromBestiary[st.id];
    if (boon > 0) parts.push(`+${fmt(boon)} boons`);
    set(refs.stats[st.id], "total", fmt(hero[st.id]) + (st.id === "luck" ? "%" : ""));
    set(refs.stats[st.id], "bonus", parts.length ? `(${parts.join(", ")})` : "");
  }
  renderBestiaryBonus();
  renderSouls();
  renderEquipSlots();
  glowAffordable();
  if (typeof showWaitingPopups === "function") showWaitingPopups();
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

  updateSpawns();
  farmTick(); // the Monster Farm kept making essence while you were away (no limit)

  buildUI();
  if (loadNote) log(loadNote);
  if (state.battle) openBattle(); // pick up a fight that was going on when the page closed

  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    addOre((now - last) / 1000);
    last = now;
    farmTick();
    updateSpawns();
    render();
  }, 100);

  setInterval(save, 5000);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });

  // Reset lives in the settings menu (gear in the top bar) as a small link. It opens a window
  // where you must type "reset" before the Reset button wakes up, so a stray tap can't erase a save.
  const resetConfirm = document.getElementById("reset-confirm");
  const resetInput = document.getElementById("reset-input");
  const resetYes = document.getElementById("reset-yes");
  const resetTyped = () => resetInput.value.trim().toLowerCase() === "reset";
  const closeReset = () => { resetConfirm.hidden = true; resetInput.value = ""; resetYes.disabled = true; };
  document.getElementById("reset").onclick = () => {
    document.getElementById("settings-pop").hidden = true;
    document.getElementById("settings-btn").setAttribute("aria-expanded", "false");
    resetInput.value = "";
    resetYes.disabled = true;
    resetConfirm.hidden = false;
    resetInput.focus();
  };
  resetInput.oninput = () => { resetYes.disabled = !resetTyped(); };
  resetInput.onkeydown = e => { if (e.key === "Enter" && resetTyped()) resetYes.click(); };
  document.getElementById("reset-no").onclick = closeReset;
  resetConfirm.onclick = e => { if (e.target === resetConfirm) closeReset(); }; // tap outside = cancel
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !resetConfirm.hidden) closeReset(); });
  resetYes.onclick = () => {
    if (!resetTyped()) return; // never erase unless the word was typed
    closeReset();
    reincarnateOpen = false;
    const profile = state.profile; // your hero's look isn't progress, so it stays
    state = freshState();
    state.profile = profile;
    state.welcomed = true; // you've seen the Welcome window already ([?] still opens it)
    save();
    renderBattle();
    buildUI();
  };
}

if (typeof document !== "undefined") start();
