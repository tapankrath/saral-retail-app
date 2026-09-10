import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function Login({ onSignUp, onForgot }) {
  const { loginWithLoginNameAndOrg } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const raw = identifier.trim()
    const atIndex = raw.indexOf('@')
    if (atIndex <= 0 || atIndex === raw.length - 1) {
      setError('Enter your login as loginname@orgcode, e.g. rina@demo1')
      return
    }
    const loginName = raw.slice(0, atIndex)
    const orgCode = raw.slice(atIndex + 1)

    setBusy(true)
    const { error } = await loginWithLoginNameAndOrg(loginName, orgCode, password)
    setBusy(false)
    if (error) setError(error)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <div className="lockup">
            <span className="word">Saral</span>
            <span className="caption">Retail · Console</span>
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="identifier">Login</label>
            <input
              id="identifier"
              autoComplete="username"
              placeholder="loginname@orgcode"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-hint" style={{ textAlign: 'center' }}>
          <a href="#" onClick={(e) => { e.preventDefault(); onForgot() }} style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Forgot password?
          </a>
        </p>

        <p className="login-hint">
          Demo login: <strong>rina@demo1</strong> (owner, full access) or{' '}
          <strong>priya@demo1</strong> (cashier — sales voucher only), password <strong>Saral@123</strong>.
        </p>
        <p className="login-hint">
          New business?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); onSignUp() }} style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Create an account
          </a>
        </p>
      </div>
    </div>
  )
}
