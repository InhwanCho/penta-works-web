export const dynamic = "force-static";

// Only the public, statically rendered dashboard shell and immutable assets are cached.
// Authentication, APIs, RSC responses and all other navigations stay on the network.
export function GET() {
  const version = Date.now().toString(36);
  const worker = String.raw`
const CACHE = "mreyes-shell-${version}";
let warming;
function warmShell() {
  if (warming) return warming;
  warming = (async () => {
    const response = await fetch("/", { cache: "reload", credentials: "omit" });
    if (!response.ok || response.redirected || !response.headers.get("content-type")?.includes("text/html")) {
      throw new Error("Dashboard shell unavailable");
    }
    const html = await response.clone().text();
    const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"<>]+)"/g)].map(match => match[1].replaceAll("&amp;", "&")))];
    const cache = await caches.open(CACHE);
    await Promise.all(assets.map(async path => {
      if (await cache.match(path)) return;
      const asset = await fetch(path, { credentials: "omit" });
      if (!asset.ok) throw new Error("Shell asset unavailable");
      await cache.put(path, asset);
    }));
    await cache.put("/", response);
  })().finally(() => { warming = undefined; });
  return warming;
}
self.addEventListener("install", event => {
  event.waitUntil(warmShell());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("mreyes-shell-") && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && url.pathname === "/") {
    const refresh = warmShell().catch(() => {});
    event.waitUntil(refresh);
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return await cache.match("/") || fetch(request);
    })());
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        try { await cache.put(request, response.clone()); } catch { /* Cache quota must not block the app. */ }
      }
      return response;
    })());
  }
});
`;
  return new Response(worker, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache", "Service-Worker-Allowed": "/" } });
}
