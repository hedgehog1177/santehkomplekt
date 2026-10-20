// Сантехкомплект — service worker: работа без интернета.
// При КАЖДОЙ выкладке увеличивайте VERSION: без этого телефоны не получат новую версию.
const VERSION = 'v35';
const CORE = 'santeh-core-' + VERSION;
const LIBS = 'santeh-libs-v1';

const CORE_FILES = [
  './',
  './index.html',
  './install.html',
  './help.html',
  './platform.js',
  './core.js',
  './app.js',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];
// Адреса библиотек с точной версией не меняются, поэтому хранятся в отдельном кэше
const LIB_FILES = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js',
  'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];
const LIB_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// Обновление автоматическое: как только новая версия скачана целиком, она сразу
// заменяет старую (skipWaiting), а страница перезагружается (см. platform.js).
self.addEventListener('install', event => {
  event.waitUntil(Promise.all([
    // cache: 'reload' — берём файлы с сервера, а не из HTTP-кэша браузера
    caches.open(CORE).then(c => c.addAll(CORE_FILES.map(u => new Request(u, { cache: 'reload' })))),
    caches.open(LIBS).then(c => c.addAll(LIB_FILES)),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CORE && k !== LIBS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const usable = res => res && (res.ok || res.type === 'opaque');

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Страница и файлы приложения отдаются из кэша своей версии целиком, чтобы
  // новая index.html никогда не встретилась со старым app.js. Новая версия
  // приходит только через обновление sw.js.
  // Каждая страница отдаётся сама (index.html, install.html); незнакомый адрес — приложение.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CORE).then(c => c.match(req, { ignoreSearch: true })
        .then(hit => hit || fetch(req).catch(() => c.match('./index.html'))))
    );
    return;
  }

  // Библиотеки и шрифты: из кэша, при отсутствии — из сети с сохранением
  if (LIB_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (usable(res)) { const copy = res.clone(); caches.open(LIBS).then(c => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CORE).then(c => c.match(req, { ignoreSearch: true })).then(hit => hit || fetch(req))
    );
  }
});
