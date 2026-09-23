import { useEffect, useRef, useState } from 'react'
import {
  UsersRound,
  ScanLine,
  TrendingUp,
  Activity,
  FileSearch,
  RefreshCw,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png' // TMC seal

/** How often the dashboard re-fetches stats + activity (live feed) */
const POLL_MS = 5000

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
    <div className="flex items-center gap-4 rounded-xl bg-[#F4F2EA] border border-slate-200 px-5 py-5">
      <div className="w-12 h-12 rounded-lg bg-[#16233F] flex items-center justify-center">
        <Icon size={22} className="text-[#EDC31D]" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wider text-[#6B6E76] uppercase">
          {label}
        </p>
        <p className="text-2xl font-bold text-[#16233F]">{value}</p>
      </div>
    </div>
  )
}

/** Brand card — TMC logo + college name (sits next to Passing Rate) */
function CollegeCard() {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-[#F4F2EA] border border-slate-200 px-5 py-5">
      <div className="w-12 h-12 rounded-full bg-[#EDC31D] flex items-center justify-center shrink-0">
        <img
          src={logo}
          alt="Trinidad Municipal College seal"
          className="w-10 h-10 object-contain"
        />
      </div>
      <p className="text-sm font-bold text-[#16233F] leading-snug tracking-wide">
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
        passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
      }`}
    >
      {status}
    </span>
  )
}

export default function Dashboard() {
  const { token } = useAuth()

  const [stats, setStats] = useState({
    applicant_total: 0,
    sheets_scanned_today: 0,
    pass_rate_percent: null,
  })
  const [results, setResults] = useState([]) // recent scoring activity rows
  const [activities, setActivities] = useState([]) // live system activity feed
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [now, setNow] = useState(Date.now()) // rolling ticker for relative times

  // Guard against setting state after unmount (interval polls + manual refresh)
  const mountedRef = useRef(true)
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const data = await api('/dashboard', { token })
      if (!mountedRef.current) return
      setStats(data)
      setResults(data.recent_results ?? [])
      setActivities(data.recent_activities ?? [])
      setLastUpdated(new Date())
    } catch {
      // Backend unreachable / no data yet — keep whatever we have
    } finally {
      if (!mountedRef.current) return
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial load + polling so the stats and activity feed stay live
  useEffect(() => {
    load()
    const pollId = setInterval(() => load(false), POLL_MS)
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
        <StatCard
          icon={UsersRound}
          label="Total Applicants"
          value={loading ? '—' : stats.applicant_total}
        />
        <StatCard
          icon={ScanLine}
          label="Sheets Scanned Today"
          value={loading ? '—' : stats.sheets_scanned_today}
        />
        <StatCard
          icon={TrendingUp}
          label="Passing Rate"
          value={loading ? '—' : `${stats.pass_rate_percent ?? 0}%`}
        />
        <CollegeCard />
      </div>

      {/* Recent scoring activity + live system feed */}
      <div className="grid grid-cols-3 gap-5 items-start">
        {/* Left — Recent Scoring Activity table */}
        <section className="col-span-2 rounded-xl bg-white border border-slate-200 overflow-hidden">
          <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity size={16} className="text-[#348BDA]" />
            <h2 className="text-sm font-bold text-[#16233F]">Recent Scoring Activity</h2>
          </header>

          {results.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[#6B6E76] bg-slate-50">
                  <th className="px-5 py-3 font-semibold">Applicant</th>
                  <th className="px-5 py-3 font-semibold">Exam</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F4F5F7]">
                    <td className="px-5 py-3 font-medium text-[#16233F]">
                      {r.applicant?.applicant_name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {r.answer_key?.exam_title ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
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
              <p className="mt-3 text-sm text-[#6B6E76]">
                No scoring activity yet. Scan a sheet on the mobile app to see it here.
              </p>
            </div>
          )}
        </section>

        {/* Right — System Activity feed (live audit log) */}
        <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity size={16} className="text-[#348BDA]" />
            <h2 className="text-sm font-bold text-[#16233F]">System Activity</h2>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              title="Refresh now"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#348BDA] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </header>

          {loading ? (
            <p className="px-5 py-8 text-sm text-[#6B6E76]">Loading activity…</p>
          ) : activities.length === 0 ? (
            <div className="py-10 text-center px-6">
              <Activity size={32} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm text-[#6B6E76]">
                No system activity yet. Actions by administrators will appear here.
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {activities.map((log) => {
                  const { who, text } = describeAction(log)
                  return (
                    <li key={log.id} className="px-5 py-3.5 flex items-start gap-3">
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-[#348BDA] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700 leading-snug">
                          <span className="font-semibold text-[#16233F]">{who}</span>{' '}
                          {text}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {timeAgo(log.created_at, now)}
                          {log.ip_address ? ` · ${log.ip_address}` : ''}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="px-5 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                {lastUpdated
                  ? `Updated ${timeAgo(lastUpdated.toISOString(), now)}`
                  : 'Auto-refreshes every 5s'}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}