import type {
  Card,
  Combo,
  ComboType,
  EffectResolution,
  FieldState,
  GameConfig,
  GameState,
  PendingEffect,
  PlayerAction,
  PlayerState,
  RuleSettings,
  Suit,
} from './types'

const SUITS: Suit[] = ['spade', 'heart', 'diamond', 'club']
const SUIT_SYMBOL: Record<Suit, string> = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
}

const SUIT_ORDER: Suit[] = ['club', 'diamond', 'heart', 'spade']

const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

const RANK_LABEL: Record<number, string> = {
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
  16: 'Jo',
}

export const DEFAULT_RULES: RuleSettings = {
  shibari: true,
  enableSequences: true,
  revolution: true,
  eightCut: true,
  elevenBack: true,
  jokerCount: 1,
  humanSeats: 1,
  sevenExchange: false,
  tenDiscard: false,
  queenBomber: false,
}

const INITIAL_FIELD: FieldState = {
  combo: null,
  ownerId: null,
  shibariSuit: null,
  isRevolution: false,
  isElevenBack: false,
  consecutiveSuit: null,
  consecutiveCount: 0,
}

export const HUMAN_PLAYER_ID = 'player-1'

export function createGameState(config?: GameConfig): GameState {
  const rules = { ...DEFAULT_RULES, ...config?.rules }
  const cpuNames = config?.cpuNames ?? ['AI 北', 'AI 東', 'AI 南']
  const players: PlayerState[] = []
  const totalPlayers = 4

  for (let i = 0; i < totalPlayers; i += 1) {
    const isHuman = i === 0
    players.push({
      id: `player-${i + 1}`,
      name: isHuman ? config?.humanName ?? 'You' : cpuNames[i - 1] ?? `CPU ${i}`,
      seat: i,
      isHuman,
      hand: [],
      finished: false,
    })
  }

  const deck = shuffle(createDeck(rules))
  deck.forEach((card, index) => {
    const playerIndex = index % totalPlayers
    players[playerIndex].hand.push(card)
  })

  players.forEach(p => {
    p.hand = sortCards(p.hand)
  })

  const firstPlayer =
    players.find(p => p.hand.some(card => card.rank === 3 && card.suit === 'club')) ?? players[0]

  return {
    players,
    currentPlayerId: firstPlayer.id,
    field: { ...INITIAL_FIELD },
    passesInRow: 0,
    log: [`${firstPlayer.name} (♣3 所持) が最初に出します`],
    winners: [],
    phase: 'playing',
    rules,
    pendingEffects: [],
  }
}

export function applyAction(state: GameState, action: PlayerAction): GameState {
  if (state.phase !== 'playing') {
    return state
  }

  if (state.pendingEffects.length > 0) {
    return state
  }

  if (action.playerId !== state.currentPlayerId) {
    return state
  }

  const playerIndex = state.players.findIndex(p => p.id === action.playerId)
  if (playerIndex === -1) {
    return state
  }

  const player = state.players[playerIndex]
  if (player.finished) {
    return state
  }

  if (action.type === 'pass') {
    return handlePass(state, player)
  }

  if (action.cardIds.length === 0) {
    return state
  }

  const cards = action.cardIds
    .map(id => player.hand.find(card => card.id === id))
    .filter((card): card is Card => Boolean(card))

  if (cards.length !== action.cardIds.length) {
    return state
  }

  const combo = analyzeCombo(cards, state.rules)
  if (!combo) {
    return state
  }

  if (!canComboBeatField(state, combo)) {
    return state
  }

  return handlePlay(state, playerIndex, combo)
}

export function validateSelection(
  state: GameState,
  player: PlayerState,
  cardIds: string[],
): { valid: boolean; combo?: Combo; reason?: string } {
  const cards = cardIds
    .map(id => player.hand.find(card => card.id === id))
    .filter((card): card is Card => Boolean(card))
  if (cards.length !== cardIds.length) {
    return { valid: false, reason: 'カード選択を確認してください' }
  }
  const combo = analyzeCombo(cards, state.rules)
  if (!combo) {
    return { valid: false, reason: '役になっていません' }
  }
  if (!canComboBeatField(state, combo)) {
    return { valid: false, reason: '現在の場より弱いです' }
  }
  return { valid: true, combo }
}

