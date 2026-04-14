import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api, downloadBlob } from '../lib/api'
import ProbabilityGauge from '../components/ProbabilityGauge'
import RiskBadge from '../components/RiskBadge'
import {
  Brain, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Loader2, FileDown, Info
} from 'lucide-react'
import clsx from 'clsx'

/* ── Label maps for UX (no more raw code numbers!) ─────────────────────────── */
const MARITAL_STATUS = [{v:1,l:"Single"},{v:2,l:"Married"},{v:3,l:"Widower"},{v:4,l:"Divorced"},{v:5,l:"Facto Union"},{v:6,l:"Legally Separated"}]
const ATTENDANCE = [{v:1,l:"Daytime"},{v:0,l:"Evening"}]
const YES_NO = [{v:0,l:"No"},{v:1,l:"Yes"}]
const YES_NO_REV = [{v:1,l:"Yes"},{v:0,l:"No"}]
const GENDER = [{v:1,l:"Male"},{v:0,l:"Female"}]
const TUITION = [{v:1,l:"Yes, paid up"},{v:0,l:"No, overdue"}]
const COURSES = [
  {v:33,l:"Biofuel Production Technologies"},{v:171,l:"Animation and Multimedia Design"},
  {v:8014,l:"Social Service (evening)"},{v:9003,l:"Agronomy"},{v:9070,l:"Communication Design"},
  {v:9085,l:"Veterinary Nursing"},{v:9119,l:"Informatics Engineering"},{v:9130,l:"Equinculture"},
  {v:9147,l:"Management"},{v:9238,l:"Social Service"},{v:9254,l:"Tourism"},{v:9500,l:"Nursing"},
  {v:9556,l:"Oral Hygiene"},{v:9670,l:"Advertising and Marketing Management"},
  {v:9773,l:"Journalism and Communication"},{v:9853,l:"Basic Education"},
  {v:9991,l:"Management (evening)"},
]
const APPLICATION_MODE = [
  {v:1,l:"1st phase - general"},{v:2,l:"Ordinance 612/93"},{v:5,l:"1st phase - Azores"},
  {v:7,l:"Holders of higher courses"},{v:10,l:"Ordinance 854-B/99"},{v:15,l:"International (bachelor)"},
  {v:16,l:"1st phase - Madeira"},{v:17,l:"2nd phase - general"},{v:18,l:"3rd phase - general"},
  {v:39,l:"Over 23 years old"},{v:42,l:"Transfer"},{v:43,l:"Change of course"},
  {v:44,l:"Tech specialization diploma"},{v:51,l:"Change of institution"},{v:53,l:"Short cycle diploma"},
  {v:57,l:"Change of institution (International)"},
]
const PREV_QUAL = [
  {v:1,l:"Secondary education"},{v:2,l:"Bachelor's degree"},{v:3,l:"Degree"},{v:4,l:"Master's"},
  {v:5,l:"Doctorate"},{v:6,l:"Higher education frequency"},{v:9,l:"12th year - not completed"},
  {v:10,l:"11th year - not completed"},{v:14,l:"10th year"},{v:19,l:"Basic 3rd cycle"},
  {v:38,l:"Basic 2nd cycle"},{v:39,l:"Technological specialization"},{v:40,l:"Degree 1st cycle"},
  {v:42,l:"Professional higher technical"},{v:43,l:"Master 2nd cycle"},
]
const QUALIFICATION = [
  {v:1,l:"Secondary Education"},{v:2,l:"Bachelor's"},{v:3,l:"Degree"},{v:4,l:"Master's"},
  {v:5,l:"Doctorate"},{v:6,l:"Higher education frequency"},{v:9,l:"12th year incomplete"},
  {v:10,l:"11th year incomplete"},{v:19,l:"Basic 3rd cycle"},{v:34,l:"Unknown"},
  {v:35,l:"Cannot read or write"},{v:37,l:"Basic 1st cycle"},{v:38,l:"Basic 2nd cycle"},
  {v:40,l:"Degree 1st cycle"},{v:43,l:"Master 2nd cycle"},{v:44,l:"Doctorate 3rd cycle"},
]
const OCCUPATION = [
  {v:0,l:"Student"},{v:1,l:"Executive/Director"},{v:2,l:"Intellectual/Scientific"},
  {v:3,l:"Technical/Associate Prof"},{v:4,l:"Administrative"},{v:5,l:"Services/Security"},
  {v:6,l:"Agriculture/Fishing"},{v:7,l:"Skilled Trades"},{v:8,l:"Machine Operators"},
  {v:9,l:"Unskilled Workers"},{v:10,l:"Armed Forces"},{v:90,l:"Other"},{v:99,l:"Blank/Unknown"},
  {v:122,l:"Healthcare"},{v:123,l:"Teachers"},{v:131,l:"Science Technicians"},
  {v:132,l:"Health Technicians"},{v:141,l:"Office Assistants"},{v:151,l:"Personal care"},
  {v:152,l:"Sellers"},{v:171,l:"Construction"},{v:172,l:"Metalworking"},
  {v:191,l:"Cleaning workers"},{v:192,l:"Unskilled agriculture"},
]
const NATIONALITY = [
  {v:1,l:"Portuguese"},{v:2,l:"German"},{v:6,l:"Spanish"},{v:11,l:"Italian"},{v:13,l:"Dutch"},
  {v:14,l:"English"},{v:17,l:"Lithuanian"},{v:21,l:"Angolan"},{v:22,l:"Cape Verdean"},
  {v:24,l:"Guinean"},{v:25,l:"Mozambican"},{v:26,l:"Santomean"},{v:32,l:"Turkish"},
  {v:41,l:"Brazilian"},{v:62,l:"Romanian"},{v:100,l:"Moldovan"},{v:101,l:"Mexican"},
  {v:103,l:"Ukrainian"},{v:105,l:"Russian"},{v:108,l:"Cuban"},{v:109,l:"Colombian"},
]

