import { useState } from 'react'
import type { AppConfig } from '../types/app'
import type { RuleSettings } from '../game/types'
import { ToggleRow } from '../components/ToggleRow'

type ToggleRuleKey = keyof Pick<
  RuleSettings,
  'shibari' | 'enableSequences' | 'revolution' | 'eightCut' | 'elevenBack' | 'sevenExchange' | 'tenDiscard' | 'queenBomber'
>

interface SettingsScreenProps {
  config: AppConfig
  onSave: (next: AppConfig) => void
  onCancel: () => void
}

export function SettingsScreen({ config, onSave, onCancel }: SettingsScreenProps) {
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
