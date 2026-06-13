'use client'

import { Filters } from '@/types'

type Props = {
  mode: 'spreads' | 'csp'
  setMode: (m: 'spreads' | 'csp') => void
  filters: Filters
  setFilters: (f: Filters) => void
}

const MIN_BUDGET = 100
const MAX_BUDGET = 25000

function formatBudget(val: number) {
  if (val >= MAX_BUDGET) return 'Any'
  if (val >= 1000) return `$${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`
  return `$${val}`
}

const divider = <div style={{ width: '0.5px', height: 20, background: 'var(--border)' }} />

export default function Toolbar({ mode, setMode, filters, setFilters }: Props) {
  const budgetDisplay = formatBudget(filters.budget)

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range"
          min={MIN_BUDGET}
          max={MAX_BUDGET}
          step={100}
          value={filters.budget}
          onChange={e => setFilters({ ...filters, budget: Number(e.target.value) })}
          style={{ width: 120, accentColor: 'var(--purple)' }}
        />
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: filters.budget >= MAX_BUDGET ? 'var(--muted)' : 'var(--foreground)',
          minWidth: 40,
        }}>
          {budgetDisplay}
        </span>
      </div>

      {mode === 'spreads' && (
        <>
          {divider}
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>Max risk ×</label>
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
