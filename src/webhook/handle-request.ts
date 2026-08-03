import { Effect } from 'effect'
import { handleInlineQuery } from '@/inline-query/handle-inline-query'
import { Telegram } from '@/telegram/service'
import { parseTelegramUpdate } from './parse-update'

const SECRET_HEADER = 'x-telegram-bot-api-secret-token'

export const isStartCommand = (text: string | undefined): boolean =>
  text !== undefined && /^\/start(?:@[a-z0-9_]+)?(?:\s|$)/i.test(text)

const jsonResponse = (body: object, status: number): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export const handleRequest = (request: Request) => {
  if (request.method === 'GET') return Effect.succeed(jsonResponse({ ok: true }, 200))
  if (request.method !== 'POST')
    return Effect.succeed(jsonResponse({ error: 'Method not allowed' }, 405))

  return Effect.gen(function* () {
    const telegram = yield* Telegram
    const secret = request.headers.get(SECRET_HEADER)

    if (!telegram.authenticateWebhook(secret)) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const update = yield* parseTelegramUpdate(request)

    if (update.inline_query !== undefined) {
      yield* handleInlineQuery(update.inline_query)
    }

    if (update.message !== undefined) {
      if (isStartCommand(update.message.text)) {
        yield* telegram.sendStartMessage(update.message.chat.id)
      }

      if (update.message.animation !== undefined) {
        yield* Effect.logInfo('Telegram cached animation candidate', {
          chatId: update.message.chat.id,
          messageId: update.message.message_id,
          ...update.message.animation
        })
      }
    }

    return jsonResponse({ ok: true }, 200)
  }).pipe(Effect.withSpan('telegram.webhook'))
}
