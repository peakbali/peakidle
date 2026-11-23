// Peak Idle: mine ore, smith weapons and armor, sell them, grow your mine.
// Everything lives in this one file. Progress is saved in your browser (localStorage).

const SAVE_KEY = "peakidle-save-v1"; // kept the same so old saves still load
const SAVE_VERSION = 10;                // bump when the save format changes (see migrate())
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
  // Deeper ores. Each mine costs about 9x the last and its gear is about 2.4x stronger, so every new
  // ore takes clearly longer to reach (roughly 2 days of mining for Voidsteel on a first run).
  { id: "adamant",    name: "Adamant",    icon: "🟩", perSecPerMiner: 0.06,  minerCost: 70000,     unlockCost: 2e6,    statMult: 21,   costMult: 3,   gearValue: 1900,  infuseCost: 120 },
  { id: "obsidian",   name: "Obsidian",   icon: "🟣", perSecPerMiner: 0.04,  minerCost: 450000,    unlockCost: 18e6,   statMult: 52,   costMult: 3.5, gearValue: 13500, infuseCost: 300 },
  { id: "moonsilver", name: "Moonsilver", icon: "🌙", perSecPerMiner: 0.03,  minerCost: 3e6,       unlockCost: 160e6,  statMult: 128,  costMult: 4,   gearValue: 95000, infuseCost: 750 },
  { id: "sunstone",   name: "Sunstone",   icon: "🌞", perSecPerMiner: 0.02,  minerCost: 20e6,      unlockCost: 1.4e9,  statMult: 315,  costMult: 4.5, gearValue: 670e3, infuseCost: 1800 },
  { id: "starmetal",  name: "Starmetal",  icon: "🌟", perSecPerMiner: 0.015, minerCost: 130e6,     unlockCost: 12e9,   statMult: 780,  costMult: 5,   gearValue: 4.7e6, infuseCost: 4500 },
  { id: "voidsteel",  name: "Voidsteel",  icon: "🌌", perSecPerMiner: 0.01,  minerCost: 900e6,     unlockCost: 100e9,  statMult: 1900, costMult: 5.5, gearValue: 33e6,  infuseCost: 11000 },
];

// The pixel-art picture for an ore (drawn in ores-art.js), or its emoji if that file is missing.
function oreIcon(o) {
  return typeof oreArtSVG === "function" ? oreArtSVG(o.id) || o.icon : o.icon;
}

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
const HERO_BASE_STATS = { hp: 100, attack: 2, defense: 0, agility: 5, power: 0, luck: 0 };

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
  { id: "helmet",     name: "Helmet",     slot: "helmet",     icon: "🪖", cost: 15, stats: { defense: 2, hp: 10 },     note: "Medium" },
  { id: "chestplate", name: "Chestplate", slot: "chestplate", icon: "🥋", cost: 30, stats: { defense: 5, hp: 30 },     note: "Heavy" },
  { id: "gloves",     name: "Gloves",     slot: "gloves",     icon: "🧤", cost: 10, stats: { defense: 1, attack: 1, agility: 2 }, note: "Light" },
  { id: "boots",      name: "Boots",      slot: "boots",      icon: "🥾", cost: 12, stats: { defense: 1, agility: 3 }, note: "Light" },
  { id: "shield",     name: "Shield",     slot: "shield",     icon: "🛡️", cost: 20, stats: { defense: 4, hp: 20 },     note: "Heavy" },
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
//   status:   a status effect it can cause (see STATUS), with `chance` (0-1) per hit
//   heal:     heals this share of your max HP (also grows with skill power)
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
  { id: "healing_breeze",element: "wind",      grade: 2, name: "Healing Breeze",   heal: 0.3, cleanse: true, desc: "Heal 30% of your max HP (more with skill power) and cure your status effects." },
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
  steady: { name: "Steady", icon: "🧱", turns: 2, desc: "Just shook off a freeze or stun: can't be frozen or stunned right now." },
};
// The status effect that goes with each element. Weapons with an element have a small chance to cause it.
const ELEMENT_STATUS = { fire: "burn", ice: "frozen", wind: "poison", earth: "stun", lightning: "shock" };
const WEAPON_STATUS_CHANCE = 0.1;

// ---------- Element Mastery (Upgrades panel) ----------
// One mastery track per element, bought with that element's essence. Mastery is PERMANENT:
// it stays when you reincarnate, so essence always has somewhere lasting to go.
// Each level of, say, Fire Mastery:
//   - makes all your fire damage stronger: fire skills, and attacks and weapon skills with a fire weapon
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

