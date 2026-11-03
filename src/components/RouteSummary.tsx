import { CATEGORIES, MODES, type Leg, type Stop, type TravelMode } from '../types'
import { fmtDate, fmtDistance, fmtDuration, fmtMoney } from '../utils'

interface Props {
  dates: string[]
  days: string[]
  byDay: Record<string, Stop[]>
  labels: Record<string, string>
  color: (d: string) => string
  legFor: (a: Stop, b: Stop) => Leg | null
  summary: (d: string) => { count: number; dist: number; dur: number; cost: number; url: string | null; mainMode: TravelMode }
  currency: string
  selectedId?: string
  onSelect: (id: string) => void
  onPickDay: (d: string) => void
}

/** 날짜별 동선을 한 줄 흐름으로 한눈에 */
export function RouteSummary({ dates, days, byDay, labels, color, legFor, summary, currency, selectedId, onSelect, onPickDay }: Props) {
  return (
    <div className="route-summary">
      {dates.map((d) => {
        const stops = byDay[d] ?? []
        const sum = summary(d)
        const c = color(d)
        return (
          <section key={d} className="rs-day card" style={{ borderLeftColor: c }}>
            <header>
              <button className="rs-title" onClick={() => onPickDay(d)} title="이 날만 보기">
                <span className="day-dot" style={{ background: c }} />
                <b>{days.includes(d) ? `Day ${days.indexOf(d) + 1}` : '기간 외'}</b> {fmtDate(d)}
              </button>
              <span className="muted small">{fmtDistance(sum.dist)} · 이동 {fmtDuration(sum.dur)} · {fmtMoney(sum.cost, currency)}</span>
              {sum.url && <a className="link small" href={sum.url} target="_blank" rel="noreferrer">🗺️ 구글맵</a>}
            </header>
            {!stops.length ? <p className="muted small">일정 없음</p> : (
              <div className="rs-flow">
                {stops.map((s, i) => {
                  const next = stops[i + 1]
                  const leg = next ? legFor(s, next) : null
                  return (
                    <span key={s.id} className="rs-item">
                      <button className={`rs-stop ${selectedId === s.id ? 'sel' : ''} ${s.done ? 'done' : ''}`} onClick={() => onSelect(s.id)} title={`${s.start}–${s.end} ${s.title}`}>
                        <span className="rs-num" style={{ background: s.place ? c : '#cbd5e1' }}>{labels[s.id] ?? '·'}</span>
                        <span className="rs-time">{s.start}</span>
                        <span className="rs-name">{CATEGORIES[s.category].icon} {s.title}</span>
                      </button>
                      {next && (
                        <span className="rs-leg">
                          → {leg ? <>{MODES[s.modeToNext].icon} {fmtDuration(leg.durationS / 60)}</> : ''}
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
