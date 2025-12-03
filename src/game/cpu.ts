import { canComboBeatField, comparisonDirection, enumerateCombos } from './engine'
import type { GameState, PlayerAction, PlayerState } from './types'

export function decideCpuAction(state: GameState, player: PlayerState): PlayerAction {
  const combos = enumerateCombos(player.hand, state.rules)
  const playable = combos.filter(combo => canComboBeatField(state, combo))

  if (playable.length === 0) {
    return { type: 'pass', playerId: player.id }
  }

  const direction = comparisonDirection(state.field)

  playable.sort((a, b) => {
    if (state.field.combo) {
      if (direction >= 0) {
        return a.strength - b.strength
      }
      return b.strength - a.strength
    }
    if (a.length === b.length) {
      return a.strength - b.strength
    }
    return a.length - b.length
  })

  const chosen = playable[0]
  return {
    type: 'play',
    playerId: player.id,
    cardIds: chosen.cards.map(card => card.id),
  }
}
