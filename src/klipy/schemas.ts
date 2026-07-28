import { Schema } from 'effect'

const KlipyMedia = Schema.Struct({
  url: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
  size: Schema.Number
})

const KlipyFileVariant = Schema.Struct({
  mp4: KlipyMedia,
  jpg: KlipyMedia
})

export const KlipyGif = Schema.Struct({
  id: Schema.Union([Schema.Number, Schema.String]),
  slug: Schema.String,
  title: Schema.String,
  file: Schema.Struct({
    hd: KlipyFileVariant,
    sm: KlipyFileVariant
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
