import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import RiskBadge from '../components/RiskBadge'
import {
  Search, Filter, Download, Loader2, ChevronLeft, ChevronRight,
  ExternalLink, User, AlertCircle, X
} from 'lucide-react'

const RISK_LEVELS = ['All', 'Critical', 'High', 'Medium', 'Low']
const PAGE_SIZE = 50

function exportCSV(predictions) {
  const rows = [
    ['Student Name', 'Student ID', 'Prediction', 'Probability', 'Risk', 'Date'],
    ...predictions.map(p => [
      p.student_name || '',
      p.student_id || '',
      p.prediction,
      Math.round(p.dropout_probability * 100) + '%',
      p.risk_level,
      new Date(p.created_at).toLocaleString(),
    ])
  ]
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `history_${Date.now()}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function History() {
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('All')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  const load = useCallback(async (p = 0) => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const data = await api.history(token, PAGE_SIZE, p * PAGE_SIZE)
      setPredictions(data.predictions || [])
    } catch (err) {
      setError(err.message || 'Failed to load prediction history')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  // Also get total count
  useEffect(() => {
    getToken().then(token =>
      api.getSummary(token).then(s => setTotalCount(s.total || 0)).catch(() => {})
    )
    load(0)
  }, [getToken, load])

  const filtered = useMemo(() => {
    return predictions.filter(p => {
      const matchRisk = riskFilter === 'All' || p.risk_level === riskFilter
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        (p.student_name || '').toLowerCase().includes(q) ||
        (p.student_id || '').toLowerCase().includes(q)
      return matchRisk && matchSearch
    })
  }, [predictions, search, riskFilter])

  const stats = {
    total: totalCount,
    dropouts: predictions.filter(p => p.prediction === 'Dropout').length,
    high: predictions.filter(p => p.risk_level === 'High').length,
    low: predictions.filter(p => p.risk_level === 'Low').length,
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  function goPage(p) {
    setPage(p)
    load(p)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-cream">Prediction History</h1>
          <p className="text-ghost text-sm mt-1">
            {totalCount.toLocaleString()} total records · showing {PAGE_SIZE} per page
          </p>
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          className="btn-primary text-xs flex items-center gap-2 px-4 py-2"
        >
          <Download size={14} />Export Page
        </button>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/5 p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-danger mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-danger mb-1">Failed to load history</p>
            <p className="text-xs text-cream/70">{error}</p>
            <p className="text-[11px] text-muted mt-2">💡 Make sure the backend is running and you are logged in. Try refreshing the page.</p>
          </div>
          <button onClick={() => setError(null)} className="text-muted hover:text-cream transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-2xl font-bold text-cream">{totalCount.toLocaleString()}</div>
          <div className="text-xs text-ghost mt-1">Total Records</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-danger">{stats.dropouts}</div>
          <div className="text-xs text-ghost mt-1">Dropouts (this page)</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-warn">{stats.high}</div>
          <div className="text-xs text-ghost mt-1">High Risk (this page)</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-safe">{stats.low}</div>
          <div className="text-xs text-ghost mt-1">Low Risk (this page)</div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Filter by name or ID (this page)..."
            className="input-field pl-9 focus:ring-2 focus:ring-accent/40"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted" />
          {RISK_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setRiskFilter(level)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${riskFilter === level
                ? 'bg-accent text-white shadow-md'
                : 'bg-panel hover:bg-accent/20 text-ghost'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <div className="card overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Student', 'Prediction', 'Risk', 'Prob.', 'Score', 'Date', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] text-ghost uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-muted">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  Loading predictions...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <div className="text-3xl mb-2">📊</div>
                  <p className="text-cream">No predictions found</p>
                  <p className="text-xs text-muted">Try changing filters or run new predictions</p>
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/40 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => navigate(`/students/${encodeURIComponent(p.student_id || p.student_name || p.id)}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <User size={12} className="text-accent" />
                      </div>
                      <div>
                        <div className="text-cream font-medium text-xs">{p.student_name || '—'}</div>
                        <div className="text-[10px] text-muted font-mono">{p.student_id || '—'}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${p.prediction === 'Dropout' ? 'text-danger' : 'text-safe'}`}>
                      {p.prediction}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <RiskBadge level={p.risk_level} />
                  </td>

                  <td className="px-4 py-3 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 max-w-[60px]">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.round(p.dropout_probability * 100)}%`,
                            backgroundColor: p.dropout_probability >= 0.75 ? '#E05252' :
                                             p.dropout_probability >= 0.55 ? '#E8A030' : '#3DBE7A'
                          }}
                        />
                      </div>
                      <span>{Math.round(p.dropout_probability * 100)}%</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-xs text-muted">
                    {p.intervention_score?.toFixed(0) ?? '—'}
                  </td>

                  <td className="px-4 py-3 text-[11px] text-muted">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>

                  <td className="px-4 py-3">
                    <ExternalLink size={13} className="text-muted group-hover:text-accent" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">
          Page {page + 1} of {Math.max(1, totalPages)} · {filtered.length} shown
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goPage(Math.max(0, page - 1))}
            disabled={page === 0 || loading}
            className="btn-glass px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          {[...Array(Math.min(5, totalPages))].map((_, i) => {
            const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i
            return (
              <button
                key={p}
                onClick={() => goPage(p)}
                className={`w-7 h-7 rounded text-xs ${page === p ? 'bg-accent text-white' : 'bg-white/5 text-ghost hover:bg-white/10'}`}
              >
                {p + 1}
              </button>
            )
          })}
          <button
            onClick={() => goPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1 || loading}
            className="btn-glass px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}