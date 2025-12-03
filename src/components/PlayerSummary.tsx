import type { PlayerState } from '../game/types'

interface PlayerSummaryProps {
  player: PlayerState
  isCurrent: boolean
  color: string
}

export function PlayerSummary({ player, isCurrent, color }: PlayerSummaryProps) {
  return (
    <div className={`player-summary ${isCurrent ? 'active' : ''}`}>
      <div className="player-avatar" style={{ backgroundColor: color }}>
        {player.name.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <p className="player-name">
          {player.name}{' '}
          {player.finished && <span className="badge">上がり</span>}
        </p>
        <p className="player-meta">手札: {player.hand.length} 枚 / 席 {player.seat + 1}</p>
      </div>
    </div>
  )
}
