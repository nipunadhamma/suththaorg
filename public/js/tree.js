/* ============================================================
   Suththa.org — tree.js (Tripitaka tree index)
   Loads static/data/tree.json and builds the navigation tree,
   ordered key list and name lookups.
   ============================================================ */
(function () {
  'use strict'

  const utils = Suththa.utils
  const config = Suththa.config

  const state = {
    index: {},          // key -> { pali, sinh, level, eInd, parent, filename, children }
    treeView: [],       // nested tree for the sidebar
    filterTree: [],     // nested tree for the search filter dialog
    orderedKeys: [],    // reading order (for prev / next)
    isLoaded: false,
  }

  const childInd = function (key) { return parseInt(key.split('-').splice(-1)[0], 10) }
  const childrenSort = function (a, b) {
    const ac = childInd(a.key), bc = childInd(b.key)
    if (isNaN(ac) || isNaN(bc)) return 0
    return ac - bc
  }

  function genTree(key, addChildren, letterOpt) {
    const item = state.index[key]
    let pali = utils.beautifyText(item.pali, 'pali', letterOpt)
    let sinh = utils.beautifyText(item.sinh, 'sinh', letterOpt) || pali
    const treeItem = { pali: pali, sinh: sinh, key: key, children: [] }
    if (item.children.length && addChildren(key)) {
      treeItem.children = item.children
        .map(function (cKey) { return genTree(cKey, addChildren, letterOpt) })
        .sort(childrenSort)
    }
    return treeItem
  }

  function addOrder(treeItem, list) {
    list.push(treeItem.key)
    if (treeItem.children) treeItem.children.forEach(function (c) { addOrder(c, list) })
  }

  function setIndex(jTree) {
    const index = { 'root': { children: [] } }
    Object.keys(jTree).forEach(function (key) {
      const arr = jTree[key] // [pali, sinh, level, eInd, parent, filename]
      index[key] = {
        pali: arr[0], sinh: arr[1], level: arr[2], eInd: arr[3],
        parent: arr[4], filename: arr[5], key: key, children: [],
      }
      const parent = arr[4] || 'root'
      if (!index[parent]) index[parent] = { children: [] }
      index[parent].children.push(key)
    })
    state.index = index
  }

  function recomputeTree(letterOpt) {
    state.treeView = []
    state.filterTree = []
    state.orderedKeys = []
    state.index['root'].children.forEach(function (key) {
      state.treeView.push(genTree(key, function () { return true }, letterOpt))
    })
    state.index['root'].children.forEach(function (key) {
      state.treeView.forEach(function () { })
      state.filterTree.push(genTree(key, function (k) {
        return config.filterTreeParents.indexOf(k) != -1
      }, letterOpt))
    })
    state.treeView.forEach(function (child) { addOrder(child, state.orderedKeys) })
    state.isLoaded = true
  }

  function getName(key, language, settings) {
    const lang = language || settings.treeLanguage
    const raw = state.index[key] ? state.index[key][lang] : 'key not found'
    return utils.beautifyText(raw, lang, settings)
  }

  function getKeyForEInd(filename, eInd) {
    let i = state.orderedKeys.length - 1
    for (; i >= 0; i--) {
      const item = state.index[state.orderedKeys[i]]
      if (item.filename == filename && utils.isEIndLessEqual(item.eInd, eInd)) break
    }
    return i >= 0 ? state.orderedKeys[i] : ''
  }

  async function initialize() {
    const index = await utils.getJson(config.treeDataUrl)
    setIndex(index)
    recomputeTree(Suththa.store.settings)
    return state
  }

  Suththa.tree = {
    state: state,
    initialize: initialize,
    setIndex: setIndex,
    recomputeTree: recomputeTree,
    getName: getName,
    getKey: function (key) { return state.index[key] },
    getKeyForEInd: getKeyForEInd,
  }
})()
