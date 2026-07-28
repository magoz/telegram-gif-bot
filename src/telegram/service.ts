import { Context } from 'effect'
import type { Effect, Layer } from 'effect'
import type { TelegramConfigError, TelegramOperationError } from './errors'
import type { TelegramInlineAnswer } from './schemas'

export type TelegramShape = {
  readonly authenticateWebhook: (secret: string | null) => boolean
  readonly sendStartMessage: (chatId: number) => Effect.Effect<void, TelegramOperationError>
  readonly answerInlineQuery: (
    answer: TelegramInlineAnswer
  ) => Effect.Effect<void, TelegramOperationError>
}

export class Telegram extends Context.Service<Telegram, TelegramShape>()('@givf/Telegram') {
  static Live: Layer.Layer<Telegram, TelegramConfigError>
}
