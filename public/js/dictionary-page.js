/* ============================================================
   Suththa.org — dictionary-page.js (dictionary.html logic)
   ============================================================ */
(function () {
  'use strict'

  const utils = Suththa.utils
  const dict = Suththa.dictionary

  const dictNames = {
    BUS: 'පොල්වත්තේ බුද්ධදත්ත',
    MS: 'මඩිතියවෙල සුමඞ්ගල',
  }

  let selectedDicts = ['BUS', 'MS']
  let timer = null

  function renderDictSources() {
    const el = document.getElementById('dict-sources')
    if (!el) return
    el.innerHTML = ['BUS', 'MS'].map(function (d) {
      return '<label class="dict-source"><input type="checkbox" data-dict="' + d + '"' +
        (selectedDicts.indexOf(d) >= 0 ? ' checked' : '') + '>' + dictNames[d] + '</label>'
    }).join('')
    el.addEventListener('change', function (e) {
      if (e.target.dataset && e.target.dataset.dict) {
        const d = e.target.dataset.dict
        selectedDicts = selectedDicts.indexOf(d) >= 0
          ? selectedDicts.filter(function (x) { return x != d })
          : selectedDicts.concat([d])
        runSearch()
      }
    })
  }

  function renderResults(res) {
    const body = document.getElementById('dict-results')
    const info = document.getElementById('dict-count')
    if (!body) return
    let html = ''
    if (res.matches.length) {
      res.matches.forEach(function (m) {
        html += '<div class="dict-result">' +
          '<div><span class="dr-word">' + utils.escapeHtml(m.word) + '</span>' +
          '<span class="dr-dict">' + (dictNames[m.d] || m.d) + '</span>' +
          '<button class="dr-breakup" data-breakup="' + utils.escapeHtml(m.word) + '">විග්‍රහය ▸</button></div>' +
          '<div class="dr-meaning">' + utils.meaningHtml(m.m) + '</div>' +
          '</div>'
      })
    } else {
      html += '<div class="banner">මෙම වචනය තෝරාගත් ශබ්දකෝෂවල හමුවූයේ නැත. පූර්ව කොටස් පරීක්ෂා කරන්න.</div>'
    }
    if (res.prefixWords.length) {
      html += '<div class="dict-prefix">සමාන වචන: ' + res.prefixWords.map(function (p) {
        return '<button class="prefix-chip" data-prefix="' + utils.escapeHtml(p.word) + '">' + p.word + '</button>'
      }).join('') + '</div>'
    }
    body.innerHTML = html
    if (info) info.textContent = res.matches.length + ' ප්‍රතිඵල'
  }

  async function runSearch() {
    const input = document.getElementById('dict-input')
    if (!input) return
    const word = dict.cleanWord(input.value)
    const body = document.getElementById('dict-results')
    if (!word) {
      renderResults({ matches: [], prefixWords: [] })
      return
    }
    if (!dict.isLoaded()) {
      body.innerHTML = '<div class="dict-loading"><div class="skeleton skeleton-line w70"></div>' +
        '<div class="skeleton skeleton-line"></div></div>'
    }
    try {
      await dict.ensureDict()
    } catch (e) {
      body.innerHTML = '<div class="banner error">ශබ්දකෝෂ දත්ත පූරණය කළ නොහැක: ' + utils.escapeHtml(e.message) + '</div>'
      return
    }
    renderResults(dict.runSearch(word, selectedDicts))
  }

  async function showBreakup(word) {
    const body = document.getElementById('dict-results')
    if (!body) return
    try {
      const b = await dict.getBreakup(word)
      if (!b) {
        utils.showSnackbar('මෙම වචනයට විග්‍රහයක් හමුවූයේ නැත')
        return
      }
      const el = document.createElement('div')
      el.className = 'breakup-box'
      el.innerHTML = '<span class="bw-word">' + utils.escapeHtml(b.word) + '</span>' +
        '<span class="bu-type">' + utils.escapeHtml(b.type) + '</span>' +
        '<div class="bw-breakup">' + utils.escapeHtml(b.breakup) + '</div>'
      const anchor = body.querySelector('[data-breakup="' + utils.escapeHtml(word) + '"]')
      if (anchor && anchor.parentElement) {
        const box = anchor.parentElement.querySelector('.breakup-box')
        if (box) box.remove()
        else anchor.parentElement.appendChild(el)
      }
    } catch (e) { /* ignore */ }
  }

  function bind() {
    const input = document.getElementById('dict-input')
    const body = document.getElementById('dict-results')
    input.addEventListener('input', function () {
      clearTimeout(timer)
      timer = setTimeout(runSearch, 300)
    })
    input.addEventListener('keydown', function (e) {
      if (e.key == 'Enter') runSearch()
    })
    document.getElementById('dict-backspace').addEventListener('click', function () {
      input.value = input.value.replace(/[අ-ෆ][\u0DCA-\u0DDF\u0D82\u0D83\u200d]*$/, '')
      runSearch()
    })
    body.addEventListener('click', function (e) {
      if (e.target.dataset && e.target.dataset.prefix) {
        input.value = e.target.dataset.prefix
        runSearch()
      }
      if (e.target.dataset && e.target.dataset.breakup) {
        showBreakup(e.target.dataset.breakup)
      }
    })
  }

  function init() {
    Suththa.nav.init()
    renderDictSources()
    bind()
    const q = new URLSearchParams(location.search).get('word')
    if (q) {
      document.getElementById('dict-input').value = q
      runSearch()
    }
  }

  Suththa.dictionaryPage = { init: init, runSearch: runSearch }
  document.addEventListener('DOMContentLoaded', init)
})()
