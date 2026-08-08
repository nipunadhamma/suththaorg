/* ============================================================
   Suththa.org — bookmarks.js (starred suttas, localStorage)
   ============================================================ */
(function () {
  'use strict'

  const utils = Suththa.utils
  const config = Suththa.config

  function getAll() {
    return utils.lsGet(config.bookmarksKey, {})
  }

  function isStarred(keyStr) {
    return !!getAll()[keyStr]
  }

  function toggle(entry) {
    const keyStr = utils.entryToKeyStr(entry)
    const bookmarks = getAll()
    if (bookmarks[keyStr]) {
      delete bookmarks[keyStr]
    } else {
      const fields = ['key', 'language', 'eInd', 'type', 'text', 'hText']
      const obj = {}
      fields.forEach(function (f) { obj[f] = entry[f] !== undefined ? entry[f] : null })
      bookmarks[keyStr] = obj
    }
    utils.lsSet(config.bookmarksKey, bookmarks)
    Suththa.store.emit('bookmarks', bookmarks)
    return !!bookmarks[keyStr]
  }

  function add(entry) {
    const keyStr = utils.entryToKeyStr(entry)
    const bookmarks = getAll()
    const fields = ['key', 'language', 'eInd', 'type', 'text', 'hText']
    const obj = {}
    fields.forEach(function (f) { obj[f] = entry[f] !== undefined ? entry[f] : null })
    bookmarks[keyStr] = obj
    utils.lsSet(config.bookmarksKey, bookmarks)
    Suththa.store.emit('bookmarks', bookmarks)
    return obj
  }

  function remove(keyStr) {
    const bookmarks = getAll()
    delete bookmarks[keyStr]
    utils.lsSet(config.bookmarksKey, bookmarks)
    Suththa.store.emit('bookmarks', bookmarks)
  }

  function count() {
    return Object.keys(getAll()).length
  }

  Suththa.bookmarks = {
    getAll: getAll,
    isStarred: isStarred,
    toggle: toggle,
    add: add,
    remove: remove,
    count: count,
  }
})()
