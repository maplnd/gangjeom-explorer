import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = !!(url && key)

/** '로그인 상태 유지'를 끄면 세션을 sessionStorage에 보관 (브라우저를 닫으면 로그아웃) */
const REMEMBER_KEY = 'travel-ok:remember'
export const getRemember = () => {
  try { return localStorage.getItem(REMEMBER_KEY) !== '0' } catch { return true }
}
export const setRemember = (v: boolean) => {
  try { localStorage.setItem(REMEMBER_KEY, v ? '1' : '0') } catch { /* noop */ }
}
const store = () => (getRemember() ? localStorage : sessionStorage)
const authStorage = {
  getItem: (k: string) => {
    try { return store().getItem(k) ?? (getRemember() ? null : localStorage.getItem(k)) } catch { return null }
  },
  setItem: (k: string, v: string) => {
    try {
      store().setItem(k, v)
      if (!getRemember()) localStorage.removeItem(k)
    } catch { /* noop */ }
  },
  removeItem: (k: string) => {
    try { localStorage.removeItem(k); sessionStorage.removeItem(k) } catch { /* noop */ }
  },
}

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, storage: authStorage },
})
