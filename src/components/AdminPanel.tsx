import { useEffect, useState } from 'react'
import { fetchAllProfiles, setUserStatus } from '../api'
import type { Profile } from '../types'

const LABEL = { pending: '승인 대기', approved: '승인됨', rejected: '거절됨' }

export function AdminPanel({ meId, onBack, onCountChange }: { meId: string; onBack: () => void; onCountChange: (n: number) => void }) {
  const [list, setList] = useState<Profile[] | null>(null)
  const [filter, setFilter] = useState<Profile['status']>('pending')
  const [error, setError] = useState('')

  const load = () =>
    fetchAllProfiles()
      .then((l) => { setList(l); onCountChange(l.filter((p) => p.status === 'pending').length) })
      .catch((e) => setError(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line

  const change = async (p: Profile, status: Profile['status']) => {
    try {
      await setUserStatus(p.id, status)
      await load()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const shown = (list ?? []).filter((p) => p.status === filter)
  return (
    <div className="admin">
      <div className="trip-head">
        <button className="btn ghost sm" onClick={onBack}>← 목록</button>
        <div className="trip-title"><h1>회원 관리</h1><div className="muted">가입 신청을 승인한 사람만 여행OK를 이용할 수 있습니다.</div></div>
        <button className="btn ghost sm" onClick={load}>새로고침</button>
      </div>
      <div className="tabs">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
            {LABEL[s]} ({(list ?? []).filter((p) => p.status === s).length})
          </button>
        ))}
      </div>
      {error && <p className="hint warn">{error}</p>}
      {!list ? <p className="muted">불러오는 중…</p> : !shown.length ? <p className="empty">해당하는 회원이 없습니다.</p> : (
        <div className="member-list">
          {shown.map((p) => (
            <div key={p.id} className="member-row card">
              <div className="member-info">
                <strong>{p.display_name || '(이름 없음)'}</strong> {p.is_admin && <span className="badge">관리자</span>}
                <div className="muted small">{p.email} · {new Date(p.created_at).toLocaleString('ko-KR')} 가입</div>
              </div>
              {p.id !== meId && (
                <div className="head-actions">
                  {p.status !== 'approved' && <button className="btn primary sm" onClick={() => change(p, 'approved')}>승인</button>}
                  {p.status === 'pending' && <button className="btn ghost sm danger" onClick={() => change(p, 'rejected')}>거절</button>}
                  {p.status === 'approved' && <button className="btn ghost sm danger" onClick={() => confirm(`${p.display_name}님의 이용 승인을 취소할까요?`) && change(p, 'rejected')}>승인 취소</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
