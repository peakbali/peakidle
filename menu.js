// ---------- Phone menu ----------
// On phones (700px wide or less) only one panel shows at a time.
// The main menu (dashboard) has a big tile for each panel; tap one to open it.
// The "Menu" button at the top and the tab bar at the bottom switch panels.
// On bigger screens none of this is visible: the CSS hides the menu and shows
// all 7 panels in one row, exactly as before.

const MENU_ITEMS = [
  { id: "mine",      icon: "⛏️", name: "Mine",      blurb: "Dig ore, hire miners" },
  { id: "forge",     icon: "🔨", name: "Forge",     blurb: "Make and sell gear" },
  { id: "hero",      icon: "🛡️", name: "Hero",      blurb: "Stats and equipment" },
  { id: "adventure", icon: "⚔️", name: "Adventure", blurb: "Fight monsters" },
  { id: "merchant",  icon: "📜", name: "Skills",    blurb: "Buy and equip skills" },
  { id: "upgrades",  icon: "⬆️", name: "Upgrades",  blurb: "Tools, mastery, boons" },
  { id: "souls",     icon: "👻", name: "Souls",     blurb: "Reincarnate, attributes" },
];

const dashboardEl = document.getElementById("dashboard");
const tabbarEl = document.getElementById("tabbar");

// Pixel-art icons (icons.js) for the menu, the tab bar and the panel titles.
// The emoji above are only a fallback in case icons.js didn't load.
const menuIcon = it => (typeof pxIcon === "function" && pxIcon(it.id)) || it.icon;

dashboardEl.innerHTML = MENU_ITEMS.map(it => `
  <button type="button" class="dash-tile" data-go="${it.id}">
    <span class="dash-icon">${menuIcon(it)}</span>
    <span class="dash-name">${it.name}</span>
    <span class="dash-blurb">${it.blurb}</span>
    <span class="dash-badge" data-badge="${it.id}" hidden></span>
  </button>`).join("");

tabbarEl.innerHTML = MENU_ITEMS.map(it => `
  <button type="button" class="tab-item" data-go="${it.id}">
    <span class="tab-icon">${menuIcon(it)}</span>
    <span class="tab-label">${it.name}</span>
  </button>`).join("");

for (const it of MENU_ITEMS) {
  const h2 = document.querySelector(`#panel-${it.id} > h2`);
  if (h2) h2.insertAdjacentHTML("afterbegin", `<span class="h2-icon">${menuIcon(it)}</span>`);
}

// Header icons: fill every <span class="px-slot" data-icon="..."> with its pixel picture.
if (typeof pxIcon === "function") {
  for (const slot of document.querySelectorAll(".px-slot[data-icon]")) slot.innerHTML = pxIcon(slot.dataset.icon);
}

// Settings gear in the top bar: opens a small menu (with Reset inside it).
const settingsBtn = document.getElementById("settings-btn");
const settingsPop = document.getElementById("settings-pop");
function setSettingsOpen(open) {
  settingsPop.hidden = !open;
  settingsBtn.setAttribute("aria-expanded", String(open));
}
settingsBtn.addEventListener("click", () => setSettingsOpen(settingsPop.hidden));
document.addEventListener("click", e => {
  if (!settingsPop.hidden && !e.target.closest(".settings")) setSettingsOpen(false);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !settingsPop.hidden) { setSettingsOpen(false); settingsBtn.focus(); }
});

function showView(view) {
  if (view !== "menu" && !MENU_ITEMS.some(it => it.id === view)) view = "menu";
  document.body.dataset.view = view;
  for (const b of tabbarEl.querySelectorAll(".tab-item")) {
    b.classList.toggle("active", b.dataset.go === view);
  }
  if (window.matchMedia("(max-width: 700px)").matches) window.scrollTo(0, 0);
}

document.addEventListener("click", e => {
  const go = e.target.closest("[data-go]");
  if (go) showView(go.dataset.go);
});
document.getElementById("menu-btn").addEventListener("click", () => showView("menu"));

// Small red badge on the Adventure tile/tab when monsters are waiting.
function updateMenuBadges() {
  const waiting = (typeof state !== "undefined" && state.spawns) ? state.spawns.length : 0;
  const badge = dashboardEl.querySelector('[data-badge="adventure"]');
  badge.hidden = waiting === 0;
  badge.textContent = waiting === 1 ? "1 monster" : `${waiting} monsters`;
  tabbarEl.querySelector('[data-go="adventure"]').classList.toggle("has-badge", waiting > 0);
}

// The game always opens on the main menu.
showView("menu");
updateMenuBadges();
setInterval(updateMenuBadges, 1000);
