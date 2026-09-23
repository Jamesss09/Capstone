import { Construction } from 'lucide-react'

/**
 * Placeholder for Admin pages that are not built yet.
 * Each page will replace this with its real content.
 */
export default function ComingSoon({ title, description }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-md w-full rounded-xl bg-white border border-slate-200 px-8 py-12 text-center">
        <Construction size={40} className="mx-auto text-[#348BDA]" />
        <h2 className="mt-4 text-lg font-bold text-[#16233F]">{title}</h2>
        <p className="mt-2 text-sm text-[#6B6E76]">
          {description ?? 'This screen is coming soon. Stay tuned!'}
        </p>
      </div>
    </div>
  )
}