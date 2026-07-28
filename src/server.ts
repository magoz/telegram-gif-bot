import { app } from './app'

const DEFAULT_PORT = 3000
const configuredPort = Number(Bun.env.PORT)
const port =
  Number.isSafeInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_PORT

Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url)
    if (url.pathname !== '/api/telegram') {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    return app(request)
  }
})

console.log(`ggif listening on http://localhost:${String(port)}/api/telegram`)
