import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, PlusCircle,
  ShieldCheck, ChevronRight, MessageCircle, Zap
} from 'lucide-react'

const navItems = [
  { to: '/',        label: 'Dashboard',      icon: LayoutDashboard, exact: true },
  { to: '/feedback', label: 'All Feedback',  icon: MessageSquare },
  { to: '/submit',   label: 'Submit Feedback', icon: PlusCircle },
  { to: '/admin',    label: 'Admin Panel',    icon: ShieldCheck },
]

const etlItems = [
  { to: '/etl', label: 'ETL Analytics', icon: Zap },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
        <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">FeedbackMS</p>
          <p className="text-slate-400 text-xs">Management System</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
          Main Menu
        </p>
        {navItems.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} size={18} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={14} className="text-indigo-300" />}
              </>
            )}
          </NavLink>
        ))}

        <div className="mt-3 border-t border-slate-800 pt-3" />
        {etlItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} size={18} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={14} className="text-indigo-300" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-lg px-3 py-3">
          <p className="text-slate-300 text-xs font-semibold">Phase 2</p>
          <p className="text-slate-500 text-xs mt-0.5">AFDE Jul 2025 • Sanjana</p>
        </div>
      </div>
    </aside>
  )
}
