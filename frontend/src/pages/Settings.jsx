import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Moon, Sun } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../theme'

const THEME_KEY = 'theme'
const THEME_DESC = 'Admin dashboard appearance (light/dark).'

export default function Settings() {
  const { token } = useAuth()
  const [theme, setTheme] = useTheme()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const savedTimer = useRef(null)

  // Clear the transient "Saved" hint after a moment.
  useEffect(() => {
    return () => clearTimeout(savedTimer.current)
  }, [])

  async function changeTheme(mode) {
    if (mode === theme) return
    setTheme(mode) // apply instantly; persist below
    setSaved(false)
    setError('')
    setSaving(true)

    try {
      // Upsert the system-wide `theme` row via the existing settings API.
      const rows = await api('/settings', { token })
      const existing = Array.isArray(rows) ? rows.find((r) => r.setting_key === THEME_KEY) : null

      if (existing) {
        await api(`/settings/${existing.id}`, {
          method: 'PUT',
          body: { setting_value: mode, description: THEME_DESC },
          token,
        })
      } else {
        await api('/settings', {
          method: 'POST',
          body: { setting_key: THEME_KEY, setting_value: mode, description: THEME_DESC },
          token,
        })
      }

      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <span aria-hidden>✕</span>
          </button>
        </div>
      )}

      {/* Appearance — the only setting in the prototype (Fig 19.0) */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] shadow-sm p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 max-w-md">
            <h2 className="text-base font-bold text-[var(--ink)]">Appearance</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Switch between light and dark mode for the admin dashboard.
            </p>
          </div>

          {/* Light | Dark segmented toggle */}
          <div className="inline-flex rounded-lg border border-[var(--line)] overflow-hidden shrink-0">
            {[
              { value: 'light', label: 'Light', Icon: Sun },
              { value: 'dark', label: 'Dark', Icon: Moon },
            ].map(({ value, label, Icon }) => {
              const active = theme === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeTheme(value)}
                  disabled={saving}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                    active
                      ? 'bg-[#16233F] text-[#EDC31D]'
                      : 'bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--fill)]'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Status row */}
        <div className="mt-4 flex items-center gap-2 text-xs h-5">
          {saving && <span className="text-[var(--muted)]">Saving…</span>}
          {saved && (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
              <Check size={13} />
              Saved — your dashboard theme is now {theme}.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}