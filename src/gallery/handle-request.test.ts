import { assert, it } from '@effect/vitest'
import { Effect, Layer, Schema } from 'effect'
import type { KlipyGif } from '@/klipy/schemas'
import { Klipy } from '@/klipy/service'
import type { KlipyRequest, KlipySearchRequest, KlipyShape } from '@/klipy/service'
import { Telegram } from '@/telegram/service'
import type { TelegramShape } from '@/telegram/service'
import { decodeGifSelection } from '@/inline-query/selection'
import { handleGalleryRequest } from './handle-request'

const GalleryResponse = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      title: Schema.String,
      preview_url: Schema.String,
      thumbnail_url: Schema.String,
      width: Schema.Number,
      height: Schema.Number,
      selection_query: Schema.String
    })
  ),
  has_next: Schema.Boolean,
  next_page: Schema.Number
})

const result: KlipyGif = {
  id: 42,
  slug: 'cat-42',
  title: '<Funny Cat>',
  file: {
    hd: {
      mp4: { url: 'https://cdn.example/cat.mp4', width: 640, height: 360, size: 100 },
      jpg: { url: 'https://cdn.example/cat.jpg', width: 640, height: 360, size: 10 }
    },
    sm: {
      mp4: { url: 'https://cdn.example/cat-sm.mp4', width: 320, height: 180, size: 50 },
      jpg: { url: 'https://cdn.example/cat-sm.jpg', width: 320, height: 180, size: 5 }
    }
  }
}

const telegram: TelegramShape = {
  authenticateWebhook: () => true,
  authenticateMiniApp: initData => (initData === 'valid-init-data' ? { userId: 99 } : undefined),
  answerInlineQuery: () => Effect.die(new Error('Unexpected inline answer')),
  sendStartMessage: () => Effect.die(new Error('Unexpected start message'))
}

const provide = (klipy: KlipyShape) =>
  Layer.merge(Layer.succeed(Klipy, klipy), Layer.succeed(Telegram, telegram))

it.effect('serves the Mini App page without leaking secrets', () =>
  Effect.gen(function* () {
    const response = yield* handleGalleryRequest(
      new Request('https://example.com/api/gallery?q=cats')
    )
    const html = yield* Effect.promise(() => response.text())

    assert.strictEqual(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /^text\/html/)
    assert.match(html, /Telegram\.WebApp/)
    assert.match(html, /IntersectionObserver/)
    assert.notMatch(html, /TELEGRAM_BOT_TOKEN|KLIPY_API_KEY/)
  }).pipe(
    Effect.provide(
      provide({
        search: () => Effect.die(new Error('GET must not search')),
        trending: () => Effect.die(new Error('GET must not request trending'))
      })
    )
  )
)

it.effect('rejects unsupported methods and unauthenticated searches', () =>
  Effect.gen(function* () {
    const methodResponse = yield* handleGalleryRequest(
      new Request('https://example.com/api/gallery', { method: 'PUT' })
    )
    const authResponse = yield* handleGalleryRequest(
      new Request('https://example.com/api/gallery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'cats', page: 1 })
      })
    )

    assert.strictEqual(methodResponse.status, 405)
    assert.strictEqual(authResponse.status, 401)
  }).pipe(
    Effect.provide(
      provide({
        search: () => Effect.die(new Error('Unauthorized request must not search')),
        trending: () => Effect.die(new Error('Unauthorized request must not request trending'))
      })
    )
  )
)

it.effect('rejects gallery request bodies larger than the limit', () =>
  Effect.gen(function* () {
    const response = yield* handleGalleryRequest(
      new Request('https://example.com/api/gallery', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-init-data': 'valid-init-data'
        },
        body: JSON.stringify({ query: 'x'.repeat(9 * 1024), page: 1 })
      })
    )

    assert.strictEqual(response.status, 413)
    assert.strictEqual(response.headers.get('cache-control'), 'no-store')
    assert.strictEqual(response.headers.get('x-content-type-options'), 'nosniff')
    assert.deepStrictEqual(yield* Effect.promise(() => response.json()), {
      error: 'Payload too large'
    })
  }).pipe(
    Effect.provide(
      provide({
        search: () => Effect.die(new Error('Oversized request must not search')),
        trending: () => Effect.die(new Error('Oversized request must not request trending'))
      })
    )
  )
)

it.effect('authenticates, normalizes, and returns safe gallery search results', () => {
  let searched: KlipySearchRequest | undefined
  const klipy: KlipyShape = {
    search: request => {
      searched = request
      return Effect.succeed({
        result: true,
        data: { data: [result], current_page: 1, per_page: 8, has_next: true }
      })
    },
    trending: () => Effect.die(new Error('Unexpected trending request'))
  }

  return Effect.gen(function* () {
    const response = yield* handleGalleryRequest(
      new Request('https://example.com/api/gallery', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-init-data': 'valid-init-data'
        },
        body: JSON.stringify({ query: '  cats  ', page: 0 })
      })
    )
    const body = Schema.decodeUnknownSync(GalleryResponse)(
      yield* Effect.promise(() => response.json())
    )

    assert.strictEqual(response.status, 200)
    assert.deepStrictEqual(searched, { customerId: '99', page: 1, query: 'cats' })
    assert.deepStrictEqual(body, {
      results: [
        {
          id: '42',
          title: '<Funny Cat>',
          preview_url: 'https://cdn.example/cat-sm.mp4',
          thumbnail_url: 'https://cdn.example/cat-sm.jpg',
          width: 320,
          height: 180,
          selection_query: body.results[0].selection_query
        }
      ],
      has_next: true,
      next_page: 2
    })
    assert.deepStrictEqual(decodeGifSelection(body.results[0].selection_query), {
      query: 'cats',
      page: 1,
      id: '42'
    })
  }).pipe(Effect.provide(provide(klipy)))
})

it.effect('uses trending for an empty query and preserves a valid page', () => {
  let requested: KlipyRequest | undefined
  const klipy: KlipyShape = {
    search: () => Effect.die(new Error('Unexpected search')),
    trending: request => {
      requested = request
      return Effect.succeed({
        result: true,
        data: { data: [], current_page: 3, per_page: 8, has_next: false }
      })
    }
  }

  return Effect.gen(function* () {
    const response = yield* handleGalleryRequest(
      new Request('https://example.com/api/gallery', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-init-data': 'valid-init-data'
        },
        body: JSON.stringify({ query: '   ', page: 3 })
      })
    )
    const body = Schema.decodeUnknownSync(GalleryResponse)(
      yield* Effect.promise(() => response.json())
    )

    assert.strictEqual(response.status, 200)
    assert.deepStrictEqual(requested, { customerId: '99', page: 3 })
    assert.deepStrictEqual(body, { results: [], has_next: false, next_page: 4 })
  }).pipe(Effect.provide(provide(klipy)))
})
