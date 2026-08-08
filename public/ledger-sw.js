const CACHE_NAME = "ledger-cache-v2";
const APP_SHELL = ["/ledger", "/ledger-manifest.json", "/ledger/icon-192", "/ledger/icon-512"];
const ENTRIES_API = "/api/ledger/entries";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// ネットワーク優先: 最新を取りに行き、取れた分をキャッシュへ保存。オフライン時のみキャッシュへフォールバック。
function networkFirst(event) {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname === ENTRIES_API || url.pathname.startsWith("/ledger")) {
    networkFirst(event);
  }
});
