import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import * as api from './api'
import { envKey, useGoogleMaps } from './google'
import { sampleTrip } from './sample'
import { useLocalStorage, readLS } from './storage'
import { supabase, supabaseConfigured } from './supabase'
import type { Member, Profile, Trip } from './types'
import { AdminPanel } from './components/AdminPanel'
import { AuthScreen, PendingScreen } from './components/AuthScreen'
import { Modal } from './components/Modal'
import { Settings } from './components/Settings'
import { ShareModal } from './components/ShareModal'
import { TripForm } from './components/TripForm'
import { TripList } from './components/TripList'
import { TripView } from './components/TripView'

const INVITE_KEY = 'travel-ok:pending-invite'
type View = { name: 'list' } | { name: 'trip'; id: string } | { name: 'admin' }

function parseHash(): View {
  const p = new URLSearchParams(location.hash.slice(1))
  const inv = p.get('invite')
  if (inv) {
    try { localStorage.setItem(INVITE_KEY, inv) } catch { /* noop */ }
  }
  if (p.get('trip')) return { name: 'trip', id: p.get('trip')! }
  if (p.has('admin')) return { name: 'admin' }
  return { name: 'list' }
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uidMe = session?.user.id
  const loadProfile = useCallback(async () => {
    if (!uidMe) return setProfile(null)
    try { setProfile(await api.fetchProfile(uidMe)) } catch { setProfile(null) }
  }, [uidMe])
  useEffect(() => { setProfile(undefined); loadProfile() }, [loadProfile])

  // 승인 대기 중이면 30초마다 확인
  useEffect(() => {
    if (profile?.status !== 'pending') return
    const t = setInterval(loadProfile, 30000)
    return () => clearInterval(t)
  }, [profile?.status, loadProfile])

  if (!supabaseConfigured) {
    return <div className="auth-wrap"><div className="auth card">Supabase 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 설정되지 않았습니다.</div></div>
  }
  if (session === undefined || (session && profile === undefined)) return <div className="loading">🧭 여행OK</div>
  if (!session) return <AuthScreen inviteNotice={!!readLS<string | null>(INVITE_KEY, null) || location.hash.includes('invite=')} />
  const logout = () => supabase.auth.signOut()
  if (!profile) {
    return <PendingScreen status="pending" email={session.user.email ?? ''} onRefresh={loadProfile} onLogout={logout} />
  }
  if (profile.status !== 'approved') {
    return <PendingScreen status={profile.status} email={profile.email} onRefresh={loadProfile} onLogout={logout} />
  }
  return <Main profile={profile} onLogout={logout} onProfileChange={loadProfile} />
}

