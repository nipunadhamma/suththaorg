/* ============================================================
   Suththa.org — search.js (title search + client-side FTS)
   ============================================================ */
(function () {
  'use strict'

  const utils = Suththa.utils
  const config = Suththa.config
  const tree = Suththa.tree

  const maxResults = 100

  function cleanQuery(q) {
    return String(q || '').replace(/[\u200d.,:?()“”‘’]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  }

  // ---------- Title search (in-memory over the tree index) ----------
  function titleSearch(query, filterKeys, columns, max) {
    const results = []
    query = cleanQuery(query)
    if (!query) return results
    const maxN = max || maxResults
    const index = tree.state.index
    const words = [query]

    for (let i = 0; i < tree.state.orderedKeys.length && results.length < maxN; i++) {
      const key = tree.state.orderedKeys[i]
      const item = index[key]
      if (!item) continue
      if (!inFilter(key, filterKeys)) continue
      // column 0 = pali, column 1 = sinh
      if (columns.indexOf(0) >= 0 && item.pali && item.pali.toLowerCase().indexOf(query) >= 0) {
        results.push({ key: key, language: 'pali', eInd: item.eInd, type: item.level })
      } else if (columns.indexOf(1) >= 0 && item.sinh && item.sinh.indexOf(query) >= 0) {
        results.push({ key: key, language: 'sinh', eInd: item.eInd, type: item.level })
      }
    }
    return results
  }

  function inFilter(key, filterKeys) {
    if (!filterKeys || !filterKeys.length) return true
    return filterKeys.some(function (fKey) { return key == fKey || key.indexOf(fKey + '-') == 0 })
  }

  // ---------- Full text search (client-side over text files) ----------
  // A simple but functional FTS that scans the loaded JSON text files.
  const fileCache = {}

  async function loadTextFile(filename) {
    if (fileCache[filename]) return fileCache[filename]
    const p = utils.getJson(config.textFolder + filename + '.json').catch(function () { return null })
    fileCache[filename] = p
    return p
  }

  function getHighlight(text, query, snippetLen) {
    snippetLen = snippetLen || 64
    const i = text.toLowerCase().indexOf(query.toLowerCase())
    if (i < 0) return ''
    const start = Math.max(0, i - snippetLen / 2)
    const end = Math.min(text.length, i + query.length + snippetLen / 2)
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
  }

  async function fullTextSearch(query, filterKeys, columns, onProgress) {
    const results = []
    query = cleanQuery(query)
    if (!query) return results
    const words = query.split(' ')
    const index = tree.state.index
    const ordered = tree.state.orderedKeys

    let total = 0, loaded = 0
    for (let i = 0; i < ordered.length && results.length < maxResults; i++) {
      const key = ordered[i]
      const item = index[key]
      if (!item || !item.filename) continue
      if (!inFilter(key, filterKeys)) continue
      if (columns.indexOf(0) < 0 && columns.indexOf(1) < 0) continue
      total++

      const data = await loadTextFile(item.filename)
      loaded++
      if (onProgress) onProgress(loaded, total)

      if (!data || !data.pages) continue
      for (const page of data.pages) {
        for (const langKey of ['pali', 'sinh']) {
          if (columns.indexOf(langKey == 'pali' ? 0 : 1) < 0) continue
          const col = page[langKey]
          if (!col) continue
          col.entries.forEach(function (entry, ei) {
            const text = entry.text || ''
            if (!text) return
            let num = 0
            words.forEach(function (w) {
              const re = new RegExp(w, 'gi')
              let m
              while ((m = re.exec(text))) num++
            })
            if (!num) return
            results.push({
              key: key,
              eInd: [page.pageNum, ei],
              language: langKey,
              type: entry.type,
              numMatches: num,
              textLength: text.length,
              hText: getHighlight(text, words[0]),
            })
          })
        }
      }
    }
    return results
  }

  // rank + group results (port of FTS.vue buildResults)
  function buildGroups(rows) {
    const groups = {}
    rows.forEach(function (r) {
      const g = groups[r.key] || (groups[r.key] = { key: r.key, items: [], numMatches: 0, isOpen: false })
      g.items.push(r)
      g.numMatches += r.numMatches
    })
    const gList = Object.keys(groups).map(function (k) { return groups[k] })
    gList.forEach(function (g) {
      g.items.sort(function (a, b) {
        return (b.numMatches / Math.log2(b.textLength || 2)) - (a.numMatches / Math.log2(a.textLength || 2))
      })
    })
    gList.sort(function (a, b) { return b.numMatches - a.numMatches })
    return gList
  }

  Suththa.search = {
    cleanQuery: cleanQuery,
    titleSearch: titleSearch,
    fullTextSearch: fullTextSearch,
    buildGroups: buildGroups,
    inFilter: inFilter,
    maxResults: maxResults,
  }
})()
