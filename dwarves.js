// ---------- Dwarf miners ----------
// One little animated dwarf per opened mine, drawn in code as pixel art (no image files).
// Every ore has its own dwarf: helmet, beard, headlamp, clothes, tool and mining move.
// The dwarf works faster for every 10 miners you hire at that ore (up to speed 10).
// With no miners the dwarf sleeps. Purely for looks: nothing here touches the game or the save.
//
// The drawing is a tiny 28 x 22 pixel grid. The dwarf stands on the left facing right,
// a rock with ore specks sits on the right, and the tool swings around the dwarf's hand.

const DWARF_SPEED_STEP = 10;   // +1 speed for every 10 miners
const DWARF_MAX_SPEED = 10;    // speed 10 is reached at 90 miners
const DWARF_SPEED_GAIN = 0.3;  // each speed step makes the move 30% quicker than speed 1

// Each ore's dwarf. Colors: helmet, beard, tunic, tool metal, sparks, ore specks in the rock.
// anim is the mining move (see DWARF_ANIMS below), base = seconds per move at speed 1.
const DWARF_LOOKS = {
  copper:     { helmet: "cap",    helmetC: "#c0762f", lamp: "#ffe27a", beard: "short",  beardC: "#c2562b", tunic: "#5a7a3a", tool: "pick",    toolC: "#d9843f", spark: "#ffb347", ore: "#e07b39", anim: "swing" },
  iron:       { helmet: "horned", helmetC: "#8d949c", lamp: null,      beard: "long",   beardC: "#5a3a26", tunic: "#6b4a3a", tool: "hammer",  toolC: "#b4bac1", spark: "#fff1c4", ore: "#c8ccd2", anim: "smash" },
  gold:       { helmet: "crown",  helmetC: "#e5b53a", lamp: null,      beard: "braid",  beardC: "#e8c66a", tunic: "#8a2f3a", tool: "pick",    toolC: "#f2c94c", spark: "#ffe066", ore: "#f5c542", anim: "double" },
  mithril:    { helmet: "visor",  helmetC: "#9fc4e8", lamp: "#9ff0ff", beard: "forked", beardC: "#e8eef2", tunic: "#2f4f7a", tool: "chisel",  toolC: "#bfe3ff", spark: "#9ff0ff", ore: "#5fb0ff", anim: "tap" },
  adamant:    { helmet: "spiky",  helmetC: "#3f8f4a", lamp: null,      beard: "huge",   beardC: "#2b2b2b", tunic: "#4a5a2a", tool: "mattock", toolC: "#4fc26a", spark: "#8dff9a", ore: "#3ecf5c", anim: "slam" },
  obsidian:   { helmet: "hood",   helmetC: "#3d2c52", lamp: "#ff7bf0", beard: "long",   beardC: "#8f8f8f", tunic: "#2a2230", tool: "drill",   toolC: "#9a6ad0", spark: "#d39bff", ore: "#8e4fd6", anim: "drill" },
  moonsilver: { helmet: "pointy", helmetC: "#5d6b9a", lamp: null,      beard: "huge",   beardC: "#f0f0ff", tunic: "#3a4470", tool: "pick",    toolC: "#dfe6ff", spark: "#eef2ff", ore: "#cfd8ff", anim: "glide" },
  sunstone:   { helmet: "horned", helmetC: "#d9682b", lamp: "#ffd23f", beard: "forked", beardC: "#e0662a", tunic: "#7a3a1a", tool: "hammer",  toolC: "#ffb02e", spark: "#ff8a1a", ore: "#ffb020", anim: "bounce" },
  starmetal:  { helmet: "crown",  helmetC: "#7f8fd9", lamp: "#fff59a", beard: "braid",  beardC: "#c8d4ff", tunic: "#2a3a6a", tool: "star",    toolC: "#ffe27a", spark: "#fff59a", ore: "#ffe27a", anim: "twirl" },
  voidsteel:  { helmet: "hood",   helmetC: "#1d1630", lamp: null,      beard: "long",   beardC: "#5b3f8f", tunic: "#191326", tool: "void",    toolC: "#a66bff", spark: "#b36bff", ore: "#a66bff", anim: "pulse", glowEyes: true },
};

