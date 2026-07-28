import { describe, expect, it } from 'vitest'
import { nextOffset, pageFromOffset } from './pagination'

describe('inline query pagination', () => {
  it.each([
    ['', 1],
    ['0', 1],
    ['abc', 1],
    ['1.5', 1],
    ['2', 2]
  ])('maps offset %s to page %s', (offset, expected) => {
    expect(pageFromOffset(offset)).toBe(expected)
  })

  it('returns the next page only when available', () => {
    expect(nextOffset(2, true)).toBe('3')
    expect(nextOffset(2, false)).toBe('')
  })
})
