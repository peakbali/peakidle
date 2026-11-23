// ---------- Player profile: name and look ----------
// Your hero's name and appearance, drawn in code as pixel art (no image files).
// The look is shown in the settings menu, the Hero panel and on the battle screen.
// Purely for looks: it never changes stats.
//
// The drawing is a 24 x 32 pixel grid of a hero standing and facing you.
// The portrait is the same drawing, zoomed in on the head.

const AVATAR_W = 24, AVATAR_H = 32;
const AVATAR_NAME_MAX = 16;

// Every choice in the editor. "colors" lists are swatches, the others are named styles.
const AVATAR_OPTIONS = {
  skin: { label: "Skin", colors: [
    { id: "porcelain", c: "#ffe0c4" }, { id: "peach", c: "#f1c194" }, { id: "tan", c: "#d9a06b" },
    { id: "bronze", c: "#b47a4c" }, { id: "brown", c: "#8a5734" }, { id: "deep", c: "#5e3a23" },
    { id: "orc", c: "#8fb874" }, { id: "frost", c: "#a9bde6" },
  ] },
  hair: { label: "Hair", styles: [
    { id: "short", name: "Short" }, { id: "long", name: "Long" }, { id: "spiky", name: "Spiky" },
    { id: "ponytail", name: "Ponytail" }, { id: "bun", name: "Bun" }, { id: "mohawk", name: "Mohawk" },
    { id: "curly", name: "Curly" }, { id: "bald", name: "Bald" },
  ] },
  hairColor: { label: "Hair color", colors: [
    { id: "black", c: "#2b211c" }, { id: "darkbrown", c: "#5a3a22" }, { id: "brown", c: "#8a5a30" },
    { id: "auburn", c: "#a63f26" }, { id: "ginger", c: "#d9772e" }, { id: "blonde", c: "#e8c66a" },
    { id: "silver", c: "#e2e2ea" }, { id: "gray", c: "#8d8d96" }, { id: "blue", c: "#4a7ad9" },
    { id: "green", c: "#4fae5a" }, { id: "pink", c: "#e070b0" }, { id: "purple", c: "#8a5ad9" },
  ] },
  eyes: { label: "Eyes", styles: [
    { id: "round", name: "Round" }, { id: "big", name: "Big" }, { id: "narrow", name: "Narrow" },
    { id: "fierce", name: "Fierce" }, { id: "happy", name: "Happy" }, { id: "patch", name: "Eye patch" },
  ] },
  eyeColor: { label: "Eye color", colors: [
    { id: "brown", c: "#5a3a22" }, { id: "blue", c: "#3f7fd9" }, { id: "green", c: "#3f9a4a" },
    { id: "gray", c: "#6f7880" }, { id: "amber", c: "#d9962e" }, { id: "violet", c: "#8a5ad9" },
    { id: "red", c: "#c8382c" },
  ] },
  beard: { label: "Beard", styles: [
    { id: "none", name: "None" }, { id: "stubble", name: "Stubble" }, { id: "mustache", name: "Mustache" },
    { id: "short", name: "Short beard" }, { id: "long", name: "Long beard" }, { id: "braided", name: "Braided" },
  ] },
  outfit: { label: "Outfit", colors: [
    { id: "red", c: "#a8342c" }, { id: "blue", c: "#2f5a9e" }, { id: "green", c: "#3f7a3a" },
    { id: "purple", c: "#6a3f8f" }, { id: "teal", c: "#2a7a78" }, { id: "orange", c: "#c8642a" },
    { id: "gold", c: "#c99a2e" }, { id: "brown", c: "#7a5232" }, { id: "black", c: "#35303c" },
    { id: "white", c: "#d8d2c4" },
  ] },
  headgear: { label: "Headgear", styles: [
    { id: "none", name: "None" }, { id: "headband", name: "Headband" }, { id: "hood", name: "Hood" },
    { id: "helm", name: "Iron helm" }, { id: "horned", name: "Horned helm" }, { id: "wizard", name: "Wizard hat" },
    { id: "crown", name: "Crown" },
  ] },
};
const AVATAR_ORDER = ["skin", "hair", "hairColor", "eyes", "eyeColor", "beard", "outfit", "headgear"];

