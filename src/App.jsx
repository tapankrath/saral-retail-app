import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Console from './pages/Console'
import './console.css'

function Gate() {
  const { session, loading } = useAuth()
  if (loading) {
    return <div className="loading-screen">Loading Saral Retail…</div>
  }
  return session ? <Console /> : <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
