import { createContext, useContext, useEffect, useState } from 'react'
import {
  api,
  getAccessToken,
  onTokenChangeListener,
  refreshSession,
  setUnauthorizedHandler,
  storeAccessToken,
} from '../api/client'

const AuthContext = createContext(null)

// Older builds kept a bearer token in web storage. Tokens now live in an
// httpOnly cookie plus module memory, so anything left over is a leftover
// credential worth deleting.
const STALE_KEYS = ['code-nexus-auth']

export function AuthProvider({ children }) {
  // The access token is not restored from storage — it lives in the API client.
  // This holds the user profile + the token for render-time reads.
  const [auth, setAuth] = useState(null) // { token, user } | null

  // True while we try to restore a session from the httpOnly refresh cookie.
  // Routes must wait, or "/" would flash the login screen before redirecting.
  const [initializing, setInitializing] = useState(true)

  // Purge session/token left behind by older builds.
  useEffect(() => {
    for (const key of STALE_KEYS) {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    }
  }, [])

  // Boot: trade the refresh cookie for a fresh access token. Success means the
  // user is still signed in; failure means show the login screen.
  useEffect(() => {
    let cancelled = false

    refreshSession()
      .then((data) => {
        if (cancelled) return
        setAuth({ token: data.token, user: data.user })
      })
      .catch(() => {
        if (!cancelled) setAuth(null) // no cookie, or it expired/rotated out
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Keep the context token in step with silent background refreshes so pages
  // that read `token` don't hold a stale value.
  useEffect(
    () =>
      onTokenChangeListener((token) => {
        setAuth((prev) => (prev && token ? { ...prev, token } : prev))
      }),
    [],
  )

  // A 401 that survives a refresh attempt means the session is truly over.
  useEffect(() => {
    setUnauthorizedHandler(() => setAuth(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  /** Call from the login form. Throws Error on failure. */
  async function login(login, password, remember = false) {
    const data = await api('/login', {
      method: 'POST',
      body: { login, password, remember },
    })
    storeAccessToken(data.token) // so the retry path always has a fresh token
    setAuth({ token: data.token, user: data.user })
    return data.user
  }

  /** Call from the logout button. */
  async function logout() {
    try {
      await api('/logout', { method: 'POST', token: getAccessToken() })
    } catch {
      // token may already be invalid — ignore
    }
    // Server also revokes the refresh token and clears its cookie.
    storeAccessToken(null)
    setAuth(null)
  }

  return (
    <AuthContext.Provider
      value={{
        token: auth?.token ?? null,
        user: auth?.user ?? null,
        isAuthenticated: !!auth,
        isAdmin: auth?.user?.role === 'Administrator',
        initializing,
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