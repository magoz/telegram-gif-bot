import { app } from './app'
import { galleryApp } from './gallery/app'

const DEFAULT_PORT = 3000
const configuredPort = Number(Bun.env.PORT)
const port =
  Number.isSafeInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_PORT

Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/api/telegram') return app(request)
    if (url.pathname === '/api/gallery') return galleryApp(request)
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
})

console.log(`telegram-gif-bot listening on http://localhost:${String(port)}`)
