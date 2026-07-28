import { Schema } from 'effect'

export class TelegramConfigError extends Schema.TaggedErrorClass<TelegramConfigError>()(
  'TelegramConfigError',
  { message: Schema.String }
) {}

export class TelegramOperationError extends Schema.TaggedErrorClass<TelegramOperationError>()(
  'TelegramOperationError',
  { message: Schema.String, cause: Schema.optionalKey(Schema.Unknown) }
) {}
