import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import RiskBadge from '../components/RiskBadge'
import { Zap, CheckCircle, HelpCircle, Loader2, AlertCircle, RefreshCw, BarChart2 } from 'lucide-react'

export default function ActiveLearning() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [uncertain, setUncertain] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [labels, setLabels] = useState({})  // predictionId -> label
  const [submitting, setSubmitting] = useState({})
  const [submitted, setSubmitted] = useState(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const [uData, sData] = await Promise.allSettled([
        api.getUncertainPredictions(token, 20),
        api.getActiveLearningStats(token),
      ])
      if (uData.status === 'fulfilled') setUncertain(uData.value.uncertain_predictions || [])
      if (sData.status === 'fulfilled') setStats(sData.value)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => { load() }, [load])

  async function submitLabel(predId, label) {
    setSubmitting(s => ({ ...s, [predId]: true }))
    try {
      const token = await getToken()
      await api.submitLabel(token, predId, label)
      setSubmitted(s => new Set([...s, predId]))
      setLabels(l => ({ ...l, [predId]: label }))
      // Refresh stats
      api.getActiveLearningStats(token).then(s => setStats(s)).catch(() => {})
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(s => ({ ...s, [predId]: false }))
    }
  }

  const uncertaintyBadge = (prob) => {
    const dist = Math.abs(prob - 0.5)
    if (dist < 0.05) return { label: 'Very Uncertain', color: 'text-danger bg-danger/10' }
    if (dist < 0.1) return { label: 'Uncertain', color: 'text-warn bg-warn/10' }
    return { label: 'Borderline', color: 'text-accent bg-accent/10' }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-cream flex items-center gap-3">
            <Zap className="text-accent" size={28} />Active Learning
          </h1>
          <p className="text-ghost text-sm mt-1">
            Label uncertain predictions to improve model accuracy over time
          </p>
        </div>
        <button onClick={load} disabled={loading}
                className="btn-glass text-xs flex items-center gap-2 px-3 py-2">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center">
          <div className="text-2xl font-bold text-accent">{stats?.total_labels ?? 0}</div>
          <div className="text-xs text-ghost mt-1">Total Labels Submitted</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-danger">{stats?.dropout_labels ?? 0}</div>
          <div className="text-xs text-ghost mt-1">True Dropout Labels</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-safe">{stats?.graduate_labels ?? 0}</div>
          <div className="text-xs text-ghost mt-1">True Graduate Labels</div>
        </div>
      </div>

      {/* How it works */}
      <div className="card mb-6 bg-accent/5 border border-accent/20">
        <div className="flex items-start gap-3">
          <HelpCircle size={16} className="text-accent shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-cream mb-1">How Active Learning Works</h3>
            <p className="text-xs text-ghost leading-relaxed">
              The model has low confidence on these predictions (probability near 50%).
              Your labels help identify where the model needs improvement.
              Each label you submit is saved and can be used to retrain the model with real outcome data.
            </p>
          </div>
        </div>
      </div>

      {/* Uncertain predictions list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      ) : uncertain.length === 0 ? (
        <div className="card text-center py-16">
          <BarChart2 className="mx-auto mb-3 text-muted" size={28} />
          <h2 className="text-cream font-bold mb-2">No Uncertain Predictions</h2>
          <p className="text-ghost text-sm">All predictions are high-confidence. Run more predictions to populate this queue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {uncertain.map(p => {
            const badge = uncertaintyBadge(p.dropout_probability)
            const isSubmitted = submitted.has(p.id)
            const selectedLabel = labels[p.id]
            const isLoading = submitting[p.id]

            return (
              <div key={p.id}
                   className={`card transition-all duration-300 ${isSubmitted ? 'border border-safe/30 bg-safe/5' : ''}`}>
                <div className="flex items-center gap-4">
                  {/* Student info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => navigate(`/students/${encodeURIComponent(p.student_id || p.student_name || p.id)}`)}
                        className="text-sm font-medium text-cream hover:text-accent transition-colors truncate"
                      >
                        {p.student_name || 'Unknown Student'}
                      </button>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted">
                      <span className="font-mono">{p.student_id || '—'}</span>
                      <span>·</span>
                      <RiskBadge level={p.risk_level} />
                      <span>·</span>
                      <span>Model says: <span className={p.prediction === 'Dropout' ? 'text-danger' : 'text-safe'}>
                        {p.prediction}
                      </span></span>
                      <span>·</span>
                      <span className="font-mono">{(p.dropout_probability * 100).toFixed(1)}% probability</span>
                    </div>
                  </div>

                  {/* Uncertainty bar */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-[10px] text-muted">Uncertainty</div>
                    <div className="w-24 h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-danger"
                        style={{ width: `${(1 - Math.abs(p.dropout_probability - 0.5) * 2) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Label buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isSubmitted ? (
                      <div className="flex items-center gap-2 text-safe text-xs font-medium">
                        <CheckCircle size={16} />
                        Labeled: {selectedLabel}
                      </div>
                    ) : (
                      <>
                        <button
                          disabled={isLoading}
                          onClick={() => submitLabel(p.id, 'Dropout')}
                          className="px-3 py-1.5 rounded-lg text-xs bg-danger/10 text-danger
                                     hover:bg-danger/20 border border-danger/20 transition-all font-medium
                                     disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 size={12} className="animate-spin" /> : '✗ Dropout'}
                        </button>
                        <button
                          disabled={isLoading}
                          onClick={() => submitLabel(p.id, 'Graduate')}
                          className="px-3 py-1.5 rounded-lg text-xs bg-safe/10 text-safe
                                     hover:bg-safe/20 border border-safe/20 transition-all font-medium
                                     disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 size={12} className="animate-spin" /> : '✓ Graduate'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
