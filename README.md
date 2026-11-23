# Peak Idle

A small idle game you play in your browser. Mine ore, smith weapons and armor, sell them for coins, grow your mine, and fight monsters.

## How to play

1. **Mine**: click an ore (start with copper) to dig it up.
2. **Forge**: when you have enough ore, smith a weapon (sword, axe, spear, bow, staff) or a piece of armor (helmet, chestplate, gloves, boots, shield). Every type can be made from every ore, and better ores make stronger gear.
3. **Sell** your gear for coins (sold gear is gone for good), or **equip** it.
4. **Hero**: equipped gear raises your stats: HP, attack, defense, agility, skill power and luck. Heavy armor gives more defense, light armor more agility. Luck is your chance of a critical hit (double damage).
5. **Adventure**: fight monsters, one area at a time. Beating a monster unlocks the next one, and each area ends with a boss.
   - Battles are turn based. Each turn you **Attack**, **Guard** (take much less damage, great when a monster winds up a heavy attack) or **Run away**.
   - You start each battle with 3 mana and get 1 more each turn, up to 5. Mana powers your skills: click an equipped skill to cast it.
   - Every monster has an element: 🔥 Fire, ❄️ Ice, 🌪️ Wind, 🪨 Earth or ⚡ Lightning. Fire beats Ice, Ice beats Wind, Wind beats Earth, Earth beats Lightning, Lightning beats Fire. Hitting a weakness does 50% more damage, hitting an element it resists does half.
   - Winning gives coins and essences of the monster's element (shown under Adventure). After any fight that monster rests for 15 minutes, even if you close the game. Losing costs nothing.
6. **Merchant**: spend essences on 15 skills (3 per element: low, mid and high grade, costing 1, 2 or 3 mana). Most deal elemental damage, some heal, guard, stun or weaken. Buy a skill again to level it up (+25% strength per level, each level costs more). Equip up to 3 skills for your next fight. Skill power adds to your attack for skills, so a staff helps a lot.
7. **Elemental weapons**: in the Forge, pick an element above the weapons before you smith. The new weapon costs some essences too, and your basic attack then uses that element.
8. **Spend coins** on miners (they dig for you, even while the game is closed, up to 8 hours), a better pickaxe (more ore per click), a master anvil (gear sells for more), and new mines: iron, gold and mithril.

Your progress saves automatically in your browser.

## Running it

- **On your computer**: download the files and double-click `index.html`.
- **Online**: turn on GitHub Pages (Settings → Pages → Branch: `main`, folder `/ (root)` → Save). After a minute the game is live at `https://peakbali.github.io/peakidle/`.

## Files

- `index.html`: the page layout
- `style.css`: colors and layout
- `game.js`: all the game rules. Ores, gear types, stats, elements, monsters, prices and upgrades are at the top, easy to tweak.
