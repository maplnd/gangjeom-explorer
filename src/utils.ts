import { MODES, type Leg, type Place, type Stop, type TravelMode, type Trip } from './types'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function daysBetween(start: string, end: string): string[] {
  const out: string[] = []
  const d = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  if (isNaN(d.getTime()) || isNaN(e.getTime())) return out
  while (d <= e && out.length < 60) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
export function fmtDate(date: string, withWeekday = true): string {
  const d = new Date(date + 'T00:00:00Z')
  if (isNaN(d.getTime())) return date
  const s = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  return withWeekday ? `${s}(${WEEK[d.getUTCDay()]})` : s
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
export const fromMin = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m}분`
  return m % 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m / 60}시간`
}

export function fmtDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)}km`
}

export function fmtMoney(n: number, currency = 'KRW'): string {
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'KRW' || currency === 'JPY' ? 0 : 2,
    }).format(n || 0)
  } catch {
    return `${(n || 0).toLocaleString('ko-KR')} ${currency}`
  }
}

export function sortStops(stops: Stop[]): Stop[] {
  return [...stops].sort((a, b) => a.date.localeCompare(b.date) || toMin(a.start) - toMin(b.start))
}

export function haversine(a: Place, b: Place): number {
  const R = 6371000
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** 직선거리 × 우회계수로 대략적인 이동 거리/시간을 추정 */
export function estimateLeg(a: Place, b: Place, mode: TravelMode): Leg {
  const distanceM = haversine(a, b) * 1.3
  const durationS = (distanceM / 1000 / MODES[mode].kmh) * 3600 + (mode === 'TRANSIT' ? 600 : 0)
  return { distanceM, durationS, source: 'estimate' }
}

export const legKey = (a: Place, b: Place, mode: TravelMode) =>
  `${a.lat.toFixed(5)},${a.lng.toFixed(5)}|${b.lat.toFixed(5)},${b.lng.toFixed(5)}|${mode}`

const placeParam = (p: Place) => `${p.lat},${p.lng}`

/** 구글맵 길찾기 URL (API 키 불필요) */
export function googleDirectionsUrl(places: Place[], mode: TravelMode = 'TRANSIT'): string | null {
  if (places.length < 2) return places.length === 1 ? googlePlaceUrl(places[0]) : null
  const origin = places[0]
  const dest = places[places.length - 1]
  const waypoints = places.slice(1, -1).slice(0, 9)
  const params = new URLSearchParams({
    api: '1',
    origin: placeParam(origin),
    destination: placeParam(dest),
    travelmode: mode.toLowerCase(),
  })
  if (waypoints.length) params.set('waypoints', waypoints.map(placeParam).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function googlePlaceUrl(p: Place): string {
  const params = new URLSearchParams({ api: '1', query: `${p.lat},${p.lng}` })
  if (p.placeId) params.set('query_place_id', p.placeId)
  return `https://www.google.com/maps/search/?${params.toString()}`
}

export function tripTotals(trip: Trip) {
  const byCategory: Record<string, number> = {}
  const byDay: Record<string, number> = {}
  let total = 0
  const add = (cat: string, day: string, amt: number) => {
    if (!amt) return
    total += amt
    byCategory[cat] = (byCategory[cat] || 0) + amt
    byDay[day] = (byDay[day] || 0) + amt
  }
  trip.stops.forEach((s) => add(s.category, s.date, s.cost))
  trip.expenses.forEach((e) => add(e.category, e.date, e.amount))
  return { total, byCategory, byDay }
}

export const DAY_COLORS = ['#ef4444', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#4b5563']
