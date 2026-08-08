/* ============================================================
   Suththa.org — notes-page.js (note.html logic)
   ============================================================ */
(function () {
  'use strict'

  const utils = Suththa.utils
  const notes = Suththa.notes

  let editingId = null

  function listNotes() {
    const notesData = notes.getAll()
    const el = document.getElementById('notes-list')
    if (!el) return
    const ids = Object.keys(notesData).sort(function (a, b) {
      return notesData[b].updatedAt - notesData[a].updatedAt
    })
    if (!ids.length) {
      el.innerHTML = '<div class="banner">සටහන් නැත. ඉහළින් නව සටහනක් සාදන්න.</div>'
      return
    }
    el.innerHTML = ids.map(function (id) {
      const n = notesData[id]
      const body = utils.stripMarkup(n.body).trim().slice(0, 160)
      return '<div class="note-item' + (id == editingId ? ' editing' : '') + '" data-note="' + id + '">' +
        '<div class="note-actions">' +
        '<button class="edit" data-edit="' + id + '" title="සංස්කරණය">✎</button>' +
        '<button data-delete="' + id + '" title="මකන්න">✕</button></div>' +
        '<h3>' + utils.escapeHtml(n.title) + '</h3>' +
        (n.suttaName ? '<a class="note-link" href="./index.html#/' + encodeURIComponent(n.suttaKey || '') +
          '" >' + utils.escapeHtml(n.suttaName) + '</a>' : '') +
        '<div class="note-date">' + new Date(n.updatedAt).toLocaleString('si-LK') + '</div>' +
        (body ? '<p class="note-body">' + utils.escapeHtml(body) + '</p>' : '') +
        '</div>'
    }).join('')
  }

  function fillEditor(n) {
    document.getElementById('note-title').value = n ? (n.title || '') : ''
    document.getElementById('note-body').value = n ? (n.body || '') : ''
    document.getElementById('note-sutta-key').value = n ? (n.suttaKey || '') : ''
    document.getElementById('note-sutta-name').value = n ? (n.suttaName || '') : ''
  }

  function editNote(id) {
    editingId = id
    const n = notes.get(id)
    if (n) fillEditor(n)
    document.getElementById('note-title').focus()
    listNotes()
  }

  function newNote() {
    editingId = null
    fillEditor(null)
    listNotes()
  }

  function saveCurrent() {
    const title = document.getElementById('note-title').value
    const body = document.getElementById('note-body').value
    if (!body.trim() && !title.trim()) {
      utils.showSnackbar('සටහන හිස් ය')
      return
    }
    const patch = {
      title: title,
      body: body,
      suttaKey: document.getElementById('note-sutta-key').value,
      suttaName: document.getElementById('note-sutta-name').value,
    }
    if (editingId) {
      notes.update(editingId, patch)
    } else {
      editingId = notes.add(patch).id
    }
    listNotes()
    utils.showSnackbar('සටහන සුරකින ලදී')
  }

  function deleteNote(id) {
    if (!window.confirm('මෙම සටහන මකන්නද?')) return
    if (id == editingId) editingId = null
    notes.remove(id)
    listNotes()
    utils.showSnackbar('සටහන මකන ලදී')
  }

  function bind() {
    document.getElementById('note-new').addEventListener('click', newNote)
    document.getElementById('note-save').addEventListener('click', saveCurrent)
    document.getElementById('notes-list').addEventListener('click', function (e) {
      const edit = e.target.closest('[data-edit]')
      if (edit) { editNote(edit.dataset.edit); return }
      const del = e.target.closest('[data-delete]')
      if (del) { deleteNote(del.dataset.delete); return }
    })
  }

  function init() {
    Suththa.nav.init()
    bind()
    listNotes()
    newNote()
  }

  Suththa.notesPage = { init: init }
  document.addEventListener('DOMContentLoaded', init)
})()
