// アプリ本体（HTML・CSS・JS）をオフラインでも開けるようにする。
// 教材（data/）はここでは扱わない。js/data.js が自分で端末に保存・更新する。
// 本体はネット優先（つながれば常に最新）、つながらなければ保存済みを使う。
const SHELL = 'fathom-shell-v6';
const AUDIO = 'fathom-audio';
const FILES = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/data.js', 'js/learn.js', 'js/store.js', 'js/play.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fathom-shell-') && k !== SHELL).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/data/')) return;

  if (url.pathname.includes('/audio/')) {
    // 音声は一度聞いたら端末に残す。保存済みをすぐ返しつつ、裏で取り直しておく
    // （同じ名前で音声を差し替えたとき、次に聞くときから新しい音声になる）。
    e.respondWith(caches.open(AUDIO).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: true });
      // 端末への保存が終わるまでを1つの処理にする（waitUntil が、保存の完了まで待つように）
      const fresh = fetch(req, { cache: 'no-cache' }).then(async (res) => {
        if (res.ok && res.status === 200) { try { await c.put(req, res.clone()); } catch {} }
        return res;
      });
      if (!hit) return fresh;
      e.waitUntil(fresh.catch(() => {}));
      return hit;
    }));
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch(req, { cache: 'no-cache', signal: ctl.signal });
      clearTimeout(timer);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
      if (hit) return hit;
      throw err;
    }
  })());
});
