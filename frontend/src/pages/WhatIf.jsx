/**
 * What-If Simulator
 * Lets users tweak key features and instantly re-predict without full form submit.
 * Shows delta vs original prediction in real time.
 */
import { useState, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api } from '../lib/api'
import ProbabilityGauge from '../components/ProbabilityGauge'
import RiskBadge from '../components/RiskBadge'
import { Sliders, RefreshCw, Loader2, ArrowUp, ArrowDown } from 'lucide-react'

const TWEAKABLE = [
  { key: 'curricular_units_1st_sem_approved', label: 'Sem 1 Units Passed', min: 0, max: 10, step: 1, type: 'number' },
  { key: 'curricular_units_2nd_sem_approved', label: 'Sem 2 Units Passed', min: 0, max: 10, step: 1, type: 'number' },
  { key: 'curricular_units_1st_sem_grade',    label: 'Sem 1 Grade (0–20)',  min: 0, max: 20, step: 0.5, type: 'range' },
  { key: 'curricular_units_2nd_sem_grade',    label: 'Sem 2 Grade (0–20)',  min: 0, max: 20, step: 0.5, type: 'range' },
  { key: 'tuition_fees_up_to_date', label: 'Tuition Paid?', type: 'toggle', onLabel: 'Yes', offLabel: 'No' },
  { key: 'debtor',                  label: 'Has Outstanding Debt?', type: 'toggle', onLabel: 'Yes', offLabel: 'No' },
  { key: 'scholarship_holder',      label: 'Scholarship Holder?', type: 'toggle', onLabel: 'Yes', offLabel: 'No' },
  { key: 'age_at_enrollment',       label: 'Age at Enrollment', min: 17, max: 60, step: 1, type: 'number' },
  { key: 'curricular_units_1st_sem_enrolled', label: 'Sem 1 Enrolled', min: 0, max: 10, step: 1, type: 'number' },
  { key: 'curricular_units_2nd_sem_enrolled', label: 'Sem 2 Enrolled', min: 0, max: 10, step: 1, type: 'number' },
  { key: 'unemployment_rate',       label: 'Unemployment Rate (%)', min: 0, max: 25, step: 0.5, type: 'range' },
  { key: 'gdp',                     label: 'GDP Growth Rate',       min: -5, max: 5, step: 0.1, type: 'range' },
]

const DEFAULT_BASE = {
  marital_status: 1, age_at_enrollment: 20, gender: 1, international: 0, displaced: 0,
  educational_special_needs: 0, application_mode: 1, application_order: 1, course: 9147,
  daytime_evening_attendance: 1, previous_qualification: 1, previous_qualification_grade: 122,
  nationality: 1, mothers_qualification: 1, fathers_qualification: 1,
  mothers_occupation: 0, fathers_occupation: 0, admission_grade: 127,
  debtor: 0, tuition_fees_up_to_date: 1, scholarship_holder: 0,
  curricular_units_1st_sem_credited: 0, curricular_units_1st_sem_enrolled: 6,
  curricular_units_1st_sem_evaluations: 6, curricular_units_1st_sem_approved: 5,
  curricular_units_1st_sem_grade: 13, curricular_units_1st_sem_without_evaluations: 0,
  curricular_units_2nd_sem_credited: 0, curricular_units_2nd_sem_enrolled: 6,
  curricular_units_2nd_sem_evaluations: 6, curricular_units_2nd_sem_approved: 5,
  curricular_units_2nd_sem_grade: 13, curricular_units_2nd_sem_without_evaluations: 0,
  unemployment_rate: 10.8, inflation_rate: 1.4, gdp: 1.74,
}

