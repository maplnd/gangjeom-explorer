import { useEffect, useState } from 'react'

export interface Rates { base: string; rates: Record<string, number>; updated: string }

/** 무료 환율 (ExchangeRate-API open access, 하루 1회 갱신) */
export function useRates(base: string) {
  const [rates, setRates] = useState<Rates | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const key = `fx:${base}`
    try {
      const c = JSON.parse(sessionStorage.getItem(key) || 'null')
      if (c) { setRates(c); return }
    } catch { /* noop */ }
    let alive = true
    fetch(`https://open.er-api.com/v6/latest/${base}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d.result !== 'success') throw new Error()
        const v: Rates = { base, rates: d.rates, updated: d.time_last_update_utc }
        setRates(v)
        try { sessionStorage.setItem(key, JSON.stringify(v)) } catch { /* noop */ }
      })
      .catch(() => alive && setError(true))
    return () => { alive = false }
  }, [base])
  return { rates, error }
}
