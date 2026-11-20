/* タイプクエスト Service Worker
   - 画面(index.html)は「ネット優先」: 公開を更新すると、次に開いたときに新しい版になります。
   - ネットがつながらないときは、保存した版で開けます(個人練習・CPU・ダンジョンは使えます)。
   - 対戦の通信(Firebase)は保存せず、そのまま通します。 */
const V = "tq-v1";
const SHELL = ["index.html", "manifest.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  // 対戦の通信は保存しない
  if (/firebaseio\.com$|firebasedatabase\.app$/.test(u.hostname)) return;

  // 画面そのもの: ネット優先、だめなら保存した版
  if (r.mode === "navigate") {
    e.respondWith(
      fetch(r).then(res => {
        if (res && res.ok && !res.redirected) {
          const cp = res.clone();
          caches.open(V).then(c => c.put("index.html", cp));
        }
        return res;
      }).catch(() => caches.match("index.html"))
    );
    return;
  }

  // 画像・ライブラリ・フォントなど: 保存した版をすぐ返し、裏で更新
  e.respondWith(
    caches.match(r).then(hit => {
      const net = fetch(r).then(res => {
        if (res && (res.ok || res.type === "opaque")) {
          const cp = res.clone();
          caches.open(V).then(c => c.put(r, cp));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