// ---------- Weapon skills ----------
// Every weapon type has 2 skills of its own. They're free: you can use them whenever a weapon of that
// type is equipped, next to your 3 element skills. They cost mana like element skills and use your
// weapon's element (if it has one), so an elemental weapon can also cause its status effect.
//   power:     damage = attack x power (Arcane Blast adds skill power too: usePower)
//   hits, critBonus, status + chance, guard, interrupt: same as element skills
//   pierce:    ignores this share of the monster's defense
//   riposte:   if the monster attacks you this turn, you strike back with this much of a normal attack
//   empower:   your next element skill this fight is this much stronger (0.75 = +75%)
//   elementStatus: chance to cause your weapon element's status effect (default WEAPON_STATUS_CHANCE)
const WEAPON_SKILLS = [
  { id: "crescent_slash",  weapon: "sword", icon: "🗡️", name: "Crescent Slash",   mana: 1, power: 1.8,
    desc: "A clean, sweeping cut that never misses." },
  { id: "riposte_stance",  weapon: "sword", icon: "🤺", name: "Riposte Stance",   mana: 2, power: 0.7, guard: true, riposte: 1.3,
    desc: "A quick cut, then guard. If the monster attacks this turn, you strike back hard." },
  { id: "heavy_chop",      weapon: "axe",   icon: "💥", name: "Heavy Chop",       mana: 2, power: 2.6, status: "stun", chance: 0.4,
    desc: "A crushing blow. 40% chance to stun." },
  { id: "whirlwind",       weapon: "axe",   icon: "🌀", name: "Whirlwind",        mana: 3, power: 1.5, hits: 3,
    desc: "Spin with your axe and hit three times." },
  { id: "piercing_thrust", weapon: "spear", icon: "📍", name: "Piercing Thrust",  mana: 1, power: 1.6, pierce: 0.5,
    desc: "A precise jab that ignores half the monster's defense." },
  { id: "skewer_charge",   weapon: "spear", icon: "🐎", name: "Skewering Charge", mana: 2, power: 2.4, pierce: 0.5, interrupt: true,
    desc: "Charge through: ignores half its defense and breaks a heavy attack wind-up." },
  { id: "double_shot",     weapon: "bow",   icon: "🎯", name: "Double Shot",      mana: 1, power: 1.0, hits: 2, critBonus: 0.1,
    desc: "Two quick arrows, each with +10% crit chance." },
  { id: "eagle_eye",       weapon: "bow",   icon: "🦅", name: "Eagle Eye",        mana: 2, power: 2.4, critBonus: 0.5,
    desc: "A careful, aimed shot with +50% crit chance." },
  { id: "arcane_focus",    weapon: "staff", icon: "🔆", name: "Arcane Focus",     mana: 1, empower: 0.75,
    desc: "Gather your power: your next element skill this fight is 75% stronger." },
  { id: "arcane_blast",    weapon: "staff", icon: "🔮", name: "Arcane Blast",     mana: 2, power: 2.0, usePower: true, elementStatus: 0.35,
    desc: "A blast of raw magic that also uses your skill power. With an elemental staff, 35% chance to cause its status effect." },
];
const weaponSkillById = Object.fromEntries(WEAPON_SKILLS.map(ws => [ws.id, ws]));
// The weapon skills that come with a weapon type (sword, axe...), or [] for none.
function weaponSkillsOf(typeId) { return WEAPON_SKILLS.filter(ws => ws.weapon === typeId); }

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
  everyMs: 15 * 1000,     // a new monster appears every 15 seconds, even while the game is closed
  max: 5,                 // at most 5 monsters wait at once; the timer pauses while 5 are waiting
  newRun: 3,              // a new game or reincarnation starts with 3 monsters already waiting
  lowerTierChance: 0.4,   // 40% of spawns are one tier below yours (from tier 2 up), for variety
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
const BOSS_MULT = { hp: 1.6, attack: 1.15, defense: 1.15, agility: 1.1, coins: 3, drops: 3 };

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
  guardMultiplier: 0.4,   // guarding takes only 40% damage, and blocks status effects
  specialChance: 0.35,    // how often a monster uses its element move instead of a normal attack
  warCryChance: 0.2,      // bosses sometimes roar to weaken you
};

