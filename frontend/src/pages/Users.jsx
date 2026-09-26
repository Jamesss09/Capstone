import { useEffect, useState } from 'react'
import { AlertTriangle, KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

function RoleBadge({ role }) {
  const admin = role === 'Administrator'
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
        admin ? 'bg-[#16233F] text-[#EDC31D]' : 'bg-[#348BDA]/15 text-[#348BDA]'
      }`}
    >
      {role}
    </span>
  )
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
        active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'ACTIVE' : 'INACTIVE'}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Password strength meter                                             */
/* ------------------------------------------------------------------ */

// Informational only — the min-8 rule is still enforced on save.
function strengthScore(pw) {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s // 0..6
}

function strengthLevel(score) {
  if (score <= 1) return { label: 'Weak', bar: 'bg-red-400', text: 'text-red-600', width: '25%' }
  if (score <= 3) return { label: 'Fair', bar: 'bg-amber-400', text: 'text-amber-600', width: '50%' }
  if (score <= 5) return { label: 'Strong', bar: 'bg-[#348BDA]', text: 'text-[#348BDA]', width: '75%' }
  return { label: 'Very Strong', bar: 'bg-emerald-500', text: 'text-emerald-600', width: '100%' }
}

function StrengthMeter({ password }) {
  if (!password) return null // only while typing
  const level = strengthLevel(strengthScore(password))
  return (
    <div className="mt-1.5" aria-live="polite">
      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full ${level.bar} transition-all duration-300`}
          style={{ width: level.width }}
        />
      </div>
      <p className={`mt-1 text-[11px] font-semibold ${level.text}`}>
        Password strength: {level.label}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Add / Edit user modal                                               */
/* ------------------------------------------------------------------ */

function UserModal({ mode, user, token, onClose, onSaved }) {
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [role, setRole] = useState(user?.role ?? 'Staff')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')

  function validate() {
    if (!fullName.trim() || !username.trim()) {
      setFieldError('Full name and username are required.')
      return false
    }
    if (password && password.length < 8) {
      setFieldError('Password must be at least 8 characters.')
      return false
    }
    if (password && password !== confirm) {
      setFieldError('Passwords do not match.')
      return false
    }
    if (mode === 'new' && password.length < 8) {
      setFieldError('Password must be at least 8 characters.')
      return false
    }
    setFieldError('')
    return true
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      const base = {
        full_name: fullName.trim(),
        username: username.trim(),
        role,
        is_active: isActive,
      }
      if (mode === 'new') {
        // The sheet/web forms don't collect email — derive a stable placeholder
        await api('/users', {
          method: 'POST',
          token,
          body: { ...base, email: `${username.trim()}@tmc.local`, password },
        })
      } else {
        const body = { ...base }
        if (password) body.password = password // blank = keep current password
        await api(`/users/${user.id}`, { method: 'PUT', token, body })
      }
      onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-[#16233F] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={!saving ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#16233F]">
              {mode === 'new' ? 'Add New User' : 'Edit User'}
            </h2>
            <p className="text-xs text-[#85B3DA] mt-0.5">
              {mode === 'new'
                ? 'Create a staff or administrator account.'
                : 'Update user account information and access.'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {fieldError && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{fieldError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#6B6E76] mb-1">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#6B6E76] mb-1">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. staff02"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6B6E76] mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={inputCls}
              >
                <option value="Staff">Staff</option>
                <option value="Administrator">Administrator</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#6B6E76] mb-1">
                {mode === 'new' ? 'Password' : 'New Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'new' ? 'Enter password' : 'Leave blank to keep current password'}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6B6E76] mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={mode === 'new' ? 'Confirm password' : 'Confirm new password'}
                className={inputCls}
              />
            </div>
          </div>
          {password && <StrengthMeter password={password} />}

          <div>
            <label className="block text-xs font-semibold text-[#6B6E76] mb-2">Status</label>
            <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
              {[true, false].map((active) => (
                <button
                  key={String(active)}
                  type="button"
                  onClick={() => setIsActive(active)}
                  className={`px-5 py-2 text-sm font-bold transition-colors ${
                    isActive === active
                      ? 'bg-[#16233F] text-[#EDC31D]'
                      : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {active ? 'ACTIVE' : 'INACTIVE'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[#EDC31D] hover:bg-[#e2b814] px-5 py-2 text-sm font-bold text-[#16233F] shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : mode === 'new' ? 'Create User' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Delete confirmation                                                 */
/* ------------------------------------------------------------------ */

function DeleteConfirm({ user, busy, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={!busy ? onCancel : undefined}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <h2 className="text-base font-bold text-[#16233F]">Delete user?</h2>
        </div>
        <p className="mt-2 text-sm text-[#6B6E76]">
          “{user.full_name}” ({user.username}) will lose access immediately and cannot sign in.
          This cannot be undone.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Users() {
  const { token, user: me } = useAuth()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // { mode: 'new' } | { mode: 'edit', user }
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    try {
      const data = await api('/users', { token })
      setUsers(data)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDelete() {
    if (!confirmDelete) return
    setBusyId('delete')
    try {
      await api(`/users/${confirmDelete.id}`, { method: 'DELETE', token })
      setConfirmDelete(null)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const activeCount = users.filter((u) => u.is_active).length
  const adminCount = users.filter((u) => u.role === 'Administrator').length

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <p className="text-sm text-[#6B6E76]">
          {users.length} account{users.length === 1 ? '' : 's'} ·{' '}
          <span className="font-semibold text-emerald-600">{activeCount} active</span>
          <span className="ml-2">· {adminCount} administrator{adminCount === 1 ? '' : 's'}</span>
        </p>
        <button
          onClick={() => setModal({ mode: 'new' })}
          className="inline-flex items-center gap-2 rounded-lg bg-[#EDC31D] hover:bg-[#e2b814] px-5 py-2.5 text-sm font-bold text-[#16233F] shadow-sm transition-colors"
        >
          <Plus size={16} />
          Add New User
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#6B6E76]">Loading users…</p>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-8 py-14 text-center">
          <KeyRound size={38} className="mx-auto text-[#85B3DA]" />
          <h3 className="mt-3 text-base font-bold text-[#16233F]">No user accounts yet</h3>
          <p className="mt-1 text-sm text-[#6B6E76] max-w-md mx-auto">
            Create staff and administrator accounts here. Staff sign in via the mobile app.
          </p>
          <button
            onClick={() => setModal({ mode: 'new' })}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#EDC31D] hover:bg-[#e2b814] px-5 py-2.5 text-sm font-bold text-[#16233F] shadow-sm transition-colors"
          >
            <Plus size={16} />
            Add New User
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#16233F] text-white text-[11px] font-semibold tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = me?.id === u.id
                return (
                  <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-[#16233F]">
                        {u.full_name}
                        {self && (
                          <span className="ml-2 rounded-full bg-[#F4F2EA] border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-[#6B6E76]">
                            you
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#348BDA]">{u.username}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={u.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setModal({ mode: 'edit', user: u })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white transition-colors"
                        >
                          <Pencil size={13} />
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u)}
                          disabled={self}
                          title={
                            self
                              ? 'You cannot delete your own account.'
                              : 'Delete this user permanently'
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <UserModal
          mode={modal.mode}
          user={modal.user ?? null}
          token={token}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            load()
          }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <DeleteConfirm
          user={confirmDelete}
          busy={busyId === 'delete'}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}