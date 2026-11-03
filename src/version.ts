/** 새 버전이 배포되면 감지해서 자동으로 새로고침 (홈 화면 앱·탭을 오래 열어둔 경우 대비) */
const currentScript = () =>
  [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map((s) => new URL(s.src).pathname).find((p) => p.includes('/assets/'))

async function latestScript(): Promise<string | undefined> {
  const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })
  const html = await res.text()
  return html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1]
}

export function watchForUpdates() {
  const mine = currentScript()
  if (!mine || import.meta.env.DEV) return
  let checking = false
  const check = async () => {
    if (checking) return
    checking = true
    try {
      const latest = await latestScript()
      if (latest && latest !== mine) location.reload()
    } catch { /* 오프라인 등은 무시 */ } finally { checking = false }
  }
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
  window.addEventListener('focus', check)
  setInterval(check, 5 * 60 * 1000)
  check()
}
