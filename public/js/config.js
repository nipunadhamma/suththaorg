/* ============================================================
   Suththa.org — config.js (constants & app-wide settings)
   ============================================================ */
(function () {
  'use strict'

  const Language = Object.freeze({ SI: 'si', EN: 'en' })

  const config = {
    appVersion: 2.0,

    // storage keys
    settingsKey: 'suththa.org-settings-2',
    bookmarksKey: 'suththa.org-bookmarks-1',
    notesKey: 'suththa.org-notes-1',

    // data urls (relative so it works on any static server)
    treeDataUrl: 'static/data/tree.json',
    abbreviationsUrl: 'static/data/footnote-abbreviations.json',
    dictionaryUrl: 'static/data/dictionary-sinhala.json',
    breakupsUrl: 'static/data/dictionary-breakups.json',
    textFolder: 'static/text/',

    // search filter tree
    filterTreeParents: ['vp', 'sp', 'ap', 'atta-sp', 'dn', 'mn', 'sn', 'an', 'kn'],
    allFilterKeys: [
      'vp-prj', 'vp-pct', 'vp-mv', 'vp-cv', 'vp-pv',
      'dn-1', 'dn-2', 'dn-3', 'mn-1', 'mn-2', 'mn-3',
      'sn-1', 'sn-2', 'sn-3', 'sn-4', 'sn-5',
      'an-1', 'an-2', 'an-3', 'an-4', 'an-5', 'an-6', 'an-7', 'an-8', 'an-9', 'an-10', 'an-11',
      'kn-khp', 'kn-dhp', 'kn-ud', 'kn-iti', 'kn-snp', 'kn-vv', 'kn-pv', 'kn-thag', 'kn-thig',
      'kn-mn', 'kn-nc', 'kn-jat', 'kn-ps', 'kn-ap', 'kn-bv', 'kn-cp', 'kn-nett', 'kn-petk',
      'ap-dhs', 'ap-vbh', 'ap-kvu', 'ap-dhk', 'ap-pug', 'ap-yam', 'ap-pat',
      'atta-vp', 'atta-dn', 'atta-mn', 'atta-sn', 'atta-an', 'atta-kn', 'atta-ap', 'anya'
    ],

    // name -> [language, short, dictName, meta]
    dictionaryInfo: {
      'පොල්වත්තේ බුද්ධදත්ත': [Language.SI, 'BUS', 'si-buddhadatta', {}],
      'මඩිතියවෙල සුමඞ්ගල': [Language.SI, 'MS', 'si-sumangala', {}],
    },

    Language: Language,
  }

  window.Suththa = window.Suththa || {}
  Suththa.config = config
})()
