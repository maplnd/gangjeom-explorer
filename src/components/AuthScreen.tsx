import { useState } from 'react'
import { getRemember, setRemember, supabase } from '../supabase'

const EMAIL_KEY = 'travel-ok:saved-email'
const savedEmail = () => { try { return localStorage.getItem(EMAIL_KEY) ?? '' } catch { return '' } }

export function AuthScreen({ inviteNotice }: { inviteNotice?: boolean }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState(savedEmail)
  const [saveId, setSaveId] = useState(() => !!savedEmail())
  const [keep, setKeep] = useState(getRemember)
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'info'; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    setRemember(keep)
    try {
      if (saveId) localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase())
      else localStorage.removeItem(EMAIL_KEY)
    } catch { /* noop */ }
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
        if (error) throw error
      } else {
        if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { display_name: name.trim() } },
        })
        if (error) throw error
        if (!data.session) {
          setMsg({ type: 'info', text: '가입 신청이 접수되었습니다. 이메일 인증 후 로그인해 주세요.' })
          setMode('login')
        }
      }
    } catch (err) {
      const m = (err as Error).message
      setMsg({
        type: 'error',
        text: /Invalid login/i.test(m) ? '이메일 또는 비밀번호가 올바르지 않습니다. 대·소문자와 자동완성된 값을 ‘보기’로 확인해 보세요.'
          : /already registered/i.test(m) ? '이미 가입된 이메일입니다. 로그인해 주세요.'
          : /Email not confirmed/i.test(m) ? '이메일 인증이 아직 완료되지 않았습니다.'
          : m,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth card" onSubmit={submit} method="post" action="#" autoComplete="on">
        <div className="auth-brand">🧭 여행OK!</div>
        <p className="muted center">가족이 함께 만드는 여행플래너</p>
        {inviteNotice && <p className="hint center">여행에 초대받으셨네요! 로그인하면 초대가 이어집니다.</p>}
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>로그인</button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>가입 신청</button>
        </div>
        {mode === 'signup' && (
          <label className="field">
            <span>이름(닉네임)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="nickname" />
          </label>
        )}
        <label className="field">
          <span>이메일</span>
          <input type="email" name="username" id="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <div className="pw-row">
            <input type={show ? 'text' : 'password'} name="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <button type="button" className="btn ghost sm" onClick={() => setShow((v) => !v)}>{show ? '숨기기' : '보기'}</button>
          </div>
        </label>
        {mode === 'login' && (
          <div className="remember">
            <label className="check"><input type="checkbox" checked={saveId} onChange={(e) => setSaveId(e.target.checked)} /> 아이디 저장</label>
            <label className="check"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> 로그인 상태 유지</label>
          </div>
        )}
        {msg && <p className={`hint ${msg.type === 'error' ? 'warn' : ''}`}>{msg.text}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? '처리 중…' : mode === 'login' ? '로그인' : '가입 신청하기'}</button>
        {mode === 'signup' && <p className="muted small center">가입 후 관리자가 승인하면 이용할 수 있습니다.</p>}
        {mode === 'login' && (
          <p className="muted small center">
            로그인하면 브라우저가 <b>비밀번호 저장</b>을 물어봐요. ‘저장’을 누르면 다음부터 자동 입력됩니다.<br />
            비밀번호를 잊으셨다면 관리자에게 임시 비밀번호를 요청하세요.
          </p>
        )}
      </form>
    </div>
  )
}

export function PendingScreen({ status, onRefresh, onLogout, email }: { status: 'pending' | 'rejected'; onRefresh: () => void; onLogout: () => void; email: string }) {
  return (
    <div className="auth-wrap">
      <div className="auth card center">
        <div className="auth-brand">{status === 'pending' ? '⏳' : '🚫'}</div>
        <h2>{status === 'pending' ? '가입 승인 대기 중' : '이용이 승인되지 않았습니다'}</h2>
        <p className="muted">
          {status === 'pending'
            ? <>{email} 계정의 가입 신청이 접수되었습니다.<br />관리자가 승인하면 바로 이용할 수 있어요.</>
            : '관리자에게 문의해 주세요.'}
        </p>
        <div className="head-actions" style={{ justifyContent: 'center' }}>
          {status === 'pending' && <button className="btn primary" onClick={onRefresh}>승인 여부 다시 확인</button>}
          <button className="btn ghost" onClick={onLogout}>로그아웃</button>
        </div>
      </div>
    </div>
  )
}
