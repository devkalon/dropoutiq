import { Routes, Route, Navigate } from 'react-router-dom'
import { SignIn, SignedIn, SignedOut } from '@clerk/clerk-react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Predict from './pages/Predict'
import History from './pages/History'
import BatchPredict from './pages/BatchPredict'
import ModelInsights from './pages/ModelInsights'
import Analytics from './pages/Analytics'
import WhatIf from './pages/WhatIf'
import ThresholdOptimizer from './pages/ThresholdOptimizer'
import StudentDetail from './pages/StudentDetail'
import FairnessAudit from './pages/FairnessAudit'
import Counterfactuals from './pages/Counterfactuals'
import SurvivalAnalysis from './pages/SurvivalAnalysis'
import ActiveLearning from './pages/ActiveLearning'

export default function App() {
  return (
    <>
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-transparent">
          <div className="absolute inset-0 z-0">
            <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-[#5B8AF0] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-[drift_20s_infinite_alternate_linear]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-[#E8A030] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-[drift2_25s_infinite_alternate_linear]" />
          </div>
          <div className="w-full max-w-md relative z-10 p-8 rounded-2xl bg-slate/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
            <div className="text-center mb-8 flex flex-col items-center">
              <h1 className="font-display font-bold text-4xl text-cream mb-2 tracking-wide">DropoutIQ</h1>
              <p className="text-accent text-xs uppercase tracking-widest font-mono">Student Risk Intelligence v4</p>
            </div>
            <SignIn forceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard"
              appearance={{ variables: { colorBackground: 'rgba(26, 29, 38, 0.4)', colorText: '#E8E6E0',
                colorInputBackground: 'rgba(34, 38, 58, 0.3)', colorInputText: '#E8E6E0',
                colorPrimary: '#5B8AF0', borderRadius: '0.75rem' } }} />
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <Layout>
          <Routes>
            <Route path="/"               element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"      element={<Dashboard />} />
            <Route path="/predict"        element={<Predict />} />
            <Route path="/batch"          element={<BatchPredict />} />
            <Route path="/history"        element={<History />} />
            <Route path="/analytics"      element={<Analytics />} />
            <Route path="/insights"       element={<ModelInsights />} />
            <Route path="/whatif"         element={<WhatIf />} />
            <Route path="/threshold"      element={<ThresholdOptimizer />} />
            <Route path="/students/:studentId" element={<StudentDetail />} />
            <Route path="/fairness"       element={<FairnessAudit />} />
            <Route path="/counterfactuals" element={<Counterfactuals />} />
            <Route path="/survival"       element={<SurvivalAnalysis />} />
            <Route path="/active-learning" element={<ActiveLearning />} />
          </Routes>
        </Layout>
      </SignedIn>
    </>
  )
}
