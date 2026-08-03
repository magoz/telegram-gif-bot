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

Telegram offsets map to KLIPY page numbers. Answers contain 8 results and expose the next page only
when KLIPY reports one. During the Telegram macOS stability experiment, answers are not cached and
use KLIPY's `xs.gif` rendition instead of provider MP4s to exercise Telegram's actual-GIF ingestion
path.