// The look every player starts with (also used for older saves).
const AVATAR_DEFAULT = {
  name: "Hero", skin: "peach", hair: "short", hairColor: "brown", eyes: "round",
  eyeColor: "brown", beard: "none", outfit: "blue", headgear: "none",
};

function avatarChoices(key) {
  const o = AVATAR_OPTIONS[key];
  return o.colors || o.styles;
}

// Clean up a saved profile: unknown values fall back to the default, the name is trimmed.
function normalizeProfile(p) {
  const out = { ...AVATAR_DEFAULT };
  if (!p || typeof p !== "object") return out;
  if (typeof p.name === "string") {
    const name = p.name.replace(/\s+/g, " ").trim().slice(0, AVATAR_NAME_MAX);
    if (name) out.name = name;
  }
  for (const key of AVATAR_ORDER) {
    if (avatarChoices(key).some(ch => ch.id === p[key])) out[key] = p[key];
  }
  return out;
}

// Makes a color darker (f < 1) or lighter (f > 1).
function avatarShade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map(v => {
    const x = f < 1 ? v * f : v + (255 - v) * (f - 1);
    return Math.max(0, Math.min(255, Math.round(x)));
  });
  return "#" + ch.map(v => v.toString(16).padStart(2, "0")).join("");
}

function avatarColor(key, id) {
  const ch = AVATAR_OPTIONS[key].colors.find(c => c.id === id);
  return ch ? ch.c : AVATAR_OPTIONS[key].colors[0].c;
}

