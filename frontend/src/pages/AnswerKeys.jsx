import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Download,
  KeyRound,
  Pencil,
  Plus,
  Power,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { CardSkeleton, FormSkeleton } from '../components/Skeleton'

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

// Standard sections of the TMC entrance exam answer sheet
const SECTION_PRESETS = [
  { name: 'Inductive/Logical Test', count: 10, options: 'A-E' },
  { name: 'Mathematics', count: 30, options: 'A-D' },
  { name: 'English', count: 30, options: 'A-D' },
  { name: 'Science & Technology', count: 20, options: 'A-D' },
  { name: 'Aptitude', count: 10, options: 'A-D' },
]

const CHOICES = {
  'A-D': ['A', 'B', 'C', 'D'],
  'A-E': ['A', 'B', 'C', 'D', 'E'],
}

// Display code like the prototype: AK-2026-001 (year from school year + id)
function keyCode(ak, includeYear = true) {
  const year = (String(ak.school_year ?? '').match(/(\d{4})/) || [])[1] || new Date().getFullYear()
  const padded = String(ak.id).padStart(3, '0')
  return includeYear ? `AK-${year}-${padded}` : `AK-${padded}`
}

function blankSections() {
  return SECTION_PRESETS.map((p) => ({ ...p, answers: Array(p.count).fill(null) }))
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/* ------------------------------------------------------------------ */
/* Status badge                                                        */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }) {
  const active = status === 'Active'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
        active ? 'bg-[var(--ok)] text-[var(--ok-text)]' : 'bg-[var(--fill-strong)] text-[var(--muted)]'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'ACTIVE' : 'ARCHIVED'}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Answer-key card (listing)                                           */
/* ------------------------------------------------------------------ */

function KeyCard({ ak, busy, onEdit, onActivate, onDeactivate, onDelete }) {
  const sections = useMemo(() => {
    const map = new Map()
    for (const it of ak.items ?? []) {
      const name = it.section || 'Uncategorized'
      map.set(name, (map.get(name) || 0) + 1)
    }
    return Array.from(map.entries())
  }, [ak.items])

  const active = ak.status === 'Active'
  const disabled = busy

  return (
    <div className="rounded-xl bg-[var(--panel)] border border-[var(--line)] shadow-sm overflow-hidden">
      {/* Header: key code + name + status */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-[var(--muted)]">{keyCode(ak)}</p>
          <h3 className="text-base font-bold text-[var(--ink)] mt-0.5 truncate">{ak.exam_title}</h3>
        </div>
        <StatusBadge status={ak.status} />
      </div>

      {/* Field rows */}
      <div className="px-5 grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-wider text-[var(--muted)] uppercase">
            School Year
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{ak.school_year}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-wider text-[var(--muted)] uppercase">
            Total Items
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{ak.items_count} items</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-wider text-[var(--muted)] uppercase">
            Passing Score
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">
            {Number(ak.passing_score)}%
          </p>
        </div>
      </div>

      {/* Section breakdown */}
      <div className="px-5 pt-4 pb-5">
        <p className="text-[10px] font-semibold tracking-wider text-[var(--muted)] uppercase">
          Sections ({sections.length})
        </p>
        {sections.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {sections.map(([name, count]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--card-soft)] border border-[var(--line)] px-2.5 py-1 text-xs font-medium text-[var(--ink)]"
              >
                {name}
                <span className="text-[#348BDA] font-bold">{count}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-[var(--muted)] italic">
            No sections yet — open Edit to define items and answers.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3.5 border-t border-[var(--line)] bg-[var(--card-soft)] flex items-center gap-2 flex-wrap">
        {active ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mr-auto">
            <CircleCheck size={14} />
            Active — used by the mobile scanner
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-soft)] mr-auto">
            <KeyRound size={14} />
            Not active — scanner uses the active key
          </span>
        )}
        {active ? (
          <button
            onClick={onDeactivate}
            disabled={disabled}
            title="Switch this key off so the scanner stops using it"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--fill)] transition-colors disabled:opacity-50"
          >
            <Power size={14} />
            Set as Inactive
          </button>
        ) : (
          <button
            onClick={onActivate}
            disabled={disabled}
            title="Make this the only active key"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#16233F] px-3 py-2 text-xs font-bold text-[#EDC31D] hover:bg-[#1d2f52] transition-colors disabled:opacity-50"
          >
            <Star size={14} />
            Set as Active
          </button>
        )}
        <button
          onClick={onEdit}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--fill)] transition-colors disabled:opacity-50"
        >
          <Pencil size={14} />
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={disabled}
          title="Delete this answer key permanently"
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Delete confirmation                                                 */
/* ------------------------------------------------------------------ */

