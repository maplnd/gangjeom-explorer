import { useEffect, useState } from 'react'

export interface DayWeather { code: number; max: number; min: number; rain: number | null }

const cache = new Map<string, Promise<Record<string, DayWeather>>>()

/** Open-Meteo 일별 예보 (무료, 키 불필요, 오늘부터 최대 16일) */
function fetchForecast(lat: number, lng: number): Promise<Record<string, DayWeather>> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  if (!cache.has(key)) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`
    cache.set(key, fetch(url).then((r) => r.json()).then((d) => {
      const out: Record<string, DayWeather> = {}
      ;(d.daily?.time ?? []).forEach((t: string, i: number) => {
        out[t] = {
          code: d.daily.weather_code[i],
          max: d.daily.temperature_2m_max[i],
          min: d.daily.temperature_2m_min[i],
          rain: d.daily.precipitation_probability_max?.[i] ?? null,
        }
      })
      return out
    }).catch(() => { cache.delete(key); return {} }))
  }
  return cache.get(key)!
}

/** 날짜별 위치 → 그 날짜의 예보 */
export function useWeather(locs: Record<string, { lat: number; lng: number } | undefined>) {
  const [data, setData] = useState<Record<string, DayWeather>>({})
  const sig = JSON.stringify(locs)
  useEffect(() => {
    let alive = true
    const today = new Date().toISOString().slice(0, 10)
    const limit = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
    Object.entries(locs).forEach(([date, loc]) => {
      if (!loc || date < today || date > limit) return
      fetchForecast(loc.lat, loc.lng).then((f) => {
        if (alive && f[date]) setData((d) => ({ ...d, [date]: f[date] }))
      })
    })
    return () => { alive = false }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  return data
}

export function weatherLabel(code: number): [string, string] {
  if (code === 0) return ['☀️', '맑음']
  if (code <= 2) return ['🌤️', '구름 조금']
  if (code === 3) return ['☁️', '흐림']
  if (code <= 48) return ['🌫️', '안개']
  if (code <= 57) return ['🌦️', '이슬비']
  if (code <= 67) return ['🌧️', '비']
  if (code <= 77) return ['🌨️', '눈']
  if (code <= 82) return ['🌧️', '소나기']
  if (code <= 86) return ['🌨️', '눈 소나기']
  return ['⛈️', '뇌우']
}
