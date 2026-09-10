import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { loginWithLoginNameAndOrg } = useAuth()
  const [loginName, setLoginName] = useState('')
  const [orgCode, setOrgCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await loginWithLoginNameAndOrg(loginName.trim(), orgCode.trim(), password)
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
            <label htmlFor="login-name">Login</label>
            <div className="login-id-row">
              <input
                id="login-name"
                autoComplete="username"
                placeholder="login name"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                required
              />
              <span>@</span>
              <input
                id="org-code"
                placeholder="org code"
                value={orgCode}
                onChange={(e) => setOrgCode(e.target.value)}
                required
              />
            </div>
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

        <p className="login-hint">
          Demo login: <strong>rina@demo1</strong> (owner, full access) or{' '}
          <strong>priya@demo1</strong> (cashier — sales voucher only), password <strong>Saral@123</strong>.
        </p>
      </div>
    </div>
  )
}
