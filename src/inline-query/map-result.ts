import type { KlipyGif } from '@/klipy/schemas'
import type { TelegramInlineResult } from '@/telegram/schemas'

export const mapKlipyGif = (gif: KlipyGif): TelegramInlineResult => ({
  type: 'gif',
  id: String(gif.id),
  gif_url: gif.file.sm.gif.url,
  gif_width: gif.file.sm.gif.width,
  gif_height: gif.file.sm.gif.height,
  thumbnail_url: gif.file.sm.jpg.url,
  thumbnail_mime_type: 'image/jpeg',
  title: gif.title
})
