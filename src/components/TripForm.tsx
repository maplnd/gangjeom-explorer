import { useState } from 'react'
import type { Trip } from '../types'
import { uid } from '../utils'
import { Modal } from './Modal'

const today = () => new Date().toISOString().slice(0, 10)

export function TripForm({ trip, onSave, onClose }: { trip?: Trip; onSave: (t: Trip) => void; onClose: () => void }) {
  const [title, setTitle] = useState(trip?.title ?? '')
  const [destination, setDestination] = useState(trip?.destination ?? '')
  const [startDate, setStart] = useState(trip?.startDate ?? today())
  const [endDate, setEnd] = useState(trip?.endDate ?? today())
  const [budget, setBudget] = useState(String(trip?.budget ?? ''))
  const [currency, setCurrency] = useState(trip?.currency ?? 'KRW')
  const valid = title.trim() && startDate && endDate && endDate >= startDate

  const save = () => {
    if (!valid) return
    onSave({
      id: trip?.id ?? uid(),
      ...trip,
      stops: trip?.stops ?? [],
      expenses: trip?.expenses ?? [],
      checklist: trip?.checklist ?? [],
      notes: trip?.notes ?? [],
      destination: destination.trim(),
      createdAt: trip?.createdAt ?? Date.now(),
      title: title.trim(),
      startDate,
      endDate,
      budget: Number(budget) || 0,
      currency,
    })
  }

  return (
    <Modal
      title={trip ? '여행 정보 수정' : '새 여행 만들기'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>취소</button>
          <button className="btn primary" disabled={!valid} onClick={save}>저장</button>
        </>
      }
    >
      <label className="field">
        <span>여행 이름</span>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 도쿄 3박 4일" />
      </label>
      <label className="field">
        <span>여행지</span>
        <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="예: 일본 도쿄, 제주도" />
      </label>
      <div className="row2">
        <label className="field">
          <span>출발일</span>
          <input type="date" value={startDate} onChange={(e) => { setStart(e.target.value); if (endDate < e.target.value) setEnd(e.target.value) }} />
        </label>
        <label className="field">
          <span>도착일</span>
          <input type="date" value={endDate} min={startDate} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <div className="row2">
        <label className="field">
          <span>예산</span>
          <input type="number" inputMode="numeric" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" />
        </label>
        <label className="field">
          <span>통화</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {['KRW', 'JPY', 'USD', 'EUR', 'CNY', 'TWD', 'THB', 'VND', 'GBP', 'AUD'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      {trip && endDate < trip.endDate && (
        <p className="hint warn">기간을 줄이면 범위 밖 날짜의 일정은 목록에서 '기간 외'로 표시됩니다.</p>
      )}
    </Modal>
  )
}
