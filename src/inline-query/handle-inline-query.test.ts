import { assert, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import type { KlipyGif } from '@/klipy/schemas'
import { Klipy } from '@/klipy/service'
import type { KlipySearchRequest, KlipyShape } from '@/klipy/service'
import { Telegram } from '@/telegram/service'
import type { TelegramShape } from '@/telegram/service'
import type { TelegramInlineAnswer } from '@/telegram/schemas'
import { handleInlineQuery } from './handle-inline-query'
import { encodeGifSelection } from './selection'

const gif = (id: number, title: string): KlipyGif => ({
  id,
  slug: `${title}-${String(id)}`,
  title,
  file: {
    hd: {
      mp4: { url: `https://cdn.example/${String(id)}.mp4`, width: 640, height: 360, size: 100 },
      jpg: { url: `https://cdn.example/${String(id)}.jpg`, width: 640, height: 360, size: 10 }
    },
    sm: {
      mp4: {
        url: `https://cdn.example/${String(id)}-small.mp4`,
        width: 320,
        height: 180,
        size: 50
      },
      jpg: {
        url: `https://cdn.example/${String(id)}-small.jpg`,
        width: 320,
        height: 180,
        size: 5
      }
    }
  }
})

const telegramMock = (capture: (answer: TelegramInlineAnswer) => void): TelegramShape => ({
  authenticateWebhook: () => true,
  authenticateMiniApp: () => ({ userId: 123 }),
  sendStartMessage: () => Effect.die(new Error('Unexpected start message')),
  answerInlineQuery: answer => {
    capture(answer)
    return Effect.void
  }
})

it.effect('answers a normal query with only a query-preserving gallery button', () => {
  let answer: TelegramInlineAnswer | undefined
  const klipy: KlipyShape = {
    search: () => Effect.die(new Error('Normal query must not search KLIPY')),
    trending: () => Effect.die(new Error('Normal query must not request trending GIFs'))
  }
  const TestLayer = Layer.merge(
    Layer.succeed(Klipy, klipy),
    Layer.succeed(
      Telegram,
      telegramMock(value => {
        answer = value
      })
    )
  )

  return Effect.gen(function* () {
    yield* handleInlineQuery(
      { id: 'inline-1', from: { id: 123 }, query: '  funny cats  ', offset: '2' },
      'https://example.com'
    )

    assert.deepStrictEqual(answer, {
      inline_query_id: 'inline-1',
      results: [],
      cache_time: 300,
      is_personal: true,
      next_offset: '',
      button: {
        text: 'Open Gallery',
        web_app: { url: 'https://example.com/api/gallery?q=funny+cats' }
      }
    })
  }).pipe(Effect.provide(TestLayer))
})

it.effect('re-runs the selected page and returns only the matching native GIF', () => {
  let searched: KlipySearchRequest | undefined
  let answer: TelegramInlineAnswer | undefined
  const klipy: KlipyShape = {
    search: request => {
      searched = request
      return Effect.succeed({
        result: true,
        data: {
          data: [gif(41, 'Other'), gif(42, 'Selected')],
          current_page: 2,
          per_page: 8,
          has_next: true
        }
      })
    },
    trending: () => Effect.die(new Error('Unexpected trending request'))
  }
  const TestLayer = Layer.merge(
    Layer.succeed(Klipy, klipy),
    Layer.succeed(
      Telegram,
      telegramMock(value => {
        answer = value
      })
    )
  )
  const selection = encodeGifSelection({ query: 'cats', page: 2, id: '42' })

  return Effect.gen(function* () {
    assert.notEqual(selection, undefined)
    yield* handleInlineQuery(
      { id: 'inline-2', from: { id: 123 }, query: selection ?? '', offset: '' },
      'https://example.com'
    )

    assert.deepStrictEqual(searched, { customerId: '123', page: 2, query: 'cats' })
    assert.deepStrictEqual(answer, {
      inline_query_id: 'inline-2',
      results: [
        {
          type: 'mpeg4_gif',
          id: '42',
          mpeg4_url: 'https://cdn.example/42-small.mp4',
          mpeg4_width: 320,
          mpeg4_height: 180,
          thumbnail_url: 'https://cdn.example/42-small.jpg',
          thumbnail_mime_type: 'image/jpeg',
          title: 'Selected'
        }
      ],
      cache_time: 0,
      is_personal: true,
      next_offset: ''
    })
  }).pipe(Effect.provide(TestLayer))
})

it.effect('falls back to an empty gallery for a malformed internal selection', () => {
  let answer: TelegramInlineAnswer | undefined
  const klipy: KlipyShape = {
    search: () => Effect.die(new Error('Malformed selection must not search KLIPY')),
    trending: () => Effect.die(new Error('Malformed selection must not request trending GIFs'))
  }
  const TestLayer = Layer.merge(
    Layer.succeed(Klipy, klipy),
    Layer.succeed(
      Telegram,
      telegramMock(value => {
        answer = value
      })
    )
  )

  return Effect.gen(function* () {
    yield* handleInlineQuery(
      { id: 'inline-3', from: { id: 123 }, query: '~pick~broken', offset: '' },
      'https://example.com'
    )

    assert.deepStrictEqual(answer?.results, [])
    assert.deepStrictEqual(answer?.button, {
      text: 'Open Gallery',
      web_app: { url: 'https://example.com/api/gallery' }
    })
  }).pipe(Effect.provide(TestLayer))
})
