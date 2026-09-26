import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AdminLayout from './components/AdminLayout'
import Dashboard from './pages/Dashboard'
import AnswerKeys from './pages/AnswerKeys'
import ExaminationResults from './pages/ExaminationResults'
import Users from './pages/Users'
import Settings from './pages/Settings'
import ComingSoon from './pages/ComingSoon'
import { useAuth } from './context/AuthContext'

/**
 * Layout route guard: only Administrators may use the web app
 * (staff sign in via the mobile app). Renders the shared shell.
 */
function AdminPages() {
  const { isAuthenticated, isAdmin } = useAuth()
  if (!isAuthenticated || !isAdmin) return <Navigate to="/" replace />
  return <AdminLayout />
}

function AppRoutes() {
  const { isAuthenticated, isAdmin } = useAuth()
  const ok = isAuthenticated && isAdmin

  return (
    <Routes>
      {/* Root: login when logged out, dashboard when an admin is in */}
      <Route path="/" element={ok ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/login" element={ok ? <Navigate to="/dashboard" replace /> : <Login />} />

      {/* Admin-only pages inside the shared sidebar/header layout */}
      <Route element={<AdminPages />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/answer-keys" element={<AnswerKeys />} />
        <Route path="/results" element={<ExaminationResults />} />
        <Route path="/results/:folderId" element={<ExaminationResults />} />
        <Route path="/users" element={<Users />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/audit-logs" element={<ComingSoon title="Audit Logs" />} />
      </Route>

      {/* Anything else → root (which shows login or redirects to dashboard) */}
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