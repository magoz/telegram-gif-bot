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

  it('parses a bounded rendition experiment', () => {
    expect(parseInlineQuery('!test sm 5 8 cats')).toEqual({
      kind: 'experiment',
      rendition: 'sm',
      start: 5,
      count: 8,
      query: 'cats'
    })
  })

  it.each(['!test', '!test sm', '!test md 1 1 cats', '!test sm 0 1 cats', '!test sm 50 2 cats'])(
    'treats an incomplete or invalid experiment as pending: %s',
    query => {
      expect(parseInlineQuery(query)).toEqual({ kind: 'pending-experiment' })
    }
  )
})
