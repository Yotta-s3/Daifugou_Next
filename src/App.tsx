import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyAction,
  createGameState,
  formatCards,
  getPlayerById,
  resolvePendingEffect,
  validateSelection,
  DEFAULT_RULES,
  HUMAN_PLAYER_ID,
} from './game/engine'
import type {
  Card,
  Combo,
  EffectResolution,
  GameState,
  PendingEffect,
  PlayerState,
  RuleSettings,
  Suit,
} from './game/types'
import { decideCpuAction } from './game/cpu'

const CONFIG_STORAGE_KEY = 'daifugo-config'
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

type Screen = 'lobby' | 'settings' | 'game'

interface AppConfig {
  humanName: string
  rules: RuleSettings
}

type SelectionState = { valid: boolean; combo?: Combo; reason?: string }

const DEFAULT_CONFIG: AppConfig = {
  humanName: 'You',
  rules: { ...DEFAULT_RULES },
}

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('lobby')
  const [gameSeed, setGameSeed] = useState(0)
  const [config, setConfig] = useState<AppConfig>(() => loadConfig())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
  }, [config])

  const handleStartGame = () => {
    setGameSeed(seed => seed + 1)
    setScreen('game')
  }

  const handleSaveSettings = (next: AppConfig) => {
    setConfig(next)
    setScreen('lobby')
  }

  if (screen === 'settings') {
    return <SettingsScreen config={config} onSave={handleSaveSettings} onCancel={() => setScreen('lobby')} />
  }

  if (screen === 'game') {
    return <GameScreen key={gameSeed} config={config} onExit={() => setScreen('lobby')} />
  }

  return <LobbyScreen config={config} onStart={handleStartGame} onOpenSettings={() => setScreen('settings')} />
}

interface LobbyScreenProps {
  config: AppConfig
  onStart: () => void
  onOpenSettings: () => void
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ config, onStart, onOpenSettings }) => (
  <div className="app-shell lobby-shell">
    <header>
      <div>
        <h1>大富豪 Online Lab</h1>
        <p className="subtitle">ホットシート + CPU 対戦でルール検証できる試作クライアントです</p>
      </div>
      <button className="primary-btn" type="button" onClick={onStart}>
        今すぐプレイ
      </button>
    </header>

    <section className="lobby-hero">
      <div>
        <p>SPA ベースの画面から段階的に脱却し、ロビー → ゲーム → 設定の導線を確認できます。</p>
        <p>将来的にはルームID型のオンライン対戦や WebSocket 連携を想定しています。</p>
      </div>
      <div className="hero-actions">
        <button className="secondary-btn" type="button" onClick={onStart}>
          ホットシートを開始
        </button>
        <button className="ghost-btn" type="button" onClick={onOpenSettings}>
          設定を開く
        </button>
        <span className="hero-note">ロードマップ: UI改善 / ルール拡張 / オンライン化</span>
      </div>
    </section>

    <section className="feature-grid">
      <article className="feature-card">
        <h3>1. UI の深化</h3>
        <p>ロビー・設定・大戦画面を分離し、SPA 的な制約から段階的に脱却します。</p>
      </article>
      <article className="feature-card">
        <h3>2. ルールの柔軟性</h3>
        <p>しばり / 革命 / 7渡し / 10捨て / Qボンバーなどを任意に ON/OFF できます。</p>
      </article>
      <article className="feature-card">
        <h3>3. オンライン対応</h3>
        <p>将来的にフロント/バックエンドを分離し、ルームID型のオンライン対戦を想定。</p>
      </article>
    </section>

    <section className="settings-preview">
      <h2>現在のローカル設定</h2>
      <ul>
        <li>プレイヤー名: {config.humanName}</li>
        <li>しばり: {config.rules.shibari ? 'ON' : 'OFF'}</li>
        <li>階段: {config.rules.enableSequences ? 'ON' : 'OFF'}</li>
        <li>革命: {config.rules.revolution ? 'ON' : 'OFF'}</li>
        <li>8切り: {config.rules.eightCut ? 'ON' : 'OFF'}</li>
        <li>11バック: {config.rules.elevenBack ? 'ON' : 'OFF'}</li>
        <li>7渡し: {config.rules.sevenExchange ? 'ON' : 'OFF'}</li>
        <li>10捨て: {config.rules.tenDiscard ? 'ON' : 'OFF'}</li>
        <li>Qボンバー: {config.rules.queenBomber ? 'ON' : 'OFF'}</li>
        <li>ジョーカー枚数: {config.rules.jokerCount}</li>
      </ul>
    </section>
  </div>
)

