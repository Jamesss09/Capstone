/* ------------------------------------------------------------------ */
/* Skeleton loading primitives                                         */
/* Placeholder blocks that pulse while real content is being fetched.  */
/* Each piece mirrors the shape of the content it stands in for, so    */
/* the page keeps its structure during load instead of flashing text.  */
/* ------------------------------------------------------------------ */

/** Base pulsing block — extend with width/height utilities via className. */
export function Shimmer({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-[var(--fill-strong)] ${className}`} />
}

/** Icon-tile placeholder (mimics the navy square behind stat icons). */
export function ShimmerIcon({ className = 'w-12 h-12 rounded-lg' }) {
  return <Shimmer className={`shrink-0 ${className}`} />
}

/** KPI stat card placeholder — dashboard header row. */
export function StatCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] px-5 py-5">
      <ShimmerIcon />
      <div className="min-w-0 flex-1 space-y-2">
        <Shimmer className="w-1/2 h-2.5" />
        <Shimmer className="w-2/3 h-5" />
      </div>
    </div>
  )
}

/** Content-card placeholder — answer-key cards, school-year folder cards. */
export function CardSkeleton({ cols = 3 }) {
  return (
    <div className="rounded-xl bg-[var(--panel)] border border-[var(--line)] shadow-sm overflow-hidden">
      {/* Header: code line + title + status chip */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2 flex-1">
          <Shimmer className="w-24 h-2.5" />
          <Shimmer className="w-3/5 h-4" />
        </div>
        <Shimmer className="w-20 h-6 rounded-full shrink-0" />
      </div>

      {/* Field rows (School Year / Total Items / Passing Score) */}
      <div className="px-5 grid grid-cols-3 gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Shimmer className="w-full h-2" />
            <Shimmer className="w-3/4 h-3" />
          </div>
        ))}
      </div>

      {/* Section chips */}
      <div className="px-5 pt-4 pb-3 space-y-2">
        <Shimmer className="w-24 h-2" />
        <div className="flex gap-2">
          <Shimmer className="w-16 h-5 rounded-md" />
          <Shimmer className="w-14 h-5 rounded-md" />
        </div>
      </div>

      {/* Action bar */}
      <div className="px-5 py-3.5 border-t border-[var(--line)] bg-[var(--card-soft)] flex gap-2">
        <Shimmer className="w-16 h-7" />
        <Shimmer className="w-16 h-7" />
      </div>
    </div>
  )
}

/** Table placeholder — navy header strip + shimmer rows. */
export function TableSkeleton({ cols = 5, rows = 6 }) {
  return (
    <div>
      <div className="flex items-center gap-6 px-5 py-3 bg-[#16233F]">
        {Array.from({ length: cols }).map((_, c) => (
          <Shimmer key={c} className="h-2.5 w-16 max-w-[16%] bg-white/25" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-6 px-5 py-3.5 ${
            i > 0 ? 'border-t border-[var(--line-soft)]' : ''
          }`}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Shimmer
              key={c}
              className={c === 0 ? 'h-3 w-28 max-w-[28%]' : 'h-3 w-16 max-w-[16%]'}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Single feed-row placeholder — dashboard system activity. */
export function FeedRowSkeleton() {
  return (
    <div className="px-5 py-3.5 flex items-start gap-3">
      <Shimmer className="mt-1.5 w-2 h-2 rounded-full shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Shimmer className="w-3/4 h-3" />
        <Shimmer className="w-1/3 h-2" />
      </div>
    </div>
  )
}

/** Form placeholder — answer-key editor modal body. */
export function FormSkeleton({ rows = 3 }) {
  return (
    <div className="p-6 space-y-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Shimmer className="w-32 h-2.5" />
          <Shimmer className="w-full h-9" />
        </div>
      ))}
    </div>
  )
}