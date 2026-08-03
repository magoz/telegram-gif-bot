import { Effect } from 'effect'
import { Klipy } from '@/klipy/service'
import { Telegram } from '@/telegram/service'
import type { TelegramInlineQuery } from '@/telegram/schemas'
import { parseInlineQuery } from './experiment'
import { mapKlipyGif } from './map-result'
import { nextOffset, pageFromOffset } from './pagination'

const CACHE_TIME_SECONDS = 0

export const handleInlineQuery = (inlineQuery: TelegramInlineQuery) =>
  Effect.gen(function* () {
    const klipy = yield* Klipy
    const telegram = yield* Telegram
    const parsedQuery = parseInlineQuery(inlineQuery.query)

    if (parsedQuery.kind === 'pending-experiment') {
      yield* telegram.answerInlineQuery({
        inline_query_id: inlineQuery.id,
        results: [],
        cache_time: CACHE_TIME_SECONDS,
        is_personal: true,
        next_offset: ''
      })
      return
    }

    const experiment = parsedQuery.kind === 'experiment' ? parsedQuery : undefined
    const page = experiment === undefined ? pageFromOffset(inlineQuery.offset) : 1
    const query = parsedQuery.query
    const request = { customerId: String(inlineQuery.from.id), page }

    const response =
      query.length === 0
        ? yield* klipy.trending(request)
        : yield* klipy.search({ ...request, query })

    const gifs = response.data.data
    const selectedGifs =
      experiment === undefined
        ? gifs
        : gifs.slice(experiment.start - 1, experiment.start - 1 + experiment.count)

    if (experiment !== undefined) {
      yield* Effect.logInfo('Inline media experiment', {
        rendition: experiment.rendition,
        start: experiment.start,
        count: experiment.count,
        query: experiment.query,
        results: selectedGifs.map((gif, index) => {
          const media = gif.file[experiment.rendition].gif
          return {
            position: experiment.start + index,
            id: gif.id,
            url: media.url,
            width: media.width,
            height: media.height,
            size: media.size
          }
        })
      })
    }

    yield* telegram.answerInlineQuery({
      inline_query_id: inlineQuery.id,
      results: selectedGifs.map((gif, index) =>
        experiment === undefined
          ? mapKlipyGif(gif)
          : mapKlipyGif(
              gif,
              experiment.rendition,
              `test-${experiment.rendition}-${experiment.start + index}-${inlineQuery.id.slice(-12)}`
            )
      ),
      cache_time: CACHE_TIME_SECONDS,
      is_personal: true,
      next_offset: experiment === undefined ? nextOffset(page, response.data.has_next) : ''
    })
  }).pipe(
    Effect.withSpan('inline-query.handle', {
      attributes: {
        'telegram.inline_query_id': inlineQuery.id,
        'telegram.user_id': inlineQuery.from.id
      }
    })
  )
