import { CATEGORIES, MODES, type Leg, type Stop } from '../types'
import { fmtDistance, fmtDuration, fmtMoney, googlePlaceUrl, toMin } from '../utils'

interface Props {
  stops: Stop[] // 하루치, 정렬됨
  labels: Record<string, string>
  color: string
  legFor: (a: Stop, b: Stop) => Leg | null
  currency: string
  selectedId?: string
  onSelect: (id: string) => void
  onEdit: (s: Stop) => void
  onDelete: (s: Stop) => void
  onToggleDone: (s: Stop) => void
  onShiftNext: (next: Stop, newStart: number) => void
  canEdit: boolean
  date?: string
  dragId?: string
  dropBefore?: string | null | false // false = 이 날이 대상 아님, null = 맨 끝
  bindDrag?: (id: string, title: string) => Record<string, unknown>
}

const URL_RE = /(https?:\/\/[^\s]+)/g
function linkify(text: string) {
  return text.split(URL_RE).map((part, i) =>
    i % 2 ? <a key={i} href={part} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{part}</a> : part,
  )
}

export function Timeline({ stops, labels, color, legFor, currency, selectedId, onSelect, onEdit, onDelete, onToggleDone, onShiftNext, canEdit, date, dragId, dropBefore = false, bindDrag }: Props) {
  if (!stops.length) return <p className={`empty ${dropBefore !== false ? 'drop-here' : ''}`}>{dropBefore !== false ? '여기에 놓기' : '이 날은 아직 일정이 없어요.'}</p>
  return (
    <ol className="timeline">
      {stops.map((s, i) => {
        const next = stops[i + 1]
        const leg = next ? legFor(s, next) : null
        const gap = next ? toMin(next.start) - toMin(s.end) : 0
        const need = leg ? Math.ceil(leg.durationS / 60) : 0
        const short = leg && gap < need
        const cat = CATEGORIES[s.category]
        return (
          <li key={s.id} data-stop-id={s.id} data-date={date ?? s.date} data-next-id={next?.id ?? ''}>
            {dropBefore === s.id && <div className="drop-line" />}
            <div
              className={`stop ${selectedId === s.id ? 'sel' : ''} ${s.done ? 'done' : ''} ${dragId === s.id ? 'lifting' : ''} ${canEdit ? 'draggable' : ''}`}
              onClick={() => onSelect(s.id)}
              {...(canEdit && bindDrag ? bindDrag(s.id, s.title) : {})}
            >
              <div className="stop-time">
                <b>{s.start}</b>
                <span>{s.end}</span>
                <small>{fmtDuration(toMin(s.end) - toMin(s.start))}</small>
              </div>
              <div className="stop-dot" style={{ background: s.place ? color : '#cbd5e1' }}>{labels[s.id] ?? '·'}</div>
              <div className="stop-body">
                <div className="stop-title">
                  <span className="cat" style={{ color: cat.color }} title={cat.label}>{cat.icon}</span>
                  <strong>{s.title}</strong>
                  {s.cost > 0 && <span className="cost">{fmtMoney(s.cost, currency)}</span>}
                </div>
                {s.place ? (
                  <a className="place-link" href={googlePlaceUrl(s.place)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    📍 {s.place.name} <span className="ext">↗ 구글맵</span>
                  </a>
                ) : (
                  <span className="muted small">위치 미지정 (지도·동선에서 제외)</span>
                )}
                {s.memo && <p className="memo">{linkify(s.memo)}</p>}
                {canEdit ? (
                  <div className="stop-actions" onClick={(e) => e.stopPropagation()}>
                    <label className="check">
                      <input type="checkbox" checked={!!s.done} onChange={() => onToggleDone(s)} /> 다녀옴
                    </label>
                    <button className="link" onClick={() => onEdit(s)}>수정</button>
                    <button className="link danger" onClick={() => confirm(`'${s.title}' 일정을 삭제할까요?`) && onDelete(s)}>삭제</button>
                  </div>
                ) : s.done && <span className="muted small">✅ 다녀옴</span>}
              </div>
            </div>
            {next && (
              <div className={`leg ${short ? 'short' : ''}`}>
                {leg ? (
                  <>
                    <span>{MODES[s.modeToNext].icon} {MODES[s.modeToNext].label}</span>
                    <span>{fmtDistance(leg.distanceM)}</span>
                    <span>약 {fmtDuration(need)}</span>
                    <span className="src">{leg.source === 'google' ? 'Google' : '추정'}</span>
                    {short ? (
                      <span className="warn-text">
                        ⚠️ 여유 {fmtDuration(Math.max(gap, 0))}뿐
                        {canEdit && <button className="link" onClick={() => onShiftNext(next, toMin(s.end) + need)}>다음 일정 늦추기</button>}
                      </span>
                    ) : (
                      gap - need >= 10 && <span className="muted">여유 {fmtDuration(gap - need)}</span>
                    )}
                  </>
                ) : (
                  <span className="muted">{gap < 0 ? '⚠️ 시간이 겹칩니다' : `다음 일정까지 ${fmtDuration(gap)}`}</span>
                )}
              </div>
            )}
          </li>
        )
      })}
      {dropBefore === null && <li className="drop-line end" />}
    </ol>
  )
}
