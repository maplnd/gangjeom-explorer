import { useState } from 'react'
import { CATEGORIES, type Category, type Expense, type Member, type Trip } from '../types'
import { useRates } from '../fx'
import { daysBetween, fmtDate, fmtMoney, tripTotals, uid } from '../utils'
import { Modal } from './Modal'

interface Props {
  trip: Trip
  members: Member[]
  meId: string
  canEdit: boolean
  onChange: (t: Trip) => void
}

interface Row {
  id: string
  date: string
  label: string
  category: Category
  amount: number
  paidBy?: string | null
  splitWith?: string[] | null
  kind: 'stop' | 'expense'
}

const nameOf = (members: Member[], id?: string | null) => {
  const m = members.find((x) => x.user_id === id)
  return m?.profile?.display_name || m?.profile?.email || (id ? '(나간 멤버)' : '미지정')
}

/** 비율·지출별 분담 인원을 반영한 정산: 누가 누구에게 얼마를 보내야 하는지 */
function settle(members: Member[], rows: Row[], weights: Record<string, number>) {
  const ids = members.map((m) => m.user_id)
  const w = (id: string) => (weights[id] ?? 1)
  const paid: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]))
  const owed: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]))
  let shared = 0
  let unassigned = 0
  rows.forEach((r) => {
    if (!r.paidBy || !(r.paidBy in paid)) { unassigned += r.amount; return }
    const group = (r.splitWith?.length ? r.splitWith : ids).filter((id) => id in paid)
    let total = group.reduce((a, id) => a + w(id), 0)
    const useEqual = total <= 0
    if (useEqual) total = group.length
    if (!group.length) { unassigned += r.amount; return }
    paid[r.paidBy] += r.amount
    shared += r.amount
    group.forEach((id) => { owed[id] += (r.amount * (useEqual ? 1 : w(id))) / total })
  })
  const bal = ids.map((id) => ({ id, paid: paid[id], owed: owed[id], diff: paid[id] - owed[id] }))
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
  return { bal, transfers, unassigned, shared }
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
  const weights = trip.splitWeights ?? {}
  const multi = members.length > 1

  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(days[0] ?? trip.startDate)
  const [category, setCategory] = useState<Category>('etc')
  const [paidBy, setPaidBy] = useState<string>(meId)
  const [showWeights, setShowWeights] = useState(false)
  const [splitEdit, setSplitEdit] = useState<Row | null>(null)
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

  const patchRow = (r: Row, patch: { paidBy?: string | null; splitWith?: string[] | null }) => {
    if (r.kind === 'stop') onChange({ ...trip, stops: trip.stops.map((s) => (s.id === r.id ? { ...s, ...patch } : s)) })
    else onChange({ ...trip, expenses: trip.expenses.map((e) => (e.id === r.id ? { ...e, ...patch } : e)) })
  }
  const setWeight = (id: string, v: number) => onChange({ ...trip, splitWeights: { ...weights, [id]: Math.max(0, v) } })

  const rows: Row[] = [
    ...trip.stops.filter((s) => s.cost > 0).map((s) => ({ id: s.id, date: s.date, label: s.title, category: s.category, amount: s.cost, paidBy: s.paidBy, splitWith: s.splitWith, kind: 'stop' as const })),
    ...trip.expenses.map((e) => ({ ...e, kind: 'expense' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const st = settle(members, rows, weights)
  const isEqual = members.every((m) => (weights[m.user_id] ?? 1) === 1)
  const weightSum = members.reduce((a, m) => a + (weights[m.user_id] ?? 1), 0) || 1
  const splitText = (r: Row) => {
    if (!r.splitWith?.length) return null
    if (r.splitWith.length === 1) return r.splitWith[0] === r.paidBy ? '개인 지출' : `${nameOf(members, r.splitWith[0])} 부담`
    return `${r.splitWith.length}명 분담`
  }
  const dayLabel = (d: string) => (days.includes(d) ? `Day ${days.indexOf(d) + 1}` : '기간 외')
  const rowDates = [...new Set(rows.map((r) => r.date))]

  return (
    <div className="cost">
      <div className="stat-row">
        <div className="stat"><span>총 지출</span><b>{fmtMoney(total, cur)}</b></div>
        <div className="stat"><span>예산</span><b>{trip.budget ? fmtMoney(trip.budget, cur) : '미설정'}</b></div>
        <div className="stat"><span>{over ? '초과' : '남은 예산'}</span><b className={over ? 'neg' : ''}>{trip.budget ? fmtMoney(Math.abs(trip.budget - total), cur) : '-'}</b></div>
        <div className="stat"><span>1일 평균</span><b>{fmtMoney(days.length ? total / days.length : 0, cur)}</b></div>
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
          <div className="sec-head">
            <h3>🤝 정산 <span className="badge">{isEqual ? '1/N' : '비율 분담'}</span></h3>
            {canEdit && <button className="btn ghost sm" onClick={() => setShowWeights((v) => !v)}>⚙️ 분담 비율</button>}
          </div>

          {showWeights && (
            <div className="weights">
              <p className="muted small">사람마다 부담 비율을 정하세요. 예: 어른 1, 아이 0.5 · 0이면 정산에서 제외됩니다.</p>
              {members.map((m) => {
                const v = weights[m.user_id] ?? 1
                return (
                  <div key={m.user_id} className="weight-row">
                    <span className="grow">{nameOf(members, m.user_id)}</span>
                    <button className="btn ghost sm" disabled={!canEdit || v <= 0} onClick={() => setWeight(m.user_id, Math.round((v - 0.5) * 10) / 10)}>−</button>
                    <input type="number" min={0} step={0.5} value={v} disabled={!canEdit} onChange={(e) => setWeight(m.user_id, Number(e.target.value) || 0)} />
                    <button className="btn ghost sm" disabled={!canEdit} onClick={() => setWeight(m.user_id, Math.round((v + 0.5) * 10) / 10)}>+</button>
                    <span className="muted small pct">{Math.round((v / weightSum) * 100)}%</span>
                  </div>
                )
              })}
              {!isEqual && canEdit && <button className="link small" onClick={() => onChange({ ...trip, splitWeights: {} })}>똑같이 나누기(1/N)로 되돌리기</button>}
            </div>
          )}

          <div className="settle-grid">
            {st.bal.map((b) => (
              <div key={b.id} className="settle-person">
                <strong>{nameOf(members, b.id)}{b.id === meId && ' (나)'}</strong>
                <span className="muted small">결제 {fmtMoney(b.paid, cur)} · 부담 {fmtMoney(b.owed, cur)}</span>
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
            {isEqual ? '모든 멤버가 똑같이 나눈 기준입니다.' : '설정한 분담 비율 기준입니다.'} 지출마다 ‘나눌 사람’을 따로 정할 수도 있어요.
            {st.unassigned > 0 && <> 결제자 미지정 <b>{fmtMoney(st.unassigned, cur)}</b>은 정산에서 제외됐어요.</>}
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
              <span className="bar-label">{dayLabel(d)} <small className="muted">{fmtDate(d)}</small></span>
              <div className="bar"><div style={{ width: `${((byDay[d] || 0) / maxDay) * 100}%` }} /></div>
              <span className="bar-val">{fmtMoney(byDay[d] || 0, cur)}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="card">
        <h3>지출 내역 <span className="muted small">{rows.length}건 · {fmtMoney(total, cur)}</span></h3>
        {canEdit && (
          <div className="exp-form">
            <input className="exp-f-label" placeholder="항목 (예: 항공권, 유심)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <input className="exp-f-amt" type="number" inputMode="decimal" min={0} placeholder={`금액 (${cur})`} value={amount}
              onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addExpense()} />
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              {days.map((d, i) => <option key={d} value={d}>Day {i + 1} · {fmtDate(d)}</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {(Object.keys(CATEGORIES) as Category[]).map((c) => <option key={c} value={c}>{CATEGORIES[c].icon} {CATEGORIES[c].label}</option>)}
            </select>
            {multi && (
              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} title="결제한 사람">
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(members, m.user_id)} 결제</option>)}
                <option value="">결제자 미지정</option>
              </select>
            )}
            <button className="btn primary" onClick={addExpense}>추가</button>
          </div>
        )}
        <p className="muted small">일정에 입력한 비용은 자동으로 합산됩니다. 일정과 무관한 지출(항공권, 보험 등)은 여기서 추가하세요.</p>

        {!rows.length && <p className="empty">지출 내역이 없습니다.</p>}
        {rowDates.map((d) => {
          const list = rows.filter((r) => r.date === d)
          const sum = list.reduce((a, r) => a + r.amount, 0)
          return (
            <div key={d} className="exp-day">
              <div className="exp-day-head">
                <b>{dayLabel(d)}</b> <span className="muted">{fmtDate(d)}</span>
                <span className="exp-day-sum">{fmtMoney(sum, cur)}</span>
              </div>
              {list.map((r) => {
                const cat = CATEGORIES[r.category]
                const split = splitText(r)
                return (
                  <div key={r.id} className="exp-item">
                    <span className="exp-icon" style={{ background: `color-mix(in srgb, ${cat.color} 15%, transparent)` }} title={cat.label}>{cat.icon}</span>
                    <div className="exp-body">
                      <div className="exp-top">
                        <span className="exp-label">{r.label}</span>
                        <span className="exp-amt">{fmtMoney(r.amount, cur)}</span>
                      </div>
                      <div className="exp-meta">
                        <span>{cat.label}</span>
                        {r.kind === 'stop' && <span className="tag">일정</span>}
                        {multi && (canEdit ? (
                          <select className="mini" value={r.paidBy ?? ''} onChange={(e) => patchRow(r, { paidBy: e.target.value || null })} title="결제한 사람">
                            <option value="">결제자 미지정</option>
                            {members.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(members, m.user_id)} 결제</option>)}
                          </select>
                        ) : <span>{nameOf(members, r.paidBy)} 결제</span>)}
                        {multi && (canEdit
                          ? <button className="chip-btn" onClick={() => setSplitEdit(r)}>👥 {split ?? '전원 분담'}</button>
                          : <span>👥 {split ?? '전원 분담'}</span>)}
                        {canEdit && r.kind === 'expense' && (
                          <button className="link danger" onClick={() => confirm(`'${r.label}' 지출을 삭제할까요?`) && onChange({ ...trip, expenses: trip.expenses.filter((e) => e.id !== r.id) })}>삭제</button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
        {rows.length > 0 && (
          <div className="exp-total"><span>합계</span><b>{fmtMoney(total, cur)}</b></div>
        )}
      </section>

      {splitEdit && (
        <SplitModal
          row={splitEdit}
          members={members}
          cur={cur}
          weights={weights}
          onClose={() => setSplitEdit(null)}
          onSave={(ids) => { patchRow(splitEdit, { splitWith: ids }); setSplitEdit(null) }}
        />
      )}
    </div>
  )
}

function SplitModal({ row, members, cur, weights, onClose, onSave }: {
  row: Row; members: Member[]; cur: string; weights: Record<string, number>
  onClose: () => void; onSave: (ids: string[] | null) => void
}) {
  const all = members.map((m) => m.user_id)
  const [sel, setSel] = useState<string[]>(row.splitWith?.length ? row.splitWith : all)
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const wsum = sel.reduce((a, id) => a + (weights[id] ?? 1), 0)
  const share = (id: string) => (sel.includes(id) ? (wsum > 0 ? row.amount * (weights[id] ?? 1) / wsum : row.amount / sel.length) : 0)
  return (
    <Modal
      title="나눌 사람"
      onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>취소</button>
        <button className="btn primary" disabled={!sel.length} onClick={() => onSave(sel.length === all.length ? null : sel)}>저장</button>
      </>}
    >
      <p><b>{row.label}</b> · {fmtMoney(row.amount, cur)}</p>
      <div className="split-quick">
        <button className="chip" onClick={() => setSel(all)}>전원</button>
        {row.paidBy && <button className="chip" onClick={() => setSel([row.paidBy!])}>개인 지출 (결제자만)</button>}
      </div>
      <ul className="invite-list">
        {members.map((m) => (
          <li key={m.user_id}>
            <label className="check grow">
              <input type="checkbox" checked={sel.includes(m.user_id)} onChange={() => toggle(m.user_id)} />
              {nameOf(members, m.user_id)}
            </label>
            <span className="muted small">{fmtMoney(share(m.user_id), cur)}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">체크한 사람끼리 분담 비율대로 나눕니다.</p>
    </Modal>
  )
}
