/* ============================================================
   Suththa.org — seo.js (dynamic title / description / canonical per route)
   ============================================================ */
(function () {
  'use strict'

  const baseUrl = 'https://tripitaka.suththa.org'
  const siteName = 'Suththa.org'

  function setMeta(name, content) {
    let el = document.querySelector('meta[name="' + name + '"]')
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('name', name)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }

  function setProp(prop, content) {
    let el = document.querySelector('meta[property="' + prop + '"]')
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('property', prop)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }

  function setCanonical(href) {
    let el = document.querySelector('link[rel="canonical"]')
    if (!el) {
      el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      document.head.appendChild(el)
    }
    el.setAttribute('href', href)
  }

  function setJsonLd(obj) {
    let el = document.getElementById('ld-seo')
    if (!el) {
      el = document.createElement('script')
      el.setAttribute('type', 'application/ld+json')
      el.setAttribute('id', 'ld-seo')
      document.head.appendChild(el)
    }
    el.textContent = JSON.stringify(obj)
  }

  // Update the head for a sutta deep link like /dn-1-1/pali or hash #/dn-1-1/pali
  function update(key, lang) {
    const tree = Suththa.tree
    if (!key || !tree || !tree.getKey) return
    const node = tree.getKey(key)
    if (!node) return
    lang = lang == 'sinh' ? 'sinh' : 'pali'
    const pali = node.pali || key
    const sinh = node.sinh || pali
    const name = lang == 'sinh' ? sinh : pali
    const title = name + ' — ' + siteName
    const url = baseUrl + '/' + key + '/' + lang
    const desc = 'සම්පූර්ණ ත්‍රිපිටකය — ' + name + '. පාළි මූල ග්‍රන්ථය සහ සිංහල පරිවර්තනය කියවන්න.'

    document.title = title
    setMeta('description', desc)
    setCanonical(url)
    setProp('og:title', title)
    setProp('og:description', desc)
    setProp('og:url', url)
    setProp('og:type', 'book')
    setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: name,
      inLanguage: lang == 'sinh' ? 'si' : 'pi',
      url: url,
      isPartOf: { '@type': 'WebSite', name: siteName, url: baseUrl + '/' },
    })
  }

  Suththa.seo = { update: update }
})()
