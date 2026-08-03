import { Effect } from 'effect'
import { Klipy } from '@/klipy/service'
import { Telegram } from '@/telegram/service'
import type { TelegramInlineQuery } from '@/telegram/schemas'
import { mapKlipyGif } from './map-result'
import { nextOffset, pageFromOffset } from './pagination'

const CACHE_TIME_SECONDS = 0

export const handleInlineQuery = (inlineQuery: TelegramInlineQuery) =>
  Effect.gen(function* () {
    const klipy = yield* Klipy
    const telegram = yield* Telegram
    const page = pageFromOffset(inlineQuery.offset)
    const query = inlineQuery.query.trim()
    const request = { customerId: String(inlineQuery.from.id), page }

    const response =
      query.length === 0
        ? yield* klipy.trending(request)
        : yield* klipy.search({ ...request, query })

    yield* telegram.answerInlineQuery({
      inline_query_id: inlineQuery.id,
      results: response.data.data.map(mapKlipyGif),
      cache_time: CACHE_TIME_SECONDS,
      is_personal: true,
      next_offset: nextOffset(page, response.data.has_next)
    })
  }).pipe(
    Effect.withSpan('inline-query.handle', {
      attributes: {
        'telegram.inline_query_id': inlineQuery.id,
        'telegram.user_id': inlineQuery.from.id
      }
    })
  )
