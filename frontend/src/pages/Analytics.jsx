import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '../lib/api'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend, CartesianGrid
} from 'recharts'
import { TrendingUp, Users, AlertTriangle, BarChart2, Loader2 } from 'lucide-react'

const RISK_COLORS = { Critical:'#E05252', High:'#E8A030', Medium:'#E8D730', Low:'#3DBE7A' }

function StatCard({ label, value, sub, color = '#5B8AF0' }) {
  return (
    <div className="card p-5">
      <div className="text-3xl font-bold mb-1" style={{ color }}>{value}</div>
      <div className="text-sm text-cream/80 font-medium">{label}</div>
      {sub && <div className="text-xs text-ghost mt-1">{sub}</div>}
    </div>
  )
}

export default function Analytics() {
  const { getToken } = useAuth()
  const [trends, setTrends] = useState(null)
  const [cohorts, setCohorts] = useState(null)
  const [priority, setPriority] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const token = await getToken()
        const [t, c, p] = await Promise.all([
          api.getTrends(token, days),
          api.getCohort(token),
          api.getInterventionPriority(token, 10),
        ])
        setTrends(t); setCohorts(c); setPriority(p)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [getToken, days])

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <Loader2 className="animate-spin text-accent" size={24} />
    </div>
  )

  const trendData = trends?.trends || []
  const cohortData = cohorts?.cohorts || []
  const priorityList = priority?.priority_list || []

  const totalStudents = cohorts?.total_students || 0
  const criticalCount = cohortData.find(c => c.risk_level === 'Critical')?.count || 0
  const highCount = cohortData.find(c => c.risk_level === 'High')?.count || 0
  const avgProb = cohortData.reduce((s,c) => s + c.avg_probability * c.count, 0) / (totalStudents || 1)

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-cream">Analytics</h1>
        <p className="text-ghost text-sm">Cohort analysis, trends, and intervention priorities</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Students" value={totalStudents} color="#5B8AF0" />
        <StatCard label="Critical Risk" value={criticalCount} color="#E05252" sub="Immediate intervention" />
        <StatCard label="High Risk" value={highCount} color="#E8A030" sub="Proactive outreach" />
        <StatCard label="Avg Dropout Prob" value={`${Math.round(avgProb*100)}%`} color="#E8A030" />
      </div>

      {/* Cohort breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-cream">Risk Cohort Breakdown</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cohortData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="risk_level" tick={{ fontSize: 11, fill:'#888' }} />
              <YAxis tick={{ fontSize: 10, fill:'#888' }} />
              <Tooltip contentStyle={{ background:'#1a1d26', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:11 }} />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {cohortData.map((d,i) => <Cell key={i} fill={RISK_COLORS[d.risk_level] || '#5B8AF0'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Users size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-cream">Risk Distribution %</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={cohortData} dataKey="count" nameKey="risk_level" outerRadius={85} label={({risk_level, percentage}) => `${risk_level} ${percentage}%`}>
                {cohortData.map((d,i) => <Cell key={i} fill={RISK_COLORS[d.risk_level] || '#5B8AF0'} />)}
              </Pie>
              <Tooltip contentStyle={{ background:'#1a1d26', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-cream">Prediction Trends</h2>
          </div>
          <div className="flex gap-2">
            {[7,14,30,60].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded text-xs transition-all ${days === d ? 'bg-accent text-white' : 'bg-panel text-ghost hover:bg-accent/20'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        {trendData.length === 0 ? (
          <div className="text-center py-12 text-ghost">No trend data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize:10, fill:'#888' }} />
              <YAxis tick={{ fontSize:10, fill:'#888' }} />
              <Tooltip contentStyle={{ background:'#1a1d26', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:11 }} />
              <Line type="monotone" dataKey="dropouts" name="Dropouts" stroke="#E05252" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="graduates" name="Graduates" stroke="#3DBE7A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="total" name="Total" stroke="#5B8AF0" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Intervention priority table */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle size={16} className="text-danger" />
          <h2 className="text-sm font-semibold text-cream">Intervention Priority List</h2>
          <span className="ml-auto text-xs text-ghost">Top 10 highest risk students</span>
        </div>
        {priorityList.length === 0 ? (
          <div className="text-center py-8 text-ghost">No dropout predictions yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs text-ghost uppercase">Rank</th>
                <th className="px-4 py-2 text-left text-xs text-ghost uppercase">Student</th>
                <th className="px-4 py-2 text-left text-xs text-ghost uppercase">Risk</th>
                <th className="px-4 py-2 text-left text-xs text-ghost uppercase">Probability</th>
                <th className="px-4 py-2 text-left text-xs text-ghost uppercase">Priority Score</th>
                <th className="px-4 py-2 text-left text-xs text-ghost uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {priorityList.map((p, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-panel/60">
                  <td className="px-4 py-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-danger text-white' : i === 1 ? 'bg-warn text-black' : i === 2 ? 'bg-yellow-500 text-black' : 'bg-panel text-ghost'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-cream font-medium">{p.student_name || '—'}</div>
                    <div className="text-xs text-muted font-mono">{p.student_id || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium`}
                      style={{ background: RISK_COLORS[p.risk_level] + '20', color: RISK_COLORS[p.risk_level] }}>
                      {p.risk_level}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-danger">{Math.round(p.dropout_probability * 100)}%</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 bg-border/30 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-danger transition-all"
                          style={{ width: `${p.intervention_score}%` }} />
                      </div>
                      <span className="text-xs font-mono text-danger">{p.intervention_score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ghost">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
