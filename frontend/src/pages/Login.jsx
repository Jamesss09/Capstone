import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png' // TMC logo (Prototype/logo/Logo.png)

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [credentials, setCredentials] = useState({ login: '', password: '' })
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
      // Role-based redirect (RBAC)
      navigate(user.role === 'Administrator' ? '/dashboard' : '/staff', {
        replace: true, // replace history so back button doesn't return to login
      })
    } catch (err) {
      setError(err.message) // "Invalid credentials." etc.
    } finally {
      setLoading(false)
    }
  }

  return (
    // Page background matches prototype (#F1F2F4)
    <div className="min-h-screen flex items-center justify-center bg-[#F1F2F4] px-4">
      {/* White card, matches prototype span (~450px) */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white rounded-2xl shadow-lg px-10 py-10 space-y-5"
      >
        {/* TMC Logo */}
        <div className="flex justify-center">
          <img
            src={logo}
            alt="Trinidad Municipal College logo"
            className="w-24 h-24 object-contain"
          />
        </div>

        {/* Title + subtitle (title sample #348BDA, subtitle #6B6E76) */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-[#348BDA] tracking-tight">
            Code Nexus
          </h1>
          <p className="text-sm text-[#6B6E76]">
            Trinidad Municipal College · Entrance Examination Scoring System
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Username field */}
        <div>
          <label className="block text-sm font-medium text-[#6B6E76] mb-1.5">
            Username
          </label>
          <input
            type="text"
            name="login"
            value={credentials.login}
            onChange={handleChange}
            required
            autoFocus
            placeholder="Enter your username or email"
            className="w-full rounded-lg bg-[#F4F2EA] border border-slate-300 px-3 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#348BDA] focus:border-transparent"
          />
        </div>

        {/* Password field */}
        <div>
          <label className="block text-sm font-medium text-[#6B6E76] mb-1.5">
            Password
          </label>
          <input
            type="password"
            name="password"
            value={credentials.password}
            onChange={handleChange}
            required
            placeholder="Enter your password"
            className="w-full rounded-lg bg-[#F4F2EA] border border-slate-300 px-3 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#348BDA] focus:border-transparent"
          />
        </div>

        {/* Remember me / forgot password row */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-[#16233F]"
            />
            <span className="text-[#6B6E76]">Remember me</span>
          </label>
          <a href="#" onClick={(e) => e.preventDefault()} className="text-[#348BDA] hover:underline">
            Forgot password?
          </a>
        </div>

        {/* Sign-in button — navy (#16233F) with gold text, per prototype */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#16233F] hover:bg-[#1d2f52] disabled:opacity-60 text-[#EDC31D] font-semibold text-base py-3 transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}