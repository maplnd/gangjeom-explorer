import { useEffect, useState } from 'react'

export function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function useLocalStorage<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() =>
    readLS(key, typeof initial === 'function' ? (initial as () => T)() : initial),
  )
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* 저장 공간 부족 등은 무시 */
    }
  }, [key, value])
  return [value, setValue] as const
}
