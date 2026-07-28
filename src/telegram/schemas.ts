import { Schema } from 'effect'

const TelegramUser = Schema.Struct({
  id: Schema.Number,
  language_code: Schema.optionalKey(Schema.String)
})

export const TelegramInlineQuery = Schema.Struct({
  id: Schema.String,
  from: TelegramUser,
  query: Schema.String,
  offset: Schema.String
})

export type TelegramInlineQuery = typeof TelegramInlineQuery.Type

export const TelegramUpdate = Schema.Struct({
  update_id: Schema.Number,
  inline_query: Schema.optionalKey(TelegramInlineQuery)
})

export type TelegramUpdate = typeof TelegramUpdate.Type

export const TelegramInlineResult = Schema.Struct({
  type: Schema.Literal('mpeg4_gif'),
  id: Schema.String,
  mpeg4_url: Schema.String,
  mpeg4_width: Schema.Number,
  mpeg4_height: Schema.Number,
  thumbnail_url: Schema.String,
  thumbnail_mime_type: Schema.Literal('image/jpeg'),
  title: Schema.String
})

export type TelegramInlineResult = typeof TelegramInlineResult.Type

export const TelegramInlineAnswer = Schema.Struct({
  inline_query_id: Schema.String,
  results: Schema.Array(TelegramInlineResult),
  cache_time: Schema.Number,
  is_personal: Schema.Boolean,
  next_offset: Schema.String
})

export type TelegramInlineAnswer = typeof TelegramInlineAnswer.Type

export const TelegramApiSuccess = Schema.Struct({
  ok: Schema.Literal(true)
})
