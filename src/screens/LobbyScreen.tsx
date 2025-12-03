import type { AppConfig } from '../types/app'

interface LobbyScreenProps {
  config: AppConfig
  onStart: () => void
  onOpenSettings: () => void
}

export function LobbyScreen({ config, onStart, onOpenSettings }: LobbyScreenProps) {
  return (
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
}