export function resolvePendingEffect(state: GameState, resolution: EffectResolution): GameState {
  if (state.phase !== 'playing') {
    return state
  }
  if (state.pendingEffects.length === 0) {
    return state
  }

  const [effect, ...rest] = state.pendingEffects
  if (resolution.playerId !== effect.ownerId) {
    return state
  }

  if (resolution.type === 'skip') {
    const owner = state.players.find(p => p.id === resolution.playerId)
    const skipLog = owner ? appendLog(state.log, `${owner.name} は特殊効果を見送りました`) : state.log
    return {
      ...state,
      pendingEffects: rest,
      log: skipLog,
    }
  }

  let nextPlayers = state.players.map(player => ({ ...player, hand: [...player.hand] }))
  let log = state.log
  let pendingEffects = rest

  if (effect.type === 'sevenGive' && resolution.type === 'sevenGive') {
    const takeCount = Math.min(resolution.cardIds.length, effect.remaining)
    if (takeCount === 0) {
      return state
    }
    const ownerIndex = nextPlayers.findIndex(player => player.id === effect.ownerId)
    const targetIndex = nextPlayers.findIndex(player => player.id === effect.targetId)
    if (ownerIndex === -1 || targetIndex === -1) {
      return state
    }
    const { taken, remaining } = takeCardsByIds(nextPlayers[ownerIndex].hand, resolution.cardIds.slice(0, takeCount))
    if (taken.length === 0) {
      return state
    }
    nextPlayers[ownerIndex] = { ...nextPlayers[ownerIndex], hand: sortCards(remaining) }
    nextPlayers[targetIndex] = {
      ...nextPlayers[targetIndex],
      hand: sortCards([...nextPlayers[targetIndex].hand, ...taken]),
    }
    log = appendLog(log, `${nextPlayers[ownerIndex].name} は ${nextPlayers[targetIndex].name} にカードを渡した (${taken.length}枚)`)
    const remainingCount = effect.remaining - taken.length
    if (remainingCount > 0) {
      pendingEffects = [{ ...effect, remaining: remainingCount }, ...rest]
    }
  } else if (effect.type === 'tenDiscard' && resolution.type === 'tenDiscard') {
    const discardCount = Math.min(resolution.cardIds.length, effect.remaining)
    if (discardCount === 0) {
      return state
    }
    const ownerIndex = nextPlayers.findIndex(player => player.id === effect.ownerId)
    if (ownerIndex === -1) {
      return state
    }
    const { taken, remaining } = takeCardsByIds(nextPlayers[ownerIndex].hand, resolution.cardIds.slice(0, discardCount))
    if (taken.length === 0) {
      return state
    }
    nextPlayers[ownerIndex] = { ...nextPlayers[ownerIndex], hand: sortCards(remaining) }
    log = appendLog(
      log,
      `${nextPlayers[ownerIndex].name} は 10捨てで ${formatCards(taken)} を捨てた`,
    )
    const remainingCount = effect.remaining - taken.length
    if (remainingCount > 0) {
      pendingEffects = [{ ...effect, remaining: remainingCount }, ...rest]
    }
  } else if (effect.type === 'queenBomb' && resolution.type === 'queenBomb') {
    const ranks = (resolution.ranks ?? []).slice(0, effect.remaining)
    if (ranks.some(rank => rank < 3 || rank > 15)) {
      return state
    }
    let removedTotal = 0
    const detail: string[] = []
    nextPlayers = nextPlayers.map(player => {
      let keep = [...player.hand]
      let playerRemoved: Card[] = []
      ranks.forEach(rank => {
        const { taken, remaining } = takeCardsByRank(keep, rank)
        if (taken.length > 0) {
          keep = remaining
          playerRemoved = [...playerRemoved, ...taken]
        }
      })
      if (playerRemoved.length === 0) {
        return player
      }
      removedTotal += playerRemoved.length
      detail.push(`${player.name}: ${formatCards(playerRemoved)}`)
      return { ...player, hand: sortCards(keep) }
    })
    const labels = ranks.length
      ? ranks.map(rank => RANK_LABEL[rank] ?? String(rank)).join(', ')
      : '宣言なし'
    log = appendLog(
      log,
      `Qボンバー: ${labels} を宣言。${removedTotal} 枚のカードが捨てられた${
        detail.length ? ` (${detail.join(' / ')})` : ''
      }`,
    )
  } else {
    return state
  }

  let nextState: GameState = {
    ...state,
    players: nextPlayers,
    pendingEffects,
    log,
  }

  nextState = settleFinishes(nextState, nextState.currentPlayerId, effect.ownerId)

  return nextState
}

