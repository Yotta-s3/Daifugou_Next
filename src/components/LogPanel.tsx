interface LogPanelProps {
  log: string[]
}

export function LogPanel({ log }: LogPanelProps) {
  return (
    <div className="log-panel">
      <h3>ログ</h3>
      <ul>
        {[...log].reverse().map((entry, index) => (
          <li key={`${index}-${entry}`}>{entry}</li>
        ))}
      </ul>
    </div>
  )
}
