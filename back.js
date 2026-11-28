// ---------- Phone back button ----------
// In the installed app, Android's back button used to leave the page, which showed a black screen.
// Now the game catches the back button and does what you'd expect in an app:
//   Every press goes back ONE level, and the main menu is the last level:
//   1. A window is open (monster or skill info, Welcome, Congratulations, Bestiary, gear picker,
//      look editor, Reset, settings)?
//      Back closes the window on top.
//   2. In a fight? A finished fight closes like Continue. A fight still going is never lost by
//      accident: back only shows a hint to use "Run away".
//   3. On a panel (Forge, Hero, Adventure...) on a phone? Back goes to the main menu.
//   4. On the main menu in the installed app, back stays put (with a small hint), so the screen
//      never goes black. In a normal browser tab (or on a computer) it leaves the page as usual.
//
// How: on Android phones (Chrome 120+) the game uses a "close watcher", which is made for exactly
// this: Android gives the back press to the game instead of leaving it. The first version only
// used a trick with the browser history, and Chrome sometimes skipped over it, so back still
// left the app (the blank screen). That trick is still used on other browsers and on computers:
// the game keeps one extra "guard" step in the history; back uses it up, we go back one level,
// then put the guard step back. Nothing here reads or changes your save.

(function () {
  if (!window.history || !history.pushState) return;

  const KEY = "peakBack";
  const standalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true;
  const isPhone = () => window.matchMedia("(max-width: 700px)").matches;
  const isGuard = st => !!(st && st[KEY] === "guard");
  const visible = id => { const el = document.getElementById(id); return el && !el.hidden ? el : null; };

  // Put the guard step on top of the current one (only if it isn't there already).
  function armGuard() {
    if (isGuard(history.state)) return;
    const base = Object.assign({}, history.state || {});
    delete base[KEY];
    history.replaceState(base, "");
    history.pushState(Object.assign({}, base, { [KEY]: "guard" }), "");
  }

  // Arm on the first tap or key press (and again after coming back to the page later).
  function armOnNextTouch() {
    const events = ["click", "keydown", "pointerup", "touchend"];
    const go = () => {
      events.forEach(ev => window.removeEventListener(ev, go, true));
      armGuard();
    };
    events.forEach(ev => window.addEventListener(ev, go, true));
  }

  // Small message at the bottom of the screen that fades away by itself.
  let toastTimer = null;
  function backToast(text) {
    let t = document.getElementById("back-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "back-toast";
      t.className = "back-toast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // Does one "back" step. Returns false only when there's nothing left to go back to.
  function handleBack() {
    // 1. Windows, top-most first.
    const info = visible("info-pop");
    if (info && typeof closeInfoPop === "function") { closeInfoPop(); return true; }

    if (visible("congrats") && typeof closeCongrats === "function") { closeCongrats(); return true; }
    if (visible("welcome") && typeof closeWelcome === "function") { closeWelcome(); return true; }

    const reset = visible("reset-confirm");
    if (reset) { document.getElementById("reset-no").click(); return true; }

    if (visible("avatar-editor") && typeof closeAvatarEditor === "function") { closeAvatarEditor(); return true; }
    if (visible("gear-picker") && typeof closeGearPicker === "function") { closeGearPicker(); return true; }
    if (visible("bestiary") && typeof closeBestiary === "function") { closeBestiary(); return true; }

    const settings = visible("settings-pop");
    if (settings) {
      settings.hidden = true;
      const btn = document.getElementById("settings-btn");
      if (btn) btn.setAttribute("aria-expanded", "false");
      return true;
    }

    // 2. The battle screen.
    if (visible("battle")) {
      const b = typeof state !== "undefined" ? state.battle : null;
      if (b && b.result && typeof closeBattle === "function") { closeBattle(); return true; }
      if (b && !b.result) { backToast("You're in a fight! Tap Run away to leave it."); return true; }
      if (typeof hideBattleScreen === "function") hideBattleScreen();
      return true;
    }

    // 3. A panel on a phone: back to the main menu.
    if (isPhone() && document.body.dataset.view && document.body.dataset.view !== "menu" && typeof showView === "function") {
      showView("menu");
      return true;
    }

    // 4. Nothing left to close.
    return false;
  }

  // ---- Way 1 (Android phones, Chrome 120 and newer): a "close watcher" ----
  // Android hands the back button to the newest close watcher instead of leaving the page.
  // We keep one waiting at all times. Each back press closes it: we go back one level,
  // then set up a fresh one for the next press. This works from the moment the app opens,
  // even before the first tap.
  const useWatcher = typeof window.CloseWatcher === "function" && /Android/i.test(navigator.userAgent);
  let watcher = null;
  function watch() {
    if (watcher) return;
    try { watcher = new CloseWatcher(); } catch (err) { watcher = null; return; }
    watcher.onclose = () => {
      watcher = null;
      if (handleBack()) { watch(); return; }
      if (standalone()) {
        // Installed app: the main menu is the last stop, so back never closes to a black screen.
        backToast("You're on the main menu.");
        watch();
        return;
      }
      // Normal browser tab: one more back press leaves the page like any website.
      backToast("Press back again to leave the game.");
      watchOnNextTap();
    };
  }
  function watchOnNextTap() {
    const go = () => { window.removeEventListener("click", go, true); watch(); };
    window.addEventListener("click", go, true);
  }
  // For testing in a browser: pretend the back button was pressed.
  window.peakBackPress = () => { if (watcher) watcher.close(); else history.back(); };

  if (useWatcher) {
    watch();
    window.addEventListener("pageshow", e => { if (e.persisted) watch(); });
    return;
  }

  // ---- Way 2 (other browsers and computers): a guard step in the history ----
  window.addEventListener("popstate", e => {
    if (isGuard(e.state)) return; // moved forward onto the guard step: nothing to do
    if (handleBack()) { armGuard(); return; }
    if (standalone()) {
      // Installed app: stay on the main menu instead of closing to a black screen.
      backToast("You're on the main menu.");
      armGuard();
      return;
    }
    // Normal browser tab: leave the page like any website would.
    history.back();
    armOnNextTouch();
  });

  // Coming back from another page with the browser's forward button.
  window.addEventListener("pageshow", e => { if (e.persisted && !isGuard(history.state)) armOnNextTouch(); });

  if (!isGuard(history.state)) armOnNextTouch();
})();