type ToggleRuleKey =
  | 'shibari'
  | 'enableSequences'
  | 'revolution'
  | 'eightCut'
  | 'elevenBack'
  | 'sevenExchange'
  | 'tenDiscard'
  | 'queenBomber'

interface SettingsScreenProps {
  config: AppConfig
  onSave: (next: AppConfig) => void
  onCancel: () => void
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ config, onSave, onCancel }) => {
  const [form, setForm] = useState<AppConfig>({
    humanName: config.humanName,
    rules: { ...config.rules },
  })

  const toggleMeta: { key: ToggleRuleKey; label: string; description: string }[] = [
    { key: 'shibari', label: 'しばり', description: '同じスートのカードが2回続くと縛りが発動' },
    { key: 'enableSequences', label: '階段', description: '同スートで3枚以上の連番を有効化' },
    { key: 'revolution', label: '革命', description: '4枚出しで強弱が反転' },
    { key: 'eightCut', label: '8切り', description: '8を出したら場を流す' },
    { key: 'elevenBack', label: '11バック', description: 'Jを出すと強弱が一時的に反転' },
    { key: 'sevenExchange', label: '7渡し', description: '7を出した枚数分だけ次の人へ渡せる' },
    { key: 'tenDiscard', label: '10捨て', description: '10を出した枚数分だけ任意の札を捨てる' },
    { key: 'queenBomber', label: 'Qボンバー', description: '宣言した数字を全員が同時に捨てる' },
  ]

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const humanName = form.humanName.trim() || 'You'
    onSave({ humanName, rules: { ...form.rules } })
  }

  const handleToggle = (key: ToggleRuleKey) => {
    setForm(prev => ({
      ...prev,
      rules: { ...prev.rules, [key]: !prev.rules[key] },
    }))
  }

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, humanName: event.target.value }))
  }

  const handleJokerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    const clamped = Number.isFinite(value) ? Math.max(0, Math.min(2, value)) : 0
    setForm(prev => ({
      ...prev,
      rules: { ...prev.rules, jokerCount: clamped },
    }))
  }

  return (
    <div className="app-shell settings-shell">
      <header>
        <div>
          <h1>設定</h1>
          <p className="subtitle">ローカル保存されるルールとプレイヤー名を調整できます</p>
        </div>
        <button className="ghost-btn" type="button" onClick={onCancel}>
          ロビーに戻る
        </button>
      </header>

      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field" htmlFor="playerName">
            <span>プレイヤー名</span>
            <input
              id="playerName"
              className="input-field"
              value={form.humanName}
              onChange={handleNameChange}
              placeholder="プレイヤー名"
            />
          </label>
          <label className="form-field" htmlFor="jokerCount">
            <span>ジョーカー枚数 (0-2)</span>
            <input
              id="jokerCount"
              type="number"
              min={0}
              max={2}
              className="input-field"
              value={form.rules.jokerCount}
              onChange={handleJokerChange}
            />
          </label>
        </div>

        <div className="toggle-grid">
          {toggleMeta.map(item => (
            <ToggleRow
              key={item.key}
              label={item.label}
              description={item.description}
              checked={form.rules[item.key]}
              onToggle={() => handleToggle(item.key)}
            />
          ))}
        </div>

        <div className="form-actions">
          <button className="ghost-btn" type="button" onClick={onCancel}>
            キャンセル
          </button>
          <button className="primary-btn" type="submit">
            保存
          </button>
        </div>
      </form>

      <section className="settings-note">
        <h3>メモ</h3>
        <ul>
          <li>設定はブラウザの localStorage に保存されます。</li>
          <li>ルール ON/OFF はホットシート / CPU の両方に即時反映されます。</li>
          <li>将来のオンライン対戦でも同じ RuleSettings を使い回します。</li>
        </ul>
      </section>
    </div>
  )
}

