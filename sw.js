const CACHE_NAME = 'tzk4d-cache-v1';
// Список файлов для кэширования
const urlsToCache = [
  '/',
  '/index.html',
  '/main.css',
  '/hiro.png',
  '/js/three.module.js',
  '/js/libs/hammer.min.js',
  '/js/addons/loaders/GLTFLoader.js',
  '/js/addons/utils/BufferGeometryUtils.js',
  '/js/addons/geometries/DecalGeometry.js',
  '/js/addons/webxr/ARButton.js',
  '/js/app/main.js',
  '/js/app/ui.js',
  '/js/app/model.js',
  '/js/app/interactions.js'
  // Модель .glb не добавляется в кэш, так как она может быть большой
  // и загружаться динамически. Если она небольшая, можно добавить:
  // '/Донецкая 4 Маленькая модель.glb'
];

// Установка сервис-воркера и кэширование файлов
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Активация сервис-воркера и удаление старых кэшей
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});


// Перехват сетевых запросов
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Если ресурс есть в кэше, возвращаем его
        if (response) {
          return response;
        }

        // Если нет, делаем запрос к сети
        return fetch(event.request);
      }
    )
  );
});