import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Student types shown on the answer-sheet header
const STUDENT_TYPES = ['NEW', 'TRANSFEREE', 'OLD', 'RETURNEE']

// Courses offered at TMC (fixed filter list)
const COURSES = ['BSIT', 'BSCRIM', 'BSED', 'BSOA', 'BEED', 'BAPOLSCI', 'BACOM']

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// Display code like the prototype: EXM-0001
function examId(id) {
  return `EXM-${String(id).padStart(4, '0')}`
}

function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function downloadCsv(rows, folder) {
  const header = 'Applicant,Examinee ID,Exam Date,Score,Total Items,Status'
  const lines = rows.map((r) =>
    [
      r.applicant?.applicant_name ?? '',
      examId(r.applicant_id),
      r.applicant?.examination_date ?? '',
      Number(r.score).toFixed(2),
      r.total_items ?? '',
      r.status ?? '',
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(',')
  )
  const blob = new Blob([header, ...lines].join('\n'), {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `results-${(folder?.school_year ?? 'export').replace(/\s+/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Brand colors for the PDF header/footer (nave #16233F, beige #F4F2EA, muted #6B6E76)
const PDF_NAVY = [22, 35, 63]
const PDF_MUTED = [107, 110, 118]
const PDF_BEIGE = [244, 242, 234]
const PDF_PASS = [4, 120, 87] // emerald-700
const PDF_FAIL = [185, 28, 28] // red-700

function downloadPdf(rows, folder) {
  // Lazy-load the PDF libs so they stay out of the main bundle
  Promise.all([import('jspdf'), import('jspdf-autotable')]).then(
    ([{ jsPDF }, { default: autoTable }]) => {
      const doc = new jsPDF()

      // Header: system branding + school year + generation timestamp
      doc.setFontSize(13)
      doc.setTextColor(...PDF_NAVY)
      doc.text('TMC Entrance Exam — Answer Sheet Recognition & Scoring System', 14, 16)
      doc.setFontSize(10)
      doc.setTextColor(...PDF_MUTED)
      const meta = [
        `School Year: ${folder?.school_year ?? '—'}`,
        `Total Results: ${rows.length}`,
        `Generated: ${new Date().toLocaleString()}`,
      ]
      doc.text(meta.join('   ·   ').toUpperCase(), 14, 23)

      autoTable(doc, {
        startY: 30,
        head: [['Applicant', 'Examinee ID', 'Exam Date', 'Score', 'Total Items', 'Status']],
        body: rows.map((r) => [
          r.applicant?.applicant_name ?? '',
          examId(r.applicant_id),
          r.applicant?.examination_date ?? '',
          Number(r.score).toFixed(2),
          r.total_items ?? '',
          r.status ?? '',
        ]),
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: PDF_NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: PDF_BEIGE },
        foot: [[`${rows.length} result${rows.length === 1 ? '' : 's'}`]],
        footStyles: { fillColor: PDF_BEIGE, textColor: PDF_NAVY, fontStyle: 'bold' },
        didParseCell: (data) => {
          // Color-code the Status column (index 5 of body rows)
          if (data.section === 'body' && data.column.index === 5) {
            const status = String(data.cell.raw)
            data.cell.styles.textColor =
              status === 'Passed' ? PDF_PASS : status === 'Failed' ? PDF_FAIL : PDF_MUTED
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      doc.save(`results-${(folder?.school_year ?? 'export').replace(/\s+/g, '-')}.pdf`)
    }
  )
}

/* ------------------------------------------------------------------ */
/* Folder status pill                                                  */
/* ------------------------------------------------------------------ */

function FolderStatus({ status }) {
  const current = status === 'Active'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
        current ? 'bg-[var(--ok)] text-[var(--ok-text)]' : 'bg-[var(--fill-strong)] text-[var(--muted)]'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {current ? 'Current' : 'Archived'}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Result status pill                                                  */
/* ------------------------------------------------------------------ */

function ResultStatus({ status }) {
  const passed = status === 'Passed'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
        passed ? 'bg-[var(--ok)] text-[var(--ok-text)]' : 'bg-red-100 text-red-600'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${passed ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {status || '—'}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* School-year folder card (launcher)                                  */
/* ------------------------------------------------------------------ */

function FolderCard({ folder, onOpen }) {
  const current = folder.status === 'Active'
  const results = Number(folder.applicants_result_count ?? 0)
  const applicants = Number(folder.applicants_count ?? 0)

  return (
    <div className="rounded-xl bg-[var(--panel)] border border-[var(--line)] shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-[var(--muted)]">School Year</p>
          <h3 className="text-lg font-bold text-[var(--ink)] mt-0.5">{folder.school_year}</h3>
        </div>
        <FolderStatus status={folder.status} />
      </div>

      <div className="px-5 flex-1">
        <p className="text-sm text-[var(--muted)] line-clamp-2">
          {folder.description || `Results are filed under ${folder.school_year}.`}
        </p>
        <div className="mt-4 flex items-center gap-4">
          <p
            className={`inline-flex items-center gap-1.5 text-sm font-bold ${
              current ? 'text-emerald-600' : 'text-[var(--muted)]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${current ? 'bg-emerald-500' : 'bg-[var(--fill-strong)]'}`} />
            {results} {results === 1 ? 'result' : 'results'}
          </p>
          {applicants > 0 && (
            <p className="text-xs font-medium text-[#85B3DA]">
              {applicants} {applicants === 1 ? 'applicant' : 'applicants'}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 py-4 border-t border-[var(--line)] bg-[var(--card-soft)]">
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-lg bg-[#16233F] hover:bg-[#1d2f52] px-4 py-2 text-xs font-bold text-[#EDC31D] transition-colors"
        >
          <FolderOpen size={14} />
          Open Folder
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Add New School Year modal                                           */
/* ------------------------------------------------------------------ */

function NewFolderModal({ token, onClose, onCreated }) {
  const [schoolYear, setSchoolYear] = useState(
    `SY ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
  )
  const [status, setStatus] = useState('Active') // UI: Current
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')

  function normalizedYear() {
    const sy = schoolYear.trim()
    if (!/^(SY )?\d{4}-\d{4}$/.test(sy)) {
      setFieldError('Enter a school year in SY YYYY-YYYY format, e.g. SY 2027-2028.')
      return null
    }
    setFieldError('')
    return /^SY /.test(sy) ? sy : `SY ${sy}`
  }

  async function handleCreate() {
    const sy = normalizedYear()
    if (!sy) return
    setSaving(true)
    setError('')
    try {
      const created = await api('/folders', {
        method: 'POST',
        token,
        body: {
          school_year: sy,
          status,
          description: description.trim() || null,
          course: '', // folders are school-year containers; course is optional metadata
        },
      })
      onCreated(created)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={!saving ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--card)] shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--ink)]">Add New School Year</h2>
            <p className="text-xs text-[#85B3DA] mt-0.5">
              Create a folder where examination results will be stored.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-[var(--muted-soft)] hover:bg-[var(--fill-strong)] transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">School Year</label>
            <input
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="e.g. SY 2027-2028"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm font-medium text-[var(--ink)] placeholder:text-[var(--muted-soft)] focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40"
            />
            {fieldError && <p className="mt-1 text-xs text-red-600">{fieldError}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-2">
              Folder Status
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--ink)] cursor-pointer">
                <input
                  type="radio"
                  checked={status === 'Active'}
                  onChange={() => setStatus('Active')}
                  className="accent-[#348BDA]"
                />
                Current
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--ink)] cursor-pointer">
                <input
                  type="radio"
                  checked={status === 'Archived'}
                  onChange={() => setStatus('Archived')}
                  className="accent-[#348BDA]"
                />
                Archived
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--muted)]">
              {status === 'Active'
                ? 'The active folder for the ongoing school year.'
                : 'Kept for historical results; no new examinations are filed here.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
              Description <span className="font-medium text-[var(--muted-soft)]">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm font-medium text-[var(--ink)] placeholder:text-[var(--muted-soft)] focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40 resize-none"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--fill-strong)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-lg bg-[#EDC31D] hover:bg-[#e2b814] px-5 py-2 text-sm font-bold text-[var(--ink)] shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Folder'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Result detail modal                                                 */
/* ------------------------------------------------------------------ */

function ResultDetail({ result, onClose }) {
  const applicant = result.applicant ?? {}
  const ak = result.answerKey ?? {}
  const score = Number(result.score)
  const passing = Number(result.passing_score ?? ak.passing_score ?? 0)

  const rows = [
    ['Applicant', applicant.applicant_name],
    ['Examinee ID', examId(result.applicant_id)],
    ['Student Type', applicant.student_type || '—'],
    ['Course', applicant.folder?.course || '—'],
    ['Exam Date', formatDate(applicant.examination_date)],
    ['Answer Key', ak.exam_title || '—'],
    ['Total Items', result.total_items],
    ['Correct / Incorrect', `${result.correct_count} / ${result.incorrect_count}`],
    ['Passing Score', `${passing}%`],
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--card)] shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--ink)]">Applicant Result</h2>
            <p className="text-xs text-[#85B3DA] mt-0.5">
              {applicant.applicant_name} · {examId(result.applicant_id)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ResultStatus status={result.status} />
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--muted-soft)] hover:bg-[var(--fill-strong)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-[var(--panel)] border border-[var(--line)] px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-[var(--muted)] uppercase">
              Score
            </p>
            <p className="mt-0.5 text-2xl font-bold text-[var(--ink)]">{score.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold tracking-wider text-[var(--muted)] uppercase">
              Passing Score
            </p>
            <p className="mt-0.5 text-sm font-bold text-[#348BDA]">{passing}%</p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-[var(--line-soft)]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5">
              <p className="text-xs font-semibold text-[var(--muted)]">{label}</p>
              <p className="text-sm font-semibold text-[var(--ink)] text-right">{value ?? '—'}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--fill-strong)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Select input (shared by the filter bar)                             */
/* ------------------------------------------------------------------ */

const selectCls =
  'rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm font-medium text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40'

/* ------------------------------------------------------------------ */
/* Results table inside a folder                                       */
/* ------------------------------------------------------------------ */

function FolderResults({ folderId }) {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [folder, setFolder] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ search: '', course: '', studentType: '', status: '' })
  const [detail, setDetail] = useState(null)

  async function load() {
    try {
      const [f, rs] = await Promise.all([
        api(`/folders/${folderId}`, { token }),
        api(`/results?folder_id=${folderId}`, { token }),
      ])
      setFolder(f)
      setResults(rs)
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
  }, [folderId])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return results.filter((r) => {
      const name = (r.applicant?.applicant_name ?? '').toLowerCase()
      const id = examId(r.applicant_id).toLowerCase()
      if (q && !name.includes(q) && !id.includes(q)) return false
      if (filters.course && (r.applicant?.folder?.course ?? '') !== filters.course) return false
      if (filters.studentType && (r.applicant?.student_type ?? '') !== filters.studentType)
        return false
      if (filters.status && r.status !== filters.status) return false
      return true
    })
  }, [results, filters])

  const hasFilters = Boolean(
    filters.search.trim() || filters.course || filters.studentType || filters.status
  )

  return (
    <div>
      {/* Toolbar: back to all school years */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <button
          onClick={() => navigate('/results')}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-3.5 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--fill)] transition-colors"
        >
          <ArrowLeft size={16} />
          All School Years
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
        <p className="text-sm text-[var(--muted)]">Loading folder results…</p>
      ) : (
        <>
          {/* Filter bar */}
          <div className="rounded-xl bg-[var(--card)] border border-[var(--line)] shadow-sm px-4 py-3 flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-soft)]" />
              <input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search by name or examinee ID…"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] pl-9 pr-3 py-2 text-sm font-medium text-[var(--ink)] placeholder:text-[var(--muted-soft)] focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40"
              />
            </div>
            <select
              value={filters.course}
              onChange={(e) => setFilters((f) => ({ ...f, course: e.target.value }))}
              className={selectCls}
            >
              <option value="">All Courses</option>
              {COURSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={filters.studentType}
              onChange={(e) => setFilters((f) => ({ ...f, studentType: e.target.value }))}
              className={selectCls}
            >
              <option value="">All Student Types</option>
              {STUDENT_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className={selectCls}
            >
              <option value="">All Status</option>
              <option value="Passed">Passed</option>
              <option value="Failed">Failed</option>
            </select>
            {hasFilters && (
              <button
                onClick={() => setFilters({ search: '', course: '', studentType: '', status: '' })}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--fill-strong)] transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => downloadCsv(filtered, folder)}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#348BDA] px-4 py-2 text-sm font-bold text-[#348BDA] hover:bg-[#348BDA]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={15} />
              Export CSV
            </button>
            <button
              onClick={() => downloadPdf(filtered, folder)}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#348BDA] px-4 py-2 text-sm font-bold text-[#348BDA] hover:bg-[#348BDA]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileText size={15} />
              Export PDF
            </button>
          </div>

          {/* Folder header line */}
          <p className="text-sm text-[var(--muted)] mb-3">
            <span className="font-bold text-[var(--ink)]">{folder?.school_year}</span>
            <span className="mx-1.5">·</span>
            {filtered.length} of {results.length} result{results.length === 1 ? '' : 's'} shown
          </p>

          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--card-soft)] px-8 py-14 text-center">
              <FolderOpen size={38} className="mx-auto text-[#85B3DA]" />
              <h3 className="mt-3 text-base font-bold text-[var(--ink)]">
                No results filed under {folder?.school_year} yet
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)] max-w-md mx-auto">
                Results populate here automatically after answer sheets are scanned and scored by
                the mobile OMR scanner.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--card-soft)] px-8 py-14 text-center">
              <Search size={34} className="mx-auto text-[#85B3DA]" />
              <h3 className="mt-3 text-base font-bold text-[var(--ink)]">
                No results match the current filters
              </h3>
              <button
                onClick={() =>
                  setFilters({ search: '', course: '', studentType: '', status: '' })
                }
                className="mt-4 rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--fill)] transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#16233F] text-white text-[11px] font-semibold tracking-wider">
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Examinee ID</th>
                    <th className="px-4 py-3">Exam Date</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--line-soft)] hover:bg-[var(--fill)]">
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-[var(--ink)]">
                          {r.applicant?.applicant_name ?? '—'}
                        </p>
                        {r.applicant?.student_type && (
                          <p className="text-[11px] font-medium text-[#85B3DA]">
                            {r.applicant.student_type}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#348BDA]">
                        {examId(r.applicant_id)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--muted)]">
                        {formatDate(r.applicant?.examination_date)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-[var(--ink)]">
                          {Number(r.score).toFixed(2)}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">of {r.total_items} items</p>
                      </td>
                      <td className="px-4 py-3">
                        <ResultStatus status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDetail(r)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--fill)] transition-colors"
                        >
                          <Eye size={13} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Result detail */}
      {detail && <ResultDetail result={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Folder launcher (grid)                                              */
/* ------------------------------------------------------------------ */

function FolderGrid() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)

  async function load() {
    try {
      const data = await api('/folders', { token })
      setFolders(data)
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

  const currentCount = folders.filter((f) => f.status === 'Active').length

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <p className="text-sm text-[var(--muted)]">
          {folders.length} school year folder{folders.length === 1 ? '' : 's'} ·{' '}
          <span className="font-semibold text-emerald-600">{currentCount} current</span>
          <span className="ml-3 text-xs text-[#85B3DA]">
            Pick a folder first — results are filed per school year.
          </span>
        </p>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#EDC31D] hover:bg-[#e2b814] px-5 py-2.5 text-sm font-bold text-[var(--ink)] shadow-sm transition-colors"
        >
          <Plus size={16} />
          Add New SY
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
        <p className="text-sm text-[var(--muted)]">Loading school year folders…</p>
      ) : folders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--card-soft)] px-8 py-14 text-center">
          <FolderOpen size={38} className="mx-auto text-[#85B3DA]" />
          <h3 className="mt-3 text-base font-bold text-[var(--ink)]">No school year folders yet</h3>
          <p className="mt-1 text-sm text-[var(--muted)] max-w-md mx-auto">
            Create a folder for the current school year first. Examination results are filed under
            each school year folder.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#EDC31D] hover:bg-[#e2b814] px-5 py-2.5 text-sm font-bold text-[var(--ink)] shadow-sm transition-colors"
          >
            <Plus size={16} />
            Add New SY
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {folders.map((f) => (
            <FolderCard key={f.id} folder={f} onOpen={() => navigate(`/results/${f.id}`)} />
          ))}
        </div>
      )}

      {/* New SY modal (launcher) */}
      {showNew && (
        <NewFolderModal
          token={token}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false)
            load()
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ExaminationResults() {
  const { folderId } = useParams()
  return folderId ? <FolderResults folderId={Number(folderId)} /> : <FolderGrid />
}