import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Home'
import { useAuth } from './context/AuthContext'

// Routes live inside App. The `useAuth` here reads the same context
// that Login/Home use, so everything stays in sync.
function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* Root: show login when logged out, Home when logged in */}
      <Route path="/" element={isAuthenticated ? <Home /> : <Login />} />

      {/* If already logged in, skip the login screen */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

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