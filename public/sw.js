// ============================================================
// SERVICE WORKER — LIL'Z EVENT AGENCY v2
// Compatible iOS 16.4+ Safari (PWA installable iPhone)
// ============================================================

const CACHE_NAME = "lilz-v2";

const PRECACHE_URLS = [
  "/",
  "/login",
  "/dashboard",
  "/offline",
  "/manifest.json",
  "/logo.jpg",
];

// === INSTALLATION ===
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// === ACTIVATION — Supprime les anciens caches ===
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// === FETCH — Network First, fallback Cache ===
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("supabase.co")) return;
  if (event.request.url.includes("_next/webpack-hmr")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.destination === "document") {
            return caches.match("/offline");
          }
        })
      )
  );
});

// === PUSH NOTIFICATIONS (VAPID) ===
// Reçoit les notifications push du serveur même quand l'app est fermée
self.addEventListener("push", (event) => {
  let data = {
    title: "LIL'Z EVENT AGENCY",
    body: "Nouveau message reçu",
    icon: "/icons/icon-192.png",
    url: "/messages",
  };
  try {
    if (event.data) Object.assign(data, event.data.json());
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: "/icons/icon-72.png",
      tag: data.tag || "lilz-notif",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url },
    })
  );
});

// === CLIC NOTIFICATION → Ouvrir l'app sur la bonne page ===
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/messages";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
