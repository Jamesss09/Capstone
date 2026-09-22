import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client'

const AuthContext = createContext(null)

const STORAGE_KEY = 'code-nexus-auth' // localStorage key

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    // Restore session on page refresh (stored as JSON string)
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null // { token, user }
  })

  // Every time auth changes, persist it
  useEffect(() => {
    if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
    else localStorage.removeItem(STORAGE_KEY)
  }, [auth])

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
export function useAuth() {
  return useContext(AuthContext)
}
