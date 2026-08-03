import { assert, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { Klipy } from '@/klipy/service'
import type { KlipyShape } from '@/klipy/service'
import { Telegram } from '@/telegram/service'
import type { TelegramShape } from '@/telegram/service'
import { handleRequest, isStartCommand } from './handle-request'

it('recognizes private and addressed start commands', () => {
  assert.strictEqual(isStartCommand('/start'), true)
  assert.strictEqual(isStartCommand('/start payload'), true)
  assert.strictEqual(isStartCommand('/start@gifklipybot'), true)
  assert.strictEqual(isStartCommand('/starter'), false)
  assert.strictEqual(isStartCommand(undefined), false)
})

it.effect('answers a start command with the search launcher', () => {
  let startChatId: number | undefined

  const telegram: TelegramShape = {
    authenticateWebhook: secret => secret === 'test-secret',
    authenticateMiniApp: () => ({ userId: 42 }),
    answerInlineQuery: () => Effect.die(new Error('Unexpected inline answer')),
    sendStartMessage: chatId => {
      startChatId = chatId
      return Effect.void
    }
  }
  const klipy: KlipyShape = {
    search: () => Effect.die(new Error('Unexpected search')),
    trending: () => Effect.die(new Error('Unexpected trending request'))
  }
  const TestLayer = Layer.merge(Layer.succeed(Klipy, klipy), Layer.succeed(Telegram, telegram))
  const request = new Request('https://example.com/api/telegram', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': 'test-secret'
    },
    body: JSON.stringify({
      update_id: 1,
      message: { message_id: 2, chat: { id: 42 }, text: '/start' }
    })
  })

  return Effect.gen(function* () {
    const response = yield* handleRequest(request)

    assert.strictEqual(response.status, 200)
    assert.strictEqual(startChatId, 42)
  }).pipe(Effect.provide(TestLayer))
})
