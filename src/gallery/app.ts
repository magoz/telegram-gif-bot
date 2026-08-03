import { Effect } from 'effect'
import { AppLayer } from '@/layers'
import { handleGalleryRequest } from './handle-request'

const errorResponse = (message: string, status: number) =>
  Response.json(
    { error: message },
    {
      status,
      headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    }
  )

const internalError = (error: unknown) =>
  Effect.logError('Gallery request failed', { error }).pipe(
    Effect.as(errorResponse('Internal server error', 500))
  )

export const galleryApp = (request: Request): Promise<Response> =>
  handleGalleryRequest(request).pipe(
    Effect.catchTag('GalleryRequestError', error =>
      Effect.succeed(errorResponse(error.message, 400))
    ),
    Effect.provide(AppLayer),
    Effect.catch(internalError),
    Effect.runPromise
  )
