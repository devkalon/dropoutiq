import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!CLERK_KEY) {
  console.error('❌ VITE_CLERK_PUBLISHABLE_KEY is missing from .env file!')
} else {
  console.log('✅ Clerk key loaded:', CLERK_KEY.substring(0, 15) + '...')
}

function ClerkAwareApp() {
  const { isLoaded } = useAuth()
  if (!isLoaded) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0D0F14',
        color: '#E8E6E0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ width: 36, height: 36, border: '3px solid #5B8AF0', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#8B93B0', fontSize: 14 }}>Connecting to authentication...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY}>
      <BrowserRouter>
        <ClerkAwareApp />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
)