// Mining moves. tool = keyframes for the tool angle (0 = held straight up, about 100 = hitting the rock).
// hits = when in the move the tool hits the rock (0..1), that's when sparks fly and the dwarf bobs.
// split = the move repeats this many times per cycle (fast small taps / drill buzz).
const DWARF_ANIMS = {
  swing:  { base: 1.6, hits: [0.58], tool: "0%{transform:rotate(-20deg)}45%{transform:rotate(-35deg)}58%{transform:rotate(100deg)}70%{transform:rotate(100deg)}100%{transform:rotate(-20deg)}" },
  smash:  { base: 1.9, hits: [0.55], shake: true, tool: "0%{transform:rotate(-10deg)}40%{transform:rotate(-60deg)}55%{transform:rotate(102deg)}74%{transform:rotate(102deg)}100%{transform:rotate(-10deg)}" },
  double: { base: 1.8, hits: [0.2, 0.5], tool: "0%{transform:rotate(-20deg)}20%{transform:rotate(100deg)}32%{transform:rotate(25deg)}50%{transform:rotate(100deg)}64%{transform:rotate(-20deg)}100%{transform:rotate(-20deg)}" },
  tap:    { base: 1.6, hits: [0.125, 0.375, 0.625, 0.875], tool: "0%,25%,50%,75%,100%{transform:rotate(68deg)}12.5%,37.5%,62.5%,87.5%{transform:rotate(100deg)}" },
  slam:   { base: 2.2, hits: [0.6], shake: true, jump: true, tool: "0%{transform:rotate(-30deg)}48%{transform:rotate(-75deg)}60%{transform:rotate(106deg)}80%{transform:rotate(106deg)}100%{transform:rotate(-30deg)}" },
  drill:  { base: 1.5, hits: [0.1, 0.35, 0.6, 0.85], buzz: true, tool: "0%{transform:rotate(97deg) translate(0,0)}20%{transform:rotate(99deg) translate(0.4px,0)}40%{transform:rotate(96deg) translate(0,0.4px)}60%{transform:rotate(99deg) translate(-0.3px,0)}80%{transform:rotate(97deg) translate(0,-0.3px)}100%{transform:rotate(97deg) translate(0,0)}" },
  glide:  { base: 2.4, hits: [0.5], float: true, tool: "0%{transform:rotate(-45deg)}50%{transform:rotate(100deg)}62%{transform:rotate(100deg)}100%{transform:rotate(-45deg)}" },
  bounce: { base: 1.7, hits: [0.3, 0.7], tool: "0%{transform:rotate(-25deg)}30%{transform:rotate(100deg)}45%{transform:rotate(40deg)}70%{transform:rotate(100deg)}100%{transform:rotate(-25deg)}" },
  twirl:  { base: 2.2, hits: [0.6], tool: "0%{transform:rotate(-20deg)}35%{transform:rotate(-380deg)}60%{transform:rotate(100deg)}74%{transform:rotate(100deg)}100%{transform:rotate(-20deg)}" },
  pulse:  { base: 2.0, hits: [0.6], tool: "0%{transform:rotate(-30deg)}50%{transform:rotate(-30deg)}60%{transform:rotate(100deg)}78%{transform:rotate(100deg)}100%{transform:rotate(-30deg)}" },
};

// ----- Drawing helpers -----

function dwR(x, y, w, h, color, extra = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"${extra}/>`;
}

// Darken or lighten a #rrggbb color (amount -1..1).
function dwShade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.round(Math.max(0, Math.min(255, v)));
  });
  return "#" + ch.map(c => c.toString(16).padStart(2, "0")).join("");
}

function dwHelmet(kind, c) {
  const dark = dwShade(c, -0.35), light = dwShade(c, 0.35);
  switch (kind) {
    case "cap": // miner's hard hat with a brim
      return dwR(6, 3, 4, 1, light) + dwR(5, 4, 6, 2, c) + dwR(4, 6, 8, 1, dark);
    case "horned": // round helmet with two horns
      return dwR(6, 3, 4, 1, light) + dwR(5, 4, 6, 3, c) + dwR(5, 6, 6, 1, dark)
        + dwR(3, 3, 2, 1, "#efe6cf") + dwR(3, 2, 1, 1, "#efe6cf") + dwR(11, 3, 2, 1, "#efe6cf") + dwR(12, 2, 1, 1, "#efe6cf");
    case "crown": // metal band with points
      return dwR(5, 5, 6, 2, c) + dwR(5, 6, 6, 1, dark) + dwR(5, 4, 1, 1, c) + dwR(7, 3, 2, 2, c) + dwR(10, 4, 1, 1, c)
        + dwR(7, 5, 2, 1, "#d33") + dwR(8, 3, 1, 1, light);
    case "visor": // smooth helmet with a visor line above the eye
      return dwR(6, 2, 4, 1, light) + dwR(5, 3, 6, 4, c) + dwR(8, 6, 4, 1, dark) + dwR(4, 5, 1, 2, dark);
    case "spiky": // helmet with a spike on top and studs
      return dwR(7, 1, 2, 2, light) + dwR(6, 3, 4, 1, c) + dwR(5, 4, 6, 3, c) + dwR(5, 6, 6, 1, dark)
        + dwR(6, 5, 1, 1, light) + dwR(9, 5, 1, 1, light);
    case "hood": // cloth hood falling down the back
      return dwR(6, 3, 4, 1, c) + dwR(5, 4, 6, 3, c) + dwR(4, 5, 2, 7, c) + dwR(3, 8, 1, 5, dark) + dwR(10, 4, 1, 3, dark);
    case "pointy": // tall pointed hat leaning back, with a little star
      return dwR(4, 6, 8, 1, dark) + dwR(5, 4, 6, 2, c) + dwR(5, 3, 4, 1, c) + dwR(4, 2, 3, 1, c) + dwR(3, 1, 2, 1, c)
        + dwR(2, 0, 1, 1, c) + dwR(7, 4, 1, 1, "#fff6b0");
    default:
      return "";
  }
}

