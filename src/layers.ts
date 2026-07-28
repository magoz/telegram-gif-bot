import { Layer } from 'effect'
import { KlipyLive } from '@/klipy/live-layer'
import { TelegramLive } from '@/telegram/live-layer'

export const AppLayer = Layer.merge(KlipyLive, TelegramLive)
