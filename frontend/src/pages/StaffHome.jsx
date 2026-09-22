import { useAuth } from '../context/AuthContext'

// Placeholder — staff scanner home (Phase 4 will add camera flows).
export default function StaffHome() {
  const { user } = useAuth()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800">
        Staff Home <span className="text-sm font-normal text-slate-500">(placeholder)</span>
      </h1>
      <p className="text-slate-600 mt-2">Welcome, {user.full_name}!</p>
    </div>
  )
}