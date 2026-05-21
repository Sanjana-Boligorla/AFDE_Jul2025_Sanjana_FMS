import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Play, RefreshCw, Database, CheckCircle, AlertTriangle,
  Trash2, Copy, TrendingUp, Users, Star, ThumbsUp, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { etlApi } from '../services/api'

// ─── Color palettes ──────────────────────────────────────────
const RATING_COLORS = {
  '1': '#ef4444', '2': '#f97316', '3': '#eab308',
  '4': '#22c55e', '5': '#6366f1',
}
const PIE_COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e']

// ─── Stat card ───────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-emerald-50 text-emerald-600',
    amber:  'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
    blue:   'bg-sky-50 text-sky-600',
  }
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Data quality badge ──────────────────────────────────────
function QualityBadge({ label, count, color }) {
  const cls = {
    green:  'bg-emerald-100 text-emerald-700 border-emerald-200',
    red:    'bg-red-100 text-red-700 border-red-200',
    amber:  'bg-amber-100 text-amber-700 border-amber-200',
    slate:  'bg-slate-100 text-slate-600 border-slate-200',
  }[color] || 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${cls}`}>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-lg font-bold">{count}</span>
    </div>
  )
}

// ─── Custom tooltip ──────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#94a3b8' }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────
export default function ETLAnalytics() {
  const [datasets, setDatasets]     = useState([])
  const [selected, setSelected]     = useState('')
  const [running, setRunning]       = useState(false)
  const [analytics, setAnalytics]   = useState(null)
  const [history, setHistory]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [chartsReady, setChartsReady] = useState(false)
  const chartsTimer = useRef(null)

  // Fetch available datasets + latest analytics on mount
  useEffect(() => {
    Promise.all([loadDatasets(), loadAnalytics(), loadHistory()])
  }, [])

  useEffect(() => {
    if (analytics) {
      chartsTimer.current = setTimeout(() => setChartsReady(true), 150)
    }
    return () => clearTimeout(chartsTimer.current)
  }, [analytics])

  async function loadDatasets() {
    try {
      const res = await etlApi.listDatasets()
      const files = res.data.datasets || []
      setDatasets(files)
      if (files.length > 0) setSelected(files[0])
    } catch {}
  }

  async function loadAnalytics() {
    setLoading(true)
    try {
      const res = await etlApi.getAnalytics()
      setAnalytics(res.data)
    } catch {
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadHistory() {
    try {
      const res = await etlApi.getHistory()
      setHistory(res.data.runs || [])
    } catch {}
  }

  async function handleRunETL() {
    if (!selected) { toast.error('Select a dataset file first.'); return }
    setRunning(true)
    setChartsReady(false)
    const tid = toast.loading(`Running ETL on ${selected}…`)
    try {
      const res = await etlApi.run(selected)
      toast.dismiss(tid)
      toast.success(`ETL complete — ${res.data.report.total_clean} clean records loaded.`)
      await Promise.all([loadAnalytics(), loadHistory()])
    } catch (err) {
      toast.dismiss(tid)
      toast.error(err.response?.data?.detail || 'ETL pipeline failed.')
    } finally {
      setRunning(false)
    }
  }

  // ── Build chart data ─────────────────────────────────────────
  const ratingBarData = analytics
    ? [1,2,3,4,5].map(n => ({
        rating: `${n}★`,
        count: analytics.rating_distribution[String(n)] || 0,
        fill: RATING_COLORS[String(n)],
      }))
    : []

  const categoryPieData = analytics
    ? Object.entries(analytics.category_distribution).map(([name, value]) => ({ name, value }))
    : []

  const deptBarData = analytics
    ? Object.entries(analytics.department_distribution)
        .map(([dept, count]) => ({ dept, count }))
        .sort((a, b) => b.count - a.count)
    : []

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-8">

      {/* ── Header + Run Panel ─────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="page-title">ETL Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Import, clean, and analyze feedback datasets via the ETL pipeline.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="input-field py-2 text-sm min-w-[200px]"
          >
            {datasets.length === 0
              ? <option value="">No datasets found</option>
              : datasets.map(f => <option key={f} value={f}>{f}</option>)
            }
          </select>
          <button
            onClick={handleRunETL}
            disabled={running || !selected}
            className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {running
              ? <><RefreshCw size={16} className="animate-spin" /> Running…</>
              : <><Play size={16} /> Run ETL</>
            }
          </button>
        </div>
      </div>

      {/* ── No data state ──────────────────────────────────── */}
      {!loading && !analytics && (
        <div className="card text-center py-16">
          <Database size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No ETL data yet</p>
          <p className="text-slate-400 text-sm mt-1">
            Select a dataset and click <strong>Run ETL</strong> to load analytics.
          </p>
        </div>
      )}

      {/* ── Loading state ──────────────────────────────────── */}
      {loading && (
        <div className="card text-center py-16">
          <RefreshCw size={36} className="mx-auto text-indigo-400 animate-spin mb-3" />
          <p className="text-slate-500">Loading analytics…</p>
        </div>
      )}

      {analytics && (
        <>
          {/* ── Data Quality Report ──────────────────────── */}
          <section>
            <h2 className="section-title mb-4">Data Quality Report</h2>
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={16} className="text-indigo-500" />
                <span className="text-sm font-semibold text-slate-700">
                  Source: <span className="font-normal text-slate-500">{analytics.summary.source_file}</span>
                </span>
                <span className="ml-auto text-xs text-slate-400">
                  Last run: {new Date(analytics.summary.run_at).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <QualityBadge label="Total Raw Records"    count={analytics.summary.total_raw}            color="slate" />
                <QualityBadge label="Clean Records Loaded" count={analytics.summary.total_clean}           color="green" />
                <QualityBadge label="Invalid Ratings Dropped" count={analytics.summary.dropped_invalid_rating} color="red" />
                <QualityBadge label="Duplicates Removed"   count={analytics.summary.dropped_duplicates}    color="amber" />
              </div>
              {/* Quality bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Data Quality Score</span>
                  <span className="font-semibold text-slate-700">
                    {Math.round(analytics.summary.total_clean / analytics.summary.total_raw * 100)}%
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.round(analytics.summary.total_clean / analytics.summary.total_raw * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── KPI Metrics ──────────────────────────────── */}
          <section>
            <h2 className="section-title mb-4">Key Metrics</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={Star}
                label="Average Rating"
                value={analytics.summary.avg_rating.toFixed(2)}
                sub="out of 5.00"
                color="indigo"
              />
              <MetricCard
                icon={ThumbsUp}
                label="Recommend Rate"
                value={`${analytics.summary.recommend_pct}%`}
                sub={`${analytics.summary.total_recommend} of ${analytics.summary.total_clean}`}
                color="green"
              />
              <MetricCard
                icon={Users}
                label="Clean Records"
                value={analytics.summary.total_clean}
                sub="after ETL transformation"
                color="blue"
              />
              <MetricCard
                icon={TrendingUp}
                label="5-Star Responses"
                value={analytics.rating_distribution['5'] || 0}
                sub={`${Math.round((analytics.rating_distribution['5'] || 0) / analytics.summary.total_clean * 100)}% excellent`}
                color="amber"
              />
            </div>
          </section>

          {/* ── Charts Row ───────────────────────────────── */}
          <section>
            <h2 className="section-title mb-4">Distribution Analysis</h2>
            <div className="grid lg:grid-cols-2 gap-6">

              {/* Rating Distribution */}
              <div className="card">
                <p className="text-sm font-semibold text-slate-700 mb-4">Rating Distribution</p>
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={ratingBarData} barCategoryGap="35%">
                      <XAxis dataKey="rating" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="count" name="Responses" radius={[6, 6, 0, 0]} animationDuration={900} animationEasing="ease-out">
                        {ratingBarData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center">
                    <RefreshCw size={22} className="text-indigo-400 animate-spin" />
                  </div>
                )}
              </div>

              {/* Category Breakdown */}
              <div className="card">
                <p className="text-sm font-semibold text-slate-700 mb-4">Category Breakdown</p>
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={categoryPieData}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        animationDuration={1100}
                        animationEasing="ease-out"
                      >
                        {categoryPieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f8fafc' }}
                        itemStyle={{ color: '#94a3b8' }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={v => <span className="text-xs text-slate-600">{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center">
                    <RefreshCw size={22} className="text-indigo-400 animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Leaderboards ─────────────────────────────── */}
          <section>
            <h2 className="section-title mb-4">Leaderboards</h2>
            <div className="grid lg:grid-cols-2 gap-6">

              {/* Top Programs */}
              <div className="card">
                <p className="text-sm font-semibold text-slate-700 mb-4">Top Programs by Rating</p>
                <div className="space-y-3">
                  {analytics.top_programs.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                        ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : 'bg-orange-200 text-orange-700'}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-medium text-slate-700 truncate">{p.program_name}</p>
                          <span className="text-xs font-bold text-indigo-600 ml-2 flex-shrink-0">
                            {Number(p.avg_rating).toFixed(1)} ★
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${(Number(p.avg_rating) / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">{p.count} resp.</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Trainers */}
              <div className="card">
                <p className="text-sm font-semibold text-slate-700 mb-4">Top Trainers by Rating</p>
                <div className="space-y-3">
                  {analytics.top_trainers.map((t, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">
                          {t.trainer_name.split(' ').pop()?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{t.trainer_name}</p>
                        <p className="text-xs text-slate-400">{t.count} sessions</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-indigo-600">{Number(t.avg_rating).toFixed(1)}</p>
                        <div className="flex">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`text-xs ${s <= Math.round(t.avg_rating) ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Department breakdown ─────────────────────── */}
          {deptBarData.length > 0 && (
            <section>
              <h2 className="section-title mb-4">Department Activity</h2>
              <div className="card">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={deptBarData} layout="vertical" barCategoryGap="30%">
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="dept" width={90} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="count" name="Responses" fill="#6366f1" radius={[0, 6, 6, 0]} animationDuration={800} animationEasing="ease-out" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center">
                    <RefreshCw size={22} className="text-indigo-400 animate-spin" />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Recent Clean Records ─────────────────────── */}
          <section>
            <h2 className="section-title mb-4">Recent Clean Records</h2>
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="table-th">Participant</th>
                      <th className="table-th">Program</th>
                      <th className="table-th">Department</th>
                      <th className="table-th">Category</th>
                      <th className="table-th">Rating</th>
                      <th className="table-th">Recommend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recent_records.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="table-td font-medium text-slate-800">{r.participant_name}</td>
                        <td className="table-td text-slate-600 max-w-[180px] truncate">{r.program_name}</td>
                        <td className="table-td text-slate-500">{r.department}</td>
                        <td className="table-td">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                            {r.category}
                          </span>
                        </td>
                        <td className="table-td">
                          <span className={`font-bold ${
                            r.rating >= 4 ? 'text-emerald-600' :
                            r.rating === 3 ? 'text-amber-600' : 'text-red-500'
                          }`}>
                            {r.rating} ★
                          </span>
                        </td>
                        <td className="table-td">
                          {r.would_recommend
                            ? <span className="text-emerald-600 font-medium">Yes</span>
                            : <span className="text-red-500 font-medium">No</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── ETL Run History ──────────────────────────── */}
          {history.length > 0 && (
            <section>
              <h2 className="section-title mb-4">ETL Run History</h2>
              <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="table-th">Run At</th>
                        <th className="table-th">File</th>
                        <th className="table-th">Raw</th>
                        <th className="table-th">Clean</th>
                        <th className="table-th">Dropped</th>
                        <th className="table-th">Avg Rating</th>
                        <th className="table-th">Recommend %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="table-td text-slate-500 text-xs">
                            {new Date(h.run_at).toLocaleString()}
                          </td>
                          <td className="table-td font-medium text-slate-700">{h.source_file}</td>
                          <td className="table-td text-slate-600">{h.total_raw}</td>
                          <td className="table-td">
                            <span className="text-emerald-600 font-semibold">{h.total_clean}</span>
                          </td>
                          <td className="table-td text-red-500">
                            {(h.dropped_missing || 0) + (h.dropped_invalid_rating || 0) + (h.dropped_duplicates || 0)}
                          </td>
                          <td className="table-td font-semibold text-indigo-600">
                            {Number(h.avg_rating).toFixed(2)} ★
                          </td>
                          <td className="table-td text-emerald-600 font-medium">
                            {Number(h.recommend_pct).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