export function enumerateCombos(hand: Card[], rules: RuleSettings): Combo[] {
  const combos: Combo[] = []
  hand.forEach(card => {
    combos.push({
      type: 'single',
      cards: [card],
      strength: card.rank,
      length: 1,
      suitConstraint: card.suit === 'joker' ? null : (card.suit as Suit),
    })
  })

  const grouped = groupByRank(hand.filter(card => card.suit !== 'joker'))
  grouped.forEach(cardsOfRank => {
    if (cardsOfRank.length >= 2) {
      combos.push(makeGroupCombo(cardsOfRank, 'pair', 2))
    }
    if (cardsOfRank.length >= 3) {
      combos.push(makeGroupCombo(cardsOfRank, 'triple', 3))
    }
    if (cardsOfRank.length >= 4) {
      combos.push(makeGroupCombo(cardsOfRank, 'quad', 4))
    }
  })

  if (rules.enableSequences) {
    const suits = groupBySuit(hand.filter(card => card.suit !== 'joker'))
    suits.forEach(cardsOfSuit => {
      const sorted = [...cardsOfSuit].sort((a, b) => a.rank - b.rank)
      let buffer: Card[] = []
      sorted.forEach((card, index) => {
        if (buffer.length === 0) {
          buffer.push(card)
          return
        }
        const previous = buffer[buffer.length - 1]
        if (card.rank === previous.rank) {
          return
        }
        if (card.rank === previous.rank + 1) {
          buffer.push(card)
        } else {
          if (buffer.length >= 3) {
            combos.push(makeSequenceCombo(buffer))
          }
          buffer = [card]
        }
        if (index === sorted.length - 1 && buffer.length >= 3) {
          combos.push(makeSequenceCombo(buffer))
        }
      })
      if (buffer.length >= 3 && combos.every(combo => combo.cards !== buffer)) {
        combos.push(makeSequenceCombo(buffer))
      }
    })
  }

  return combos
}

export function formatCards(cards: Card[]): string {
  return cards
    .map(card => (card.suit === 'joker' ? 'Joker' : `${RANK_LABEL[card.rank]}${SUIT_SYMBOL[card.suit]}`))
    .join(' ')
}

function collectSpecialEffects(state: GameState, player: PlayerState, combo: Combo): PendingEffect[] {
  if (state.phase !== 'playing') {
    return []
  }
  const effects: PendingEffect[] = []
  if (state.rules.sevenExchange) {
    const count = combo.cards.filter(card => card.rank === 7).length
    if (count > 0) {
      const targetId = nextActivePlayerId(state.players, player.id)
      if (targetId && targetId !== player.id) {
        effects.push({ type: 'sevenGive', ownerId: player.id, targetId, remaining: count })
      }
    }
  }
  if (state.rules.tenDiscard) {
    const count = combo.cards.filter(card => card.rank === 10).length
    if (count > 0) {
      effects.push({ type: 'tenDiscard', ownerId: player.id, remaining: count })
    }
  }
  if (state.rules.queenBomber) {
    const queenCount = combo.cards.filter(card => card.rank === 12).length
    if (queenCount > 0) {
      effects.push({ type: 'queenBomb', ownerId: player.id, remaining: queenCount })
    }
  }
  return effects
}

