const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail) || `HTTP ${res.status}`
    throw new Error(msg)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/pdf') || ct.includes('text/plain')) return res.blob()
  return res.json()
}

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export const api = {
  async predict(data, token) {
    return request('/predict', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(data) })
  },
  async predictBatch(students, token, includeShap = false) {
    return request('/predict/batch', {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ students, include_shap: includeShap })
    })
  },
  async history(token, limit = 100, offset = 0) {
    return request(`/predictions/history?limit=${limit}&offset=${offset}`, { headers: authHeaders(token) })
  },

  async getSummary(token) {
    return request('/analytics/summary', { headers: authHeaders(token) })
  },
  async getInterventionPriority(token, limit = 20) {
    return request(`/analytics/intervention-priority?limit=${limit}`, { headers: authHeaders(token) })
  },
  async getCohort(token) {
    return request('/analytics/cohort', { headers: authHeaders(token) })
  },
  async getTrends(token, days = 30) {
    return request(`/analytics/trends?days=${days}`, { headers: authHeaders(token) })
  },
  async getFairness(token) {
    return request('/analytics/fairness', { headers: authHeaders(token) })
  },
  async getRiskTimeline(token, studentId) {
    return request(`/analytics/risk-timeline/${encodeURIComponent(studentId)}`, { headers: authHeaders(token) })
  },
  async addRiskTimeline(token, entry) {
    return request('/analytics/risk-timeline', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(entry) })
  },

  async getComparison(token) {
    return request('/model/comparison', { headers: authHeaders(token) })
  },
  async getRocCurve(token) {
    return request('/model/roc-curve', { headers: authHeaders(token) })
  },
  async getShapGlobal(token) {
    return request('/model/shap-global', { headers: authHeaders(token) })
  },
  async getShapInteractions(token) {
    return request('/model/shap-interactions', { headers: authHeaders(token) })
  },
  async getCalibration(token) {
    return request('/model/calibration', { headers: authHeaders(token) })
  },
  async getConfusionMatrix(token) {
    return request('/model/confusion-matrix', { headers: authHeaders(token) })
  },
  async getPrecisionRecall(token) {
    return request('/model/precision-recall', { headers: authHeaders(token) })
  },
  async getFeatureLabels(token) {
    return request('/model/feature-labels', { headers: authHeaders(token) })
  },
  async getSmoteNote(token) {
    return request('/model/smote-note', { headers: authHeaders(token) })
  },
  async getSurvivalCurves(token) {
    return request('/model/survival', { headers: authHeaders(token) })
  },

  async searchStudents(token, q, limit = 20) {
    return request(`/students/search?q=${encodeURIComponent(q)}&limit=${limit}`, { headers: authHeaders(token) })
  },
  async getStudentDetail(token, studentId) {
    return request(`/students/${encodeURIComponent(studentId)}`, { headers: authHeaders(token) })
  },

  async getCounterfactuals(token, studentData, desiredOutcome = 'Graduate', numCfs = 3) {
    return request('/counterfactual', {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ student_data: studentData, desired_outcome: desiredOutcome, num_counterfactuals: numCfs })
    })
  },

  async sendAlert(token, alertData) {
    return request('/alerts/send', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(alertData) })
  },
  async getAlertsHistory(token, limit = 50) {
    return request(`/alerts/history?limit=${limit}`, { headers: authHeaders(token) })
  },

  async getUncertainPredictions(token, limit = 20) {
    return request(`/active-learning/uncertain?limit=${limit}`, { headers: authHeaders(token) })
  },
  async submitLabel(token, predictionId, trueLabel, notes = '') {
    return request('/active-learning/label', {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ prediction_id: predictionId, true_label: trueLabel, notes })
    })
  },
  async getActiveLearningStats(token) {
    return request('/active-learning/stats', { headers: authHeaders(token) })
  },

  async getMyRole(token) {
    return request('/me/role', { headers: authHeaders(token) })
  },

  async downloadPdfInstant(studentData, token) {
    const res = await fetch(`${BASE}/predict/pdf/instant`, {
      method: 'POST', headers: authHeaders(token), body: JSON.stringify(studentData)
    })
    if (!res.ok) throw new Error(`PDF generation failed: ${res.status}`)
    return res.blob()
  },
  async downloadPdfById(predictionId, token) {
    const res = await fetch(`${BASE}/predict/pdf/${predictionId}`, { headers: authHeaders(token) })
    if (!res.ok) throw new Error(`PDF download failed: ${res.status}`)
    return res.blob()
  },
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
