/* ============================================================
   Suththa.org — app.js (reader page boot & UI logic)
   ============================================================ */
(function () {
  'use strict'

  const utils = Suththa.utils
  const config = Suththa.config
  const store = Suththa.store
  const tree = Suththa.tree
  const reader = Suththa.reader
  const search = Suththa.search
  const dict = Suththa.dictionary

  const treeFilters = [
    { key: 'all', label: 'සියල්ල' },
    { key: 'vp', label: 'විනය' },
    { key: 'dn', label: 'දීඝ' },
    { key: 'mn', label: 'මජ්ඣිම' },
    { key: 'sn', label: 'සංයුත්ත' },
    { key: 'an', label: 'අඞ්ගුත්තර' },
    { key: 'kn', label: 'ඛුද්දක' },
    { key: 'ap', label: 'අභිධම්ම' },
    { key: 'atta', label: 'අට්ඨ' },
    { key: 'anya', label: 'අනෙකුත්' },
  ]

  // -------------------------------------------------------------
  // sidebar tree
  // -------------------------------------------------------------
  let currentTreeFilter = 'all'

  function renderTree() {
    const el = document.getElementById('tree')
    if (!el) return
    let roots = tree.state.treeView
    if (currentTreeFilter != 'all') {
      roots = roots.filter(function (r) {
        const key = r.key
        if (currentTreeFilter == 'atta') return key.indexOf('atta-') == 0
        return key == currentTreeFilter
      })
    }
    if (!roots.length) {
      el.innerHTML = '<div class="muted small">ග්‍රන්ථ නැත</div>'
      return
    }
    el.innerHTML = '<ul class="tree-list">' + roots.map(treeItemHtml).join('') + '</ul>'
    expandToActive()
  }

  function treeItemHtml(item) {
    const hasChildren = item.children && item.children.length
    const label = tree.getName(item.key, null, store.settings)
    return '<li>' +
      '<div class="tree-item" data-key="' + item.key + '"' +
      (hasChildren ? ' data-group="1"' : ' data-leaf="1"') + '>' +
      (hasChildren ? '<span class="tree-arrow">▸</span>' : '<span class="tree-dot">•</span>') +
      '<span class="tree-label">' + utils.escapeHtml(label) + '</span></div>' +
      (hasChildren ? '<ul class="tree-list">' + item.children.map(treeItemHtml).join('') + '</ul>' : '') +
      '</li>'
  }

  function expandToActive() {
    const key = reader.getActiveKey()
    if (!key) return
    const parts = key.split('-')
    const groupKey = parts.slice(0, parts.length - 1).join('-')
    const list = document.querySelector('.tree-item[data-group][data-key="' + groupKey + '"]')
    if (list) list.classList.add('open')
  }

  function bindTree() {
    const el = document.getElementById('tree')
    if (!el) return
    el.addEventListener('click', function (e) {
      const item = e.target.closest('.tree-item')
      if (!item) return
      const key = item.dataset.key
      if (item.hasAttribute('data-group')) {
        item.classList.toggle('open')
        return
      }
      const itemData = tree.getKey(key)
      reader.openTab({
        key: key,
        language: store.settings.treeLanguage,
        eInd: itemData ? itemData.eInd : null,
      })
    })
  }

  function bindTreeFilters() {
    const el = document.getElementById('tree-filters')
    if (!el) return
    el.innerHTML = treeFilters.map(function (f) {
      return '<button class="chip' + (f.key == currentTreeFilter ? ' active' : '') + '" data-filter="' + f.key + '">' + f.label + '</button>'
    }).join('')
    el.addEventListener('click', function (e) {
      const btn = e.target.closest('.chip')
      if (!btn) return
      currentTreeFilter = btn.dataset.filter
      el.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c === btn) })
      renderTree()
    })
  }

  // -------------------------------------------------------------
  // header search
  // -------------------------------------------------------------

  function injectSearchBox() {
    const slot = document.getElementById('header-search-slot')
    if (!slot) return
    slot.innerHTML =
      '<div id="search-box">' +
      '<div class="search-input-wrap">' +
      '<input id="search-input" class="search-input" type="search" placeholder="ග්‍රන්ථ නම සොයන්න…" autocomplete="off">' +
      '</div>' +
      '<button id="search-dict-btn" class="header-btn" title="ශබ්දකෝෂයේ සොයන්න">ශබ්දකෝෂය</button>' +
      '<button id="search-fts-btn" class="header-btn" title="සම්පූර්ණ පාඨ සෙවුම">පාඨ සෙවුම</button>' +
      '<div id="search-dropdown" class="search-dropdown"></div>' +
      '<div class="search-filters small muted">' +
      '<label><input type="checkbox" id="sf-pali" checked> පාළි</label>' +
      '<label><input type="checkbox" id="sf-sinh" checked> සිංහල</label>' +
      '</div></div>'
  }

  function getFilterKeys() {
    return currentTreeFilter == 'all' ? [] : [currentTreeFilter]
  }

  function searchColumns() {
    const cols = []
    if (document.getElementById('sf-pali').checked) cols.push(0)
    if (document.getElementById('sf-sinh').checked) cols.push(1)
    return cols
  }

  function runTitleQuery(query) {
    const dropdown = document.getElementById('search-dropdown')
    if (!dropdown) return
    const q = search.cleanQuery(query)
    if (!q) { dropdown.classList.remove('show'); return }
    const results = search.titleSearch(q, getFilterKeys(), searchColumns(), 40)
    if (!results.length) {
      dropdown.innerHTML = '<div class="sd-empty muted">සොයන ග්‍රන්ථයක් හමුවූයේ නැත</div>'
      dropdown.classList.add('show')
      return
    }
    let html = ''
    results.forEach(function (r) {
      const name = tree.getName(r.key, r.language, store.settings)
      html += '<div class="sd-item" data-result="' + r.key + '|' + r.language + '|' + r.eInd.join('-') + '">' +
        utils.escapeHtml(name) + '<span class="sd-key muted">' + r.key + '</span></div>'
    })
    dropdown.innerHTML = html
    dropdown.classList.add('show')
  }

  function openSearchResult(data) {
    const parts = data.split('|')
    reader.openTab({
      key: parts[0],
      language: parts[1],
      eInd: parts[2].split('-').map(Number),
    })
  }

  function bindSearch() {
    const input = document.getElementById('search-input')
    const dropdown = document.getElementById('search-dropdown')
    if (!input || !dropdown) return
    const debounced = utils.debounce(function () { runTitleQuery(input.value) }, 250)
    input.addEventListener('input', debounced)
    input.addEventListener('keydown', function (e) {
      if (e.key == 'Enter') {
        const first = dropdown.querySelector('.sd-item')
        if (first) {
          openSearchResult(first.dataset.result)
          dropdown.classList.remove('show')
        } else {
          runTitleQuery(input.value)
        }
      }
    })
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#search-box')) dropdown.classList.remove('show')
    })
    dropdown.addEventListener('click', function (e) {
      const item = e.target.closest('.sd-item')
      if (item) {
        openSearchResult(item.dataset.result)
        dropdown.classList.remove('show')
        input.value = ''
      }
    })

    const dictBtn = document.getElementById('search-dict-btn')
    if (dictBtn) dictBtn.addEventListener('click', function () {
      location.href = './dictionary.html?word=' + encodeURIComponent(input.value)
    })

    const ftsBtn = document.getElementById('search-fts-btn')
    if (ftsBtn) ftsBtn.addEventListener('click', function () {
      runFts(input.value)
    })

    // filter checkboxes
    ;['sf-pali', 'sf-sinh'].forEach(function (id) {
      const cb = document.getElementById(id)
      if (cb) cb.addEventListener('change', function () {
        if (input.value) runTitleQuery(input.value)
      })
    })
  }

  async function runFts(query) {
    const panel = document.getElementById('fts-panel')
    if (!panel) return
    const q = search.cleanQuery(query)
    if (!q) {
      utils.showSnackbar('සෙවිය යුතු වචනයක් ඇතුළත් කරන්න')
      return
    }
    panel.classList.add('show')
    const prog = document.getElementById('fts-progress')
    const list = document.getElementById('fts-results')
    prog.textContent = 'පාඨ පරිලෝකනය වෙමින්…'
    list.innerHTML = ''
    const start = Date.now()
    const results = await search.fullTextSearch(q, [], [0, 1], function (done, total) {
      prog.textContent = 'පාඨ පරිලෝකනය වෙමින්… (' + done + ' / ' + total + ')'
    })
    prog.textContent = results.length
      ? 'ප්‍රතිඵල ' + results.length + ' ක් (' + Math.round((Date.now() - start) / 1000) + 's)'
      : 'කිසිදු ප්‍රතිඵලයක් හමුවූයේ නැත'
    const groups = search.buildGroups(results)
    if (!groups.length) {
      list.innerHTML = '<div class="muted">මෙම වාක්‍යය සම්පූර්ණ පාඨවල හමුවූයේ නැත.</div>'
      return
    }
    let html = ''
    groups.forEach(function (g) {
      const keyInfo = tree.getKey(g.key)
      const name = tree.getName(g.key, null, store.settings)
      html += '<div class="fts-group" data-key="' + g.key + '">' +
        '<div class="fts-head2">' + utils.escapeHtml(name) + ' <span class="muted">(' + g.numMatches + ')</span></div>' +
        '<ul class="fts-items">'
      g.items.forEach(function (it) {
        html += '<li class="fts-item" data-result="' + g.key + '|' + it.language + '|' + it.eInd.join('-') + '">' +
          '<span class="fts-snippet">' + utils.escapeHtml(it.hText) + '</span>' +
          '<span class="muted small">— ' + it.language + ' · ' + it.numMatches + '</span></li>'
      })
      html += '</ul></div>'
    })
    list.innerHTML = html
  }

  function bindFtsPanel() {
    const panel = document.getElementById('fts-panel')
    if (!panel) return
    panel.querySelector('[data-fts-close]').addEventListener('click', function () {
      panel.classList.remove('show')
    })
    document.getElementById('fts-results').addEventListener('click', function (e) {
      const item = e.target.closest('.fts-item')
      if (!item) return
      const parts = item.dataset.result.split('|')
      reader.openTab({
        key: parts[0],
        language: parts[1],
        eInd: parts[2].split('-').map(Number),
      })
    })
  }

  // -------------------------------------------------------------
  // toolbar & settings dialog
  // -------------------------------------------------------------
  const COLUMN_LABELS = ['පාළි පමණි', 'සිංහල පමණි', 'පාළි + සිංහල', 'පේළි අතර']

  function syncColumnsButton() {
    const btn = document.getElementById('btn-columns')
    const tab = reader.getActiveTab()
    if (btn) btn.textContent = tab ? (COLUMN_LABELS[tab.columns] || 'තීරු') : 'තීරු'
  }

  function syncSeo() {
    const tab = reader.getActiveTab()
    if (tab && tab.key && Suththa.seo) {
      Suththa.seo.update(tab.key, tab.language)
    }
  }

  function bindToolbar() {
    const ids = {
      'btn-prev-tab': function () { reader.setActiveInd(Math.max(0, reader.state.activeInd - 1)) },
      'btn-next-tab': function () { reader.setActiveInd(Math.min(reader.state.tabList.length - 1, reader.state.activeInd + 1)) },
      'btn-close-tab': function () {
        if (reader.state.activeInd >= 0) reader.closeTab(reader.state.activeInd)
        syncColumnsButton()
      },
      'btn-prev-text': function () { reader.navigateTabTo(-1) },
      'btn-next-text': function () { reader.navigateTabTo(1) },
      'btn-columns': function () {
        const tab = reader.getActiveTab()
        if (!tab) return
        tab.columns = (tab.columns + 1) % 4
        reader.updateHash()
        reader.renderAll()
        syncColumnsButton()
      },
    }
    Object.keys(ids).forEach(function (id) {
      const el = document.getElementById(id)
      if (el) el.addEventListener('click', ids[id])
    })
  }

  function bindSettingsDialog() {
    const dialog = document.getElementById('settings-dialog')
    const openBtn = document.getElementById('btn-settings')
    const closeBtn = dialog ? dialog.querySelector('[data-dialog-close]') : null
    const backdrop = document.getElementById('settings-backdrop')
    if (!dialog) return

    openBtn.addEventListener('click', function () {
      dialog.classList.add('open')
      if (backdrop) backdrop.classList.add('open')
      syncSettingsForm()
    })
    function close() {
      dialog.classList.remove('open')
      if (backdrop) backdrop.classList.remove('open')
    }
    closeBtn.addEventListener('click', close)
    if (backdrop) backdrop.addEventListener('click', close)

    const setters = {
      'set-darkmode': function (v) { store.set('darkMode', v) },
      'set-columns': function (v) { store.set('defaultColumns', Number(v)) },
      'set-tree-lang': function (v) { store.set('treeLanguage', v) },
      'set-footnote-method': function (v) { store.set('footnoteMethod', v) },
      'set-bandi': function (v) { store.set('bandiLetters', v) },
      'set-special': function (v) { store.set('specialLetters', v) },
      'set-page-nums': function (v) { store.set('showPageNumbers', v) },
      'set-font-size': function (v) { store.set('fontSize', Number(v)) },
    }
    Object.keys(setters).forEach(function (name) {
      const el = dialog.querySelector('[data-setting="' + name + '"]')
      if (!el) return
      el.addEventListener('change', function () {
        const val = el.type == 'checkbox' ? el.checked : el.value
        setters[name](val)
      })
    })
  }

  function syncSettingsForm() {
    const dialog = document.getElementById('settings-dialog')
    if (!dialog) return
    const s = store.settings
    const map = {
      'set-darkmode': s.darkMode,
      'set-columns': String(s.defaultColumns),
      'set-tree-lang': s.treeLanguage,
      'set-footnote-method': s.footnoteMethod,
      'set-bandi': s.bandiLetters,
      'set-special': s.specialLetters,
      'set-page-nums': s.showPageNumbers,
      'set-font-size': String(s.fontSize),
    }
    Object.keys(map).forEach(function (name) {
      const el = dialog.querySelector('[data-setting="' + name + '"]')
      if (!el) return
      if (el.type == 'checkbox') el.checked = map[name]
      else el.value = map[name]
    })
  }

  // -------------------------------------------------------------
  // sidebar toggle
  // -------------------------------------------------------------
  function bindSidebar() {
    const toggle = document.getElementById('sidebar-toggle')
    const sidebar = document.getElementById('sidebar')
    const backdrop = document.getElementById('sidebar-backdrop')
    if (!toggle || !sidebar) return
    function close() {
      sidebar.classList.remove('open')
      if (backdrop) backdrop.classList.remove('show')
    }
    toggle.addEventListener('click', function () {
      const open = sidebar.classList.toggle('open')
      if (backdrop) backdrop.classList.toggle('show', open)
    })
    if (backdrop) backdrop.addEventListener('click', close)
  }

  // -------------------------------------------------------------
  // boot
  // -------------------------------------------------------------
  function applyFontSize() {
    const el = document.getElementById('tabs-content')
    if (el) el.style.fontSize = store.fontPx()
  }

  // path-based deep links (e.g. /dn-1/pali from the sitemap) work when the
  // server falls back to index.html (nginx try_files / fastify notFound)
  function parsePathRoute() {
    const parts = location.pathname.split('/').filter(Boolean)
    if (!parts.length) return null
    const key = parts[0]
    if (key.indexOf('.html') >= 0 || key == 'static') return null
    const item = tree.getKey(key)
    if (!item) return null
    let language = parts[1]
    if (language != 'pali' && language != 'sinh') language = null
    return { key: key, language: language, eInd: item.eInd }
  }

  function init() {
    store.loadSettings()
    Suththa.nav.init()
    injectSearchBox()
    store.on('settings-change', applyFontSize)
    applyFontSize()

    document.getElementById('boot').style.display = 'none'

    // footnote abbreviations for the reader (render.processFootnote)
    utils.getJson(config.abbreviationsUrl).then(function (a) {
      Suththa.store.footnoteAbbreviations = a || {}
    }).catch(function () {
      Suththa.store.footnoteAbbreviations = {}
    })

    tree.initialize().then(function () {
      reader.init()
      bindSidebar()
      renderTree()
      bindTree()
      bindTreeFilters()
      bindSearch()
      bindFtsPanel()
      bindToolbar()
      bindSettingsDialog()
      applyFontSize()

      store.on('sync-branches', function () { renderTree(); syncColumnsButton(); syncSeo() })

      // open tab from hash (or path deep-link), else show cover
      if (location.hash) reader.handleHash()
      else {
        const route = parsePathRoute()
        if (route) reader.openTab(route)
        else reader.renderAll()
      }
    }).catch(function (e) {
      document.getElementById('boot').innerHTML =
        '<div class="banner error">දත්ත පූරණය කළ නොහැක: ' + utils.escapeHtml(e.message) + '</div>'
    })
  }

  Suththa.app = { init: init }
  document.addEventListener('DOMContentLoaded', init)
})()
