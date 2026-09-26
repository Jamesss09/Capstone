import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ScrollText,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { TableSkeleton } from '../components/Skeleton'

/** Chip colors for an action code — grouped by intent (SDD Table 6.0). */
function actionStyle(action) {
  if (!action) return 'bg-[var(--fill-strong)] text-[var(--muted)]'
  if (
    action === 'LOGIN' ||
    action === 'LOGOUT' ||
    action.startsWith('ACTIVATE_') ||
    action.startsWith('DEACTIVATE_') ||
    action.startsWith('SCAN_')
  ) {
    return 'bg-[#348BDA]/15 text-[#348BDA]'
  }
  if (action.startsWith('CREATE_')) return 'bg-[var(--ok)] text-[var(--ok-text)]'
  if (action.startsWith('UPDATE_')) return 'bg-[var(--warn)] text-[var(--warn-text)]'
  if (action.startsWith('DELETE_')) return 'bg-[var(--danger)] text-[var(--danger-text)]'
  return 'bg-[var(--fill-strong)] text-[var(--muted)]'
}

function fmtWhen(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).replace(', ', ' · ')
}

export default function AuditLogs() {
  const { token } = useAuth()
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [from, setFrom] = useState(0)
  const [to, setTo] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(p = 1) {
    setLoading(true)
    setError('')
    try {
      const res = await api(`/audit-logs?page=${p}`, { token })
      setLogs(res.data ?? [])
      setPage(res.current_page ?? 1)
      setLastPage(res.last_page ?? 1)
      setTotal(res.total ?? 0)
      setFrom(res.from ?? 0)
      setTo(res.to ?? 0)
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

  return (
    <div>
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <span aria-hidden>✕</span>
          </button>
        </div>
      )}

      {/* Recent Activity — single card (prototype: header + empty state) */}
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] shadow-sm">
        <div className="px-5 py-4 border-b border-[var(--line-soft)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-[#348BDA]" />
            <h2 className="text-sm font-bold text-[var(--ink)]">Recent Activity</h2>
            {total > 0 && (
              <span className="text-xs text-[var(--muted-soft)]">
                {total} entr{total === 1 ? 'y' : 'ies'}
              </span>
            )}
          </div>
          <button
            onClick={() => load(page)}
            title="Refresh"
            disabled={loading}
            className="rounded-md p-1.5 text-[var(--muted-soft)] hover:bg-[var(--fill)] hover:text-[#348BDA] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <TableSkeleton cols={5} rows={8} />
        ) : logs.length === 0 ? (
          /* Empty state — matches Audit_Logs_prototype */
          <div className="px-8 py-16 text-center">
            <ScrollText size={38} className="mx-auto text-[#85B3DA]" />
            <h3 className="mt-3 text-base font-bold text-[var(--ink)]">
              No audit logs recorded yet
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Actions taken across the system will appear here.
            </p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#16233F] text-white text-[11px] font-semibold tracking-wider">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Target</th>
                <th className="px-5 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-[var(--line-soft)] hover:bg-[var(--fill)] transition-colors"
                >
                  <td className="px-5 py-3 text-sm text-[var(--muted)] whitespace-nowrap">
                    {fmtWhen(entry.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    {entry.user ? (
                      <>
                        <p className="text-sm font-semibold text-[var(--ink)]">
                          {entry.user.full_name}
                        </p>
                        <p className="text-xs text-[var(--muted-soft)]">@{entry.user.username}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-[var(--muted)]">—</p>
                        <p className="text-xs text-[var(--muted-soft)]">deleted / unknown</p>
                      </>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${actionStyle(entry.action)}`}
                    >
                      {entry.action ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {entry.table_name ? (
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {entry.table_name}
                        {entry.record_id != null ? ` #${entry.record_id}` : ''}
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--muted-soft)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {entry.ip_address ? (
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {entry.ip_address}
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--muted-soft)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination footer */}
        {total > 0 && (
          <div className="px-5 py-3.5 border-t border-[var(--line-soft)] bg-[var(--fill)] flex items-center justify-between gap-4">
            <p className="text-xs text-[var(--muted)]">
              Showing {from}–{to} of {total} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--card)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
                Prev
              </button>
              <span className="text-xs text-[var(--muted)]">
                Page {page} of {lastPage}
              </span>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= lastPage || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--card)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}