import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StaffHome from './pages/StaffHome'
import ProtectRoute from './components/ProtectRoute'
import { useAuth } from './context/AuthContext'

// Routes live inside App. The `useAuth` here reads the same context
// that Login/ProtectRoute use, so everything stays in sync.
function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* If already logged in, skip the login screen */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

      {/* Protected pages */}
      <Route path="/" element={<ProtectRoute><Dashboard /></ProtectRoute>} />
      <Route path="/dashboard" element={<ProtectRoute><Dashboard /></ProtectRoute>} />
      <Route path="/staff" element={<ProtectRoute><StaffHome /></ProtectRoute>} />

      {/* Anything else → login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
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