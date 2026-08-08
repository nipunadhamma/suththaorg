/* ============================================================
   Suththa.org — store.js (user settings, theme, shared state)
   ============================================================ */
(function () {
  'use strict'

  const config = Suththa.config
  const utils = Suththa.utils

  const storedKeys = [
    'darkMode', 'defaultColumns', 'treeLanguage', 'footnoteMethod',
    'bandiLetters', 'specialLetters', 'showPageNumbers', 'fontSize',
    'syncTree', 'autoHideSearchBar'
  ]

  const settings = {
    darkMode: false,
    defaultColumns: 2,
    treeLanguage: 'pali',
    footnoteMethod: 'click',
    bandiLetters: true,
    specialLetters: false,
    showPageNumbers: true,
    fontSize: 0,
    syncTree: true,
    autoHideSearchBar: true,
    isLoaded: false,
  }

  function loadSettings() {
    const saved = utils.lsGet(config.settingsKey, null)
    if (saved) Object.assign(settings, saved)
    applyTheme()
    return settings
  }

  function saveSettings() {
    const obj = {}
    storedKeys.forEach(function (k) { obj[k] = settings[k] })
    utils.lsSet(config.settingsKey, obj)
  }

  function set(name, value) {
    settings[name] = value
    if (storedKeys.indexOf(name) >= 0) saveSettings()
    if (name == 'darkMode') applyTheme()
    emit('settings-change', { name: name, value: value })
    return settings
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light')
  }

  // ---- tiny pub/sub for store changes ----
  const listeners = {}
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn) }
  function emit(evt, data) {
    (listeners[evt] || []).forEach(function (fn) { fn(data) })
  }

  function fontPx() { return 16 + settings.fontSize + 'px' }

  Suththa.store = {
    settings: settings,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    set: set,
    applyTheme: applyTheme,
    fontPx: fontPx,
    on: on,
    emit: emit,
  }
})()
