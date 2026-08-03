import type { KlipyGif } from '@/klipy/schemas'
import type { TelegramInlineResult } from '@/telegram/schemas'
import type { GifRendition, ThumbnailMode } from './experiment'

export const FIXED_THUMBNAIL_URL = 'https://telegram-gif-bot.vercel.app/inline-test-thumbnail.jpg'

type MapKlipyGifOptions = {
  readonly rendition?: GifRendition
  readonly thumbnailMode?: ThumbnailMode
  readonly mediaCacheKey?: string
  readonly idPrefix?: string
}

export const mapKlipyGif = (
  gif: KlipyGif,
  options: MapKlipyGifOptions = {}
): TelegramInlineResult => {
  const rendition = options.rendition ?? 'xs'
  const media = gif.file[rendition].gif
  const id =
    options.idPrefix === undefined
      ? String(gif.id)
      : `${options.idPrefix}-${String(gif.id)}`.slice(0, 64)
  const mediaUrl =
    options.mediaCacheKey === undefined
      ? media.url
      : `${media.url}${media.url.includes('?') ? '&' : '?'}inline_test=${encodeURIComponent(options.mediaCacheKey)}`

  return {
    type: 'gif',
    id,
    gif_url: mediaUrl,
    gif_width: media.width,
    gif_height: media.height,
    thumbnail_url: options.thumbnailMode === 'fixed' ? FIXED_THUMBNAIL_URL : gif.file.sm.jpg.url,
    thumbnail_mime_type: 'image/jpeg',
    title: gif.title
  }
}
