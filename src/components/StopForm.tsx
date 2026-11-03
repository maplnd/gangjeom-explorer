import { useState } from 'react'
import { CATEGORIES, MODES, type Category, type Member, type Stop, type TravelMode } from '../types'
import { fmtDate, fromMin, toMin, uid } from '../utils'
import { Modal } from './Modal'
import { PlaceSearch } from './PlaceSearch'

interface Props {
  stop?: Stop
  days: string[]
  defaultDate: string
  defaultStart?: string
  currency: string
  members: Member[]
  meId: string
  onSave: (s: Stop) => void
  onClose: () => void
}

export function StopForm({ stop, days, defaultDate, defaultStart = '09:00', currency, members, meId, onSave, onClose }: Props) {
  const [title, setTitle] = useState(stop?.title ?? '')
  const [date, setDate] = useState(stop?.date ?? defaultDate)
  const [start, setStart] = useState(stop?.start ?? defaultStart)
  const [end, setEnd] = useState(stop?.end ?? fromMin(Math.min(toMin(defaultStart) + 60, 1439)))
  const [category, setCategory] = useState<Category>(stop?.category ?? 'sight')
  const [cost, setCost] = useState(String(stop?.cost ?? ''))
  const [memo, setMemo] = useState(stop?.memo ?? '')
  const [mode, setMode] = useState<TravelMode>(stop?.modeToNext ?? 'TRANSIT')
  const [place, setPlace] = useState(stop?.place)
  const [paidBy, setPaidBy] = useState<string>(stop ? stop.paidBy ?? '' : meId)

  const name = title.trim() || place?.name || ''
  const timeOk = toMin(end) >= toMin(start)
  const valid = !!name && timeOk && !!date

  const save = () =>
    valid &&
    onSave({
      id: stop?.id ?? uid(),
      done: stop?.done,
      title: name,
      date,
      start,
      end,
      category,
      cost: Number(cost) || 0,
      memo,
      modeToNext: mode,
      place,
      paidBy: paidBy || null,
    })

  const dayOptions = days.includes(date) ? days : [date, ...days]

  return (
    <Modal
      title={stop ? '일정 수정' : '일정 추가'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>취소</button>
          <button className="btn primary" disabled={!valid} onClick={save}>저장</button>
        </>
      }
    >
      <div className="field">
        <span>장소</span>
        <PlaceSearch value={place} onChange={setPlace} />
      </div>
      <label className="field">
        <span>일정 이름</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={place?.name || '예: 점심 · 라멘집'} />
      </label>
      <div className="row3">
        <label className="field">
          <span>날짜</span>
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            {dayOptions.map((d) => (
              <option key={d} value={d}>{days.includes(d) ? `Day ${days.indexOf(d) + 1} · ${fmtDate(d)}` : `${fmtDate(d)} (기간 외)`}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>시작</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span>종료</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      {!timeOk && <p className="hint warn">종료 시간이 시작 시간보다 빠릅니다.</p>}
      <div className="field">
        <span>분류</span>
        <div className="chips">
          {(Object.keys(CATEGORIES) as Category[]).map((c) => (
            <button
              type="button"
              key={c}
              className={`chip ${category === c ? 'on' : ''}`}
              style={category === c ? { background: CATEGORIES[c].color, borderColor: CATEGORIES[c].color } : undefined}
              onClick={() => setCategory(c)}
            >
              {CATEGORIES[c].icon} {CATEGORIES[c].label}
            </button>
          ))}
        </div>
      </div>
      <div className="row2">
        <label className="field">
          <span>비용 ({currency})</span>
          <input type="number" inputMode="decimal" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
        </label>
        <label className="field">
          <span>다음 장소까지 이동수단</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as TravelMode)}>
            {(Object.keys(MODES) as TravelMode[]).map((m) => (
              <option key={m} value={m}>{MODES[m].icon} {MODES[m].label}</option>
            ))}
          </select>
        </label>
      </div>
      {members.length > 1 && Number(cost) > 0 && (
        <label className="field">
          <span>결제한 사람 (정산용)</span>
          <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile?.display_name || m.profile?.email}</option>)}
            <option value="">미지정</option>
          </select>
        </label>
      )}
      <label className="field">
        <span>메모 · 기록</span>
        <textarea rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예약 번호, 느낀 점, 팁 등" />
      </label>
    </Modal>
  )
}
