import { useEffect, useState } from 'react'
import {
  UsersRound,
  ScanLine,
  TrendingUp,
  Activity,
  FileSearch,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png' // TMC seal

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api('/dashboard', { token })
      .then((data) => {
        if (!alive) return
        setStats(data)
        setResults(data.recent_results ?? [])
      })
      .catch(() => {
        // Backend unreachable / no data yet — keep the empty state
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [token])

  // Prototype feed: local/system events, newest first
  const feed = [
    { text: 'Admin Dashboard loaded', time: 'Just now' },
    { text: 'Connected to localstorage', time: 'Just now' },
    { text: 'Real-time sync enabled', time: 'Just now' },
  ]

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

      {/* Recent scoring activity + system feed */}
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

        {/* Right — System Activity feed */}
        <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity size={16} className="text-[#348BDA]" />
            <h2 className="text-sm font-bold text-[#16233F]">System Activity</h2>
          </header>
          <ul className="divide-y divide-slate-100">
            {feed.map((item, i) => (
              <li key={i} className="px-5 py-3.5 flex items-start gap-3">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-[#348BDA] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">{item.text}</p>
                  <p className="text-xs text-slate-400">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}