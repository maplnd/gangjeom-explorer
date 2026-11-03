import { useEffect, useState } from 'react'

export interface DayWeather {
  code: number
  max: number
  min: number
  rain: number | null // 강수확률(%) — 예보일 때
  rainMm?: number | null // 강수량(mm) — 작년 기록일 때
  kind: 'forecast' | 'lastyear'
}
type Loc = { lat: number; lng: number }

const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min'
const cache = new Map<string, Promise<Record<string, DayWeather>>>()

function cached(key: string, fn: () => Promise<Record<string, DayWeather>>) {
  if (!cache.has(key)) cache.set(key, fn().catch(() => { cache.delete(key); return {} }))
  return cache.get(key)!
}

/** Open-Meteo 일별 예보 (무료, 키 불필요, 오늘부터 16일) */
function forecast(loc: Loc) {
  const k = `f:${loc.lat.toFixed(2)},${loc.lng.toFixed(2)}`
  return cached(k, async () => {
    const d = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat.toFixed(3)}&longitude=${loc.lng.toFixed(3)}` +
      `&daily=${DAILY},precipitation_probability_max&timezone=auto&forecast_days=16`)).json()
    const out: Record<string, DayWeather> = {}
    ;(d.daily?.time ?? []).forEach((t: string, i: number) => {
      out[t] = { code: d.daily.weather_code[i], max: d.daily.temperature_2m_max[i], min: d.daily.temperature_2m_min[i],
        rain: d.daily.precipitation_probability_max?.[i] ?? null, kind: 'forecast' }
    })
    return out
  })
}

const shiftYear = (date: string, y: number) => `${Number(date.slice(0, 4)) + y}${date.slice(4)}`.replace(/-02-29$/, '-02-28')

/** 예보 범위 밖 날짜: 작년 같은 날 실제 날씨 (Open-Meteo Archive) */
function lastYear(loc: Loc, start: string, end: string) {
  const s = shiftYear(start, -1), e = shiftYear(end, -1)
  const k = `a:${loc.lat.toFixed(2)},${loc.lng.toFixed(2)}:${s}:${e}`
  return cached(k, async () => {
    const d = await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${loc.lat.toFixed(3)}&longitude=${loc.lng.toFixed(3)}` +
      `&start_date=${s}&end_date=${e}&daily=${DAILY},precipitation_sum&timezone=auto`)).json()
    const out: Record<string, DayWeather> = {}
    ;(d.daily?.time ?? []).forEach((t: string, i: number) => {
      if (d.daily.temperature_2m_max[i] == null) return
      out[shiftYear(t, 1)] = { code: d.daily.weather_code[i], max: d.daily.temperature_2m_max[i], min: d.daily.temperature_2m_min[i],
        rain: null, rainMm: d.daily.precipitation_sum?.[i] ?? null, kind: 'lastyear' }
    })
    return out
  })
}

/** 여행지 이름으로 좌표 찾기 (장소가 하나도 없을 때) */
const geoCache = new Map<string, Promise<Loc | undefined>>()
export function geocode(name: string): Promise<Loc | undefined> {
  const q = name.trim()
  if (!q) return Promise.resolve(undefined)
  if (!geoCache.has(q)) {
    geoCache.set(q, fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=ko&name=${encodeURIComponent(q.split(/[,\s]+/).pop() || q)}`)
      .then((r) => r.json()).then((d) => (d.results?.[0] ? { lat: d.results[0].latitude, lng: d.results[0].longitude } : undefined))
      .catch(() => undefined))
  }
  return geoCache.get(q)!
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

/** 날짜별 위치 → 그 날짜의 날씨 (16일 이내는 예보, 그 밖은 작년 같은 날) */
export function useWeather(locs: Record<string, Loc | undefined>) {
  const [data, setData] = useState<Record<string, DayWeather>>({})
  const sig = JSON.stringify(locs)
  useEffect(() => {
    let alive = true
    setData({})
    const today = iso(Date.now())
    const limit = iso(Date.now() + 15 * 86400000)
    const lastArchive = iso(Date.now() - 6 * 86400000) // 아카이브는 며칠 늦게 반영됨
    const byLoc = new Map<string, { loc: Loc; dates: string[] }>()
    Object.entries(locs).forEach(([date, loc]) => {
      if (!loc) return
      const k = `${loc.lat.toFixed(2)},${loc.lng.toFixed(2)}`
      if (!byLoc.has(k)) byLoc.set(k, { loc, dates: [] })
      byLoc.get(k)!.dates.push(date)
    })
    byLoc.forEach(({ loc, dates }) => {
      const fc = dates.filter((d) => d >= today && d <= limit)
      const old = dates.filter((d) => !fc.includes(d) && shiftYear(d, -1) <= lastArchive).sort()
      const apply = (r: Record<string, DayWeather>, list: string[]) => {
        if (!alive) return
        setData((prev) => {
          const next = { ...prev }
          list.forEach((d) => { if (r[d]) next[d] = r[d] })
          return next
        })
      }
      if (fc.length) forecast(loc).then((r) => apply(r, fc))
      if (old.length) lastYear(loc, old[0], old[old.length - 1]).then((r) => apply(r, old))
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
