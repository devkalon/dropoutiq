import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '../lib/api'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend, ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { Activity, BarChart2, Target, Grid, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

const MODEL_COLORS = {
  RandomForest:       '#5B8AF0',
  XGBoost:            '#E8A030',
  LogisticRegression: '#3DBE7A',
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2 bg-accent/10 rounded-lg border border-accent/20">
        <Icon size={18} className="text-accent" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-cream">{title}</h2>
        {subtitle && <p className="text-xs text-ghost">{subtitle}</p>}
      </div>
    </div>
  )
}

function LoadingCard() {
  return (
    <div className="card flex items-center justify-center py-16">
      <Loader2 className="animate-spin text-accent" size={24} />
    </div>
  )
}

function ErrorCard({ msg }) {
  return (
    <div className="card flex items-center gap-3 py-8 text-danger">
      <AlertCircle size={18} />
      <span className="text-sm">{msg}</span>
    </div>
  )
}

/* ── ROC CURVE ──────────────────────────────────────────────────────────────── */
function ROCChart({ data }) {
  // Merge all models into recharts-compatible [{fpr, model1, model2, model3}] is complex;
  // Instead render each model as a separate Scatter series on same chart
  // Build per-model series
  const series = data.map(m => ({
    name: m.model,
    auc: m.auc,
    color: MODEL_COLORS[m.model] || '#888',
    points: m.fpr.map((fpr, i) => ({ fpr, tpr: m.tpr[i] })),
  }))

  return (
    <div className="card">
      <SectionHeader icon={Activity} title="ROC Curves" subtitle="All 3 models — higher AUC = better discrimination" />

      {/* AUC badges */}
      <div className="flex gap-3 mb-5">
        {series.map(s => (
          <div key={s.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-panel border border-border/50 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-ghost">{s.name}</span>
            <span className="font-mono font-bold" style={{ color: s.color }}>AUC={s.auc}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="fpr" type="number" domain={[0,1]}
                 label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -10, fill: '#888', fontSize: 11 }}
                 tick={{ fontSize: 10, fill: '#888' }} />
          <YAxis type="number" domain={[0,1]}
                 label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }}
                 tick={{ fontSize: 10, fill: '#888' }} />
          <Tooltip
            formatter={(val, name) => [val?.toFixed(3), name]}
            contentStyle={{ background: '#1a1d26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
          />
          {/* Diagonal reference (random classifier) */}
          <ReferenceLine segment={[{x:0,y:0},{x:1,y:1}]} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />

          {series.map(s => (
            <Line key={s.name} data={s.points} dataKey="tpr" name={s.name}
                  stroke={s.color} strokeWidth={2} dot={false} connectNulls
                  type="monotone" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── GLOBAL SHAP ─────────────────────────────────────────────────────────────── */
function SHAPGlobalChart({ data, champion }) {
  const top15 = data.slice(0, 15)

  return (
    <div className="card">
      <SectionHeader icon={BarChart2} title="Global Feature Importance (SHAP)"
                     subtitle={`Mean |SHAP value| across test set — Champion: ${champion}`} />

      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={top15} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 180 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }}
                 label={{ value: 'Mean |SHAP value|', position: 'insideBottom', offset: -2, fill: '#888', fontSize: 11 }} />
          <YAxis type="category" dataKey="friendly_name" width={175}
                 tick={{ fontSize: 11, fill: '#ccc' }} />
          <Tooltip
            formatter={(val) => [val.toFixed(5), 'Importance']}
            contentStyle={{ background: '#1a1d26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
          />
          <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
            {top15.map((entry, i) => {
              // Gradient: top features red, lower ones blue
              const ratio = 1 - i / top15.length
              const r = Math.round(91 + ratio * (224-91))
              const g = Math.round(138 - ratio * (138-82))
              const b = Math.round(240 - ratio * (240-82))
              return <Cell key={i} fill={`rgb(${r},${g},${b})`} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── CALIBRATION CURVE ───────────────────────────────────────────────────────── */
function CalibrationChart({ data }) {
  // Perfect calibration reference points
  const perfect = [{ x: 0, y: 0 }, { x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 },
                   { x: 0.3, y: 0.3 }, { x: 0.5, y: 0.5 }, { x: 0.7, y: 0.7 },
                   { x: 0.9, y: 0.9 }, { x: 1, y: 1 }]

  const series = data.map(m => ({
    name: m.model,
    color: MODEL_COLORS[m.model] || '#888',
    points: m.mean_pred.map((mp, i) => ({ x: mp, y: m.fraction_pos[i] })),
  }))

  return (
    <div className="card">
      <SectionHeader icon={Target} title="Calibration Curves"
                     subtitle="Predicted probability vs actual fraction positive — closer to diagonal = better calibrated" />

      <div className="flex gap-3 mb-5">
        {series.map(s => (
          <div key={s.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-panel border border-border/50 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-ghost">{s.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-panel border border-border/50 text-xs">
          <div className="w-2.5 h-0.5 bg-white/30" style={{ borderTop: '2px dashed rgba(255,255,255,0.3)' }} />
          <span className="text-muted">Perfect</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="x" type="number" domain={[0, 1]}
                 label={{ value: 'Mean Predicted Probability', position: 'insideBottom', offset: -10, fill: '#888', fontSize: 11 }}
                 tick={{ fontSize: 10, fill: '#888' }} />
          <YAxis type="number" domain={[0, 1]}
                 label={{ value: 'Fraction of Positives', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }}
                 tick={{ fontSize: 10, fill: '#888' }} />
          <Tooltip
            formatter={(val, name) => [val?.toFixed(3), name]}
            contentStyle={{ background: '#1a1d26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
          />
          {/* Perfect calibration line */}
          <Line data={perfect} dataKey="y" name="Perfect" stroke="rgba(255,255,255,0.2)"
                strokeDasharray="5 5" strokeWidth={1.5} dot={false} connectNulls type="linear" />

          {series.map(s => (
            <Line key={s.name} data={s.points} dataKey="y" name={s.name}
                  stroke={s.color} strokeWidth={2.5} dot={{ r: 4, fill: s.color }}
                  connectNulls type="linear" />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 p-3 bg-accent/5 border border-accent/20 rounded-lg text-xs text-ghost">
        <span className="text-accent font-semibold">Note:</span> Isotonic calibration (CalibratedClassifierCV) was applied
        to improve probability reliability post-training. Points on the diagonal indicate perfect calibration.
      </div>
    </div>
  )
}

/* ── CONFUSION MATRIX ────────────────────────────────────────────────────────── */
function ConfusionMatrix({ data }) {
  const cells = [
    { label: 'True Negative', count: data.TN, desc: 'Correctly predicted Graduate', color: '#3DBE7A', bg: 'rgba(61,190,122,0.12)', corner: 'top-left' },
    { label: 'False Positive', count: data.FP, desc: 'Graduate predicted as Dropout', color: '#E8A030', bg: 'rgba(232,160,48,0.12)', corner: 'top-right' },
    { label: 'False Negative', count: data.FN, desc: 'Dropout predicted as Graduate', color: '#E05252', bg: 'rgba(224,82,82,0.15)', corner: 'bottom-left' },
    { label: 'True Positive', count: data.TP, desc: 'Correctly predicted Dropout', color: '#5B8AF0', bg: 'rgba(91,138,240,0.12)', corner: 'bottom-right' },
  ]

  return (
    <div className="card">
      <SectionHeader icon={Grid} title="Confusion Matrix"
                     subtitle={`${data.model} at threshold ${(data.threshold*100).toFixed(1)}%`} />

      <div className="grid grid-cols-2 gap-1 mb-6 max-w-sm mx-auto">
        {/* Header row labels */}
        <div className="col-span-2 grid grid-cols-2 gap-1 mb-1">
          <div className="text-center text-xs text-muted py-1">Pred: Graduate</div>
          <div className="text-center text-xs text-muted py-1">Pred: Dropout</div>
        </div>

        {cells.map((cell, i) => (
          <div key={i} className="relative p-6 rounded-xl border text-center"
               style={{ background: cell.bg, borderColor: cell.color + '40' }}>
            <div className="text-3xl font-bold mb-1" style={{ color: cell.color }}>
              {cell.count.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-cream/80">{cell.label}</div>
            <div className="text-[10px] text-muted mt-1">{cell.desc}</div>
          </div>
        ))}
      </div>

      {/* Row labels */}
      <div className="text-xs text-muted text-center mb-6 -mt-2">
        Top row: Actual Graduate &nbsp;|&nbsp; Bottom row: Actual Dropout
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Precision', value: (data.precision*100).toFixed(1)+'%', color: '#5B8AF0', desc: 'Of predicted dropouts, % correct' },
          { label: 'Recall', value: (data.recall*100).toFixed(1)+'%', color: '#E8A030', desc: 'Of actual dropouts, % caught' },
          { label: 'F1 Score', value: (data.f1*100).toFixed(1)+'%', color: '#3DBE7A', desc: 'Harmonic mean of precision+recall' },
          { label: 'Accuracy', value: (data.accuracy*100).toFixed(1)+'%', color: '#E05252', desc: 'Overall correct predictions' },
          { label: 'Specificity', value: data.specificity ? (data.specificity*100).toFixed(1)+'%' : '—', color: '#5B8AF0', desc: 'True negative rate (graduates correctly identified)' },
          { label: 'NPV', value: data.npv ? (data.npv*100).toFixed(1)+'%' : '—', color: '#3DBE7A', desc: 'Negative predictive value (predicted graduates who actually graduate)' },
        ].map(m => (
          <div key={m.label} className="p-3 bg-panel rounded-lg border border-border/40 text-center">
            <div className="text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
            <div className="text-xs font-semibold text-cream/80 mt-0.5">{m.label}</div>
            <div className="text-[10px] text-muted mt-1">{m.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── MODEL COMPARISON TABLE ──────────────────────────────────────────────────── */
function ComparisonTable({ data }) {
  const best = data.reduce((a, b) => a.Test_ROC_AUC > b.Test_ROC_AUC ? a : b, data[0])

  return (
    <div className="card">
      <SectionHeader icon={BarChart2} title="Model Comparison"
                     subtitle="CV AUC uses SMOTE inside each fold (no leakage) · Test AUC on calibrated model" />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Model','CV AUC ↑','Test AUC ↑','F1 (Dropout) ↑','Precision ↑','Recall ↑','Accuracy ↑'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-ghost uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const isChamp = row.Model === best.Model
              return (
                <tr key={i} className={`border-b border-border/40 ${isChamp ? 'bg-accent/5' : 'hover:bg-panel/60'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: MODEL_COLORS[row.Model] || '#888' }} />
                      <span className="text-cream font-medium">{row.Model}</span>
                      {isChamp && <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">Champion</span>}
                    </div>
                  </td>
                  {[row.CV_ROC_AUC, row.Test_ROC_AUC, row.Dropout_F1, row.Dropout_Prec, row.Dropout_Recall, row.Accuracy].map((v, j) => (
                    <td key={j} className="px-4 py-3 font-mono text-cream/80">{v?.toFixed(4) ?? '—'}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-start gap-2 text-xs text-ghost bg-panel p-3 rounded-lg border border-border/30">
        <CheckCircle size={13} className="text-accent mt-0.5 shrink-0" />
        <span>
          CV AUC is computed with SMOTE applied <em>inside</em> each fold, preventing data leakage.
          Final model is wrapped with <code className="text-accent bg-accent/10 px-1 rounded">CalibratedClassifierCV(method="isotonic")</code> for reliable probabilities.
        </span>
      </div>
    </div>
  )
}

/* ── MAIN ────────────────────────────────────────────────────────────────────── */
export default function ModelInsights() {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [roc, setRoc] = useState(null)
  const [shapGlobal, setShapGlobal] = useState(null)
  const [calibration, setCalibration] = useState(null)
  const [confMatrix, setConfMatrix] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [prCurve, setPrCurve] = useState(null)
  const [smoteNote, setSmoteNote] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const [rocData, shapData, calData, cmData, cmpData, prData, smoteData] = await Promise.all([
          api.getRocCurve(token),
          api.getShapGlobal(token),
          api.getCalibration(token),
          api.getConfusionMatrix(token),
          api.getComparison(token),
          api.getPrecisionRecall(token).catch(()=>null),
          api.getSmoteNote(token).catch(()=>null),
        ])
        setRoc(rocData.roc_curves)
        setShapGlobal(shapData)
        setCalibration(calData.calibration_curves)
        setConfMatrix(cmData)
        setComparison(cmpData.models)
        if(prData) setPrCurve(prData.pr_curves)
        if(smoteData) setSmoteNote(smoteData)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken])

  if (loading) return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cream">Model Insights</h1>
        <p className="text-ghost text-sm">Loading ML diagnostics…</p>
      </div>
      {[1,2,3].map(i => <LoadingCard key={i} />)}
    </div>
  )

  if (error) return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-cream mb-4">Model Insights</h1>
      <ErrorCard msg={`Failed to load model data: ${error}. Make sure train_model.py has been run.`} />
    </div>
  )

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-cream">Model Insights</h1>
        <p className="text-ghost text-sm">Diagnostic charts for all 3 models — ROC, SHAP, Calibration, Confusion Matrix</p>
      </div>

      {comparison && <ComparisonTable data={comparison} />}
      {roc && <ROCChart data={roc} />}
      {shapGlobal && <SHAPGlobalChart data={shapGlobal.features} champion={shapGlobal.champion_model} />}
      {calibration && <CalibrationChart data={calibration} />}
      {confMatrix && <ConfusionMatrix data={confMatrix} />}
    </div>
  )
}