const SECTIONS = [
  {
    title: 'Personal Information',
    fields: [
      { key: 'student_name', label: 'Student Name (Optional)', type: 'text', defaultValue: '' },
      { key: 'student_id', label: 'Student ID (Optional)', type: 'text', defaultValue: '' },
      { key: 'age_at_enrollment', label: 'Age at Enrollment (Years)', type: 'number', defaultValue: 20, min: 15, max: 70 },
      { key: 'gender', label: 'Gender', type: 'select', defaultValue: 1, options: GENDER },
      { key: 'marital_status', label: 'Marital Status', type: 'select', defaultValue: 1, options: MARITAL_STATUS },
      { key: 'nationality', label: 'Nationality', type: 'select', defaultValue: 1, options: NATIONALITY },
      { key: 'international', label: 'International Student', type: 'select', defaultValue: 0, options: YES_NO },
      { key: 'displaced', label: 'Displaced Student', type: 'select', defaultValue: 0, options: YES_NO },
      { key: 'educational_special_needs', label: 'Special Educational Needs', type: 'select', defaultValue: 0, options: YES_NO },
    ],
  },
  {
    title: 'Academic Background',
    fields: [
      { key: 'course', label: 'Course', type: 'select', defaultValue: 9147, options: COURSES },
      { key: 'application_mode', label: 'Application Mode', type: 'select', defaultValue: 1, options: APPLICATION_MODE },
      { key: 'application_order', label: 'Application Order (1 = 1st choice)', type: 'number', defaultValue: 1, min: 0, max: 9 },
      { key: 'daytime_evening_attendance', label: 'Attendance Type', type: 'select', defaultValue: 1, options: ATTENDANCE },
      { key: 'previous_qualification', label: 'Previous Qualification', type: 'select', defaultValue: 1, options: PREV_QUAL },
      { key: 'previous_qualification_grade', label: 'Prev. Qualification Grade (0–200)', type: 'number', defaultValue: 122, min: 0, max: 200, step: 0.1 },
      { key: 'admission_grade', label: 'Admission Grade (0–200)', type: 'number', defaultValue: 127, min: 0, max: 200, step: 0.1 },
    ],
  },
  {
    title: 'Family & Socioeconomic Background',
    fields: [
      { key: 'mothers_qualification', label: "Mother's Qualification", type: 'select', defaultValue: 1, options: QUALIFICATION },
      { key: 'fathers_qualification', label: "Father's Qualification", type: 'select', defaultValue: 1, options: QUALIFICATION },
      { key: 'mothers_occupation', label: "Mother's Occupation", type: 'select', defaultValue: 0, options: OCCUPATION },
      { key: 'fathers_occupation', label: "Father's Occupation", type: 'select', defaultValue: 0, options: OCCUPATION },
    ],
  },
  {
    title: 'Financial Status',
    fields: [
      { key: 'tuition_fees_up_to_date', label: 'Tuition Fees Paid?', type: 'select', defaultValue: 1, options: TUITION },
      { key: 'debtor', label: 'Outstanding Debt', type: 'select', defaultValue: 0, options: YES_NO },
      { key: 'scholarship_holder', label: 'Scholarship Holder', type: 'select', defaultValue: 0, options: YES_NO },
    ],
  },
  {
    title: 'Semester 1 Performance',
    fields: [
      { key: 'curricular_units_1st_sem_enrolled', label: 'Units Enrolled', type: 'number', defaultValue: 6, min: 0 },
      { key: 'curricular_units_1st_sem_approved', label: 'Units Passed', type: 'number', defaultValue: 5, min: 0 },
      { key: 'curricular_units_1st_sem_evaluations', label: 'Units Evaluated', type: 'number', defaultValue: 6, min: 0 },
      { key: 'curricular_units_1st_sem_grade', label: 'Grade Average (0–20)', type: 'number', defaultValue: 12, min: 0, max: 20, step: 0.1, important: true },
      { key: 'curricular_units_1st_sem_credited', label: 'Units Credited', type: 'number', defaultValue: 0, min: 0 },
      { key: 'curricular_units_1st_sem_without_evaluations', label: 'Units Without Evaluation', type: 'number', defaultValue: 0, min: 0 },
    ],
  },
  {
    title: 'Semester 2 Performance',
    fields: [
      { key: 'curricular_units_2nd_sem_enrolled', label: 'Units Enrolled', type: 'number', defaultValue: 6, min: 0 },
      { key: 'curricular_units_2nd_sem_approved', label: 'Units Passed', type: 'number', defaultValue: 5, min: 0 },
      { key: 'curricular_units_2nd_sem_evaluations', label: 'Units Evaluated', type: 'number', defaultValue: 6, min: 0 },
      { key: 'curricular_units_2nd_sem_grade', label: 'Grade Average (0–20)', type: 'number', defaultValue: 12, min: 0, max: 20, step: 0.1, important: true },
      { key: 'curricular_units_2nd_sem_credited', label: 'Units Credited', type: 'number', defaultValue: 0, min: 0 },
      { key: 'curricular_units_2nd_sem_without_evaluations', label: 'Units Without Evaluation', type: 'number', defaultValue: 0, min: 0 },
    ],
  },
  {
    title: 'Economic Factors',
    fields: [
      { key: 'unemployment_rate', label: 'Unemployment Rate (%)', type: 'number', defaultValue: 10.8, step: 0.1 },
      { key: 'inflation_rate', label: 'Inflation Rate (%)', type: 'number', defaultValue: 1.4, step: 0.1 },
      { key: 'gdp', label: 'GDP Growth Rate', type: 'number', defaultValue: 1.74, step: 0.01 },
    ],
  },
]

