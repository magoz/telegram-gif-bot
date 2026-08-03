const SELECTION_PREFIX = '~pick~'
const MAX_QUERY_BYTES = 96
const MAX_ID_BYTES = 64
const MAX_PAGE = 10_000
const MAX_INLINE_QUERY_LENGTH = 256

const byteLength = (value: string): number => Buffer.byteLength(value, 'utf8')

const truncateUtf8 = (value: string, maximumBytes: number): string => {
  let result = ''
  for (const character of value) {
    if (byteLength(result + character) > maximumBytes) break
    result += character
  }
  return result
}

export const normalizeGalleryQuery = (query: string): string =>
  truncateUtf8(query.trim(), MAX_QUERY_BYTES)

const encodePart = (value: string): string => Buffer.from(value, 'utf8').toString('base64url')

const decodePart = (value: string): string | undefined => {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return undefined

  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8')
    return encodePart(decoded) === value ? decoded : undefined
  } catch {
    return undefined
  }
}

export const normalizeGalleryPage = (page: number): number =>
  Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1

export type GifSelection = {
  readonly query: string
  readonly page: number
  readonly id: string
}

export const encodeGifSelection = (selection: GifSelection): string | undefined => {
  const query = normalizeGalleryQuery(selection.query)
  const id = selection.id

  if (
    !Number.isSafeInteger(selection.page) ||
    selection.page < 1 ||
    selection.page > MAX_PAGE ||
    id.length === 0 ||
    byteLength(id) > MAX_ID_BYTES
  ) {
    return undefined
  }

  const encoded = `${SELECTION_PREFIX}${String(selection.page)}~${encodePart(id)}~${encodePart(query)}`
  return encoded.length <= MAX_INLINE_QUERY_LENGTH ? encoded : undefined
}

export const decodeGifSelection = (value: string): GifSelection | undefined => {
  if (!value.startsWith(SELECTION_PREFIX) || value.length > MAX_INLINE_QUERY_LENGTH)
    return undefined

  const parts = value.slice(SELECTION_PREFIX.length).split('~')
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return undefined

  const page = Number(parts[0])
  const id = decodePart(parts[1])
  const query = decodePart(parts[2])

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > MAX_PAGE ||
    id === undefined ||
    id.length === 0 ||
    byteLength(id) > MAX_ID_BYTES ||
    query === undefined ||
    byteLength(query) > MAX_QUERY_BYTES ||
    normalizeGalleryQuery(query) !== query
  ) {
    return undefined
  }

  return { query, page, id }
}

export const isSelectionQuery = (value: string): boolean => value.startsWith(SELECTION_PREFIX)
