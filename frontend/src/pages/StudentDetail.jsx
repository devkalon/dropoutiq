import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { api } from '../lib/api'
import RiskBadge from '../components/RiskBadge'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area
} from 'recharts'
import {
  ArrowLeft, User, AlertCircle,
  Bell, GitBranch, Loader2, Activity
} from 'lucide-react'

const RISK_COLORS = { Critical: '#E05252', High: '#E8A030', Medium: '#E8D730', Low: '#3DBE7A' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1d26]/90 border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-muted mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
    </div>
  )
}

export default function StudentDetail() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [alertSending, setAlertSending] = useState(false)
  const [alertMsg, setAlertMsg] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const res = await api.getStudentDetail(token, decodeURIComponent(studentId))
        setData(res)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [studentId, getToken])

  const sendAlert = async () => {
    if (!data) return
    setAlertSending(true)
    try {
      const token = await getToken()
      await api.sendAlert(token, {
        student_id: data.student_id,
        student_name: data.student_name,
        risk_level: data.latest_risk_level,
        dropout_probability: data.latest_dropout_probability,
        channel: 'email',
      })
      setAlertMsg('Alert queued successfully!')
    } catch (e) {
      setAlertMsg('Alert queued (check email config in .env)')
    } finally {
      setAlertSending(false)
      setTimeout(() => setAlertMsg(''), 4000)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-accent" size={32} />
        <p className="text-ghost text-sm">Loading student profile...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="p-8 max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted hover:text-cream text-sm mb-6">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="card text-center py-16">
        <AlertCircle className="mx-auto mb-3 text-danger" size={32} />
        <h2 className="text-cream font-bold mb-2">Student Not Found</h2>
        <p className="text-ghost text-sm">{error}</p>
        <Link to="/history" className="btn-primary mt-4 inline-block text-xs px-4 py-2">Browse History</Link>
      </div>
    </div>
  )

  const riskColor = RISK_COLORS[data.latest_risk_level] || '#5B8AF0'
  const riskTrend = data.risk_trend || []
  const predictions = data.predictions || []

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted hover:text-cream text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20
                          flex items-center justify-center shadow-lg">
            <User size={28} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-cream">{data.student_name || data.student_id}</h1>
            <div className="flex items-center gap-3 mt-1">
              {data.student_id && (
                <span className="text-xs text-muted font-mono bg-white/5 px-2 py-0.5 rounded">
                  ID: {data.student_id}
                </span>
              )}
              <RiskBadge level={data.latest_risk_level} />
            </div>
            <p className="text-ghost text-xs mt-1">{data.prediction_count} predictions recorded</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {alertMsg && (
            <span className="text-xs text-safe bg-safe/10 px-3 py-1.5 rounded-lg">{alertMsg}</span>
          )}
          <button
            onClick={sendAlert}
            disabled={alertSending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-warn/10 text-warn
                       hover:bg-warn/20 transition-all text-xs font-medium border border-warn/20"
          >
            <Bell size={14} />
            {alertSending ? 'Sending...' : 'Send Alert'}
          </button>
          <Link
            to={`/counterfactuals?student_id=${encodeURIComponent(data.student_id || '')}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 text-accent
                       hover:bg-accent/20 transition-all text-xs font-medium border border-accent/20"
          >
            <GitBranch size={14} />
            What Can Change?
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card text-center">
          <div className="text-2xl font-bold" style={{ color: riskColor }}>
            {Math.round((data.latest_dropout_probability || 0) * 100)}%
          </div>
          <div className="text-xs text-ghost mt-1">Latest Dropout Risk</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-cream">{data.intervention_score?.toFixed(0) ?? '—'}</div>
          <div className="text-xs text-ghost mt-1">Intervention Score</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-accent">{data.prediction_count}</div>
          <div className="text-xs text-ghost mt-1">Total Predictions</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-muted">
            {Math.round((data.cohort_avg_probability || 0) * 100)}%
          </div>
          <div className="text-xs text-ghost mt-1">Cohort Average</div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="card mb-6 border-l-4" style={{ borderLeftColor: riskColor }}>
        <div className="flex items-start gap-3">
          <Activity size={18} style={{ color: riskColor }} className="shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-cream mb-1">Recommended Action</h3>
            <p className="text-sm text-ghost">{data.recommendation}</p>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Risk Trend */}
        <div className="card">
          <h2 className="text-sm font-medium text-ghost mb-4">Risk Trend Over Time</h2>
          {riskTrend.length < 2 ? (
            <div className="flex items-center justify-center h-40 text-muted text-xs">
              Not enough data points for trend
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={riskTrend}>
                <defs>
                  <linearGradient id="risk-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={riskColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={riskColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="probability" name="Risk %"
                      stroke={riskColor} fill="url(#risk-grad)" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Prediction History Table */}
        <div className="card">
          <h2 className="text-sm font-medium text-ghost mb-4">All Predictions</h2>
          <div className="overflow-y-auto max-h-[200px] space-y-1">
            {predictions.length === 0 ? (
              <p className="text-muted text-xs text-center py-8">No predictions yet</p>
            ) : predictions.map((p, i) => (
              <div key={p.id || i}
                   className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/3 hover:bg-white/5 transition-colors">
                <div className="text-[11px] text-muted">{new Date(p.created_at).toLocaleDateString()}</div>
                <RiskBadge level={p.risk_level} />
                <div className={`text-xs font-mono font-bold ${p.prediction === 'Dropout' ? 'text-danger' : 'text-safe'}`}>
                  {Math.round(p.dropout_probability * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Input Features Summary */}
      {predictions[0]?.input_features && (
        <div className="card">
          <h2 className="text-sm font-medium text-ghost mb-4">Latest Input Features</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Gender', predictions[0].input_features.gender === 1 ? 'Male' : 'Female'],
              ['Age at Enrollment', predictions[0].input_features.age_at_enrollment],
              ['Scholarship', predictions[0].input_features.scholarship_holder === 1 ? 'Yes' : 'No'],
              ['Debtor', predictions[0].input_features.debtor === 1 ? 'Yes' : 'No'],
              ['Tuition Paid', predictions[0].input_features.tuition_fees_up_to_date === 1 ? 'Yes' : 'No'],
              ['Units Approved (Sem 1)', predictions[0].input_features.curricular_units_1st_sem_approved],
              ['Units Approved (Sem 2)', predictions[0].input_features.curricular_units_2nd_sem_approved],
              ['Grade Avg (Sem 1)', predictions[0].input_features.curricular_units_1st_sem_grade?.toFixed(1)],
              ['Grade Avg (Sem 2)', predictions[0].input_features.curricular_units_2nd_sem_grade?.toFixed(1)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white/3 rounded-lg px-3 py-2">
                <div className="text-[10px] text-muted">{label}</div>
                <div className="text-xs text-cream font-medium mt-0.5">{value ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
