import { useEffect, useRef, useState } from 'react'
import {
  UsersRound,
  ScanLine,
  TrendingUp,
  Activity,
  FileSearch,
  RefreshCw,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo-256.png' // TMC seal
import { FeedRowSkeleton, StatCardSkeleton, TableSkeleton } from '../components/Skeleton'

/** How often the live System Activity feed re-fetches */
const POLL_MS = 15000

// Stats/results cache so every visit paints instantly from the last payload,
// then refreshes silently in the background. 5-min TTL; localStorage (not
// sessionStorage) survives tab closes, so even a fresh tab shows real data
// immediately. The activity feed is NOT cached — it's live and always fresh.
const CACHE_KEY = 'codenexus:dashboard:v2'
const CACHE_TTL_MS = 5 * 60 * 1000

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { at, data } = JSON.parse(raw)
    if (!data || Date.now() - at > CACHE_TTL_MS) return null
    return data
  } catch {
    return null
  }
}

/** Compact relative time — rolls live via the dashboard ticker */
function timeAgo(iso, now) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, now - then)
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

/** Turn an audit-log action into a human-readable sentence */
function describeAction(log) {
  const who = log.user?.full_name ?? 'System'
  const ref = log.record_id != null ? ` #${log.record_id}` : ''
  let text
  switch (log.action) {
    case 'LOGIN':
      text = 'signed in'
      break
    case 'LOGOUT':
      text = 'signed out'
      break
    case 'CREATE_ANSWER_KEY':
      text = `created answer key${ref}`
      break
    case 'UPDATE_ANSWER_KEY':
      text = `updated answer key${ref}`
      break
    case 'ACTIVATE_ANSWER_KEY':
      text = `set answer key${ref} as active`
      break
    case 'DEACTIVATE_ANSWER_KEY':
      text = `deactivated answer key${ref}`
      break
    case 'DELETE_ANSWER_KEY':
      text = `deleted answer key${ref}`
      break
    case 'SCAN_ANSWER_SHEET':
      text = 'scanned an answer sheet'
      break
    case 'CREATE_FOLDER':
      text = `created examination folder${ref}`
      break
    case 'DELETE_FOLDER':
      text = `deleted examination folder${ref}`
      break
    case 'CREATE_USER':
      text = `created user account${ref}`
      break
    case 'UPDATE_USER':
      text = `updated user account${ref}`
      break
    case 'DELETE_USER':
      text = `deleted user account${ref}`
      break
    default:
      text = log.action.toLowerCase().replace(/_/g, ' ')
  }
  return { who, text }
}

/** Small KPI card — beige box with a leading brand icon */
function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] px-5 py-5">
      <div className="w-12 h-12 rounded-lg bg-[#16233F] flex items-center justify-center">
        <Icon size={22} className="text-[#EDC31D]" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wider text-[var(--muted)] uppercase">
          {label}
        </p>
        <p className="text-2xl font-bold text-[var(--ink)]">{value}</p>
      </div>
    </div>
  )
}

/** Brand card — TMC logo + college name (sits next to Passing Rate) */
function CollegeCard() {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] px-5 py-5">
      <div className="w-12 h-12 rounded-full bg-[#EDC31D] flex items-center justify-center shrink-0">
        <img
          src={logo}
          alt="Trinidad Municipal College seal"
          className="w-10 h-10 object-contain"
        />
      </div>
      <p className="text-sm font-bold text-[var(--ink)] leading-snug tracking-wide">
        TRINIDAD MUNICIPAL COLLEGE
      </p>
    </div>
  )
}

