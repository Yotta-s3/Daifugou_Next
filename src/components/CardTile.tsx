import type { Card } from '../game/types'

interface CardTileProps {
  card: Card
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function CardTile({ card, selected, disabled, onClick }: CardTileProps) {
  return (
    <button
      type="button"
      className={`card-tile ${card.suit} ${selected ? 'selected' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span>{card.label}</span>
    </button>
  )
}