function handlePlay(state: GameState, playerIndex: number, combo: Combo): GameState {
  const player = state.players[playerIndex]
  const remainingHand = player.hand.filter(card => !combo.cards.some(target => target.id === card.id))
  const updatedPlayer: PlayerState = {
    ...player,
    hand: sortCards(remainingHand),
  }

  const nextPlayers = [...state.players]
  nextPlayers[playerIndex] = updatedPlayer

  const nextField: FieldState = {
    ...state.field,
    combo,
    ownerId: player.id,
    ...updateShibari(state.field, combo, state.rules),
  }

  let passesInRow = 0
  let currentPlayerId = nextActivePlayerId(nextPlayers, player.id)
  const logEntry = `${player.name} : ${formatCards(combo.cards)}`
  const nextLog = appendLog(state.log, logEntry)
  let fieldAfter = applySpecialRules(nextField, combo, state.rules)

  if (state.rules.eightCut && combo.cards.some(card => card.rank === 8)) {
    fieldAfter = {
      ...fieldAfter,
      combo: null,
      ownerId: null,
      shibariSuit: null,
      isElevenBack: false,
      consecutiveSuit: null,
      consecutiveCount: 0,
    }
    passesInRow = 0
    if (remainingHand.length > 0) {
      currentPlayerId = player.id
    }
  }

  let updatedState: GameState = {
    ...state,
    players: nextPlayers,
    field: fieldAfter,
    passesInRow,
    currentPlayerId,
    log: nextLog,
  }

  updatedState = settleFinishes(updatedState, currentPlayerId, player.id)

  const sourcePlayer =
    updatedState.players.find(p => p.id === player.id) ??
    updatedPlayer
  const newEffects = collectSpecialEffects(updatedState, sourcePlayer, combo)

  return {
    ...updatedState,
    pendingEffects: [...updatedState.pendingEffects, ...newEffects],
  }
}

function handlePass(state: GameState, player: PlayerState): GameState {
  let passesInRow = state.passesInRow + 1
  let field = state.field
  const activeCount = state.players.filter(p => !p.finished).length
  let currentPlayerId = nextActivePlayerId(state.players, player.id)
  const log = appendLog(state.log, `${player.name} : パス`)

  if (field.combo && passesInRow >= activeCount - 1) {
    const ownerId = field.ownerId
    field = {
      ...field,
      combo: null,
      ownerId: null,
      shibariSuit: null,
      isElevenBack: false,
      consecutiveSuit: null,
      consecutiveCount: 0,
    }
    passesInRow = 0
    if (ownerId) {
      const owner = state.players.find(p => p.id === ownerId && !p.finished)
      currentPlayerId = owner ? owner.id : nextActivePlayerId(state.players, ownerId)
    }
  }

  return {
    ...state,
    field,
    passesInRow,
    currentPlayerId,
    log,
  }
}

function createDeck(rules: RuleSettings): Card[] {
  const deck: Card[] = []
  let counter = 0
  SUITS.forEach(suit => {
    RANKS.forEach(rank => {
      deck.push({
        id: `${suit}-${rank}-${counter++}`,
        suit,
        rank,
        label: `${RANK_LABEL[rank]}${SUIT_SYMBOL[suit]}`,
      })
    })
  })

  for (let i = 0; i < rules.jokerCount; i += 1) {
    deck.push({
      id: `joker-${i}`,
      suit: 'joker',
      rank: 16,
      label: 'Joker',
    })
  }

  return deck
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.rank === b.rank) {
      if (a.suit === 'joker') return 1
      if (b.suit === 'joker') return -1
      return SUIT_ORDER.indexOf(a.suit as Suit) - SUIT_ORDER.indexOf(b.suit as Suit)
    }
    return a.rank - b.rank
  })
}

