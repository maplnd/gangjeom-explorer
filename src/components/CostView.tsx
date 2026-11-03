import { useState } from 'react'
import { CATEGORIES, type Category, type Expense, type Member, type Trip } from '../types'
import { useRates } from '../fx'
import { daysBetween, fmtDate, fmtMoney, tripTotals, uid } from '../utils'

interface Props {
  trip: Trip
  members: Member[]
  meId: string
  canEdit: boolean
  onChange: (t: Trip) => void
}

const nameOf = (members: Member[], id?: string | null) => {
  const m = members.find((x) => x.user_id === id)
  return m?.profile?.display_name || m?.profile?.email || (id ? '(나간 멤버)' : '미지정')
}

/** 1/N 정산: 누가 누구에게 얼마를 보내야 하는지 */
function settle(members: Member[], rows: { amount: number; paidBy?: string | null }[]) {
  const ids = members.map((m) => m.user_id)
  const paid: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]))
  let shared = 0
  let unassigned = 0
  rows.forEach((r) => {
    if (r.paidBy && r.paidBy in paid) { paid[r.paidBy] += r.amount; shared += r.amount }
    else unassigned += r.amount
  })
  const share = ids.length ? shared / ids.length : 0
  const bal = ids.map((id) => ({ id, paid: paid[id], diff: paid[id] - share }))
  const debtors = bal.filter((b) => b.diff < -0.5).map((b) => ({ ...b, left: -b.diff })).sort((a, b) => b.left - a.left)
  const creditors = bal.filter((b) => b.diff > 0.5).map((b) => ({ ...b, left: b.diff })).sort((a, b) => b.left - a.left)
  const transfers: { from: string; to: string; amount: number }[] = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].left, creditors[j].left)
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: amt })
    debtors[i].left -= amt
    creditors[j].left -= amt
    if (debtors[i].left < 0.5) i++
    if (creditors[j].left < 0.5) j++
  }
  return { share, bal, transfers, unassigned, shared }
}

