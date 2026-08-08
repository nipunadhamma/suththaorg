/* ============================================================
   Suththa.org — render.js (entry & footnote -> HTML)
   ============================================================ */
(function () {
  'use strict'

  const utils = Suththa.utils
  const store = Suththa.store
  const config = Suththa.config

  // Wrap highlight words in ##..## markers so textParts can tokenise them
  function highlightWords(text, words) {
    if (!words || !words.length) return text
    const re = new RegExp('(' + words.map(function (w) {
      return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }).join('|') + ')', 'g')
    return text.replace(re, '##$1##')
  }

  // Prepare an entry for display: beautify text, optionally highlight, tokenise
  function processEntry(entry, settings, words) {
    const type = entry.type, level = entry.level
    let text = entry.text
    text = utils.beautifyText(text, entry.language, settings)
    text = highlightWords(text, words)
    const parts = utils.textParts(text, settings.footnoteMethod)
    return { type: type, level: level, key: entry.key, eInd: entry.eInd,
      language: entry.language, parts: parts, text: entry.text }
  }

  // Port of processFootnote from TextTab.vue — splits "1. content" and marks
  // footnote abbreviations.
  function processFootnote(fnote, language, settings) {
    const abbrev = Suththa.store.footnoteAbbreviations || {}
    const match = /^(\d+)\.\s?([\s\S]*)/.exec(fnote.text)
    const number = match ? match[1] : ''
    let content = match ? match[2] : fnote.text
    content = utils.beautifyText(content, language, settings)

    const abbrKeys = Object.keys(abbrev)
    if (abbrKeys.length) {
      // mark whole-word abbreviations as fn-abbr tokens
      const re = new RegExp('(^|[^\\u0d80-\\u0dff])((' + abbrKeys.map(utils.escapeRegExp).join('|') + ')(?=[^\\u0d80-\\u0dff]|$))', 'g')
      content = content.replace(re, '$1|$2℗fn-abbr|')
    }
    const parts = utils.textParts(content, settings.footnoteMethod)
    return { number: number, parts: parts }
  }

  // ---- parts -> inline html ----
  function partsHtml(parts, language, footnoteMethod) {
    let html = ''
    parts.forEach(function (part) {
      const t = part[0], token = part[1]
      if (token == 'fn-pointer' && footnoteMethod != 'end-page') {
        html += '<span class="fn-pointer" data-fn="' + t + '">' + t + '</span>'
      } else if (token == 'fn-abbr') {
        const abbr = Suththa.store.footnoteAbbreviations[t]
        const tip = abbr ? abbr[0] : ''
        html += '<span class="fn-abbr" data-tip="' + utils.escapeHtml(tip) + '">' + t + '</span>'
      } else if (token == 'highlight') {
        html += '<span class="highlight">' + t + '</span>'
      } else if (token == 'bold') {
        html += '<span class="bold">' + t + '</span>'
      } else if (token == 'underline') {
        html += '<span class="underline">' + t + '</span>'
      } else if (token == 'strike') {
        html += '<span class="strike">' + t + '</span>'
      } else {
        html += utils.genWords(t, language)
      }
    })
    return html
  }

  const headingIcons = function (entry) {
    const eind = entry.eInd.join('-')
    const key = entry.key || ''
    const tree = Suththa.tree
    let navBtn = ''
    if (key.indexOf('atta-') == 0) {
      const suttaKey = key.slice(5)
      if (tree && tree.getKey(suttaKey)) {
        navBtn = '<button type="button" class="h-icon nav-btn" data-action="sutta" data-key="' + suttaKey +
          '" title="සූත්‍රයට ආපසු">S</button>'
      }
    } else if (tree && tree.getKey('atta-' + key)) {
      navBtn = '<button type="button" class="h-icon nav-btn" data-action="atuva" data-key="atta-' + key +
        '" title="අට්ඨකථා බලන්න">A</button>'
    }
    return '<span class="heading-icons">' + navBtn +
      '<button type="button" class="h-icon" data-action="share" data-key="' + entry.key +
        '" data-eind="' + eind + '" data-lang="' + entry.language + '" title="සබැඳිය පිටපත් කරන්න">↗</button>' +
      '<button type="button" class="h-icon star-outline" data-action="star" data-key="' + entry.key +
        '" data-eind="' + eind + '" data-lang="' + entry.language + '" title="තරුවක් යොදන්න">☆</button>' +
      '</span>'
  }

  // ---- entry -> html ----
  function entryHtml(entry, opts) {
    opts = opts || {}
    const settings = opts.settings || store.settings
    const footnoteMethod = settings.footnoteMethod
    const body = partsHtml(entry.parts, entry.language, footnoteMethod)

    let cls = 'entry ' + entry.language + ' ' + entry.type
    if (opts.dropcap) cls += ' dropcap'

    let head = ''
    if (entry.type == 'heading') {
      head = headingIcons(entry)
    }
    return '<div class="' + cls + '" level="' + (entry.level || 0) + '">' +
      head + body + '</div>'
  }

  // ---- footnote -> html ----
  function footnoteHtml(footnote, opts) {
    opts = opts || {}
    const settings = opts.settings || store.settings
    const body = partsHtml(footnote.parts, opts.language, settings.footnoteMethod)
    return '<span class="footnote-item">' +
      '<span class="fn-number">' + footnote.number + '.</span>' + body + '</span>'
  }

  Suththa.render = {
    processEntry: processEntry,
    processFootnote: processFootnote,
    entryHtml: entryHtml,
    footnoteHtml: footnoteHtml,
    partsHtml: partsHtml,
    highlightWords: highlightWords,
  }
})()
