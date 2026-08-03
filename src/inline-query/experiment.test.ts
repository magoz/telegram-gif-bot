import { describe, expect, it } from 'vitest'
import { parseInlineQuery } from './experiment'

describe('inline media experiment query', () => {
  it('leaves normal and empty searches unchanged', () => {
    expect(parseInlineQuery('  cats  ')).toEqual({ kind: 'normal', query: 'cats' })
    expect(parseInlineQuery('   ')).toEqual({ kind: 'normal', query: '' })
    expect(parseInlineQuery('!testing cats')).toEqual({
      kind: 'normal',
      query: '!testing cats'
    })
  })

  it('parses a bounded rendition experiment only after the terminal marker', () => {
    expect(parseInlineQuery('!test sm 5 8 cats ::go')).toEqual({
      kind: 'experiment',
      rendition: 'sm',
      thumbnailMode: 'provider',
      mediaCacheKey: undefined,
      start: 5,
      count: 8,
      query: 'cats'
    })
  })

  it('parses the fixed-thumbnail isolation mode', () => {
    expect(parseInlineQuery('!test xs fixed 1 4 raccoons ::go')).toEqual({
      kind: 'experiment',
      rendition: 'xs',
      thumbnailMode: 'fixed',
      mediaCacheKey: undefined,
      start: 1,
      count: 4,
      query: 'raccoons'
    })
  })

  it('parses the Telegram-cached media experiment', () => {
    expect(parseInlineQuery('!cached ::go')).toEqual({ kind: 'cached-experiment' })
  })

  it('uses a caller nonce as the stable cold-media cache key', () => {
    expect(parseInlineQuery('!cold run-1 xs 1 4 badgers ::go')).toEqual({
      kind: 'experiment',
      rendition: 'xs',
      thumbnailMode: 'fixed',
      mediaCacheKey: 'run-1',
      start: 1,
      count: 4,
      query: 'badgers'
    })
  })

  it.each([
    '!test',
    '!test sm 1 1 cats',
    '!test sm 1 1 cats ::g',
    '!cold',
    '!cached',
    '!cached ::g',
    '!cold xs 1 1 cats ::go',
    '!cold run-1 xs 1 1 cats',
    '!test md 1 1 cats ::go',
    '!test sm 0 1 cats ::go',
    '!test sm 50 2 cats ::go'
  ])('treats an incomplete or invalid experiment as pending: %s', query => {
    expect(parseInlineQuery(query)).toEqual({ kind: 'pending-experiment' })
  })
})
