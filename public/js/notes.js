/* ============================================================
   Suththa.org — notes.js (personal study notes, localStorage)
   ============================================================ */
(function () {
  'use strict'

  const utils = Suththa.utils
  const config = Suththa.config

  function getAll() {
    return utils.lsGet(config.notesKey, {})
  }

  function get(id) {
    return getAll()[id] || null
  }

  function save(notes) {
    utils.lsSet(config.notesKey, notes)
    Suththa.store.emit('notes', getAll())
    return notes
  }

  function add(note) {
    const notes = getAll()
    const id = note.id || 'n' + Date.now() + Math.floor(Math.random() * 1000)
    const now = Date.now()
    notes[id] = {
      id: id,
      title: (note.title || '').trim() || 'සටහන',
      body: note.body || '',
      suttaKey: note.suttaKey || '',
      suttaName: note.suttaName || '',
      createdAt: now,
      updatedAt: now,
    }
    save(notes)
    return notes[id]
  }

  function update(id, patch) {
    const notes = getAll()
    if (!notes[id]) return null
    Object.assign(notes[id], patch, { updatedAt: Date.now() })
    if (notes[id].title !== undefined) notes[id].title = (notes[id].title || '').trim() || 'සටහන'
    save(notes)
    return notes[id]
  }

  function remove(id) {
    const notes = getAll()
    delete notes[id]
    save(notes)
  }

  function count() {
    return Object.keys(getAll()).length
  }

  Suththa.notes = {
    getAll: getAll,
    get: get,
    add: add,
    update: update,
    remove: remove,
    count: count,
  }
})()
