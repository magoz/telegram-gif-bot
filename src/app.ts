import { Effect } from 'effect'
import { AppLayer } from './layers'
import { handleRequest } from './webhook/handle-request'

const internalError = (error: unknown) =>
  Effect.logError('Webhook request failed', { error }).pipe(
    Effect.as(Response.json({ error: 'Internal server error' }, { status: 500 }))
  )

export const app = (request: Request): Promise<Response> =>
  handleRequest(request).pipe(
    Effect.catchTag('WebhookRequestError', error =>
      Effect.logWarning(error.message).pipe(
        Effect.as(Response.json({ error: error.message }, { status: 400 }))
      )
    ),
    Effect.provide(AppLayer),
    Effect.catch(internalError),
    Effect.runPromise
  )
