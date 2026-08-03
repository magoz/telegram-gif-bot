import { assert, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { Klipy } from '@/klipy/service'
import type { KlipySearchRequest, KlipyShape } from '@/klipy/service'
import type { KlipyGif } from '@/klipy/schemas'
import { Telegram } from '@/telegram/service'
import type { TelegramShape } from '@/telegram/service'
import type { TelegramInlineAnswer } from '@/telegram/schemas'
import { handleInlineQuery } from './handle-inline-query'

const makeGif = (id: number): KlipyGif => ({
  id,
  slug: `gif-${id}`,
  title: `GIF ${id}`,
  file: {
    xs: {
      gif: { url: `https://cdn.example/${id}-xs.gif`, width: 160, height: 90, size: 25 }
    },
    sm: {
      gif: { url: `https://cdn.example/${id}-sm.gif`, width: 320, height: 180, size: 100 },
      jpg: { url: `https://cdn.example/${id}-sm.jpg`, width: 320, height: 180, size: 5 }
    }
  }
})

it.effect('searches a trimmed query and answers with pagination', () => {
  let searched: KlipySearchRequest | undefined
  let answer: TelegramInlineAnswer | undefined

  const klipy: KlipyShape = {
    search: request => {
      searched = request
      return Effect.succeed({
        result: true,
        data: { data: [], current_page: 2, per_page: 8, has_next: true }
      })
    },
    trending: () => Effect.die(new Error('Unexpected trending request'))
  }
  const telegram: TelegramShape = {
    authenticateWebhook: () => true,
    sendStartMessage: () => Effect.die(new Error('Unexpected start message')),
    answerInlineQuery: value => {
      answer = value
      return Effect.void
    }
  }
  const TestLayer = Layer.merge(Layer.succeed(Klipy, klipy), Layer.succeed(Telegram, telegram))

  return Effect.gen(function* () {
    yield* handleInlineQuery({
      id: 'inline-1',
      from: { id: 123 },
      query: '  cats  ',
      offset: '2'
    })

    assert.deepStrictEqual(searched, { customerId: '123', page: 2, query: 'cats' })
    assert.deepStrictEqual(answer, {
      inline_query_id: 'inline-1',
      results: [],
      cache_time: 0,
      is_personal: true,
      next_offset: '3'
    })
  }).pipe(Effect.provide(TestLayer))
})

it.effect('runs a bounded rendition experiment on page one without pagination', () => {
  let answer: TelegramInlineAnswer | undefined
  const klipy: KlipyShape = {
    search: request => {
      assert.deepStrictEqual(request, { customerId: '789', page: 1, query: 'cats' })
      return Effect.succeed({
        result: true,
        data: {
          data: [makeGif(1), makeGif(2), makeGif(3), makeGif(4)],
          current_page: 1,
          per_page: 50,
          has_next: true
        }
      })
    },
    trending: () => Effect.die(new Error('Unexpected trending request'))
  }
  const telegram: TelegramShape = {
    authenticateWebhook: () => true,
    sendStartMessage: () => Effect.die(new Error('Unexpected start message')),
    answerInlineQuery: value => {
      answer = value
      return Effect.void
    }
  }
  const TestLayer = Layer.merge(Layer.succeed(Klipy, klipy), Layer.succeed(Telegram, telegram))

  return Effect.gen(function* () {
    yield* handleInlineQuery({
      id: 'inline-test',
      from: { id: 789 },
      query: '!test sm 2 2 cats',
      offset: '4'
    })

    assert.strictEqual(answer?.next_offset, '')
    assert.strictEqual(answer?.results.length, 2)
    assert.deepStrictEqual(
      answer?.results.map(result => ({ id: result.id, url: result.gif_url })),
      [
        { id: 'test-sm-provider-2-inline-test-2', url: 'https://cdn.example/2-sm.gif' },
        { id: 'test-sm-provider-3-inline-test-3', url: 'https://cdn.example/3-sm.gif' }
      ]
    )
  }).pipe(Effect.provide(TestLayer))
})

it.effect('loads trending GIFs for an empty query and stops on the final page', () => {
  let answer: TelegramInlineAnswer | undefined
  const klipy: KlipyShape = {
    search: () => Effect.die(new Error('Unexpected search')),
    trending: request => {
      assert.deepStrictEqual(request, { customerId: '456', page: 1 })
      return Effect.succeed({
        result: true,
        data: { data: [], current_page: 1, per_page: 8, has_next: false }
      })
    }
  }
  const telegram: TelegramShape = {
    authenticateWebhook: () => true,
    sendStartMessage: () => Effect.die(new Error('Unexpected start message')),
    answerInlineQuery: value => {
      answer = value
      return Effect.void
    }
  }
  const TestLayer = Layer.merge(Layer.succeed(Klipy, klipy), Layer.succeed(Telegram, telegram))

  return Effect.gen(function* () {
    yield* handleInlineQuery({
      id: 'inline-2',
      from: { id: 456 },
      query: '   ',
      offset: ''
    })

    assert.deepStrictEqual(answer, {
      inline_query_id: 'inline-2',
      results: [],
      cache_time: 0,
      is_personal: true,
      next_offset: ''
    })
  }).pipe(Effect.provide(TestLayer))
})
