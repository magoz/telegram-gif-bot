import type { KlipyGif } from '@/klipy/schemas'
import type { TelegramInlineResult } from '@/telegram/schemas'
import type { GifRendition } from './experiment'

export const mapKlipyGif = (
  gif: KlipyGif,
  rendition: GifRendition = 'xs',
  idPrefix?: string
): TelegramInlineResult => {
  const media = gif.file[rendition].gif
  const id = idPrefix === undefined ? String(gif.id) : `${idPrefix}-${String(gif.id)}`.slice(0, 64)

  return {
    type: 'gif',
    id,
    gif_url: media.url,
    gif_width: media.width,
    gif_height: media.height,
    thumbnail_url: gif.file.sm.jpg.url,
    thumbnail_mime_type: 'image/jpeg',
    title: gif.title
  }
}
