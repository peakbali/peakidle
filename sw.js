// ---------- Offline helper (service worker) ----------
// Lets the game open with no internet, and lets it be installed as an app.
// How it stays up to date: every time the game opens WITH internet, it always asks
// GitHub for the newest files first (network first). The saved copies are only used
// when there is no internet, or the internet is too slow to answer.
// So after a merge, players get the new version the next time they open the game.
// This file never touches your save (that lives in localStorage, not here).

const CACHE = "peakidle-v1"; // raise this if you ever want to throw away all saved copies
const WAIT_MS = 4000;        // how long to wait for the internet before using the saved copy

// The files the game needs to start, saved on install so the first offline start works.
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./fonts/Jersey15.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Also save the exact ?v= script and style files the page uses right now.
    let files = CORE.slice();
    try {
      const html = await (await fetch("./index.html", { cache: "no-cache" })).text();
      for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)\?v=[^"]+)"/g)) files.push("./" + m[1]);
    } catch (e) { /* offline during install: the files get saved as they load instead */ }
    await Promise.all(files.map((url) => cache.add(new Request(url, { cache: "no-cache" })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // only our own files
  event.respondWith(networkFirst(req, event));
});

async function networkFirst(req, event) {
  const cache = await caches.open(CACHE);
  // "no-cache" = check with GitHub that the file is still current, so the browser's
  // own short-term copy can't hide a new version.
  const fromNet = fetch(req, { cache: "no-cache" }).then((res) => {
    if (res && res.ok) event.waitUntil(cache.put(req, res.clone()));
    return res;
  });
  try {
    const timer = new Promise((_, fail) => setTimeout(() => fail(new Error("slow")), WAIT_MS));
    return await Promise.race([fromNet, timer]);
  } catch (e) {
    // No internet (or too slow): use the saved copy.
    const saved = await cache.match(req)
      || (req.mode === "navigate" && (await cache.match("./") || await cache.match("./index.html")))
      || await cache.match(req, { ignoreSearch: true }); // same file, older ?v= number
    if (saved) return saved;
    return fromNet; // nothing saved: keep waiting for the internet
  }
}
