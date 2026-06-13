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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 28px',
      borderBottom: '0.5px solid var(--border)',
    }}>
      <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.3px' }}>
        pre<span style={{ color: 'var(--purple)' }}>m</span>ia
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
