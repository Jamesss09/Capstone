import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  KeyRound,
  ClipboardList,
  Settings,
  Users,
  ScrollText,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png' // TMC seal

// Title + subtitle per page, shown in the top header strip
const PAGE_META = {
  '/dashboard': {
    title: 'Admin Dashboard',
    subtitle:
      'Overview of applicants, exam sessions, and scoring activity — System Yr. 2027 Entrance Exam',
  },
  '/answer-keys': {
    title: 'Answer Keys',
    subtitle:
      'Manage official examination answer keys. The active key is what the mobile scanner uses by default.',
  },
  '/results': {
    title: 'Examination Results',
    subtitle: 'Select a school year folder first to view its examination results.',
  },
  '/users': {
    title: 'User Management',
    subtitle: 'Manage administrator and staff accounts and roles.',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Configure examination and system-wide settings.',
  },
  '/audit-logs': {
    title: 'Audit Logs',
    subtitle: 'Review the system activity trail.',
  },
}

const baseLink =
  'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors'
const activeLink = `${baseLink} bg-[#34363E] text-white`
const idleLink = `${baseLink} text-slate-300 hover:bg-white/5 hover:text-white`

export default function AdminLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const meta = PAGE_META[pathname] ?? { title: 'Admin', subtitle: '' }
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  async function confirmLogout() {
    setShowLogoutConfirm(false)
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex bg-[#F4F5F7]">
      {/* ========== Sidebar (dark navy) ========== */}
      <aside className="w-64 shrink-0 bg-[#16233F] text-white flex flex-col sticky top-0 h-screen">
        {/* Brand block */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
          <img
            src={logo}
            alt="Trinidad Municipal College seal"
            className="w-11 h-11 rounded-full object-contain bg-[#EDC31D]"
          />
          <div className="leading-tight">
            <p className="text-[#EDC31D] font-bold text-sm">TMc Entrance Exam</p>
            <p className="text-white text-[10px] font-semibold tracking-[0.22em]">
              SCORING SYSTEM
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <p className="px-3 pt-5 pb-1.5 text-[10px] font-semibold tracking-widest text-slate-400">
            ADMIN
          </p>

          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>

          <NavLink to="/answer-keys" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
            <KeyRound size={18} />
            Answer Keys
          </NavLink>

          <NavLink to="/results" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
            <ClipboardList size={18} />
            Exam Results
          </NavLink>

          {/* System Management group — indented sub-items */}
          <p className="px-3 pt-5 pb-1.5 text-[10px] font-semibold tracking-widest text-slate-400">
            SYSTEM MANAGEMENT
          </p>
          <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
            <NavLink to="/users" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
              <Users size={18} />
              User Management
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
              <Settings size={18} />
              Settings
            </NavLink>
            <NavLink to="/audit-logs" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
              <ScrollText size={18} />
              Audit Logs
            </NavLink>
          </div>
        </nav>

        {/* Logout pinned at the bottom */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* ========== Right side: header + content ========== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header strip (light) */}
        <header className="bg-[#F4F5F7] border-b border-slate-200 px-8 py-4 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#348BDA]">{meta.title}</h1>
            <p className="text-xs text-[#85B3DA] mt-0.5 truncate">{meta.subtitle}</p>
          </div>
          <div className="text-right text-xs leading-tight text-slate-500 shrink-0">
            <p className="font-semibold text-slate-600">Trinidad Municipal College</p>
            <p>Entrance Examination</p>
            <p>Scoring System</p>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <LogOut size={18} className="text-red-500" />
              </div>
              <h2 className="text-base font-bold text-[#16233F]">Log out of Code Nexus?</h2>
            </div>
            <p className="mt-2 text-sm text-[#6B6E76]">
              Are you sure you want to sign out? You'll need to sign in again to continue.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 rounded-lg bg-[#16233F] hover:bg-[#1d2f52] py-2.5 text-sm font-semibold text-[#EDC31D] transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}