# Peak Idle

A small idle game you play in your browser. Mine ore, smith swords and armor, sell them for coins, grow your mine, and fight monsters.

## How to play

1. **Mine**: click an ore (start with copper) to dig it up.
2. **Forge**: when you have enough ore, smith a sword (the only weapon) or a piece of armor (helmet, chestplate, gloves, boots, shield). Every piece can be made from every ore, and better ores make stronger gear.
3. **Sell** your gear for coins (sold gear is gone for good), or **equip** it.
4. **Hero**: equipped gear raises your stats: HP, attack, defense, agility and luck. Heavy armor gives more defense, light armor more agility. Luck is your chance of a critical hit (double damage). **Rings** are the gear that gives luck: 5% for a copper ring up to 50% for a voidsteel ring, added to the luck from Souls and boons. Tap an equipment slot to pick what to wear from your bag.
5. **Adventure**: a random monster appears every 15 seconds, up to 5 at a time, even while the game is closed (the timer pauses while 5 are waiting). Each one has a random element, so its weakness and its essence drop are random too. Your **danger level** decides how strong they are: monsters are your level or one below. Below them waits a fixed **boss**. Beat it to raise your danger level, which brings stronger monsters and the next boss. There are 10 danger levels: Mossy Tunnels, Deep Mine, Molten Halls, Sky Peak, Crystal Caverns, Sunken Ruins, Frostfang Tundra, Ember Wastes, Shadow Abyss and Starfall Crown. The higher ones need gear from the newer ores.
   - Battles are turn based and fill the whole screen. Each turn you **Attack**, **Guard** (take much less damage and no status effects, great when a monster winds up a heavy attack), cast a skill or **Run away**.
   - When a monster attacks, a prompt pops up: tap **Dodge** (avoid the hit) or **Parry** (take 30% and strike back) before its timer runs out. The prompt pops up right away at a random spot on the screen, so be quick. Too late and the hit lands. Keys: D and P.
   - Status effects, for you and monsters: 🔥 Burn and ☠️ Poison (damage each turn, poison stacks), 🧊 Frozen and 💫 Stun (lose a turn), ⚡ Shock (30% chance to fail to act), 🥀 Weaken (35% less damage). Monsters have their own element move that causes these.
   - You start each battle with 3 mana and get 1 more each turn, up to 5. Mana powers your skills: click an equipped skill to cast it.
   - Your sword attack has no element; element damage comes from your skills. Every monster has an element: 🔥 Fire, ❄️ Ice, 🌪️ Wind, 🪨 Earth or ⚡ Lightning. Fire beats Ice, Ice beats Wind, Wind beats Earth, Earth beats Lightning, Lightning beats Fire. Hitting a weakness does 50% more damage, hitting an element it resists does half.
   - Winning gives coins and essences of the monster's element (shown under Adventure). A beaten monster is gone. If you lose or run away, it stays and you can try again any time. Losing costs nothing.
6. **Skills**: spend essences on 15 skills (3 per element: low, mid and high grade, costing 1, 2 or 3 mana; high skills hit twice as hard). Most deal elemental damage, many cause their element's status effect (fire burns, ice freezes, wind poisons, earth stuns or weakens, lightning shocks), some heal or guard. Buy a skill again to level it up (+25% strength per level, each level costs more). Equip up to 3 skills for your next fight. Skill damage grows with your attack.
7. **Spend coins** on miners (they dig for you, even while the game is closed, up to 8 hours), a better pickaxe (more ore per click), a master anvil (gear sells for more), and new mines: iron, gold, mithril, adamant, obsidian, moonsilver, sunstone, starmetal and voidsteel (10 ores in all). Each new mine costs a lot more than the last, and its gear is much stronger.
8. **Reincarnate** (Souls panel) whenever you like to start a new run and earn 👻 **Souls**. You get more Souls the higher your danger level got in Adventure and the more coins you earned that run, and you see how many before you confirm. Reincarnating resets coins, ore, miners, mines, upgrades, gear, essences and danger level (back to 1), but you **keep your learned skills, Souls and attributes**. Each reincarnation also makes miners, mines and upgrades 10% pricier (skill prices never go up).
9. **Attributes**: spend Souls on HP, Attack, Defense, Agility and Luck (0 to 99 points each). Each point gives a flat bonus that adds to your gear, forever. Every point costs more Souls than the last. Luck is your critical hit chance in %.
10. **Element Mastery** (Upgrades panel): spend an element's essence to master it, up to level 25. Each level makes that element's skills 6% stronger and its status effect more likely (burn and poison also hurt more). Mastery is permanent: it stays when you reincarnate.
11. **Run Boons** (Upgrades panel): spend ore plus essence to boost HP, attack, defense, agility or luck, up to level 10 each. Level N costs the ore of danger level N (level 1 copper ... level 10 voidsteel). Boons last until you reincarnate.

**Info windows**: tap a skill or monster picture (or hover it on a computer) to see a small window with everything about it: description, damage and healing with your current stats, mana, status effect chance, level; or a monster's stats, weakness, moves, how hard you hit each other and its rewards. In battle, tap the little **i** on a skill button (or press and hold the button). A normal tap still casts the skill.

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
- `info-pop.js`: the info windows for skills and monsters (what they show, and tap/hover/long-press handling).
- `menu.js`: the phone menu (main menu tiles and bottom tab bar). Only shows on screens 700px wide or less.
- `gear-art.js`: the pixel-art sword and armor pictures, colored in each ore's color, drawn in code from little text maps.
- `skill-art.js`: the pixel-art pictures for the 15 skills, colored per element, drawn the same way.
- `monster-art.js`: the pixel-art monsters (colored by their element) and the 10 bosses, with each boss's title, description and backstory. Also picks each monster's idle animation.
- `zone-art.js`: the faint pixel landscape behind the danger level in the Adventure panel, one scene per zone (cave, mine, lava, mountains, crystals, ruins, tundra, desert, abyss, starry crown).
- `icons.js`: the pixel-art icons for the menu, tab bar, panel titles and top bar (pickaxe, anvil, shield, swords, scroll, arrow, ghost, coin, gear, house), drawn in code from little text maps.
- `fonts/`: the Jersey 15 pixel font used for titles and numbers (free, SIL Open Font License in `fonts/OFL.txt`).

When you change `style.css`, `game.js`, `menu.js` or `icons.js`, raise the `?v=` number after their names in `index.html` (for example `?v=10` to `?v=11`). That makes phones and browsers load the new files instead of an old saved copy.
