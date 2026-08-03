import { describe, expect, it } from 'vitest'
import {
  decodeGifSelection,
  encodeGifSelection,
  isSelectionQuery,
  normalizeGalleryPage,
  normalizeGalleryQuery
} from './selection'

describe('GIF selection locator', () => {
  it('round trips a normalized query, page, and provider id', () => {
    const encoded = encodeGifSelection({ query: '  funny cats  ', page: 3, id: 'gif/42' })

    expect(encoded).toBeDefined()
    expect(isSelectionQuery(encoded ?? '')).toBe(true)
    expect(decodeGifSelection(encoded ?? '')).toEqual({
      query: 'funny cats',
      page: 3,
      id: 'gif/42'
    })
  })

  it.each([
    '~pick~0~NDI~Y2F0cw',
    '~pick~1~!~Y2F0cw',
    '~pick~1~NDI',
    '~pick~1~~Y2F0cw',
    '~pick~10001~NDI~Y2F0cw',
    `~pick~1~NDI~${'a'.repeat(257)}`,
    'cats'
  ])('rejects malformed locator %s', value => {
    expect(decodeGifSelection(value)).toBeUndefined()
  })

  it('normalizes gallery pages to the supported range', () => {
    expect(normalizeGalleryPage(3)).toBe(3)
    expect(normalizeGalleryPage(0)).toBe(1)
    expect(normalizeGalleryPage(10_001)).toBe(1)
    expect(normalizeGalleryPage(1.5)).toBe(1)
  })

  it('bounds normalized search queries by UTF-8 bytes', () => {
    const normalized = normalizeGalleryQuery(`  ${'😀'.repeat(40)}  `)

    expect(Buffer.byteLength(normalized, 'utf8')).toBeLessThanOrEqual(96)
    expect(normalized.length).toBe(48)
  })
})
