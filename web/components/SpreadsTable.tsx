'use client'

import { useState } from 'react'
import { Spread } from '@/types'

type Props = {
  spreads: Spread[]
  total: number
}

type SortKey =
  | 'ticker' | 'current_price' | 'expiration' | 'dte'
  | 'sell_strike' | 'buy_strike' | 'width' | 'credit'
  | 'max_profit' | 'max_loss' | 'risk_multiple' | 'prob_profit'

type SortDir = 'asc' | 'desc'

function getValue(s: Spread, key: SortKey): number | string {
  const p = s.sell_put
  switch (key) {
    case 'ticker':        return p?.ticker ?? ''
    case 'current_price': return p?.current_price ?? 0
    case 'expiration':    return p?.expiration ?? ''
    case 'dte':           return p?.dte ?? 0
    case 'sell_strike':   return s.sell_put?.strike ?? 0
    case 'buy_strike':    return s.buy_put?.strike ?? 0
    case 'width':         return s.width
    case 'credit':        return s.credit
    case 'max_profit':    return s.max_profit
    case 'max_loss':      return s.max_loss
    case 'risk_multiple': return s.risk_multiple
    case 'prob_profit':   return p?.prob_profit ?? 0
  }
}

function sortSpreads(spreads: Spread[], key: SortKey, dir: SortDir): Spread[] {
  return [...spreads].sort((a, b) => {
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
  { label: 'Ticker',     key: 'ticker',        width: 80  },
  { label: 'Price',      key: 'current_price', width: 90  },
  { label: 'Expiry',     key: 'expiration',    width: 90  },
  { label: 'DTE',        key: 'dte',           width: 52  },
  { label: 'Sell',       key: 'sell_strike',   width: 70  },
  { label: 'Buy',        key: 'buy_strike',    width: 70  },
  { label: 'Width',      key: 'width',         width: 60  },
  { label: 'Credit',     key: 'credit',        width: 72  },
  { label: 'Max profit', key: 'max_profit',    width: 84  },
  { label: 'Max loss',   key: 'max_loss',      width: 84  },
  { label: 'Risk ×',     key: 'risk_multiple', width: 72  },
  { label: 'Prob profit',key: 'prob_profit',   width: 140 },
]

export default function SpreadsTable({ spreads, total }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('risk_multiple')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortSpreads(spreads, sortKey, sortDir)

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
                <td colSpan={12} style={{ padding: '40px 28px', color: 'var(--muted)', fontSize: 13 }}>
                  No spreads match your filters.
                </td>
              </tr>
            ) : sorted.map(s => {
              const p = s.sell_put
              if (!p) return null
              return (
                <tr key={s.id}
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
                      background: 'var(--purple-light)',
                      color: 'var(--purple-dark)',
                    }}>
                      {p.ticker}
                    </span>
                  </TD>
                  <TD style={{ color: 'var(--muted)' }}>${p.current_price.toFixed(2)}</TD>
                  <TD style={{ color: 'var(--muted)' }}>{p.expiration}</TD>
                  <TD style={{ color: 'var(--muted)' }}>{p.dte}d</TD>
                  <TD>${s.sell_put.strike.toFixed(2)}</TD>
                  <TD>${s.buy_put.strike.toFixed(2)}</TD>
                  <TD style={{ color: 'var(--muted)' }}>${s.width.toFixed(2)}</TD>
                  <TD style={{ color: 'var(--teal)', fontWeight: 500 }}>${s.credit.toFixed(2)}</TD>
                  <TD style={{ color: 'var(--teal)' }}>${s.max_profit.toFixed(0)}</TD>
                  <TD style={{ color: 'var(--muted)' }}>${s.max_loss.toFixed(0)}</TD>
                  <TD style={{ color: 'var(--muted)' }}>{s.risk_multiple.toFixed(1)}×</TD>
                  <TD>
                    <ProbBar value={p.prob_profit ?? 0} />
                  </TD>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{
        padding: '10px 28px',
        borderTop: '0.5px solid var(--border)',
        fontSize: 12,
        color: 'var(--muted)',
      }}>
        Showing {sorted.length} of {total} spreads
      </div>
    </div>
  )
}
