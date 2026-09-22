import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [credentials, setCredentials] = useState({ login: '', password: '' })
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
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-5"
      >
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">Code Nexus</h1>
          <p className="text-sm text-slate-500">
            TMC Entrance Examination Scoring System
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Username or Email
          </label>
          <input
            type="text"
            name="login"
            value={credentials.login}
            onChange={handleChange}
            required
            autoFocus
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Password
          </label>
          <input
            type="password"
            name="password"
            value={credentials.password}
            onChange={handleChange}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-xs text-slate-400 text-center">
          Dev accounts — admin / admin123 · staff / staff123
        </p>
      </form>
    </div>
  )
}