export function CostView({ trip, members, meId, canEdit, onChange }: Props) {
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
  const [paidBy, setPaidBy] = useState<string>(meId)
  const { rates } = useRates(cur)
  const krwRate = cur !== 'KRW' ? rates?.rates.KRW : undefined
  const [calc, setCalc] = useState('')

  const addExpense = () => {
    if (!label.trim() || !Number(amount)) return
    const e: Expense = { id: uid(), label: label.trim(), amount: Number(amount), date, category, paidBy: paidBy || null }
    onChange({ ...trip, expenses: [...trip.expenses, e] })
    setLabel('')
    setAmount('')
  }

  const setPayer = (kind: 'stop' | 'expense', id: string, payer: string) => {
    const v = payer || null
    if (kind === 'stop') onChange({ ...trip, stops: trip.stops.map((s) => (s.id === id ? { ...s, paidBy: v } : s)) })
    else onChange({ ...trip, expenses: trip.expenses.map((e) => (e.id === id ? { ...e, paidBy: v } : e)) })
  }

  const rows = [
    ...trip.stops.filter((s) => s.cost > 0).map((s) => ({ id: s.id, date: s.date, label: s.title, category: s.category, amount: s.cost, paidBy: s.paidBy, kind: 'stop' as const })),
    ...trip.expenses.map((e) => ({ ...e, kind: 'expense' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const st = settle(members, rows)
  const multi = members.length > 1

  return (
    <div className="cost">
      <div className="stat-row">
        <div className="stat"><span>총 지출</span><b>{fmtMoney(total, cur)}</b></div>
        <div className="stat"><span>예산</span><b>{trip.budget ? fmtMoney(trip.budget, cur) : '미설정'}</b></div>
        <div className="stat"><span>{over ? '초과' : '남은 예산'}</span><b className={over ? 'neg' : ''}>{trip.budget ? fmtMoney(Math.abs(trip.budget - total), cur) : '-'}</b></div>
        <div className="stat"><span>{multi ? `1인당 (${members.length}명)` : '1일 평균'}</span><b>{fmtMoney(multi ? total / members.length : days.length ? total / days.length : 0, cur)}</b></div>
      </div>
      {cur !== 'KRW' && (
        <section className="card fx">
          <div>
            <h3>💱 환율</h3>
            {krwRate ? (
              <p className="muted small">
                1 {cur} = <b>{krwRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원</b> · 총 지출 ≈ <b>{fmtMoney(total * krwRate, 'KRW')}</b>
                {trip.budget > 0 && <> · 예산 ≈ {fmtMoney(trip.budget * krwRate, 'KRW')}</>}
                <br />기준: {rates?.updated ? new Date(rates.updated).toLocaleDateString('ko-KR') : ''} (ExchangeRate-API)
              </p>
            ) : <p className="muted small">환율 정보를 불러오는 중…</p>}
          </div>
          {krwRate && (
            <div className="fx-calc">
              <input type="number" min={0} placeholder={`금액 (${cur})`} value={calc} onChange={(e) => setCalc(e.target.value)} />
              <span>= {fmtMoney((Number(calc) || 0) * krwRate, 'KRW')}</span>
            </div>
          )}
        </section>
      )}
      {trip.budget > 0 && (
        <div className="budget-bar" title={`${pct.toFixed(0)}%`}>
          <div style={{ width: `${pct}%` }} className={over ? 'over' : ''} />
          <span>{((total / trip.budget) * 100).toFixed(0)}% 사용</span>
        </div>
      )}

      {multi && (
        <section className="card">
          <h3>🤝 정산 (1/N)</h3>
          <div className="settle-grid">
            {st.bal.map((b) => (
              <div key={b.id} className="settle-person">
                <strong>{nameOf(members, b.id)}{b.id === meId && ' (나)'}</strong>
                <span className="muted small">결제 {fmtMoney(b.paid, cur)}</span>
                <span className={b.diff < -0.5 ? 'neg' : b.diff > 0.5 ? 'pos' : 'muted'}>
                  {b.diff > 0.5 ? `+${fmtMoney(b.diff, cur)} 받을 돈` : b.diff < -0.5 ? `${fmtMoney(-b.diff, cur)} 보낼 돈` : '정산 완료'}
                </span>
              </div>
            ))}
          </div>
          {st.transfers.length > 0 ? (
            <ul className="transfers">
              {st.transfers.map((t, i) => (
                <li key={i}><b>{nameOf(members, t.from)}</b> → <b>{nameOf(members, t.to)}</b> <span className="cost">{fmtMoney(t.amount, cur)}</span></li>
              ))}
            </ul>
          ) : <p className="muted small">보낼 돈이 없습니다.</p>}
          <p className="muted small">
            결제자가 지정된 {fmtMoney(st.shared, cur)}을 멤버 {members.length}명이 똑같이 나눈 기준입니다 (1인 {fmtMoney(st.share, cur)}).
            {st.unassigned > 0 && <> 결제자 미지정 <b>{fmtMoney(st.unassigned, cur)}</b>은 정산에서 제외됐어요. 아래 내역에서 결제자를 지정하세요.</>}
          </p>
        </section>
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
        {canEdit && (
          <>
            <div className={`expense-form ${multi ? 'with-payer' : ''}`}>
              <select value={date} onChange={(e) => setDate(e.target.value)}>
                {days.map((d, i) => <option key={d} value={d}>Day {i + 1} · {fmtDate(d)}</option>)}
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {(Object.keys(CATEGORIES) as Category[]).map((c) => <option key={c} value={c}>{CATEGORIES[c].icon} {CATEGORIES[c].label}</option>)}
              </select>
              <input placeholder="항목 (예: 항공권, 유심)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <input type="number" min={0} placeholder="금액" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addExpense()} />
              {multi && (
                <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} title="결제한 사람">
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(members, m.user_id)} 결제</option>)}
                  <option value="">결제자 미지정</option>
                </select>
              )}
              <button className="btn primary" onClick={addExpense}>추가</button>
            </div>
            <p className="muted small">일정에 입력한 비용은 자동으로 합산됩니다. 일정과 무관한 지출(항공권, 보험 등)은 여기서 추가하세요.</p>
          </>
        )}
        <div className="table-wrap"><table className="table">
          <thead><tr><th>날짜</th><th>분류</th><th>항목</th>{multi && <th>결제</th>}<th className="num">금액</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.date)}</td>
                <td>{CATEGORIES[r.category].icon} {CATEGORIES[r.category].label}</td>
                <td>{r.label}{r.kind === 'stop' && <small className="muted"> · 일정</small>}</td>
                {multi && (
                  <td>
                    {canEdit ? (
                      <select className="mini" value={r.paidBy ?? ''} onChange={(e) => setPayer(r.kind, r.id, e.target.value)}>
                        <option value="">미지정</option>
                        {members.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(members, m.user_id)}</option>)}
                      </select>
                    ) : nameOf(members, r.paidBy)}
                  </td>
                )}
                <td className="num">{fmtMoney(r.amount, cur)}</td>
                <td>
                  {canEdit && r.kind === 'expense' && (
                    <button className="link danger" onClick={() => onChange({ ...trip, expenses: trip.expenses.filter((e) => e.id !== r.id) })}>삭제</button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="muted">지출 내역이 없습니다.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr><td colSpan={multi ? 4 : 3}>합계</td><td className="num">{fmtMoney(total, cur)}</td><td /></tr></tfoot>
          )}
        </table></div>
      </section>
    </div>
  )
}
