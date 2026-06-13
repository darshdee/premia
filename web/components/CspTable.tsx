'use client'

import { useState } from 'react'
import { Put } from '@/types'

type Props = {
  puts: Put[]
  total: number
}

type SortKey = 'ticker' | 'expiration' | 'dte' | 'strike' | 'bid' | 'capital' | 'iv' | 'delta' | 'prob_profit'
type SortDir = 'asc' | 'desc'

function getValue(p: Put, key: SortKey): number | string {
  switch (key) {
    case 'ticker':      return p.ticker
    case 'expiration':  return p.expiration
    case 'dte':         return p.dte
    case 'strike':      return p.strike
    case 'bid':         return p.bid ?? 0
    case 'capital':     return p.strike * 100
    case 'iv':          return p.iv ?? 0
    case 'delta':       return p.delta ?? 0
    case 'prob_profit': return p.prob_profit ?? 0
  }
}

function sortPuts(puts: Put[], key: SortKey, dir: SortDir): Put[] {
  return [...puts].sort((a, b) => {
    const av = getValue(a, key)
    const bv = getValue(b, key)
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
}

const TD = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--foreground)',
    whiteSpace: 'nowrap',
    borderBottom: '0.5px solid var(--border)',
    ...style,
  }}>
    {children}
  </td>
)

function ProbBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--purple-light)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--purple)', borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 32 }}>{pct}%</span>
    </div>
  )
}

type ColDef = { label: string; key: SortKey; width: number }

const COLS: ColDef[] = [
  { label: 'Ticker',      key: 'ticker',      width: 80  },
  { label: 'Expiry',      key: 'expiration',  width: 90  },
  { label: 'DTE',         key: 'dte',         width: 52  },
  { label: 'Strike',      key: 'strike',      width: 90  },
  { label: 'Premium',     key: 'bid',         width: 90  },
  { label: 'Capital req.', key: 'capital',    width: 110 },
  { label: 'IV',          key: 'iv',          width: 80  },
  { label: 'Delta',       key: 'delta',       width: 80  },
  { label: 'Prob profit', key: 'prob_profit', width: 140 },
]

export default function CspTable({ puts, total }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('prob_profit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortPuts(puts, sortKey, sortDir)

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 500,
                    color: sortKey === col.key ? 'var(--purple)' : 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '8px 12px',
                    borderBottom: '0.5px solid var(--border)',
                    whiteSpace: 'nowrap',
                    width: col.width,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px 28px', color: 'var(--muted)', fontSize: 13 }}>
                  No puts match your filters.
                </td>
              </tr>
            ) : sorted.map(p => (
              <tr key={p.id}
                style={{ transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <TD>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'var(--amber-light)',
                    color: 'var(--amber-dark)',
                  }}>
                    {p.ticker}
                  </span>
                </TD>
                <TD style={{ color: 'var(--muted)' }}>{p.expiration}</TD>
                <TD style={{ color: 'var(--muted)' }}>{p.dte}d</TD>
                <TD>${p.strike.toFixed(2)}</TD>
                <TD style={{ color: 'var(--teal)', fontWeight: 500 }}>
                  {p.bid != null ? `$${p.bid.toFixed(2)}` : '—'}
                </TD>
                <TD style={{ color: 'var(--muted)' }}>
                  ${(p.strike * 100).toLocaleString()}
                </TD>
                <TD style={{ color: 'var(--muted)' }}>
                  {p.iv != null ? `${(p.iv * 100).toFixed(1)}%` : '—'}
                </TD>
                <TD style={{ color: 'var(--muted)' }}>
                  {p.delta != null ? p.delta.toFixed(2) : '—'}
                </TD>
                <TD>
                  <ProbBar value={p.prob_profit ?? 0} />
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{
        padding: '10px 28px',
        borderTop: '0.5px solid var(--border)',
        fontSize: 12,
        color: 'var(--muted)',
      }}>
        Showing {sorted.length} of {total} puts
      </div>
    </div>
  )
}