function dwBeard(kind, c) {
  const dark = dwShade(c, -0.3);
  switch (kind) {
    case "short":
      return dwR(6, 10, 5, 2, c) + dwR(7, 12, 3, 1, c) + dwR(9, 10, 3, 1, dark);
    case "long":
      return dwR(6, 10, 5, 3, c) + dwR(7, 13, 4, 2, c) + dwR(8, 15, 2, 1, c) + dwR(9, 10, 3, 1, dark);
    case "forked":
      return dwR(6, 10, 5, 2, c) + dwR(6, 12, 2, 3, c) + dwR(9, 12, 2, 3, c) + dwR(9, 10, 3, 1, dark);
    case "braid":
      return dwR(6, 10, 5, 2, c) + dwR(8, 12, 2, 4, c) + dwR(8, 13, 2, 1, dark) + dwR(8, 16, 2, 1, "#e5b53a") + dwR(9, 10, 3, 1, dark);
    case "huge":
      return dwR(5, 9, 7, 4, c) + dwR(5, 13, 6, 2, c) + dwR(6, 15, 4, 2, c) + dwR(9, 10, 3, 1, dark);
    default:
      return "";
  }
}

// Tool held straight up from the hand at (13.5, 12.5). It is rotated around that point.
function dwTool(kind, c) {
  const wood = "#8a5a2b", dark = dwShade(c, -0.35), light = dwShade(c, 0.4);
  switch (kind) {
    case "pick":
      return dwR(13, 4, 1, 9, wood) + dwR(10, 3, 7, 1, c) + dwR(9, 4, 1, 1, c) + dwR(17, 4, 1, 1, c) + dwR(12, 3, 3, 1, light);
    case "hammer":
      return dwR(13, 5, 1, 8, wood) + dwR(11, 2, 5, 3, c) + dwR(11, 2, 5, 1, light) + dwR(11, 4, 5, 1, dark);
    case "chisel": // small rock hammer with one pointed end: quick light taps
      return dwR(13, 6, 1, 7, wood) + dwR(11, 5, 5, 1, c) + dwR(16, 6, 1, 1, c) + dwR(11, 4, 2, 1, light);
    case "mattock": // big two-headed digging tool
      return dwR(13, 3, 1, 10, wood) + dwR(9, 2, 9, 2, c) + dwR(8, 3, 1, 2, c) + dwR(18, 3, 1, 2, c) + dwR(9, 2, 9, 1, light) + dwR(12, 1, 3, 1, dark);
    case "drill": // hand drill: grip, body and spinning bit
      return dwR(13, 8, 1, 5, wood) + dwR(12, 5, 3, 3, c) + dwR(12, 5, 1, 3, light) + dwR(12, 4, 3, 1, dark)
        + `<g class="dw-bit">${dwR(13, 0, 1, 4, "#e8e8e8")}${dwR(12, 2, 1, 1, "#bdbdbd")}${dwR(14, 1, 1, 1, "#bdbdbd")}</g>`;
    case "star": // hammer topped with a star
      return dwR(13, 5, 1, 8, wood) + dwR(11, 3, 5, 2, c) + dwR(11, 3, 5, 1, light)
        + dwR(13, 0, 1, 3, "#fff59a") + dwR(12, 1, 3, 1, "#fff59a");
    case "void": // curved one-sided pick that glows
      return dwR(13, 4, 1, 9, "#2a1f3d") + `<g class="dw-glow">${dwR(13, 3, 5, 1, c)}${dwR(17, 4, 1, 1, c)}${dwR(18, 5, 1, 1, c)}${dwR(11, 3, 2, 1, c)}</g>`
        + dwR(14, 3, 2, 1, light);
    default:
      return "";
  }
}

