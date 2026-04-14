import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { GitBranch, Loader2, CheckCircle, ArrowRight, AlertCircle, Lightbulb } from 'lucide-react'

const FEASIBILITY_COLOR = { High: 'text-safe', Medium: 'text-warn', Low: 'text-danger' }

function CounterfactualCard({ cf, index }) {
  return (
    <div className="card border border-white/10 hover:border-accent/30 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
            <span className="text-accent font-bold text-sm">{index + 1}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-cream">Scenario {index + 1}</h3>
            <p className={`text-[11px] font-medium ${FEASIBILITY_COLOR[cf.feasibility] || 'text-muted'}`}>
              {cf.feasibility} feasibility
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-safe">
            -{(cf.probability_change * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted">risk reduction</div>
        </div>
      </div>

      {/* Changes */}
      {cf.changes.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Required Changes</p>
          <div className="space-y-2">
            {cf.changes.map((change, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                <div className="flex-1">
                  <p className="text-xs font-medium text-cream">{change.friendly_name}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-danger line-through">{String(change.from)}</span>
                  <ArrowRight size={12} className="text-muted" />
                  <span className="text-safe font-medium">{String(change.to)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New probability */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${Math.round(cf.new_dropout_probability * 100)}%`,
              backgroundColor: cf.new_prediction === 'Dropout' ? '#E05252' : '#3DBE7A'
            }}
          />
        </div>
        <span className={`text-xs font-bold font-mono ${cf.new_prediction === 'Dropout' ? 'text-danger' : 'text-safe'}`}>
          {Math.round(cf.new_dropout_probability * 100)}% → {cf.new_prediction}
        </span>
      </div>

      {/* Action */}
      <div className="flex items-start gap-2 bg-accent/5 rounded-lg px-3 py-2 border border-accent/10">
        <Lightbulb size={13} className="text-accent shrink-0 mt-0.5" />
        <p className="text-[11px] text-ghost leading-relaxed">{cf.action}</p>
      </div>
    </div>
  )
}

// Minimal student form for quick counterfactual input
const DEFAULT_FORM = {
  student_id: '', student_name: '',
  marital_status: 1, age_at_enrollment: 20, gender: 1,
  application_mode: 1, application_order: 1, course: 9147,
  daytime_evening_attendance: 1, previous_qualification: 1,
  previous_qualification_grade: 12.0, nationality: 1,
  mothers_qualification: 1, fathers_qualification: 1,
  mothers_occupation: 4, fathers_occupation: 4,
  admission_grade: 12.0, displaced: 0, educational_special_needs: 0,
  debtor: 0, tuition_fees_up_to_date: 1, scholarship_holder: 0,
  international: 0,
  curricular_units_1st_sem_credited: 0, curricular_units_1st_sem_enrolled: 6,
  curricular_units_1st_sem_evaluations: 6, curricular_units_1st_sem_approved: 4,
  curricular_units_1st_sem_grade: 12.0, curricular_units_1st_sem_without_evaluations: 0,
  curricular_units_2nd_sem_credited: 0, curricular_units_2nd_sem_enrolled: 6,
  curricular_units_2nd_sem_evaluations: 6, curricular_units_2nd_sem_approved: 2,
  curricular_units_2nd_sem_grade: 10.0, curricular_units_2nd_sem_without_evaluations: 0,
  unemployment_rate: 10.8, inflation_rate: 1.4, gdp: 1.74,
}

export default function Counterfactuals() {
  const { getToken } = useAuth()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    ...DEFAULT_FORM,
    student_id: searchParams.get('student_id') || '',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const num = (v) => isNaN(parseFloat(v)) ? 0 : parseFloat(v)

  const submit = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const token = await getToken()
      const res = await api.getCounterfactuals(token, form, 'Graduate', 3)
      setResult(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cream flex items-center gap-3">
          <GitBranch className="text-accent" size={28} />Counterfactual Explanations
        </h1>
        <p className="text-ghost text-sm mt-1">
          "What would need to change for this student to graduate?" — AI-generated actionable scenarios
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Left: Input */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-cream mb-4">Student Information</h2>
            <div className="space-y-3">
              {[
                { key: 'student_id', label: 'Student ID', type: 'text' },
                { key: 'student_name', label: 'Student Name', type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-[11px] text-muted uppercase tracking-wider">{label}</label>
                  <input type={type} value={form[key]}
                         onChange={e => handleChange(key, e.target.value)}
                         className="input-field mt-1 text-xs w-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-cream mb-4">Key Academic Factors</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'curricular_units_2nd_sem_approved', label: 'Units Approved (Sem 2)' },
                { key: 'curricular_units_2nd_sem_grade', label: 'Grade Avg (Sem 2)' },
                { key: 'curricular_units_1st_sem_approved', label: 'Units Approved (Sem 1)' },
                { key: 'curricular_units_1st_sem_grade', label: 'Grade Avg (Sem 1)' },
                { key: 'age_at_enrollment', label: 'Age at Enrollment' },
                { key: 'admission_grade', label: 'Admission Grade' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[11px] text-muted">{label}</label>
                  <input type="number" value={form[key]}
                         onChange={e => handleChange(key, num(e.target.value))}
                         className="input-field mt-1 text-xs w-full" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              {[
                { key: 'tuition_fees_up_to_date', label: 'Tuition Paid', options: [[1,'Yes'],[0,'No']] },
                { key: 'scholarship_holder', label: 'Scholarship', options: [[1,'Yes'],[0,'No']] },
                { key: 'debtor', label: 'Outstanding Debt', options: [[0,'No'],[1,'Yes']] },
                { key: 'gender', label: 'Gender', options: [[1,'Male'],[0,'Female']] },
              ].map(({ key, label, options }) => (
                <div key={key}>
                  <label className="text-[11px] text-muted">{label}</label>
                  <select value={form[key]} onChange={e => handleChange(key, num(e.target.value))}
                          className="input-field mt-1 text-xs w-full">
                    {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button onClick={submit} disabled={loading}
                  className="btn-primary w-full text-sm flex items-center justify-center gap-2 py-3">
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Generating Scenarios...</>
              : <><GitBranch size={15} /> Generate Counterfactuals</>}
          </button>

          {error && (
            <div className="flex items-center gap-2 text-danger text-xs bg-danger/10 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div>
          {!result && !loading && (
            <div className="card h-full flex flex-col items-center justify-center text-center py-16">
              <GitBranch size={32} className="text-muted mb-4" />
              <h3 className="text-cream font-semibold mb-2">No Results Yet</h3>
              <p className="text-ghost text-xs">Fill in the student data and click Generate to see what changes could prevent dropout.</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Current state */}
              <div className="card border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted">Current Prediction</p>
                    <p className={`text-sm font-bold ${result.current_prediction === 'Dropout' ? 'text-danger' : 'text-safe'}`}>
                      {result.current_prediction}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Dropout Probability</p>
                    <p className="text-xl font-bold text-cream font-mono">
                      {Math.round(result.current_dropout_probability * 100)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Counterfactual cards */}
              {result.counterfactuals.map((cf, i) => (
                <CounterfactualCard key={cf.id} cf={cf} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
