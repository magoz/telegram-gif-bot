# telegram-gif-bot

Telegram inline GIF bot backed by [KLIPY](https://klipy.com/). Type `@your_bot cats` in
any Telegram chat, browse results, then send one.

## Stack

- TypeScript 6
- Effect 4
- Bun
- Vercel Functions using the Bun runtime
- Oxlint + type-aware tsgolint
- Oxfmt
- Vitest + `@effect/vitest`

No frontend, framework, or database.

## Setup

### 1. Create the Telegram bot

In [@BotFather](https://t.me/BotFather):

1. Run `/newbot` and choose an available username ending in `bot`.
2. Run `/setinline`, select the bot, and use the required placeholder `Search KLIPY`.
3. Save the bot token locally as `TELEGRAM_BOT_TOKEN`.

### 2. Create a KLIPY API key

Create a platform in the [KLIPY Partner Panel](https://partner.klipy.com/) and save its key as
`KLIPY_API_KEY`. Testing keys permit 100 requests/hour. Request production access before launch.

Configure the desired content filtering in KLIPY's dashboard. The API client also requests the
`high` content-filter level.

### 3. Configure the environment

```sh
cp .env.example .env.local
```

Generate a webhook secret containing only letters, digits, `_`, and `-`:

```sh
openssl rand -hex 32
```

Fill in:

```dotenv
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
KLIPY_API_KEY=...
```

### 4. Run locally

```sh
bun install
bun run dev
```

The webhook listens at `http://localhost:3000/api/telegram`. Telegram needs a public HTTPS URL;
use a tunnel for end-to-end local testing or deploy to Vercel.

## Deploy

Create a Vercel project from this repository and add all three environment variables. The checked-in
`vercel.json` selects the framework-free Bun runtime. `bun install` bundles the Effect entrypoint
into `api/telegram.js`, avoiding Vercel Bun's ESM linker issue with Effect's module graph.

After deploying, register the production webhook. Replace placeholders without committing secrets:

```sh
curl --fail-with-body \
  --request POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --header 'content-type: application/json' \
  --data "{
    \"url\": \"https://YOUR_DOMAIN/api/telegram\",
    \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\", \"inline_query\"],
    \"drop_pending_updates\": true
  }"
```

Verify it:

```sh
curl --fail-with-body \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Then type `@your_bot cats` in any Telegram chat.

Sending `/start` directly to the bot returns a **Search GIFs** button that opens inline mode in the
current chat.

## Commands

```sh
bun run dev           # local server with watch mode
bun run check         # types, lint, formatting, tests
bun run test:watch    # watch tests
bun run format        # format with Oxfmt
```

## Request flow

```text
Telegram inline query
  -> POST /api/telegram
  -> verify Telegram secret header
  -> decode update with Effect Schema
  -> KLIPY search, or trending for an empty query
  -> map the smallest actual GIF + a static JPEG thumbnail
  -> Telegram answerInlineQuery
```

Telegram offsets map to KLIPY page numbers. Answers contain up to 50 results and expose the next page only
when KLIPY reports one. During the Telegram macOS stability experiment, answers are not cached and
use KLIPY's `xs.gif` rendition instead of provider MP4s to exercise Telegram's actual-GIF ingestion
path. Local testing on Telegram for macOS 12.9 has shown no crashes with either 8 or 50 `xs.gif`
results, whereas the previous remote-MP4 payload crashed at both 24 and 8 results. A follow-up with
50 larger `sm.gif` results also crashed; despite the static JPEG thumbnail, the gallery tiles moved,
confirming that Telegram fetches `gif_url` for animated previews. See
[`docs/research/telegram-macos-inline-media-crash.md`](docs/research/telegram-macos-inline-media-crash.md)
for the evidence and experiment history.

### Controlled crash experiments

Normal searches always use the confirmed-stable `xs.gif` rendition. A diagnostic query can select a
fixed subset from the first KLIPY page without changing the normal bot behavior:

```text
!test <xs|sm> <start> <count> <search query>
```

For example, `!test sm 1 1 cats` returns only the first `cats` result using `sm.gif`, while
`!test xs 1 1 cats` returns the same item using `xs.gif`. `start` and `count` are 1-based, bounded to
the first 50 results, and diagnostic answers never paginate. Each diagnostic result receives a fresh
rendition-specific ID, and the server logs its KLIPY ID, URL, dimensions, and byte size.

These commands are intentionally capable of reproducing the Telegram macOS crash. Begin with one
result and increase geometrically only after each previous case is stable. Controlled testing found
that two exact `sm.gif` URL sets crashed when newly introduced media were fetched, then worked
unchanged after those URLs had loaded independently. This rules out a deterministic file, count, or
simple byte/frame/pixel threshold and identifies Telegram Mac's concurrent cold `MediaBox` fetch/cache
path as the practical trigger. Normal searches remain on `xs.gif` because that rendition has stayed
stable even with 50 results.
