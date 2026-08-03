import { Effect, Schema } from 'effect'
import {
  encodeGifSelection,
  normalizeGalleryPage,
  normalizeGalleryQuery
} from '@/inline-query/selection'
import { Klipy } from '@/klipy/service'
import { Telegram } from '@/telegram/service'
import { GalleryPayloadTooLargeError, GalleryRequestError } from './errors'
import { galleryPage } from './page'

const INIT_DATA_HEADER = 'x-telegram-init-data'
const MAX_GALLERY_BODY_BYTES = 8 * 1024

const GallerySearchRequest = Schema.Struct({
  query: Schema.String,
  page: Schema.Number
})

const securityHeaders = {
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'none'; script-src 'unsafe-inline' https://telegram.org; style-src 'unsafe-inline'; connect-src 'self'; img-src https: data:; media-src https:; base-uri 'none'; form-action 'self'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff'
}

const jsonResponse = (body: object, status = 200): Response =>
  Response.json(body, { status, headers: securityHeaders })

const readBoundedBody = async (request: Request): Promise<unknown> => {
  const contentLength = request.headers.get('content-length')
  if (contentLength !== null && /^\d+$/.test(contentLength)) {
    const declaredBytes = Number(contentLength)
    if (declaredBytes > MAX_GALLERY_BODY_BYTES) {
      throw new GalleryPayloadTooLargeError({ message: 'Gallery request body too large' })
    }
  }

  const reader = request.body?.getReader()
  if (reader === undefined) return JSON.parse('')

  const decoder = new TextDecoder()
  let bytesRead = 0
  let body = ''
  const readNext = async (): Promise<unknown> => {
    const chunk = await reader.read()
    if (chunk.done) {
      body += decoder.decode()
      return JSON.parse(body)
    }

    bytesRead += chunk.value.byteLength
    if (bytesRead > MAX_GALLERY_BODY_BYTES) {
      try {
        await reader.cancel()
      } catch {
        // Preserve the size error even if the client stream cannot be cancelled.
      }
      throw new GalleryPayloadTooLargeError({ message: 'Gallery request body too large' })
    }
    body += decoder.decode(chunk.value, { stream: true })
    return readNext()
  }

  return readNext()
}

const parseBody = (request: Request) =>
  Effect.tryPromise({
    try: () => readBoundedBody(request),
    catch: cause =>
      cause instanceof GalleryPayloadTooLargeError
        ? cause
        : new GalleryRequestError({ message: 'Invalid gallery request', cause })
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(GallerySearchRequest)),
    Effect.mapError(error =>
      error instanceof GalleryRequestError || error instanceof GalleryPayloadTooLargeError
        ? error
        : new GalleryRequestError({ message: 'Invalid gallery request', cause: error })
    )
  )

export const handleGalleryRequest = (request: Request) => {
  if (request.method === 'GET') {
    return Effect.succeed(
      new Response(galleryPage, {
        status: 200,
        headers: { ...securityHeaders, 'content-type': 'text/html; charset=utf-8' }
      })
    )
  }
  if (request.method !== 'POST')
    return Effect.succeed(jsonResponse({ error: 'Method not allowed' }, 405))

  return Effect.gen(function* () {
    const telegram = yield* Telegram
    const initData = request.headers.get(INIT_DATA_HEADER) ?? ''
    const session = telegram.authenticateMiniApp(initData)
    if (session === undefined) return jsonResponse({ error: 'Unauthorized' }, 401)

    const body = yield* parseBody(request)
    const query = normalizeGalleryQuery(body.query)
    const page = normalizeGalleryPage(body.page)
    const klipy = yield* Klipy
    const providerRequest = { customerId: String(session.userId), page }
    const response =
      query.length === 0
        ? yield* klipy.trending(providerRequest)
        : yield* klipy.search({ ...providerRequest, query })
    const results = response.data.data.flatMap(gif => {
      const selectionQuery = encodeGifSelection({ query, page, id: String(gif.id) })
      return selectionQuery === undefined
        ? []
        : [
            {
              id: String(gif.id),
              title: gif.title,
              preview_url: gif.file.sm.mp4.url,
              thumbnail_url: gif.file.sm.jpg.url,
              width: gif.file.sm.mp4.width,
              height: gif.file.sm.mp4.height,
              selection_query: selectionQuery
            }
          ]
    })

    return jsonResponse({
      results,
      has_next: response.data.has_next,
      next_page: page + 1
    })
  }).pipe(
    Effect.catchTag('GalleryPayloadTooLargeError', () =>
      Effect.succeed(jsonResponse({ error: 'Payload too large' }, 413))
    ),
    Effect.withSpan('gallery.search')
  )
}
