export type Suit = 'spade' | 'heart' | 'diamond' | 'club'

export type ComboType = 'single' | 'pair' | 'triple' | 'quad' | 'sequence'

export interface Card {
  id: string
  suit: Suit | 'joker'
  rank: number
  label: string
}

export interface Combo {
  type: ComboType
  cards: Card[]
  strength: number
  length: number
  suitConstraint: Suit | null
}

export interface PlayerState {
  id: string
  name: string
  seat: number
  isHuman: boolean
  hand: Card[]
  finished: boolean
  finishOrder?: number
}

export interface FieldState {
  combo: Combo | null
  ownerId: string | null
  shibariSuit: Suit | null
  isRevolution: boolean
  isElevenBack: boolean
  consecutiveSuit: Suit | null
  consecutiveCount: number
}

export interface RuleSettings {
  shibari: boolean
  enableSequences: boolean
  revolution: boolean
  eightCut: boolean
  elevenBack: boolean
  jokerCount: number
  humanSeats: number
  sevenExchange: boolean
  tenDiscard: boolean
  queenBomber: boolean
}

export interface GameState {
  players: PlayerState[]
  currentPlayerId: string
  field: FieldState
  passesInRow: number
  log: string[]
  winners: string[]
  phase: 'playing' | 'finished'
  rules: RuleSettings
  pendingEffects: PendingEffect[]
}

export type PlayerAction =
  | { type: 'play'; playerId: string; cardIds: string[] }
  | { type: 'pass'; playerId: string }

export interface GameConfig {
  humanName?: string
  cpuNames?: string[]
  rules?: Partial<RuleSettings>
}

export type PendingEffect =
  | {
      type: 'sevenGive'
      ownerId: string
      targetId: string
      remaining: number
    }
  | {
      type: 'tenDiscard'
      ownerId: string
      remaining: number
    }
  | {
      type: 'queenBomb'
      ownerId: string
      remaining: number
    }

export type EffectResolution =
  | { type: 'skip'; playerId: string }
  | { type: 'sevenGive'; playerId: string; cardIds: string[] }
  | { type: 'tenDiscard'; playerId: string; cardIds: string[] }
  | { type: 'queenBomb'; playerId: string; ranks: number[] }
