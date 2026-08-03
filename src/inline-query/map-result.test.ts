import { describe, expect, it } from 'vitest'
import type { KlipyGif } from '@/klipy/schemas'
import { mapKlipyGif } from './map-result'

const gif: KlipyGif = {
  id: 42,
  slug: 'hello-42',
  title: 'Hello',
  file: {
    xs: {
      gif: {
        url: 'https://static.klipy.com/hello-extra-small.gif',
        width: 160,
        height: 90,
        size: 25
      }
    },
    sm: {
      gif: {
        url: 'https://static.klipy.com/hello-small.gif',
        width: 320,
        height: 180,
        size: 100
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
  it('sends the small GIF with a static JPEG thumbnail', () => {
    expect(mapKlipyGif(gif)).toEqual({
      type: 'gif',
      id: '42',
      gif_url: 'https://static.klipy.com/hello-small.gif',
      gif_width: 320,
      gif_height: 180,
      thumbnail_url: 'https://static.klipy.com/hello-small.jpg',
      thumbnail_mime_type: 'image/jpeg',
      title: 'Hello'
    })
  })
})
