import { useAuth } from '../context/AuthContext'

// Placeholder — Phase 3 (later) will build the real admin dashboard.
export default function Dashboard() {
  const { user } = useAuth()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800">
        Admin Dashboard <span className="text-sm font-normal text-slate-500">(placeholder)</span>
      </h1>
      <p className="text-slate-600 mt-2">Welcome back, {user.full_name}!</p>
    </div>
  )
}