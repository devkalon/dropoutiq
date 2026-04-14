import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '../lib/api'
import { Shield, AlertCircle, CheckCircle, Users, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1d26]/90 border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-muted mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? (p.value * 100).toFixed(1) + '%' : p.value}</p>)}
    </div>
  )
}

function FairnessCard({ metric }) {
  const { attribute, group_labels, demographic_parity, avg_dropout_prob, sample_counts } = metric
  const isFair = demographic_parity.fair
  const diff = demographic_parity.difference

  const chartData = Object.entries(avg_dropout_prob).map(([k, v]) => ({
    group: k, probability: v, fill: k.includes('Female') || k.includes('scholarship') ? '#5B8AF0' : '#E8A030'
  }))

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isFair ? 'bg-safe/10' : 'bg-danger/10'}`}>
            {isFair
              ? <CheckCircle size={18} className="text-safe" />
              : <AlertCircle size={18} className="text-danger" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-cream">{attribute} Fairness</h3>
            <p className="text-[11px] text-muted">Demographic parity analysis</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${isFair ? 'bg-safe/10 text-safe' : 'bg-danger/10 text-danger'}`}>
          {isFair ? '✓ FAIR' : '⚠ BIAS DETECTED'}
        </div>
      </div>

      {/* Parity stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {Object.entries(group_labels).map(([k, label]) => (
          <div key={k} className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-cream">
              {(demographic_parity[`group_${k}_rate`] * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted mt-0.5">{label}</div>
            <div className="text-[10px] text-muted">n={sample_counts[label]?.toLocaleString() || 0}</div>
          </div>
        ))}
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className={`text-lg font-bold ${isFair ? 'text-safe' : 'text-danger'}`}>
            {(diff * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted mt-0.5">Disparity Gap</div>
          <div className="text-[10px] text-muted">{isFair ? '< 10% threshold' : '> 10% threshold'}</div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} barSize={40}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="group" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 1]} tickFormatter={v => `${(v*100).toFixed(0)}%`}
                 tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="probability" name="Avg Dropout Prob" radius={[4,4,0,0]}>
            {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function FairnessAudit() {
  const { getToken } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const res = await api.getFairness(token)
        setData(res)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken])

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="animate-spin text-accent" size={32} />
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className="card text-center py-12">
        <AlertCircle className="mx-auto mb-3 text-danger" size={28} />
        <p className="text-ghost text-sm">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cream flex items-center gap-3">
          <Shield className="text-accent" size={28} />
          Fairness Audit
        </h1>
        <p className="text-ghost text-sm mt-1">
          Demographic parity analysis across sensitive attributes · {data?.total_analyzed?.toLocaleString()} records analyzed
        </p>
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center">
          <div className="text-2xl font-bold text-accent">{data?.total_analyzed?.toLocaleString()}</div>
          <div className="text-xs text-ghost mt-1">Records Analyzed</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-danger">
            {((data?.overall_dropout_rate || 0) * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-ghost mt-1">Overall Dropout Rate</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold">
            {(data?.metrics || []).filter(m => m.demographic_parity.fair).length} / {(data?.metrics || []).length}
          </div>
          <div className="text-xs text-ghost mt-1">Attributes Pass Fairness</div>
        </div>
      </div>

      {/* Fairness cards */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {(data?.metrics || []).map((metric, i) => (
          <FairnessCard key={i} metric={metric} />
        ))}
      </div>

      {/* Methodology note */}
      <div className="card border border-accent/20 bg-accent/5">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-accent shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-cream mb-1">Methodological Note</h3>
            <p className="text-xs text-ghost leading-relaxed">
              Demographic parity measures whether different groups receive equal dropout predictions.
              A disparity gap &lt; 10% is considered acceptable. This analysis does not imply bias in
              the model itself — differences may reflect real population differences in academic outcomes.
              Use these metrics alongside domain expertise to make informed decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
