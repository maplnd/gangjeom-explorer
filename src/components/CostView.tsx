import { useState } from 'react'
import { CATEGORIES, type Category, type Expense, type Trip } from '../types'
import { daysBetween, fmtDate, fmtMoney, tripTotals, uid } from '../utils'

export function CostView({ trip, onChange }: { trip: Trip; onChange: (t: Trip) => void }) {
  const days = daysBetween(trip.startDate, trip.endDate)
  const { total, byCategory, byDay } = tripTotals(trip)
  const cur = trip.currency
  const pct = trip.budget ? Math.min(100, (total / trip.budget) * 100) : 0
  const over = trip.budget > 0 && total > trip.budget
  const maxCat = Math.max(1, ...Object.values(byCategory))
  const maxDay = Math.max(1, ...Object.values(byDay))
  const allDays = [...new Set([...days, ...Object.keys(byDay)])].sort()

  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(days[0] ?? trip.startDate)
  const [category, setCategory] = useState<Category>('etc')

  const addExpense = () => {
    if (!label.trim() || !Number(amount)) return
    const e: Expense = { id: uid(), label: label.trim(), amount: Number(amount), date, category }
    onChange({ ...trip, expenses: [...trip.expenses, e] })
    setLabel('')
    setAmount('')
  }

  const rows = [
    ...trip.stops.filter((s) => s.cost > 0).map((s) => ({ id: s.id, date: s.date, label: s.title, category: s.category, amount: s.cost, kind: 'stop' as const })),
    ...trip.expenses.map((e) => ({ ...e, kind: 'expense' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="cost">
      <div className="stat-row">
        <div className="stat"><span>총 지출</span><b>{fmtMoney(total, cur)}</b></div>
        <div className="stat"><span>예산</span><b>{trip.budget ? fmtMoney(trip.budget, cur) : '미설정'}</b></div>
        <div className="stat"><span>{over ? '초과' : '남은 예산'}</span><b className={over ? 'neg' : ''}>{trip.budget ? fmtMoney(Math.abs(trip.budget - total), cur) : '-'}</b></div>
        <div className="stat"><span>1일 평균</span><b>{fmtMoney(days.length ? total / days.length : 0, cur)}</b></div>
      </div>
      {trip.budget > 0 && (
        <div className="budget-bar" title={`${pct.toFixed(0)}%`}>
          <div style={{ width: `${pct}%` }} className={over ? 'over' : ''} />
          <span>{((total / trip.budget) * 100).toFixed(0)}% 사용</span>
        </div>
      )}

      <div className="cost-grid">
        <section className="card">
          <h3>분류별</h3>
          {Object.keys(byCategory).length === 0 && <p className="muted">아직 비용이 없어요.</p>}
          {(Object.keys(CATEGORIES) as Category[]).filter((c) => byCategory[c]).sort((a, b) => byCategory[b] - byCategory[a]).map((c) => (
            <div className="bar-row" key={c}>
              <span className="bar-label">{CATEGORIES[c].icon} {CATEGORIES[c].label}</span>
              <div className="bar"><div style={{ width: `${(byCategory[c] / maxCat) * 100}%`, background: CATEGORIES[c].color }} /></div>
              <span className="bar-val">{fmtMoney(byCategory[c], cur)}</span>
            </div>
          ))}
        </section>
        <section className="card">
          <h3>일자별</h3>
          {allDays.map((d) => (
            <div className="bar-row" key={d}>
              <span className="bar-label">{days.includes(d) ? `Day ${days.indexOf(d) + 1}` : '기간 외'} <small className="muted">{fmtDate(d)}</small></span>
              <div className="bar"><div style={{ width: `${((byDay[d] || 0) / maxDay) * 100}%` }} /></div>
              <span className="bar-val">{fmtMoney(byDay[d] || 0, cur)}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="card">
        <h3>지출 내역</h3>
        <div className="expense-form">
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            {days.map((d, i) => <option key={d} value={d}>Day {i + 1} · {fmtDate(d)}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {(Object.keys(CATEGORIES) as Category[]).map((c) => <option key={c} value={c}>{CATEGORIES[c].icon} {CATEGORIES[c].label}</option>)}
          </select>
          <input placeholder="항목 (예: 항공권, 유심)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input type="number" min={0} placeholder="금액" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addExpense()} />
          <button className="btn primary" onClick={addExpense}>추가</button>
        </div>
        <p className="muted small">일정에 입력한 비용은 자동으로 합산됩니다. 일정과 무관한 지출(항공권, 보험 등)은 여기서 추가하세요.</p>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>날짜</th><th>분류</th><th>항목</th><th className="num">금액</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.date)}</td>
                <td>{CATEGORIES[r.category].icon} {CATEGORIES[r.category].label}</td>
                <td>{r.label}{r.kind === 'stop' && <small className="muted"> · 일정</small>}</td>
                <td className="num">{fmtMoney(r.amount, cur)}</td>
                <td>
                  {r.kind === 'expense' && (
                    <button className="link danger" onClick={() => onChange({ ...trip, expenses: trip.expenses.filter((e) => e.id !== r.id) })}>삭제</button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="muted">지출 내역이 없습니다.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr><td colSpan={3}>합계</td><td className="num">{fmtMoney(total, cur)}</td><td /></tr></tfoot>
          )}
        </table></div>
      </section>
    </div>
  )
}
