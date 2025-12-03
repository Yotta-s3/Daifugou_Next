# Game Data Model

`src/game/model.ts` exposes serialization helpers so the same game engine can be used on both client and server.

## Snapshot Types

- `SerializedCard`: `{ id, suit, rank }` – minimal card representation
- `SerializedPlayer`: player metadata plus `hand: SerializedCard[]`
- `SerializedFieldState`: field owner, combo (if any), and ongoing rule flags
- `GameSnapshot`: aggregate with players, field, pending effects, rules, log, etc.

## API

```ts
import { serializeGameState, hydrateGameState } from '../game/model'

const snapshot = serializeGameState(state)   // → pure JSON
const restored = hydrateGameState(snapshot)  // → GameState
```

- `serializeGameState` adds a `timestamp` so snapshots can be ordered.
- DTOs never contain derived values like card labels; those are recomputed automatically when hydrating.
- `pendingEffects`, `rules`, `log`, etc. are deep-copied to avoid accidental mutations.

## Networking Events

`src/game/events.ts` defines envelope-friendly event payloads for WebSocket通信。

### Client → Server

- `room:create` – 新規ルーム作成（ロビー設定とルール差分を送信）
- `room:join` – 既存ルームに参加
- `action:submit` – `PlayerAction` を送信
- `effect:resolve` – `EffectResolution` を送信
- `state:ack` – 受信した `state:update` / `state:patch` のシーケンスを ACK

### Server → Client

- `room:created` – ルームID通知
- `room:joined` – 参加完了通知（サーバ側で払い出した playerId を含む）
- `state:update` – `GameSnapshot` の完全更新
- `state:patch` – 差分更新（`Partial<GameSnapshot>` + sequence）
- `error` – 汎用エラーコード＋メッセージ

`wrapEvent(event, correlationId?)` を使うと、すべてのイベントに `timestamp` と相関IDを付与できます。

## Usage Ideas

1. **Server Authoritative Loop** – run `GameState` updates on the server, broadcast `GameSnapshot` over WebSocket.
2. **Persistence** – store snapshots as JSON in a DB for replay or crash recovery.
3. **Testing** – capture snapshots as fixtures, hydrate them inside unit tests, and assert engine behaviour.