function DeltaBadge({ base, current }) {
  const delta = current - base
  if (Math.abs(delta) < 0.001) return <span className="text-ghost text-xs">—</span>
  const up = delta > 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-mono ${up ? 'text-safe' : 'text-danger'}`}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {up ? '+' : ''}{typeof delta === 'number' && !Number.isInteger(delta) ? delta.toFixed(1) : delta}
    </span>
  )
}

function ProbDelta({ base, current }) {
  const diff = Math.round((current - base) * 100)
  if (diff === 0) return <span className="text-ghost text-xs font-mono">±0%</span>
  const up = diff > 0
  return (
    <span className={`font-mono font-bold text-lg ${up ? 'text-danger' : 'text-safe'}`}>
      {up ? '+' : ''}{diff}%
    </span>
  )
}

export default function WhatIf() {
  const { getToken } = useAuth()
  const [base, setBase] = useState(DEFAULT_BASE)
  const [tweaks, setTweaks] = useState({})
  const [baseResult, setBaseResult] = useState(null)
  const [tweakResult, setTweakResult] = useState(null)
  const [loadingTweak, setLoadingTweak] = useState(false)
  const [baseLoading, setBaseLoading] = useState(false)
  const [error, setError] = useState(null)

  const current = { ...base, ...tweaks }

  const runBase = useCallback(async () => {
    setBaseLoading(true); setError(null)
    try {
      const token = await getToken()
      const res = await api.predict(base, token)
      setBaseResult(res); setTweakResult(null); setTweaks({})
    } catch (e) { setError(e.message) }
    finally { setBaseLoading(false) }
  }, [base, getToken])

  const runTweak = useCallback(async () => {
    if (!baseResult) return
    setLoadingTweak(true)
    try {
      const token = await getToken()
      const res = await api.predict(current, token)
      setTweakResult(res)
    } catch (e) { setError(e.message) }
    finally { setLoadingTweak(false) }
  }, [current, baseResult, getToken])

  const setTweak = (key, val) => {
    setTweaks(t => ({ ...t, [key]: val }))
  }

  const resetTweaks = () => { setTweaks({}); setTweakResult(null) }

  const hasTweaks = Object.keys(tweaks).length > 0

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cream flex items-center gap-3">
          <Sliders size={28} className="text-accent" /> What-If Simulator
        </h1>
        <p className="text-ghost text-sm mt-1">
          Set a baseline prediction, then tweak factors to see how risk changes in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT — Baseline + tweaks */}
        <div className="lg:col-span-2 space-y-5">

          {/* Step 1 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-accent font-mono uppercase tracking-wider mb-0.5">Step 1</div>
                <h2 className="text-base font-semibold text-cream">Set Baseline Student</h2>
                <p className="text-xs text-ghost mt-0.5">Uses default average student profile. Run prediction first.</p>
              </div>
              <button onClick={runBase} disabled={baseLoading}
                className="btn-primary flex items-center gap-2 text-sm">
                {baseLoading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                {baseResult ? 'Re-run Baseline' : 'Run Baseline'}
              </button>
            </div>

            {baseResult && (
              <div className="flex items-center gap-4 p-3 bg-panel rounded-lg border border-border/30">
                <div className="text-center">
                  <div className="text-2xl font-bold text-cream">{Math.round(baseResult.dropout_probability * 100)}%</div>
                  <div className="text-xs text-ghost">Baseline Risk</div>
                </div>
                <div className="w-px h-10 bg-border" />
                <RiskBadge level={baseResult.risk_level} />
                <div className="w-px h-10 bg-border" />
                <div className="text-xs text-ghost flex-1">
                  <span className="text-cream font-medium">{baseResult.model_used}</span> at threshold{' '}
                  <span className="font-mono text-accent">{(baseResult.decision_threshold * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2 — Tweaks */}
          {baseResult && (
            <div className="card">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-xs text-accent font-mono uppercase tracking-wider mb-0.5">Step 2</div>
                  <h2 className="text-base font-semibold text-cream">Adjust Factors</h2>
                  <p className="text-xs text-ghost mt-0.5">Move sliders or toggles, then press "Simulate"</p>
                </div>
                {hasTweaks && (
                  <button onClick={resetTweaks} className="btn-ghost text-xs flex items-center gap-1">
                    <RefreshCw size={12} /> Reset
                  </button>
                )}
              </div>

              <div className="space-y-5">
                {TWEAKABLE.map(f => {
                  const val = tweaks[f.key] !== undefined ? tweaks[f.key] : base[f.key]
                  const changed = tweaks[f.key] !== undefined
                  return (
                    <div key={f.key} className={`p-3 rounded-lg border transition-all ${changed ? 'border-accent/40 bg-accent/5' : 'border-border/30 bg-transparent'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm text-cream font-medium">{f.label}</label>
                        <div className="flex items-center gap-2">
                          {changed && <DeltaBadge base={base[f.key]} current={val} />}
                          <span className="text-xs font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                            {f.type === 'toggle' ? (val ? f.onLabel : f.offLabel) : val}
                          </span>
                        </div>
                      </div>

                      {f.type === 'toggle' ? (
                        <div className="flex gap-2">
                          {[0, 1].map(v => (
                            <button key={v}
                              onClick={() => setTweak(f.key, v)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${val === v ? 'bg-accent text-white' : 'bg-panel text-ghost hover:bg-accent/20'}`}>
                              {v === 1 ? f.onLabel : f.offLabel}
                            </button>
                          ))}
                        </div>
                      ) : f.type === 'range' ? (
                        <input type="range" min={f.min} max={f.max} step={f.step}
                          value={val}
                          onChange={e => setTweak(f.key, parseFloat(e.target.value))}
                          className="w-full accent-accent h-1.5 rounded"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setTweak(f.key, Math.max(f.min, val - f.step))}
                            className="w-7 h-7 rounded bg-panel hover:bg-accent/20 text-cream flex items-center justify-center text-sm">−</button>
                          <input type="range" min={f.min} max={f.max} step={f.step}
                            value={val}
                            onChange={e => setTweak(f.key, parseInt(e.target.value))}
                            className="flex-1 accent-accent h-1.5 rounded"
                          />
                          <button onClick={() => setTweak(f.key, Math.min(f.max, val + f.step))}
                            className="w-7 h-7 rounded bg-panel hover:bg-accent/20 text-cream flex items-center justify-center text-sm">+</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-5">
                <button onClick={runTweak} disabled={loadingTweak || !hasTweaks}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  {loadingTweak ? <Loader2 className="animate-spin" size={14} /> : <Sliders size={14} />}
                  Simulate Changes
                </button>
                {!hasTweaks && (
                  <p className="text-xs text-ghost text-center mt-2">Adjust at least one factor above</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-danger-dim text-danger p-3 rounded text-sm">{error}</div>
          )}
        </div>

        {/* RIGHT — Results comparison */}
        <div className="lg:col-span-1 space-y-5">

          {!baseResult ? (
            <div className="card border-dashed border-border/50 text-center py-20 px-6">
              <Sliders size={40} className="mx-auto text-muted mb-4 opacity-80" />
              <p className="text-cream font-medium mb-1">Run Baseline First</p>
              <p className="text-xs text-muted">Set your baseline student and run prediction, then tweak factors</p>
            </div>
          ) : (
            <>
              {/* Baseline card */}
              <div className="card border-border/40">
                <div className="text-xs text-ghost uppercase tracking-wider mb-3 font-mono">Baseline</div>
                <div className="flex flex-col items-center">
                  <ProbabilityGauge probability={baseResult.dropout_probability} />
                  <RiskBadge level={baseResult.risk_level} />
                  <div className="text-sm font-bold text-cream mt-2">{baseResult.prediction}</div>
                </div>
              </div>

              {/* Arrow + delta */}
              {tweakResult && (
                <>
                  <div className="text-center">
                    <div className="text-xs text-ghost mb-1">Risk change</div>
                    <ProbDelta base={baseResult.dropout_probability} current={tweakResult.dropout_probability} />
                    <div className="text-xs text-ghost mt-1">dropout probability</div>
                  </div>

                  {/* Tweaked card */}
                  <div className={`card border ${
                    tweakResult.dropout_probability < baseResult.dropout_probability
                      ? 'border-safe/40 bg-safe/5' : tweakResult.dropout_probability > baseResult.dropout_probability
                      ? 'border-danger/40 bg-danger/5' : 'border-border/40'
                  }`}>
                    <div className="text-xs text-ghost uppercase tracking-wider mb-3 font-mono">With Changes</div>
                    <div className="flex flex-col items-center">
                      <ProbabilityGauge probability={tweakResult.dropout_probability} />
                      <RiskBadge level={tweakResult.risk_level} />
                      <div className="text-sm font-bold text-cream mt-2">{tweakResult.prediction}</div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="card bg-panel/50">
                    <div className="text-xs font-semibold text-cream mb-3">Changes Made</div>
                    <div className="space-y-2">
                      {Object.entries(tweaks).map(([k, v]) => {
                        const field = TWEAKABLE.find(f => f.key === k)
                        return (
                          <div key={k} className="flex justify-between items-center text-xs">
                            <span className="text-ghost">{field?.label || k}</span>
                            <span className="font-mono text-cream">
                              {base[k]} → <span className="text-accent">{v}</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Risk factor changes */}
                  {tweakResult.risk_factors?.length > 0 && (
                    <div className="card">
                      <div className="text-xs font-semibold text-cream mb-3">New Top Risk Drivers</div>
                      <div className="space-y-1.5">
                        {tweakResult.risk_factors.slice(0, 4).map((f, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-ghost truncate pr-2">{f.friendly_name}</span>
                            <span className="font-mono text-danger shrink-0">+{(Math.abs(f.shap_value)*100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Waiting for simulate */}
              {!tweakResult && hasTweaks && (
                <div className="card border-dashed border-accent/30 text-center py-10">
                  <Sliders size={24} className="mx-auto text-accent mb-2 opacity-70" />
                  <p className="text-xs text-ghost">Press "Simulate Changes" to see impact</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
