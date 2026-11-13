/* 正月工具箱 Service Worker
 * 策略：页面导航 network-first（在线永远拿最新版，离线回退缓存），
 * 静态资源 cache-first（_next/static 带内容哈希，天然可长期缓存），
 * RSC / 接口请求完全不缓存。所有工具本来就纯前端，缓存后可离线使用。
 */
const CACHE_NAME = "zhengyue-tools-v1";
const PRECACHE = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // 单个资源失败不应让整个 SW 安装失败
        Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

function remember(cache, request, response) {
  if (response && response.ok && response.type === "basic") {
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // 服务端接口与 Next.js RSC 请求必须实时，不进缓存
  if (url.pathname.startsWith("/api/") || url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;

  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(request)
          .then((response) => remember(cache, request, response))
          .catch(() =>
            caches.match(request).then((cached) => cached || caches.match("/offline.html"))
          )
      )
    );
    return;
  }

  const isStatic = url.pathname.startsWith("/_next/static/") ||
    /\.(png|jpe?g|svg|ico|webp|css|js|woff2?|webmanifest|txt)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        caches.match(request).then((cached) =>
          cached || fetch(request).then((response) => remember(cache, request, response))
        )
      )
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      fetch(request)
        .then((response) => remember(cache, request, response))
        .catch(() => caches.match(request))
    )
  );
});