// The full drawing of one ore's dwarf.
function dwarfSVG(oreId) {
  const L = DWARF_LOOKS[oreId] || DWARF_LOOKS.copper;
  const skin = "#e8b48a", skinDark = "#c98d63", boot = "#3b2a1e", pants = "#4b3b30";
  const tunicDark = dwShade(L.tunic, -0.3);
  const eyeC = L.glowEyes ? "#d7a6ff" : "#241a14";

  // Sparks: a few pixels that fly away from where the tool hits the rock.
  const sparkDirs = [[-3, -4], [0, -5], [3, -3], [-4, -1], [2, -6]];
  const sparks = sparkDirs.map(([dx, dy], i) =>
    `<rect class="dw-spark" x="21" y="13" width="1" height="1" fill="${i % 2 ? "#fff" : L.spark}" style="--dx:${dx}px;--dy:${dy}px"/>`).join("");

  // Floating "z z" for a sleeping dwarf.
  const zee = (x, y, cls) => `<g class="dw-z ${cls}">${dwR(x, y, 4, 1, "#cfd6ff")}${dwR(x + 2, y + 1, 1, 1, "#cfd6ff")}${dwR(x + 1, y + 2, 1, 1, "#cfd6ff")}${dwR(x, y + 3, 4, 1, "#cfd6ff")}</g>`;

  const lamp = L.lamp
    ? `<polygon class="dw-beam" points="12,4 19,1 19,9" fill="${L.lamp}" opacity="0.22"/>` + dwR(10, 4, 2, 2, L.lamp) + dwR(10, 5, 2, 1, dwShade(L.lamp, -0.3))
    : "";

  return `
<svg class="dw-svg" viewBox="0 0 28 22" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
  <g class="dw-rock">
    ${dwR(20, 14, 5, 1, "#7a7068")}${dwR(19, 15, 7, 2, "#6b6259")}${dwR(18, 17, 9, 5, "#5d554e")}${dwR(18, 20, 9, 2, "#4a433d")}
    ${dwR(21, 16, 1, 1, L.ore)}${dwR(24, 17, 1, 1, L.ore)}${dwR(20, 19, 1, 1, L.ore)}${dwR(23, 19, 2, 1, L.ore)}${dwR(25, 15, 1, 1, dwShade(L.ore, 0.4))}
  </g>
  <g class="dw-body">
    ${dwR(4, 20, 3, 2, boot)}${dwR(8, 20, 3, 2, boot)}
    ${dwR(4, 18, 3, 2, pants)}${dwR(8, 18, 3, 2, pants)}
    ${dwR(2, 13, 2, 3, tunicDark)}
    ${dwR(3, 12, 9, 6, L.tunic)}${dwR(3, 16, 9, 1, boot)}${dwR(7, 16, 1, 1, "#e5b53a")}
    ${dwR(5, 7, 6, 4, skin)}${dwR(11, 9, 1, 1, skinDark)}${dwR(5, 8, 1, 2, skinDark)}
    <g class="dw-eye-open">${dwR(9, 8, 1, 1, eyeC)}</g>
    <g class="dw-eye-shut">${dwR(8, 8, 2, 1, "#5a4030")}</g>
    ${dwHelmet(L.helmet, L.helmetC)}
    ${lamp}
    ${dwBeard(L.beard, L.beardC)}
    ${dwR(10, 12, 2, 2, tunicDark)}
    <g class="dw-tool">${dwTool(L.tool, L.toolC)}${dwR(12, 12, 2, 2, skin)}</g>
  </g>
  <g class="dw-sparks">${sparks}</g>
  ${zee(13, 4, "z1")}${zee(17, 0, "z2")}
</svg>`;
}

// ----- Speed -----

// 0 = sleeping (no miners), 1..10 = one step for every 10 miners.
function dwarfSpeed(miners) {
  if (!(miners > 0)) return 0;
  return Math.min(DWARF_MAX_SPEED, Math.floor(miners / DWARF_SPEED_STEP) + 1);
}

function dwarfCaption(miners) {
  const sp = dwarfSpeed(miners);
  if (sp === 0) return ["💤 Asleep", "Hire a miner to wake up"];
  if (sp >= DWARF_MAX_SPEED) return [`⚡ Speed ${sp}`, "Top speed!"];
  return [`⚡ Speed ${sp}`, `Next at ${sp * DWARF_SPEED_STEP} miners`];
}

