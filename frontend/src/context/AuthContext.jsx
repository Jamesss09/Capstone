import { createContext, useContext, useEffect, useState } from 'react'
import { api, setUnauthorizedHandler } from '../api/client'

const AuthContext = createContext(null)

// Older builds persisted the session to web storage, which survived browser
// restarts and left a bearer token sitting on disk. The session now lives only
// in memory, so every page load starts at the login screen. These keys are
// cleared once on boot to retire any leftovers.
const STALE_KEYS = ['code-nexus-auth']

export function AuthProvider({ children }) {
  // Deliberately NOT restored from storage: a page load always starts signed out.
  const [auth, setAuth] = useState(null) // { token, user } | null

  // Purge session/token left behind by older builds.
  useEffect(() => {
    for (const key of STALE_KEYS) {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    }
  }, [])

  // A 401 from any page means the token is dead (revoked, or the account was
  // deactivated mid-session). Clear it so the guard bounces the user to login.
  useEffect(() => {
    setUnauthorizedHandler(() => setAuth(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  /** Call from the login form. Throws Error on failure. */
  async function login(login, password) {
    const data = await api('/login', {
      method: 'POST',
      body: { login, password },
    })
    setAuth(data) // { token, user }
    return data.user
  }

  /** Call from the logout button. */
  async function logout() {
    try {
      await api('/logout', { method: 'POST', token: auth?.token })
    } catch {
      // token may already be invalid — ignore
    }
    setAuth(null)
  }

  return (
    <AuthContext.Provider
      value={{
        token: auth?.token ?? null,
        user: auth?.user ?? null,
        isAuthenticated: !!auth,
        isAdmin: auth?.user?.role === 'Administrator',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook so pages can write:  const { user, login } = useAuth()
// oxlint-disable-next-line only-export-components -- hook shares this file with the provider for convenience
export function useAuth() {
  return useContext(AuthContext)
}