import { useState } from 'react'
import { envKey, useGoogleMaps } from './google'
import { sampleTrip } from './sample'
import { useLocalStorage } from './storage'
import type { Trip } from './types'
import { Settings } from './components/Settings'
import { TripForm } from './components/TripForm'
import { TripList } from './components/TripList'
import { TripView } from './components/TripView'

export default function App() {
  const [trips, setTrips] = useLocalStorage<Trip[]>('travel-log:trips', [])
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(location.hash.slice(1)).get('trip'))
  const [apiKey, setApiKey] = useLocalStorage<string>('travel-log:gmaps-key', '')
  const [showSettings, setShowSettings] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const google = useGoogleMaps(apiKey || envKey)

  const open = (id: string | null) => {
    setOpenId(id)
    history.replaceState(null, '', id ? `#trip=${id}` : location.pathname)
    window.scrollTo(0, 0)
  }
  const trip = trips.find((t) => t.id === openId)
  const upsert = (t: Trip) => setTrips((list) => (list.some((x) => x.id === t.id) ? list.map((x) => (x.id === t.id ? t : x)) : [...list, t]))

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => open(null)}>🧭 여행 기록</button>
        <button className={`map-status ${google}`} onClick={() => setShowSettings(true)} title="Google 지도 연동 설정">
          {google === 'ready' ? '● Google 지도' : google === 'error' ? '● 지도 오류' : google === 'loading' ? '● 연결 중' : '⚙️ 구글맵 연동'}
        </button>
      </header>

      <main>
        {trip ? (
          <TripView
            key={trip.id}
            trip={trip}
            google={google}
            onChange={upsert}
            onBack={() => open(null)}
            onDelete={() => {
              setTrips((l) => l.filter((t) => t.id !== trip.id))
              open(null)
            }}
          />
        ) : (
          <TripList
            trips={trips}
            onOpen={open}
            onNew={() => setShowNew(true)}
            onSample={() => {
              const t = sampleTrip()
              upsert(t)
              open(t.id)
            }}
            onImport={(list) => {
              setTrips((cur) => [...cur.filter((t) => !list.some((n) => n.id === t.id)), ...list])
            }}
          />
        )}
      </main>

      {showNew && (
        <TripForm
          onClose={() => setShowNew(false)}
          onSave={(t) => {
            upsert(t)
            setShowNew(false)
            open(t.id)
          }}
        />
      )}
      {showSettings && (
        <Settings
          apiKey={apiKey}
          status={google}
          onClose={() => setShowSettings(false)}
          onSave={(k) => {
            setApiKey(k)
            try { localStorage.setItem('travel-log:gmaps-key', JSON.stringify(k)) } catch { /* noop */ }
            location.reload()
          }}
        />
      )}
    </div>
  )
}
