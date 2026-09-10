import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import ForgotPassword from './pages/ForgotPassword'
import Console from './pages/Console'
import './console.css'

function Gate() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  if (loading) {
    return <div className="loading-screen">Loading Saral Retail…</div>
  }
  if (session) return <Console />
  if (mode === 'signup') return <SignUp onBack={() => setMode('login')} />
  if (mode === 'forgot') return <ForgotPassword onBack={() => setMode('login')} />
  return <Login onSignUp={() => setMode('signup')} onForgot={() => setMode('forgot')} />
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
