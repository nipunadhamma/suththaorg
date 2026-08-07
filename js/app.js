/* ============================================================
   suththa.org - Sinhala Buddhist Sutta Reader (main app)
   ============================================================ */

(function () {
  'use strict';

  /* ---------------- Config ---------------- */

  var CONFIG = {
    treeUrl: 'static/data/tree.json',
    booksUrl: 'static/data/books.json',
    cacheLimit: 30
  };

  var CATEGORY_LABEL = {
    sut: 'සූත්‍ර පිටකය',
    vin: 'විනය පිටකය',
    abh: 'අභිධර්ම පිටකය',
    atta: 'අට්ඨකථා',
    anya: 'වෙනත් පොත්'
  };

  var GROUP_DEFS = [
    { id: 'sp', label: 'සූත්‍ර පිටකය', roots: ['sp'] },
    { id: 'vp', label: 'විනය පිටකය', roots: ['vp'] },
    { id: 'ap', label: 'අභිධර්ම පිටකය', roots: ['ap'] },
    { id: 'atta', label: 'අට්ඨකථා', roots: ['atta-vp', 'atta-sp', 'atta-ap'] },
    { id: 'anya', label: 'වෙනත් පොත්', roots: ['anya'] }
  ];

  var LS = {
    theme: 'suththa_theme',
    font: 'suththa_fontsize',
    mode: 'suththa_mode',
    lang: 'suththa_lang',
    bookmarks: 'suththa_bookmarks',
    notes: 'suththa_notes',
    lastPos: 'suththa_lastpos'
  };

  /* ---------------- State ---------------- */

  var booksIndex = {};      // id -> {category, file}
  var treeRoots = [];       // parsed tree.json array
  var nodeIndex = new Map();// tree node id -> node object
  var nodeBook = new Map(); // tree node id -> book id
  var bookTitles = new Map(); // book id -> tree node (title source)
  var bookCache = new Map();  // book id -> parsed json

  var state = {
    bookId: null,
    book: null,
    renderedUpTo: -1,
    target: null,          // {segmentId} to restore scroll
    searchToken: 0,
    currentFilter: 'all'
  };

  var els = {};

  /* ---------------- Utils ---------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function normalize(s) {
    return String(s || '').replace(/\s+/g, ' ').replace(/[\s.,;:!?()"'“”\-]+$/g, '').trim();
  }

  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return r.json();
    });
  }

  function toast(msg) {
    var t = els.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._h);
    toast._h = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function loadLocal(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }

  function saveLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function titleFor(bookId) {
    var node = bookTitles.get(bookId);
    if (node) {
      return node.name && node.name.sinhala ? node.name.sinhala : node.name.pali;
    }
    return bookId;
  }

  /* ---------------- Data loading ---------------- */

  function resolveBookForNode(node) {
    if (!node) return null;
    var id = node.id;
    if (booksIndex[id]) return id;
    if (node.file) {
      var base = node.file.replace(/\.json$/i, '').split('/').pop();
      if (base && booksIndex[base]) return base;
    }
    var prefix = id + '-';
    var cands = Object.keys(booksIndex).filter(function (k) {
      return k.indexOf(prefix) === 0;
    });
    if (cands.length) {
      cands.sort(function (a, b) { return a.length - b.length; });
      return cands[0];
    }
    return null;
  }

  function walkTree(node, curBook) {
    nodeIndex.set(node.id, node);
    var rb = resolveBookForNode(node);
    if (rb) {
      curBook = rb;
      if (!bookTitles.has(rb)) bookTitles.set(rb, node);
    }
    nodeBook.set(node.id, curBook);
    (node.children || []).forEach(function (c) { walkTree(c, curBook); });
  }

  function initData() {
    return Promise.all([fetchJSON(CONFIG.treeUrl), fetchJSON(CONFIG.booksUrl)])
      .then(function (res) {
        treeRoots = res[0];
        booksIndex = res[1].books;
        treeRoots.forEach(function (r) { walkTree(r, null); });
        buildTreeUI();
        return true;
      });
  }

  function getBookFile(bookId) {
    var b = booksIndex[bookId];
    return b ? b.file : ('static/text/' + bookId + '.json');
  }

  function getCachedBook(bookId) {
    return bookCache.get(bookId);
  }

  function cacheBook(bookId, book) {
    bookCache.set(bookId, book);
    if (bookCache.size > CONFIG.cacheLimit) {
      var firstKey = bookCache.keys().next().value;
      bookCache.delete(firstKey);
    }
  }

  function loadBookData(bookId) {
    var cached = getCachedBook(bookId);
    if (cached) return Promise.resolve(cached);
    return fetchJSON(getBookFile(bookId)).then(function (book) {
      cacheBook(bookId, book);
      return book;
    });
  }

  /* ---------------- Sidebar tree UI ---------------- */

  function buildTreeUI() {
    var tree = els.tree;
    tree.innerHTML = '';
    GROUP_DEFS.forEach(function (group) {
      var label = document.createElement('div');
      label.className = 'tree-group-label';
      label.textContent = group.label;
      tree.appendChild(label);

      var container = document.createElement('div');
      container.className = 'tree-group';
      container.setAttribute('data-group', group.id);

      group.roots.forEach(function (rid) {
        var root = treeRoots.filter(function (r) { return r.id === rid; })[0];
        if (root) container.appendChild(renderNode(root, 0));
      });

      tree.appendChild(container);
    });
    els.tree.querySelectorAll('.empty').forEach(function (e) { e.remove(); });
  }

  function renderNode(node, depth) {
    var wrap = document.createElement('div');
    wrap.className = 'tree-node';
    wrap.setAttribute('data-id', node.id);

    var hasChildren = node.children && node.children.length;
    var isBook = !!resolveBookForNode(node);

    var row = document.createElement('div');
    row.className = 'tree-row' + (hasChildren ? '' : ' node-sutta');
    row.setAttribute('data-depth', depth);

    var caret = document.createElement('span');
    caret.className = 'caret' + (hasChildren ? '' : ' leaf');
    caret.textContent = hasChildren ? '▶' : '•';
    row.appendChild(caret);

    var name = document.createElement('span');
    name.className = 'tree-name';
    name.textContent = (node.name && (node.name.sinhala || node.name.pali)) || node.id;
    row.appendChild(name);

    row.addEventListener('click', function (ev) {
      if (ev.target.closest('.tree-name') && isBook) {
        openBook(node, { source: 'tree' });
        return;
      }
      if (hasChildren) {
        toggleNode(wrap);
      } else {
        openBook(node, { source: 'tree', target: node.name });
      }
    });

    wrap.appendChild(row);

    if (hasChildren) {
      var children = document.createElement('div');
      children.className = 'tree-children';
      children.setAttribute('data-depth', depth);
      children.setAttribute('data-lazy', node.id);
      if (depth === 0) {
        row.classList.add('open');
        ensureBuilt(children);
      }
      children.style.display = depth === 0 ? '' : 'none';
      wrap.appendChild(children);
    }

    return wrap;
  }

  function nodeById(id) {
    return nodeIndex.get(id) || null;
  }

  function ensureBuilt(container) {
    var lazyId = container.getAttribute('data-lazy');
    if (!lazyId || container.childElementCount) return;
    var node = nodeById(lazyId);
    if (!node || !node.children) return;
    container.removeAttribute('data-lazy');
    var depth = parseInt(container.getAttribute('data-depth'), 10) || 0;
    node.children.forEach(function (c) { container.appendChild(renderNode(c, depth + 1)); });
  }

  function toggleNode(wrap) {
    var row = $('.tree-row', wrap);
    var children = $('.tree-children', wrap);
    if (!children) return;
    if (children.style.display === 'none') {
      ensureBuilt(children);
      children.style.display = '';
      row.classList.add('open');
    } else {
      children.style.display = 'none';
      row.classList.remove('open');
    }
  }

  function expandGroup(groupId) {
    var container = els.tree.querySelector('[data-group="' + groupId + '"]');
    if (!container) return;
    var pending = [container];
    while (pending.length) {
      var cur = pending.shift();
      if (!cur) continue;
      if (cur.classList.contains('tree-children')) {
        ensureBuilt(cur);
        cur.style.display = '';
        var r = cur.previousElementSibling;
        if (r && r.classList.contains('tree-row')) r.classList.add('open');
      }
      Array.prototype.forEach.call(cur.children, function (c) { pending.push(c); });
    }
  }

  /* ---------------- Book opening ---------------- */

  function openBook(node, opts) {
    opts = opts || {};
    var bookId = opts.bookId || resolveBookForNode(node);
    if (node && nodeBook.get(node.id)) bookId = nodeBook.get(node.id);
    if (!bookId || !booksIndex[bookId]) return;
    var title = opts.title ||
      (node && node.name && (node.name.sinhala || node.name.pali)) ||
      titleFor(bookId);
    var target = opts.target;
    var segmentId = opts.segmentId;

    var qs = '?b=' + encodeURIComponent(bookId);
    if (segmentId) qs += '&s=' + encodeURIComponent(segmentId);
    try {
      if (window.history && history.replaceState) {
        history.replaceState(null, '', qs);
      }
    } catch (e) {}

    state.bookId = bookId;
    state.book = null;
    state.renderedUpTo = -1;
    state.target = segmentId ? { segmentId: segmentId, page: (opts.page != null ? opts.page : null) } : null;

    els.bookHead.classList.remove('hidden');
    els.bookTitle.textContent = title;
    var meta = [];
    if (booksIndex[bookId]) meta.push(CATEGORY_LABEL[booksIndex[bookId].category] || '');
    meta.push('සමුද්දේශය: බුද්ධ ජයන්ති');
    els.bookMeta.textContent = meta.filter(Boolean).join(' · ');
    updateNavLinks(bookId);
    els.readerArea.innerHTML = '';
    els.readerLoading.classList.remove('hidden');

    loadBookData(bookId).then(function (book) {
      state.book = book;
      els.readerLoading.classList.add('hidden');
      var restorePos = null;
      if (state.target && state.target.page != null && state.target.segmentId) {
        restorePos = { p: state.target.page, s: state.target.segmentId };
      } else if (state.target && state.target.segmentId) {
        restorePos = { p: pageIndexOfSegment(book, state.target.segmentId), s: state.target.segmentId };
      } else if (opts && opts.target) {
        var hid = findSegmentId(book, opts.target);
        restorePos = { p: pageIndexOfSegment(book, hid), s: hid };
      } else {
        var last = getLastPos(bookId);
        if (last && last.s != null) {
          if (last.p == null) last.p = pageIndexOfSegment(book, last.s);
          restorePos = last;
        }
      }

      if (!restorePos || !restorePos.s) {
        restorePos = { p: 0, s: null };
        if (book.pages && book.pages[0] && book.pages[0].segments && book.pages[0].segments[0]) {
          restorePos.s = book.pages[0].segments[0].id;
        }
      }
      renderPagesUpTo(restorePos.p);
      scrollToSegment(restorePos.p, restorePos.s, !!state.target);
      observeSentinel();
    }).catch(function (err) {
      els.readerLoading.classList.add('hidden');
      els.readerArea.innerHTML = '<div class="empty">පොත පූරණය කළ නොහැකි විය.<br><small>' + esc(String(err)) + '</small></div>';
    });
  }

  /* ---------- A / Su links ---------- */

  function updateNavLinks(bookId) {
    var cat = booksIndex[bookId] ? booksIndex[bookId].category : null;
    var aLink = els.attaLink;
    var suLink = els.suLink;
    var label = els.navLinkLabel;

    aLink.classList.add('hidden');
    suLink.classList.add('hidden');
    label.textContent = '';

    if (cat && cat !== 'atta' && cat !== 'anya') {
      var attaId = 'atta-' + bookId;
      if (booksIndex[attaId]) {
        aLink.classList.remove('hidden');
        aLink.href = '?b=' + encodeURIComponent(attaId);
        label.textContent = 'අට්ඨකථාවට';
      }
    } else if (cat === 'atta') {
      var suttaId = findSuttaBook(bookId.replace(/^atta-/, ''));
      if (suttaId) {
        suLink.classList.remove('hidden');
        suLink.href = '?b=' + encodeURIComponent(suttaId);
        label.textContent = 'සූත්‍රයට';
      }
    }
  }

  function findSuttaBook(id) {
    if (booksIndex[id]) return id;
    var parts = id.split('-');
    while (parts.length > 1) {
      parts.pop();
      var cand = parts.join('-');
      if (booksIndex[cand]) return cand;
    }
    return null;
  }

  /* ---------------- Segment / page helpers ---------------- */

  function findSegmentId(book, targetName) {
    var pali = normalize(targetName && targetName.pali);
    var si = normalize(targetName && targetName.sinhala);
    var firstHeading = null;
    for (var p = 0; p < book.pages.length; p++) {
      var segs = book.pages[p].segments || [];
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        if (s.type === 'heading' && !firstHeading) firstHeading = s.id;
        if ((s.type === 'heading') && pali && normalize(s.pali) === pali) return s.id;
        if ((s.type === 'heading') && si && normalize(s.sinhala) === si) return s.id;
      }
    }
    return firstHeading;
  }

  function pageIndexOfSegment(book, segmentId) {
    for (var p = 0; p < book.pages.length; p++) {
      var segs = book.pages[p].segments || [];
      for (var i = 0; i < segs.length; i++) {
        if (segs[i].id === segmentId) return p;
      }
    }
    return 0;
  }

  function getLastPos(bookId) {
    try {
      var m = loadLocal(LS.lastPos, {});
      return m[bookId] || null;
    } catch (e) { return null; }
  }

  function saveLastPos(bookId, pos) {
    if (!bookId || !pos || pos.s == null) return;
    try {
      var m = loadLocal(LS.lastPos, {});
      m[bookId] = pos;
      saveLocal(LS.lastPos, m);
    } catch (e) {}
  }

  /* ---------------- Rendering ---------------- */

  function formatSeg(text, footnotes) {
    var s = esc(text || '');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\{(\*|\d+)\}/g, function (m, n) {
      var idx = (n === '*') ? 0 : (parseInt(n, 10) - 1);
      var fn = footnotes && footnotes[idx];
      return fn ? '<sup class="footnote-ref" title="' + esc(fn) + '">' + n + '</sup>' : '';
    });
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  function renderSegment(seg, bookId, pageIdx) {
    var type = seg.type || 'paragraph';
    var row = document.createElement('div');
    row.className = 'seg-row seg-' + type;
    row.id = 'seg-' + bookId + '-' + pageIdx + '-' + seg.id;
    row.setAttribute('data-page', pageIdx);
    row.setAttribute('data-seg', seg.id);
    var fns = null;

    var isHeading = (type === 'heading' || type === 'centered');
    var text = isHeading ? (seg.pali || seg.sinhala) : seg.pali;
    if (isHeading) {
      row.appendChild(el('div', 'full-text', formatSeg(text, fns)));
    } else {
      if (seg.pali) row.appendChild(el('div', 'pali', formatSeg(seg.pali, fns)));
      if (seg.sinhala) row.appendChild(el('div', 'sinhala', formatSeg(seg.sinhala, fns)));
    }
    return row;
  }

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    d.className = cls;
    d.innerHTML = html;
    return d;
  }

  function renderPage(pageIdx) {
    if (!state.book || !state.book.pages) return;
    var page = state.book.pages[pageIdx];
    if (!page) return;
    var block = document.createElement('div');
    block.className = 'page-block';
    (page.segments || []).forEach(function (seg) {
      block.appendChild(renderSegment(seg, state.bookId, pageIdx));
    });
    if (page.footnotes && page.footnotes.length) {
      var fnWrap = document.createElement('div');
      fnWrap.className = 'page-footnotes';
      fnWrap.appendChild(el('div', 'pf-title', 'පාද සටහන්'));
      page.footnotes.forEach(function (fn) {
        var d = document.createElement('div');
        d.textContent = fn;
        fnWrap.appendChild(d);
      });
      block.appendChild(fnWrap);
    }
    els.readerArea.appendChild(block);
    state.renderedUpTo = pageIdx;
  }

  function renderPagesUpTo(idx) {
    var book = state.book;
    if (!book || !book.pages) return;
    var from = state.renderedUpTo + 1;
    var to = Math.min(idx, book.pages.length - 1);
    if (from <= 0 && state.renderedUpTo === -1) from = 0;
    for (var i = from; i <= to; i++) renderPage(i);
  }

  /* ---------------- Scroll / sentinel ---------------- */

  var sentinelObserver = null;

  function observeSentinel() {
    if (sentinelObserver) sentinelObserver.disconnect();
    sentinelObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var next = state.renderedUpTo + 1;
          if (state.book && next < state.book.pages.length) {
            renderPagesUpTo(next + 1);
          }
        }
      });
    }, { root: els.readerScroll, rootMargin: '600px 0px' });
    sentinelObserver.observe(els.infiniteSentinel);
  }

  var scrollSaveTimer = null;

  function trackScroll() {
    if (scrollSaveTimer) return;
    scrollSaveTimer = setTimeout(function () {
      scrollSaveTimer = null;
      var pos = firstVisibleSegment();
      if (pos && state.bookId) saveLastPos(state.bookId, pos);
    }, 400);
  }

  function firstVisibleSegment() {
    var rows = els.readerArea.querySelectorAll('.seg-row');
    var top = els.readerScroll.getBoundingClientRect().top + 40;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].getBoundingClientRect();
      if (r.bottom > top) {
        return { p: parseInt(rows[i].getAttribute('data-page'), 10), s: rows[i].getAttribute('data-seg') };
      }
    }
    return null;
  }

  function scrollToSegment(pageIdx, segmentId, flash) {
    if (pageIdx > state.renderedUpTo) renderPagesUpTo(pageIdx);
    var target = els.readerArea.querySelector('[data-page="' + pageIdx + '"][data-seg="' + segmentId + '"]');
    if (!target) {
      target = els.readerArea.querySelector('[data-seg="' + segmentId + '"]');
    }
    if (target) {
      target.scrollIntoView({ block: 'start' });
      if (flash) {
        target.classList.add('seg-flash');
        setTimeout(function () { target.classList.remove('seg-flash'); }, 2400);
      }
    } else {
      els.readerScroll.scrollTop = 0;
    }
  }

  /* ---------------- Search ---------------- */

  function initSearch() {
    var input = els.searchInput;
    var results = els.searchResults;
    var debounce = null;

    input.addEventListener('input', function () {
      clearTimeout(debounce);
      var q = input.value.trim();
      if (!q) {
        results.classList.add('hidden');
        results.innerHTML = '';
        return;
      }
      debounce = setTimeout(function () { runSearch(q); }, 350);
    });

    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.searchbox')) {
        results.classList.add('hidden');
      }
    });

    els.filters.addEventListener('click', function (ev) {
      var chip = ev.target.closest('.filter-chip');
      if (!chip) return;
      els.filters.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      state.currentFilter = chip.getAttribute('data-cat');
      var q = input.value.trim();
      if (q) runSearch(q);
    });
  }

  function categoriesForFilter() {
    var f = state.currentFilter;
    if (!f || f === 'all') return ['sut', 'vin', 'abh', 'atta', 'anya'];
    var map = { sut: 'sut', vin: 'vin', abh: 'abh', atta: 'atta', anya: 'anya' };
    return [map[f]];
  }

  function runSearch(query) {
    var token = ++state.searchToken;
    state.lastQuery = query;
    var results = els.searchResults;
    results.classList.remove('hidden');
    results.innerHTML = '<div class="sr-status">සොයමින්...</div>';

    var cats = categoriesForFilter();
    var bookIds = Object.keys(booksIndex).filter(function (id) {
      return cats.indexOf(booksIndex[id].category) !== -1;
    });
    bookIds.sort(function (a, b) { return booksIndex[a].file.length - booksIndex[b].file.length; });

    var ql = query.toLowerCase();
    var out = [];
    var done = 0;
    var total = bookIds.length;

    function nextChunk() {
      if (state.searchToken !== token) return;
      var batch = bookIds.splice(0, 4);
      if (!batch.length) {
        finishSearch(token, results, out, total);
        return;
      }
      batch.forEach(function (bookId) {
        done++;
        loadBookData(bookId).then(function (book) {
          searchInBook(bookId, book, ql, out);
          if (state.searchToken !== token) return;
          results.querySelector('.sr-status').textContent =
            'සොයමින්... (පොත් ' + done + '/' + total + ') · හමුවූ: ' + out.length;
        }).catch(function () {}).finally(function () {
          if (state.searchToken === token) nextChunk();
        });
      });
    }

    nextChunk();
  }

  function searchInBook(bookId, book, ql, out) {
    if (out.length >= 200) return;
    var count = 0;
    for (var p = 0; p < book.pages.length && count < 30; p++) {
      var segs = book.pages[p].segments || [];
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        var inPali = s.pali && s.pali.toLowerCase().indexOf(ql) !== -1;
        var inSi = s.sinhala && s.sinhala.toLowerCase().indexOf(ql) !== -1;
        if (!inPali && !inSi) continue;
        var snippet = inPali ? s.pali : s.sinhala;
        out.push({ bookId: bookId, page: p, seg: s, snippet: snippet, title: titleFor(bookId) });
        count++;
        if (count >= 30) break;
      }
    }
  }

  function finishSearch(token, results, out, total) {
    if (state.searchToken !== token) return;
    if (!out.length) {
      results.innerHTML = '<div class="sr-status">ප්‍රතිඵල හමු නොවීය (පොත් ' + total + ' පිරික්සුවේය).</div>';
      return;
    }
    results.innerHTML = '';
    out.forEach(function (hit) {
      var item = document.createElement('div');
      item.className = 'sr-item';
      var plain = hit.snippet.replace(/\*\*/g, '').replace(/\{\*|\d+\}/g, '');
      if (plain.length > 160) plain = plain.slice(0, 160) + '…';
      item.innerHTML =
        '<div class="sr-book">' + esc(hit.title) + ' · ' + esc(CATEGORY_LABEL[booksIndex[hit.bookId].category]) + '</div>' +
        '<div class="sr-snippet">' + highlightSnippet(esc(plain), state.lastQuery) + '</div>';
      item.addEventListener('click', function () {
        results.classList.add('hidden');
        openBookAtSegment(hit);
      });
      results.appendChild(item);
    });
    var status = document.createElement('div');
    status.className = 'sr-status';
    status.textContent = 'ප්‍රතිඵල ' + out.length + ' (පොත් ' + total + ' පිරික්සුවේය)';
    results.appendChild(status);
  }

  function highlightSnippet(text, q) {
    if (!q) return text;
    var qesc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp('(' + qesc + ')', 'gi'), '<mark>$1</mark>');
  }

  function openBookAtSegment(hit) {
    var node = bookTitles.get(hit.bookId);
    openBook(node, { bookId: hit.bookId, segmentId: hit.seg.id, page: hit.page });
  }

  /* ---------------- Bookmarks ---------------- */

  function getBookmarks() { return loadLocal(LS.bookmarks, []); }

  function saveBookmarks(list) { saveLocal(LS.bookmarks, list); }

  function isBookmarked(bookId) {
    return getBookmarks().some(function (b) { return b.bookId === bookId; });
  }

  function toggleBookmark() {
    if (!state.bookId) { toast('පළමුව පොතක් විවෘත කරන්න'); return; }
    var list = getBookmarks();
    var idx = list.findIndex(function (b) { return b.bookId === state.bookId; });
    if (idx > -1) {
      list.splice(idx, 1);
      saveBookmarks(list);
      els.bookmarkBtn.textContent = '★';
      toast('Bookmark ඉවත් කරන ලදී');
    } else {
      var pos = firstVisibleSegment() || {};
      list.push({
        id: 'bm-' + Date.now(),
        bookId: state.bookId,
        title: titleFor(state.bookId),
        date: new Date().toLocaleDateString('si-LK'),
        page: pos.p != null ? pos.p : 0,
        segmentId: pos.s || null
      });
      saveBookmarks(list);
      els.bookmarkBtn.textContent = '★';
      toast('Bookmark එකතු කරන ලදී');
    }
  }

  function renderBookmarks() {
    var list = getBookmarks();
    var box = els.bookmarksList;
    if (!list.length) {
      box.innerHTML = '<div class="bm-empty">Bookmarks නොමැත.</div>';
      return;
    }
    box.innerHTML = '';
    list.slice().reverse().forEach(function (b) {
      var item = document.createElement('div');
      item.className = 'bm-item';
      var title = document.createElement('span');
      title.className = 'bm-title';
      title.textContent = b.title || b.bookId;
      title.addEventListener('click', function () {
        closeModal('bookmarksModal');
        var node = bookTitles.get(b.bookId);
        openBook(node, { bookId: b.bookId, segmentId: b.segmentId, page: b.page });
      });
      var date = document.createElement('span');
      date.className = 'bm-date';
      date.textContent = b.date || '';
      var del = document.createElement('button');
      del.className = 'bm-del';
      del.textContent = '✕';
      del.title = 'මකන්න';
      del.addEventListener('click', function () {
        saveBookmarks(getBookmarks().filter(function (x) { return x.id !== b.id; }));
        renderBookmarks();
      });
      item.appendChild(title);
      item.appendChild(date);
      item.appendChild(del);
      box.appendChild(item);
    });
  }

  /* ---------------- Notes ---------------- */

  function getNotes() { return loadLocal(LS.notes, []); }

  function saveNotes(list) { saveLocal(LS.notes, list); }

  function openNoteModal() {
    if (!state.bookId) { toast('පළමුව පොතක් විවෘත කරන්න'); return; }
    var notes = getNotes();
    var existing = notes.filter(function (n) { return n.bookId === state.bookId; });
    els.noteFor.textContent = '📖 ' + (titleFor(state.bookId)) + ' (' + state.bookId + ')';
    els.noteText.value = existing.length ? existing[existing.length - 1].note : '';
    openModal('noteModal');
    els.noteText.focus();
  }

  function saveNote() {
    var note = els.noteText.value.trim();
    var list = getNotes();
    var id = 'note-' + Date.now();
    var entry = {
      id: id,
      bookId: state.bookId,
      bookTitle: titleFor(state.bookId),
      note: note,
      date: new Date().toLocaleString('si-LK')
    };
    var idx = list.findIndex(function (n) { return n.bookId === state.bookId; });
    if (idx > -1) list[idx] = entry; else list.push(entry);
    saveNotes(list);
    closeModal('noteModal');
    toast(note ? 'සටහන සුරකින ලදී' : 'සටහන මකා දමන ලදී');
  }

  /* ---------------- Modals ---------------- */

  function openModal(id) {
    $('#' + id).classList.remove('hidden');
  }

  function closeModal(id) {
    $('#' + id).classList.add('hidden');
  }

  function bindModals() {
    document.addEventListener('click', function (ev) {
      var close = ev.target.closest('[data-close]');
      if (close) closeModal(close.getAttribute('data-close'));
      var ov = ev.target.closest('.modal-overlay');
      if (ov && ev.target === ov) ov.classList.add('hidden');
    });
  }

  /* ---------------- Dictionary popup ---------------- */

  function initDict() {
    els.readerArea.addEventListener('mouseup', function (ev) { onSelect(ev); });
    els.readerArea.addEventListener('touchend', function () {
      setTimeout(function () { onSelect(null); }, 80);
    });
    els.dictClose.addEventListener('click', function (ev) {
      ev.stopPropagation();
      els.dictPopup.classList.add('hidden');
    });
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.dict-popup')) els.dictPopup.classList.add('hidden');
    });
  }

  function onSelect(ev) {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    var text = sel.toString().trim();
    if (text.length < 1 || text.length > 24) return;
    var anchor = sel.anchorNode;
    var parent = anchor && (anchor.nodeType === 3 ? anchor.parentElement : anchor);
    var paliBlock = parent && parent.closest('.pali');
    if (!paliBlock) return;

    var lookup = window.SUTHTHA_LOOKUP(text);
    var word = lookup.word;
    if (!word) return;

    var html;
    if (lookup.meaning) {
      html = '<div class="dp-word">' + esc(word) + '</div>' +
        '<div class="dp-meaning">' + esc(lookup.meaning) + '</div>';
    } else {
      html = '<div class="dp-word">' + esc(word) + '</div>' +
        '<div class="dp-unknown">මෙම වචනයට අර්ථයක් සම්බන්ධ ශබ්දකෝෂයේ නොමැත.</div>';
    }
    html += '<div class="dp-links">' +
      '<a href="https://www.digitalpalidictionary.org/?word=' + encodeURIComponent(word) + '" target="_blank" rel="noopener">Digital Pali Dictionary ➜</a>' +
      '<a href="https://www.tipitaka.lk/dictionary" target="_blank" rel="noopener">Tipitaka.lk ශබ්දකෝෂය ➜</a>' +
      '</div>';
    els.dictBody.innerHTML = html;

    var rect = (ev && ev.getBoundingClientRect) ? ev.getBoundingClientRect() : paliBlock.getBoundingClientRect();
    var x = rect.left, y = rect.bottom + 6;
    if (rect.width > 300) x = rect.left + 30;
    var pw = els.dictPopup.offsetWidth || 300;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    if (x + pw > vw - 8) x = Math.max(8, vw - pw - 8);
    if (y > vh - 120) y = Math.max(8, rect.top - 130);
    els.dictPopup.style.left = x + 'px';
    els.dictPopup.style.top = y + 'px';
    els.dictPopup.classList.remove('hidden');
  }

  /* ---------------- Mode / font / theme ---------------- */

  function applyMode(mode, persist) {
    document.body.className = document.body.className.replace(/\breader-\w+\b/g, '').trim();
    if (mode === 'pair') document.body.classList.add('reader-pair');
    if (mode === 'split') document.body.classList.add('reader-split');
    if (mode === 'single') {
      document.body.classList.add('reader-single');
      applyLang(state.lang || 'si');
    }
    els.modeMenu.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    var labels = { pair: 'පාලි + සිංහල', split: 'පැත්ත පැත්ත', single: 'එක භාෂාවක්' };
    els.modeBtn.textContent = labels[mode] + ' ▾';
    if (persist) saveLocal(LS.mode, mode);
  }

  function applyLang(lang, persist) {
    state.lang = lang;
    document.body.setAttribute('data-lang', lang);
    els.langToggle.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    if (persist) saveLocal(LS.lang, lang);
  }

  function applyFontSize(size, persist) {
    state.fontSize = Math.max(60, Math.min(160, size));
    els.readerScroll.style.fontSize = state.fontSize + '%';
    els.fontValue.textContent = state.fontSize + '%';
    if (persist) saveLocal(LS.font, state.fontSize);
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);
    els.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    var mt = document.getElementById('themeToggleMobile');
    if (mt) mt.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
    if (persist) saveLocal(LS.theme, theme);
  }

  /* ---------------- Init ---------------- */

  function bindEvents() {
    els.sidebarToggle.addEventListener('click', function () {
      els.sidebar.classList.toggle('collapsed');
    });
    els.sidebarClose.addEventListener('click', function () {
      els.sidebar.classList.add('collapsed');
    });
    document.getElementById('welcomeBrowse').addEventListener('click', function () {
      els.sidebar.classList.remove('collapsed');
    });
    document.querySelectorAll('[data-open-tree]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        els.sidebar.classList.remove('collapsed');
        expandGroup(a.getAttribute('data-open-tree'));
      });
    });
    document.querySelectorAll('[data-open-note]').forEach(function (b) {
      b.addEventListener('click', function () { openNoteModal(); });
    });
    els.navToggle.addEventListener('click', function () {
      els.navMobile.classList.toggle('open');
    });

    els.themeToggle.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark', true);
    });

    els.modeBtn.addEventListener('click', function () {
      els.modeMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.mode-select')) els.modeMenu.classList.add('hidden');
    });
    els.modeMenu.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      applyMode(b.getAttribute('data-mode'), true);
      els.modeMenu.classList.add('hidden');
    });
    els.langToggle.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (b) applyLang(b.getAttribute('data-lang'), true);
    });

    els.fontPlus.addEventListener('click', function () { applyFontSize((state.fontSize || 100) + 10, true); });
    els.fontMinus.addEventListener('click', function () { applyFontSize((state.fontSize || 100) - 10, true); });

    els.bookmarkBtn.addEventListener('click', toggleBookmark);
    els.bmListBtn.addEventListener('click', function () { renderBookmarks(); openModal('bookmarksModal'); });
    els.noteSave.addEventListener('click', saveNote);

    els.readerScroll.addEventListener('scroll', trackScroll);
    els.infiniteSentinel.addEventListener('click', function () {
      if (state.book) renderPagesUpTo(state.renderedUpTo + 3);
    });

    window.addEventListener('popstate', function () {
      var params = new URLSearchParams(location.search);
      var b = params.get('b');
      if (b) openDeepLink(b, params.get('s') || undefined);
    });
  }

  function restorePrefs() {
    var theme = loadLocal(LS.theme, null);
    if (theme === 'dark') applyTheme('dark', false);
    else applyTheme('light', false);

    var font = loadLocal(LS.font, 100);
    applyFontSize(font, false);

    var mode = loadLocal(LS.mode, 'pair');
    applyMode(mode, false);

    var lang = loadLocal(LS.lang, 'si');
    applyLang(lang, false);
  }

  function init() {
    els.tree = $('#tree');
    els.sidebar = $('#sidebar');
    els.sidebarToggle = $('#sidebarToggle');
    els.sidebarClose = $('#sidebarClose');
    els.navToggle = $('#navToggle');
    els.navMobile = $('#navMobile');
    els.themeToggle = $('#themeToggle');
    els.readerScroll = $('#readerScroll');
    els.readerArea = $('#readerArea');
    els.readerLoading = $('#readerLoading');
    els.infiniteSentinel = $('#infiniteSentinel');
    els.bookHead = $('#bookHead');
    els.bookTitle = $('#bookTitle');
    els.bookMeta = $('#bookMeta');
    els.attaLink = $('#attaLink');
    els.suLink = $('#suLink');
    els.navLinkLabel = $('#navLinkLabel');
    els.searchInput = $('#searchInput');
    els.searchResults = $('#searchResults');
    els.filters = $('#filters');
    els.modeBtn = $('#modeBtn');
    els.modeMenu = $('#modeMenu');
    els.langToggle = $('#langToggle');
    els.fontPlus = $('#fontPlus');
    els.fontMinus = $('#fontMinus');
    els.fontValue = $('#fontValue');
    els.bookmarkBtn = $('#bookmarkBtn');
    els.bmListBtn = $('#bmListBtn');
    els.bookmarksList = $('#bookmarksList');
    els.bookmarksModal = $('#bookmarksModal');
    els.noteModal = $('#noteModal');
    els.noteFor = $('#noteFor');
    els.noteText = $('#noteText');
    els.noteSave = $('#noteSave');
    els.dictPopup = $('#dictPopup');
    els.dictBody = $('#dictBody');
    els.dictClose = $('#dictClose');
    els.toast = $('#toast');

    document.getElementById('year').textContent = new Date().getFullYear();

    restorePrefs();
    bindEvents();
    bindModals();
    initSearch();
    initDict();

    initData().then(function () {
      var params = new URLSearchParams(location.search);
      var b = params.get('b');
      if (b) openDeepLink(b, params.get('s') || undefined);
    }).catch(function (err) {
      els.tree.innerHTML = '<div class="empty">දත්ත පූරණය වීමේ දෝෂයකි.<br><small>' + esc(String(err)) + '</small></div>';
    });
  }

  function openDeepLink(id, segmentId) {
    var node = nodeIndex.get(id) || null;
    var bookId = nodeBook.get(id) || id;
    if (!booksIndex[bookId]) return;
    var opts = { bookId: bookId };
    if (segmentId) opts.segmentId = segmentId;
    else if (node && (!node.children || !node.children.length)) opts.target = node.name;
    openBook(node, opts);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
