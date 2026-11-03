import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Place, Stop } from '../types'
import { CATEGORIES } from '../types'
import { consumeQuota, type GoogleStatus } from '../google'

export interface MapPoint {
  stop: Stop & { place: Place }
  label: string
  color: string
}
export interface MapSegment {
  key: string
  from: Place
  to: Place
  color: string
  path?: { lat: number; lng: number }[]
}
interface Props {
  points: MapPoint[]
  segments: MapSegment[]
  selectedId?: string
  onSelect: (id: string) => void
  google: GoogleStatus
  quotaOut?: boolean
}

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 } // 서울

export function MapView(props: Props) {
  // 구글 지도는 띄울 때마다 과금되므로, 서버의 하루 상한 안에서만 사용
  const [allowed, setAllowed] = useState<boolean | null>(null)
  useEffect(() => {
    if (props.google !== 'ready') return
    let alive = true
    consumeQuota('map').then((ok) => alive && setAllowed(ok))
    return () => { alive = false }
  }, [props.google])
  if (props.google === 'ready' && allowed === null) return <div className="map map-wait" />
  return props.google === 'ready' && allowed ? <GoogleMapView {...props} /> : <LeafletMapView {...props} quotaOut={props.google === 'ready' && allowed === false} />
}

const popupHtml = (p: MapPoint) => {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  const c = CATEGORIES[p.stop.category]
  return `<div class="map-pop"><b>${esc(p.label)}. ${esc(p.stop.title)}</b><br/>${c.icon} ${c.label} · ${p.stop.start}–${p.stop.end}<br/><span>${esc(p.stop.place.name)}</span></div>`
}

/* ---------------- Google Maps ---------------- */

function GoogleMapView({ points, segments, selectedId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const info = useRef<google.maps.InfoWindow | null>(null)
  const overlays = useRef<{ setMap: (m: null) => void }[]>([])
  const markers = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map())
  const ready = useRef<Promise<void> | null>(null)

  useEffect(() => {
    ready.current = (async () => {
      const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary
      await google.maps.importLibrary('marker')
      if (!el.current) return
      map.current = new Map(el.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
        mapId: 'DEMO_MAP_ID',
        gestureHandling: 'greedy',
        mapTypeControl: false,
        streetViewControl: false,
      })
      info.current = new google.maps.InfoWindow()
    })()
  }, [])

  useEffect(() => {
    let cancelled = false
    ready.current?.then(() => {
      const m = map.current
      if (cancelled || !m) return
      overlays.current.forEach((o) => o.setMap(null))
      overlays.current = []
      markers.current.clear()
      const bounds = new google.maps.LatLngBounds()

      segments.forEach((s) => {
        const straight = !s.path
        const line = new google.maps.Polyline({
          map: m,
          path: s.path ?? [s.from, s.to],
          strokeColor: s.color,
          strokeOpacity: straight ? 0 : 0.85,
          strokeWeight: 4,
          icons: straight
            ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeWeight: 3, scale: 3 }, offset: '0', repeat: '14px' }]
            : [{ icon: { path: google.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2.5 }, offset: '50%' }],
        })
        overlays.current.push(line)
      })

      points.forEach((p) => {
        const pin = new google.maps.marker.PinElement({
          glyphText: p.label,
          glyphColor: '#fff',
          background: p.color,
          borderColor: '#fff',
        })
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: m,
          position: { lat: p.stop.place.lat, lng: p.stop.place.lng },
          content: pin,
          title: p.stop.title,
          gmpClickable: true,
        })
        marker.addEventListener('gmp-click', () => {
          onSelect(p.stop.id)
        })
        markers.current.set(p.stop.id, marker)
        overlays.current.push({ setMap: () => (marker.map = null) })
        bounds.extend({ lat: p.stop.place.lat, lng: p.stop.place.lng })
      })

      if (points.length === 1) {
        m.setCenter(bounds.getCenter())
        m.setZoom(14)
      } else if (points.length > 1) {
        m.fitBounds(bounds, 48)
      }
    })
    return () => {
      cancelled = true
    }
  }, [points, segments, onSelect])

  useEffect(() => {
    ready.current?.then(() => {
      const p = points.find((x) => x.stop.id === selectedId)
      const marker = selectedId ? markers.current.get(selectedId) : undefined
      if (!p || !marker || !map.current || !info.current) return
      info.current.setContent(popupHtml(p))
      info.current.open({ map: map.current, anchor: marker })
      map.current.panTo({ lat: p.stop.place.lat, lng: p.stop.place.lng })
    })
  }, [selectedId, points])

  return <div ref={el} className="map" />
}

/* ---------------- Leaflet (API 키 없을 때) ---------------- */

function LeafletMapView({ points, segments, selectedId, onSelect, google, quotaOut }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const markers = useRef<Map<string, L.Marker>>(new Map())

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { zoomControl: true }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    markers.current.clear()
    segments.forEach((s) => {
      L.polyline(s.path ?? [s.from, s.to], {
        color: s.color,
        weight: 4,
        opacity: 0.85,
        dashArray: s.path ? undefined : '6 8',
      }).addTo(g)
    })
    points.forEach((p) => {
      const icon = L.divIcon({
        className: 'num-pin-wrap',
        html: `<div class="num-pin" style="background:${p.color}">${p.label}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      const mk = L.marker([p.stop.place.lat, p.stop.place.lng], { icon, title: p.stop.title })
        .bindPopup(popupHtml(p))
        .on('click', () => onSelect(p.stop.id))
        .addTo(g)
      markers.current.set(p.stop.id, mk)
    })
    if (points.length === 1) m.setView([points[0].stop.place.lat, points[0].stop.place.lng], 14)
    else if (points.length > 1)
      m.fitBounds(L.latLngBounds(points.map((p) => [p.stop.place.lat, p.stop.place.lng] as [number, number])), { padding: [36, 36] })
  }, [points, segments, onSelect])

  useEffect(() => {
    const mk = selectedId ? markers.current.get(selectedId) : undefined
    if (mk && map.current) {
      mk.openPopup()
      map.current.panTo(mk.getLatLng())
    }
  }, [selectedId, points])

  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      <div className="map-badge">
        {quotaOut ? '오늘 Google 지도 사용량 한도 도달 → 무료 지도 표시 중' : google === 'error' ? '⚠️ Google 지도 로드 실패 → OpenStreetMap 표시 중' : google === 'loading' ? 'Google 지도 불러오는 중…' : 'OpenStreetMap · 설정에서 Google 지도 연동'}
      </div>
    </div>
  )
}