function analyzeCombo(cards: Card[], rules: RuleSettings): Combo | null {
  if (cards.length === 0) {
    return null
  }
  if (cards.includes(undefined as unknown as Card)) {
    return null
  }
  const sorted = sortCards(cards)
  if (sorted.length === 1) {
    const card = sorted[0]
    return {
      type: 'single',
      cards: sorted,
      strength: card.rank,
      length: 1,
      suitConstraint: card.suit === 'joker' ? null : (card.suit as Suit),
    }
  }
  if (sorted.every(card => card.suit !== 'joker' && card.rank === sorted[0].rank)) {
    const type = toGroupType(sorted.length)
    if (!type) {
      return null
    }
    return {
      type,
      cards: sorted,
      strength: sorted[0].rank,
      length: sorted.length,
      suitConstraint: allSameSuit(sorted) ? (sorted[0].suit as Suit) : null,
    }
  }
  if (rules.enableSequences && isSequence(sorted)) {
    return makeSequenceCombo(sorted)
  }
  return null
}

function toGroupType(length: number): ComboType | null {
  switch (length) {
    case 2:
      return 'pair'
    case 3:
      return 'triple'
    case 4:
      return 'quad'
    default:
      return null
  }
}

function isSequence(cards: Card[]): boolean {
  if (cards.length < 3) {
    return false
  }
  const suits = new Set(cards.map(card => card.suit))
  if (suits.size !== 1) {
    return false
  }
  for (let i = 1; i < cards.length; i += 1) {
    const prev = cards[i - 1]
    const curr = cards[i]
    if (curr.rank !== prev.rank + 1) {
      return false
    }
  }
  return true
}

function makeSequenceCombo(cards: Card[]): Combo {
  const sorted = sortCards(cards)
  return {
    type: 'sequence',
    cards: sorted,
    strength: sorted[sorted.length - 1].rank,
    length: sorted.length,
    suitConstraint: sorted[0].suit as Suit,
  }
}

function makeGroupCombo(cards: Card[], type: ComboType, take: number): Combo {
  const selected = cards.slice(0, take)
  return {
    type,
    cards: selected,
    strength: selected[0].rank,
    length: take,
    suitConstraint: allSameSuit(selected) ? (selected[0].suit as Suit) : null,
  }
}

function groupByRank(cards: Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>()
  cards.forEach(card => {
    const list = map.get(card.rank) ?? []
    list.push(card)
    map.set(card.rank, list)
  })
  return map
}

function groupBySuit(cards: Card[]): Map<Suit, Card[]> {
  const map = new Map<Suit, Card[]>()
  cards.forEach(card => {
    if (card.suit === 'joker') {
      return
    }
    const list = map.get(card.suit as Suit) ?? []
    list.push(card)
    map.set(card.suit as Suit, list)
  })
  return map
}

function allSameSuit(cards: Card[]): boolean {
  if (cards.length === 0) {
    return false
  }
  const suit = cards[0].suit
  return cards.every(card => card.suit === suit)
}

export function canComboBeatField(state: GameState, combo: Combo): boolean {
  const { field } = state
  if (!field.combo) {
    return true
  }
  if (combo.type !== field.combo.type) {
    return false
  }
  if (combo.type === 'sequence' && combo.length !== field.combo.length) {
    return false
  }
  if (field.shibariSuit && combo.suitConstraint && combo.suitConstraint !== field.shibariSuit) {
    return false
  }
  const direction = comparisonDirection(field)
  if (direction >= 0) {
    return combo.strength > field.combo.strength
  }
  return combo.strength < field.combo.strength
}

export function comparisonDirection(field: FieldState): number {
  let direction = 1
  if (field.isRevolution) {
    direction *= -1
  }
  if (field.isElevenBack) {
    direction *= -1
  }
  return direction
}

