import { Context } from 'effect'
import type { Effect, Layer } from 'effect'
import type { KlipyConfigError, KlipyOperationError } from './errors'
import type { KlipyResponse } from './schemas'

export type KlipyRequest = {
  readonly customerId: string
  readonly page: number
}

export type KlipySearchRequest = KlipyRequest & {
  readonly query: string
}

export type KlipyShape = {
  readonly search: (
    request: KlipySearchRequest
  ) => Effect.Effect<KlipyResponse, KlipyOperationError>
  readonly trending: (request: KlipyRequest) => Effect.Effect<KlipyResponse, KlipyOperationError>
}

export class Klipy extends Context.Service<Klipy, KlipyShape>()('@telegram-gif-bot/Klipy') {
  static Live: Layer.Layer<Klipy, KlipyConfigError>
}
