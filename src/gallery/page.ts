export const galleryPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <title>GIF Gallery</title>
  <script src="https://telegram.org/js/telegram-web-app.js?63"></script>
  <style>
    :root {
      color-scheme: var(--tg-color-scheme, light);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--tg-theme-bg-color, #fff);
      color: var(--tg-theme-text-color, #111);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--tg-theme-bg-color, #fff);
      color: var(--tg-theme-text-color, #111);
      padding: max(12px, env(safe-area-inset-top)) 12px max(20px, env(safe-area-inset-bottom));
    }
    .search {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      gap: 8px;
      padding: 4px 0 12px;
      background: var(--tg-theme-bg-color, #fff);
    }
    input, .search button {
      min-height: 44px;
      border: 0;
      border-radius: 12px;
      font: inherit;
    }
    input {
      min-width: 0;
      flex: 1;
      padding: 0 14px;
      outline: 1px solid var(--tg-theme-hint-color, #999);
      color: var(--tg-theme-text-color, #111);
      background: var(--tg-theme-secondary-bg-color, #f1f1f1);
    }
    input:focus { outline: 2px solid var(--tg-theme-button-color, #1769aa); }
    .search button {
      padding: 0 16px;
      font-weight: 600;
      color: var(--tg-theme-button-text-color, #fff);
      background: var(--tg-theme-button-color, #1769aa);
      cursor: pointer;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .gif {
      position: relative;
      display: block;
      width: 100%;
      min-height: 110px;
      padding: 0;
      overflow: hidden;
      border: 0;
      border-radius: 12px;
      cursor: pointer;
      background: var(--tg-theme-secondary-bg-color, #eee);
    }
    .gif:focus-visible { outline: 3px solid var(--tg-theme-button-color, #1769aa); }
    video {
      display: block;
      width: 100%;
      aspect-ratio: var(--ratio, 1);
      object-fit: cover;
      background: var(--tg-theme-secondary-bg-color, #eee);
    }
    .status {
      min-height: 48px;
      display: grid;
      place-items: center;
      padding: 12px;
      color: var(--tg-theme-hint-color, #6b6b6b);
      text-align: center;
    }
    @media (min-width: 700px) {
      body { max-width: 900px; margin: 0 auto; }
      .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (prefers-reduced-motion: reduce) {
      video { object-fit: contain; }
    }
  </style>
</head>
<body>
  <form class="search" id="search-form" role="search">
    <label for="query" hidden>Search GIFs</label>
    <input id="query" name="q" type="search" maxlength="96" autocomplete="off" placeholder="Search GIFs" aria-label="Search GIFs">
    <button type="submit">Search</button>
  </form>
  <main class="grid" id="grid" aria-label="GIF results"></main>
  <div class="status" id="status" role="status" aria-live="polite"></div>
  <div id="sentinel" aria-hidden="true"></div>

  <script>
    (function () {
      'use strict'

      var webApp = window.Telegram && window.Telegram.WebApp
      var form = document.getElementById('search-form')
      var input = document.getElementById('query')
      var grid = document.getElementById('grid')
      var status = document.getElementById('status')
      var sentinel = document.getElementById('sentinel')
      var initialQuery = new URLSearchParams(window.location.search).get('q') || ''
      var state = { query: initialQuery, page: 1, hasNext: true, loading: false, generation: 0 }

      input.value = initialQuery
      if (webApp) {
        webApp.ready()
        webApp.expand()
      }

      function setStatus(message) {
        status.textContent = message
      }

      function attachVideo(video) {
        if (!video.src) video.src = video.dataset.src
      }

      var videoObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var video = entry.target
          if (entry.isIntersecting) {
            attachVideo(video)
            void video.play().catch(function () {})
          } else {
            video.pause()
          }
        })
      }, { rootMargin: '120px 0px', threshold: 0.15 })

      function choose(item) {
        if (!webApp || typeof webApp.switchInlineQuery !== 'function') {
          setStatus('Open this gallery inside Telegram to choose a GIF.')
          return
        }
        webApp.HapticFeedback && webApp.HapticFeedback.selectionChanged()
        webApp.switchInlineQuery(item.selection_query)
      }

      function addItem(item) {
        var button = document.createElement('button')
        var video = document.createElement('video')
        button.className = 'gif'
        button.type = 'button'
        button.setAttribute('aria-label', 'Choose ' + (item.title || 'GIF'))
        button.addEventListener('click', function () { choose(item) })

        video.muted = true
        video.loop = true
        video.autoplay = true
        video.playsInline = true
        video.preload = 'none'
        video.poster = item.thumbnail_url
        video.dataset.src = item.preview_url
        video.setAttribute('aria-hidden', 'true')
        if (item.width > 0 && item.height > 0) {
          video.style.setProperty('--ratio', String(item.width) + ' / ' + String(item.height))
        }

        button.appendChild(video)
        grid.appendChild(button)
        videoObserver.observe(video)
      }

      function sentinelInLoadRange() {
        var bounds = sentinel.getBoundingClientRect()
        return bounds.top <= window.innerHeight + 400 && bounds.bottom >= -400
      }

      async function loadNext() {
        if (state.loading || !state.hasNext) return
        state.loading = true
        var generation = state.generation
        var loaded = false
        setStatus(state.page === 1 ? 'Loading GIFs…' : 'Loading more…')

        try {
          var response = await fetch('/api/gallery', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-telegram-init-data': webApp ? webApp.initData : ''
            },
            body: JSON.stringify({ query: state.query, page: state.page })
          })
          if (!response.ok) throw new Error(response.status === 401 ? 'Telegram authorization expired. Close and reopen the gallery.' : 'Unable to load GIFs.')
          var payload = await response.json()
          if (generation !== state.generation) return

          payload.results.forEach(addItem)
          state.hasNext = payload.has_next
          state.page = payload.next_page
          loaded = true
          setStatus(payload.results.length === 0 && state.page === 2 ? 'No GIFs found.' : (state.hasNext ? 'Scroll for more' : 'End of results'))
        } catch (error) {
          if (generation !== state.generation) return
          setStatus(error instanceof Error ? error.message : 'Unable to load GIFs.')
        } finally {
          if (generation === state.generation) {
            state.loading = false
            if (loaded && state.hasNext && sentinelInLoadRange()) void loadNext()
          }
        }
      }

      function search(query) {
        state.generation += 1
        state.query = query.trim()
        state.page = 1
        state.hasNext = true
        state.loading = false
        grid.querySelectorAll('video').forEach(function (video) {
          video.pause()
          videoObserver.unobserve(video)
        })
        grid.replaceChildren()
        void loadNext()
      }

      form.addEventListener('submit', function (event) {
        event.preventDefault()
        search(input.value)
      })

      var pageObserver = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting })) void loadNext()
      }, { rootMargin: '400px 0px' })
      pageObserver.observe(sentinel)

      search(initialQuery)
    })()
  </script>
</body>
</html>`
