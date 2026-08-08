/* ============================================================
   Suththa.org — utils.js (getJson, debounce, text conversion…)
   ============================================================ */
(function () {
  'use strict'

  const config = Suththa.config

  // ---- JSON loading (XHR so it also works from file:// on some browsers) ----
  function getJson(url) {
    return new Promise(function (resolve, reject) {
      const xhr = new XMLHttpRequest()
      xhr.onload = function () {
        try { resolve(JSON.parse(xhr.responseText)) }
        catch (e) { reject(new TypeError('Failed to parse ' + url)) }
      }
      xhr.onerror = function () {
        reject(new TypeError('Request to ' + url + ' failed'))
      }
      xhr.open('GET', url)
      xhr.send(null)
    })
  }

  // ---- debounce ----
  function debounce(fn, wait) {
    let t
    return function () {
      const args = arguments, self = this
      clearTimeout(t)
      t = setTimeout(function () { fn.apply(self, args) }, wait)
    }
  }

  // ---- clipboard ----
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text)
    }
    return new Promise(function (resolve, reject) {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); resolve() }
      catch (e) { reject(e) }
      document.body.removeChild(ta)
    })
  }

  // ---- snackbar ----
  let snackTimer = null
  function showSnackbar(message, timeout) {
    const el = document.getElementById('snackbar')
    if (!el) return
    el.textContent = message
    el.classList.add('show')
    clearTimeout(snackTimer)
    snackTimer = setTimeout(function () { el.classList.remove('show') }, timeout || 2200)
  }

  // ---- text conversion (port of src/text-convert.mjs) ----
  const commonConjuncts = [['ක', 'ව'], ['ත', 'ථ'], ['ත', 'ව'], ['න', 'ථ'], ['න', 'ද'], ['න', 'ධ']]
  const paliConjuncts = [['ඤ', 'ච'], ['ඤ', 'ජ'], ['ඤ', 'ඡ'], ['ට', 'ඨ'], ['ණ', 'ඩ'], ['ද', 'ධ'], ['ද', 'ව']]

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  function addBandiLetters(text) {
    text = text.replace(/\u200C/g, '')
    text = text.replace(/([ක-ෆ])\u0DCA([ක-ෆ])/g, '$1\u200D\u0DCA$2')
    text = text.replace(/([ක-ෆ])\u0DCA([ක-ෆ])/g, '$1\u200D\u0DCA$2')
    text = text.replace(/\u0DDA/g, '\u0DD9')
    text = text.replace(/\u0DDD/g, '\u0DDC')
    return text
  }
  function addConjuncts(text, pairs) {
    pairs.forEach(function (pair) {
      text = text.split(pair[0] + '\u0DCA' + pair[1]).join(pair[0] + '\u0DCA\u200D' + pair[1])
    })
    return text
  }
  function addRakarYansa(text) {
    return text.replace(/\u0DCA([\u0DBA\u0DBB])/g, '\u0DCA\u200D$1')
  }

  function beautifyText(text, lang, options) {
    if (!text) return text
    if (lang == 'sinh') return text
    options = options || {}
    text = addRakarYansa(text)
    text = addConjuncts(text, commonConjuncts)
    if (lang == 'pali') {
      if (options.specialLetters) text = addConjuncts(text, paliConjuncts)
      if (options.bandiLetters) text = addBandiLetters(text)
    }
    return text
  }

  // ---- tokenisation (port of textParts in TextTab.vue) ----
  // returns array of [text, token] ; token in {fn-pointer, fn-abbr, highlight,
  // bold, underline, strike, false}
  function textParts(text, footnoteMethod) {
    let out = text || ''
    if (footnoteMethod == 'hidden') {
      out = out.replace(/\{\d+\}/g, '') // remove footnotes entirely
    } else {
      out = out.replace(/\{(\d+)\}/g, '|$1℗fn-pointer|')
    }
    out = out.replace(/##(.+?)##/g, '|$1℗highlight|')
    out = out.replace(/\*\*(.+?)\*\*/g, '|$1℗bold|')
    out = out.replace(/__(.+?)__/g, '|$1℗underline|')
    out = out.replace(/~~(.+?)~~/g, '|$1℗strike|')
    out = out.replace(/\$\$/g, '')
    out = out.replace(/↴/g, '\n')
    out = out.replace(/\n/g, '<br>')
    return out.split('|').filter(Boolean).map(function (t) {
      const i = t.indexOf('℗')
      return i >= 0 ? [t.slice(0, i), t.slice(i + 1)] : [t, false]
    })
  }

  // ---- html escaping ----
  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  // dictionary meanings contain legacy red-colour markers like <r c1>..</r>
  // escape first, then turn the escaped markers into <b> (keeps data safe)
  function meaningHtml(m) {
    return escapeHtml(m)
      .replace(/&lt;r\s+[^&]*?&gt;/gi, '<b>')
      .replace(/&lt;\/r&gt;/gi, '</b>')
      .replace(/&lt;br&gt;/gi, '<br>')
      .replace(/\n/g, '<br>')
  }

  // ---- word-wrap tagger (port of genWords in TextEntry.vue) ----
  // wraps sinhala-script runs in <w> tags so clicks open the dictionary
  function genWords(part, language) {
    if (language == 'sinh') return part
    return part.replace(/[\u0d80-\u0dff\u200d]+/g, '<w>$&</w>')
  }

  // strip the markup for copying
  function stripMarkup(text) {
    return String(text || '')
      .replace(/\{(\d+)\}/g, '')
      .replace(/##(.+?)##/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/\$\$/g, '')
      .replace(/↴/g, '\n')
  }

  // ---- storage helpers ----
  function lsGet(key, fallback) {
    try {
      const v = localStorage.getItem(key)
      return v ? JSON.parse(v) : fallback
    } catch (e) { return fallback }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) { /* ignore */ }
  }

  // ---- misc helpers ----
  function isEIndLessEqual(a, b) {
    return a[0] < b[0] || (a[0] == b[0] && a[1] <= b[1])
  }
  function entryToKeyStr(entry) {
    return entry.key + ':' + entry.eInd.join('-') + ':' + entry.language
  }

  Suththa.utils = {
    getJson: getJson,
    debounce: debounce,
    copyText: copyText,
    showSnackbar: showSnackbar,
    beautifyText: beautifyText,
    textParts: textParts,
    escapeRegExp: escapeRegExp,
    escapeHtml: escapeHtml,
    meaningHtml: meaningHtml,
    genWords: genWords,
    stripMarkup: stripMarkup,
    lsGet: lsGet,
    lsSet: lsSet,
    isEIndLessEqual: isEIndLessEqual,
    entryToKeyStr: entryToKeyStr,
  }
})()
