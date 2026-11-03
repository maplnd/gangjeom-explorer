import { useEffect, useRef, useState } from 'react'
import { CATEGORIES, type DayNote, type Trip } from '../types'
import { daysBetween, fmtDate, fmtMoney, sortStops, tripTotals, uid } from '../utils'

const MOODS = ['😆', '😊', '🙂', '😐', '😢', '😴']

function NoteEditor({ note, date, canEdit, onSave }: { note?: DayNote; date: string; canEdit: boolean; onSave: (n: DayNote) => void }) {
  const [body, setBody] = useState(note?.body ?? '')
  const [saved, setSaved] = useState(true)
  const timer = useRef<number>(undefined)
  const latest = useRef(note)
  latest.current = note

  // 다른 사람이 수정한 내용 반영 (내가 입력 중이 아닐 때만)
  useEffect(() => { if (saved) setBody(note?.body ?? '') }, [note?.body]) // eslint-disable-line

  const save = (b: string, mood = latest.current?.mood ?? '') => {
    onSave({ id: latest.current?.id ?? uid(), date, mood, body: b })
    setSaved(true)
  }
  const onType = (v: string) => {
    setBody(v)
    setSaved(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => save(v), 800)
  }

  return (
    <>
      <div className="moods">
        {MOODS.map((m) => (
          <button key={m} disabled={!canEdit} className={`mood ${note?.mood === m ? 'on' : ''}`} onClick={() => save(body, note?.mood === m ? '' : m)}>{m}</button>
        ))}
        <span className="muted small">{saved ? '' : '저장 중…'}</span>
      </div>
      <textarea rows={5} value={body} readOnly={!canEdit} onChange={(e) => onType(e.target.value)} onBlur={() => !saved && save(body)}
        placeholder={canEdit ? '오늘 어땠나요? 맛있었던 것, 좋았던 순간, 다음에 꼭 할 것…' : '아직 기록이 없어요.'} />
    </>
  )
}

export function Journal({ trip, canEdit, onChange }: { trip: Trip; canEdit: boolean; onChange: (t: Trip) => void }) {
  const days = daysBetween(trip.startDate, trip.endDate)
  const { byDay } = tripTotals(trip)
  const sorted = sortStops(trip.stops)

  const saveNote = (n: DayNote) => {
    const exists = trip.notes.some((x) => x.date === n.date)
    onChange({ ...trip, notes: exists ? trip.notes.map((x) => (x.date === n.date ? { ...n, id: x.id } : x)) : [...trip.notes, n] })
  }

  return (
    <div className="journal">
      {days.map((d, i) => {
        const stops = sorted.filter((s) => s.date === d)
        const visited = stops.filter((s) => s.done)
        return (
          <section key={d} className="card journal-day">
            <header>
              <h3>Day {i + 1} · {fmtDate(d)}</h3>
              <span className="muted small">다녀옴 {visited.length}/{stops.length} · 지출 {fmtMoney(byDay[d] || 0, trip.currency)}</span>
            </header>
            {stops.length > 0 && (
              <div className="journal-stops">
                {stops.map((s) => (
                  <span key={s.id} className={`jstop ${s.done ? 'on' : ''}`}>{s.done ? '✅' : CATEGORIES[s.category].icon} {s.title}</span>
                ))}
              </div>
            )}
            <NoteEditor note={trip.notes.find((n) => n.date === d)} date={d} canEdit={canEdit} onSave={saveNote} />
          </section>
        )
      })}
    </div>
  )
}
