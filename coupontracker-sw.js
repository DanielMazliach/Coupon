// coupontracker — service worker
// רשום עם scope './coupontracker' כדי לא להתנגש ב-service worker של אפליקציה אחרת באותה תיקייה.
// מוחק רק מטמונים של האפליקציה הזו — מטמונים באותו דומיין (username.github.io) משותפים לכל האפליקציות שם.
// מעטפת (coupontracker.html): network-first עם timeout, נפילה למטמון כשאין רשת.
// שאר הקבצים הסטטיים: cache-first. אף נתון משתמש לא עובר כאן — הנתונים ב-localStorage/IndexedDB בלבד.
const CACHE = 'coupontracker-v1';
const SHELL = ['./coupontracker.html', './coupontracker.webmanifest', './coupontracker-180.png', './coupontracker-512.png'];
const INDEX = new URL('./coupontracker.html', self.registration.scope).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('coupontracker-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isShell = req.mode === 'navigate' || url.href === INDEX;
  e.respondWith(isShell ? networkFirst(url) : cacheFirst(req));
});

async function networkFirst(url) {
  const cache = await caches.open(CACHE);
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    url.hash = '';
    const res = await fetch(url.href, { signal: ctl.signal, cache: 'no-store', credentials: 'same-origin' });
    clearTimeout(t);
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) await cache.put(INDEX, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(INDEX)) || Response.error();
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
  return res;
}
