import type { Card, Combo, FieldState, GameState, PendingEffect, PlayerState } from './types'
import { RANK_LABEL, SUIT_SYMBOL } from './constants'

export interface SerializedCard {
  id: string
  suit: Card['suit']
  rank: number
}

export interface SerializedCombo {
  type: Combo['type']
  strength: number
  length: number
  suitConstraint: Combo['suitConstraint']
  cards: SerializedCard[]
}

export interface SerializedPlayer {
  id: string
  name: string
  seat: number
  isHuman: boolean
  finished: boolean
  finishOrder?: number
  hand: SerializedCard[]
}

export interface SerializedFieldState {
  combo: SerializedCombo | null
  ownerId: string | null
  shibariSuit: FieldState['shibariSuit']
  isRevolution: boolean
  isElevenBack: boolean
  consecutiveSuit: FieldState['consecutiveSuit']
  consecutiveCount: number
}

export interface GameSnapshot {
  players: SerializedPlayer[]
  currentPlayerId: string
  field: SerializedFieldState
  passesInRow: number
  log: string[]
  winners: string[]
  phase: GameState['phase']
  rules: GameState['rules']
  pendingEffects: PendingEffect[]
  timestamp: number
}

export function serializeGameState(state: GameState): GameSnapshot {
  return {
    players: state.players.map(serializePlayer),
    currentPlayerId: state.currentPlayerId,
    field: serializeFieldState(state.field),
    passesInRow: state.passesInRow,
    log: [...state.log],
    winners: [...state.winners],
    phase: state.phase,
    rules: { ...state.rules },
    pendingEffects: state.pendingEffects.map(effect => ({ ...effect })),
    timestamp: Date.now(),
  }
}

export function hydrateGameState(snapshot: GameSnapshot): GameState {
  return {
    players: snapshot.players.map(hydratePlayer),
    currentPlayerId: snapshot.currentPlayerId,
    field: hydrateFieldState(snapshot.field),
    passesInRow: snapshot.passesInRow,
    log: [...snapshot.log],
    winners: [...snapshot.winners],
    phase: snapshot.phase,
    rules: { ...snapshot.rules },
    pendingEffects: snapshot.pendingEffects.map(effect => ({ ...effect })),
  }
}

function serializePlayer(player: PlayerState): SerializedPlayer {
  return {
    id: player.id,
    name: player.name,
    seat: player.seat,
    isHuman: player.isHuman,
    finished: player.finished,
    finishOrder: player.finishOrder,
    hand: player.hand.map(serializeCard),
  }
}

function hydratePlayer(player: SerializedPlayer): PlayerState {
  return {
    id: player.id,
    name: player.name,
    seat: player.seat,
    isHuman: player.isHuman,
    finished: player.finished,
    finishOrder: player.finishOrder,
    hand: player.hand.map(hydrateCard),
  }
}

function serializeFieldState(field: FieldState): SerializedFieldState {
  return {
    combo: field.combo ? serializeCombo(field.combo) : null,
    ownerId: field.ownerId,
    shibariSuit: field.shibariSuit,
    isRevolution: field.isRevolution,
    isElevenBack: field.isElevenBack,
    consecutiveSuit: field.consecutiveSuit,
    consecutiveCount: field.consecutiveCount,
  }
}

function hydrateFieldState(field: SerializedFieldState): FieldState {
  return {
    combo: field.combo ? hydrateCombo(field.combo) : null,
    ownerId: field.ownerId,
    shibariSuit: field.shibariSuit,
    isRevolution: field.isRevolution,
    isElevenBack: field.isElevenBack,
    consecutiveSuit: field.consecutiveSuit,
    consecutiveCount: field.consecutiveCount,
  }
}

function serializeCombo(combo: Combo): SerializedCombo {
  return {
    type: combo.type,
    strength: combo.strength,
    length: combo.length,
    suitConstraint: combo.suitConstraint,
    cards: combo.cards.map(serializeCard),
  }
}

function hydrateCombo(combo: SerializedCombo): Combo {
  return {
    type: combo.type,
    strength: combo.strength,
    length: combo.length,
    suitConstraint: combo.suitConstraint,
    cards: combo.cards.map(hydrateCard),
  }
}

function serializeCard(card: Card): SerializedCard {
  return {
    id: card.id,
    suit: card.suit,
    rank: card.rank,
  }
}

function hydrateCard(card: SerializedCard): Card {
  return {
    id: card.id,
    suit: card.suit,
    rank: card.rank,
    label: card.suit === 'joker' ? 'Joker' : `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`,
  }
}

function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank)
}
