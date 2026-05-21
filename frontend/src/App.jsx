import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import FeedbackList from './pages/FeedbackList'
import FeedbackDetail from './pages/FeedbackDetail'
import SubmitFeedback from './pages/SubmitFeedback'
import AdminPanel from './pages/AdminPanel'
import EditFeedback from './pages/EditFeedback'
import ETLAnalytics from './pages/ETLAnalytics'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="feedback" element={<FeedbackList />} />
        <Route path="feedback/:id" element={<FeedbackDetail />} />
        <Route path="submit" element={<SubmitFeedback />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="admin/edit/:id" element={<EditFeedback />} />
        <Route path="etl" element={<ETLAnalytics />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
