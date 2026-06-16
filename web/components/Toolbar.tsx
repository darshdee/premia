'use client'

import { Filters } from '@/types'

type Props = {
  mode: 'spreads' | 'csp'
  setMode: (m: 'spreads' | 'csp') => void
  filters: Filters
  setFilters: (f: Filters) => void
}

const BUDGET_OPTIONS = [100, 200, 300, 500, 1000, 10000]

const divider = <div style={{ width: '0.5px', height: 20, background: 'var(--border)' }} />

function fmt(val: number) {
  if (val >= 1000) return `$${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`
  return `$${val}`
}

export default function Toolbar({ mode, setMode, filters, setFilters }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 28px',
      borderBottom: '0.5px solid var(--border)',
      flexWrap: 'wrap',
    }}>
      <div style={{
        display: 'flex',
        background: '#f5f5f5',
        borderRadius: 8,
        padding: 2,
        gap: 2,
      }}>
        {(['spreads', 'csp'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              fontSize: 13,
              padding: '5px 14px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: mode === m ? '#fff' : 'transparent',
              color: mode === m ? 'var(--foreground)' : 'var(--muted)',
              fontWeight: mode === m ? 500 : 400,
              boxShadow: mode === m ? '0 0 0 0.5px var(--border)' : 'none',
            }}
          >
            {m === 'spreads' ? 'Bull put spreads' : 'Cash-secured puts'}
          </button>
        ))}
      </div>

      {divider}

      <label style={{ fontSize: 12, color: 'var(--muted)' }}>Max budget</label>
      <select
        value={filters.budget}
        onChange={e => setFilters({ ...filters, budget: Number(e.target.value) })}
        style={{
          fontSize: 13,
          padding: '5px 10px',
          border: '0.5px solid var(--border)',
          borderRadius: 8,
          background: '#fff',
          color: 'var(--foreground)',
          cursor: 'pointer',
        }}
      >
        {BUDGET_OPTIONS.map(v => (
          <option key={v} value={v}>{fmt(v)}</option>
        ))}
      </select>

      {mode === 'spreads' && (
        <>
          {divider}
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>Max loss:profit</label>
          <input
            type="number"
            value={filters.maxRisk}
            min={1} max={50}
            onChange={e => setFilters({ ...filters, maxRisk: Number(e.target.value) })}
            style={{
              fontSize: 13,
              padding: '5px 10px',
              border: '0.5px solid var(--border)',
              borderRadius: 8,
              width: 72,
              background: '#fff',
              color: 'var(--foreground)',
            }}
          />
        </>
      )}

      {divider}

      <label style={{ fontSize: 12, color: 'var(--muted)' }}>Min prob</label>
      <input
        type="number"
        value={filters.minProb}
        min={0} max={99}
        onChange={e => setFilters({ ...filters, minProb: Number(e.target.value) })}
        style={{
          fontSize: 13,
          padding: '5px 10px',
          border: '0.5px solid var(--border)',
          borderRadius: 8,
          width: 72,
          background: '#fff',
          color: 'var(--foreground)',
        }}
      />
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>%</span>
    </div>
  )
}
