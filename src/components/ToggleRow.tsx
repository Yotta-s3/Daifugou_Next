interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onToggle: () => void
}

export function ToggleRow({ label, description, checked, onToggle }: ToggleRowProps) {
  return (
    <button type="button" className={`toggle-row ${checked ? 'checked' : ''}`} onClick={onToggle}>
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <span className="toggle-indicator">{checked ? 'ON' : 'OFF'}</span>
    </button>
  )
}