// Paints the hero onto a grid of colors (null = empty).
function avatarGrid(p) {
  const g = Array.from({ length: AVATAR_H }, () => Array(AVATAR_W).fill(null));
  const px = (x, y, c) => { if (x >= 0 && x < AVATAR_W && y >= 0 && y < AVATAR_H) g[y][x] = c; };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
  // Draws on both sides at once (the hero is symmetric): x is on the left half.
  const mirror = (x, y, w, h, c) => { rect(x, y, w, h, c); rect(AVATAR_W - x - w, y, w, h, c); };

  const skin = avatarColor("skin", p.skin), skinD = avatarShade(skin, 0.8), skinL = avatarShade(skin, 1.15);
  const hair = avatarColor("hairColor", p.hairColor), hairD = avatarShade(hair, 0.72), hairL = avatarShade(hair, 1.25);
  const eye = avatarColor("eyeColor", p.eyeColor);
  const cloth = avatarColor("outfit", p.outfit), clothD = avatarShade(cloth, 0.7), clothL = avatarShade(cloth, 1.2);
  const pants = "#4a3a30", pantsD = "#352a23", boot = "#5c3a22", bootD = "#3e2717";
  const leather = "#6b4423", buckle = "#e5b53a", white = "#f4f1ea", dark = "#2a1c16";
  const steel = "#a7aeb6", steelD = "#6c747c", steelL = "#dfe5ea", gold = "#e5b53a", goldD = "#a8771f", goldL = "#ffe58f";

  // Long hair falls behind the shoulders, so it goes first.
  if (p.hair === "long") { mirror(6, 9, 2, 10, hair); mirror(6, 17, 1, 2, hairD); }
  if (p.hair === "curly") { mirror(5, 8, 3, 8, hair); mirror(5, 10, 1, 1, hairD); mirror(6, 13, 1, 1, hairD); }

  // Legs and boots
  rect(8, 25, 3, 4, pants); rect(13, 25, 3, 4, pants); rect(10, 25, 1, 4, pantsD); rect(15, 25, 1, 4, pantsD);
  rect(7, 29, 4, 2, boot); rect(13, 29, 4, 2, boot); rect(7, 30, 4, 1, bootD); rect(13, 30, 4, 1, bootD);
  // Body: a tunic with a belt
  rect(7, 17, 10, 8, cloth);
  rect(15, 17, 2, 8, clothD); rect(7, 17, 1, 8, clothL);
  rect(10, 17, 4, 1, skinD); px(11, 18, skinD); px(12, 18, skinD); // neckline
  rect(7, 22, 10, 1, leather); rect(11, 22, 2, 1, buckle);
  rect(8, 23, 8, 2, cloth); rect(14, 23, 2, 2, clothD); // tunic skirt over the legs
  // Arms (sleeves) and hands
  rect(5, 17, 2, 6, cloth); rect(17, 17, 2, 6, clothD); px(5, 17, clothL);
  rect(5, 23, 2, 2, skin); rect(17, 23, 2, 2, skinD);
  // Neck and head
  rect(10, 15, 4, 2, skinD);
  rect(7, 6, 10, 10, skin);
  rect(15, 7, 2, 9, skinD); rect(8, 15, 8, 1, skinD);   // shade on the right and under the chin
  rect(8, 7, 2, 1, skinL);
  mirror(6, 10, 1, 2, skin); px(17, 11, skinD);           // ears
  // Mouth and nose
  rect(11, 13, 2, 1, avatarShade(skin, 0.6));
  px(12, 11, skinD);

  // Eyes (row 10-11), left eye at x 9, right eye at x 14
  const eyesAt = (fn) => { fn(9, 1); fn(14, -1); };
  switch (p.eyes) {
    case "big": eyesAt((x, s) => { px(x, 10, white); px(x - s, 10, white); px(x, 11, eye); px(x - s, 11, white); px(x, 9, dark); px(x - s, 9, dark); }); break;
    case "narrow": eyesAt((x, s) => { px(x, 11, dark); px(x - s, 11, dark); }); break;
    case "fierce": eyesAt((x, s) => { px(x, 10, eye); px(x, 11, eye); px(x + s, 9, dark); px(x, 9, dark); px(x - s, 8, dark); }); break;
    case "happy": eyesAt((x, s) => { px(x, 10, dark); px(x - s, 11, dark); px(x + s, 11, dark); }); rect(11, 13, 2, 1, "#c8564a"); break;
    case "patch":
      px(9, 10, eye); px(9, 11, eye);
      rect(13, 10, 3, 2, dark); rect(7, 9, 10, 1, dark); // patch and its strap
      break;
    default: eyesAt((x) => { px(x, 10, eye); px(x, 11, eye); px(x, 10, avatarShade(eye, 1.5)); }); px(9, 11, eye); px(14, 11, eye);
  }
  // Rosy cheeks for the happy face
  if (p.eyes === "happy") { px(8, 12, avatarShade(skin, 0.9)); px(15, 12, avatarShade(skin, 0.75)); }

  // Beard and mustache (same color as the hair)
  switch (p.beard) {
    case "stubble":
    {
      // A shadow of hair on the jaw: skin mixed with the hair color.
      const mix = (c1, c2) => "#" + [1, 3, 5].map(i => Math.round((parseInt(c1.substr(i, 2), 16) + parseInt(c2.substr(i, 2), 16)) / 2).toString(16).padStart(2, "0")).join("");
      const st = mix(skin, hair), stD = mix(skinD, hair);
      rect(7, 13, 10, 3, st); rect(15, 13, 2, 3, stD); rect(8, 15, 8, 1, stD); rect(7, 12, 1, 1, st); px(16, 12, stD);
      rect(10, 12, 4, 1, st);
      rect(11, 13, 2, 1, avatarShade(skin, 0.6));
    }
      break;
    case "mustache":
      rect(9, 12, 6, 1, hair); px(9, 13, hair); px(14, 13, hairD);
      break;
    case "short":
      rect(7, 12, 10, 4, hair); rect(8, 16, 8, 1, hair); rect(15, 12, 2, 5, hairD);
      rect(11, 13, 2, 1, avatarShade(skin, 0.6)); rect(9, 12, 6, 1, hairD); px(10, 14, hairL);
      break;
    case "long":
      rect(7, 12, 10, 4, hair); rect(8, 16, 8, 3, hair); rect(9, 19, 6, 2, hair); rect(10, 21, 4, 1, hair);
      rect(14, 14, 2, 6, hairD); rect(11, 13, 2, 1, avatarShade(skin, 0.6)); rect(9, 12, 6, 1, hairD);
      px(10, 15, hairL); px(11, 18, hairL);
      break;
    case "braided":
      rect(7, 12, 10, 4, hair); rect(8, 16, 8, 1, hair); rect(15, 12, 2, 5, hairD);
      rect(11, 13, 2, 1, avatarShade(skin, 0.6)); rect(9, 12, 6, 1, hairD);
      rect(11, 17, 2, 6, hair); rect(11, 19, 2, 1, gold); rect(11, 22, 2, 1, gold); px(12, 17, hairD); px(12, 20, hairD);
      break;
  }

  // Hair on top of the head
  const top = () => { rect(7, 5, 10, 3, hair); rect(8, 4, 8, 1, hair); mirror(7, 8, 1, 2, hair); rect(15, 5, 2, 3, hairD); rect(9, 5, 3, 1, hairL); };
  switch (p.hair) {
    case "short": top(); rect(8, 8, 3, 1, hair); break;
    case "long": top(); rect(8, 8, 2, 1, hair); rect(13, 8, 3, 1, hair); break;
    case "spiky":
      top(); rect(8, 8, 2, 1, hair); px(12, 8, hair);
      for (const x of [7, 10, 13, 16]) { px(x, 3, hair); px(x, 4, hair); }
      for (const x of [8, 11, 14]) px(x, 2, hair);
      px(16, 3, hairD); px(15, 4, hairD);
      break;
    case "ponytail":
      top(); rect(8, 8, 4, 1, hair);
      rect(17, 6, 2, 3, hair); rect(18, 9, 2, 6, hair); px(19, 15, hairD); rect(17, 6, 1, 1, "#c8432f"); px(19, 11, hairD);
      break;
    case "bun":
      top(); rect(9, 8, 2, 1, hair); rect(13, 8, 2, 1, hair);
      rect(10, 1, 4, 3, hair); rect(13, 1, 1, 3, hairD); px(10, 1, hairL);
      break;
    case "mohawk":
      rect(11, 1, 2, 7, hair); px(12, 1, hairD); rect(12, 3, 1, 5, hairD); px(11, 2, hairL);
      mirror(7, 7, 1, 2, hairD);
      break;
    case "curly":
      rect(6, 4, 12, 4, hair); rect(7, 3, 10, 1, hair); mirror(7, 8, 1, 2, hair); rect(8, 8, 8, 1, hair);
      for (const [x, y] of [[8, 4], [11, 3], [14, 5], [10, 6], [15, 7], [7, 6]]) px(x, y, hairD);
      for (const [x, y] of [[9, 5], [12, 4], [13, 7]]) px(x, y, hairL);
      break;
  }

  // Headgear sits on top of everything
  switch (p.headgear) {
    case "headband": {
      const band = avatarShade(cloth, 1.1);
      rect(7, 7, 10, 1, band); rect(15, 7, 2, 1, clothD); px(17, 8, band); px(18, 9, band); px(18, 10, clothD);
      break;
    }
    case "hood":
      rect(6, 3, 12, 5, cloth); rect(7, 2, 10, 1, cloth); mirror(5, 6, 2, 11, cloth);
      rect(17, 6, 2, 11, clothD); rect(15, 3, 3, 5, clothD); rect(8, 3, 3, 1, clothL);
      rect(7, 7, 10, 1, clothD);                        // hood edge over the brow
      mirror(7, 8, 1, 2, clothD);
      rect(5, 16, 14, 2, cloth); rect(14, 16, 5, 2, clothD); // hood drapes on the shoulders
      break;
    case "helm":
    case "horned":
      rect(6, 4, 12, 4, steel); rect(7, 3, 10, 1, steel); rect(15, 4, 3, 4, steelD);
      rect(8, 4, 3, 1, steelL); rect(6, 7, 12, 1, steelD);
      mirror(6, 8, 1, 4, steel); px(17, 8, steelD); px(17, 9, steelD); px(17, 10, steelD); px(17, 11, steelD);
      rect(11, 8, 2, 3, steel); px(12, 9, steelD); px(12, 10, steelD);   // nose guard
      rect(11, 3, 2, 1, steelL);
      if (p.headgear === "horned") {
        const horn = "#efe3c4", hornD = "#b9a77e";
        rect(4, 4, 2, 2, horn); rect(3, 2, 2, 2, horn); px(3, 1, horn); px(4, 5, hornD);
        rect(18, 4, 2, 2, hornD); rect(19, 2, 2, 2, horn); px(20, 1, horn); px(19, 5, hornD);
      }
      break;
    case "wizard": {
      const hat = avatarShade(cloth, 0.95), hatD = avatarShade(cloth, 0.65);
      rect(5, 7, 14, 1, hatD); rect(6, 6, 12, 1, hat);
      rect(7, 5, 10, 1, gold);                          // golden band
      rect(8, 3, 8, 2, hat); rect(9, 1, 6, 2, hat); rect(10, 0, 4, 1, hat);
      rect(14, 1, 1, 4, hatD); rect(15, 3, 1, 2, hatD); px(14, 0, hatD); rect(15, 6, 3, 1, hatD);
      px(11, 3, goldL); px(13, 2, goldL);                // stars
      break;
    }
    case "crown":
      rect(7, 4, 10, 3, gold); rect(15, 4, 2, 3, goldD); rect(7, 6, 10, 1, goldD);
      for (const x of [7, 9, 11, 13, 15]) { px(x, 3, gold); }
      px(16, 3, goldD); px(8, 2, goldL); px(12, 2, goldL); px(16, 2, goldD);
      px(9, 5, "#c8382c"); px(12, 5, "#3f7fd9"); px(14, 5, "#3f9a4a");
      px(8, 4, goldL);
      break;
  }
  return g;
}

