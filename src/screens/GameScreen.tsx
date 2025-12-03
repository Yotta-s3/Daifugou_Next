import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyAction, createGameState, formatCards, getPlayerById, resolvePendingEffect, validateSelection, HUMAN_PLAYER_ID } from '../game/engine'
import type { Card, Combo, EffectResolution, GameState, PendingEffect, PlayerState, Suit } from '../game/types'
import type { AppConfig } from '../types/app'
import { decideCpuAction } from '../game/cpu'
import { EffectPanel } from '../components/EffectPanel'
import { CardTile } from '../components/CardTile'
import { PlayerSummary } from '../components/PlayerSummary'
import { LogPanel } from '../components/LogPanel'

const PLAYER_COLORS = ['#e04f5f', '#f0a202', '#509aaf', '#6cc46e']
const RANK_RANGE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
const RANK_LABELS: Record<number, string> = {
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
  15: '2',
}
const SUIT_SYMBOLS: Record<Suit, string> = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
}

type SelectionState = { valid: boolean; combo?: Combo; reason?: string }

interface GameScreenProps {
  config: AppConfig
  onExit: () => void
}

export function GameScreen({ config, onExit }: GameScreenProps) {
  const [state, setState] = useState<GameState>(() => startNewGame(config))
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])
  const [queenRanks, setQueenRanks] = useState<number[]>([])

  const pendingEffect = state.pendingEffects[0] ?? null
  const effectOwner = pendingEffect ? getPlayerById(state, pendingEffect.ownerId) : undefined
  const effectTarget =
    pendingEffect && pendingEffect.type === 'sevenGive'
      ? getPlayerById(state, pendingEffect.targetId)
      : undefined
  const humanPlayer = getPlayerById(state, HUMAN_PLAYER_ID) ?? state.players.find(player => player.isHuman)
  const currentPlayer = getPlayerById(state, state.currentPlayerId)
  const isHumanTurn = Boolean(
    humanPlayer && humanPlayer.id === state.currentPlayerId && state.phase === 'playing',
  )
  const waitingOnHumanEffect = Boolean(pendingEffect && effectOwner?.isHuman)
  const hasPendingEffect = Boolean(pendingEffect)
  const allowCardSelection =
    (isHumanTurn && !hasPendingEffect) ||
    (waitingOnHumanEffect && pendingEffect?.type !== 'queenBomb')
  const selectionLimit =
    waitingOnHumanEffect && pendingEffect && pendingEffect.type !== 'queenBomb'
      ? pendingEffect.remaining
      : undefined

  useEffect(() => {
    if (!pendingEffect) {
      setQueenRanks([])
      return
    }
    if (pendingEffect.type === 'queenBomb') {
      setSelectedCardIds([])
    } else {
      setQueenRanks([])
    }
  }, [pendingEffect?.type, pendingEffect?.ownerId])

  const selectionState = useMemo<SelectionState>(() => {
    if (pendingEffect && waitingOnHumanEffect) {
      return { valid: false, reason: '特殊効果を先に処理してください' }
    }
    if (!humanPlayer) {
      return { valid: false, reason: 'プレイヤー情報が見つかりません' }
    }
    if (!isHumanTurn) {
      return { valid: false, reason: 'あなたのターンではありません' }
    }
    if (selectedCardIds.length === 0) {
      return { valid: false, reason: 'カードを選択してください' }
    }
    return validateSelection(state, humanPlayer, selectedCardIds)
  }, [pendingEffect, waitingOnHumanEffect, humanPlayer, isHumanTurn, selectedCardIds, state])

  const statusText = useMemo(() => {
    if (state.phase === 'finished') {
      return 'ゲーム終了: 「新しいゲーム」で再戦できます'
    }
    if (pendingEffect) {
      if (waitingOnHumanEffect) {
        return `特殊効果「${effectLabel(pendingEffect)}」を処理してください`
      }
      return `${effectOwner?.name ?? 'CPU'} が特殊効果を処理中`
    }
    if (!isHumanTurn) {
      return currentPlayer ? `${currentPlayer.name} のターンです` : '相手のターンです'
    }
    if (selectionState.valid && selectionState.combo) {
      return `出せます: ${formatCards(selectionState.combo.cards)}`
    }
    return selectionState.reason ?? 'カードを選択してください'
  }, [state.phase, pendingEffect, waitingOnHumanEffect, effectOwner, isHumanTurn, currentPlayer, selectionState])

  const handleCardToggle = useCallback(
    (cardId: string) => {
      if (!allowCardSelection) {
        return
      }
      setSelectedCardIds(prev => {
        if (prev.includes(cardId)) {
          return prev.filter(id => id !== cardId)
        }
        if (selectionLimit && prev.length >= selectionLimit) {
          return prev
        }
        return [...prev, cardId]
      })
    },
    [allowCardSelection, selectionLimit],
  )

  const handlePlay = () => {
    if (!humanPlayer || !selectionState.valid || !selectionState.combo || !isHumanTurn || hasPendingEffect) {
      return
    }
    setState(prev => applyAction(prev, { type: 'play', playerId: humanPlayer.id, cardIds: selectedCardIds }))
    setSelectedCardIds([])
  }

  const handlePass = () => {
    if (!humanPlayer || !isHumanTurn || hasPendingEffect) {
      return
    }
    setState(prev => applyAction(prev, { type: 'pass', playerId: humanPlayer.id }))
    setSelectedCardIds([])
  }

  const handleRestart = () => {
    setState(startNewGame(config))
    setSelectedCardIds([])
    setQueenRanks([])
  }

  const handleRankToggle = useCallback(
    (rank: number) => {
      if (!pendingEffect || pendingEffect.type !== 'queenBomb' || !waitingOnHumanEffect) {
        return
      }
      setQueenRanks(prev => {
        if (prev.includes(rank)) {
          return prev.filter(value => value !== rank)
        }
        if (prev.length >= pendingEffect.remaining) {
          return prev
        }
        return [...prev, rank]
      })
    },
    [pendingEffect, waitingOnHumanEffect],
  )

  const handleApplyEffect = () => {
    if (!pendingEffect || !effectOwner || !waitingOnHumanEffect) {
      return
    }
    if (pendingEffect.type === 'queenBomb') {
      const ranks = queenRanks.slice(0, pendingEffect.remaining)
      setState(prev => resolvePendingEffect(prev, { type: 'queenBomb', playerId: effectOwner.id, ranks }))
      setQueenRanks([])
      return
    }
    const takeCount = Math.min(selectedCardIds.length, pendingEffect.remaining)
    if (takeCount === 0) {
      return
    }
    const cardIds = selectedCardIds.slice(0, takeCount)
    const resolution: EffectResolution =
      pendingEffect.type === 'sevenGive'
        ? { type: 'sevenGive', playerId: effectOwner.id, cardIds }
        : { type: 'tenDiscard', playerId: effectOwner.id, cardIds }
    setState(prev => resolvePendingEffect(prev, resolution))
    setSelectedCardIds([])
  }

  const handleSkipEffect = () => {
    if (!pendingEffect || !effectOwner || !waitingOnHumanEffect) {
      return
    }
    setState(prev => resolvePendingEffect(prev, { type: 'skip', playerId: effectOwner.id }))
    setSelectedCardIds([])
    setQueenRanks([])
  }

  useEffect(() => {
    if (state.phase !== 'playing' || hasPendingEffect) {
      return
    }
    const actor = getPlayerById(state, state.currentPlayerId)
    if (!actor || actor.isHuman) {
      return
    }
    const timer = window.setTimeout(() => {
      setState(prev => {
        if (prev.phase !== 'playing' || prev.pendingEffects.length > 0) {
          return prev
        }
        const current = getPlayerById(prev, prev.currentPlayerId)
        if (!current || current.isHuman) {
          return prev
        }
        const action = decideCpuAction(prev, current)
        return applyAction(prev, action)
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [state, hasPendingEffect])

  useEffect(() => {
    if (!pendingEffect || !effectOwner || effectOwner.isHuman) {
      return
    }
    const timer = window.setTimeout(() => {
      setState(prev => {
        const effect = prev.pendingEffects[0]
        if (!effect) {
          return prev
        }
        const owner = getPlayerById(prev, effect.ownerId)
        if (!owner || owner.isHuman) {
          return prev
        }
        const resolution = decideCpuPendingEffect(prev, effect, owner)
        return resolvePendingEffect(prev, resolution)
      })
    }, 800)
    return () => window.clearTimeout(timer)
  }, [pendingEffect, effectOwner])

  const showEffectPanel = Boolean(waitingOnHumanEffect && pendingEffect && effectOwner)
  const canApplyEffect = Boolean(
    pendingEffect &&
      waitingOnHumanEffect &&
      (pendingEffect.type === 'queenBomb' || selectedCardIds.length > 0),
  )

  const fieldFlags = (
    <div className="field-flags stacked">
      {state.field.isRevolution && <span className="badge">革命</span>}
      {state.field.isElevenBack && <span className="badge">11バック</span>}
      {state.field.shibariSuit && (
        <span className="badge">しばり {SUIT_SYMBOLS[state.field.shibariSuit]}</span>
      )}
      <span className="badge light">パス {state.passesInRow}</span>
      {state.pendingEffects.length > 0 && <span className="badge warning">特殊効果待ち</span>}
      {state.rules.sevenExchange && <span className="badge light">7渡し ON</span>}
      {state.rules.tenDiscard && <span className="badge light">10捨て ON</span>}
      {state.rules.queenBomber && <span className="badge light">Qボンバー ON</span>}
    </div>
  )

  const winners = state.winners.map(id => getPlayerById(state, id)?.name ?? id)

  return (
    <div className="app-shell">
      <header>
        <div>
          <h1>大富豪</h1>
          <p className="subtitle">ホットシート + CPU 対戦</p>
        </div>
        <div className="game-header-actions">
          <button className="secondary-btn" type="button" onClick={onExit}>
            ロビーに戻る
          </button>
          <button className="primary-btn" type="button" onClick={handleRestart}>
            新しいゲーム
          </button>
        </div>
      </header>

      <section className="status-panel">
        <div>
          <h2>ターン</h2>
          <p className="status-text">{statusText}</p>
        </div>
      </section>

      <section className="field-layout">
        <div className="field-panel">
          <div className="field-header">
            <div>
              <h2>場</h2>
              {state.field.ownerId && (
                <span>出し手: {getPlayerById(state, state.field.ownerId)?.name ?? '---'}</span>
              )}
            </div>
            {fieldFlags}
          </div>
          {state.field.combo ? (
            <div className="card-row field-cards">
              {state.field.combo.cards.map(card => (
                <CardTile key={card.id} card={card} disabled selected={false} />
              ))}
            </div>
          ) : (
            <p className="muted">まだカードは出ていません</p>
          )}
        </div>

        <div className="field-log">
          <LogPanel log={state.log} />
        </div>

        <div className="field-players">
          {state.players.map(player => (
            <PlayerSummary
              key={player.id}
              player={player}
              isCurrent={state.currentPlayerId === player.id}
              color={PLAYER_COLORS[player.seat % PLAYER_COLORS.length]}
            />
          ))}
        </div>
      </section>

      <section className="hand-panel">
        <div className="hand-header">
          <div>
            <h2>あなたの手札</h2>
            {showEffectPanel && pendingEffect && (
              <p className="muted">特殊効果を処理してください</p>
            )}
          </div>
          <div className="hand-actions">
            {showEffectPanel && pendingEffect && effectOwner && (
              <EffectPanel
                effect={pendingEffect}
                owner={effectOwner}
                target={effectTarget}
                selectedCardIds={selectedCardIds}
                selectedRanks={queenRanks}
                maxRankSelections={pendingEffect.type === 'queenBomb' ? pendingEffect.remaining : 0}
                rankOptions={RANK_RANGE}
                canInteract={waitingOnHumanEffect}
                canApply={canApplyEffect}
                onApply={handleApplyEffect}
                onSkip={handleSkipEffect}
                onToggleRank={handleRankToggle}
                formatRank={formatRankLabel}
              />
            )}
            <button
              className="primary-btn"
              type="button"
              onClick={handlePlay}
              disabled={!selectionState.valid || !isHumanTurn || hasPendingEffect}
            >
              出す
            </button>
            <button
              className="secondary-btn"
              type="button"
              onClick={handlePass}
              disabled={!isHumanTurn || hasPendingEffect}
            >
              パス
            </button>
          </div>
        </div>
        {humanPlayer ? (
          <div className="card-row">
            {humanPlayer.hand.map(card => (
              <CardTile
                key={card.id}
                card={card}
                selected={selectedCardIds.includes(card.id)}
                disabled={!allowCardSelection}
                onClick={() => handleCardToggle(card.id)}
              />
            ))}
          </div>
        ) : (
          <p className="muted">プレイヤー情報が見つかりません</p>
        )}
      </section>

      <section className="rules-panel">
        <h2>採用ルール</h2>
        <ul>
          <li>しばり: {state.rules.shibari ? 'ON' : 'OFF'}</li>
          <li>階段: {state.rules.enableSequences ? 'ON' : 'OFF'}</li>
          <li>革命: {state.rules.revolution ? '有効 (4枚出し)' : 'なし'}</li>
          <li>8切り: {state.rules.eightCut ? '有効' : 'なし'}</li>
          <li>11バック: {state.rules.elevenBack ? '有効' : 'なし'}</li>
          <li>7渡し: {state.rules.sevenExchange ? '有効' : 'なし'}</li>
          <li>10捨て: {state.rules.tenDiscard ? '有効' : 'なし'}</li>
          <li>Qボンバー: {state.rules.queenBomber ? '有効' : 'なし'}</li>
          <li>ジョーカー枚数: {state.rules.jokerCount}</li>
        </ul>
        {winners.length > 0 && (
          <div className="winners">
            <h3>上がり順</h3>
            <ol>
              {winners.map(name => (
                <li key={name}>{name}</li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  )
}

function startNewGame(config: AppConfig): GameState {
  return createGameState({ humanName: config.humanName, rules: config.rules })
}

function formatRankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank)
}

function decideCpuPendingEffect(state: GameState, effect: PendingEffect, owner: PlayerState): EffectResolution {
  if (effect.type === 'sevenGive') {
    const count = Math.min(effect.remaining, owner.hand.length)
    const cardIds = [...owner.hand]
      .sort((a, b) => b.rank - a.rank)
      .slice(0, count)
      .map(card => card.id)
    if (cardIds.length === 0) {
      return { type: 'skip', playerId: owner.id }
    }
    return { type: 'sevenGive', playerId: owner.id, cardIds }
  }
  if (effect.type === 'tenDiscard') {
    const count = Math.min(effect.remaining, owner.hand.length)
    const cardIds = [...owner.hand]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, count)
      .map(card => card.id)
    if (cardIds.length === 0) {
      return { type: 'skip', playerId: owner.id }
    }
    return { type: 'tenDiscard', playerId: owner.id, cardIds }
  }
  if (effect.type === 'queenBomb') {
    const rankEntries = new Map<number, number>()
    state.players.forEach(player => {
      player.hand.forEach(card => {
        if (card.rank >= 3 && card.rank <= 15) {
          rankEntries.set(card.rank, (rankEntries.get(card.rank) ?? 0) + 1)
        }
      })
    })
    const ranks = Array.from(rankEntries.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) {
          return b[1] - a[1]
        }
        return b[0] - a[0]
      })
      .map(([rank]) => rank)
      .slice(0, effect.remaining)
    return { type: 'queenBomb', playerId: owner.id, ranks }
  }
  return { type: 'skip', playerId: owner.id }
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
