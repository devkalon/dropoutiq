/**
 * Threshold Optimizer
 * Interactive slider — move threshold, see live precision/recall/F1 trade-off.
 * Uses the stored ROC + confusion matrix data. No extra API calls for each move.
 */
import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '../lib/api'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Legend
} from 'recharts'
import { Target, Info, Loader2 } from 'lucide-react'

function MetricCard({ label, value, color, desc }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-2xl font-bold font-mono mb-0.5" style={{ color }}>{value}</div>
      <div className="text-xs font-semibold text-cream/80">{label}</div>
      {desc && <div className="text-[10px] text-ghost mt-1">{desc}</div>}
    </div>
  )
}

export default function ThresholdOptimizer() {
  const { getToken } = useAuth()
  const [prCurves, setPrCurves] = useState(null)
  const [confMatrix, setConfMatrix] = useState(null)
  const [rocCurves, setRocCurves] = useState(null)
  const [loading, setLoading] = useState(true)
  const [threshold, setThreshold] = useState(50) // slider 0-100 → 0.0-1.0
  const [champion, setChampion] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const [pr, cm, roc, shap] = await Promise.all([
          api.getPrecisionRecall(token).catch(() => null),
          api.getConfusionMatrix(token),
          api.getRocCurve(token),
          api.getShapGlobal(token),
        ])
        setPrCurves(pr?.pr_curves || null)
        setConfMatrix(cm)
        setRocCurves(roc?.roc_curves || null)
        setChampion(shap?.champion_model)
        // Set slider to actual trained threshold
        if (cm?.threshold) setThreshold(Math.round(cm.threshold * 100))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [getToken])

  // Build F1/Precision/Recall vs Threshold chart from PR curve of champion
  const f1ChartData = useMemo(() => {
    if (!prCurves || !champion) return []
    const championCurve = prCurves.find(c => c.model === champion) || prCurves[0]
    if (!championCurve) return []
    const { precision, recall } = championCurve
    return recall.map((rec, i) => {
      const prec = precision[i]
      const f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0
      const thr = 1 - rec // approximate threshold from recall (monotone)
      return {
        threshold: Math.round(thr * 100),
        precision: Math.round(prec * 100),
        recall: Math.round(rec * 100),
        f1: Math.round(f1 * 100),
      }
    }).filter((d,i,a) => i === 0 || d.threshold !== a[i-1].threshold)
     .sort((a,b) => a.threshold - b.threshold)
  }, [prCurves, champion])

  // Approximate metrics at slider threshold by interpolating PR curve
  const metricsAtThreshold = useMemo(() => {
    if (f1ChartData.length === 0) return null
    const t = threshold
    // Find nearest point
    let closest = f1ChartData[0]
    for (const d of f1ChartData) {
      if (Math.abs(d.threshold - t) < Math.abs(closest.threshold - t)) closest = d
    }
    return closest
  }, [f1ChartData, threshold])

  // Real confusion matrix metrics at the actual trained threshold
  const actualThreshold = confMatrix ? Math.round(confMatrix.threshold * 100) : 50
  const atActual = useMemo(() => {
    if (!confMatrix) return null
    return {
      precision: Math.round(confMatrix.precision * 100),
      recall: Math.round(confMatrix.recall * 100),
      f1: Math.round(confMatrix.f1 * 100),
      accuracy: Math.round(confMatrix.accuracy * 100),
      specificity: Math.round((confMatrix.specificity || 0) * 100),
    }
  }, [confMatrix])

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <Loader2 className="animate-spin text-accent" size={24} />
    </div>
  )

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-cream flex items-center gap-3">
          <Target size={28} className="text-accent" /> Threshold Optimizer
        </h1>
        <p className="text-ghost text-sm mt-1">
          Explore the precision–recall trade-off by moving the decision threshold.
          The model was trained with an F1-optimized threshold.
        </p>
      </div>

      {/* Current trained threshold metrics */}
      {atActual && (
        <div>
          <div className="text-xs text-ghost uppercase tracking-wider mb-3 font-mono">
            ✅ Current Trained Threshold — {actualThreshold}% (F1-optimized)
          </div>
          <div className="grid grid-cols-5 gap-3">
            <MetricCard label="Precision" value={`${atActual.precision}%`} color="#5B8AF0"
              desc="Of predicted dropouts, % correct" />
            <MetricCard label="Recall" value={`${atActual.recall}%`} color="#E8A030"
              desc="Of actual dropouts, % caught" />
            <MetricCard label="F1 Score" value={`${atActual.f1}%`} color="#3DBE7A"
              desc="Harmonic mean P+R" />
            <MetricCard label="Accuracy" value={`${atActual.accuracy}%`} color="#E05252"
              desc="Overall correct" />
            <MetricCard label="Specificity" value={`${atActual.specificity}%`} color="#9B8AF0"
              desc="True negative rate" />
          </div>
        </div>
      )}

      {/* Interactive slider */}
      {f1ChartData.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-cream">Interactive Threshold Explorer</h2>
            <div className="flex items-center gap-3">
              <span className="text-ghost text-sm">Threshold:</span>
              <span className="text-2xl font-bold font-mono text-accent">{threshold}%</span>
              <button onClick={() => setThreshold(actualThreshold)}
                className="btn-ghost text-xs flex items-center gap-1">
                <Target size={12} /> Reset to Optimal
              </button>
            </div>
          </div>

          <input type="range" min={5} max={95} step={1}
            value={threshold}
            onChange={e => setThreshold(parseInt(e.target.value))}
            className="w-full h-2 rounded accent-accent mb-6"
          />

          {metricsAtThreshold && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-4 bg-panel rounded-xl text-center border border-border/30">
                <div className="text-2xl font-bold font-mono text-[#5B8AF0]">{metricsAtThreshold.precision}%</div>
                <div className="text-xs text-cream/80 font-medium mt-0.5">Precision</div>
                <div className="text-[10px] text-ghost mt-1">
                  {metricsAtThreshold.precision > (atActual?.precision || 0) ? '▲ Higher than optimal' : '▼ Lower than optimal'}
                </div>
              </div>
              <div className="p-4 bg-panel rounded-xl text-center border border-border/30">
                <div className="text-2xl font-bold font-mono text-[#E8A030]">{metricsAtThreshold.recall}%</div>
                <div className="text-xs text-cream/80 font-medium mt-0.5">Recall</div>
                <div className="text-[10px] text-ghost mt-1">
                  {metricsAtThreshold.recall > (atActual?.recall || 0) ? '▲ More dropouts caught' : '▼ Fewer dropouts caught'}
                </div>
              </div>
              <div className="p-4 bg-panel rounded-xl text-center border border-border/30">
                <div className="text-2xl font-bold font-mono text-[#3DBE7A]">{metricsAtThreshold.f1}%</div>
                <div className="text-xs text-cream/80 font-medium mt-0.5">F1 Score</div>
                <div className="text-[10px] text-ghost mt-1">
                  {metricsAtThreshold.f1 >= (atActual?.f1 || 0) ? '✅ At or above optimal' : `▼ ${(atActual?.f1 || 0) - metricsAtThreshold.f1}pts below optimal`}
                </div>
              </div>
            </div>
          )}

          {/* Trade-off explanation */}
          <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 text-xs text-ghost flex gap-2">
            <Info size={13} className="text-accent mt-0.5 shrink-0" />
            <span>
              <span className="text-accent font-semibold">Trade-off: </span>
              Lower threshold → higher recall (catch more dropouts) but more false alarms.
              Higher threshold → higher precision (fewer false alarms) but miss more at-risk students.
              The trained threshold ({actualThreshold}%) was chosen to maximize F1.
            </span>
          </div>
        </div>
      )}

      {/* F1/Precision/Recall vs Threshold chart */}
      {f1ChartData.length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-cream mb-5">
            Precision / Recall / F1 vs Threshold
            {champion && <span className="text-xs text-ghost ml-2">({champion})</span>}
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={f1ChartData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="threshold" type="number" domain={[0, 100]}
                label={{ value: 'Threshold (%)', position: 'insideBottom', offset: -10, fill: '#888', fontSize: 11 }}
                tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }}
                label={{ value: 'Score (%)', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }} />
              <Tooltip
                formatter={(val, name) => [`${val}%`, name]}
                contentStyle={{ background: '#1a1d26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
              />
              <Legend />
              <ReferenceLine x={threshold} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4"
                label={{ value: `Current: ${threshold}%`, fill: '#888', fontSize: 10 }} />
              <ReferenceLine x={actualThreshold} stroke="#5B8AF0" strokeDasharray="2 2"
                label={{ value: `Optimal: ${actualThreshold}%`, fill: '#5B8AF0', fontSize: 10 }} />
              <Line type="monotone" dataKey="precision" name="Precision" stroke="#5B8AF0" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="recall" name="Recall" stroke="#E8A030" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="f1" name="F1 Score" stroke="#3DBE7A" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* PR Curve */}
      {prCurves && (
        <div className="card">
          <h2 className="text-base font-semibold text-cream mb-2">Precision–Recall Curves — All Models</h2>
          <p className="text-xs text-ghost mb-5">Higher area under PR curve = better performance on imbalanced classes</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="recall" type="number" domain={[0,1]}
                label={{ value: 'Recall', position: 'insideBottom', offset: -10, fill: '#888', fontSize: 11 }}
                tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis type="number" domain={[0,1]}
                label={{ value: 'Precision', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }}
                tick={{ fontSize: 10, fill: '#888' }} />
              <Tooltip
                formatter={(val,name) => [val?.toFixed(3), name]}
                contentStyle={{ background:'#1a1d26', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:11 }}
              />
              <Legend />
              {prCurves.map((m, i) => {
                const colors = ['#5B8AF0','#E8A030','#3DBE7A']
                const points = m.recall.map((r,j) => ({ recall: r, precision: m.precision[j] }))
                return (
                  <Line key={m.model} data={points} dataKey="precision" name={`${m.model} (AP=${m.avg_precision})`}
                    stroke={colors[i % colors.length]} strokeWidth={2} dot={false} connectNulls type="monotone" />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Note */}
      <div className="p-4 bg-panel rounded-xl border border-border/30 text-xs text-ghost">
        <span className="text-accent font-semibold">Academic note: </span>
        The decision threshold was optimized on the held-out test set (20% of data) using
        the F1 score — balancing false negatives (missed dropouts) and false positives
        (unnecessary interventions). SMOTE was applied inside each CV fold only, not before splitting,
        ensuring no data leakage in the CV AUC estimates.
      </div>
    </div>
  )
}
