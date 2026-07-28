import { Schema } from 'effect'

export class WebhookRequestError extends Schema.TaggedErrorClass<WebhookRequestError>()(
  'WebhookRequestError',
  { message: Schema.String, cause: Schema.optionalKey(Schema.Unknown) }
) {}