interface GameScreenProps {
  config: AppConfig
  onExit: () => void
}

const GameScreen: React.FC<GameScreenProps> = ({ config, onExit }) => {
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
                canInteract={waitingOnHumanEffect}
                canApply={canApplyEffect}
                onApply={handleApplyEffect}
                onSkip={handleSkipEffect}
                onToggleRank={handleRankToggle}
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

interface EffectPanelProps {
  effect: PendingEffect
  owner: PlayerState
  target?: PlayerState
  selectedCardIds: string[]
  selectedRanks: number[]
  maxRankSelections: number
  canInteract: boolean
  canApply: boolean
  onApply: () => void
  onSkip: () => void
  onToggleRank: (rank: number) => void
}

const EffectPanel: React.FC<EffectPanelProps> = ({
  effect,
  owner,
  target,
  selectedCardIds,
  selectedRanks,
  maxRankSelections,
  canInteract,
  canApply,
  onApply,
  onSkip,
  onToggleRank,
}) => {
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
      <p className="muted">{owner.name} の効果: {message}</p>
      {effect.type === 'queenBomb' ? (
        <div className="effect-controls multi-select">
          <p className="muted">
            選択中: {selectedRanks.length === 0 ? '宣言なし' : selectedRanks.map(formatRankLabel).join(', ')}
          </p>
          <div className="chip-group">
            {RANK_RANGE.map(rank => {
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
                  {formatRankLabel(rank)}
                </button>
              )
            })}
          </div>
          <p className="muted">最大 {maxRankSelections} 件まで宣言できます。少なくても構いません。</p>
        </div>
      ) : (
        <p className="muted">選択中: {selectedCardIds.length} / {effect.remaining} 枚</p>
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

interface PlayerSummaryProps {
  player: PlayerState
  isCurrent: boolean
  color: string
}

const PlayerSummary: React.FC<PlayerSummaryProps> = ({ player, isCurrent, color }) => (
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

interface CardTileProps {
  card: Card
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}

const CardTile: React.FC<CardTileProps> = ({ card, selected, disabled, onClick }) => (
  <button
    type="button"
    className={`card-tile ${card.suit} ${selected ? 'selected' : ''}`}
    disabled={disabled}
    onClick={onClick}
  >
    <span>{card.label}</span>
  </button>
)

interface LogPanelProps {
  log: string[]
}

const LogPanel: React.FC<LogPanelProps> = ({ log }) => (
  <div className="log-panel">
    <h3>ログ</h3>
    <ul>
      {[...log].reverse().map((entry, index) => (
        <li key={`${index}-${entry}`}>{entry}</li>
      ))}
    </ul>
  </div>
)

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onToggle: () => void
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onToggle }) => (
  <button type="button" className={`toggle-row ${checked ? 'checked' : ''}`} onClick={onToggle}>
    <div>
      <strong>{label}</strong>
      <p>{description}</p>
    </div>
    <span className="toggle-indicator">{checked ? 'ON' : 'OFF'}</span>
  </button>
)

function loadConfig(): AppConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG
  }
  const stored = window.localStorage.getItem(CONFIG_STORAGE_KEY)
  if (!stored) {
    return DEFAULT_CONFIG
  }
  try {
    const parsed = JSON.parse(stored) as Partial<AppConfig>
    const humanName =
      typeof parsed.humanName === 'string' && parsed.humanName.trim().length > 0
        ? parsed.humanName
        : DEFAULT_CONFIG.humanName
    return {
      humanName,
      rules: { ...DEFAULT_RULES, ...(parsed.rules ?? {}) },
    }
  } catch (error) {
    console.warn('設定の読み込みに失敗しました', error)
    return DEFAULT_CONFIG
  }
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

export default App
