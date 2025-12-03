import type { GameSnapshot } from './model'
import type { PlayerAction, EffectResolution } from './types'

export type ServerEvent =
  | { type: 'room:created'; roomId: string }
  | { type: 'room:joined'; roomId: string; playerId: string }
  | { type: 'state:update'; roomId: string; snapshot: GameSnapshot }
  | { type: 'state:patch'; roomId: string; diff: Partial<GameSnapshot>; sequence: number }
  | { type: 'error'; roomId?: string; code: string; message: string }

export type ClientEvent =
  | { type: 'room:create'; payload: { humanName: string; rulesOverride?: Record<string, unknown> } }
  | { type: 'room:join'; payload: { roomId: string; playerName: string } }
  | { type: 'action:submit'; payload: { roomId: string; action: PlayerAction } }
  | { type: 'effect:resolve'; payload: { roomId: string; resolution: EffectResolution } }
  | { type: 'state:ack'; payload: { roomId: string; sequence: number } }

export interface Envelope<T> {
  event: T
  correlationId?: string
  timestamp: number
}

export function wrapEvent<T>(event: T, correlationId?: string): Envelope<T> {
  return {
    event,
    correlationId,
    timestamp: Date.now(),
  }
}
