import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const rowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20)
}

export default function SignUp({ onBack }) {
  const { signUpOrganization } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [shortCode, setShortCode] = useState('')
  const [codeTouched, setCodeTouched] = useState(false)
  const [codeStatus, setCodeStatus] = useState(null) // null | 'checking' | 'available' | 'taken'
  const [ownerFullName, setOwnerFullName] = useState('')
  const [ownerMobile, setOwnerMobile] = useState('')
  const [loginName, setLoginName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Auto-suggest a short code from the business name until the user edits it themselves
  useEffect(() => {
    if (!codeTouched) setShortCode(slugify(orgName))
  }, [orgName, codeTouched])

  useEffect(() => {
    if (!/^[a-z0-9]{3,20}$/.test(shortCode)) {
      setCodeStatus(null)
      return
    }
    let cancelled = false
    setCodeStatus('checking')
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('is_org_code_available', { p_code: shortCode })
      if (!cancelled) setCodeStatus(data ? 'available' : 'taken')
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [shortCode])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!orgName.trim() || !ownerFullName.trim() || !loginName.trim() || !shortCode.trim()) {
      setError('Please fill in business name, organization code, owner name and login name.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (codeStatus === 'taken') {
      setError('That organization code is already taken — please choose another.')
      return
    }

    setBusy(true)
    const { error: signupError } = await signUpOrganization({
      orgName,
      shortCode,
      ownerFullName,
      loginName,
      password,
      ownerMobile,
      contactEmail,
      city,
      state,
    })
    setBusy(false)
    if (signupError) setError(signupError)
  }

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 460 }}>
        <div className="brand">
          <div className="lockup">
            <span className="word">Saral</span>
            <span className="caption">Retail · Console</span>
          </div>
        </div>

        <p className="login-hint" style={{ marginTop: 0, marginBottom: 18, textAlign: 'center' }}>
          Set up your business — this creates your organization, a starter chart of accounts, and your owner login.
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="orgName">Business name</label>
            <input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Nayak General Store" required />
          </div>

          <div style={rowStyle}>
            <div className="login-field">
              <label htmlFor="city">City (optional)</label>
              <input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bhubaneswar" />
            </div>
            <div className="login-field">
              <label htmlFor="state">State (optional)</label>
              <input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="Odisha" />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="shortCode">Organization code</label>
            <input
              id="shortCode"
              value={shortCode}
              onChange={(e) => {
                setCodeTouched(true)
                setShortCode(slugify(e.target.value))
              }}
              placeholder="e.g. nayakstore"
              required
            />
            <span style={{ fontSize: '.72rem', color: codeStatus === 'taken' ? 'var(--red)' : codeStatus === 'available' ? 'var(--accent-strong)' : 'var(--muted)' }}>
              {codeStatus === 'checking' && 'Checking availability…'}
              {codeStatus === 'available' && '✓ Available'}
              {codeStatus === 'taken' && 'Already taken — try another'}
              {!codeStatus && 'Lowercase letters/numbers only, 3–20 characters. This becomes part of every login.'}
            </span>
          </div>

          <div style={rowStyle}>
            <div className="login-field">
              <label htmlFor="ownerFullName">Owner's full name</label>
              <input id="ownerFullName" value={ownerFullName} onChange={(e) => setOwnerFullName(e.target.value)} required />
            </div>
            <div className="login-field">
              <label htmlFor="ownerMobile">Mobile (optional)</label>
              <input id="ownerMobile" value={ownerMobile} onChange={(e) => setOwnerMobile(e.target.value)} placeholder="98765xxxxx" />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="loginName">Choose a login name</label>
            <input id="loginName" value={loginName} onChange={(e) => setLoginName(e.target.value.toLowerCase())} placeholder="e.g. rina" required />
            <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
              You'll sign in as <strong>{loginName || 'loginname'}@{shortCode || 'orgcode'}</strong>
            </span>
          </div>

          <div className="login-field">
            <label htmlFor="contactEmail">Contact email (optional, for our records)</label>
            <input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="owner@business.com" />
          </div>

          <div style={rowStyle}>
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="login-field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: 16 }}>
            {busy ? 'Setting up your business…' : 'Create my account'}
          </button>
        </form>

        <p className="login-hint">
          Already have an account?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); onBack() }} style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
