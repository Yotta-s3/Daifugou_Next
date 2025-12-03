import { applyAction, createGameState, resolvePendingEffect } from '../game/engine'
import type { PlayerAction, EffectResolution, GameState } from '../game/types'
import type { AppConfig } from '../types/app'
import { serializeGameState, type GameSnapshot } from '../game/model'

type Listener = (snapshot: GameSnapshot) => void

export interface MockServerConnection {
  subscribe(listener: Listener): () => void
  submitAction(action: PlayerAction): void
  resolveEffect(resolution: EffectResolution): void
  restart(nextConfig?: AppConfig): void
  getSnapshot(): GameSnapshot
}

export function createMockServer(config: AppConfig): MockServerConnection {
  let currentConfig: AppConfig = { ...config }
  let state: GameState = createGameState({ humanName: currentConfig.humanName, rules: currentConfig.rules })
  let snapshot: GameSnapshot = serializeGameState(state)
  const listeners = new Set<Listener>()

  const emit = () => {
    snapshot = serializeGameState(state)
    listeners.forEach(listener => listener(snapshot))
  }

  return {
    subscribe(listener: Listener) {
      listeners.add(listener)
      listener(snapshot)
      return () => listeners.delete(listener)
    },
    submitAction(action: PlayerAction) {
      state = applyAction(state, action)
      emit()
    },
    resolveEffect(resolution: EffectResolution) {
      state = resolvePendingEffect(state, resolution)
      emit()
    },
    restart(nextConfig?: AppConfig) {
      currentConfig = nextConfig ? { ...nextConfig } : currentConfig
      state = createGameState({ humanName: currentConfig.humanName, rules: currentConfig.rules })
      emit()
    },
    getSnapshot() {
      return snapshot
    },
  }
}
