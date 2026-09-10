import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Console from './pages/Console'
import './console.css'

function Gate() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  if (loading) {
    return <div className="loading-screen">Loading Saral Retail…</div>
  }
  if (session) return <Console />
  return mode === 'signup' ? (
    <SignUp onBack={() => setMode('login')} />
  ) : (
    <Login onSignUp={() => setMode('signup')} />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
