import { useEffect, useRef, useState } from 'react'
import { placePhoto, type PlacePhotoResult } from '../google'
import type { Place } from '../types'

/** 화면에 보일 때만 Google 장소 대표 사진을 불러와 표시 */
export function PlacePhoto({ place, title, onPlaceId }: { place: Place; title: string; onPlaceId?: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [res, setRes] = useState<PlacePhotoResult | null | undefined>(undefined)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect() } }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let alive = true
    placePhoto(place, title).then((r) => {
      if (!alive) return
      setRes(r)
      if (r?.placeId && !place.placeId) onPlaceId?.(r.placeId)
    })
    return () => { alive = false }
  }, [visible, place.placeId, place.lat, place.lng, title]) // eslint-disable-line react-hooks/exhaustive-deps

  if (res === null || (res && !res.url) || broken) return <div ref={ref} />
  return (
    <div ref={ref} className={`place-photo ${res?.url ? 'loaded' : ''}`}>
      {res?.url && (
        <>
          <img src={res.url} alt={`${title} 대표 사진`} loading="lazy" onError={() => setBroken(true)} />
          {res.author && (
            <a className="photo-credit" href={res.authorUri} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              📷 {res.author} · Google
            </a>
          )}
        </>
      )}
    </div>
  )
}
