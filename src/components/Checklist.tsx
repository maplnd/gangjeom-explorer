import { useState } from 'react'
import type { ChecklistItem, Trip } from '../types'
import { uid } from '../utils'

const CATS = ['서류', '전자기기', '의류', '생활·위생', '약', '기타']
const TEMPLATE: [string, string][] = [
  ['여권 / 신분증', '서류'], ['항공권 · 숙소 예약 확인서', '서류'], ['카드 · 현금', '서류'], ['여행자 보험', '서류'],
  ['휴대폰 충전기', '전자기기'], ['보조배터리', '전자기기'], ['멀티 어댑터 (해외)', '전자기기'], ['유심 / eSIM (해외)', '전자기기'],
  ['갈아입을 옷 · 속옷', '의류'], ['잠옷', '의류'], ['편한 신발', '의류'], ['우산 · 우비', '의류'],
  ['세면도구 · 칫솔', '생활·위생'], ['선크림', '생활·위생'], ['물티슈 · 휴지', '생활·위생'],
  ['상비약 (소화제 · 진통제 · 밴드)', '약'],
]

export function Checklist({ trip, canEdit, onChange }: { trip: Trip; canEdit: boolean; onChange: (t: Trip) => void }) {
  const [text, setText] = useState('')
  const [cat, setCat] = useState('기타')
  const items = trip.checklist
  const done = items.filter((i) => i.done).length
  const set = (checklist: ChecklistItem[]) => onChange({ ...trip, checklist })
  const nextSort = () => Math.max(0, ...items.map((i) => i.sort)) + 1

  const add = () => {
    if (!text.trim()) return
    set([...items, { id: uid(), text: text.trim(), category: cat, done: false, sort: nextSort() }])
    setText('')
  }
  const addTemplate = () => {
    const have = new Set(items.map((i) => i.text))
    let s = nextSort()
    set([...items, ...TEMPLATE.filter(([t]) => !have.has(t)).map(([t, c]) => ({ id: uid(), text: t, category: c, done: false, sort: s++ }))])
  }

  const groups = [...new Set([...CATS, ...items.map((i) => i.category)])].filter((c) => items.some((i) => i.category === c))

  return (
    <div className="checklist">
      <div className="stat-row">
        <div className="stat"><span>준비 완료</span><b>{done} / {items.length}</b></div>
      </div>
      {items.length > 0 && (
        <div className="budget-bar"><div style={{ width: `${(done / items.length) * 100}%` }} /><span>{Math.round((done / items.length) * 100)}%</span></div>
      )}
      {canEdit && (
        <div className="card">
          <div className="expense-form checklist-form">
            <select value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <input placeholder="준비물 추가 (예: 선글라스)" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button className="btn primary" onClick={add}>추가</button>
          </div>
          <button className="link small" onClick={addTemplate}>+ 기본 준비물 목록 불러오기</button>
        </div>
      )}
      {!items.length && <p className="empty">아직 준비물이 없어요. {canEdit && '‘기본 준비물 목록 불러오기’로 시작해 보세요.'}</p>}
      <div className="cost-grid">
        {groups.map((g) => (
          <section className="card" key={g}>
            <h3>{g}</h3>
            <ul className="check-list">
              {items.filter((i) => i.category === g).map((i) => (
                <li key={i.id} className={i.done ? 'done' : ''}>
                  <label className="check">
                    <input type="checkbox" checked={i.done} disabled={!canEdit} onChange={() => set(items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)))} />
                    <span>{i.text}</span>
                  </label>
                  {canEdit && <button className="icon-btn" aria-label="삭제" onClick={() => set(items.filter((x) => x.id !== i.id))}>✕</button>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
