// Vetree service worker.
//
// PUBLIC STATIC FILES ONLY (since 2026-09-28, Codex re-evaluation #5b). v1 cached every
// successful GET — pages, /api responses (incl. /api/saved-articles), /library, /profile — and
// precached '/' with the visitor's cookies, so a signed-in user's private responses could be
// served offline to the next person on a shared device. Now:
//   - only allow-listed public, immutable/static assets are cached (Next build assets, icons,
//     manifest); pages, RSC payloads and /api are NEVER cached;
//   - bumping CACHE_NAME makes every browser delete the old cache (and its private copies) on
//     activate;
//   - the app also clears these caches on sign-out (lib/hooks/useAuth) and can ask this worker
//     to via postMessage({ type: 'CLEAR_CACHES' }).
const CACHE_NAME = 'vetree-static-v2'

const PRECACHE = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

function isCacheablePublicAsset(url) {
  if (url.origin !== self.location.origin) return false
  if (url.search.includes('_rsc')) return false
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  )
}

self.addEventListener('install', (event) => {
  // Optional precache: a failed icon must not block installing the worker that purges v1
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
  )
  self.skipWaiting()
})

// Delete every other cache, including the old 'vetree-v1' that held private responses
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))))
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)

  // Public static assets: cache-first (they are content-hashed or versioned)
  if (isCacheablePublicAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.status === 200 && response.type === 'basic') {
            const copy = response.clone()
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)))
          }
          return response
        })
      })
    )
    return
  }

  // Page navigations: network only; offline → a static notice (never a cached page)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
              `<!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline - Vetree</title>
                <style>
                  body {
                    font-family: system-ui, -apple-system, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    background: #f9fafb;
                    color: #1a1a1a;
                  }
                  .container {
                    text-align: center;
                    padding: 2rem;
                    max-width: 400px;
                  }
                  .icon {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                  }
                  h1 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin: 0 0 0.5rem;
                    color: #3D7A5F;
                  }
                  p {
                    color: #6b7280;
                    margin: 0;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="icon">📡</div>
                  <h1>You're offline</h1>
                  <p>Connect to the internet to browse new articles.</p>
                </div>
              </body>
              </html>`,
              {
                headers: { 'Content-Type': 'text/html' },
              }
            )
      )
    )
  }
  // Everything else (/api, RSC, cross-origin): not handled — the browser fetches normally,
  // and nothing is stored.
})
