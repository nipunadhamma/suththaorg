/* ============================================================
   Suththa.org — reader.js (tab engine + book rendering)
   Port of src/store/tabs.js + TextTab.vue rendering pipeline
   ============================================================ */
(function () {
  'use strict'

  const utils = Suththa.utils
  const config = Suththa.config
  const store = Suththa.store
  const tree = Suththa.tree
  const render = Suththa.render
  const dict = Suththa.dictionary
  const bookmarks = Suththa.bookmarks

  const state = {
    activeInd: -1,
    tabList: [],
    footnoteCache: {},
  }

  // -------------------------------------------------------------
  // data preparation
  // -------------------------------------------------------------

  // add key/eInd/cInd/language fields to every entry (port of tabs.js)
  function addEntryFields(pages, orderedKeys, filename) {
    let curKey = '', cInd = 0
    pages.forEach(function (page, pi) {
      page.pali.entries.forEach(function (paliEntry, ei) {
        if (paliEntry.type == 'heading') {
          if (curKey) {
            curKey = orderedKeys[orderedKeys.indexOf(curKey) + 1]
          } else {
            curKey = filename
          }
        }
        const addProps = { key: curKey, eInd: [pi, ei], cInd: cInd++ }
        Object.assign(paliEntry, addProps)
        paliEntry.language = 'pali'
        const sinhEntry = page.sinh && page.sinh.entries[ei]
        if (sinhEntry) {
          Object.assign(sinhEntry, addProps)
          sinhEntry.language = 'sinh'
        }
      })
    })
  }

  function normalizeParams(params) {
    if (!params.key) {
      params.errorMessage = 'supplied tab params ' + JSON.stringify(params) + ' is missing the key'
      return
    }
    params.keyProp = tree.getKey(params.key)
    if (!params.keyProp || !params.keyProp.filename) {
      params.errorMessage = 'supplied tab params ' + JSON.stringify(params) + ' is missing key props'
      return
    }
    params.eInd = params.eInd || params.keyProp.eInd
    params.entryStart = params.eInd[1]
    params.pageStart = params.pageEnd = params.eInd[0]
    params.isLoaded = false
    params.showScanPage = false
    params.columns = params.language ? Number(params.language == 'sinh') : store.settings.defaultColumns
    params.hWords = params.hWords || null
  }

  // -------------------------------------------------------------
  // tab operations
  // -------------------------------------------------------------

  async function openTab(params) {
    normalizeParams(params)
    state.tabList.push(params)
    state.activeInd = state.tabList.length - 1
    await loadTextData(state.activeInd)
    syncOpenBranches()
    updateHash()
    renderAll()
  }

  function replaceActiveTab(params) {
    normalizeParams(params)
    state.tabList[state.activeInd] = params
    loadTextData(state.activeInd)
    updateHash()
    renderAll()
  }

  function closeTab(ind) {
    state.tabList.splice(ind, 1)
    if (ind <= state.activeInd) state.activeInd = Math.max(0, state.activeInd - 1)
    if (!state.tabList.length) {
      state.activeInd = -1
      location.hash = ''
    } else {
      updateHash()
    }
    renderAll()
  }

  function setActiveInd(newInd) {
    state.activeInd = newInd
    updateHash()
    syncOpenBranches()
    renderAll()
  }

  async function loadTextData(tabIndex) {
    const tab = state.tabList[tabIndex]
    const newFilename = tab.keyProp.filename
    if (!tab.data || newFilename != tab.data.filename) {
      try {
        const data = await utils.getJson(config.textFolder + newFilename + '.json')
        if (!data.pages || !data.pages.length) {
          tab.errorMessage = 'pages are missing in loaded data from ' + newFilename
          renderAll()
          return
        }
        addEntryFields(data.pages, tree.state.orderedKeys, newFilename)
        tab.data = data
        tab.errorMessage = ''
      } catch (e) {
        tab.errorMessage = 'Failed to load the file ' + newFilename + ' with error "' + e.message + '"'
        renderAll()
        return
      }
    }
    tab.pageEnd = Math.min(tab.pageEnd + 2, tab.data.pages.length)
    tab.isLoaded = true
    renderAll()
  }

  function loadNextPage(tabIndex, by) {
    const tab = state.tabList[tabIndex]
    if (!tab || !tab.isLoaded) return
    tab.pageEnd = Math.min(tab.pageEnd + (by || 1), tab.data.pages.length)
    renderAll()
  }

  function loadPrevPage(tabIndex) {
    const tab = state.tabList[tabIndex]
    if (!tab || !tab.isLoaded) return
    if (tab.entryStart > 0) tab.entryStart = 0
    else tab.pageStart = Math.max(0, tab.pageStart - 1)
    renderAll()
  }

  function navigateTabTo(direction) {
    const tab = state.tabList[state.activeInd]
    if (!tab) return
    const newOrderInd = tree.state.orderedKeys.indexOf(tab.key) + direction
    if (newOrderInd < 0 || newOrderInd >= tree.state.orderedKeys.length) return
    const key = tree.state.orderedKeys[newOrderInd]
    if (!tree.getKey(key).filename) return
    replaceActiveTab(Object.assign({}, tab, { key: key, hWords: null }))
  }

  function getActiveTab() { return state.tabList[state.activeInd] }
  function getActiveKey() { return state.activeInd >= 0 ? state.tabList[state.activeInd].key : '' }

  function syncOpenBranches() { Suththa.store.emit('sync-branches') }

  // -------------------------------------------------------------
  // rendering
  // -------------------------------------------------------------

  function getVisiblePages(tabIndex) {
    const tab = state.tabList[tabIndex]
    if (!tab || !tab.isLoaded) return []
    const settings = store.settings
    const pages = []
    tab.data.pages.slice(tab.pageStart, tab.pageEnd).forEach(function (page, pi) {
      const pageNum = parseInt(page.pageNum)
      const startInd = (pi == 0) ? tab.entryStart : 0
      const paliEntries = page.pali.entries.slice(startInd).map(function (e) {
        return render.processEntry(e, settings, tab.hWords)
      })
      const sinhEntries = (page.sinh ? page.sinh.entries : []).slice(startInd).map(function (e) {
        return render.processEntry(e, settings, tab.hWords)
      })
      const paliFootnotes = (page.pali.footnotes || []).map(function (f) {
        return render.processFootnote(f, 'pali', settings)
      })
      const sinhFootnotes = (page.sinh ? (page.sinh.footnotes || []) : []).map(function (f) {
        return render.processFootnote(f, 'sinh', settings)
      })
      pages.push({ pageNum: pageNum, paliEntries: paliEntries, sinhEntries: sinhEntries,
        paliFootnotes: paliFootnotes, sinhFootnotes: sinhFootnotes })
    })
    return pages
  }

  function renderColumn(entries, footnotes, opts, lang) {
    let html = ''
    let seenHeading = false, dropped = false
    entries.forEach(function (e) {
      if (e.type == 'heading') { seenHeading = true; dropped = false }
      else if (seenHeading && !dropped && e.type == 'paragraph') {
        dropped = true
        html += render.entryHtml(e, { settings: opts.settings, dropcap: true })
        return
      }
      html += render.entryHtml(e, { settings: opts.settings })
    })
    if (opts.settings.footnoteMethod == 'end-page' && footnotes.length) {
      html += '<div class="footnotes-block">' +
        footnotes.map(function (f) {
          return render.footnoteHtml(f, { settings: opts.settings, language: lang })
        }).join('') + '</div>'
    }
    return html
  }

  function renderInterlinear(pg, opts) {
    let html = ''
    let seenHeading = false, dropped = false
    const n = Math.max(pg.paliEntries.length, pg.sinhEntries.length)
    for (let i = 0; i < n; i++) {
      const paliEntry = pg.paliEntries[i]
      const sinhEntry = pg.sinhEntries[i]
      if (!paliEntry && !sinhEntry) continue
      if (paliEntry && paliEntry.type == 'heading') { seenHeading = true; dropped = false }
      const isDrop = !!(paliEntry && seenHeading && !dropped && paliEntry.type == 'paragraph')
      if (isDrop) dropped = true
      html += '<div class="entry-pair">'
      html += paliEntry
        ? render.entryHtml(paliEntry, { settings: opts.settings, dropcap: isDrop })
        : '<div class="entry-missing">—</div>'
      html += sinhEntry
        ? render.entryHtml(sinhEntry, { settings: opts.settings })
        : '<div class="entry-missing">—</div>'
      html += '</div>'
    }
    if (opts.settings.footnoteMethod == 'end-page' && (pg.paliFootnotes.length || pg.sinhFootnotes.length)) {
      html += '<div class="footnotes-block">' +
        pg.paliFootnotes.map(function (f) {
          return render.footnoteHtml(f, { settings: opts.settings, language: 'pali' })
        }).join('') +
        pg.sinhFootnotes.map(function (f) {
          return render.footnoteHtml(f, { settings: opts.settings, language: 'sinh' })
        }).join('') + '</div>'
    }
    return html
  }

  function renderPage(pg, tab, opts) {
    let html = ''
    if (opts.settings.showPageNumbers && !opts.isAtta) {
      html += '<div class="page-folio" data-folio="' + pg.pageNum + '">— ' + pg.pageNum + ' —</div>'
    }
    if (opts.showScanPage) {
      html += '<div class="scan-holder"><div class="banner">මුද්‍රිත පිටපතේ පිටුව ' + pg.pageNum +
        ' — පැරණි මුද්‍රිත පිටු (scanned pages) මෙම උපාංගයේ ලබාගත නොහැක.</div></div>'
      return html
    }
    if (opts.columns == 2) {
      html += '<div class="book-spread">' +
        '<section class="book-page spread-page">' +
        renderColumn(pg.paliEntries, pg.paliFootnotes, opts, 'pali') + '</section>' +
        '<section class="book-page spread-page">' +
        renderColumn(pg.sinhEntries, pg.sinhFootnotes, opts, 'sinh') + '</section>' +
        '</div>'
    } else if (opts.columns == 3) {
      html += renderInterlinear(pg, opts)
    } else if (opts.columns == 1) {
      html += '<div class="book-spread single"><div class="col">' +
        renderColumn(pg.sinhEntries, pg.sinhFootnotes, opts, 'sinh') + '</div></div>'
    } else {
      html += '<div class="book-spread single"><div class="col">' +
        renderColumn(pg.paliEntries, pg.paliFootnotes, opts, 'pali') + '</div></div>'
    }
    return html
  }

  function renderTabContent(tabIndex) {
    const holder = document.getElementById('tabs-content')
    if (!holder) return
    const tab = state.tabList[tabIndex]
    state.footnoteCache = {}

    if (tab.errorMessage) {
      holder.innerHTML = '<div class="book"><div class="banner error">' +
        utils.escapeHtml(tab.errorMessage) + '</div></div>'
      return
    }
    if (!tab.isLoaded) {
      holder.innerHTML = '<div class="book"><div class="skeleton skeleton-line w70"></div>' +
        '<div class="skeleton skeleton-line w50"></div><div class="skeleton skeleton-line w70"></div>' +
        '<div class="skeleton skeleton-line"></div></div>'
      return
    }

    const settings = store.settings
    const isAtta = tab.keyProp.filename.indexOf('atta-') == 0
    const opts = {
      settings: settings,
      columns: tab.columns,
      showScanPage: tab.showScanPage,
      isAtta: isAtta,
    }

    const pages = getVisiblePages(tabIndex)
    let html = '<div class="book' +
      (opts.columns == 2 ? ' book-spread-mode' : (opts.columns == 3 ? ' book-interlinear-mode' : '')) + '">'
    pages.forEach(function (pg) {
      // collect footnotes into the cache for tooltips
      pg.paliFootnotes.forEach(function (f) { state.footnoteCache['pali:' + f.number] = f })
      pg.sinhFootnotes.forEach(function (f) { state.footnoteCache['sinh:' + f.number] = f })
      html += '<section class="book-page">' + renderPage(pg, tab, opts) + '</section>'
    })
    if (tab.pageEnd < tab.data.pages.length) {
      html += '<button class="load-next" data-action="load-next">ඊළඟ කොටස පෙන්වන්න ⤵</button>'
    }
    html += '</div>'
    holder.innerHTML = html
    attachLoadNextObserver()
  }

  function renderTabsStrip() {
    const strip = document.getElementById('tabs-strip')
    if (!strip) return
    if (!state.tabList.length) {
      strip.innerHTML = ''
      return
    }
    let html = ''
    state.tabList.forEach(function (tab, ind) {
      const name = tree.getName(tab.key, tab.language, store.settings).replace(/([ක-ෆ])\u200D\u0DCA([ක-ෆ])/g, '$1\u0DCA$2')
      html += '<span class="tab-chip' + (ind == state.activeInd ? ' active' : '') + '" data-tab="' + ind + '">' +
        '<span class="tab-name">' + utils.escapeHtml(name) + '</span>' +
        '<button class="tab-close" data-tab-close="' + ind + '" title="වසන්න">✕</button></span>'
    })
    strip.innerHTML = html
  }

  function renderAll() {
    renderTabsStrip()
    if (state.activeInd >= 0) renderTabContent(state.activeInd)
    else showBookCover()
  }

  function showBookCover() {
    const holder = document.getElementById('tabs-content')
    if (!holder) return
    holder.innerHTML =
      '<div class="book-cover">' +
      '<div class="cover-emblem">❁</div>' +
      '<h1>Suththa.org</h1>' +
      '<div class="cover-sub">සම්පූර්ණ ත්‍රිපිටකය</div>' +
      '<div class="cover-rule"></div>' +
      '<p class="muted">පාළි මූල ග්‍රන්ථ හා සිංහල පරිවර්තන එක් තැනක කියවන්න</p>' +
      '<div class="cover-start muted">සූත්‍රයක් තෝරාගැනීමට වම් පස ග්‍රන්ථ ගස භාවිතා කරන්න,<br>හෝ ඉහළ සෙවුම් කොටුව භාවිතා කරන්න</div>' +
      '</div>'
  }

  let loadNextObserver = null
  function attachLoadNextObserver() {
    const btn = document.querySelector('[data-action="load-next"]')
    if (!btn) return
    if (loadNextObserver) loadNextObserver.disconnect()
    loadNextObserver = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && state.activeInd >= 0) {
        loadNextPage(state.activeInd, 1)
      }
    }, { threshold: 0.4 })
    loadNextObserver.observe(btn)
  }

  // -------------------------------------------------------------
  // hash routing  (#/key/eIndStr/language)
  // -------------------------------------------------------------

  function parseHash() {
    const h = location.hash.replace(/^#/, '').replace(/^\//, '')
    if (!h) return null
    const parts = h.split('/')
    const key = parts[0]
    let eInd = null, language = null
    if (parts[1] && /^[0-9]+(\-[0-9]+)*$/.test(parts[1])) {
      eInd = parts[1].split('-').map(Number)
    }
    if (parts[2] && (parts[2] == 'pali' || parts[2] == 'sinh')) language = parts[2]
    if (!key || !tree.getKey(key)) return null
    return { key: key, eInd: eInd, language: language }
  }

  function updateHash() {
    const tab = getActiveTab()
    if (!tab) return
    const h = tab.key + (tab.eInd ? '/' + tab.eInd.join('-') : '') +
      (tab.language ? '/' + tab.language : '')
    if (location.hash != '#/' + h) {
      try { history.replaceState(null, '', '#/' + h) } catch (e) { location.hash = '#/' + h }
    }
  }

  async function handleHash() {
    const params = parseHash()
    if (params) await openTab(params)
  }

  // -------------------------------------------------------------
  // event handling (event delegation on the tabs-content)
  // -------------------------------------------------------------

  function initEvents() {
    const holder = document.getElementById('tabs-content')
    if (!holder) return

    holder.addEventListener('click', function (e) {
      const t = e.target

      // load next button
      if (t.dataset && t.dataset.action == 'load-next') {
        loadNextPage(state.activeInd, 1)
        return
      }
      // footnote pointer
      if (t.classList && t.classList.contains('fn-pointer')) {
        showFootnoteTooltip(t)
        return
      }
      // heading actions
      if (t.dataset && t.dataset.action == 'share') {
        shareEntry(t.dataset)
        return
      }
      if (t.dataset && t.dataset.action == 'star') {
        toggleStar(t.dataset)
        return
      }
      // jump to the atuva (commentary) or back to the sutta
      if (t.dataset && (t.dataset.action == 'atuva' || t.dataset.action == 'sutta')) {
        openTab({ key: t.dataset.key })
        return
      }
      // word click -> dictionary
      if (t.tagName == 'W') {
        openInlineDict(t)
        return
      }
      // close footnote tooltip elsewhere
      hideFootnoteTooltip()
    })

    holder.addEventListener('mouseover', function (e) {
      if (e.target.classList && e.target.classList.contains('fn-pointer') &&
          store.settings.footnoteMethod == 'hover') {
        showFootnoteTooltip(e.target)
      }
    })
  }

  function getEntryLang(target) {
    const el = target.closest('.entry')
    if (!el) return 'pali'
    return el.classList.contains('sinh') ? 'sinh' : 'pali'
  }

  function showFootnoteTooltip(target) {
    const num = target.dataset.fn
    const lang = getEntryLang(target)
    const f = state.footnoteCache[lang + ':' + num]
    if (!f) return
    const tip = document.getElementById('fn-tooltip')
    if (!tip) return
    tip.innerHTML = render.footnoteHtml(f, { settings: store.settings, language: lang })
    tip.classList.add('show')
    const r = target.getBoundingClientRect()
    let left = r.left + r.width / 2 - tip.offsetWidth / 2
    left = Math.max(6, Math.min(left, window.innerWidth - tip.offsetWidth - 6))
    let top = r.top - tip.offsetHeight - 8
    if (top < 0) top = r.bottom + 8
    tip.style.left = left + 'px'
    tip.style.top = top + 'px'
  }

  function hideFootnoteTooltip() {
    const tip = document.getElementById('fn-tooltip')
    if (tip) tip.classList.remove('show')
  }

  function shareEntry(ds) {
    const link = 'https://tripitaka.suththa.org/' + ds.key + '/' + ds.eind + '/' + ds.lang
    utils.copyText(link).then(function () {
      utils.showSnackbar('සබැඳිය පිටපත් විය. ඔබට අවශ්‍ය තැනක අලවන්න.')
    }).catch(function () {
      utils.showSnackbar('සබැඳිය පිටපත් කළ නොහැක.')
    })
  }

  function toggleStar(ds) {
    const tab = getActiveTab()
    if (!tab) return
    const entry = {
      key: ds.key,
      language: ds.lang,
      eInd: ds.eind.split('-').map(Number),
      type: 'heading',
      text: tree.getName(ds.key, ds.lang, store.settings),
    }
    const nowStarred = bookmarks.toggle(entry)
    const btn = document.querySelector('[data-action="star"][data-key="' + ds.key + '"]')
    if (btn) {
      btn.textContent = nowStarred ? '★' : '☆'
      btn.classList.toggle('starred', nowStarred)
      btn.classList.toggle('star-outline', !nowStarred)
    }
    utils.showSnackbar(nowStarred ? 'තරුවක් යොදන ලදී' : 'තරුව ඉවත් කරන ලදී')
  }

  // -------------------------------------------------------------
  // inline dictionary popup
  // -------------------------------------------------------------

  let dictTimer = null
  function openInlineDict(target) {
    const panel = document.getElementById('inline-dict')
    if (!panel) return
    const word = target.innerText.replace(/[\.,:?()“”‘’]/g, '')
    document.querySelectorAll('.w.bottom-open').forEach(function (w) {
      w.classList.remove('bottom-open')
    })
    target.classList.add('bottom-open')
    document.getElementById('idict-input').value = word
    panel.classList.add('open')
    runInlineDictQuery(word)
  }

  function closeInlineDict() {
    const panel = document.getElementById('inline-dict')
    if (!panel) return
    panel.classList.remove('open')
    document.querySelectorAll('.w.bottom-open').forEach(function (w) {
      w.classList.remove('bottom-open')
    })
  }

  async function runInlineDictQuery(word) {
    const body = document.getElementById('idict-body')
    if (!body) return
    word = dict.cleanWord(word)
    if (!word) { body.innerHTML = ''; return }
    body.innerHTML = '<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line w70"></div>'
    try {
      await dict.ensureDict()
    } catch (e) {
      body.innerHTML = '<div class="banner error">ශබ්දකෝෂ දත්ත පූරණය කළ නොහැක: ' + utils.escapeHtml(e.message) + '</div>'
      return
    }
    const res = dict.runSearch(word, null)
    let html = ''
    if (res.matches.length) {
      html += '<div class="dict-results">'
      res.matches.forEach(function (m) {
        const dName = m.d == 'BUS' ? 'බුද්ධදත්ත' : 'සුමඞ්ගල'
        html += '<div class="dict-result"><span class="dr-word">' + m.word + '</span>' +
          '<span class="dr-dict">' + dName + '</span>' +
          '<div class="dr-meaning">' + utils.meaningHtml(m.m) + '</div></div>'
      })
      html += '</div>'
    } else {
      html += '<div class="muted small">මෙම වචනය ශබ්දකෝෂ වල හමුවූයේ නැත. අකුරු කිහිපයක් අඩු කර උත්සාහ කරන්න.</div>'
    }
    if (res.prefixWords.length) {
      html += '<div class="dict-prefix">' + res.prefixWords.map(function (p) {
        return '<button class="prefix-chip" data-prefix="' + utils.escapeHtml(p.word) + '">' + p.word + '</button>'
      }).join('') + '</div>'
    }
    body.innerHTML = html
  }

  function initInlineDictEvents() {
    const panel = document.getElementById('inline-dict')
    if (!panel) return
    panel.querySelector('[data-idict-backspace]').addEventListener('click', function () {
      const input = document.getElementById('idict-input')
      input.value = input.value.replace(/[අ-ෆ][\u0DCA-\u0DDF\u0D82\u0D83\u200d]*$/, '')
      runInlineDictQuery(input.value)
    })
    panel.querySelector('[data-idict-close]').addEventListener('click', closeInlineDict)
    const input = document.getElementById('idict-input')
    input.addEventListener('input', function () {
      clearTimeout(dictTimer)
      dictTimer = setTimeout(function () { runInlineDictQuery(input.value) }, 350)
    })
    panel.querySelector('#idict-body').addEventListener('click', function (e) {
      if (e.target.dataset && e.target.dataset.prefix) {
        document.getElementById('idict-input').value = e.target.dataset.prefix
        runInlineDictQuery(e.target.dataset.prefix)
      }
    })
  }

  // -------------------------------------------------------------
  // init
  // -------------------------------------------------------------

  function init() {
    initEvents()
    initInlineDictEvents()
    store.on('settings-change', function () { renderAll() })
    Suththa.reader.renderAll = renderAll
  }

  Suththa.reader = {
    state: state,
    init: init,
    openTab: openTab,
    replaceActiveTab: replaceActiveTab,
    closeTab: closeTab,
    setActiveInd: setActiveInd,
    loadNextPage: loadNextPage,
    loadPrevPage: loadPrevPage,
    navigateTabTo: navigateTabTo,
    renderAll: renderAll,
    getActiveTab: getActiveTab,
    getActiveKey: getActiveKey,
    getVisiblePages: getVisiblePages,
    handleHash: handleHash,
    parseHash: parseHash,
    updateHash: updateHash,
    openInlineDict: openInlineDict,
    runInlineDictQuery: runInlineDictQuery,
    closeInlineDict: closeInlineDict,
  }
})()
