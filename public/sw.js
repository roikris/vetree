const CACHE_NAME = 'vetree-v1'
const OFFLINE_URL = '/offline'

// Files to cache for offline use
const STATIC_CACHE = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE)
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseToCache = response.clone()

        // Cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }

        return response
      })
      .catch(() => {
        // Try to get from cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response
          }

          // If it's a navigation request and we're offline, show offline page
          if (event.request.mode === 'navigate') {
            return new Response(
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
          }

          // For other requests, return a simple offline response
          return new Response('Offline', { status: 503 })
        })
      })
  )
})
