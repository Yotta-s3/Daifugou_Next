import type { Suit } from './types'

export const SUITS: Suit[] = ['spade', 'heart', 'diamond', 'club']

export const SUIT_SYMBOL: Record<Suit, string> = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
}

export const SUIT_ORDER: Suit[] = ['club', 'diamond', 'heart', 'spade']

export const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

export const RANK_LABEL: Record<number, string> = {
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
