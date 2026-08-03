export type GifRendition = 'xs' | 'sm'
export type ThumbnailMode = 'provider' | 'fixed'

export type ParsedInlineQuery =
  | { readonly kind: 'normal'; readonly query: string }
  | { readonly kind: 'pending-experiment' }
  | {
      readonly kind: 'experiment'
      readonly rendition: GifRendition
      readonly thumbnailMode: ThumbnailMode
      readonly forceCold: boolean
      readonly start: number
      readonly count: number
      readonly query: string
    }

const TEST_PREFIX = '!test'
const COLD_PREFIX = '!cold'
const MAX_RESULTS = 50
const EXPERIMENT_PATTERN = /^!(test|cold)\s+(xs|sm)(?:\s+(fixed))?\s+(\d{1,2})\s+(\d{1,2})\s+(.+)$/

export const parseInlineQuery = (input: string): ParsedInlineQuery => {
  const query = input.trim()

  if (
    query !== TEST_PREFIX &&
    !query.startsWith(`${TEST_PREFIX} `) &&
    query !== COLD_PREFIX &&
    !query.startsWith(`${COLD_PREFIX} `)
  ) {
    return { kind: 'normal', query }
  }

  const match = EXPERIMENT_PATTERN.exec(query)
  if (match === null) return { kind: 'pending-experiment' }

  const forceCold = match[1] === 'cold'
  const rendition: GifRendition = match[2] === 'sm' ? 'sm' : 'xs'
  const thumbnailMode: ThumbnailMode = forceCold || match[3] === 'fixed' ? 'fixed' : 'provider'
  const start = Number(match[4])
  const count = Number(match[5])
  const searchQuery = match[6].trim()

  if (
    start < 1 ||
    start > MAX_RESULTS ||
    count < 1 ||
    count > MAX_RESULTS ||
    start + count - 1 > MAX_RESULTS ||
    searchQuery.length === 0
  ) {
    return { kind: 'pending-experiment' }
  }

  return {
    kind: 'experiment',
    rendition,
    thumbnailMode,
    forceCold,
    start,
    count,
    query: searchQuery
  }
}
