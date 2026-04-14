import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '../lib/api'
import { Dna, TrendingDown, Loader2, AlertCircle, Info } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from 'recharts'

const COHORT_COLORS = {
  Low: '#3DBE7A', Medium: '#E8D730', High: '#E8A030', Critical: '#E05252'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1d26]/90 border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-muted mb-1">Semester {label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {(p.value * 100).toFixed(1)}% survival
        </p>
      ))}
    </div>
  )
}

export default function SurvivalAnalysis() {
  const { getToken } = useAuth()
  const [curves, setCurves] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const res = await api.getSurvivalCurves(token)
        setCurves(res.survival_curves || [])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken])

  // Build unified timeline for recharts
  const allTimelines = [...new Set(curves.flatMap(c => c.timeline))].sort((a, b) => a - b)
  const chartData = allTimelines.map(t => {
    const point = { semester: t }
    curves.forEach(c => {
      const idx = c.timeline.indexOf(t)
      point[c.cohort] = idx >= 0 ? c.survival_probability[idx] : null
    })
    return point
  })

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="animate-spin text-accent" size={32} />
    </div>
  )

  if (error || curves.length === 0) return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-cream flex items-center gap-3">
          <Dna className="text-accent" size={28} />Survival Analysis
        </h1>
      </div>
      <div className="card text-center py-16">
        <AlertCircle className="mx-auto mb-3 text-warn" size={28} />
        <h2 className="text-cream font-bold mb-2">No Survival Data</h2>
        <p className="text-ghost text-sm mb-4">
          {error || 'Survival curves not found. Please re-run train_model.py to generate them.'}
        </p>
        <div className="text-xs font-mono bg-black/30 rounded-lg px-4 py-2 inline-block text-muted">
          cd backend && python train_model.py
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cream flex items-center gap-3">
          <Dna className="text-accent" size={28} />Survival Analysis
        </h1>
        <p className="text-ghost text-sm mt-1">
          Kaplan-Meier survival curves — probability of staying enrolled by risk cohort
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {curves.map(c => (
          <div key={c.cohort} className="card text-center"
               style={{ borderTop: `3px solid ${c.color}` }}>
            <div className="text-2xl font-bold" style={{ color: c.color }}>
              {c.count}
            </div>
            <div className="text-xs text-ghost mt-1">{c.cohort} Risk</div>
            {c.median_survival && (
              <div className="text-[11px] text-muted mt-1">
                Median: Sem {c.median_survival.toFixed(1)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main chart */}
      <div className="card mb-8">
        <h2 className="text-sm font-medium text-ghost mb-6">
          Kaplan-Meier Enrollment Survival Curves
        </h2>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <defs>
              {curves.map(c => (
                <linearGradient key={c.cohort} id={`grad-${c.cohort}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="semester" label={{ value: 'Semester', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 11 }}
                   tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                   tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false}
                   label={{ value: 'Survival Prob.', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8}
                    wrapperStyle={{ fontSize: '11px', color: '#888', paddingTop: '12px' }} />
            {curves.map(c => (
              <Area
                key={c.cohort}
                type="stepAfter"
                dataKey={c.cohort}
                name={`${c.cohort} Risk`}
                stroke={c.color}
                fill={`url(#grad-${c.cohort})`}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Per-cohort data table */}
      <div className="card">
        <h2 className="text-sm font-medium text-ghost mb-4">Survival Probabilities by Semester</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-3 py-2 text-muted">Semester</th>
                {curves.map(c => (
                  <th key={c.cohort} className="text-left px-3 py-2" style={{ color: c.color }}>
                    {c.cohort}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allTimelines.map(t => (
                <tr key={t} className="border-b border-white/5 hover:bg-white/3">
                  <td className="px-3 py-2 text-muted font-mono">Sem {t}</td>
                  {curves.map(c => {
                    const idx = c.timeline.indexOf(t)
                    const val = idx >= 0 ? c.survival_probability[idx] : null
                    return (
                      <td key={c.cohort} className="px-3 py-2 font-mono" style={{ color: c.color }}>
                        {val !== null ? `${(val * 100).toFixed(1)}%` : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note */}
      <div className="card mt-6 bg-accent/5 border border-accent/20">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-ghost leading-relaxed">
            Survival curves use Kaplan-Meier estimation on simulated semester durations derived from
            model dropout probabilities. Higher-risk cohorts show steeper survival decline, indicating
            earlier dropout events. These curves are refreshed each time train_model.py runs.
          </p>
        </div>
      </div>
    </div>
  )
}
