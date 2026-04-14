import { useState, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api, downloadBlob } from '../lib/api'
import RiskBadge from '../components/RiskBadge'
import { Upload, FileText, Download, Loader2, AlertCircle, CheckCircle, X, Brain, BarChart2, Zap } from 'lucide-react'

const RISK_COLORS = { Critical:'#E05252', High:'#E8A030', Medium:'#E8D730', Low:'#3DBE7A' }

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const delimiter = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(delimiter).map(h => {
    let key = h.trim().toLowerCase()
    key = key.replace(/['"]/g, '').replace(/\s+/g, '_').replace(/[()]/g, '')
    key = key.replace(/daytime\/evening_attendance/g, 'daytime_evening_attendance')
    if (key === 'nacionality') key = 'nationality'
    return key
  })
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(delimiter).map(v => v.trim())
    const obj = {}
    headers.forEach((h, i) => {
      if (h !== 'target' && values[i] !== undefined && values[i] !== '') obj[h] = values[i]
    })
    return obj
  })
}

function downloadTemplate() {
  const headers = [
    "student_name,student_id,marital_status,application_mode,application_order,course,daytime_evening_attendance",
    "previous_qualification,previous_qualification_grade,nationality,mothers_qualification,fathers_qualification",
    "mothers_occupation,fathers_occupation,admission_grade,displaced,educational_special_needs,debtor",
    "tuition_fees_up_to_date,gender,scholarship_holder,age_at_enrollment,international",
    "curricular_units_1st_sem_credited,curricular_units_1st_sem_enrolled,curricular_units_1st_sem_evaluations",
    "curricular_units_1st_sem_approved,curricular_units_1st_sem_grade,curricular_units_1st_sem_without_evaluations",
    "curricular_units_2nd_sem_credited,curricular_units_2nd_sem_enrolled,curricular_units_2nd_sem_evaluations",
    "curricular_units_2nd_sem_approved,curricular_units_2nd_sem_grade,curricular_units_2nd_sem_without_evaluations",
    "unemployment_rate,inflation_rate,gdp"
  ].join(',')
  const sample = "John Doe,S001,1,1,1,9147,1,1,122.0,1,1,1,1,1,127.0,0,0,0,1,1,0,20,0,0,5,5,5,15.0,0,0,5,5,5,15.0,0,10.0,2.0,1.74"
  const blob = new Blob([headers + "\n" + sample], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'student_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

function exportResultsCSV(results) {
  const rows = [
    ['Student Name','Student ID','Prediction','Probability','Risk Level','Intervention Score'],
    ...results.map(r => [r.student_name||'',r.student_id||'',r.prediction,
      Math.round(r.dropout_probability*100)+'%',r.risk_level,r.intervention_score||''])
  ]
  const blob = new Blob([rows.map(r=>r.join(',')).join('\n')], { type: 'text/csv' })
  downloadBlob(blob, `batch_results_${Date.now()}.csv`)
}

function RiskMiniBar({ count, total, level }) {
  const pct = total > 0 ? (count / total * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-ghost w-16">{level}</div>
      <div className="flex-1 h-2 bg-border/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: RISK_COLORS[level] }} />
      </div>
      <div className="text-xs font-mono text-cream/70 w-8 text-right">{count}</div>
    </div>
  )
}

export default function BatchPredict() {
  const { getToken } = useAuth()
  const fileRef = useRef()

  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState(null)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [includeShap, setIncludeShap] = useState(false)
  const [meta, setMeta] = useState(null)

  const handleFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) { setError('Please upload a valid CSV file'); return }
    setFileName(file.name); setError(null); setResults(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try { setRows(parseCSV(e.target.result)) }
      catch { setError('Invalid CSV format') }
    }
    reader.readAsText(file)
  }

  const removeFile = () => { setFileName(null); setRows([]); setResults(null); setMeta(null) }

  const handleSubmit = async () => {
    setLoading(true); setError(null)
    try {
      const token = await getToken()
      const res = await api.predictBatch(rows, token, includeShap)
      setResults(res.results)
      setMeta({ total: res.total, duration: res.duration_seconds, model: res.model_used,
                threshold: res.decision_threshold, risk_summary: res.risk_summary, smote_note: res.smote_note })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const riskCounts = results
    ? ['Critical','High','Medium','Low'].map(level => ({
        level, count: results.filter(r => r.risk_level === level).length,
      }))
    : []

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cream">Batch Prediction</h1>
        <p className="text-ghost text-sm">Upload a CSV file to analyze multiple students at once</p>
      </div>

      {/* UPLOAD CARD */}
      <div className="card p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-cream">Upload CSV</h2>
          <button onClick={downloadTemplate} className="btn-ghost flex items-center gap-1 text-xs">
            <Download size={13} /> Download Template
          </button>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
          ${dragging ? 'border-accent bg-accent-dim' : 'border-border'}`}
          onClick={() => fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <Upload size={34} className="mx-auto mb-3 text-muted" />
          <p className="text-lg font-semibold text-cream">{fileName || 'Upload Student Dataset (CSV)'}</p>
          <p className="text-xs text-muted mt-1">Drag & drop or click to upload (Max 10MB)</p>
          <input ref={fileRef} type="file" className="hidden" accept=".csv"
            onChange={e => handleFile(e.target.files[0])} />
        </div>

        {fileName && (
          <div className="mt-4 flex justify-between items-center bg-panel p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm"><FileText size={16} />{fileName}</div>
            <button onClick={removeFile}><X size={16} /></button>
          </div>
        )}

        {/* SHAP toggle */}
        {rows.length > 0 && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-panel rounded-lg border border-border/30">
            <Brain size={16} className="text-accent" />
            <div className="flex-1">
              <div className="text-sm text-cream font-medium">Include SHAP per student</div>
              <div className="text-xs text-ghost">Slower but shows risk drivers for each student</div>
            </div>
            <button
              type="button"
              onClick={() => setIncludeShap(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-all ${includeShap ? 'bg-accent' : 'bg-border'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${includeShap ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-4 flex justify-between items-center">
            <div className="text-safe flex items-center gap-2 text-sm">
              <CheckCircle size={14} /> {rows.length} students ready
            </div>
            <button onClick={handleSubmit} disabled={loading}
              className="btn-primary flex items-center gap-2">
              {loading ? (
                <><Loader2 className="animate-spin" size={14} />Processing...</>
              ) : (
                <><Zap size={14} />Run Prediction</>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-danger-dim p-3 rounded text-danger flex gap-2 text-sm overflow-hidden">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
              {error.length > 1000 ? error.substring(0,1000) + '\n\n...(truncated)' : error}
            </div>
          </div>
        )}
      </div>

      {/* RESULTS */}
      {results && (
        <div>
          {/* Meta info */}
          {meta && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-cream">{meta.total}</div>
                <div className="text-xs text-ghost">Total Students</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-danger">{meta.risk_summary?.Critical || 0}</div>
                <div className="text-xs text-ghost">Critical</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-warn">{meta.risk_summary?.High || 0}</div>
                <div className="text-xs text-ghost">High Risk</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-safe">{meta.risk_summary?.Low || 0}</div>
                <div className="text-xs text-ghost">Low Risk</div>
              </div>
            </div>
          )}

          {/* Risk distribution bars */}
          {meta?.risk_summary && (
            <div className="card mb-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className="text-accent" />
                <h3 className="text-sm font-semibold text-cream">Risk Distribution</h3>
                <button onClick={() => exportResultsCSV(results)}
                  className="ml-auto btn-ghost text-xs flex items-center gap-1">
                  <Download size={12} /> Export CSV
                </button>
              </div>
              {['Critical','High','Medium','Low'].map(rl => (
                <RiskMiniBar key={rl} level={rl} count={meta.risk_summary[rl]||0} total={meta.total} />
              ))}
              {meta.smote_note && (
                <div className="mt-3 text-[10px] text-muted border-t border-border/20 pt-2">
                  ℹ️ {meta.smote_note}
                </div>
              )}
            </div>
          )}

          {/* Sorted table (by intervention score) */}
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-cream">
                Results — Sorted by Intervention Priority
              </h3>
              <span className="text-xs text-ghost">{results.length} students</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left text-xs text-ghost uppercase">Student</th>
                  <th className="p-3 text-left text-xs text-ghost uppercase">Prediction</th>
                  <th className="p-3 text-left text-xs text-ghost uppercase">Risk</th>
                  <th className="p-3 text-left text-xs text-ghost uppercase">Probability</th>
                  <th className="p-3 text-left text-xs text-ghost uppercase">Priority Score</th>
                  {includeShap && <th className="p-3 text-left text-xs text-ghost uppercase">Top Risk Factor</th>}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-panel/60">
                    <td className="p-3">
                      <div className="text-cream font-medium">{r.student_name || '—'}</div>
                      <div className="text-xs text-muted font-mono">{r.student_id || ''}</div>
                    </td>
                    <td className="p-3">
                      <span className={r.prediction === 'Dropout' ? 'text-danger' : 'text-safe'}>
                        {r.prediction}
                      </span>
                    </td>
                    <td className="p-3"><RiskBadge level={r.risk_level} /></td>
                    <td className="p-3 font-mono">{Math.round(r.dropout_probability * 100)}%</td>
                    <td className="p-3">
                      <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                        r.intervention_score >= 70 ? 'bg-danger/10 text-danger'
                          : r.intervention_score >= 45 ? 'bg-warn/10 text-warn'
                          : 'bg-safe/10 text-safe'
                      }`}>
                        {r.intervention_score}/100
                      </span>
                    </td>
                    {includeShap && (
                      <td className="p-3 text-xs text-ghost">
                        {r.risk_factors?.[0]?.friendly_name || '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
