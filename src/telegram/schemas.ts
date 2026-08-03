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

const TelegramAnimation = Schema.Struct({
  file_id: Schema.String,
  file_unique_id: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
  duration: Schema.Number,
  file_size: Schema.optionalKey(Schema.Number)
})

const TelegramMessage = Schema.Struct({
  message_id: Schema.Number,
  chat: Schema.Struct({ id: Schema.Number }),
  text: Schema.optionalKey(Schema.String),
  animation: Schema.optionalKey(TelegramAnimation)
})

export const TelegramUpdate = Schema.Struct({
  update_id: Schema.Number,
  inline_query: Schema.optionalKey(TelegramInlineQuery),
  message: Schema.optionalKey(TelegramMessage)
})

export type TelegramUpdate = typeof TelegramUpdate.Type

const TelegramRemoteGifInlineResult = Schema.Struct({
  type: Schema.Literal('gif'),
  id: Schema.String,
  gif_url: Schema.String,
  gif_width: Schema.Number,
  gif_height: Schema.Number,
  thumbnail_url: Schema.String,
  thumbnail_mime_type: Schema.Literal('image/jpeg'),
  title: Schema.String
})

export type TelegramRemoteGifInlineResult = typeof TelegramRemoteGifInlineResult.Type

const TelegramCachedGifInlineResult = Schema.Struct({
  type: Schema.Literal('gif'),
  id: Schema.String,
  gif_file_id: Schema.String,
  title: Schema.String
})

export const TelegramInlineResult = Schema.Union([
  TelegramRemoteGifInlineResult,
  TelegramCachedGifInlineResult
])

export type TelegramInlineResult = typeof TelegramInlineResult.Type

export const TelegramInlineAnswer = Schema.Struct({
  inline_query_id: Schema.String,
  results: Schema.Array(TelegramInlineResult),
  cache_time: Schema.Number,
  is_personal: Schema.Boolean,
  next_offset: Schema.String
})

export type TelegramInlineAnswer = typeof TelegramInlineAnswer.Type

export const TelegramStartMessage = Schema.Struct({
  chat_id: Schema.Number,
  text: Schema.String,
  reply_markup: Schema.Struct({
    inline_keyboard: Schema.Array(
      Schema.Array(
        Schema.Struct({
          text: Schema.String,
          switch_inline_query_current_chat: Schema.Literal('')
        })
      )
    )
  })
})

export type TelegramStartMessage = typeof TelegramStartMessage.Type

export const TelegramApiSuccess = Schema.Struct({
  ok: Schema.Literal(true)
})
