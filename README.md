# telegram-gif-bot

Telegram inline GIF bot backed by [KLIPY](https://klipy.com/). Type `@your_bot cats` in
any Telegram chat, open the animated Mini App gallery, then send one.

## Stack

- TypeScript 6
- Effect 4
- Bun
- Vercel Functions using the Bun runtime
- Oxlint + type-aware tsgolint
- Oxfmt
- Vitest + `@effect/vitest`

No frontend framework or database.

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

The webhook listens at `http://localhost:3000/api/telegram` and the gallery at
`http://localhost:3000/api/gallery`. Telegram needs a public HTTPS URL and valid Mini App launch
data for end-to-end testing; use a tunnel or deploy to Vercel.

## Deploy

Create a Vercel project from this repository and add all three environment variables. The checked-in
`vercel.json` selects the framework-free Bun runtime. `bun install` bundles the webhook and gallery
entrypoints into `api/telegram.js` and `api/gallery.js`, avoiding Vercel Bun's ESM linker issue with
Effect's module graph. In production, rate-limit `POST /api/gallery` at the Vercel or edge layer,
keyed by authenticated user and/or source address as available.

After deploying, enable the Mini App in [@BotFather](https://t.me/BotFather): **My Bots → select the
bot → Bot Settings → Configure Mini App → Enable Mini App**. Accept Telegram's terms and configure
`https://YOUR_DOMAIN/api/gallery` as the Mini App URL.

Then register the production webhook. Replace placeholders without committing secrets:

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

Then type `@your_bot cats` in any Telegram chat. Telegram shows an **Open Gallery** button instead
of loading a native animated grid. Select a GIF in the gallery, then tap the sole inline result to
send it as a native embedded GIF. Telegram requires this final confirmation tap for inline-mode Mini
Apps.

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
  -> answer with an Open Gallery Mini App button and no media
  -> GET /api/gallery renders the animated WebView gallery
  -> authenticated POST /api/gallery searches KLIPY
  -> selected item returns to inline mode as a compact query/page/id locator
  -> bot re-fetches that KLIPY page and returns only the matching MPEG-4 GIF
  -> user taps the sole result to send the native embedded GIF
```

The gallery validates Telegram's signed, short-lived Mini App initialization data before proxying
KLIPY searches, so API keys remain server-side. It lazy-loads small MP4 previews and pauses off-screen
videos. The final locator contains no media URL and needs no database: the webhook re-resolves and
ID-filters the selected provider result before sending it to Telegram.
