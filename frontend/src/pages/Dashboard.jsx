import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '../lib/api'
import RiskBadge from '../components/RiskBadge'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, CartesianGrid, AreaChart, Area
} from 'recharts'
import {
  Users, AlertCircle, TrendingUp, Activity, ArrowRight,
  GraduationCap, Zap, AlertTriangle, Shield, Brain, Upload, X, WifiOff
} from 'lucide-react'
import { Link } from 'react-router-dom'

const RISK_COLORS = {
  Critical: '#E05252', High: '#E8A030', Medium: '#E8D730', Low: '#3DBE7A'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1d26]/90 border border-white/10 rounded-lg px-3 py-2 text-xs backdrop-blur-md shadow-xl">
      <p className="text-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color = 'accent', loading }) {
  const colorMap = {
    accent: { bg: 'bg-accent/10', text: 'text-accent', glow: 'shadow-accent/20' },
    danger: { bg: 'bg-danger/10', text: 'text-danger', glow: 'shadow-danger/20' },
    warn:   { bg: 'bg-warn/10',   text: 'text-warn',   glow: 'shadow-warn/20' },
    safe:   { bg: 'bg-safe/10',   text: 'text-safe',   glow: 'shadow-safe/20' },
  }
  const c = colorMap[color]
  return (
    <div className="card relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${c.bg} shadow-lg ${c.glow}`}>
          <Icon size={18} className={c.text} />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-white/10 rounded animate-pulse mb-1" />
      ) : (
        <div className={`text-3xl font-bold ${c.text} mb-1 tabular-nums`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
      )}
      <div className="text-xs text-ghost font-medium">{label}</div>
      {sub && <div className="text-[11px] text-muted mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [trends, setTrends] = useState([])
  const [recent, setRecent] = useState([])
  const [priority, setPriority] = useState([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState([])

  useEffect(() => {
    async function load() {
      const newErrors = []
      try {
        const token = await getToken()
        const [sumData, trendData, histData, prioData] = await Promise.allSettled([
          api.getSummary(token),
          api.getTrends(token, 30),
          api.history(token, 6),
          api.getInterventionPriority(token, 5),
        ])
        if (sumData.status === 'fulfilled') setSummary(sumData.value)
        else newErrors.push({ label: 'Dashboard Summary', msg: sumData.reason?.message || 'Failed to load summary' })

        if (trendData.status === 'fulfilled') setTrends(trendData.value.trends || [])
        else newErrors.push({ label: '30-Day Trends', msg: trendData.reason?.message || 'Failed to load trends' })

        if (histData.status === 'fulfilled') setRecent(histData.value.predictions || [])
        else newErrors.push({ label: 'Recent Predictions', msg: histData.reason?.message || 'Failed to load history' })

        if (prioData.status === 'fulfilled') setPriority(prioData.value.priority_list || [])
        else newErrors.push({ label: 'Intervention Priority', msg: prioData.reason?.message || 'Failed to load priority list' })

        if (newErrors.length > 0) setErrors(newErrors)
      } catch (e) {
        setErrors([{ label: 'Dashboard', msg: e.message || 'Unexpected error loading dashboard' }])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken])

  const riskDist = useMemo(() => {
    if (!summary) return []
    return ['Critical', 'High', 'Medium', 'Low'].map(level => ({
      level,
      count: summary[level.toLowerCase()] || 0,
      color: RISK_COLORS[level],
    }))
  }, [summary])

  const pieData = riskDist.filter(r => r.count > 0).map(r => ({ name: r.level, value: r.count }))

  const trendChartData = trends.map(t => ({
    date: t.date?.slice(5),
    dropouts: t.dropouts,
    graduates: t.graduates,
    avg: Math.round((t.avg_prob || 0) * 100),
  }))

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Error Banner */}
      {errors.length > 0 && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/5 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-danger/20">
            <div className="flex items-center gap-2">
              <WifiOff size={15} className="text-danger" />
              <span className="text-sm font-semibold text-danger">
                {errors.length === 1 ? 'Some data failed to load' : `${errors.length} sections failed to load`}
              </span>
            </div>
            <button onClick={() => setErrors([])} className="text-muted hover:text-cream transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            {errors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <AlertCircle size={12} className="text-danger mt-0.5 shrink-0" />
                <span className="text-cream/80">
                  <span className="font-medium text-danger">{e.label}:</span> {e.msg}
                </span>
              </div>
            ))}
            <p className="text-[11px] text-muted pt-1">
              💡 Make sure the backend is running and your account has made predictions. Try refreshing the page.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-cream">Student Risk Dashboard</h1>
          <p className="text-ghost text-sm mt-1">AI-powered dropout risk intelligence — DropoutIQ v4</p>
        </div>
        <div className="flex gap-3">
          <Link to="/predict" className="btn-primary text-xs flex items-center gap-2 px-4 py-2">
            <Brain size={14} />New Prediction
          </Link>
          <Link to="/batch" className="btn-glass text-xs flex items-center gap-2 px-4 py-2">
            <Upload size={14} />Batch Upload
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users}         label="Total Students Analyzed" value={summary?.total ?? 0}    color="accent" loading={loading} />
        <StatCard icon={AlertCircle}   label="Predicted Dropouts"       value={summary?.dropouts ?? 0} color="danger" loading={loading}
                  sub={summary ? `${Math.round((summary.dropouts / (summary.total || 1)) * 100)}% of total` : ''} />
        <StatCard icon={AlertTriangle} label="Critical Cases"           value={summary?.critical ?? 0} color="warn"   loading={loading} />
        <StatCard icon={TrendingUp}    label="Avg Risk Score"           value={summary ? `${summary.avg_risk}%` : '—'} color="safe" loading={loading} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Risk Distribution Bar */}
        <div className="card">
          <h2 className="text-sm text-ghost mb-4 font-medium">Risk Distribution</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={riskDist} barSize={32}>
              <XAxis dataKey="level" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {riskDist.map((d) => <Cell key={d.level} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie breakdown */}
        <div className="card flex flex-col">
          <h2 className="text-sm text-ghost mb-4 font-medium">Risk Breakdown</h2>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" outerRadius={70} innerRadius={35} paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={RISK_COLORS[entry.name]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8}
                        wrapperStyle={{ fontSize: '11px', color: '#888' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 30-day trend */}
        <div className="card">
          <h2 className="text-sm text-ghost mb-4 font-medium">30-Day Trend</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendChartData}>
              <defs>
                <linearGradient id="grad-drop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E05252" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#E05252" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3DBE7A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3DBE7A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="dropouts" name="Dropouts"
                    stroke="#E05252" fill="url(#grad-drop)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="graduates" name="Graduates"
                    stroke="#3DBE7A" fill="url(#grad-grad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Predictions — clickable */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium text-ghost">Recent Predictions</h2>
            <Link to="/history" className="text-xs text-accent hover:underline flex items-center gap-1">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center text-ghost text-sm py-8">No predictions yet</div>
          ) : (
            <div className="space-y-1">
              {recent.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/students/${encodeURIComponent(p.student_id || p.student_name || p.id)}`)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                             hover:bg-white/5 transition-all group text-left border border-transparent
                             hover:border-white/5"
                >
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <GraduationCap size={13} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-cream font-medium truncate">
                      {p.student_name || 'Student'}
                    </div>
                    <div className="text-[10px] text-muted font-mono">{p.student_id || '—'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono text-cream">{Math.round(p.dropout_probability * 100)}%</div>
                    <RiskBadge level={p.risk_level} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Intervention Priority */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium text-ghost">🚨 Intervention Priority</h2>
            <Link to="/analytics" className="text-xs text-accent hover:underline flex items-center gap-1">
              Full List <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : priority.length === 0 ? (
            <div className="text-center text-ghost text-sm py-8">No high-risk students</div>
          ) : (
            <div className="space-y-1">
              {priority.map((p, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/students/${encodeURIComponent(p.student_id || p.student_name || '')}`)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                             hover:bg-white/5 transition-all group text-left"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${i === 0 ? 'bg-danger/20 text-danger' : i === 1 ? 'bg-warn/20 text-warn' : 'bg-white/10 text-muted'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-cream font-medium truncate">
                      {p.student_name || 'Unknown'}
                    </div>
                    <div className="text-[10px] text-muted font-mono">{p.student_id || '—'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono text-danger font-bold">
                      {Math.round(p.dropout_probability * 100)}%
                    </div>
                    <div className="text-[10px] text-muted">score: {p.intervention_score?.toFixed(0)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
