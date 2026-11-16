const CACHE = "yadcenter-shell-v12";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/workshops.html",
  "/relationships.html",
  "/psychology.html",
  "/psychotherapy.html",
  "/psychiatry.html",
  "/style.css",
  "/app.js",
  "/pwa-install.js",
  "/portal.js",
  "/site-i18n.js",
  "/service-guides-i18n.js",
  "/auth.js",
  "/client-workflow.js",
  "/client-extensions.js",
  "/admin-workflow.js",
  "/admin-extensions.js",
  "/supabase-config.js",
  "/manifest.webmanifest",
  "/app-icon.svg",
  "/assistant.html",
  "/therapist.html",
  "/therapist-profile.html",
  "/therapist-profile.js",
  "/client.html",
  "/admin.html",
  "/rules.html",
  "/articles/",
  "/articles/index.html",
  "/articles/psychotherapy-first-session.html",
  "/articles/choosing-a-therapist.html",
  "/articles/therapeutic-relationship.html",
  "/articles/ai-robots-human-meaning.html"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async response => {
          if (response.ok) {
            await (await caches.open(CACHE)).put(request, response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async cached => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await (await caches.open(CACHE)).put(request, response.clone());
        }
        return response;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    })
  );
});
