'use client'

type Props = {
  runDate: string
  chatOpen: boolean
  onChatToggle: () => void
}

export default function Topbar({ runDate, chatOpen, onChatToggle }: Props) {
  const formatted = runDate
    ? new Date(runDate + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      })
    : '—'

  return (
    <div className="premia-topbar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>
          pre<span style={{ color: 'var(--purple)' }}>m</span>ia
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Finds high-probability put spreads and cash-secured puts
        </div>
      </div>

      <div className="premia-topbar-actions">
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Last run: {formatted}
        </span>
        <button
          onClick={onChatToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            padding: '6px 14px',
            border: '0.5px solid var(--border)',
            borderRadius: 8,
            background: chatOpen ? 'var(--purple-light)' : '#fff',
            color: chatOpen ? 'var(--purple-dark)' : 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          Ask AI
        </button>
      </div>
    </div>
  )
}
