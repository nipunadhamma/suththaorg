/* ============================================================
   Suththa.org — dictionary.js (client-side Pali-Sinhala dict)
   Data: static/data/dictionary-sinhala.json (BUS + MS)
         static/data/dictionary-breakups.json  (word analysis, lazy)
   ============================================================ */
(function () {
  'use strict'

  const utils = Suththa.utils
  const config = Suththa.config

  let dictData = null
  let breakupsData = null
  let dictPromise = null
  let breakupPromise = null

  function ensureDict() {
    if (!dictPromise) {
      dictPromise = utils.getJson(config.dictionaryUrl).then(function (d) {
        dictData = d
        return d
      })
    }
    return dictPromise
  }

  function ensureBreakups() {
    if (!breakupPromise) {
      breakupPromise = utils.getJson(config.breakupsUrl).then(function (d) {
        breakupsData = d
        return d
      })
    }
    return breakupPromise
  }

  function isLoaded() { return !!dictData }
  function getDictData() { return dictData }

  // strip common punctuation and zwj from a query
  function cleanWord(w) {
    return String(w || '').replace(/[\u200d.,:?()“”‘’]/g, '').trim()
  }

  // variation list for a query: base + stripped-end + vowels
  function wordVariations(input) {
    const words = [input]
    const stripEnd = input.replace(/[\u0DCA-\u0DDF\u0D82\u0D83]+$/g, '')
    if (stripEnd != input) words.push(stripEnd)
    return words
  }

  // dict filter: short codes -> long codes, plus 'BR' always allowed
  function runSearch(input, selectedDicts) {
    input = cleanWord(input)
    const results = { matches: [], prefixWords: [], breakups: [] }
    if (!input || !dictData) return results

    const dictSet = selectedDicts && selectedDicts.length
      ? selectedDicts
      : Object.keys(config.dictionaryInfo).map(function (n) { return config.dictionaryInfo[n][1] })

    const words = dictData.words || dictData
    const variants = wordVariations(input)
    const seen = {}

    variants.forEach(function (v) {
      const hits = words[v]
      if (hits) {
        hits.forEach(function (h) {
          if (dictSet.indexOf(h.d) < 0) return
          const k = v + '|' + h.d
          if (seen[k]) return
          seen[k] = true
          results.matches.push({ word: v, d: h.d, m: h.m })
        })
      }
    })

    // prefix matches (limit)
    if (!results.matches.length || results.matches.length < 3) {
      const prefix = variants[variants.length - 1]
      if (prefix.length >= 2) {
        const wordKeys = Object.keys(words)
        const prefixRe = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        let count = 0
        for (let i = 0; i < wordKeys.length && count < 20; i++) {
          if (prefixRe.test(wordKeys[i]) && wordKeys[i] != input) {
            count++
            results.prefixWords.push({ word: wordKeys[i] })
          }
        }
      }
    }

    return results
  }

  // word analysis: load breakups lazily and return the breakup for a word
  async function getBreakup(word) {
    word = cleanWord(word)
    if (!word) return null
    try {
      await ensureBreakups()
      if (breakupsData && breakupsData[word]) {
        const b = breakupsData[word]
        return { word: word, type: b.t, breakup: b.b }
      }
      const stripEnd = word.replace(/[\u0DCA-\u0DDF\u0D82\u0D83]+$/g, '')
      if (stripEnd != word && breakupsData && breakupsData[stripEnd]) {
        const b = breakupsData[stripEnd]
        return { word: stripEnd, type: b.t, breakup: b.b }
      }
    } catch (e) { /* ignore */ }
    return null
  }

  Suththa.dictionary = {
    ensureDict: ensureDict,
    ensureBreakups: ensureBreakups,
    isLoaded: isLoaded,
    getDictData: getDictData,
    cleanWord: cleanWord,
    runSearch: runSearch,
    getBreakup: getBreakup,
  }
})()
