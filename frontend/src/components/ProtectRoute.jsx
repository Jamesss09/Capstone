import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps pages that need a logged-in user.
 * Not logged in  → redirect to /login
 * Logged in     → render the child page
 */
export default function ProtectRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}