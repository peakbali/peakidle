// ---------- Welcome window ----------
// A one-screen guide that tells new players where to go (the words are in index.html, #welcome).
// It opens by itself the first time someone plays (players with an older save see it once too),
// and any time from the [?] button in the top bar. Closing it just remembers that you've seen it:
// it never changes anything else in your save.

function openWelcome() {
  const box = document.getElementById("welcome");
  if (!box || !box.hidden) return;
  // Close the settings menu if it's open, so the two don't overlap.
  const pop = document.getElementById("settings-pop");
  if (pop && !pop.hidden && typeof setSettingsOpen === "function") setSettingsOpen(false);
  box.hidden = false;
  box.querySelector(".av-card").scrollTop = 0;
  document.body.classList.add("in-editor");
}

function closeWelcome() {
  const box = document.getElementById("welcome");
  if (!box || box.hidden) return;
  box.hidden = true;
  // Another window (like the Bestiary) can sit under this one when opened from [?], so keep the page locked then.
  const stillOpen = [...document.querySelectorAll(".av-overlay")].some(x => !x.hidden);
  if (!stillOpen) document.body.classList.remove("in-editor");
  if (typeof state !== "undefined" && !state.welcomed) {
    state.welcomed = true;
    if (typeof save === "function") save();
  }
}

(function () {
  const box = document.getElementById("welcome");
  if (!box) return;
  document.getElementById("help-btn").addEventListener("click", openWelcome);
  box.addEventListener("click", e => {
    if (e.target === box || e.target.closest("[data-wl-close]")) closeWelcome(); // a close button, or a tap outside the card
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !box.hidden) closeWelcome(); });
})();
