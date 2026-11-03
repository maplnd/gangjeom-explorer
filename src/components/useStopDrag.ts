import { useCallback, useEffect, useRef, useState } from 'react'

export interface DropTarget { date: string; beforeId: string | null }
interface DragState { id: string; title: string; x: number; y: number }

const HOLD_MS = 420
const MOVE_TOLERANCE = 8

/** 꾹 눌러서(롱프레스) 일정 카드를 끌어 옮기기 — 터치·마우스 공용 */
export function useStopDrag(enabled: boolean, onDrop: (id: string, target: DropTarget) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const timer = useRef<number>(undefined)
  const start = useRef<{ x: number; y: number; id: string; title: string } | null>(null)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const targetRef = useRef<DropTarget | null>(null)
  const suppressClickUntil = useRef(0)
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  const computeTarget = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const item = el?.closest<HTMLElement>('[data-stop-id]')
    let t: DropTarget | null = null
    if (item) {
      const r = item.getBoundingClientRect()
      const upper = y < r.top + Math.min(r.height / 2, 60)
      t = { date: item.dataset.date!, beforeId: upper ? item.dataset.stopId! : item.dataset.nextId || null }
    } else {
      const sec = el?.closest<HTMLElement>('[data-day]')
      if (sec) t = { date: sec.dataset.day!, beforeId: null }
    }
    targetRef.current = t
    setTarget(t)
  }

  const cleanup = useCallback(() => {
    window.clearTimeout(timer.current)
    start.current = null
    dragging.current = false
    targetRef.current = null
    setDrag(null)
    setTarget(null)
    document.body.classList.remove('dragging-stop')
  }, [])

  const begin = (x: number, y: number) => {
    if (!start.current) return
    dragging.current = true
    try { navigator.vibrate?.(25) } catch { /* noop */ }
    document.body.classList.add('dragging-stop')
    window.getSelection()?.removeAllRanges()
    setDrag({ id: start.current.id, title: start.current.title, x, y })
    computeTarget(x, y)
  }

  const move = (x: number, y: number) => {
    last.current = { x, y }
    if (!start.current) return
    if (!dragging.current) {
      if (Math.hypot(x - start.current.x, y - start.current.y) > MOVE_TOLERANCE) cleanup()
      return
    }
    setDrag((d) => (d ? { ...d, x, y } : d))
    computeTarget(x, y)
  }

  const end = () => {
    if (dragging.current && start.current) {
      suppressClickUntil.current = Date.now() + 400
      const t = targetRef.current
      if (t) onDropRef.current(start.current.id, t)
    }
    cleanup()
  }

  // 전역 이벤트 (touchmove는 드래그 중 스크롤을 막기 위해 passive:false)
  useEffect(() => {
    const tm = (e: TouchEvent) => {
      if (!start.current) return
      if (dragging.current) e.preventDefault()
      const t = e.touches[0]
      if (t) move(t.clientX, t.clientY)
    }
    const mm = (e: MouseEvent) => move(e.clientX, e.clientY)
    const up = () => start.current && end()
    document.addEventListener('touchmove', tm, { passive: false })
    document.addEventListener('touchend', up)
    document.addEventListener('touchcancel', up)
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', up)
    // 드래그 중 화면 가장자리에 가면 자동 스크롤
    const iv = window.setInterval(() => {
      if (!dragging.current) return
      const { x, y } = last.current
      const edge = 90
      if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 6))
      else if (y > window.innerHeight - edge) window.scrollBy(0, Math.ceil((y - (window.innerHeight - edge)) / 6))
      else return
      computeTarget(x, y)
    }, 16)
    return () => {
      document.removeEventListener('touchmove', tm)
      document.removeEventListener('touchend', up)
      document.removeEventListener('touchcancel', up)
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mouseup', up)
      window.clearInterval(iv)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const press = (id: string, title: string, x: number, y: number, el: EventTarget) => {
    if (!enabled) return
    if ((el as HTMLElement).closest('a,button,input,label,select,textarea')) return
    start.current = { x, y, id, title }
    last.current = { x, y }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => begin(last.current.x, last.current.y), HOLD_MS)
  }

  const bind = (id: string, title: string) => ({
    onTouchStart: (e: React.TouchEvent) => { const t = e.touches[0]; if (e.touches.length === 1) press(id, title, t.clientX, t.clientY, e.target) },
    onMouseDown: (e: React.MouseEvent) => { if (e.button === 0) press(id, title, e.clientX, e.clientY, e.target) },
    onContextMenu: (e: React.MouseEvent) => { if (start.current || dragging.current) e.preventDefault() },
  })

  const clickAllowed = useCallback(() => Date.now() > suppressClickUntil.current, [])

  return { drag, target, bind, clickAllowed }
}
