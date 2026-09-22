import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Landing page shown after a successful login.
 * Placeholder until the real dashboard / staff screens are built.
 */
export default function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F1F2F4]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg px-8 py-8 text-center space-y-4">
        <h1 className="text-xl font-bold text-[#348BDA]">
          Welcome back, {user?.full_name}!
        </h1>
        <p className="text-sm text-[#6B6E76]">
          You are signed in as <span className="font-semibold">{user?.role}</span>.
          <br />
          More screens coming next (Dashboard, Answer Keys, Results...)
        </p>
        <button
          onClick={handleLogout}
          className="w-full rounded-lg bg-[#16233F] hover:bg-[#1d2f52] text-[#EDC31D] font-semibold py-2.5 transition-colors"
        >
          Log out
        </button>
      </div>
    </div>
  )
}