import { useEffect, useState } from 'react'
import { createInvite, deleteInvite, fetchMembers, inviteUrl, listInvites, removeMember, setMemberRole, type Invite } from '../api'
import { ROLES, type Member, type Role, type Trip } from '../types'
import { Modal } from './Modal'

interface Props {
  trip: Trip
  meId: string
  onClose: () => void
  onLeft: () => void
}

export function ShareModal({ trip, meId, onClose, onLeft }: Props) {
  const role = trip.role
  const canEdit = role === 'owner' || role === 'editor'
  const [members, setMembers] = useState<Member[] | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [newRole, setNewRole] = useState<'editor' | 'viewer'>('editor')
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setMembers(await fetchMembers(trip.id))
      if (canEdit) setInvites(await listInvites(trip.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => { load() }, [trip.id]) // eslint-disable-line

  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    try { await fn(); await load() } catch (e) { setError((e as Error).message) }
  }

  const copy = async (token: string) => {
    const url = inviteUrl(token)
    try {
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) {
        await navigator.share({ title: `여행OK · ${trip.title}`, text: `'${trip.title}' 여행 일정을 함께 만들어요!`, url })
      } else {
        await navigator.clipboard.writeText(url)
      }
      setCopied(token)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      prompt('아래 링크를 복사하세요', url)
    }
  }

  return (
    <Modal title="공유 · 함께 만들기" onClose={onClose}>
      {canEdit && (
        <section className="share-sec">
          <h3>초대 링크</h3>
          <p className="muted small">링크를 받은 사람이 <b>승인된 회원</b>으로 로그인하면 이 여행에 참여합니다. 링크는 14일간 유효합니다.</p>
          <div className="search-row">
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'editor' | 'viewer')} style={{ maxWidth: 160 }}>
              <option value="editor">편집자 (함께 수정)</option>
              <option value="viewer">보기 전용</option>
            </select>
            <button className="btn primary" onClick={() => run(async () => { const inv = await createInvite(trip.id, newRole); await copy(inv.token) })}>
              링크 만들고 복사
            </button>
          </div>
          {invites.length > 0 && (
            <ul className="invite-list">
              {invites.map((i) => (
                <li key={i.token}>
                  <span className="badge">{ROLES[i.role]}</span>
                  <span className="muted small">~{new Date(i.expires_at).toLocaleDateString('ko-KR')}</span>
                  <button className="link" onClick={() => copy(i.token)}>{copied === i.token ? '✅ 복사됨' : '링크 복사'}</button>
                  <button className="link danger" onClick={() => run(() => deleteInvite(i.token))}>취소</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="share-sec">
        <h3>멤버 {members ? `(${members.length})` : ''}</h3>
        {!members ? <p className="muted">불러오는 중…</p> : (
          <ul className="invite-list">
            {members.map((m) => {
              const isMe = m.user_id === meId
              const name = m.profile?.display_name || m.profile?.email || '회원'
              return (
                <li key={m.user_id}>
                  <span className="avatar">{name.slice(0, 1)}</span>
                  <span className="grow">
                    <strong>{name}</strong>{isMe && ' (나)'}
                    <div className="muted small">{m.profile?.email}</div>
                  </span>
                  {role === 'owner' && m.role !== 'owner' ? (
                    <>
                      <select value={m.role} onChange={(e) => run(() => setMemberRole(trip.id, m.user_id, e.target.value as Role))} style={{ width: 'auto' }}>
                        <option value="editor">편집자</option>
                        <option value="viewer">보기 전용</option>
                      </select>
                      <button className="link danger" onClick={() => confirm(`${name}님을 내보낼까요?`) && run(() => removeMember(trip.id, m.user_id))}>내보내기</button>
                    </>
                  ) : (
                    <span className="badge">{ROLES[m.role]}</span>
                  )}
                  {isMe && m.role !== 'owner' && (
                    <button className="link danger" onClick={async () => {
                      if (!confirm('이 여행에서 나갈까요?')) return
                      try { await removeMember(trip.id, meId); onLeft() } catch (e) { setError((e as Error).message) }
                    }}>나가기</button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {error && <p className="hint warn">{error}</p>}
    </Modal>
  )
}
