import { useState } from 'react'
import { searchPlaces, isGoogleReady } from '../google'
import type { Place } from '../types'

export function PlaceSearch({ value, onChange }: { value?: Place; onChange: (p?: Place) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manual, setManual] = useState(false)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')

  const run = async () => {
    if (!q.trim()) return
    setLoading(true)
    setError('')
    try {
      const r = await searchPlaces(q.trim())
      setResults(r)
      if (!r.length) setError('검색 결과가 없습니다. 다른 키워드로 시도해 보세요.')
    } catch {
      setError('장소 검색에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (value) {
    return (
      <div className="place-chosen">
        <div>
          <strong>📍 {value.name}</strong>
          {value.address && <div className="muted small">{value.address}</div>}
          <div className="muted small">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</div>
        </div>
        <button type="button" className="btn ghost sm" onClick={() => onChange(undefined)}>변경</button>
      </div>
    )
  }

  return (
    <div className="place-search">
      <div className="search-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); run() } }}
          placeholder="장소 이름/주소 검색 (예: 성산일출봉)"
        />
        <button type="button" className="btn" onClick={run} disabled={loading}>{loading ? '검색 중…' : '검색'}</button>
      </div>
      <div className="muted small">
        {isGoogleReady() ? 'Google Places 검색' : 'OpenStreetMap 검색 (설정에서 Google API 키를 넣으면 구글 검색 사용)'}
        {' · '}
        <button type="button" className="link" onClick={() => setManual((m) => !m)}>좌표 직접 입력</button>
      </div>
      {manual && (
        <div className="search-row">
          <input placeholder="위도 (33.4581)" value={lat} onChange={(e) => setLat(e.target.value)} />
          <input placeholder="경도 (126.9425)" value={lng} onChange={(e) => setLng(e.target.value)} />
          <button
            type="button"
            className="btn"
            disabled={!isFinite(parseFloat(lat)) || !isFinite(parseFloat(lng))}
            onClick={() => onChange({ name: q.trim() || '지정한 위치', lat: parseFloat(lat), lng: parseFloat(lng) })}
          >
            적용
          </button>
        </div>
      )}
      {error && <div className="hint warn">{error}</div>}
      {results && results.length > 0 && (
        <ul className="results">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => { onChange(r); setResults(null) }}>
                <strong>{r.name}</strong>
                {r.address && <span className="muted small">{r.address}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
