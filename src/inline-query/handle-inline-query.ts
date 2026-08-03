import { Effect } from 'effect'
import { Klipy } from '@/klipy/service'
import { Telegram } from '@/telegram/service'
import type { TelegramInlineAnswer, TelegramInlineQuery } from '@/telegram/schemas'
import { mapKlipyGif } from './map-result'
import {
  decodeGifSelection,
  isSelectionQuery,
  normalizeGalleryQuery,
  type GifSelection
} from './selection'

const GALLERY_CACHE_TIME_SECONDS = 300
const SELECTION_CACHE_TIME_SECONDS = 0

const galleryButton = (
  origin: string,
  query: string
): NonNullable<TelegramInlineAnswer['button']> => {
  const url = new URL('/api/gallery', origin)
  const normalizedQuery = normalizeGalleryQuery(query)
  if (normalizedQuery.length > 0) url.searchParams.set('q', normalizedQuery)

  return { text: 'Open Gallery', web_app: { url: url.toString() } }
}

const answerWithGallery = (
  inlineQuery: TelegramInlineQuery,
  origin: string,
  query: string
): TelegramInlineAnswer => ({
  inline_query_id: inlineQuery.id,
  results: [],
  cache_time: GALLERY_CACHE_TIME_SECONDS,
  is_personal: true,
  next_offset: '',
  button: galleryButton(origin, query)
})

const resolveSelection = (inlineQuery: TelegramInlineQuery, selection: GifSelection) =>
  Effect.gen(function* () {
    const klipy = yield* Klipy
    const request = { customerId: String(inlineQuery.from.id), page: selection.page }
    const response =
      selection.query.length === 0
        ? yield* klipy.trending(request)
        : yield* klipy.search({ ...request, query: selection.query })
    const selected = response.data.data.find(gif => String(gif.id) === selection.id)

    return selected === undefined ? [] : [mapKlipyGif(selected)]
  })

export const handleInlineQuery = (inlineQuery: TelegramInlineQuery, origin: string) =>
  Effect.gen(function* () {
    const telegram = yield* Telegram
    const selection = decodeGifSelection(inlineQuery.query)

    if (selection === undefined) {
      const query = isSelectionQuery(inlineQuery.query) ? '' : inlineQuery.query
      yield* telegram.answerInlineQuery(answerWithGallery(inlineQuery, origin, query))
      return
    }

    const results = yield* resolveSelection(inlineQuery, selection)
    yield* telegram.answerInlineQuery({
      inline_query_id: inlineQuery.id,
      results,
      cache_time: SELECTION_CACHE_TIME_SECONDS,
      is_personal: true,
      next_offset: '',
      ...(results.length === 0 ? { button: galleryButton(origin, selection.query) } : {})
    })
  }).pipe(
    Effect.withSpan('inline-query.handle', {
      attributes: {
        'telegram.inline_query_id': inlineQuery.id,
        'telegram.user_id': inlineQuery.from.id
      }
    })
  )
