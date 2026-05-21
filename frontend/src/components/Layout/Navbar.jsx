import { useLocation, useNavigate } from 'react-router-dom'
import { PlusCircle, Bell } from 'lucide-react'

const titles = {
  '/':        { title: 'Dashboard',       sub: 'Overview of all feedback activity' },
  '/feedback':{ title: 'All Feedback',    sub: 'Browse and search feedback records' },
  '/submit':  { title: 'Submit Feedback', sub: 'Add a new feedback entry' },
  '/admin':   { title: 'Admin Panel',     sub: 'Manage and moderate feedback records' },
  '/etl':     { title: 'ETL Analytics',   sub: 'Import, transform, and analyze feedback datasets' },
}

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isEdit = pathname.startsWith('/admin/edit')
  const isDetail = /^\/feedback\/\d+$/.test(pathname)

  const info = isEdit
    ? { title: 'Edit Feedback', sub: 'Update an existing feedback entry' }
    : isDetail
    ? { title: 'Feedback Detail', sub: 'View complete feedback information' }
    : (titles[pathname] || { title: 'FeedbackMS', sub: '' })

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 shadow-sm">
      <div>
        <h1 className="text-lg font-bold text-slate-800 leading-tight">{info.title}</h1>
        {info.sub && <p className="text-xs text-slate-500">{info.sub}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/submit')}
          className="btn-primary text-sm"
        >
          <PlusCircle size={15} />
          New Feedback
        </button>
      </div>
    </header>
  )
}
