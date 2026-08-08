/**
 * Suththa.org static server.
 * - serves public/ as a static site (SPA) with index.html fallback for deep links
 * - injects per-sutta <title>/description/canonical/JSON-LD for deep-link URLs like /dn-1-1/pali (SEO)
 * - sets cache headers; gzip is handled by nginx in production
 *
 * prod (ubuntu):
 *   export NODE_SERVER_MODE=production
 *   pm2 start server/server.js --name suththa-org-server
 *   pm2 save
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')

const indexHtml = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf-8')
const dictionaryHtml = fs.readFileSync(path.join(PUBLIC, 'dictionary.html'), 'utf-8')
const noteHtml = fs.readFileSync(path.join(PUBLIC, 'note.html'), 'utf-8')
const bookmarkHtml = fs.readFileSync(path.join(PUBLIC, 'bookmark.html'), 'utf-8')

// tree index is loaded once so deep links get pali/sinh names for the SEO head
let treeJson = {}
try {
  treeJson = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'static/data/tree.json'), 'utf-8'))
} catch (e) {
  treeJson = {}
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Build an SEO head block for a deep link like /dn-1-1/pali and swap it into index.html
function seoHtml(key, language) {
  const node = treeJson[key]
  if (!node) return indexHtml
  const lang = language == 'sinh' ? 'sinh' : 'pali'
  const pali = node[0] || key
  const sinh = node[1] || pali
  const name = lang == 'sinh' ? sinh : pali
  const title = name + ' — Suththa.org'
  const desc = 'සම්පූර්ණ ත්‍රිපිටකය — ' + name + '. පාළි මූල ග්‍රන්ථය සහ සිංහල පරිවර්තනය කියවන්න.'
  const canonical = 'https://tripitaka.suththa.org/' + key + '/' + lang
  const ld = '<script type="application/ld+json" id="ld-seo">' +
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: name,
      inLanguage: lang == 'sinh' ? 'si' : 'pi',
      url: canonical,
      isPartOf: { '@type': 'WebSite', name: 'Suththa.org', url: 'https://tripitaka.suththa.org/' },
    }) + '</script>'

  return indexHtml
    .replace('<title>Suththa.org — සම්පූර්ණ ත්‍රිපිටකය</title>', '<title>' + esc(title) + '</title>')
    .replace('content="Suththa.org — සම්පූර්ණ ත්‍රිපිටකය කියවන්න. පාළි මූල ග්‍රන්ථ, සිංහල පරිවර්තන, ශබ්දකෝෂය සහ අට්ඨකථා නොමිලේ."', 'content="' + esc(desc) + '"')
    .split('content="පාළි මූල ග්‍රන්ථ, සිංහල පරිවර්තන, ශබ්දකෝෂය සහ අට්ඨකථා නොමිලේ කියවන්න."').join('content="' + esc(desc) + '"')
    .split('content="Suththa.org — සම්පූර්ණ ත්‍රිපිටකය"').join('content="' + esc(title) + '"')
    .replace('content="https://tripitaka.suththa.org/"', 'content="' + canonical + '"')
    .replace('href="https://tripitaka.suththa.org/"', 'href="' + canonical + '"')
    .replace(/<script type="application\/ld\+json" id="ld-seo">[\s\S]*?<\/script>/, ld)
}

function startServer(port, host) {
  port = port || (process.env.PORT ? Number(process.env.PORT) : 3000)
  host = host || '0.0.0.0'
  const fastify = require('fastify')({ logger: false })

  fastify.register(require('fastify-static'), {
    root: PUBLIC,
    prefix: '/',
    setHeaders: function (res, filePath) {
      if (/\.(png|jpe?g|gif|svg|ico|webp|woff2?|txt|xml)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      } else if (/\.(css|js)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400')
      } else if (filePath.indexOf(path.sep + 'static' + path.sep) >= 0) {
        res.setHeader('Cache-Control', 'public, max-age=3600')
      } else {
        res.setHeader('Cache-Control', 'no-cache')
      }
    },
  })

  fastify.setNotFoundHandler(function (request, reply) {
    const url = request.url.split('?')[0]

    // static sub-pages
    if (url.indexOf('dictionary') >= 0) return reply.type('text/html').code(200).header('Cache-Control', 'no-cache').send(dictionaryHtml)
    if (url.indexOf('/note') >= 0) return reply.type('text/html').code(200).header('Cache-Control', 'no-cache').send(noteHtml)
    if (url.indexOf('bookmark') >= 0) return reply.type('text/html').code(200).header('Cache-Control', 'no-cache').send(bookmarkHtml)

    // deep links like /dn-1-1/pali -> index.html with per-sutta SEO head
    if (url.indexOf('/static/') !== 0) {
      const parts = url.split('/').filter(Boolean)
      if (parts.length >= 1 && parts[0].indexOf('.') < 0 && treeJson[parts[0]]) {
        return reply.type('text/html').code(200).header('Cache-Control', 'no-cache').send(seoHtml(parts[0], parts[1]))
      }
    }

    // default SPA fallback
    return reply.type('text/html').code(200).header('Cache-Control', 'no-cache').send(indexHtml)
  })

  fastify.listen({ port: port, host: host })
  return fastify
}

module.exports = { startServer: startServer }

// start when run directly (not imported)
if (require.main === module) {
  startServer()
}
