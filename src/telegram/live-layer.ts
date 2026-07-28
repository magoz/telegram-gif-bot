import { Config, Effect, Layer, Redacted } from 'effect'
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse
} from 'effect/unstable/http'
import { TelegramConfigError, TelegramOperationError } from './errors'
import { Telegram, type TelegramShape } from './service'
import { TelegramApiSuccess, TelegramInlineAnswer } from './schemas'

const configSecret = (name: string) =>
  Config.redacted(name).pipe(
    Effect.mapError(() => new TelegramConfigError({ message: `${name} not found` }))
  )

const make = Effect.gen(function* () {
  const botToken = Redacted.value(yield* configSecret('TELEGRAM_BOT_TOKEN'))
  const webhookSecret = Redacted.value(yield* configSecret('TELEGRAM_WEBHOOK_SECRET'))
  const httpClient = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
  const endpoint = `https://api.telegram.org/bot${botToken}/answerInlineQuery`
  const encodeAnswer = HttpClientRequest.schemaBodyJson(TelegramInlineAnswer)

  const authenticateWebhook: TelegramShape['authenticateWebhook'] = secret =>
    secret !== null && secret === webhookSecret

  const answerInlineQuery: TelegramShape['answerInlineQuery'] = answer =>
    HttpClientRequest.post(endpoint).pipe(
      encodeAnswer(answer),
      Effect.flatMap(httpClient.execute),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(TelegramApiSuccess)),
      Effect.timeout('4 seconds'),
      Effect.asVoid,
      Effect.mapError(
        error =>
          new TelegramOperationError({ message: 'Telegram answerInlineQuery failed', cause: error })
      )
    )

  return Telegram.of({ authenticateWebhook, answerInlineQuery })
})

export const TelegramLive = Layer.effect(Telegram, make).pipe(Layer.provide(FetchHttpClient.layer))

Telegram.Live = TelegramLive