// Dodge and parry: when a monster attacks, a prompt pops up. Tap in time to react.
//   Dodge: avoid the whole hit. Parry: take only 30% damage and strike back (not against heavy attacks).
//   The prompt opens straight away at a random spot on the screen, so you have to find it fast.
const REACTION = {
  windowMin: 600,              // the window is 0.6 to 1 second: longer when you're quicker than the monster
  windowMax: 1000,
  heavyWindow: 0.85,           // heavy attacks give a shorter window
  bossWindow: 0.9,             // and so do bosses
  parryTaken: 0.3,             // a parried hit does 30% damage
  parryCounter: 0.6,           // your counterattack: 60% of a normal attack
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
    boons: {},            // boon id -> level (0-10), this run only
    // Kept when you reincarnate:
    souls: 0,             // Souls to spend on attributes
    attributes: {},       // attribute id -> points bought (0-99)
    mastery: {},          // element id -> Element Mastery level (permanent)
    reincarnations: 0,    // how many times you've reincarnated (prices go up each time)
    totalSouls: 0,        // all Souls ever earned
    profile: normalizeProfile(null), // your hero's name and look (see avatar.js), also kept on Reset
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
    for (const key of ["ore", "miners", "unlocked", "items", "drops", "skills", "attributes", "mastery", "boons"]) {
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
    s.profile = normalizeProfile(saved.profile);
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
function heroStats() {
  const total = { ...HERO_BASE_STATS };
  for (const [k, v] of Object.entries(attributeStats())) total[k] += v;
  for (const slot of SLOTS) {
    const item = state.equipped[slot.id];
    if (!item) continue;
    for (const [k, v] of Object.entries(recipeById[item.id].stats)) total[k] += v;
  }
  for (const bn of BOONS) {
    const lvl = boonLevel(bn.id);
    if (!lvl) continue;
    if (bn.pct) total[bn.id] = Math.round(total[bn.id] * (1 + bn.pct * lvl));
    if (bn.flat) total[bn.id] += bn.flat * lvl;
  }
  return total;
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
    hero: { ...hero, element: weaponElement(), weapon: state.equipped.weapon ? state.equipped.weapon.id : null },
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
    log: [`A wild ${m.name} appears!`, "When it attacks, tap Dodge or Parry the moment it says NOW!"],
    result: null,      // "win", "lose" or "fled" once it's over
  };
  // Quicker monsters strike first.
  if (m.stats.agility > hero.agility) {
    state.battle.log.push(`${m.name} is quicker and strikes first!`);
    state.battle.phase = "monster";
  }
  save();
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

// End of `side`'s turn: burn and poison hurt, then every effect counts down by one.
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

// A normal weapon attack from you. extra scales the damage (used by parry counters).
function heroAttack(extra = 1, label = "You hit") {
  const b = state.battle;
  const m = b.monster;
  const hit = rollHit({
    attack: b.hero.attack, defense: m.stats.defense,
    attackEl: b.hero.element, targetEl: m.element,
    critChance: b.hero.luck / 100,
    dodge: extra === 1 ? dodgeChance(m.stats.agility, b.hero.agility) : 0,
    extra: extra * damageMult("hero") * masteryDamage(b.hero.element),
  });
  if (hit.dodged) {
    battleLog(`You attack, but ${m.name} dodges!`);
    battleFx("monster", "Miss", "miss");
    return;
  }
  b.monsterHp = Math.max(0, b.monsterHp - hit.damage);
  battleLog(`${label} ${m.name} for ${hit.damage}.${hitText(hit)}`);
  battleFx("monster", `-${hit.damage}${hit.crit ? "!" : ""}`, hit.crit ? "crit" : "hit");
  if (b.hero.element && b.monsterHp > 0 && Math.random() < masteryChance(WEAPON_STATUS_CHANCE, ELEMENT_STATUS[b.hero.element])) {
    applyStatus("monster", ELEMENT_STATUS[b.hero.element], hit.damage);
  }
}

// Your turn. action: "attack", "guard", "flee", "skill0".."skill2", or "wait" (only while frozen or stunned).
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
  } else if (action === "attack" || action === "guard" || /^w?skill[0-9]$/.test(action)) {
    let sk = null, slot = null, ws = null;
    if (action.startsWith("skill")) {
      slot = (b.skills || [])[Number(action.slice(5))];
      sk = slot && skillById[slot.id];
      if (!sk || b.mana < skillGrade(sk).mana) return false;
    }
    if (action.startsWith("wskill")) {
      ws = battleWeaponSkills()[Number(action.slice(6))];
      if (!ws || b.mana < ws.mana) return false;
    }
    if (action !== "guard" && hasEffect("hero", "shock") && Math.random() < STATUS.shock.fail) {
      battleLog("⚡ You're shocked and your body won't move!");
      battleFx("hero", "⚡ Shocked", "status");
    } else if (action === "attack") {
      heroAttack();
    } else if (action === "guard") {
      b.guarding = true;
      battleLog("You raise your guard. (Less damage and no status effects this turn.)");
    } else if (ws) {
      b.mana -= ws.mana;
      useWeaponSkill(ws, m);
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
  // Arcane Focus (staff) makes this one skill stronger, then it's used up.
  const focus = 1 + (b.empower || 0);
  const lvl = skillLevelMult(level) * focus;
  battleLog(`You cast ${e.icon} ${sk.name}!${focus > 1 ? " (Focused!)" : ""}`);
  b.empower = 0;
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
        extra: damageMult("hero") * masteryDamage(sk.element),
      });
      b.monsterHp = Math.max(0, b.monsterHp - hit.damage);
      battleLog(`${sk.name} hits ${m.name} for ${hit.damage}.${hitText(hit)}`);
      battleFx("monster", `-${hit.damage}${hit.crit ? "!" : ""}`, hit.crit ? "crit" : "hit");
      if (sk.status && b.monsterHp > 0 && Math.random() < masteryChance(sk.chance, sk.status)) applyStatus("monster", sk.status, hit.damage);
    }
  }
  if (sk.heal) {
    const amount = Math.round(b.hero.hp * sk.heal * lvl * (1 + b.hero.power / 100));
    const before = b.heroHp;
    b.heroHp = Math.min(b.hero.hp, b.heroHp + amount);
    battleLog(`You heal ${b.heroHp - before} HP.`);
    battleFx("hero", `+${b.heroHp - before}`, "heal");
  }
  if (sk.cleanse) {
    const bad = ["burn", "poison", "frozen", "stun", "shock", "weaken"].filter(id => hasEffect("hero", id));
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

// The weapon skills you can use in this fight: they come with the weapon you brought.
function battleWeaponSkills() {
  const b = state.battle;
  const r = b && b.hero.weapon && recipeById[b.hero.weapon];
  return r ? weaponSkillsOf(r.type) : [];
}

// Use a weapon skill. Mana is already paid. Weapon skills never miss.
function useWeaponSkill(ws, m) {
  const b = state.battle;
  const wEl = b.hero.element;
  battleLog(`You use ${ws.icon} ${ws.name}!`);
  if (ws.guard) b.guarding = true;
  if (ws.riposte) b.riposte = ws.riposte;
  if (ws.power) {
    const attack = (b.hero.attack + (ws.usePower ? b.hero.power : 0)) * ws.power;
    const defense = m.stats.defense * (1 - (ws.pierce || 0));
    const status = ws.status || (wEl && ELEMENT_STATUS[wEl]);
    const chance = ws.status ? ws.chance : wEl ? masteryChance(ws.elementStatus || WEAPON_STATUS_CHANCE, status) : 0;
    for (let i = 0; i < (ws.hits || 1) && b.monsterHp > 0; i++) {
      const hit = rollHit({
        attack, defense,
        attackEl: wEl, targetEl: m.element,
        critChance: b.hero.luck / 100 + (ws.critBonus || 0),
        dodge: 0,
        extra: damageMult("hero") * masteryDamage(wEl),
      });
      b.monsterHp = Math.max(0, b.monsterHp - hit.damage);
      battleLog(`${ws.name} hits ${m.name} for ${hit.damage}.${hitText(hit)}`);
      battleFx("monster", `-${hit.damage}${hit.crit ? "!" : ""}`, hit.crit ? "crit" : "hit");
      if (status && b.monsterHp > 0 && Math.random() < chance) applyStatus("monster", status, hit.damage);
    }
  }
  if (ws.empower) {
    b.empower = Math.max(b.empower || 0, ws.empower);
    battleLog(`🔆 Power gathers around you. Your next element skill is ${Math.round(ws.empower * 100)}% stronger.`);
  }
  if (b.monsterHp <= 0) return;
  if (ws.guard) battleLog(ws.riposte ? "You take a riposte stance: guarding, ready to strike back." : "You are guarding this turn.");
  if (ws.interrupt && b.charging) {
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
    // Riposte Stance (sword): strike back after the monster's attack.
    if (b.riposte && b.heroHp > 0 && b.monsterHp > 0) heroAttack(b.riposte, "🤺 You riposte and hit");
    // Every few turns the monster winds up a heavy attack for its next turn.
    if (!heavy && b.heroHp > 0 && b.turn % BATTLE.heavyEvery === BATTLE.heavyEvery - 1) {
      b.charging = true;
      battleLog(`⚠️ ${m.name} is winding up a heavy attack! Guard, dodge or break it with a skill.`);
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
  b.riposte = 0;
  b.mana = Math.min(BATTLE.maxMana, b.mana + BATTLE.manaPerTurn);
  b.phase = "hero";
  save();
}

function endBattle(result) {
  const b = state.battle;
  const m = b.monster;
  b.result = result;
  b.pending = null;
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
        if (peakCleared()) battleLog(`You conquered the ${TIERS[TIERS.length - 1].name}! Reincarnate in the Souls panel for a big Souls reward.`);
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

// Level up an element's mastery with its essence. Permanent.
function buyMastery(elId) {
  const cost = masteryCost(elId);
  if (masteryLevel(elId) >= MASTERY.max || state.drops[elId] < cost) return;
  state.drops[elId] -= cost;
  state.mastery[elId] = masteryLevel(elId) + 1;
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
  log(`${boonById[id].name} is now level ${state.boons[id]} for this run.`);
  save();
  render();
}

// Start a new run. Keeps skills, skill slots, Souls, attributes, Element Mastery, your look and lifetime counters.
function reincarnate() {
  if (state.battle) return; // finish the fight first
  const gained = soulsPreview().total;
  const keep = {
    skills: state.skills,
    skillSlots: state.skillSlots,
    attributes: state.attributes,
    mastery: state.mastery,
    souls: state.souls + gained,
    totalSouls: state.totalSouls + gained,
    reincarnations: state.reincarnations + 1,
    totalSmithed: state.totalSmithed,
    profile: state.profile,
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
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx"];
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
    const b = el(`<button class="tab${o.id === forgeOre ? " active" : ""}">${oreIcon(o)} ${o.name}</button>`);
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
      <div class="card item-row">
        <div class="item-icon" aria-hidden="true">${r.icon}</div>
        <div class="item-main">
          <div class="row">
            <span class="name">${r.name} <span class="tag" data-k="worn" hidden>Equipped</span></span>
            <span class="small">In bag <b class="num bag-num" data-k="owned"></b></span>
          </div>
          <div class="stats-line">${statsText(r.stats)} <span class="small">· ${r.note}</span></div>
          ${isWeapon ? `<div class="small wskill-line">Skills: ${weaponSkillsOf(r.type).map(ws => `${ws.icon} ${ws.name}`).join(" · ")}</div>` : ""}
          <div class="small">Costs ${r.cost} ${ore.name.toLowerCase()} ore${isWeapon && forgeElement ? ` + ${ore.infuseCost} ${elementById[forgeElement].icon} ${elementById[forgeElement].drop}` : ""} · sells for <span data-k="price"></span> 🪙</div>
          ${isWeapon ? `<div class="small" data-k="bagEls"></div>` : ""}
          <div class="buttons">
            <button data-k="make1">Smith 1</button>
            <button data-k="makeMax">Smith max</button>
            <button data-k="equip">Equip${isWeapon && forgeElement ? ` ${elementById[forgeElement].icon}` : ""}</button>
            <button data-k="sell" class="primary">Sell all</button>
          </div>
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
          ${slot.id === "weapon" ? `<div class="small" data-k="element"></div><div class="small wskill-line" data-k="wskills"></div>` : ""}
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
    box.appendChild(el(`<div class="card boss small">🏆 ${last.icon} ${last.name} is defeated. The ${TIERS[TIERS.length - 1].name} is yours!</div>`));
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
  battleScreen().innerHTML = `
    <div class="bt-wrap bt-tier-${m.tier}">
      <div class="bt-top">
        <span>${tier.icon} ${tier.name} · Danger level ${m.tier}</span>
        <span class="num" data-k="turn"></span>
      </div>
      <div class="bt-arena">
        <div class="bt-info foe" data-k="foeInfo"></div>
        <div class="bt-spot foe${m.boss ? " boss" : ""}">
          <div class="bt-sprite" data-k="foeSprite">${m.icon}</div>
          <div class="bt-pad"></div>
          <div class="bt-fx" data-k="foeFx"></div>
        </div>
        <div class="bt-spot you">
          <div class="bt-sprite bt-hero" data-k="youSprite">${avatarSVG(state.profile, "full")}${weapon ? `<span class="bt-weapon">${weapon.icon}</span>` : ""}</div>
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
    </div>`;
}

// Small icons for status effects, with turns left (and stacks for poison).
function statusChips(side) {
  const fx = state.battle.effects[side];
  return Object.entries(fx).filter(([, e]) => e.turns > 0).map(([id, e]) => {
    const st = STATUS[id];
    const extra = id === "poison" && e.stacks > 1 ? `×${e.stacks} ` : "";
    const dmg = e.dmg ? ` ${e.dmg} damage per turn.` : "";
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

  battlePart("foeInfo").innerHTML = `
    <div class="row"><span class="name">${m.name}${m.boss ? ` <span class="tag boss-tag">Boss</span>` : ""}<span class="tag">Lv ${m.tier}</span></span>${elementTag(m.element)}</div>
    ${hpBar(b.monsterHp, m.stats.hp)}
    <div class="bt-status">${statusChips("monster")}${b.charging && !b.result ? `<span class="st st-heavy" title="Its next attack is a heavy one. Guard, dodge, or break it with Gust, Earthquake or Skewering Charge.">⚠️ Heavy</span>` : ""}</div>`;

  const mana = Array.from({ length: BATTLE.maxMana }, (_, i) =>
    `<span class="pip${i < b.mana ? " full" : ""}"></span>`).join("");
  battlePart("youInfo").innerHTML = `
    <div class="row"><span class="name">${avatarNameHTML(normalizeProfile(state.profile).name)}</span>${elementTag(b.hero.element)}</div>
    ${hpBar(b.heroHp, b.hero.hp)}
    <div class="mana" title="Mana: used by skills. Start with ${BATTLE.startMana}, +${BATTLE.manaPerTurn} each turn, max ${BATTLE.maxMana}.">💧 ${mana}</div>
    <div class="bt-status">${statusChips("hero")}${b.guarding && !b.result ? `<span class="st st-guard" title="Guarding: less damage and no status effects this turn">🛡️</span>` : ""}${b.riposte && !b.result ? `<span class="st st-guard" title="Riposte Stance: you strike back when the monster attacks">🤺</span>` : ""}${b.empower && !b.result ? `<span class="st st-focus" title="Arcane Focus: your next element skill is ${Math.round(b.empower * 100)}% stronger">🔆</span>` : ""}</div>`;

  const youSprite = battlePart("youSprite"), foeSprite = battlePart("foeSprite");
  youSprite.classList.toggle("guarding", b.guarding && !b.result);
  for (const [sprite, side] of [[youSprite, "hero"], [foeSprite, "monster"]]) {
    for (const id of ["frozen", "stun", "burn", "poison", "shock"]) sprite.classList.toggle(`is-${id}`, hasEffect(side, id));
  }
  foeSprite.classList.toggle("fainted", b.result === "win");
  youSprite.classList.toggle("fainted", b.result === "lose");

  const logBox = battlePart("log");
  logBox.innerHTML = b.log.map(l => `<div>${l}</div>`).join("");
  logBox.scrollTop = logBox.scrollHeight;

  renderBattleMenu();
}

function renderBattleMenu() {
  const b = state.battle;
  const m = b.monster;
  const menu = battlePart("menu");
  if (b.result) {
    const titles = { win: "🏆 Victory!", lose: "💫 Knocked out", fled: "🏃 You got away" };
    const e = elementById[m.element];
    menu.innerHTML = `
      <div class="bt-result">
        <div class="result ${b.result}">${titles[b.result]}</div>
        <div class="small">${b.result === "win"
          ? `You got ${m.reward.drops} ${e.icon} ${e.drop} and ${fmt(m.reward.coins)} 🪙.`
          : `${m.name} is still waiting for you in Adventure. Try again any time.`}</div>
        <button class="primary big" data-k="close">Back to Adventure</button>
      </div>`;
    battlePart("close").onclick = closeBattle;
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
      return `<button class="skill ready el-${sk.element}" data-a="skill${i}" ${!myTurn || b.mana < cost ? "disabled" : ""}
        title="${sk.desc}">${elementById[sk.element].icon} ${sk.name}${st} <span class="small">Lv ${slot.level} · 💧${cost}</span></button>`;
    }).join("");
    const wskills = battleWeaponSkills();
    const weaponBtns = [0, 1].map(i => {
      const ws = wskills[i];
      if (!ws) return `<button class="skill" disabled title="Equip a weapon to get its 2 weapon skills">No weapon skill</button>`;
      const st = ws.status ? ` ${STATUS[ws.status].icon}` : "";
      return `<button class="skill ready wskill" data-a="wskill${i}" ${!myTurn || b.mana < ws.mana ? "disabled" : ""}
        title="${ws.desc}">${ws.icon} ${ws.name}${st} <span class="small">💧${ws.mana}</span></button>`;
    }).join("");
    html = `
      <button class="primary" data-a="attack" ${myTurn ? "" : "disabled"}>⚔️ Attack ${elementTag(b.hero.element)}</button>
      <button data-a="guard" ${myTurn ? "" : "disabled"} title="Take 40% damage and no status effects this turn">🛡️ Guard</button>
      ${weaponBtns}
      ${skills}`;
  }
  menu.innerHTML = `
    <div class="bt-hint small">${b.phase === "monster" || battleUi.busy ? `${m.name}'s turn…` : "Your turn. Pick an action."}</div>
    <div class="actions">${html}
      <button class="danger" data-a="flee" ${myTurn ? "" : "disabled"}>🏃 Run away</button></div>`;
  menu.querySelectorAll("[data-a]").forEach(btn => { btn.onclick = () => onHeroAction(btn.dataset.a); });
}

// Floating numbers and shakes for what just happened. Shown one after another.
function playBattleFx() {
  const queue = battleFxQueue;
  battleFxQueue = [];
  queue.forEach((f, i) => later(i * 220, () => {
    const box = battlePart(f.side === "hero" ? "youFx" : "foeFx");
    const sprite = battlePart(f.side === "hero" ? "youSprite" : "foeSprite");
    if (!box) return;
    const pop = el(`<div class="bt-pop pop-${f.kind}">${f.text}</div>`);
    pop.style.marginLeft = `${[0, -36, 36][i % 3]}px`; // spread out numbers that land together
    box.appendChild(pop);
    setTimeout(() => pop.remove(), 1100);
    if (["hit", "crit", "burn", "poison"].includes(f.kind)) restartAnim(sprite, "hurt");
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

// The monster's turn: show what it's doing, give you a chance to dodge or parry, then let it land.
function runMonsterTurn() {
  const b = state.battle;
  if (!b || b.result || b.phase !== "monster") { battleUi.busy = false; if (b) renderBattle(); return; }
  battleUi.busy = true;
  const p = monsterChooseMove();
  renderBattle();
  if (p.kind === "attack") startReaction(p);
  else {
    showPromptBanner(p.text);
    later(1100, () => finishMonsterTurn(null));
  }
}

function showPromptBanner(text) {
  const prompt = battlePart("prompt");
  prompt.hidden = false;
  prompt.className = "bt-prompt banner";
  prompt.innerHTML = `<div class="bt-prompt-card"><div class="bt-prompt-title">${text}</div></div>`;
}

// The dodge/parry prompt. It opens right away at a random spot on the screen and stays open for reactionWindow() ms.
function startReaction(p) {
  const b = state.battle;
  const m = b.monster;
  const prompt = battlePart("prompt");
  const windowMs = reactionWindow();
  const title = p.heavy ? `💥 ${m.name} unleashes a heavy attack!` : p.name === "Attack" ? `${m.name} attacks!` : `${m.name} uses ${p.name}!`;
  prompt.hidden = false;
  prompt.className = "bt-prompt now";
  prompt.innerHTML = `
    <div class="bt-prompt-card">
      <div class="bt-prompt-title">${title}</div>
      <div class="bt-timer"><div class="bt-timer-fill" data-k="timerFill"></div></div>
      <div class="bt-prompt-state" data-k="promptState">NOW!</div>
      <div class="bt-react">
        <button type="button" class="react-btn" data-r="dodge">💨 Dodge <kbd>D</kbd></button>
        <button type="button" class="react-btn" data-r="parry" ${p.heavy ? `disabled title="Heavy attacks are too strong to parry"` : ""}>⚔️ Parry <kbd>P</kbd></button>
      </div>
      ${p.heavy ? `<div class="small">Too heavy to parry: dodge it!</div>` : ""}
    </div>`;
  restartAnim(battlePart("foeSprite"), "winding");

  const r = { open: false, done: false, p };
  battleUi.reaction = r;
  prompt.querySelectorAll("[data-r]").forEach(btn => {
    btn.addEventListener("pointerdown", e => { e.preventDefault(); pressReaction(btn.dataset.r); });
    btn.addEventListener("click", e => { if (e.detail === 0) pressReaction(btn.dataset.r); }); // keyboard Enter/Space
  });

  placePromptRandomly(prompt.querySelector(".bt-prompt-card"));
  r.open = true;
  const fill = battlePart("timerFill");
  fill.style.transition = "none";
  fill.style.width = "100%";
  void fill.offsetWidth;
  fill.style.transition = `width ${windowMs}ms linear`;
  fill.style.width = "0%";
  later(windowMs, () => { if (!r.done) settleReaction(null, "Too slow!"); });
}

// Put the prompt card somewhere random, always fully on screen with a small margin.
function placePromptRandomly(card) {
  const margin = 12;
  const w = window.innerWidth, h = window.innerHeight;
  const maxLeft = Math.max(margin, w - card.offsetWidth - margin);
  const maxTop = Math.max(margin, h - card.offsetHeight - margin);
  card.style.left = `${Math.round(margin + Math.random() * (maxLeft - margin))}px`;
  card.style.top = `${Math.round(margin + Math.random() * (maxTop - margin))}px`;
}

function pressReaction(kind) {
  const r = battleUi.reaction;
  if (!r || r.done) return;
  if (kind === "parry" && r.p.heavy) return;
  if (!r.open) return settleReaction("early", "Too early!");
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

// Keyboard: D to dodge, P to parry.
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

  // Weapon skills: nothing to buy, they come with the weapon you equip.
  box.appendChild(el(`<h3>⚔️ Weapon skills</h3>`));
  box.appendChild(el(`<div class="small hint">Free! Every weapon type has 2 skills you can use in battle while it's equipped, on top of your 3 skill slots. They cost mana and use your weapon's element.</div>`));
  for (const type of GEAR_TYPES.filter(t => t.slot === "weapon")) {
    const list = weaponSkillsOf(type.id).map(ws => `
      <div class="wskill-row"><b>${ws.icon} ${ws.name}</b> <span class="small">💧 ${ws.mana} mana</span><div class="small">${ws.desc}</div></div>`).join("");
    box.appendChild(el(`<div class="card skill-card wskill-card" data-weapon="${type.id}">
        <div class="row"><span class="name">${type.icon} ${type.name}</span><span class="tag" data-k="using" hidden>Equipped</span></div>
        ${list}
      </div>`));
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
  const w = state.equipped.weapon && recipeById[state.equipped.weapon.id];
  document.querySelectorAll(".wskill-card").forEach(card => {
    const using = !!w && w.type === card.dataset.weapon;
    card.querySelector('[data-k="using"]').hidden = !using;
    card.classList.toggle("owned", using);
  });
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
        <div class="small"><b>You lose:</b> coins, ore, miners, opened mines, pickaxe and anvil upgrades, Run Boons, all gear (in your bag and equipped), unspent essences, danger level and waiting monsters.</div>
        <div class="small"><b>You keep:</b> learned skills and their levels, skill slots, Element Mastery, Souls and attributes.</div>
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

// Upgrades panel: Element Mastery (permanent, essence) and Run Boons (this run, ore + essence).
function buildMastery(box) {
  refs.mastery = {};
  box.appendChild(el(`<h3>Element Mastery</h3>`));
  box.appendChild(el(`<div class="small up-note">Permanent: mastery stays when you reincarnate. Each level makes that element hit ${Math.round(MASTERY.damage * 100)}% harder (skills, and attacks with a weapon of that element) and makes its status effect stronger.</div>`));
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
    if (btn.textContent !== label) btn.textContent = label;
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
      if (btn.textContent !== "Maxed") btn.textContent = "Maxed";
      btn.disabled = true;
      price.hidden = true;
      continue;
    }
    const c = boonCost(bn.id);
    const oreOk = state.ore[c.ore.id] >= c.oreAmount;
    const essOk = state.drops[bn.element] >= c.essence;
    const label = `Buy level ${lvl + 1}`;
    if (btn.textContent !== label) btn.textContent = label;
    btn.disabled = !(oreOk && essOk);
    price.hidden = false;
    const html = `Needs <span class="${oreOk ? "enough" : "short"}">${fmt(c.oreAmount)} ${c.ore.name.toLowerCase()}</span> + <span class="${essOk ? "enough" : "short"}">${fmt(c.essence)} ${e.icon}</span> (you have ${fmt(state.ore[c.ore.id])} and ${fmt(state.drops[bn.element])})`;
    if (price.innerHTML !== html) price.innerHTML = html;
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
          <div class="row ore-top">
            <button class="ore-btn" title="Mine ${o.name}">${oreIcon(o)}</button>
            ${typeof dwarfHTML === "function" ? dwarfHTML(o.id, o.name) : ""}
          </div>
          <div class="row">
            <div style="flex:1">
              <div class="name">${o.name} ore: <span class="num" data-k="amount"></span></div>
              <div class="small">Miners: <span data-k="miners"></span> · <span data-k="rate"></span>/sec · +<span data-k="click"></span> per click</div>
            </div>
          </div>
          <div class="buttons">
            <button data-k="hire">Hire miner (<span data-k="hireCost"></span> 🪙)</button>
          </div>
        </div>`);
      card.querySelector(".ore-btn").onclick = e => {
        const before = state.ore[o.id];
        mine(o.id);
        const got = state.ore[o.id] - before;
        if (got > 0) floatText(e.currentTarget, `+${fmtRate(got)}`);
      };
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

// A small "+5" that floats up from the ore you just clicked.
function floatText(anchor, text) {
  const spot = anchor.parentElement;
  const pop = el(`<span class="float-num" aria-hidden="true">${text}</span>`);
  pop.style.left = `${anchor.offsetLeft + anchor.offsetWidth / 2 + (Math.random() * 16 - 8)}px`;
  pop.style.top = `${anchor.offsetTop + 4}px`;
  spot.appendChild(pop);
  pop.addEventListener("animationend", () => pop.remove());
  setTimeout(() => pop.remove(), 1500); // in case animations are switched off
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
  const node = root.querySelector(`[data-k="${key}"]`);
  if (node && node.textContent !== text) node.textContent = text;
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
  renderUpgrades();

  renderAdventure();
  renderMerchant();

  const hero = heroStats();
  const gear = gearStats();
  const attrs = attributeStats();
  for (const st of STATS) {
    const parts = [];
    if (gear[st.id] > 0) parts.push(`+${fmt(gear[st.id])} gear`);
    if (attrs[st.id] > 0) parts.push(`+${fmt(attrs[st.id])} souls`);
    const boon = hero[st.id] - HERO_BASE_STATS[st.id] - gear[st.id] - (attrs[st.id] || 0);
    if (boon > 0) parts.push(`+${fmt(boon)} boons`);
    set(refs.stats[st.id], "total", fmt(hero[st.id]) + (st.id === "luck" ? "%" : ""));
    set(refs.stats[st.id], "bonus", parts.length ? `(${parts.join(", ")})` : "");
  }
  renderSouls();
  for (const slot of SLOTS) {
    const row = refs.slots[slot.id];
    const item = state.equipped[slot.id];
    const r = item && recipeById[item.id];
    set(row, "item", r ? `${r.icon} ${r.name}` : "Empty");
    if (slot.id === "weapon") {
      set(row, "element", r ? `Element: ${item.element ? `${elementById[item.element].icon} ${elementById[item.element].name}` : "Neutral"}` : "");
      set(row, "wskills", r ? `Weapon skills: ${weaponSkillsOf(r.type).map(ws => `${ws.icon} ${ws.name} (💧${ws.mana})`).join(", ")}` : "");
    }
    set(row, "itemStats", r ? statsText(r.stats) : "Smith something in the Forge and press Equip.");
    row.classList.toggle("empty", !r);
    row.querySelector('[data-k="remove"]').hidden = !r;
  }
  glowAffordable();
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

  // Reset lives in the settings menu (gear in the top bar) and asks once more before erasing.
  const resetConfirm = document.getElementById("reset-confirm");
  document.getElementById("reset").onclick = () => { resetConfirm.hidden = false; };
  document.getElementById("reset-no").onclick = () => { resetConfirm.hidden = true; };
  document.getElementById("reset-yes").onclick = () => {
    resetConfirm.hidden = true;
    document.getElementById("settings-pop").hidden = true;
    document.getElementById("settings-btn").setAttribute("aria-expanded", "false");
    reincarnateOpen = false;
    const profile = state.profile; // your hero's look isn't progress, so it stays
    state = freshState();
    state.profile = profile;
    save();
    renderBattle();
    buildUI();
  };
}

if (typeof document !== "undefined") start();