// Builds the SVG. view "full" = whole hero, "portrait" = just the head and shoulders.
function avatarSVG(profile, view = "full", cls = "") {
  const p = normalizeProfile(profile);
  const g = avatarGrid(p);
  const outline = "#140e0b";
  const filled = (x, y) => y >= 0 && y < AVATAR_H && x >= 0 && x < AVATAR_W && g[y][x];
  let rects = "";
  // Dark outline around the hero, one pixel wide.
  for (let y = 0; y < AVATAR_H; y++) {
    for (let x = 0; x < AVATAR_W; x++) {
      if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled(x + dx, y + dy))) {
        rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${outline}"/>`;
      }
    }
  }
  // One <rect> per run of same-colored pixels in a row keeps the SVG small.
  for (let y = 0; y < AVATAR_H; y++) {
    let x = 0;
    while (x < AVATAR_W) {
      const c = g[y][x];
      let end = x + 1;
      while (end < AVATAR_W && g[y][end] === c) end++;
      if (c) rects += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${c}"/>`;
      x = end;
    }
  }
  const box = view === "portrait" ? "3 0 18 18" : `0 0 ${AVATAR_W} ${AVATAR_H}`;
  return `<svg class="avatar ${cls}" viewBox="${box}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

// Text-safe version of the player's name, for putting into HTML.
function avatarNameHTML(name) {
  return String(name).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// ---------- The appearance editor window ----------
// Opens over the game with a live preview. Nothing is saved until you press Save.

let avatarDraft = null;

function openAvatarEditor() {
  const box = document.getElementById("avatar-editor");
  if (!box) return;
  avatarDraft = normalizeProfile(state.profile);
  const rows = AVATAR_ORDER.map(key => {
    const o = AVATAR_OPTIONS[key];
    if (o.colors) {
      return `<div class="av-row"><div class="av-label">${o.label}</div>
        <div class="av-swatches" role="radiogroup" aria-label="${o.label}">${o.colors.map(c =>
          `<button type="button" class="av-swatch" role="radio" data-key="${key}" data-val="${c.id}" style="--sw:${c.c}" aria-label="${o.label}: ${c.id}" title="${c.id}"></button>`).join("")}</div></div>`;
    }
    return `<div class="av-row"><div class="av-label">${o.label}</div>
      <div class="av-stepper">
        <button type="button" class="av-step" data-key="${key}" data-step="-1" aria-label="Previous ${o.label.toLowerCase()}">◀</button>
        <span class="av-value" data-show="${key}"></span>
        <button type="button" class="av-step" data-key="${key}" data-step="1" aria-label="Next ${o.label.toLowerCase()}">▶</button>
      </div></div>`;
  }).join("");
  box.innerHTML = `
    <div class="av-card" role="dialog" aria-modal="true" aria-labelledby="av-title">
      <h3 id="av-title">Your hero</h3>
      <div class="av-body">
        <div class="av-preview">
          <div class="av-full" data-k="full"></div>
          <div class="av-name num" data-k="previewName"></div>
          <button type="button" class="av-random">🎲 Random look</button>
        </div>
        <div class="av-options">
          <div class="av-row"><label class="av-label" for="av-name">Name</label>
            <input id="av-name" class="av-input" type="text" maxlength="${AVATAR_NAME_MAX}" autocomplete="off" spellcheck="false"></div>
          ${rows}
        </div>
      </div>
      <div class="buttons av-actions">
        <button type="button" class="av-save primary">Save</button>
        <button type="button" class="av-cancel">Cancel</button>
      </div>
    </div>`;
  const nameInput = box.querySelector("#av-name");
  nameInput.value = avatarDraft.name;
  nameInput.addEventListener("input", () => { avatarDraft.name = nameInput.value; renderAvatarEditor(); });
  nameInput.addEventListener("keydown", e => { if (e.key === "Enter") saveAvatarEditor(); });
  box.querySelectorAll(".av-swatch").forEach(b => b.onclick = () => {
    avatarDraft[b.dataset.key] = b.dataset.val; renderAvatarEditor();
  });
  box.querySelectorAll(".av-step").forEach(b => b.onclick = () => {
    const list = avatarChoices(b.dataset.key);
    const i = list.findIndex(ch => ch.id === avatarDraft[b.dataset.key]);
    avatarDraft[b.dataset.key] = list[(i + Number(b.dataset.step) + list.length) % list.length].id;
    renderAvatarEditor();
  });
  box.querySelector(".av-random").onclick = () => {
    for (const key of AVATAR_ORDER) {
      const list = avatarChoices(key);
      avatarDraft[key] = list[Math.floor(Math.random() * list.length)].id;
    }
    renderAvatarEditor();
  };
  box.querySelector(".av-save").onclick = saveAvatarEditor;
  box.querySelector(".av-cancel").onclick = closeAvatarEditor;
  box.onclick = e => { if (e.target === box) closeAvatarEditor(); }; // tap outside the window = Cancel
  box.hidden = false;
  document.body.classList.add("in-editor");
  renderAvatarEditor();
  if (window.matchMedia("(min-width: 701px)").matches) nameInput.focus();
}

function renderAvatarEditor() {
  const box = document.getElementById("avatar-editor");
  const shown = normalizeProfile(avatarDraft);
  box.querySelector('[data-k="full"]').innerHTML = avatarSVG(shown, "full");
  box.querySelector('[data-k="previewName"]').textContent = shown.name;
  box.querySelectorAll(".av-swatch").forEach(b => {
    const on = avatarDraft[b.dataset.key] === b.dataset.val;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
  });
  box.querySelectorAll("[data-show]").forEach(s => {
    const ch = avatarChoices(s.dataset.show).find(c => c.id === avatarDraft[s.dataset.show]);
    s.textContent = ch ? ch.name : "";
  });
}

function saveAvatarEditor() {
  state.profile = normalizeProfile(avatarDraft);
  save();
  closeAvatarEditor();
  renderProfile();
  if (typeof log === "function") log(`Looking good, ${state.profile.name}!`);
}

function closeAvatarEditor() {
  const box = document.getElementById("avatar-editor");
  box.hidden = true;
  box.innerHTML = "";
  avatarDraft = null;
  document.body.classList.remove("in-editor");
}

// Shows the current portrait and name everywhere they appear (settings menu, Hero panel).
function renderProfile() {
  const p = normalizeProfile(state.profile);
  document.querySelectorAll("[data-profile-portrait]").forEach(el => { el.innerHTML = avatarSVG(p, "portrait"); });
  document.querySelectorAll("[data-profile-name]").forEach(el => { el.textContent = p.name; });
}

if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    if (e.target.closest("[data-edit-profile]")) openAvatarEditor();
  });
  document.addEventListener("keydown", e => {
    const box = document.getElementById("avatar-editor");
    if (e.key === "Escape" && box && !box.hidden) closeAvatarEditor();
  });
}
