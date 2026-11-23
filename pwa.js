// ---------- Play as an app (PWA) ----------
// 1. Turns on the offline helper (sw.js) so the game opens without internet.
// 2. Fills the "Play as an app" box in the settings menu with the right install steps
//    for this phone or computer, plus an "Install app" button where the browser allows it.
// Nothing here reads or changes your save.

(function () {
  const box = document.getElementById("install-box");
  const text = document.getElementById("install-text");
  const btn = document.getElementById("install-btn");

  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  let promptEvent = null;

  function show() {
    if (!box) return;
    btn.hidden = true;
    if (standalone) {
      text.textContent = "You're playing the app. Your progress is the same as in the browser on this device.";
    } else if (promptEvent) {
      text.textContent = "Add Peak Idle to your home screen. It opens full screen and works without internet.";
      btn.hidden = false;
    } else if (isIOS) {
      text.innerHTML = "In Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>.";
    } else if (isAndroid) {
      text.innerHTML = "In Chrome, tap the <b>⋮</b> menu, then <b>Add to Home screen</b> or <b>Install app</b>.";
    } else {
      text.textContent = "In Chrome or Edge, click the install icon at the right end of the address bar.";
    }
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the browser's pop-up
    promptEvent = e;
    show();
  });
  window.addEventListener("appinstalled", () => { promptEvent = null; if (box) text.textContent = "Installed! Look for Peak Idle on your home screen."; btn.hidden = true; });
  if (btn) btn.addEventListener("click", async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice.catch(() => {});
    promptEvent = null;
    show();
  });
  show();

  // ---- Offline helper ----
  // Only works on a real web address (https or localhost), not when index.html is opened as a file.
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  const hadHelper = !!navigator.serviceWorker.controller;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      // Check for a new helper now and then (e.g. when the app comes back from the background).
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  });
  // A new helper took over while the game was open: offer a reload to get the newest version.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadHelper || document.getElementById("update-bar")) return;
    const bar = document.createElement("div");
    bar.id = "update-bar";
    bar.className = "update-bar";
    bar.setAttribute("role", "status");
    bar.innerHTML = '<span>A new version of Peak Idle is ready.</span><button type="button" class="primary">Reload</button>';
    bar.querySelector("button").addEventListener("click", () => {
      if (typeof save === "function") save(); // keep progress right up to this second
      location.reload();
    });
    document.body.appendChild(bar);
  });
})();
