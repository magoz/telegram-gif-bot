import { Schema } from 'effect'

export class GalleryRequestError extends Schema.TaggedErrorClass<GalleryRequestError>()(
  'GalleryRequestError',
  { message: Schema.String, cause: Schema.optionalKey(Schema.Unknown) }
) {}

export class GalleryPayloadTooLargeError extends Schema.TaggedErrorClass<GalleryPayloadTooLargeError>()(
  'GalleryPayloadTooLargeError',
  { message: Schema.String }
) {}
