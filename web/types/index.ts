export type Put = {
  id: number
  ticker: string
  run_date: string
  expiration: string
  dte: number
  strike: number
  current_price: number
  bid: number | null
  ask: number | null
  iv: number | null
  delta: number | null
  prob_profit: number | null
  volume: number | null
  open_interest: number | null
}

export type Spread = {
  id: number
  sell_put_id: number
  buy_put_id: number
  width: number
  credit: number
  max_profit: number
  max_loss: number
  risk_multiple: number
  spread_type: string
  sell_put: Put
  buy_put: Put
}

export type Filters = {
  budget: number
  maxRisk: number
  minProb: number
}
