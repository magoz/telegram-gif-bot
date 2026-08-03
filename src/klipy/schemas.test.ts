import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { KlipyResponse } from './schemas'

describe('KLIPY response schema', () => {
  it('decodes the GIF and JPEG renditions used by inline results', () => {
    const response = Schema.decodeUnknownSync(KlipyResponse)({
      result: true,
      data: {
        data: [
          {
            id: 42,
            slug: 'hello-42',
            title: 'Hello',
            file: {
              xs: {
                gif: { url: 'https://cdn.example/42-xs.gif', width: 160, height: 90, size: 25 }
              },
              sm: {
                jpg: { url: 'https://cdn.example/42-sm.jpg', width: 320, height: 180, size: 5 }
              }
            }
          }
        ],
        current_page: 1,
        per_page: 8,
        has_next: false
      }
    })

    expect(response.data.data[0].file.xs.gif.url).toBe('https://cdn.example/42-xs.gif')
    expect(response.data.data[0].file.sm.jpg.url).toBe('https://cdn.example/42-sm.jpg')
  })
})