const DEFAULT_FORM = Object.fromEntries(
  SECTIONS.flatMap(s => s.fields).map(f => [f.key, f.defaultValue])
)

function FormSection({ section, values, onChange, open, onToggle }) {
  return (
    <div className="card mb-4 transition-all duration-300 hover:shadow-lg hover:border-accent/40">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between group">
        <span className="font-display font-semibold text-cream group-hover:text-accent transition-colors">
          {section.title}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="mt-6 grid grid-cols-2 gap-6 animate-fade-up">
          {section.fields.map(field => (
            <div key={field.key} className="space-y-1">
              <label className="label flex items-center gap-1">
                {field.label}
                {field.important && <span className="text-[10px] text-accent">(key factor)</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  className="input-field focus:ring-2 focus:ring-accent/40 focus:scale-[1.01] transition-all"
                  value={values[field.key]}
                  onChange={e => onChange(field.key, Number(e.target.value))}
                >
                  {field.options.map(opt => (
                    <option key={opt.v} value={opt.v}>{opt.l}</option>
                  ))}
                </select>
              ) : field.type === 'text' ? (
                <input type="text"
                  className="input-field focus:ring-2 focus:ring-accent/40 focus:scale-[1.01] transition-all"
                  value={values[field.key]}
                  onChange={e => onChange(field.key, e.target.value)}
                />
              ) : (
                <input type="number"
                  className="input-field focus:ring-2 focus:ring-accent/40 focus:scale-[1.01] transition-all"
                  value={values[field.key]}
                  min={field.min} max={field.max} step={field.step || 1}
                  onChange={e => onChange(field.key, parseFloat(e.target.value))}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SHAPBar({ value, max }) {
  const pct = Math.min(Math.abs(value) / Math.max(max, 0.001) * 100, 100)
  return (
    <div className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: value > 0 ? '#E05252' : '#3DBE7A' }}
      />
    </div>
  )
}

function InterventionBadge({ score }) {
  const color = score >= 70 ? 'text-danger bg-danger/10 border-danger/30'
    : score >= 45 ? 'text-warn bg-warn/10 border-warn/30'
    : 'text-safe bg-safe/10 border-safe/30'
  return (
    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-mono ${color}`}>
      ⚡ Intervention Score: {score}/100
    </div>
  )
}

function ResultPanel({ result, formData, onDownloadPDF, pdfLoading }) {
  const riskLevel = result.dropout_probability > 0.7 ? 'high'
    : result.dropout_probability > 0.4 ? 'medium' : 'low'
  const insightMap = {
    high: "⚠️ High dropout risk detected. Immediate academic intervention required.",
    medium: "⚡ Moderate risk. Monitor progress and provide guidance.",
    low: "✅ Low risk. Student is performing well.",
  }
  const riskFactors = result.risk_factors || []
  const protectiveFactors = result.protective_factors || []
  const isShap = riskFactors.length > 0 && 'shap_value' in riskFactors[0]
  const maxShap = Math.max(
    ...riskFactors.map(f => Math.abs(f.shap_value || 0)),
    ...protectiveFactors.map(f => Math.abs(f.shap_value || 0)),
    0.001
  )

  return (
    <div className="card sticky top-8 animate-fade-up shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={18} className="text-accent" />
        <span className="font-display font-semibold text-cream">AI Prediction Result</span>
      </div>

      <div className="bg-accent-dim text-accent text-sm p-3 rounded-lg mb-5 text-center">
        {insightMap[riskLevel]}
      </div>

      <div className="flex flex-col items-center mb-4">
        <ProbabilityGauge probability={result.dropout_probability} />
        <RiskBadge level={result.risk_level} />
        <div className="mt-3 text-lg font-bold text-cream text-center">
          {result.prediction === 'Dropout' ? '⚠️ High Dropout Risk' : '✅ Likely to Graduate'}
        </div>
        {result.intervention_score !== undefined && (
          <div className="mt-2">
            <InterventionBadge score={result.intervention_score} />
          </div>
        )}
      </div>

      {/* Model metadata */}
      {(result.model_used || result.decision_threshold) && (
        <div className="flex gap-3 text-[10px] text-muted mb-5 justify-center flex-wrap">
          {result.model_used && (
            <span className="bg-panel px-2 py-0.5 rounded-full border border-border/40">
              🤖 {result.model_used}
            </span>
          )}
          {result.decision_threshold != null && (
            <span className="bg-panel px-2 py-0.5 rounded-full border border-border/40">
              🎯 Threshold: {(result.decision_threshold * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* Risk Factors */}
      <div className="mb-4">
        <div className="label mb-2 flex items-center gap-1">
          <AlertTriangle size={12} className="text-danger" /> Risk Drivers
        </div>
        <div className="space-y-2">
          {isShap ? riskFactors.map((f, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex justify-between items-center text-xs">
                <span className={clsx('text-cream/80',
                  f.severity === 'high' && 'font-semibold text-danger',
                  f.severity === 'medium' && 'text-warn')}>
                  {f.friendly_name || f.feature}
                </span>
                <span className="text-[10px] text-danger/70 font-mono ml-2">
                  +{(Math.abs(f.shap_value) * 100).toFixed(1)}%
                </span>
              </div>
              <SHAPBar value={f.shap_value} max={maxShap} />
            </div>
          )) : riskFactors.map((f, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <AlertTriangle size={13} className={f.severity === 'high' ? 'text-danger' : 'text-warn'} />
              <span className="text-cream/80">{f.factor || f.friendly_name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Protective Factors */}
      {isShap && protectiveFactors.length > 0 && (
        <div className="mb-4">
          <div className="label mb-2 flex items-center gap-1">
            <CheckCircle size={12} className="text-safe" /> Protective Factors
          </div>
          <div className="space-y-2">
            {protectiveFactors.map((f, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-safe/80">{f.friendly_name || f.feature}</span>
                  <span className="text-[10px] text-safe/70 font-mono ml-2">
                    -{(Math.abs(f.shap_value) * 100).toFixed(1)}%
                  </span>
                </div>
                <SHAPBar value={f.shap_value} max={maxShap} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-panel p-4 rounded-lg border border-border/40 mb-4">
        <div className="label mb-1">Recommended Action</div>
        <p className="text-sm text-cream/80">{result.recommendation}</p>
      </div>

      {/* PDF Download */}
      <button
        onClick={onDownloadPDF}
        disabled={pdfLoading}
        className="btn-ghost w-full flex items-center justify-center gap-2 text-sm border border-border/40"
      >
        {pdfLoading ? (
          <><Loader2 className="animate-spin" size={14} /> Generating PDF...</>
        ) : (
          <><FileDown size={14} /> Download PDF Report</>
        )}
      </button>

      {/* SMOTE note */}
      <div className="mt-3 p-2 bg-panel/50 rounded text-[10px] text-muted flex items-start gap-1">
        <Info size={10} className="text-accent mt-0.5 shrink-0" />
        <span>{result.smote_note}</span>
      </div>
    </div>
  )
}

export default function Predict() {
  const { getToken } = useAuth()
  const [form, setForm] = useState(DEFAULT_FORM)
  const [openSections, setOpenSections] = useState({ 0: true })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleChange = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const toggleSection = (i) => setOpenSections(s => ({ ...s, [i]: !s[i] }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null); setResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const token = await getToken()
      const res = await api.predict(form, token)
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    setPdfLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const blob = await api.downloadPdfInstant(form, token)
      const name = form.student_name || 'student'
      downloadBlob(blob, `report_${name.replace(/\s+/g,'_')}.pdf`)
    } catch (err) {
      setError('PDF generation failed: ' + (err.message || 'Unknown error. Make sure the backend is running.'))
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-cream mb-1">Student Dropout Risk Prediction</h1>
        <p className="text-ghost text-sm">AI-powered analysis to identify at-risk students</p>
      </div>

      <div className="mb-8 flex gap-2">
        <div className="h-1 flex-1 bg-accent rounded"></div>
        <div className="h-1 flex-1 bg-border rounded"></div>
        <div className="h-1 flex-1 bg-border rounded"></div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {SECTIONS.map((section, i) => (
              <FormSection key={section.title} section={section} values={form}
                onChange={handleChange} open={!!openSections[i]}
                onToggle={() => toggleSection(i)} />
            ))}
            {error && (
              <div className="bg-danger-dim text-danger p-3 rounded-lg text-sm">{error}</div>
            )}
            <div className="sticky bottom-4 pt-3 bg-ink">
              <button type="submit" disabled={loading}
                className="btn-primary w-full flex justify-center gap-2 shadow-lg hover:scale-[1.01] transition-all">
                {loading ? (
                  <><Loader2 className="animate-spin" size={16} />Running AI Analysis...</>
                ) : (
                  <><Brain size={16} />Run AI Prediction</>
                )}
              </button>
            </div>
          </div>

          <div className="lg:col-span-1">
            {result ? (
              <ResultPanel result={result} formData={form}
                onDownloadPDF={handleDownloadPDF} pdfLoading={pdfLoading} />
            ) : (
              <div className="card border-dashed border-border/50 text-center py-20 px-6">
                <Brain size={40} className="mx-auto text-muted mb-4 opacity-80" />
                <p className="text-cream font-medium mb-1">No Prediction Yet</p>
                <p className="text-xs text-muted">Enter student details and run prediction to see results</p>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