function StatusBadge({ status }) {
  const passed = status === 'Passed'
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
        passed ? 'bg-[var(--ok)] text-[var(--ok-text)]' : 'bg-red-100 text-red-600'
      }`}
    >
      {status}
    </span>
  )
}

export default function Dashboard() {
  const { token } = useAuth()

  // Hydrate from the session cache (if fresh) so remounts paint instantly.
  // loading stays false when cached, so the background refresh is silent.
  const cached = useRef(readCache()).current
  const [stats, setStats] = useState(
    cached ?? { applicant_total: 0, sheets_scanned_today: 0, pass_rate_percent: null },
  )
  const [results, setResults] = useState(cached?.recent_results ?? []) // recent scoring activity rows
  const [activities, setActivities] = useState([]) // live System Activity feed
  const [loading, setLoading] = useState(!cached)
  const [refreshing, setRefreshing] = useState(false)
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedLastUpdated, setFeedLastUpdated] = useState(null)
  const [feedCleared, setFeedCleared] = useState(false)
  const [now, setNow] = useState(Date.now()) // rolling ticker for relative times

  // StrictMode-safe unmount guard. StrictMode simulates mount → unmount →
  // remount in dev (runs each effect, its cleanup, then the effect again),
  // so the ref must be re-set to true on every effect run — otherwise the
  // first fetch's response is discarded and the page never finishes loading.
  const mountedRef = useRef(true)
  // Skip a fetch when one is already in flight (StrictMode double-mount, or a
  // poll overlapping a manual refresh). The dev backend is single-threaded,
  // so duplicate requests just queue and slow the page.
  const inflightRef = useRef(false) // stats fetch
  const feedInflightRef = useRef(false) // activity feed fetch
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = async (manual = false) => {
    if (manual) setRefreshing(true)
    if (inflightRef.current) return // a request is already running — don't pile up
    inflightRef.current = true
    try {
      const data = await api('/dashboard', { token })
      if (!mountedRef.current) return
      setStats(data)
      setResults(data.recent_results ?? [])
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
      } catch {
        /* storage unavailable — page still works */
      }
    } catch {
      // Backend unreachable / no data yet — keep whatever we have
    } finally {
      inflightRef.current = false
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  const loadActivity = async () => {
    if (feedInflightRef.current) return
    feedInflightRef.current = true
    try {
      const data = await api('/dashboard/activity', { token })
      if (!mountedRef.current) return
      setActivities(data ?? [])
      setFeedLastUpdated(new Date())
      setFeedCleared(false)
    } catch {
      // Backend unreachable — keep whatever we have
    } finally {
      feedInflightRef.current = false
      if (mountedRef.current) setFeedLoading(false)
    }
  }

  // Initial load: stats/results + a first feed grab. When the tab regains
  // focus, refresh both. This runs the page's critical path on /dashboard
  // alone — the feed is its own request and never blocks the paint.
  useEffect(() => {
    load()
    loadActivity()
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now())
        load()
        loadActivity()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // The System Activity feed is the dashboard's only "live" piece, so only it
  // polls — paused while the tab is hidden so background tabs can't pile
  // requests onto the single-threaded dev server.
  useEffect(() => {
    const pollId = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      loadActivity()
    }, POLL_MS)
    return () => clearInterval(pollId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Roll the "Xs ago" labels every 5s so the feed feels live between polls
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(tick)
  }, [])

  return (
    <div className="space-y-6">
      {/* KPI stat cards */}
      <div className="grid grid-cols-3 xl:grid-cols-4 gap-5">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard icon={UsersRound} label="Total Applicants" value={stats.applicant_total} />
            <StatCard
              icon={ScanLine}
              label="Sheets Scanned Today"
              value={stats.sheets_scanned_today}
            />
            <StatCard
              icon={TrendingUp}
              label="Passing Rate"
              value={`${stats.pass_rate_percent ?? 0}%`}
            />
            <CollegeCard />
          </>
        )}
      </div>

      {/* Recent scoring activity + live system feed */}
      <div className="grid grid-cols-3 gap-5 items-start">
        {/* Left — Recent Scoring Activity table */}
        <section className="col-span-2 rounded-xl bg-[var(--card)] border border-[var(--line)] overflow-hidden">
          <header className="px-5 py-4 border-b border-[var(--line-soft)] flex items-center gap-2">
            <Activity size={16} className="text-[#348BDA]" />
            <h2 className="text-sm font-bold text-[var(--ink)]">Recent Scoring Activity</h2>
            <button
              onClick={() => {
                load(true)
                loadActivity()
              }}
              disabled={refreshing}
              title="Refresh now"
              className="ml-auto rounded-md p-1.5 text-[var(--muted-soft)] hover:bg-[var(--fill-strong)] hover:text-[#348BDA] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </header>

          {loading ? (
            <TableSkeleton cols={4} rows={5} />
          ) : results.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--muted)] bg-[var(--fill)]">
                  <th className="px-5 py-3 font-semibold">Applicant</th>
                  <th className="px-5 py-3 font-semibold">Exam</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-soft)]">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--bg)]">
                    <td className="px-5 py-3 font-medium text-[var(--ink)]">
                      {r.applicant?.applicant_name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[var(--muted)]">
                      {r.answer_key?.exam_title ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[var(--muted)]">
                      {Number(r.score)}
                      {r.total_items ? ` / ${r.total_items}` : ''}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-14 text-center px-6">
              <FileSearch size={40} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm text-[var(--muted)]">
                No scoring activity yet. Scan a sheet on the mobile app to see it here.
              </p>
            </div>
          )}
        </section>

        {/* Right — System Activity feed (live audit log) */}
        <section className="rounded-xl bg-[var(--card)] border border-[var(--line)] overflow-hidden">
          <header className="px-5 py-4 border-b border-[var(--line-soft)] flex items-center gap-2">
            <Activity size={16} className="text-[#348BDA]" />
            <h2 className="text-sm font-bold text-[var(--ink)]">System Activity</h2>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
            <button
              type="button"
              onClick={() => {
                setActivities([])
                setFeedCleared(true)
              }}
              title="Clear feed"
              aria-label="Clear feed"
              className="rounded-md p-1 text-[var(--muted-soft)] hover:bg-[var(--fill-strong)] hover:text-[#348BDA] transition-colors"
            >
              <X size={14} />
            </button>
          </header>

          {feedLoading ? (
            <div className="divide-y divide-[var(--line-soft)]">
              <FeedRowSkeleton />
              <FeedRowSkeleton />
              <FeedRowSkeleton />
              <FeedRowSkeleton />
              <FeedRowSkeleton />
            </div>
          ) : activities.length === 0 ? (
            feedCleared ? (
              <div className="py-10 text-center px-6">
                <X size={32} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Feed cleared — new answer key activity will appear here.
                </p>
              </div>
            ) : (
              <div className="py-10 text-center px-6">
                <Activity size={32} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm text-[var(--muted)]">
                  No answer key activity yet. Created, updated, or deleted keys will appear here.
                </p>
              </div>
            )
          ) : (
            <>
              <ul className="divide-y divide-[var(--line-soft)]">
                {activities.map((log) => {
                  const { who, text } = describeAction(log)
                  return (
                    <li key={log.id} className="px-5 py-3.5 flex items-start gap-3">
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-[#348BDA] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--muted)] leading-snug">
                          <span className="font-semibold text-[var(--ink)]">{who}</span>{' '}
                          {text}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted-soft)]">
                          {timeAgo(log.created_at, now)}
                          {log.ip_address ? ` · ${log.ip_address}` : ''}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="px-5 py-2.5 border-t border-[var(--line-soft)] text-[11px] text-[var(--muted-soft)]">
                {feedLastUpdated
                  ? `Updated ${timeAgo(feedLastUpdated.toISOString(), now)}`
                  : 'Auto-refreshes every 15s'}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}