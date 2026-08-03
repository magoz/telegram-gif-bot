import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { authenticateMiniAppInitData } from './mini-app-auth'

const BOT_TOKEN = '123456:test-token'
const NOW = 1_700_000_000

const signedInitData = (values: Record<string, string | undefined>): string => {
  const entries = Object.entries(values).filter(
    (entry): entry is [string, string] => entry[1] !== undefined
  )
  const dataCheckString = entries
    .map(([key, value]) => `${key}=${value}`)
    .toSorted()
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex')
  return new URLSearchParams([...entries, ['hash', hash]]).toString()
}

const validValues = {
  auth_date: String(NOW),
  query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
  user: JSON.stringify({ id: 42, first_name: 'Ada' })
}

describe('Telegram Mini App init data authentication', () => {
  it('accepts a fresh correctly signed user session', () => {
    expect(authenticateMiniAppInitData(signedInitData(validValues), BOT_TOKEN, NOW)).toEqual({
      userId: 42
    })
  })

  it('rejects tampering after signing', () => {
    const valid = signedInitData(validValues)
    const tampered = valid.replace('%22id%22%3A42', '%22id%22%3A43')

    expect(authenticateMiniAppInitData(tampered, BOT_TOKEN, NOW)).toBeUndefined()
  })

  it('rejects stale and implausibly future auth dates', () => {
    expect(
      authenticateMiniAppInitData(
        signedInitData({ ...validValues, auth_date: String(NOW - 86_401) }),
        BOT_TOKEN,
        NOW
      )
    ).toBeUndefined()
    expect(
      authenticateMiniAppInitData(
        signedInitData({ ...validValues, auth_date: String(NOW + 31) }),
        BOT_TOKEN,
        NOW
      )
    ).toBeUndefined()
  })

  it.each([
    { auth_date: String(NOW), query_id: 'query' },
    { user: validValues.user, query_id: 'query' },
    { auth_date: 'not-a-date', user: validValues.user },
    { auth_date: String(NOW), user: '{broken' },
    { auth_date: String(NOW), user: JSON.stringify({ first_name: 'No id' }) }
  ])('rejects missing or malformed fields: %o', values => {
    expect(authenticateMiniAppInitData(signedInitData(values), BOT_TOKEN, NOW)).toBeUndefined()
  })

  it('rejects init data larger than the authentication limit before verification', () => {
    const oversized = signedInitData({ ...validValues, query_id: 'x'.repeat(17 * 1024) })

    expect(authenticateMiniAppInitData(oversized, BOT_TOKEN, NOW)).toBeUndefined()
  })

  it('rejects missing init data', () => {
    expect(authenticateMiniAppInitData('', BOT_TOKEN, NOW)).toBeUndefined()
  })
})

export { BOT_TOKEN, NOW, signedInitData }
