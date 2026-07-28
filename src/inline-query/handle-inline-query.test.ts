import { assert, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { Klipy } from '@/klipy/service'
import type { KlipySearchRequest, KlipyShape } from '@/klipy/service'
import { Telegram } from '@/telegram/service'
import type { TelegramShape } from '@/telegram/service'
import type { TelegramInlineAnswer } from '@/telegram/schemas'
import { handleInlineQuery } from './handle-inline-query'

it.effect('searches a trimmed query and answers with pagination', () => {
  let searched: KlipySearchRequest | undefined
  let answer: TelegramInlineAnswer | undefined

  const klipy: KlipyShape = {
    search: request => {
      searched = request
      return Effect.succeed({
        result: true,
        data: { data: [], current_page: 2, per_page: 24, has_next: true }
      })
    },
    trending: () => Effect.die(new Error('Unexpected trending request'))
  }
  const telegram: TelegramShape = {
    authenticateWebhook: () => true,
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
      cache_time: 300,
      is_personal: true,
      next_offset: '3'
    })
  }).pipe(Effect.provide(TestLayer))
})
