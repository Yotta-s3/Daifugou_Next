import type { PendingEffect, PlayerState } from '../game/types'

interface EffectPanelProps {
  effect: PendingEffect
  owner: PlayerState
  target?: PlayerState
  selectedCardIds: string[]
  selectedRanks: number[]
  maxRankSelections: number
  rankOptions: number[]
  canInteract: boolean
  canApply: boolean
  onApply: () => void
  onSkip: () => void
  onToggleRank: (rank: number) => void
  formatRank: (rank: number) => string
}

export function EffectPanel({
  effect,
  owner,
  target,
  selectedCardIds,
  selectedRanks,
  maxRankSelections,
  rankOptions,
  canInteract,
  canApply,
  onApply,
  onSkip,
  onToggleRank,
  formatRank,
}: EffectPanelProps) {
  const message = (() => {
    switch (effect.type) {
      case 'sevenGive':
        return `${target?.name ?? '次のプレイヤー'} に最大 ${effect.remaining} 枚まで渡せます`
      case 'tenDiscard':
        return `任意のカードを最大 ${effect.remaining} 枚まで捨てられます`
      case 'queenBomb':
        return `最大 ${effect.remaining} 個の数字を宣言して、該当カードを全員に捨てさせます`
      default:
        return ''
    }
  })()

  return (
    <section className="effect-panel">
      <h3>{effectLabel(effect)}</h3>
      <p className="muted">
        {owner.name} の効果: {message}
      </p>
      {effect.type === 'queenBomb' ? (
        <div className="effect-controls multi-select">
          <p className="muted">
            選択中: {selectedRanks.length === 0 ? '宣言なし' : selectedRanks.map(formatRank).join(', ')}
          </p>
          <div className="chip-group">
            {rankOptions.map(rank => {
              const selected = selectedRanks.includes(rank)
              const reachLimit = maxRankSelections > 0 && selectedRanks.length >= maxRankSelections
              const disabled = !canInteract || (!!reachLimit && !selected)
              return (
                <button
                  key={rank}
                  type="button"
                  className={`chip ${selected ? 'selected' : ''}`}
                  disabled={disabled}
                  onClick={() => onToggleRank(rank)}
                >
                  {formatRank(rank)}
                </button>
              )
            })}
          </div>
          <p className="muted">最大 {maxRankSelections} 件まで宣言できます。少なくても構いません。</p>
        </div>
      ) : (
        <p className="muted">
          選択中: {selectedCardIds.length} / {effect.remaining} 枚
        </p>
      )}
      <div className="effect-actions">
        <button className="ghost-btn" type="button" onClick={onSkip} disabled={!canInteract}>
          効果を使わない
        </button>
        <button className="primary-btn" type="button" onClick={onApply} disabled={!canApply}>
          効果を適用
        </button>
      </div>
    </section>
  )
}

function effectLabel(effect: PendingEffect): string {
  switch (effect.type) {
    case 'sevenGive':
      return '7渡し'
    case 'tenDiscard':
      return '10捨て'
    case 'queenBomb':
      return 'Qボンバー'
    default:
      return '特殊効果'
  }
}
