self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith("/.netlify/functions/") ||
    url.hostname.endsWith(".workers.dev") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }
});
