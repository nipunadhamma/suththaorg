/* ============================================================
   Suththa.org — bookmarks-page.js (bookmark.html logic)
   ============================================================ */
(function () {
  'use strict'

  const utils = Suththa.utils
  const bookmarks = Suththa.bookmarks
  const tree = Suththa.tree

  function sortBookmarks() {
    const all = bookmarks.getAll()
    return Object.keys(all).map(function (keyStr) {
      return Object.assign({ keyStr: keyStr }, all[keyStr])
    }).sort(function (a, b) {
      return (a.text || '').localeCompare(b.text || '', 'si')
    })
  }

  function eIndLabel(eInd) {
    if (Array.isArray(eInd)) return eInd.join('-')
    return eInd || ''
  }

  function renderList() {
    const el = document.getElementById('bookmark-list')
    if (!el) return
    const items = sortBookmarks()
    const count = document.getElementById('bm-count')
    if (count) count.textContent = items.length + ' ක්'
    if (!items.length) {
      el.innerHTML = '<div class="banner">තරු සලකුණු නැත. කියවීමේදී මාතෘකා අසල ඇති ☆ ඔබන්න.</div>'
      return
    }
    el.innerHTML = items.map(function (b) {
      const langLabel = b.language == 'pali' ? 'පාළි' : 'සිංහල'
      return '<div class="bookmark-item" data-bm="' + b.keyStr + '">' +
        '<button class="bm-remove" data-remove="' + b.keyStr + '" title="ඉවත් කරන්න">✕</button>' +
        '<div class="bm-breadcrumb">' +
        '<span class="bm-pitaka">' + (b.key || '').split('-')[0] + '</span>' +
        '<span class="bm-name">' + utils.escapeHtml(b.text || b.key) + '</span>' +
        '<span class="bm-parents">' + langLabel + (b.eInd ? ' · ' + eIndLabel(b.eInd) : '') + '</span>' +
        '</div>' +
        (b.hText ? '<div class="bm-text">' + utils.escapeHtml(b.hText) + '</div>' : '') +
        '</div>'
    }).join('')
  }

  function bind() {
    const el = document.getElementById('bookmark-list')
    el.addEventListener('click', function (e) {
      const remove = e.target.closest('.bm-remove')
      if (remove) {
        bookmarks.remove(remove.dataset.remove)
        renderList()
        utils.showSnackbar('තරුව ඉවත් කරන ලදී')
        return
      }
      const item = e.target.closest('.bookmark-item')
      if (!item) return
      const b = bookmarks.getAll()[item.dataset.bm]
      if (!b) return
      location.href = './index.html#/' + b.key + '/' + eIndLabel(b.eInd) + '/' + b.language
    })
  }

  function init() {
    Suththa.nav.init()
    tree.initialize().then(function () {
      bind()
      renderList()
    }).catch(function () {
      bind()
      renderList()
    })
  }

  Suththa.bookmarksPage = { init: init }
  document.addEventListener('DOMContentLoaded', init)
})()
