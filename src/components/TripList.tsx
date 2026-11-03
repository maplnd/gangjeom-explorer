import { useRef } from 'react'
import type { Trip } from '../types'
import { daysBetween, fmtDate, fmtMoney, tripTotals } from '../utils'

interface Props {
  trips: Trip[]
  onOpen: (id: string) => void
  onNew: () => void
  onSample: () => void
  onImport: (trips: Trip[]) => void
}

export function TripList({ trips, onOpen, onNew, onSample, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(trips, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `travel-log-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text())
      const list = (Array.isArray(data) ? data : [data]) as Trip[]
      const ok = list.filter((t) => t && t.id && t.title && Array.isArray(t.stops))
      if (!ok.length) throw new Error()
      onImport(ok.map((t) => ({ ...t, expenses: t.expenses ?? [] })))
    } catch {
      alert('올바른 여행 기록 JSON 파일이 아닙니다.')
    }
  }

  const sorted = [...trips].sort((a, b) => b.startDate.localeCompare(a.startDate))

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

      {!trips.length && (
        <div className="welcome card">
          <h2>✈️ 여행을 기록해 보세요</h2>
          <p>날짜별 <b>일정</b>과 <b>시간</b>, 장소별 <b>비용</b>, 그리고 <b>동선</b>을 지도 위에서 한눈에 확인하고, 버튼 하나로 <b>구글맵 길찾기</b>로 이어집니다.</p>
          <div className="head-actions">
            <button className="btn primary" onClick={onNew}>+ 새 여행 만들기</button>
            <button className="btn" onClick={onSample}>제주 샘플 여행 보기</button>
          </div>
        </div>
      )}

      <div className="cards">
        {sorted.map((t) => {
          const n = daysBetween(t.startDate, t.endDate).length
          const total = tripTotals(t).total
          const pct = t.budget ? Math.min(100, (total / t.budget) * 100) : 0
          const doneCount = t.stops.filter((s) => s.done).length
          return (
            <button key={t.id} className="trip-card card" onClick={() => onOpen(t.id)}>
              <h3>{t.title}</h3>
              <div className="muted">{fmtDate(t.startDate)} – {fmtDate(t.endDate)} · {n - 1}박 {n}일</div>
              <div className="trip-card-stats">
                <span>🗓️ 일정 {t.stops.length}</span>
                <span>✅ 다녀옴 {doneCount}</span>
                <span>💰 {fmtMoney(total, t.currency)}</span>
              </div>
              {t.budget > 0 && (
                <div className="budget-bar thin"><div style={{ width: `${pct}%` }} className={total > t.budget ? 'over' : ''} /></div>
              )}
            </button>
          )
        })}
      </div>
      {trips.length > 0 && (
        <p className="muted small center">
          데이터는 이 브라우저에 저장됩니다. 다른 기기로 옮길 땐 ‘내보내기/가져오기’를 이용하세요. ·{' '}
          <button className="link" onClick={onSample}>샘플 여행 추가</button>
        </p>
      )}
    </div>
  )
}