// Called from render(): only touches the page when the speed step changes.
function updateDwarf(box, oreId, miners) {
  if (!box) return;
  const sp = dwarfSpeed(miners);
  const [main, next] = dwarfCaption(miners);
  const a = box.querySelector(".dw-speed"), b = box.querySelector(".dw-next");
  setIconText(a, main);
  setIconText(b, next);
  if (box.dataset.speed === String(sp)) return;
  box.dataset.speed = String(sp);
  const fig = box.querySelector(".dwarf");
  fig.classList.toggle("sleep", sp === 0);
  const look = DWARF_LOOKS[oreId] || DWARF_LOOKS.copper;
  const base = DWARF_ANIMS[look.anim].base;
  const dur = sp === 0 ? base : base / (1 + DWARF_SPEED_GAIN * (sp - 1));
  fig.style.setProperty("--dur", dur.toFixed(2) + "s");
}

function dwarfHTML(oreId, oreName) {
  const look = DWARF_LOOKS[oreId] || DWARF_LOOKS.copper;
  return `
    <div class="dwarf-box">
      <div class="dwarf dw-${look.anim}" title="Your ${oreName} dwarf. Every 10 miners make the dwarf dig faster (top speed 10 at 90 miners).">${dwarfSVG(oreId)}</div>
      <div class="dw-caption small"><div class="dw-speed"></div><div class="dw-next"></div></div>
    </div>`;
}

// ----- Animation CSS (built once from DWARF_ANIMS so sparks line up with each hit) -----

function dwarfKeyframesCSS() {
  const pct = v => +(v * 100).toFixed(2);
  let css = "";
  for (const [name, a] of Object.entries(DWARF_ANIMS)) {
    css += `@keyframes dw-tool-${name}{${a.tool}}\n`;
    css += `.dwarf.dw-${name}:not(.sleep) .dw-tool{animation:dw-tool-${name} var(--dur) ease-in-out infinite}\n`;

    // Sparks: invisible until a hit, then they fly out and fade.
    let sp = "0%{opacity:0;transform:translate(0,0)}";
    let bob = "0%{transform:translate(0,0)}";
    let rock = "0%{transform:translate(0,0)}";
    for (const h of a.hits) {
      const t = pct(h);
      const end = Math.min(pct(h + 0.14), 99.9);
      sp += `${Math.max(t - 0.1, 0)}%{opacity:0;transform:translate(0,0)}${t}%{opacity:1;transform:translate(0,0)}${end}%{opacity:0;transform:translate(var(--dx),var(--dy))}`;
      bob += `${Math.max(t - 3, 0)}%{transform:translate(0,${a.jump ? "-1.5px" : "0"})}${t}%{transform:translate(0,0.6px)}${Math.min(t + 6, 99.9)}%{transform:translate(0,0)}`;
      rock += `${Math.max(t - 0.1, 0)}%{transform:translate(0,0)}${t}%{transform:translate(0.6px,0)}${Math.min(t + 3, 99.9)}%{transform:translate(-0.6px,0)}${Math.min(t + 6, 99.9)}%{transform:translate(0,0)}`;
    }
    sp += "100%{opacity:0;transform:translate(var(--dx),var(--dy))}";
    bob += "100%{transform:translate(0,0)}";
    rock += "100%{transform:translate(0,0)}";
    css += `@keyframes dw-spark-${name}{${sp}}\n@keyframes dw-bob-${name}{${bob}}\n`;
    css += `.dwarf.dw-${name}:not(.sleep) .dw-spark{animation:dw-spark-${name} var(--dur) linear infinite}\n`;
    css += `.dwarf.dw-${name}:not(.sleep) .dw-body{animation:dw-bob-${name} var(--dur) ease-in-out infinite}\n`;
    if (a.shake) {
      css += `@keyframes dw-rock-${name}{${rock}}\n.dwarf.dw-${name}:not(.sleep) .dw-rock{animation:dw-rock-${name} var(--dur) linear infinite}\n`;
    }
  }
  return css;
}

(function injectDwarfCSS() {
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.id = "dwarf-anim-css";
  style.textContent = dwarfKeyframesCSS();
  document.head.appendChild(style);
  // Stop all dwarf animations while the tab is hidden, to save battery.
  const sync = () => document.body.classList.toggle("dw-paused", document.hidden);
  document.addEventListener("visibilitychange", sync);
  sync();
})();
