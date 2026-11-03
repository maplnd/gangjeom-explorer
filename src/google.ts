import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Leg, Place, TravelMode } from './types'
import { legKey } from './utils'

export type GoogleStatus = 'none' | 'loading' | 'ready' | 'error'

let loadPromise: Promise<void> | null = null
let status: GoogleStatus = 'none'
const listeners = new Set<(s: GoogleStatus) => void>()
const setStatus = (s: GoogleStatus) => {
  status = s
  listeners.forEach((l) => l(s))
}

export const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''

function load(key: string): Promise<void> {
  if (loadPromise) return loadPromise
  setStatus('loading')
  loadPromise = new Promise<void>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>
    w.__gmapsReady = () => {
      setStatus('ready')
      resolve()
    }
    // 잘못된 키/미허용 도메인일 때 구글이 호출하는 전역 콜백
    w.gm_authFailure = () => setStatus('error')
    const s = document.createElement('script')
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&v=weekly&language=ko&region=KR&loading=async&callback=__gmapsReady`
    s.async = true
    s.onerror = () => {
      setStatus('error')
      reject(new Error('Google Maps 스크립트를 불러오지 못했습니다'))
    }
    document.head.appendChild(s)
  })
  return loadPromise
}

/** API 키가 있으면 Google Maps JS API를 불러오고 상태를 반환 */
export function useGoogleMaps(key: string): GoogleStatus {
  const [s, setS] = useState<GoogleStatus>(key ? status : 'none')
  useEffect(() => {
    if (!key) return
    listeners.add(setS)
    load(key).catch(() => {})
    setS(status)
    return () => {
      listeners.delete(setS)
    }
  }, [key])
  return key ? s : 'none'
}

export const isGoogleReady = () => status === 'ready'

/** 하루 사용량 상한 (서버에서 집계: 지도 300회, 장소검색 100회, 경로 300회). 넘으면 무료 대체 수단 사용 */
export async function consumeQuota(kind: 'map' | 'places' | 'routes'): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('use_quota', { p_kind: kind })
    return !error && data === true
  } catch {
    return false
  }
}

/* ---------- 장소 검색 ---------- */

export async function searchPlacesGoogle(query: string): Promise<Place[]> {
  const { Place } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary
  const { places } = await Place.searchByText({
    textQuery: query,
    fields: ['displayName', 'formattedAddress', 'location', 'id'],
    language: 'ko',
    maxResultCount: 8,
  })
  return places
    .filter((p) => p.location)
    .map((p) => ({
      name: p.displayName || query,
      address: p.formattedAddress || undefined,
      lat: p.location!.lat(),
      lng: p.location!.lng(),
      placeId: p.id,
    }))
}

/** API 키가 없을 때 사용하는 OpenStreetMap(Nominatim) 검색 */
export async function searchPlacesOSM(query: string): Promise<Place[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=ko&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('검색 실패')
  const data = (await res.json()) as { name?: string; display_name: string; lat: string; lon: string }[]
  return data.map((d) => ({
    name: d.name || d.display_name.split(',')[0],
    address: d.display_name,
    lat: Number(d.lat),
    lng: Number(d.lon),
  }))
}

export function searchPlaces(query: string): Promise<Place[]> {
  if (!isGoogleReady()) return searchPlacesOSM(query)
  return consumeQuota('places').then((ok) => (ok ? searchPlacesGoogle(query).catch(() => searchPlacesOSM(query)) : searchPlacesOSM(query)))
}

/* ---------- 경로 (Directions) ---------- */

export interface GoogleRoute extends Leg {
  path: google.maps.LatLngLiteral[]
}

const routeCache = new Map<string, Promise<GoogleRoute | null>>()

export function googleRoute(a: Place, b: Place, mode: TravelMode): Promise<GoogleRoute | null> {
  const key = legKey(a, b, mode)
  const cached = routeCache.get(key)
  if (cached) return cached
  const p = (async () => {
    try {
      if (!(await consumeQuota('routes'))) {
        routeCache.delete(key)
        return null
      }
      const { DirectionsService } = (await google.maps.importLibrary('routes')) as google.maps.RoutesLibrary
      const res = await new DirectionsService().route({
        origin: { lat: a.lat, lng: a.lng },
        destination: { lat: b.lat, lng: b.lng },
        travelMode: mode as google.maps.TravelMode,
      })
      const route = res.routes[0]
      const leg = route?.legs[0]
      if (!route || !leg) return null
      return {
        distanceM: leg.distance?.value ?? 0,
        durationS: leg.duration?.value ?? 0,
        source: 'google' as const,
        path: route.overview_path.map((ll) => ll.toJSON()),
      }
    } catch {
      // 한국 등 일부 지역은 구글 도보/자동차 길찾기를 지원하지 않음 → 추정치 사용
      return null
    }
  })()
  routeCache.set(key, p)
  return p
}