function Main({ profile, onLogout, onProfileChange }: { profile: Profile; onLogout: () => void; onProfileChange: () => void }) {
  const me = profile.id
  const [view, setView] = useState<View>(parseHash)
  const [trips, setTrips] = useState<Trip[] | null>(null)
  const [error, setError] = useState('')
  const [apiKey, setApiKey] = useLocalStorage<string>('travel-log:gmaps-key', '')
  const [showSettings, setShowSettings] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [invite, setInvite] = useState<{ token: string; title: string; role: string; inviter: string } | null>(null)
  const [menu, setMenu] = useState(false)
  const google = useGoogleMaps(apiKey || envKey)

  const go = (v: View) => {
    setView(v)
    history.replaceState(null, '', v.name === 'trip' ? `#trip=${v.id}` : v.name === 'admin' ? '#admin' : location.pathname)
    window.scrollTo(0, 0)
  }

  const loadTrips = useCallback(async () => {
    try { setTrips(await api.fetchTrips(me)) } catch (e) { setError((e as Error).message) }
  }, [me])
  useEffect(() => { loadTrips() }, [loadTrips])

  useEffect(() => {
    if (!profile.is_admin) return
    api.fetchAllProfiles().then((l) => setPendingCount(l.filter((p) => p.status === 'pending').length)).catch(() => {})
  }, [profile.is_admin])

  // 초대 링크 처리
  useEffect(() => {
    const token = readLS<string | null>(INVITE_KEY, null) ?? new URLSearchParams(location.hash.slice(1)).get('invite')
    if (!token) return
    api.inviteInfo(token)
      .then((info) => {
        if (!info) { alert('초대 링크가 만료되었거나 올바르지 않습니다.'); localStorage.removeItem(INVITE_KEY); return }
        setInvite({ token, title: info.title, role: info.role, inviter: info.inviter })
      })
      .catch(() => localStorage.removeItem(INVITE_KEY))
  }, [])

  const acceptInvite = async () => {
    if (!invite) return
    try {
      const id = await api.acceptInvite(invite.token)
      localStorage.removeItem(INVITE_KEY)
      setInvite(null)
      await loadTrips()
      go({ name: 'trip', id })
    } catch (e) { alert((e as Error).message) }
  }

  const createTrip = async (t: Trip) => {
    try {
      const id = await api.createTrip(t)
      await loadTrips()
      go({ name: 'trip', id })
    } catch (e) { alert('저장 실패: ' + (e as Error).message) }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go({ name: 'list' })}>🧭 여행OK</button>
        <div className="top-actions">
          <button className={`map-status ${google}`} onClick={() => setShowSettings(true)} title="Google 지도 연동 설정">
            {google === 'ready' ? '● Google 지도' : google === 'error' ? '● 지도 오류' : google === 'loading' ? '● 연결 중' : '⚙️ 구글맵'}
          </button>
          {profile.is_admin && (
            <button className="map-status" onClick={() => go({ name: 'admin' })}>
              회원관리{pendingCount > 0 && <span className="dot-badge">{pendingCount}</span>}
            </button>
          )}
          <div className="user-menu">
            <button className="avatar me" onClick={() => setMenu((m) => !m)} title={profile.email}>{(profile.display_name || profile.email).slice(0, 1)}</button>
            {menu && (
              <div className="menu-pop" onMouseLeave={() => setMenu(false)}>
                <div className="muted small">{profile.display_name}<br />{profile.email}</div>
                <button onClick={async () => {
                  const n = prompt('표시할 이름', profile.display_name)
                  if (n?.trim()) { await api.updateMyName(n).catch((e) => alert(e.message)); onProfileChange() }
                  setMenu(false)
                }}>이름 변경</button>
                <button onClick={async () => {
                  const pw = prompt('새 비밀번호 (6자 이상)')
                  if (!pw) return
                  if (pw.length < 6) return alert('비밀번호는 6자 이상이어야 합니다.')
                  if (prompt('새 비밀번호를 한 번 더 입력하세요') !== pw) return alert('두 비밀번호가 다릅니다.')
                  try { await api.changeMyPassword(pw); alert('비밀번호를 변경했습니다.') } catch (e) { alert((e as Error).message) }
                  setMenu(false)
                }}>비밀번호 변경</button>
                <button onClick={onLogout}>로그아웃</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        {error && <p className="hint warn">{error}</p>}
        {view.name === 'admin' && profile.is_admin ? (
          <AdminPanel meId={me} onBack={() => go({ name: 'list' })} onCountChange={setPendingCount} />
        ) : view.name === 'trip' ? (
          <TripContainer
            key={view.id}
            id={view.id}
            me={me}
            google={google}
            onBack={() => { loadTrips(); go({ name: 'list' }) }}
            onGone={() => { loadTrips(); go({ name: 'list' }) }}
          />
        ) : !trips ? (
          <p className="muted">불러오는 중…</p>
        ) : (
          <TripList
            trips={trips}
            meId={me}
            onOpen={(id) => go({ name: 'trip', id })}
            onNew={() => setShowNew(true)}
            onSample={() => createTrip(sampleTrip())}
            onImport={async (list) => {
              for (const t of list) await api.createTrip(t).catch((e) => alert(`'${t.title}' 가져오기 실패: ${e.message}`))
              loadTrips()
            }}
          />
        )}
      </main>

      {showNew && <TripForm onClose={() => setShowNew(false)} onSave={(t) => { setShowNew(false); createTrip(t) }} />}
      {showSettings && (
        <Settings apiKey={apiKey} status={google} onClose={() => setShowSettings(false)}
          onSave={(k) => {
            setApiKey(k)
            try { localStorage.setItem('travel-log:gmaps-key', JSON.stringify(k)) } catch { /* noop */ }
            location.reload()
          }} />
      )}
      {invite && (
        <Modal title="여행 초대" onClose={() => { localStorage.removeItem(INVITE_KEY); setInvite(null) }}
          footer={<>
            <button className="btn ghost" onClick={() => { localStorage.removeItem(INVITE_KEY); setInvite(null) }}>나중에</button>
            <button className="btn primary" onClick={acceptInvite}>참여하기</button>
          </>}>
          <p><b>{invite.inviter}</b>님이 <b>‘{invite.title}’</b> 여행에 <b>{invite.role === 'editor' ? '편집자' : '보기 전용'}</b>로 초대했어요.</p>
        </Modal>
      )}
    </div>
  )
}

/** 여행 하나를 불러오고, 실시간으로 다른 멤버의 변경을 반영 */
function TripContainer({ id, me, google, onBack, onGone }: { id: string; me: string; google: ReturnType<typeof useGoogleMaps>; onBack: () => void; onGone: () => void }) {
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined)
  const [members, setMembers] = useState<Member[]>([])
  const [online, setOnline] = useState<string[]>([])
  const [share, setShare] = useState(false)
  const [saving, setSaving] = useState(0)
  const [syncError, setSyncError] = useState('')
  const tripRef = useRef<Trip | null>(null)
  const pending = useRef(0)
  const refetchTimer = useRef<number>(undefined)

  const refetch = useCallback(async () => {
    try {
      const t = await api.fetchTrip(id, me)
      tripRef.current = t
      setTrip(t)
    } catch (e) { setSyncError((e as Error).message) }
  }, [id, me])
  const loadMembers = useCallback(() => api.fetchMembers(id).then(setMembers).catch(() => {}), [id])

  const scheduleRefetch = useCallback(() => {
    window.clearTimeout(refetchTimer.current)
    refetchTimer.current = window.setTimeout(() => {
      if (pending.current > 0) scheduleRefetch()
      else refetch()
    }, 400)
  }, [refetch])

  useEffect(() => { refetch(); loadMembers() }, [refetch, loadMembers])

  useEffect(() => {
    const ch = supabase.channel(`trip:${id}`, { config: { presence: { key: me } } })
    const f = `trip_id=eq.${id}`
    for (const table of ['stops', 'expenses', 'checklist_items', 'day_notes']) {
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: f }, scheduleRefetch)
      ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: f }, scheduleRefetch)
      ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (p) => {
        const oldId = (p.old as { id?: string }).id
        const t = tripRef.current
        if (t && oldId && [...t.stops, ...t.expenses, ...t.checklist, ...t.notes].some((x) => x.id === oldId)) scheduleRefetch()
      })
    }
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${id}` }, scheduleRefetch)
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members', filter: f }, () => { loadMembers(); scheduleRefetch() })
    ch.on('presence', { event: 'sync' }, () => setOnline(Object.keys(ch.presenceState())))
    ch.subscribe((status) => { if (status === 'SUBSCRIBED') ch.track({ at: Date.now() }) })
    return () => { supabase.removeChannel(ch) }
  }, [id, me, scheduleRefetch, loadMembers])

  const onChange = async (next: Trip) => {
    const prev = tripRef.current
    if (!prev) return
    tripRef.current = next
    setTrip(next)
    pending.current++
    setSaving((n) => n + 1)
    try {
      await api.syncTrip(prev, next)
      setSyncError('')
    } catch (e) {
      setSyncError('저장 실패: ' + (e as Error).message)
      scheduleRefetch()
    } finally {
      pending.current--
      setSaving((n) => n - 1)
    }
  }

  if (trip === undefined) return <p className="muted">불러오는 중…</p>
  if (trip === null) {
    return (
      <div className="empty">
        이 여행을 볼 수 없습니다. 삭제되었거나 멤버가 아닙니다. <button className="link" onClick={onGone}>목록으로</button>
      </div>
    )
  }
  return (
    <>
      <div className={`sync-status ${syncError ? 'err' : ''}`}>
        {syncError || (saving > 0 ? '저장 중…' : '✓ 저장됨 · 실시간 동기화')}
      </div>
      <TripView
        trip={trip}
        meId={me}
        members={members}
        online={online}
        onShare={() => setShare(true)}
        google={google}
        onChange={onChange}
        onBack={onBack}
        onDelete={async () => {
          try { await api.deleteTrip(trip.id); onGone() } catch (e) { alert((e as Error).message) }
        }}
      />
      {share && <ShareModal trip={trip} meId={me} onClose={() => { setShare(false); loadMembers() }} onLeft={onGone} />}
    </>
  )
}
