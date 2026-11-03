import { useCallback, useEffect, useMemo, useState } from 'react'
import { googleRoute, type GoogleRoute, type GoogleStatus } from '../google'
import { MODES, ROLES, type Leg, type Member, type Place, type Stop, type TravelMode, type Trip } from '../types'
import {
  DAY_COLORS, daysBetween, estimateLeg, fmtDate, fmtDistance, fmtDuration, fmtMoney, fromMin,
  googleDirectionsUrl, legKey, sortStops, toMin, tripTotals,
} from '../utils'
import { Checklist } from './Checklist'
import { CostView } from './CostView'
import { geocode, useWeather } from '../weather'
import { WeatherBar } from './WeatherBar'
import { useStopDrag, type DropTarget } from './useStopDrag'
import { RouteSummary } from './RouteSummary'
import { Journal } from './Journal'
import { MapView, type MapPoint, type MapSegment } from './MapView'
import { StopForm } from './StopForm'
import { Timeline } from './Timeline'
import { TripForm } from './TripForm'

type Placed = Stop & { place: Place }
const hasPlace = (s: Stop): s is Placed => !!s.place

interface Props {
  trip: Trip
  meId: string
  members: Member[]
  online: string[]
  onShare: () => void
  google: GoogleStatus
  onChange: (t: Trip) => void
  onBack: () => void
  onDelete: () => void
}

type Tab = 'plan' | 'cost' | 'check' | 'journal'

