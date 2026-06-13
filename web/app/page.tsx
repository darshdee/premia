'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Spread, Put, Filters } from '@/types'
import Topbar from '@/components/Topbar'
import Toolbar from '@/components/Toolbar'
import SpreadsTable from '@/components/SpreadsTable'
import CspTable from '@/components/CspTable'
import ChatPanel from '@/components/ChatPanel'

const MAX_BUDGET = 25000

export default function Home() {
  const [mode, setMode] = useState<'spreads' | 'csp'>('spreads')
  const [spreads, setSpreads] = useState<Spread[]>([])
  const [puts, setPuts] = useState<Put[]>([])
  const [loading, setLoading] = useState(true)
  const [runDate, setRunDate] = useState<string>('')
  const [chatOpen, setChatOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    budget: MAX_BUDGET,
    maxRisk: 15,
    minProb: 60,
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const { data: latestPut } = await supabase
      .from('puts')
      .select('run_date')
      .order('run_date', { ascending: false })
      .limit(1)
      .single()

    const date = latestPut?.run_date
    if (!date) { setLoading(false); return }
    setRunDate(date)

    const { data: putsData, error: putsError } = await supabase
      .from('puts')
      .select('*')
      .eq('run_date', date)
      .order('prob_profit', { ascending: false })

    if (putsError) console.error('puts error:', putsError)

    const putIds = (putsData ?? []).map((p: Put) => p.id)

    const { data: spreadsData, error: spreadsError } = await supabase
      .from('spreads')
      .select(`
        *,
        sell_put:sell_put_id(*),
        buy_put:buy_put_id(*)
      `)
      .in('sell_put_id', putIds)
      .order('risk_multiple', { ascending: true })

    if (spreadsError) console.error('spreads error:', spreadsError)

    setSpreads((spreadsData as Spread[]) ?? [])
    setPuts((putsData as Put[]) ?? [])
    setLoading(false)
  }

  const filteredSpreads = spreads.filter(s => {
    if (!s.sell_put) return false
    return (
      s.max_loss <= filters.budget &&
      s.risk_multiple <= filters.maxRisk &&
      (s.sell_put.prob_profit ?? 0) * 100 >= filters.minProb
    )
  })

  const filteredPuts = puts.filter(p => {
    const capital = p.strike * 100
    return (
      capital <= filters.budget &&
      (p.prob_profit ?? 0) * 100 >= filters.minProb
    )
  })

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        background: '#fff',
        minHeight: '100vh',
        borderLeft: '0.5px solid var(--border)',
        borderRight: '0.5px solid var(--border)',
      }}>
        <Topbar runDate={runDate} onChatToggle={() => setChatOpen(o => !o)} chatOpen={chatOpen} />
        <Toolbar mode={mode} setMode={setMode} filters={filters} setFilters={setFilters} />

        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '48px 28px', color: 'var(--muted)', fontSize: 13 }}>
                Loading...
              </div>
            ) : mode === 'spreads' ? (
              <SpreadsTable spreads={filteredSpreads} total={spreads.length} />
            ) : (
              <CspTable puts={filteredPuts} total={puts.length} />
            )}
          </div>

          {chatOpen && (
            <div style={{
              width: 340,
              borderLeft: '0.5px solid var(--border)',
              flexShrink: 0,
            }}>
              <ChatPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
