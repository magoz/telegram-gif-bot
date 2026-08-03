export type GifRendition = 'xs' | 'sm'
export type ThumbnailMode = 'provider' | 'fixed'

export type ParsedInlineQuery =
  | { readonly kind: 'normal'; readonly query: string }
  | { readonly kind: 'pending-experiment' }
  | {
      readonly kind: 'experiment'
      readonly rendition: GifRendition
      readonly thumbnailMode: ThumbnailMode
      readonly mediaCacheKey: string | undefined
      readonly start: number
      readonly count: number
      readonly query: string
    }

const TEST_PREFIX = '!test'
const COLD_PREFIX = '!cold'
const MAX_RESULTS = 50
const TEST_PATTERN = /^!test\s+(xs|sm)(?:\s+(fixed))?\s+(\d{1,2})\s+(\d{1,2})\s+(.+?)\s+::go$/
const COLD_PATTERN =
  /^!cold\s+([A-Za-z0-9_-]{1,16})\s+(xs|sm)\s+(\d{1,2})\s+(\d{1,2})\s+(.+?)\s+::go$/

const renditionFrom = (value: string): GifRendition => (value === 'sm' ? 'sm' : 'xs')

const experiment = (
  rendition: GifRendition,
  thumbnailMode: ThumbnailMode,
  mediaCacheKey: string | undefined,
  startText: string,
  countText: string,
  queryText: string
): ParsedInlineQuery => {
  const start = Number(startText)
  const count = Number(countText)
  const query = queryText.trim()

  if (
    start < 1 ||
    start > MAX_RESULTS ||
    count < 1 ||
    count > MAX_RESULTS ||
    start + count - 1 > MAX_RESULTS ||
    query.length === 0
  ) {
    return { kind: 'pending-experiment' }
  }

  return {
    kind: 'experiment',
    rendition,
    thumbnailMode,
    mediaCacheKey,
    start,
    count,
    query
  }
}

export const parseInlineQuery = (input: string): ParsedInlineQuery => {
  const query = input.trim()
  const isTest = query === TEST_PREFIX || query.startsWith(`${TEST_PREFIX} `)
  const isCold = query === COLD_PREFIX || query.startsWith(`${COLD_PREFIX} `)

  if (!isTest && !isCold) return { kind: 'normal', query }

  const testMatch = TEST_PATTERN.exec(query)
  if (testMatch !== null) {
    return experiment(
      renditionFrom(testMatch[1]),
      testMatch[2] === 'fixed' ? 'fixed' : 'provider',
      undefined,
      testMatch[3],
      testMatch[4],
      testMatch[5]
    )
  }

  const coldMatch = COLD_PATTERN.exec(query)
  if (coldMatch !== null) {
    return experiment(
      renditionFrom(coldMatch[2]),
      'fixed',
      coldMatch[1],
      coldMatch[3],
      coldMatch[4],
      coldMatch[5]
    )
  }

  return { kind: 'pending-experiment' }
}