function nextActivePlayerId(players: PlayerState[], currentId: string): string {
  const index = players.findIndex(p => p.id === currentId)
  if (index === -1) {
    return players.find(p => !p.finished)?.id ?? currentId
  }
  for (let i = 1; i <= players.length; i += 1) {
    const candidate = players[(index + i) % players.length]
    if (!candidate.finished) {
      return candidate.id
    }
  }
  return currentId
}

function appendLog(log: string[], entry: string): string[] {
  const next = [...log, entry]
  if (next.length > 30) {
    next.shift()
  }
  return next
}

function applySpecialRules(field: FieldState, combo: Combo, rules: RuleSettings): FieldState {
  let updated = { ...field }
  if (rules.revolution && combo.type === 'quad') {
    updated = { ...updated, isRevolution: !updated.isRevolution }
  }
  if (rules.elevenBack && combo.cards.some(card => card.rank === 11)) {
    updated = { ...updated, isElevenBack: !updated.isElevenBack }
  }
  return updated
}

export function getPlayerById(state: GameState, id: string): PlayerState | undefined {
  return state.players.find(player => player.id === id)
}

function settleFinishes(state: GameState, preferredNextId: string, lastActorId: string): GameState {
  const players = state.players.map(player => ({ ...player }))
  let winners = [...state.winners]

  players.forEach((player, index) => {
    if (!player.finished && player.hand.length === 0) {
      const finishOrder = winners.length + 1
      players[index] = { ...player, finished: true, finishOrder }
      winners = [...winners, player.id]
    }
  })

  if (winners.length === players.length - 1) {
    const lastPlayerIndex = players.findIndex(player => !player.finished)
    if (lastPlayerIndex >= 0) {
      const lastPlayer = players[lastPlayerIndex]
      players[lastPlayerIndex] = {
        ...lastPlayer,
        finished: true,
        finishOrder: winners.length + 1,
      }
      winners = [...winners, lastPlayer.id]
    }
  }

  let phase: GameState['phase'] = winners.length === players.length ? 'finished' : state.phase

  let currentPlayerId = preferredNextId
  const currentPlayer = players.find(player => player.id === currentPlayerId && !player.finished)
  if (!currentPlayer) {
    currentPlayerId = nextActivePlayerId(players, lastActorId)
  }

  if (phase === 'finished') {
    currentPlayerId = state.currentPlayerId
  }

  return {
    ...state,
    players,
    winners,
    phase,
    currentPlayerId,
  }
}

function updateShibari(
  previousField: FieldState,
  combo: Combo,
  rules: RuleSettings,
): Pick<FieldState, 'shibariSuit' | 'consecutiveSuit' | 'consecutiveCount'> {
  if (!rules.shibari || !combo.suitConstraint) {
    return {
      shibariSuit: null,
      consecutiveSuit: null,
      consecutiveCount: 0,
    }
  }

  let consecutiveSuit = previousField.consecutiveSuit
  let consecutiveCount = previousField.consecutiveCount

  if (combo.suitConstraint === consecutiveSuit) {
    consecutiveCount += 1
  } else {
    consecutiveSuit = combo.suitConstraint
    consecutiveCount = 1
  }

  return {
    shibariSuit: consecutiveCount >= 2 ? consecutiveSuit : null,
    consecutiveSuit,
    consecutiveCount,
  }
}

function takeCardsByIds(hand: Card[], cardIds: string[]): { taken: Card[]; remaining: Card[] } {
  const ids = new Set(cardIds)
  const taken: Card[] = []
  const remaining: Card[] = []
  hand.forEach(card => {
    if (ids.has(card.id)) {
      taken.push(card)
      ids.delete(card.id)
    } else {
      remaining.push(card)
    }
  })
  return { taken, remaining }
}

function takeCardsByRank(hand: Card[], rank: number): { taken: Card[]; remaining: Card[] } {
  const taken: Card[] = []
  const remaining: Card[] = []
  hand.forEach(card => {
    if (card.rank === rank) {
      taken.push(card)
    } else {
      remaining.push(card)
    }
  })
  return { taken, remaining }
}
