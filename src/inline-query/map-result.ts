import type { KlipyGif } from '@/klipy/schemas'
import type { TelegramInlineResult } from '@/telegram/schemas'

export const mapKlipyGif = (gif: KlipyGif): TelegramInlineResult => ({
  type: 'mpeg4_gif',
  id: String(gif.id),
  mpeg4_url: gif.file.hd.mp4.url,
  mpeg4_width: gif.file.hd.mp4.width,
  mpeg4_height: gif.file.hd.mp4.height,
  thumbnail_url: gif.file.sm.jpg.url,
  thumbnail_mime_type: 'image/jpeg',
  title: gif.title
})
