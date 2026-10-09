const CACHE = "spies-in-disguise-v12";
const ASSETS = ["./", "./index.html", "./config.js", "./styles.css", "./app.js", "./local-game.js", "./ui-logic.js", "./manifest.webmanifest", "./icon.svg", "./logo.svg", "./help-offer.svg", "./help-choose.svg", "./help-chase.svg", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match("./index.html"))));
});
