import { createHmac, timingSafeEqual } from 'node:crypto'
import { Option, Schema } from 'effect'

const MAX_AUTH_AGE_SECONDS = 5 * 60
const MAX_FUTURE_SKEW_SECONDS = 30
const MAX_INIT_DATA_BYTES = 16 * 1024

const MiniAppUser = Schema.Struct({ id: Schema.Number })

export type TelegramMiniAppSession = {
  readonly userId: number
}

const validHash = (actual: string, expected: Buffer): boolean => {
  if (!/^[a-f\d]{64}$/i.test(actual)) return false
  const actualBuffer = Buffer.from(actual, 'hex')
  return actualBuffer.length === expected.length && timingSafeEqual(actualBuffer, expected)
}

export const authenticateMiniAppInitData = (
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): TelegramMiniAppSession | undefined => {
  if (
    initData.length === 0 ||
    Buffer.byteLength(initData, 'utf8') > MAX_INIT_DATA_BYTES ||
    botToken.length === 0
  ) {
    return undefined
  }

  const parameters = new URLSearchParams(initData)
  const hash = parameters.get('hash')
  const authDateValue = parameters.get('auth_date')
  const userValue = parameters.get('user')
  if (hash === null || authDateValue === null || userValue === null) return undefined

  const dataCheckString = [...parameters.entries()]
    .filter(([key]) => key !== 'hash')
    .map(([key, value]) => `${key}=${value}`)
    .toSorted()
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest()
  if (!validHash(hash, expectedHash)) return undefined

  if (!/^\d+$/.test(authDateValue)) return undefined
  const authDate = Number(authDateValue)
  if (
    !Number.isSafeInteger(authDate) ||
    nowSeconds - authDate > MAX_AUTH_AGE_SECONDS ||
    authDate - nowSeconds > MAX_FUTURE_SKEW_SECONDS
  ) {
    return undefined
  }

  let parsedUser: unknown
  try {
    parsedUser = JSON.parse(userValue)
  } catch {
    return undefined
  }

  const user = Option.getOrUndefined(Schema.decodeUnknownOption(MiniAppUser)(parsedUser))
  if (user === undefined || !Number.isSafeInteger(user.id)) return undefined

  return { userId: user.id }
}
