import { useRef } from 'react'
import { readLS } from '../storage'
import { ROLES, type Trip } from '../types'
import { daysBetween, fmtDate, fmtMoney, tripTotals } from '../utils'

interface Props {
  trips: Trip[]
  meId: string
  onOpen: (id: string) => void
  onNew: () => void
  onSample: () => void
  onImport: (trips: Trip[]) => void
}

const LEGACY_KEY = 'travel-log:trips'
const normalize = (t: Trip): Trip => ({ ...t, expenses: t.expenses ?? [], checklist: t.checklist ?? [], notes: t.notes ?? [] })

export function TripList({ trips, onOpen, onNew, onSample, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const legacy = readLS<Trip[]>(LEGACY_KEY, [])

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(trips.map(({ role: _r, memberIds: _m, ownerId: _o, ...t }) => t), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `여행OK-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text())
      const list = (Array.isArray(data) ? data : [data]) as Trip[]
      const ok = list.filter((t) => t && t.title && t.startDate && Array.isArray(t.stops))
      if (!ok.length) throw new Error()
      onImport(ok.map(normalize))
    } catch {
      alert('올바른 여행 기록 JSON 파일이 아닙니다.')
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = trips.filter((t) => t.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const past = trips.filter((t) => t.endDate < today)

  const card = (t: Trip) => {
    const n = daysBetween(t.startDate, t.endDate).length
    const total = tripTotals(t).total
    const pct = t.budget ? Math.min(100, (total / t.budget) * 100) : 0
    const dday = Math.round((Date.parse(t.startDate) - Date.parse(today)) / 86400000)
    return (
      <button key={t.id} className="trip-card card" onClick={() => onOpen(t.id)}>
        <div className="trip-card-top">
          <h3>{t.title}</h3>
          {t.startDate > today ? <span className="badge accent">D-{dday}</span> : t.endDate >= today ? <span className="badge accent">여행 중</span> : null}
        </div>
        <div className="muted">{t.destination && <>📍 {t.destination} · </>}{fmtDate(t.startDate)} – {fmtDate(t.endDate)} · {n - 1}박 {n}일</div>
        <div className="trip-card-stats">
          <span>🗓️ 일정 {t.stops.length}</span>
          <span>💰 {fmtMoney(total, t.currency)}</span>
          {(t.memberIds?.length ?? 1) > 1 && <span>👥 {t.memberIds!.length}명</span>}
          {t.role && t.role !== 'owner' && <span className="badge">{ROLES[t.role]}</span>}
        </div>
        {t.budget > 0 && (
          <div className="budget-bar thin"><div style={{ width: `${pct}%` }} className={total > t.budget ? 'over' : ''} /></div>
        )}
      </button>
    )
  }

  return (
    <div className="trip-list">
      <div className="list-head">
        <h1>내 여행</h1>
        <div className="head-actions">
          <button className="btn ghost sm" onClick={() => fileRef.current?.click()}>가져오기</button>
          <button className="btn ghost sm" onClick={exportAll} disabled={!trips.length}>내보내기</button>
          <button className="btn primary" onClick={onNew}>+ 새 여행</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
      </div>

      {legacy.length > 0 && (
        <div className="card notice">
          이 브라우저에 로그인 전 만든 여행 {legacy.length}개가 있어요.{' '}
          <button className="btn sm primary" onClick={() => {
            onImport(legacy.map(normalize))
            try { localStorage.removeItem(LEGACY_KEY) } catch { /* noop */ }
          }}>내 계정으로 옮기기</button>
        </div>
      )}

      {!trips.length && (
        <div className="welcome card">
          <h2>✈️ 첫 여행을 만들어 보세요</h2>
          <p>날짜별 <b>일정</b>과 <b>시간</b>, <b>비용·정산</b>, 지도 위 <b>동선</b>, <b>준비물</b>과 <b>여행 기록</b>까지. 가족을 초대해 <b>함께</b> 만들 수 있어요.</p>
          <div className="head-actions">
            <button className="btn primary" onClick={onNew}>+ 새 여행 만들기</button>
            <button className="btn" onClick={onSample}>제주 샘플 여행 추가</button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && <><h2 className="sec-title">다가오는 여행</h2><div className="cards">{upcoming.map(card)}</div></>}
      {past.length > 0 && <><h2 className="sec-title">지난 여행</h2><div className="cards">{past.map(card)}</div></>}
      {trips.length > 0 && (
        <p className="muted small center">
          <button className="link" onClick={onSample}>샘플 여행 추가</button>
        </p>
      )}
    </div>
  )
}
