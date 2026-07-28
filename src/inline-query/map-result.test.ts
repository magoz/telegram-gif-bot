import { describe, expect, it } from 'vitest'
import type { KlipyGif } from '@/klipy/schemas'
import { mapKlipyGif } from './map-result'

const gif: KlipyGif = {
  id: 42,
  slug: 'hello-42',
  title: 'Hello',
  file: {
    hd: {
      mp4: { url: 'https://static.klipy.com/hello.mp4', width: 640, height: 360, size: 100 },
      jpg: { url: 'https://static.klipy.com/hello.jpg', width: 640, height: 360, size: 10 }
    },
    sm: {
      mp4: {
        url: 'https://static.klipy.com/hello-small.mp4',
        width: 320,
        height: 180,
        size: 50
      },
      jpg: {
        url: 'https://static.klipy.com/hello-small.jpg',
        width: 320,
        height: 180,
        size: 5
      }
    }
  }
}

describe('KLIPY GIF mapping', () => {
  it('uses HD MP4 media and small JPEG thumbnail', () => {
    expect(mapKlipyGif(gif)).toEqual({
      type: 'mpeg4_gif',
      id: '42',
      mpeg4_url: 'https://static.klipy.com/hello.mp4',
      mpeg4_width: 640,
      mpeg4_height: 360,
      thumbnail_url: 'https://static.klipy.com/hello-small.jpg',
      thumbnail_mime_type: 'image/jpeg',
      title: 'Hello'
    })
  })
})
