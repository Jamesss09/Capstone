import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo-256.png' // TMC seal (Prototype/logo/Logo.png)

export default function Login() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()

  const [credentials, setCredentials] = useState({ login: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setCredentials({ ...credentials, [e.target.name]: e.target.value })
    setError('') // clear error as user types
  }

  async function handleSubmit(e) {
    e.preventDefault() // stop the browser's default form reload
    setError('')
    setLoading(true)

    try {
      const user = await login(credentials.login, credentials.password)

      // The web app is admin-only — staff sign in via the mobile app.
      // (The same API authenticates both; we reject staff here on the web.)
      if (user?.role !== 'Administrator') {
        await logout() // don't keep a staff session on the web
        setError('Staff accounts sign in via the mobile app.')
        return
      }

      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message) // "Invalid credentials." etc.
    } finally {
      setLoading(false)
    }
  }

  // Shared style for both inputs (beige background from prototype #F4F2EA)
  const inputClass =
    'w-full rounded-lg bg-[#F4F2EA] border border-slate-300 pl-10 py-2.5 pr-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#348BDA] focus:border-transparent'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F1F2F4] px-4">
      {/* White card login form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white rounded-2xl shadow-lg px-8 py-8 flex flex-col gap-5"
      >
        {/* Centered logo top — TMC seal */}
        <div className="flex justify-center">
          <img
            src={logo}
            alt="Trinidad Municipal College seal"
            className="w-24 h-24 object-contain"
          />
        </div>

        {/* Title + subtitle */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#348BDA] leading-snug">
            TMC Entrance Exam
            <br />
            Scoring System
          </h1>
          <p className="mt-1 text-sm text-[#6B6E76]">
            Sign in to access the examination management system.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Username field — user icon inside, beige background */}
        <div>
          <label className="block text-sm font-medium text-[#6B6E76] mb-1.5">
            Username
          </label>
          <div className="relative">
            <User
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              name="login"
              value={credentials.login}
              onChange={handleChange}
              required
              autoFocus
              placeholder="Enter your username"
              className={inputClass}
            />
          </div>
        </div>

        {/* Password field — lock icon + eye toggle */}
        <div>
          <label className="block text-sm font-medium text-[#6B6E76] mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <label className="flex items-center gap-2 text-sm text-[#6B6E76] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 accent-[#16233F]"
          />
          Remember me
        </label>

        {/* Dark navy Sign In button, gold text per prototype */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#16233F] hover:bg-[#1d2f52] disabled:opacity-60 text-[#EDC31D] font-semibold text-base py-3 transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        {/* Card footer */}
        <p className="text-center text-xs text-[#6B6E76]">
          • Code Nexus
        </p>
      </form>

      {/* Below the card */}
      <p className="mt-4 text-center text-sm text-[#6B6E76]">
        Trinidad Municipal College
        <br />
        Entrance Exam: Answer Sheet Recognition & Scoring System
      </p>
    </div>
  )
}