import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'code-nexus-theme'

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Apply a theme by toggling the .dark class on <html> + persisting. */
export function applyTheme(mode) {
  const next = mode === 'dark' ? 'dark' : 'light'
  document.documentElement.classList.toggle('dark', next === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* localStorage unavailable — theme still applies for this session */
  }
  // Notify same-tab consumers (useTheme) so state stays in sync
  window.dispatchEvent(new Event(STORAGE_KEY))
  return next
}

/** Call once before render to avoid a flash of the wrong theme. */
export function initTheme() {
  applyTheme(getStoredTheme())
}

/** React state mirror of the current theme. */
export function useTheme() {
  const [mode, setMode] = useState(getStoredTheme)
  useEffect(() => {
    // Re-sync when the theme changes in another tab ('storage') or in this
    // tab via applyTheme() (custom event).
    const sync = () => setMode(getStoredTheme())
    window.addEventListener('storage', sync)
    window.addEventListener(STORAGE_KEY, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(STORAGE_KEY, sync)
    }
  }, [])
  const set = useCallback((next) => setMode(applyTheme(next)), [])
  return [mode, set]
}