export function TripView({ trip, meId, members, online, onShare, google, onChange, onBack, onDelete }: Props) {
  const canEdit = trip.role === 'owner' || trip.role === 'editor'
  const days = useMemo(() => daysBetween(trip.startDate, trip.endDate), [trip.startDate, trip.endDate])
  const [day, setDay] = useState<string>('all')
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('trip-tab') as Tab) || 'plan')
  useEffect(() => sessionStorage.setItem('trip-tab', tab), [tab])
  const [selectedId, setSelectedId] = useState<string>()
  const [editing, setEditing] = useState<Stop | 'new' | null>(null)
  const [editTrip, setEditTrip] = useState(false)
  const [routes, setRoutes] = useState<Record<string, GoogleRoute | null>>({})
  const [viewMode, setViewMode] = useState<'detail' | 'route'>(() => (localStorage.getItem('travel-ok:view') as 'route') || 'detail')
  const [pinned, setPinned] = useState(() => localStorage.getItem('travel-ok:map-pin') === '1')
  useEffect(() => { try { localStorage.setItem('travel-ok:view', viewMode); localStorage.setItem('travel-ok:map-pin', pinned ? '1' : '0') } catch { /* noop */ } }, [viewMode, pinned])

  const byDay = useMemo(() => {
    const m: Record<string, Stop[]> = {}
    sortStops(trip.stops).forEach((s) => (m[s.date] ??= []).push(s))
    return m
  }, [trip.stops])

  const allDates = useMemo(() => [...new Set([...days, ...Object.keys(byDay)])].sort(), [days, byDay])
  const visibleDates = day === 'all' ? allDates.filter((d) => byDay[d]?.length || days.includes(d)) : [day]
  const dayColor = useCallback((d: string) => DAY_COLORS[Math.max(0, allDates.indexOf(d)) % DAY_COLORS.length], [allDates])

  // 각 날짜별 위치가 있는 일정끼리의 이동 구간
  const pairs = useMemo(() => {
    const out: { date: string; a: Placed; b: Placed; mode: TravelMode }[] = []
    Object.entries(byDay).forEach(([date, list]) => {
      const placed = list.filter(hasPlace)
      for (let i = 0; i < placed.length - 1; i++) out.push({ date, a: placed[i], b: placed[i + 1], mode: placed[i].modeToNext })
    })
    return out
  }, [byDay])

  // Google 경로 조회 (가능한 경우)
  useEffect(() => {
    if (google !== 'ready') return
    let alive = true
    pairs.forEach(({ a, b, mode }) => {
      const key = legKey(a.place, b.place, mode)
      if (key in routes) return
      googleRoute(a.place, b.place, mode).then((r) => alive && setRoutes((prev) => (key in prev ? prev : { ...prev, [key]: r })))
    })
    return () => {
      alive = false
    }
  }, [google, pairs, routes])

  const legBetween = useCallback(
    (a: Place, b: Place, mode: TravelMode): Leg => routes[legKey(a, b, mode)] ?? estimateLeg(a, b, mode),
    [routes],
  )
  const legFor = useCallback(
    (a: Stop, b: Stop) => (a.place && b.place ? legBetween(a.place, b.place, a.modeToNext) : null),
    [legBetween],
  )

  const labels = useMemo(() => {
    const l: Record<string, string> = {}
    Object.values(byDay).forEach((list) => list.filter(hasPlace).forEach((s, i) => (l[s.id] = String(i + 1))))
    return l
  }, [byDay])

  const { points, segments } = useMemo(() => {
    const points: MapPoint[] = []
    const segments: MapSegment[] = []
    visibleDates.forEach((d) => {
      const color = dayColor(d)
      ;(byDay[d] ?? []).filter(hasPlace).forEach((s) => points.push({ stop: s, label: labels[s.id], color }))
    })
    pairs
      .filter((p) => visibleDates.includes(p.date))
      .forEach(({ a, b, mode, date }) => {
        const key = legKey(a.place, b.place, mode)
        segments.push({ key, from: a.place, to: b.place, color: dayColor(date), path: routes[key]?.path })
      })
    return { points, segments }
  }, [visibleDates.join(), byDay, pairs, routes, labels, dayColor])

  const daySummary = (d: string) => {
    const list = byDay[d] ?? []
    const placed = list.filter(hasPlace)
    let dist = 0
    let dur = 0
    for (let i = 0; i < placed.length - 1; i++) {
      const leg = legBetween(placed[i].place, placed[i + 1].place, placed[i].modeToNext)
      dist += leg.distanceM
      dur += leg.durationS
    }
    const cost = tripTotals({ ...trip, stops: list, expenses: trip.expenses.filter((e) => e.date === d) }).total
    const modes = placed.slice(0, -1).map((s) => s.modeToNext)
    const mainMode = modes.sort((x, y) => modes.filter((m) => m === y).length - modes.filter((m) => m === x).length)[0] ?? 'TRANSIT'
    return { count: list.length, dist, dur: dur / 60, cost, url: googleDirectionsUrl(placed.map((s) => s.place), mainMode), mainMode }
  }

  const updateStop = (s: Stop) => {
    const exists = trip.stops.some((x) => x.id === s.id)
    onChange({ ...trip, stops: exists ? trip.stops.map((x) => (x.id === s.id ? s : x)) : [...trip.stops, s] })
  }

  const newDefaults = () => {
    const date = day !== 'all' ? day : days[0] ?? trip.startDate
    const last = (byDay[date] ?? []).filter((s) => s.category !== 'lodging').at(-1)
    return { date, start: last ? fromMin(Math.min(toMin(last.end) + 30, 1380)) : '09:00' }
  }

  const [destLoc, setDestLoc] = useState<{ lat: number; lng: number }>()
  useEffect(() => { geocode(trip.destination ?? '').then(setDestLoc) }, [trip.destination])
  const weatherLocs = useMemo(() => {
    const fallback = trip.stops.find((s) => s.place)?.place ?? destLoc
    return Object.fromEntries(allDates.map((d) => {
      const p = (byDay[d] ?? []).find((s) => s.place)?.place ?? fallback
      return [d, p ? { lat: p.lat, lng: p.lng } : undefined]
    }))
  }, [allDates, byDay, trip.stops, destLoc])
  const weather = useWeather(weatherLocs)

  const totals = tripTotals(trip)

  /** 꾹 눌러 옮긴 일정: 앞 일정 종료 + 이동시간 뒤에 시작(소요시간 유지), 뒤 일정과 겹치면 뒤 일정들을 밀어냄 */
  const moveStop = (id: string, t: DropTarget) => {
    const s = trip.stops.find((x) => x.id === id)
    if (!s) return
    if (t.beforeId === id) return
    const list = (byDay[t.date] ?? []).filter((x) => x.id !== id)
    let idx = t.beforeId ? list.findIndex((x) => x.id === t.beforeId) : list.length
    if (idx < 0) idx = list.length
    const orig = byDay[s.date] ?? []
    const origIdx = orig.findIndex((x) => x.id === id)
    if (t.date === s.date && (orig[origIdx + 1]?.id ?? null) === t.beforeId) return // 제자리
    const prev = list[idx - 1]
    const next = list[idx]
    const dur = Math.max(0, toMin(s.end) - toMin(s.start))
    const travel = prev?.place && s.place ? Math.ceil(legBetween(prev.place, s.place, prev.modeToNext).durationS / 60) : 0
    let st = prev ? toMin(prev.end) + travel : next ? toMin(next.start) - dur : toMin(s.start)
    st = Math.max(0, Math.min(Math.ceil(st / 5) * 5, 1439 - dur))
    const moved: Stop = { ...s, date: t.date, start: fromMin(st), end: fromMin(st + dur) }
    // 뒤 일정과 겹치면 순서대로 밀기
    const changed = new Map<string, Stop>([[id, moved]])
    let cursor = st + dur
    for (const n of list.slice(idx)) {
      const ns = toMin(n.start)
      if (ns >= cursor) break
      const nd = Math.max(0, toMin(n.end) - ns)
      const newStart = Math.min(cursor, 1439 - nd)
      changed.set(n.id, { ...n, start: fromMin(newStart), end: fromMin(newStart + nd) })
      cursor = newStart + nd
    }
    onChange({ ...trip, stops: trip.stops.map((x) => changed.get(x.id) ?? x) })
    setSelectedId(id)
  }
  const { drag, target, bind, clickAllowed } = useStopDrag(canEdit && viewMode === 'detail', moveStop)
  const onSelect = useCallback((id: string) => { if (clickAllowed()) setSelectedId(id) }, [clickAllowed])

  return (
    <div className="trip-view">
      <div className="trip-head">
        <button className="btn ghost sm" onClick={onBack}>← 목록</button>
        <div className="trip-title">
          <h1>{trip.title}</h1>
          <div className="muted">
            {trip.destination && <>📍 {trip.destination} · </>}
            {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)} · {days.length - 1}박 {days.length}일 · 일정 {trip.stops.length}개 · 지출{' '}
            <b>{fmtMoney(totals.total, trip.currency)}</b>
            {trip.budget > 0 && <> / 예산 {fmtMoney(trip.budget, trip.currency)}</>}
          </div>
          <div className="people">
            {members.map((m) => {
              const name = m.profile?.display_name || m.profile?.email || '?'
              const on = online.includes(m.user_id)
              return (
                <span key={m.user_id} className={`avatar ${on ? 'online' : ''}`} title={`${name} · ${ROLES[m.role]}${on ? ' · 지금 보는 중' : ''}`}>
                  {name.slice(0, 1)}
                </span>
              )
            })}
            {!canEdit && <span className="badge">보기 전용</span>}
          </div>
        </div>
        <div className="head-actions">
          <button className="btn primary sm" onClick={onShare}>👥 공유</button>
          {canEdit && <button className="btn ghost sm" onClick={() => setEditTrip(true)}>여행 정보</button>}
          {trip.role === 'owner' && (
            <button className="btn ghost sm danger" onClick={() => confirm(`'${trip.title}' 여행을 삭제할까요? 모든 멤버에게서 삭제됩니다.`) && onDelete()}>삭제</button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')}>🗓️ 일정·동선</button>
        <button className={tab === 'cost' ? 'on' : ''} onClick={() => setTab('cost')}>💰 비용·정산</button>
        <button className={tab === 'check' ? 'on' : ''} onClick={() => setTab('check')}>🎒 준비물</button>
        <button className={tab === 'journal' ? 'on' : ''} onClick={() => setTab('journal')}>📔 기록</button>
      </div>

      {tab === 'cost' ? (
        <CostView trip={trip} members={members} meId={meId} canEdit={canEdit} onChange={onChange} />
      ) : tab === 'check' ? (
        <Checklist trip={trip} canEdit={canEdit} onChange={onChange} />
      ) : tab === 'journal' ? (
        <Journal trip={trip} canEdit={canEdit} onChange={onChange} />
      ) : (
        <>
          <div className="day-bar">
          <div className="day-chips">
            <button className={`chip ${day === 'all' ? 'on' : ''}`} onClick={() => setDay('all')}>전체</button>
            {allDates.map((d) => (
              <button
                key={d}
                className={`chip ${day === d ? 'on' : ''}`}
                style={day === d ? { background: dayColor(d), borderColor: dayColor(d) } : { borderColor: dayColor(d) }}
                onClick={() => setDay(d)}
              >
                {days.includes(d) ? `Day ${days.indexOf(d) + 1}` : '기간 외'} <small>{fmtDate(d)}</small>
              </button>
            ))}
          </div>
            {canEdit && <button className="btn primary sm" onClick={() => setEditing('new')}>+ 일정 추가</button>}
          </div>
          <div className="view-bar">
            <div className="seg">
              <button className={viewMode === 'detail' ? 'on' : ''} onClick={() => setViewMode('detail')}>📋 상세 일정</button>
              <button className={viewMode === 'route' ? 'on' : ''} onClick={() => setViewMode('route')}>🧭 동선 요약</button>
            </div>
            {canEdit && viewMode === 'detail' && <span className="muted small">카드를 꾹 눌러 옮길 수 있어요</span>}
          </div>

          <WeatherBar dates={allDates} days={days} weather={weather} selected={day} color={dayColor} onPick={setDay} />

          <div className="plan">
            <div className="plan-list">
              {viewMode === 'route' ? (
                <RouteSummary
                  dates={visibleDates}
                  days={days}
                  byDay={byDay}
                  labels={labels}
                  color={dayColor}
                  legFor={legFor}
                  summary={daySummary}
                  currency={trip.currency}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onPickDay={setDay}
                />
              ) : visibleDates.map((d) => {
                const sum = daySummary(d)
                return (
                  <section key={d} className={`day-section ${drag && target?.date === d ? 'drop-on' : ''}`} data-day={d}>
                    <header className="day-head" style={{ borderColor: dayColor(d) }}>
                      <div>
                        <h3>
                          <span className="day-dot" style={{ background: dayColor(d) }} />
                          {days.includes(d) ? `Day ${days.indexOf(d) + 1}` : '기간 외'} · {fmtDate(d)}
                        </h3>
                        <div className="muted small">
                          일정 {sum.count}개 · 이동 {fmtDistance(sum.dist)} / 약 {fmtDuration(sum.dur)} · 비용 {fmtMoney(sum.cost, trip.currency)}
                        </div>
                      </div>
                      {sum.url && (
                        <a className="btn sm gmaps" href={sum.url} target="_blank" rel="noreferrer" title={`${MODES[sum.mainMode].label} 기준 경로`}>
                          🗺️ 구글맵 경로
                        </a>
                      )}
                    </header>
                    <Timeline
                      stops={byDay[d] ?? []}
                      labels={labels}
                      color={dayColor(d)}
                      legFor={legFor}
                      currency={trip.currency}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      onEdit={(s) => setEditing(s)}
                      onDelete={(s) => onChange({ ...trip, stops: trip.stops.filter((x) => x.id !== s.id) })}
                      onToggleDone={(s) => updateStop({ ...s, done: !s.done })}
                      canEdit={canEdit}
                      date={d}
                      dragId={drag?.id}
                      dropBefore={drag && target?.date === d ? target.beforeId : false}
                      bindDrag={bind}
                      showPhotos={google === 'ready'}
                      onPlaceId={canEdit ? (st, placeId) => st.place && updateStop({ ...st, place: { ...st.place, placeId } }) : undefined}
                      onShiftNext={(next, start) => {
                        const len = toMin(next.end) - toMin(next.start)
                        const st = Math.min(Math.ceil(start / 5) * 5, 1439)
                        updateStop({ ...next, start: fromMin(st), end: fromMin(Math.min(st + len, 1439)) })
                      }}
                    />
                  </section>
                )
              })}
            </div>
            <div className={`plan-map ${pinned ? 'pinned' : ''}`}>
              <div className="map-holder">
                <MapView points={points} segments={segments} selectedId={selectedId} onSelect={onSelect} google={google} />
                <button className="pin-btn" onClick={() => setPinned((p) => !p)} title="스크롤해도 지도가 보이도록 고정">
                  {pinned ? '📌 고정 해제' : '📌 지도 고정'}
                </button>
              </div>
              <p className="muted small map-note">
                실선 = Google 실제 경로, 점선 = 직선(추정). 한국 내 도보·자동차 길찾기는 Google에서 제공되지 않아 추정치로 표시됩니다.
              </p>
            </div>
          </div>
        </>
      )}

      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          ↕ {drag.title}
          <small>{target ? `${days.includes(target.date) ? `Day ${days.indexOf(target.date) + 1}` : fmtDate(target.date)}로 이동` : '놓을 위치로 이동'}</small>
        </div>
      )}

      {editing && (
        <StopForm
          stop={editing === 'new' ? undefined : editing}
          days={days}
          defaultDate={newDefaults().date}
          defaultStart={newDefaults().start}
          currency={trip.currency}
          members={members}
          meId={meId}
          onClose={() => setEditing(null)}
          onSave={(s) => {
            updateStop(s)
            setEditing(null)
            setSelectedId(s.id)
          }}
        />
      )}
      {editTrip && (
        <TripForm
          trip={trip}
          onClose={() => setEditTrip(false)}
          onSave={(t) => {
            onChange(t)
            setEditTrip(false)
          }}
        />
      )}
    </div>
  )
}
