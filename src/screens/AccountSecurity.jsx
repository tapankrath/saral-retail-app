import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function AccountSecurity() {
  const { profile, changeMyPassword, setMyRecoveryPin } = useAuth()
  const [hasPin, setHasPin] = useState(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMsg, setPwMsg] = useState(null)
  const [pwBusy, setPwBusy] = useState(false)

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMsg, setPinMsg] = useState(null)
  const [pinBusy, setPinBusy] = useState(false)

  useEffect(() => {
    supabase.rpc('i_have_recovery_pin').then(({ data }) => setHasPin(!!data))
  }, [])

  async function handlePasswordChange() {
    setPwMsg(null)
    if (!currentPassword) {
      setPwMsg({ ok: false, text: 'Enter your current password.' })
      return
    }
    if (newPassword.length < 8) {
      setPwMsg({ ok: false, text: 'New password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' })
      return
    }

    setPwBusy(true)
    // Re-verify the current password by re-authenticating before changing it.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: (await supabase.auth.getUser()).data.user?.email,
      password: currentPassword,
    })
    if (reauthError) {
      setPwBusy(false)
      setPwMsg({ ok: false, text: 'Current password is incorrect.' })
      return
    }
    const { error } = await changeMyPassword(newPassword)
    setPwBusy(false)
    if (error) {
      setPwMsg({ ok: false, text: error })
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPwMsg({ ok: true, text: 'Password updated.' })
  }

  async function handleSetPin() {
    setPinMsg(null)
    if (!/^\d{6}$/.test(pin)) {
      setPinMsg({ ok: false, text: 'Recovery PIN must be exactly 6 digits.' })
      return
    }
    if (pin !== confirmPin) {
      setPinMsg({ ok: false, text: 'PINs do not match.' })
      return
    }
    setPinBusy(true)
    const { error } = await setMyRecoveryPin(pin)
    setPinBusy(false)
    if (error) {
      setPinMsg({ ok: false, text: error })
      return
    }
    setPin('')
    setConfirmPin('')
    setHasPin(true)
    setPinMsg({ ok: true, text: 'Recovery PIN saved.' })
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Account &amp; Security</h1>
          <p className="sub">
            Signed in as {profile?.full_name} ({profile?.login_name}@{profile?.organizations?.short_code})
          </p>
        </div>
      </div>

      <div className="voucher-grid">
        <div className="card">
          <h3>Change password</h3>
          <p className="sub" style={{ marginTop: -6 }}>You'll need to enter your current password to confirm it's you.</p>
          {pwMsg && <div className={pwMsg.ok ? 'login-hint' : 'login-error'}>{pwMsg.text}</div>}
          <div className="field">
            <label>Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>New password (8+ characters)</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handlePasswordChange} disabled={pwBusy}>
            {pwBusy ? 'Updating…' : 'Update password'}
          </button>
        </div>

        <div className="card">
          <h3>Recovery PIN</h3>
          <p className="sub" style={{ marginTop: -6 }}>
            {hasPin
              ? 'You already have a recovery PIN set. Saving a new one replaces it.'
              : "You haven't set a recovery PIN yet. Set one now so you can reset your own password if you forget it — without needing anyone's help."}
          </p>
          {pinMsg && <div className={pinMsg.ok ? 'login-hint' : 'login-error'}>{pinMsg.text}</div>}
          <div className="field">
            <label>New 6-digit PIN</label>
            <input
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
            />
          </div>
          <div className="field">
            <label>Confirm PIN</label>
            <input
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
            />
          </div>
          <button className="btn btn-primary" onClick={handleSetPin} disabled={pinBusy}>
            {pinBusy ? 'Saving…' : hasPin ? 'Update PIN' : 'Set PIN'}
          </button>
          <p style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 10 }}>
            Don't share your PIN with anyone. Anyone who knows your login name, organization code, and PIN can reset your password.
          </p>
        </div>
      </div>
    </section>
  )
}
