// Dual N-Back Studio — service worker
// アプリを更新したら VERSION を上げる（index.html 以外のファイルを確実に入れ替えるため）
const VERSION = 'dnb-2026-11-20-1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './chart.umd.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 画面（index.html）はネット優先：オンラインなら常に最新版、オフラインならキャッシュ
async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(req, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (res.ok) cache.put('./index.html', res.clone());
    return res;
  } catch (e) {
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
  }
}

// その他（アイコン・Chart.js・フォント）はキャッシュ優先、裏で更新
async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req)); return; }
  const url = new URL(req.url);
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req));
  }
});
