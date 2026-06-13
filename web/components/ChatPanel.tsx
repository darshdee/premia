'use client'

import { useState } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Show HOOD spreads under $300',
  'Best prob profit today',
  'Low risk puts under $1k',
]

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    await new Promise(r => setTimeout(r, 600))
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Text-to-SQL is coming in v2. For now, use the filters above to narrow down your results.',
    }])
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: '0.5px solid var(--border)',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--foreground)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--purple)', display: 'inline-block',
        }} />
        Ask Premia
      </div>

      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Try asking:</p>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => setInput(s)}
                style={{
                  textAlign: 'left',
                  fontSize: 12,
                  padding: '7px 10px',
                  border: '0.5px solid var(--border)',
                  borderRadius: 8,
                  background: '#fff',
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        ) : messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: 10,
              fontSize: 13,
              lineHeight: 1.5,
              background: m.role === 'user' ? 'var(--purple-light)' : '#f5f5f5',
              color: m.role === 'user' ? 'var(--purple-dark)' : 'var(--foreground)',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Thinking...</div>
        )}
      </div>

      <div style={{
        padding: '12px 16px',
        borderTop: '0.5px solid var(--border)',
        display: 'flex',
        gap: 8,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about your spreads..."
          style={{
            flex: 1,
            fontSize: 13,
            padding: '7px 10px',
            border: '0.5px solid var(--border)',
            borderRadius: 8,
            outline: 'none',
            background: '#fff',
            color: 'var(--foreground)',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            padding: '7px 14px',
            fontSize: 13,
            border: '0.5px solid var(--border)',
            borderRadius: 8,
            background: input.trim() ? 'var(--purple)' : '#f5f5f5',
            color: input.trim() ? '#fff' : 'var(--muted)',
            cursor: input.trim() ? 'pointer' : 'default',
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
