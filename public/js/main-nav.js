/* ============================================================
   Suththa.org — main-nav.js (shared header nav, theme toggle)
   Used on every page: index, dictionary, note, bookmark
   ============================================================ */
(function () {
  'use strict'

  const store = Suththa.store

  function currentPage() {
    const p = location.pathname.split('/').pop() || 'index.html'
    return p == 'index.html' ? 'reader' : p.replace('.html', '')
  }

  function renderNav() {
    const nav = document.getElementById('main-nav')
    if (!nav) return
    const page = currentPage()
    const items = [
      { id: 'reader', href: './index.html', label: 'කියවන්න' },
      { id: 'dictionary', href: './dictionary.html', label: 'ශබ්දකෝෂය' },
      { id: 'note', href: './note.html', label: 'සටහන්' },
      { id: 'bookmark', href: './bookmark.html', label: 'තරු සලකුණු' },
    ]
    let html = '<header class="app-header">'
    if (page == 'reader') {
      html += '<button id="sidebar-toggle" class="icon-btn" title="ග්‍රන්ථ ගස">☰</button>'
    }
    html += '<a class="brand" href="./index.html">' +
      '<span class="brand-mark">❁</span>' +
      '<span class="brand-text">Suththa.org<small>ත්‍රිපිටකය</small></span></a>' +
      '<span id="header-search-slot" class="header-search"></span>' +
      '<nav class="nav-links">'
    items.forEach(function (it) {
      html += '<a href="' + it.href + '"' + (it.id == page ? ' class="active"' : '') + '>' + it.label + '</a>'
    })
    html += '</nav>' +
      '<div class="header-actions">' +
      '<button id="theme-toggle" class="icon-btn" title="තද පසුබිම / ආලෝකය">🌙</button>' +
      '</div></header>'
    nav.innerHTML = html

    const toggle = document.getElementById('theme-toggle')
    if (toggle) toggle.addEventListener('click', function () {
      store.set('darkMode', !store.settings.darkMode)
    })
  }

  function init() {
    renderNav()
    store.on('settings-change', function () {
      const toggle = document.getElementById('theme-toggle')
      if (toggle) toggle.textContent = store.settings.darkMode ? '☀️' : '🌙'
    })
  }

  Suththa.nav = { init: init, currentPage: currentPage }
})()
