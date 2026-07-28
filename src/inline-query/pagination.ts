const FIRST_PAGE = 1

export const pageFromOffset = (offset: string): number => {
  if (!/^\d+$/.test(offset)) return FIRST_PAGE

  const page = Number(offset)
  return Number.isSafeInteger(page) && page >= FIRST_PAGE ? page : FIRST_PAGE
}

export const nextOffset = (page: number, hasNext: boolean): string =>
  hasNext ? String(page + 1) : ''
