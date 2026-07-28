import { Effect, Schema } from 'effect'
import { TelegramUpdate } from '@/telegram/schemas'
import { WebhookRequestError } from './errors'

export const parseTelegramUpdate = (request: Request) =>
  Effect.tryPromise({
    try: () => request.json(),
    catch: cause => new WebhookRequestError({ message: 'Invalid JSON body', cause })
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(TelegramUpdate)),
    Effect.mapError(error =>
      error instanceof WebhookRequestError
        ? error
        : new WebhookRequestError({ message: 'Invalid Telegram update', cause: error })
    )
  )
