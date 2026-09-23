import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Home'
import { useAuth } from './context/AuthContext'

// Routes live inside App. The `useAuth` here reads the same context
// that Login/Home use, so everything stays in sync.
function AppRoutes() {
  const { isAuthenticated, isAdmin } = useAuth()

  // Web is admin-only: staff sign in via the mobile app.
  const showHome = isAuthenticated && isAdmin

  return (
    <Routes>
      {/* Root: show login when logged out, Home when an admin is logged in */}
      <Route path="/" element={showHome ? <Home /> : <Login />} />

      {/* If an admin is already logged in, skip the login screen */}
      <Route path="/login" element={showHome ? <Navigate to="/" replace /> : <Login />} />

      {/* Anything else → root (which shows login or home) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}