function DeleteConfirm({ ak, busy, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={!busy ? onCancel : undefined}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-[var(--card)] shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <h2 className="text-base font-bold text-[var(--ink)]">Delete answer key?</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          “{ak.exam_title}” ({keyCode(ak)}) and its {ak.items_count} answer items will be
          permanently removed. This cannot be undone.
        </p>
        {ak.status === 'Active' && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              This is the active key. The mobile scanner will have no default answer key until
              you activate another one.
            </span>
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-[var(--line)] py-2.5 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--fill)] transition-colors disabled:opacity-50"
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
/* Add / Edit modal                                                    */
/* ------------------------------------------------------------------ */

const JSON_TEMPLATE = JSON.stringify(
  {
    exam_title: 'TMC Entrance Exam 2026',
    school_year: 'SY 2026-2027',
    passing_score: 75,
    sections: [
      { name: 'Inductive/Logical Test', items: 10, choices: 'A-E', answers: ['', '', '', '', '', '', '', '', '', ''] },
      { name: 'Mathematics', items: 30, choices: 'A-D', answers: [] },
      { name: 'English', items: 30, choices: 'A-D', answers: [] },
      { name: 'Science & Technology', items: 20, choices: 'A-D', answers: [] },
      { name: 'Aptitude', items: 10, choices: 'A-D', answers: [] },
    ],
  },
  null,
  2
)

const CSV_TEMPLATE = [
  'Section Name,Items,Choices,Answers',
  'Inductive/Logical Test,10,A-E,',
  'Mathematics,30,A-D,',
  'English,30,A-D,',
  'Science & Technology,20,A-D,',
  'Aptitude,10,A-D,',
].join('\n')

function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function AnswerKeyModal({ mode, editingKey, token, onClose, onSaved }) {
  const [title, setTitle] = useState('')
  const [schoolYear, setSchoolYear] = useState('')
  const [passingScore, setPassingScore] = useState('75')
  const [sections, setSections] = useState([])
  const [expanded, setExpanded] = useState(() => new Set())
  const [ready, setReady] = useState(mode === 'new')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [importedMsg, setImportedMsg] = useState('')

  // Preload preset sections (new) or fetch the full key (edit)
  useEffect(() => {
    if (mode === 'new') {
      setSections(blankSections())
      setSchoolYear(`SY ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`)
      return
    }
    api(`/answer-keys/${editingKey.id}`, { token })
      .then((key) => {
        setTitle(key.exam_title)
        setSchoolYear(key.school_year)
        setPassingScore(String(Number(key.passing_score)))
        const items = key.items ?? []
        const bySection = new Map()
        for (const it of items) {
          const name = it.section || 'General'
          if (!bySection.has(name)) bySection.set(name, [])
          bySection.get(name).push(it)
        }
        const built = Array.from(bySection.entries()).map(([name, list]) => {
          list.sort((a, b) => a.item_number - b.item_number)
          const hasE = list.some((i) => i.correct_answer === 'E')
          return {
            name,
            count: list.length,
            options: hasE ? 'A-E' : 'A-D',
            answers: list.map((i) => i.correct_answer),
          }
        })
        const secs = built.length > 0 ? built : blankSections()
        setSections(secs)
        setExpanded(new Set(secs.map((_, i) => i))) // expand answers in edit mode
      })
      .catch((e) => setError(e.message))
      .finally(() => setReady(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalItems = sections.reduce((n, s) => n + s.count, 0)
  const answered = sections.reduce((n, s) => n + s.answers.filter(Boolean).length, 0)
  const allAnswered = answered === totalItems
  const missing = totalItems - answered

  function updateSection(idx, patch) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s
        let next = { ...s, ...patch }
        if (patch.count !== undefined) {
          const n = Math.max(0, Number(patch.count) || 0)
          next.count = n
          next.answers = Array.from({ length: n }, (_, k) => s.answers[k] ?? null)
        }
        if (patch.options && patch.options !== s.options) {
          const letters = CHOICES[patch.options]
          next.answers = s.answers.map((a) => (a && letters.includes(a) ? a : null))
        }
        return next
      })
    )
  }

  function setAnswer(idx, itemIdx, value) {
    setSections((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, answers: s.answers.map((a, k) => (k === itemIdx ? value : a)) } : s
      )
    )
  }

  function addSection() {
    setSections((prev) => [
      ...prev,
      { name: `Section ${prev.length + 1}`, count: 10, options: 'A-D', answers: Array(10).fill(null) },
    ])
  }

  function removeSection(idx) {
    setSections((prev) => prev.filter((_, i) => i !== idx))
    setExpanded((prev) => {
      const next = new Set(prev)
      next.delete(idx)
      return next
    })
  }

  function toggleExpand(idx) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  /* ---------------- file import ---------------- */

  function readFile(file) {
    if (!file) return
    if (file.size > 1024 * 1024) {
      setError('File exceeds the 1 MB limit.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        applyImport(String(reader.result), file.name)
      } catch (e) {
        setError(`Could not read "${file.name}": ${e.message}`)
      }
    }
    reader.readAsText(file)
  }

  function applyImport(text, filename) {
    const isJson = /\.json$/i.test(filename)
    let secs = []
    if (isJson) {
      const data = JSON.parse(text)
      if (data.exam_title) setTitle(data.exam_title)
      if (data.school_year) setSchoolYear(data.school_year)
      if (data.passing_score !== undefined) setPassingScore(String(Number(data.passing_score)))
      const src = Array.isArray(data.sections) ? data.sections : []
      secs = src.map((s) => ({
        name: s.name || 'General',
        count: Math.max(0, Number(s.items ?? s.count) || 0),
        options: s.choices === 'A-E' || s.options === 'A-E' ? 'A-E' : 'A-D',
        answers: Array.from(
          { length: Math.max(0, Number(s.items ?? s.count) || 0) },
          (_, k) => {
            const a = (s.answers ?? [])[k]
            return a && String(a).trim() ? String(a).trim().toUpperCase() : null
          }
        ),
      }))
    } else {
      // CSV: header + rows (Section Name,Items,Choices,Answers)
      const rows = text
        .split(/\r?\n/)
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(1) // skip header row
      secs = rows.map((row) => {
        const [name, itemsRaw, choicesRaw, answersRaw = ''] = row.split(',').map((c) => c.trim())
        const n = Math.max(0, Number(itemsRaw) || 0)
        const letters = String(answersRaw).replace(/[^a-eA-E]/g, '').toUpperCase().split('')
        const answers = Array.from({ length: n }, (_, k) => letters[k] ?? null)
        return {
          name: name || 'General',
          count: n,
          options: choicesRaw === 'A-E' ? 'A-E' : 'A-D',
          answers,
        }
      })
    }
    if (secs.length === 0) {
      setError('No sections found in the imported file. Use the template as a guide.')
      return
    }
    setSections(secs)
    setExpanded(new Set(secs.map((_, i) => i)))
    const total = secs.reduce((n, s) => n + s.count, 0)
    setImportedMsg(`Imported ${plural(total, 'item')} across ${plural(secs.length, 'section')}.`)
    setError('')
  }

  /* ---------------- save ---------------- */

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const payload = {
        exam_title: title.trim(),
        school_year: schoolYear.trim(),
        passing_score: Number(passingScore),
      }
      const items = []
      for (const s of sections) {
        for (let i = 0; i < s.count; i++) {
          const a = s.answers[i]
          if (a) {
            items.push({
              section: s.name.trim() || 'General',
              item_number: i + 1,
              correct_answer: a,
              points: 1,
            })
          }
        }
      }
      if (mode === 'new') {
        await api('/answer-keys', { method: 'POST', token, body: { ...payload, items } })
      } else {
        await api(`/answer-keys/${editingKey.id}`, { method: 'PUT', token, body: payload })
        // Answers are always replaced through the dedicated items route
        await api(`/answer-keys/${editingKey.id}/items`, {
          method: 'PUT',
          token,
          body: { items },
        })
      }
      onSaved()
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
        className="w-full max-w-3xl rounded-2xl bg-[var(--card)] shadow-xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[var(--line)]">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--ink)]">
              {mode === 'new' ? 'New Answer Key' : `Editing ${keyCode(editingKey)} – ${editingKey.exam_title}`}
            </h2>
            <p className="text-xs text-[#85B3DA] mt-0.5">
              {mode === 'new'
                ? 'Create the official answer key for an examination.'
                : 'Update the key details and item answers.'}
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

        {!ready ? (
          <FormSkeleton rows={4} />
        ) : (
          <>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {importedMsg && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700">
                  {importedMsg}
                </div>
              )}

              {/* Basic information */}
              <section>
                <h3 className="text-sm font-bold text-[var(--ink)] mb-3 uppercase tracking-wide">
                  Basic Information
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                      Answer Key Name
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. TMC Entrance Exam 2026"
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm font-medium text-[var(--ink)] placeholder:text-[var(--muted-soft)] focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                      School Year
                    </label>
                    <input
                      value={schoolYear}
                      onChange={(e) => setSchoolYear(e.target.value)}
                      placeholder="SY 2026-2027"
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm font-medium text-[var(--ink)] placeholder:text-[var(--muted-soft)] focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                      Passing Score (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={passingScore}
                      onChange={(e) => setPassingScore(e.target.value)}
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm font-medium text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40"
                    />
                  </div>
                </div>
              </section>

              {/* Import from file */}
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <h3 className="text-sm font-bold text-[var(--ink)]">
                    Import from File <span className="text-[11px] font-medium text-[var(--muted)]">(optional)</span>
                  </h3>
                  <div className="flex gap-4 text-xs font-semibold text-[#348BDA]">
                    <button
                      onClick={() => download('answer-key-template.json', JSON_TEMPLATE)}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <Download size={13} />
                      JSON template
                    </button>
                    <button
                      onClick={() => download('answer-key-template.csv', CSV_TEMPLATE, 'text/csv')}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <Download size={13} />
                      CSV template
                    </button>
                  </div>
                </div>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    readFile(e.dataTransfer.files?.[0])
                  }}
                  className="rounded-lg border-2 border-dashed border-[#85B3DA] bg-[var(--card-soft)] px-4 py-6 text-center transition-colors hover:bg-[var(--fill)]"
                >
                  <Upload size={22} className="mx-auto text-[#348BDA]" />
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Drag &amp; drop a JSON or CSV file here, or{' '}
                    <label className="cursor-pointer text-[#348BDA] underline">
                      browse
                      <input
                        type="file"
                        accept=".json,.csv"
                        className="hidden"
                        onChange={(e) => {
                          readFile(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">JSON / CSV · max 1 MB</p>
                </div>
              </section>

              {/* Sections builder */}
              <section>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--ink)] uppercase tracking-wide">
                      Answer Sections
                    </h3>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      {plural(totalItems, 'item')} across {plural(sections.length, 'section')} ·{' '}
                      {answered} answered
                    </p>
                  </div>
                  <button
                    onClick={addSection}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#348BDA] px-3 py-2 text-xs font-bold text-[#348BDA] hover:bg-[#348BDA]/10 transition-colors"
                  >
                    <Plus size={14} />
                    Add Section
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[#16233F] text-white text-[11px] font-semibold tracking-wider">
                        <th className="px-4 py-2.5">Section Name</th>
                        <th className="px-3 py-2.5 w-24">Items</th>
                        <th className="px-3 py-2.5 w-28">Choices</th>
                        <th className="px-3 py-2.5 w-24">Answered</th>
                        <th className="px-2 py-2.5 w-16 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sections.map((s, idx) => {
                        const secAnswered = s.answers.filter(Boolean).length
                        const isOpen = expanded.has(idx)
                        return (
                          <Fragment key={idx}>
                            <tr className="border-t border-[var(--line-soft)] hover:bg-[var(--fill)]">
                              <td className="px-4 py-2.5">
                                <input
                                  value={s.name}
                                  onChange={(e) => updateSection(idx, { name: e.target.value })}
                                  placeholder="Section name"
                                  className="w-full rounded-md border border-[var(--line)] px-2.5 py-1.5 text-sm font-medium text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40 focus:border-[#348BDA]"
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={200}
                                  value={s.count}
                                  onChange={(e) => updateSection(idx, { count: e.target.value })}
                                  className="w-16 rounded-md border border-[var(--line)] px-2 py-1.5 text-sm font-semibold text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40"
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                <select
                                  value={s.options}
                                  onChange={(e) => updateSection(idx, { options: e.target.value })}
                                  className="rounded-md border border-[var(--line)] px-2 py-1.5 text-sm font-semibold text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40"
                                >
                                  <option value="A-D">A–D (4)</option>
                                  <option value="A-E">A–E (5)</option>
                                </select>
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                    secAnswered === s.count && s.count > 0
                                      ? 'bg-[var(--ok)] text-[var(--ok-text)]'
                                      : 'bg-[var(--fill-strong)] text-[var(--muted)]'
                                  }`}
                                >
                                  {secAnswered}/{s.count}
                                </span>
                              </td>
                              <td className="px-2 py-2.5">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => toggleExpand(idx)}
                                    title={isOpen ? 'Hide answers' : 'Edit answers'}
                                    className="rounded-md p-1.5 text-[var(--muted-soft)] hover:bg-[var(--fill-strong)] hover:text-[#348BDA] transition-colors"
                                  >
                                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  </button>
                                  <button
                                    onClick={() => removeSection(idx)}
                                    title="Remove section"
                                    className="rounded-md p-1.5 text-[var(--muted-soft)] hover:bg-red-50 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="border-t border-[var(--line-soft)] bg-[var(--panel)]">
                                <td colSpan={5} className="px-4 py-3">
                                  <p className="text-[11px] font-semibold text-[var(--muted)] mb-2">
                                    Correct answers — item number and choice
                                  </p>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {s.answers.map((a, i) => (
                                      <div key={i} className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-medium text-[var(--muted)] w-5 text-right shrink-0">
                                          {i + 1}
                                        </span>
                                        <select
                                          value={a ?? ''}
                                          onChange={(e) => setAnswer(idx, i, e.target.value || null)}
                                          className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#348BDA]/40 ${
                                            a
                                              ? 'border-[var(--line)] bg-[var(--card)] text-[var(--ink)]'
                                              : 'border-[var(--line)] bg-[var(--fill)] text-[var(--muted-soft)]'
                                          }`}
                                        >
                                          <option value="">–</option>
                                          {CHOICES[s.options].map((l) => (
                                            <option key={l} value={l}>
                                              {l}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    ))}
                                    {s.count === 0 && (
                                      <p className="col-span-full text-xs text-[var(--muted)] italic">
                                        Set a number of items to add answer fields.
                                      </p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                      {sections.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                            No sections yet — press “Add Section” to define one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--line)] bg-[var(--fill)] flex items-center justify-between gap-4">
              <p className="text-xs text-[var(--muted)]">
                {totalItems === 0
                  ? 'No items — the key will be saved without answers.'
                  : allAnswered
                    ? `${plural(totalItems, 'item')} ready to save.`
                    : `${plural(missing, 'item')} still ${missing === 1 ? 'needs' : 'need'} an answer.`}
              </p>
              <div className="flex gap-3 shrink-0">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--fill-strong)] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !allAnswered}
                  className="rounded-lg bg-[#16233F] px-4 py-2 text-sm font-bold text-[#EDC31D] hover:bg-[#1d2f52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving…' : mode === 'new' ? 'Create Key' : 'Save Changes'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AnswerKeys() {
  const { token } = useAuth()

  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // { mode: 'new' } | { mode: 'edit', key }
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    try {
      const data = await api('/answer-keys', { token })
      setKeys(data)
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

  async function handleActivate(key) {
    setBusyId(key.id)
    try {
      await api(`/answer-keys/${key.id}/activate`, { method: 'POST', token })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeactivate(key) {
    setBusyId(key.id)
    try {
      await api(`/answer-keys/${key.id}/deactivate`, { method: 'POST', token })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setBusyId('delete')
    try {
      await api(`/answer-keys/${confirmDelete.id}`, { method: 'DELETE', token })
      setConfirmDelete(null)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const activeCount = keys.filter((k) => k.status === 'Active').length

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <p className="text-sm text-[var(--muted)]">
          {keys.length} key{keys.length === 1 ? '' : 's'} ·{' '}
          <span className="font-semibold text-emerald-600">{activeCount} active</span>
          <span className="ml-3 text-xs text-[#85B3DA]">Only one key can be active at a time.</span>
        </p>
        <button
          onClick={() => setModal({ mode: 'new' })}
          className="inline-flex items-center gap-2 rounded-lg bg-[#EDC31D] hover:bg-[#e2b814] px-5 py-2.5 text-sm font-bold text-[var(--ink)] shadow-sm transition-colors"
        >
          <Plus size={16} />
          New Answer Key
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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--card-soft)] px-8 py-14 text-center">
          <KeyRound size={38} className="mx-auto text-[#85B3DA]" />
          <h3 className="mt-3 text-base font-bold text-[var(--ink)]">No answer keys yet</h3>
          <p className="mt-1 text-sm text-[var(--muted)] max-w-md mx-auto">
            Create the official answer key for the current entrance exam, then the mobile scanner
            will use it by default.
          </p>
          <button
            onClick={() => setModal({ mode: 'new' })}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#EDC31D] hover:bg-[#e2b814] px-5 py-2.5 text-sm font-bold text-[var(--ink)] shadow-sm transition-colors"
          >
            <Plus size={16} />
            New Answer Key
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {keys.map((ak) => (
            <KeyCard
              key={ak.id}
              ak={ak}
              busy={busyId === ak.id}
              onEdit={() => setModal({ mode: 'edit', key: ak })}
              onActivate={() => handleActivate(ak)}
              onDeactivate={() => handleDeactivate(ak)}
              onDelete={() => setConfirmDelete(ak)}
            />
          ))}
        </div>
      )}

      {/* New / Edit modal */}
      {modal && (
        <AnswerKeyModal
          mode={modal.mode}
          editingKey={modal.key ?? null}
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
          ak={confirmDelete}
          busy={busyId === 'delete'}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}