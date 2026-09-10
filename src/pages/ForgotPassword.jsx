import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function ForgotPassword({ onBack }) {
  const { resetPasswordWithPin } = useAuth()
  const [loginName, setLoginName] = useState('')
  const [orgCode, setOrgCode] = useState('')
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!loginName.trim() || !orgCode.trim()) {
      setError('Enter your login name and organization code.')
      return
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('Recovery PIN must be exactly 6 digits.')
      return
    }
    if (password.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    const { error: resetError } = await resetPasswordWithPin(
      loginName.trim().toLowerCase(),
      orgCode.trim().toLowerCase(),
      pin,
      password
    )
    setBusy(false)
    if (resetError) {
      setError(resetError)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="brand">
            <div className="lockup">
              <span className="word">Saral</span>
              <span className="caption">Retail · Console</span>
            </div>
          </div>
          <p className="login-hint" style={{ textAlign: 'center' }}>
            Your password has been reset. You can now sign in with your new password.
          </p>
          <button className="btn btn-primary btn-block" onClick={onBack}>
            Back to sign in
          </button>
        </div>
      </div>
    )
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

        <p className="login-hint" style={{ marginTop: 0, marginBottom: 18, textAlign: 'center' }}>
          Reset your password using the 6-digit recovery PIN you set earlier.
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="fpLoginName">Login name</label>
            <input
              id="fpLoginName"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              placeholder="e.g. rina"
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="fpOrgCode">Organization code</label>
            <input
              id="fpOrgCode"
              value={orgCode}
              onChange={(e) => setOrgCode(e.target.value)}
              placeholder="e.g. demo1"
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="fpPin">Recovery PIN (6 digits)</label>
            <input
              id="fpPin"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="fpPassword">New password</label>
            <input
              id="fpPassword"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="fpConfirmPassword">Confirm new password</label>
            <input
              id="fpConfirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className="login-hint">
          Don't have a recovery PIN set? Ask your organization's owner to reset your password for you, or sign in and set one under <strong>Account &amp; Security</strong>.
        </p>
        <p className="login-hint">
          <a href="#" onClick={(e) => { e.preventDefault(); onBack() }} style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  )
}
