import { Config, Effect, Layer, Redacted } from 'effect'
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse
} from 'effect/unstable/http'
import { KlipyConfigError, KlipyOperationError } from './errors'
import { Klipy, type KlipyRequest, type KlipySearchRequest } from './service'
import { KlipyResponse } from './schemas'

const KLIPY_API_BASE_URL = 'https://api.klipy.com/api/v1'
const RESULTS_PER_PAGE = 8
const CONTENT_FILTER = 'high'
const FORMAT_FILTER = 'gif,jpg'

const configSecret = (name: string) =>
  Config.redacted(name).pipe(
    Effect.mapError(() => new KlipyConfigError({ message: `${name} not found` }))
  )

const make = Effect.gen(function* () {
  const apiKey = Redacted.value(yield* configSecret('KLIPY_API_KEY'))
  const httpClient = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)

  const request = (path: 'search' | 'trending', input: KlipyRequest, query?: string) => {
    const endpoint = `${KLIPY_API_BASE_URL}/${encodeURIComponent(apiKey)}/gifs/${path}`
    const baseRequest = HttpClientRequest.get(endpoint).pipe(
      HttpClientRequest.setUrlParams({
        page: String(input.page),
        per_page: String(RESULTS_PER_PAGE),
        customer_id: input.customerId,
        content_filter: CONTENT_FILTER,
        format_filter: FORMAT_FILTER
      })
    )
    const httpRequest =
      query === undefined
        ? baseRequest
        : baseRequest.pipe(HttpClientRequest.setUrlParam('q', query))

    return httpClient.execute(httpRequest).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(KlipyResponse)),
      Effect.timeout('4 seconds'),
      Effect.mapError(() => new KlipyOperationError({ message: `KLIPY ${path} request failed` }))
    )
  }

  const search = (input: KlipySearchRequest) => request('search', input, input.query)
  const trending = (input: KlipyRequest) => request('trending', input)

  return Klipy.of({ search, trending })
})

export const KlipyLive = Layer.effect(Klipy, make).pipe(Layer.provide(FetchHttpClient.layer))

Klipy.Live = KlipyLive
