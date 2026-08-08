/* ============================================================
   Suththa.org — service worker (offline reading + faster repeats)
   - app shell cached on install
   - big data/text JSON: stale-while-revalidate (cache first, refresh in background)
   - navigations: network-first, fall back to cached shell offline
   ============================================================ */
'use strict'

const VERSION = 'suththa-v1'
const CACHE = VERSION

const SHELL = [
  './index.html',
  './dictionary.html',
  './note.html',
  './bookmark.html',
  './manifest.webmanifest',
  './css/variables.css',
  './css/fonts.css',
  './css/main.css',
  './css/layout.css',
  './css/components.css',
  './css/reader.css',
  './css/dictionary.css',
  './css/notes.css',
  './css/bookmarks.css',
  './css/responsive.css',
  './js/config.js',
  './js/utils.js',
  './js/store.js',
  './js/tree.js',
  './js/render.js',
  './js/dictionary.js',
  './js/search.js',
  './js/seo.js',
  './js/notes.js',
  './js/bookmarks.js',
  './js/reader.js',
  './js/main-nav.js',
  './js/app.js',
  './static/images/favicon-96x96.png',
  './static/images/icon-192x192.png',
  './static/images/icon-512x512.png',
  './static/images/app-logo.png',
  './static/images/og-500x300.png',
]

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL) })
      .then(function () { return self.skipWaiting() })
  )
})

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE }).map(function (k) { return caches.delete(k) }))
      })
      .then(function () { return self.clients.claim() })
  )
})

function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit
    return fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone()
        caches.open(CACHE).then(function (c) { c.put(req, copy) })
      }
      return res
    })
  })
}

function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone()
      caches.open(CACHE).then(function (c) { c.put(req, copy) })
    }
    return res
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) return hit
      return caches.match('./index.html')
    })
  })
}

function staleWhileRevalidate(req) {
  return caches.match(req).then(function (hit) {
    const fetchP = fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone()
        caches.open(CACHE).then(function (c) { c.put(req, copy) })
      }
      return res
    }).catch(function () {
      return hit
    })
    return hit || fetchP
  })
}

self.addEventListener('fetch', function (e) {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  // static JSON data (tree, text, indexes): cache-first with background refresh
  if (url.pathname.indexOf('/static/data/') >= 0 || url.pathname.indexOf('/static/text/') >= 0) {
    e.respondWith(staleWhileRevalidate(req))
    return
  }

  // page navigations (including deep links): network-first
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req))
    return
  }

  // everything else (css/js/images): cache-first
  e.respondWith(cacheFirst(req))
})
