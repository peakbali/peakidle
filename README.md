# Peak Idle

A small idle game you play in your browser. Mine ore, smith weapons and armor, sell them for coins, grow your mine, and fight monsters.

## How to play

1. **Mine**: click an ore (start with copper) to dig it up.
2. **Forge**: when you have enough ore, smith a weapon (sword, axe, spear, bow, staff) or a piece of armor (helmet, chestplate, gloves, boots, shield). Every type can be made from every ore, and better ores make stronger gear.
3. **Sell** your gear for coins (sold gear is gone for good), or **equip** it.
4. **Hero**: equipped gear raises your stats: HP, attack, defense, agility, skill power and luck. Heavy armor gives more defense, light armor more agility. Luck is your chance of a critical hit (double damage).
5. **Adventure**: a random monster appears every 15 seconds, up to 5 at a time, even while the game is closed (the timer pauses while 5 are waiting). Each one has a random element, so its weakness and its essence drop are random too. Your **danger level** decides how strong they are: monsters are your level or one below. Below them waits a fixed **boss**. Beat it to raise your danger level, which brings stronger monsters and the next boss. There are 10 danger levels: Mossy Tunnels, Deep Mine, Molten Halls, Sky Peak, Crystal Caverns, Sunken Ruins, Frostfang Tundra, Ember Wastes, Shadow Abyss and Starfall Crown. The higher ones need gear from the newer ores.
   - Battles are turn based and fill the whole screen. Each turn you **Attack**, **Guard** (take much less damage and no status effects, great when a monster winds up a heavy attack), cast a skill or **Run away**.
   - When a monster attacks, a prompt pops up: tap **Dodge** (avoid the hit) or **Parry** (take 30% and strike back) before its timer runs out. The prompt pops up right away at a random spot on the screen, so be quick. Too late and the hit lands. Keys: D and P.
   - Status effects, for you and monsters: 🔥 Burn and ☠️ Poison (damage each turn, poison stacks), 🧊 Frozen and 💫 Stun (lose a turn), ⚡ Shock (30% chance to fail to act), 🥀 Weaken (35% less damage). Monsters have their own element move that causes these.
   - You start each battle with 3 mana and get 1 more each turn, up to 5. Mana powers your skills: click an equipped skill to cast it.
   - **Weapon skills**: every weapon type has 2 free skills you can use while it's equipped, next to your 3 skill slots. Sword: Crescent Slash, Riposte Stance (guard and strike back). Axe: Heavy Chop (can stun), Whirlwind (3 hits). Spear: Piercing Thrust, Skewering Charge (ignore half the defense, the charge breaks a heavy attack). Bow: Double Shot, Eagle Eye (big crit chance). Staff: Arcane Focus (next element skill +75%), Arcane Blast (uses skill power).
   - Every monster has an element: 🔥 Fire, ❄️ Ice, 🌪️ Wind, 🪨 Earth or ⚡ Lightning. Fire beats Ice, Ice beats Wind, Wind beats Earth, Earth beats Lightning, Lightning beats Fire. Hitting a weakness does 50% more damage, hitting an element it resists does half.
   - Winning gives coins and essences of the monster's element (shown under Adventure). A beaten monster is gone. If you lose or run away, it stays and you can try again any time. Losing costs nothing.
6. **Skills**: spend essences on 15 skills (3 per element: low, mid and high grade, costing 1, 2 or 3 mana). Most deal elemental damage, many cause their element's status effect (fire burns, ice freezes, wind poisons, earth stuns or weakens, lightning shocks), some heal or guard. Buy a skill again to level it up (+25% strength per level, each level costs more). Equip up to 3 skills for your next fight. Skill power adds to your attack for skills, so a staff helps a lot.
7. **Elemental weapons**: in the Forge, pick an element above the weapons before you smith. The new weapon costs some essences too, and your basic attack then uses that element.
8. **Spend coins** on miners (they dig for you, even while the game is closed, up to 8 hours), a better pickaxe (more ore per click), a master anvil (gear sells for more), and new mines: iron, gold, mithril, adamant, obsidian, moonsilver, sunstone, starmetal and voidsteel (10 ores in all). Each new mine costs a lot more than the last, and its gear is much stronger.
9. **Reincarnate** (Souls panel) whenever you like to start a new run and earn 👻 **Souls**. You get more Souls the higher your danger level got in Adventure and the more coins you earned that run, and you see how many before you confirm. Reincarnating resets coins, ore, miners, mines, upgrades, gear, essences and danger level (back to 1), but you **keep your learned skills, Souls and attributes**. Each reincarnation also makes miners, mines and upgrades 10% pricier (skill prices never go up).
10. **Attributes**: spend Souls on HP, Attack, Defense, Agility and Luck (0 to 99 points each). Each point gives a flat bonus that adds to your gear, forever. Every point costs more Souls than the last. Luck is your critical hit chance in %.

Your progress saves automatically in your browser.

## Running it

- **On your computer**: download the files and double-click `index.html`.
- **Online**: turn on GitHub Pages (Settings → Pages → Branch: `main`, folder `/ (root)` → Save). After a minute the game is live at `https://peakbali.github.io/peakidle/`.

## Files

- `index.html`: the page layout
- `style.css`: colors and layout
- `game.js`: all the game rules. Ores, gear types, stats, elements, monsters, spawn timer, prices, upgrades, Souls and attributes are at the top, easy to tweak.
- `dwarves.js`: the little animated dwarf miners in the Mine panel, one per ore, drawn in code as pixel art. Their looks, tools and mining moves are at the top, easy to tweak.
- `ores-art.js`: the pixel-art ore pictures (Mine buttons, header, Forge tabs), drawn in code. Each ore has its own little drawing near the bottom of the file.
- `menu.js`: the phone menu (main menu tiles and bottom tab bar). Only shows on screens 700px wide or less.

When you change `style.css`, `game.js` or `menu.js`, raise the `?v=` number after their names in `index.html` (for example `?v=10` to `?v=11`). That makes phones and browsers load the new files instead of an old saved copy.
