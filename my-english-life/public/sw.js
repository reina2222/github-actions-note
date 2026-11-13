/*
 * My English Life — Service Worker（オフライン対応）
 * ------------------------------------------------------------
 * 学習データはブラウザ内（localStorage）にあるので、画面さえ取得できればオフラインでも
 * すべての機能（単語帳・復習・学習記録・マイページ）が使える。
 *
 * 方針:
 *   - 画面（HTML）      : ネット優先。つながらなければ保存済みの画面 → それも無ければ /offline
 *   - /_next/static/*   : ファイル名にハッシュが付くので、保存済みを優先（キャッシュ優先）
 *   - アイコン等        : キャッシュ優先
 *   - 収録辞書 /dict/*  : 開いた分だけ保存（保存済みをすぐ使い、裏で最新を取得）。最初に全部は保存しない
 *
 * 更新時は CACHE_VERSION を上げる。古いキャッシュは自動で削除される。
 */
const CACHE_VERSION = "v3";
const PAGE_CACHE = `mel-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `mel-assets-${CACHE_VERSION}`;
// 辞書は版が変わらない限り使い回すので、アプリ更新で消さない（名前に CACHE_VERSION を付けない）
const DICT_CACHE = "mel-dict";

// 最初にまとめて保存しておく画面
const PRECACHE_PAGES = ["/", "/words", "/words/new", "/words/detail", "/words/edit", "/dictionary", "/dictionary/detail", "/cards", "/review", "/analytics", "/mypage", "/licenses", "/offline"];
const PRECACHE_ASSETS = ["/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGE_CACHE);
      const assets = await caches.open(ASSET_CACHE);
      const staticUrls = new Set();
      // 1つ失敗しても他は保存する
      await Promise.all(
        PRECACHE_PAGES.map(async (url) => {
          try {
            const res = await fetch(new Request(url, { cache: "reload" }));
            if (!res.ok) return;
            const html = await res.clone().text();
            await pages.put(url, res);
            // 画面が必要とする JS / CSS も一緒に保存（オフラインで画面が動くように）
            for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) staticUrls.add(m[0]);
          } catch {
            // オンラインに戻ったときに通常の閲覧で保存される
          }
        }),
      );
      await Promise.all([...PRECACHE_ASSETS, ...staticUrls].map((url) => assets.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGE_CACHE, ASSET_CACHE, DICT_CACHE]);
      for (const key of await caches.keys()) {
        if (key.startsWith("mel-") && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

function isPageRequest(request) {
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

async function pageResponse(request) {
  const cache = await caches.open(PAGE_CACHE);
  const url = new URL(request.url);
  const key = url.pathname; // クエリは無視して画面単位で保存
  try {
    const fresh = await fetch(request);
    if (fresh.ok && fresh.type === "basic") cache.put(key, fresh.clone());
    return fresh;
  } catch {
    const cached = (await cache.match(key)) || (await cache.match("/offline"));
    if (cached) return cached;
    return new Response("<h1>オフラインです</h1><p>インターネットにつながったら、もう一度開いてください。</p>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

async function assetResponse(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok && fresh.type === "basic") cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return new Response("", { status: 504 });
  }
}

async function dictResponse(event) {
  const { request } = event;
  const cache = await caches.open(DICT_CACHE);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((fresh) => {
      if (fresh.ok && fresh.type === "basic") cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  return (await update) || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 外部（フォント等）はブラウザに任せる

  // Next.js の画面遷移用データ（RSC）は保存しない。オフライン時は失敗し、Next.js が通常の画面読み込みに切り替える
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;

  if (url.pathname.startsWith("/dict/")) {
    event.respondWith(dictResponse(event));
    return;
  }

  if (isPageRequest(request)) {
    event.respondWith(pageResponse(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || PRECACHE_ASSETS.includes(url.pathname) || url.pathname.startsWith("/_next/image")) {
    event.respondWith(assetResponse(request));
  }
});
