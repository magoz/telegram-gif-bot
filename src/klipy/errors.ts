import { Schema } from 'effect'

export class KlipyConfigError extends Schema.TaggedErrorClass<KlipyConfigError>()(
  'KlipyConfigError',
  { message: Schema.String }
) {}

export class KlipyOperationError extends Schema.TaggedErrorClass<KlipyOperationError>()(
  'KlipyOperationError',
  { message: Schema.String, cause: Schema.optionalKey(Schema.Unknown) }
) {}
