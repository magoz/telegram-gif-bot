import { Schema } from 'effect'

const KlipyMedia = Schema.Struct({
  url: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
  size: Schema.Number
})

const KlipyGifVariant = Schema.Struct({ gif: KlipyMedia })
const KlipyThumbnailVariant = Schema.Struct({ jpg: KlipyMedia })

export const KlipyGif = Schema.Struct({
  id: Schema.Union([Schema.Number, Schema.String]),
  slug: Schema.String,
  title: Schema.String,
  file: Schema.Struct({
    xs: KlipyGifVariant,
    sm: KlipyThumbnailVariant
  })
})

export type KlipyGif = typeof KlipyGif.Type

export const KlipyResponse = Schema.Struct({
  result: Schema.Literal(true),
  data: Schema.Struct({
    data: Schema.Array(KlipyGif),
    current_page: Schema.Number,
    per_page: Schema.Number,
    has_next: Schema.Boolean
  })
})

export type KlipyResponse = typeof KlipyResponse.Type
