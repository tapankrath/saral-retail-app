import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const LEVELS = ['none', 'view', 'add_only', 'full']
const LEVEL_LABEL = { none: 'No access', view: 'View only', add_only: 'View + Add', full: 'Full' }

const emptyForm = { fullName: '', loginName: '', password: '', designation: '', mobile: '', recoveryPin: '' }

export default function StaffManagement() {
  const { profile, canView, canEdit } = useAuth()
  const [staff, setStaff] = useState([])
  const [modules, setModules] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [permMap, setPermMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [addError, setAddError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState(null)

  async function loadStaff() {
    const { data } = await supabase.from('users').select('*').order('created_at')
    setStaff(data ?? [])
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: modRows } = await supabase.from('permission_modules').select('id, code, label, group_name').order('id')
      setModules(modRows ?? [])
      await loadStaff()
      setLoading(false)
    }
    load()
  }, [])

  async function loadPermissions(userId) {
    const { data } = await supabase.from('user_permissions').select('module_id, level').eq('user_id', userId)
    const map = {}
    for (const row of data ?? []) map[row.module_id] = row.level
    setPermMap(map)
  }

  function selectStaff(id) {
    setSelectedId(id)
    setPwMsg(null)
    setNewPassword('')
    loadPermissions(id)
  }

  async function changeLevel(moduleId, level) {
    setPermMap((prev) => ({ ...prev, [moduleId]: level }))
    await supabase
      .from('user_permissions')
      .upsert({ user_id: selectedId, module_id: moduleId, level }, { onConflict: 'user_id,module_id' })
  }

  async function toggleStatus(user) {
    const nextStatus = user.status === 'active' ? 'disabled' : 'active'
    await supabase.from('users').update({ status: nextStatus }).eq('id', user.id)
    await loadStaff()
  }

  async function handleAdd() {
    setAddError(null)
    if (!form.fullName.trim() || !form.loginName.trim() || form.password.length < 8) {
      setAddError('Full name, login name, and an 8+ character password are required.')
      return
    }
    if (form.recoveryPin && !/^\d{6}$/.test(form.recoveryPin)) {
      setAddError('Recovery PIN must be exactly 6 digits, or left blank.')
      return
    }
    setAdding(true)
    const { data, error } = await supabase.rpc('create_staff_user', {
      p_full_name: form.fullName.trim(),
      p_login_name: form.loginName.trim().toLowerCase(),
      p_password: form.password,
      p_designation: form.designation || null,
      p_mobile: form.mobile || null,
      p_recovery_pin: form.recoveryPin || null,
    })
    setAdding(false)
    if (error) {
      setAddError(error.message)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    setForm(emptyForm)
    setShowAdd(false)
    await loadStaff()
    selectStaff(row.user_id)
  }

  async function handleResetPassword() {
    setPwMsg(null)
    if (newPassword.length < 8) {
      setPwMsg('Password must be at least 8 characters.')
      return
    }
    const { error } = await supabase.rpc('reset_staff_password', { p_user_id: selectedId, p_new_password: newPassword })
    if (error) {
      setPwMsg(error.message)
      return
    }
    setPwMsg('Password updated.')
    setNewPassword('')
  }

  const selectedUser = staff.find((s) => s.id === selectedId)
  const grouped = modules.reduce((acc, m) => {
    acc[m.group_name] = acc[m.group_name] || []
    acc[m.group_name].push(m)
    return acc
  }, {})

  if (!canView('user_staff')) {
    return (
      <section>
        <div className="page-head"><h1>Users &amp; Staff</h1></div>
        <p className="empty-note">Your account doesn't have permission to view staff.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Users &amp; Staff</h1>
          <p className="sub">Create staff logins and control exactly what each person can see and do</p>
        </div>
        {canEdit('user_staff') && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setShowAdd((v) => !v)}>{showAdd ? 'Cancel' : '+ Add Staff'}</button>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
          <h3>Add staff login</h3>
          {addError && <div className="login-error">{addError}</div>}
          <div className="field-row">
            <div className="field" style={{ marginTop: 0 }}>
              <label>Full name</label>
              <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
            </div>
            <div className="field" style={{ marginTop: 0 }}>
              <label>Designation (optional)</label>
              <input value={form.designation} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))} placeholder="e.g. Cashier" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Login name</label>
              <input value={form.loginName} onChange={(e) => setForm((p) => ({ ...p, loginName: e.target.value }))} placeholder="e.g. priya" />
            </div>
            <div className="field">
              <label>Mobile (optional)</label>
              <input value={form.mobile} onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Password (8+ characters)</label>
            <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </div>
          <div className="field">
            <label>Recovery PIN — 6 digits (optional)</label>
            <input
              inputMode="numeric"
              maxLength={6}
              value={form.recoveryPin}
              onChange={(e) => setForm((p) => ({ ...p, recoveryPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              placeholder="123456"
            />
            <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>Lets them reset their own password later. They can also set this themselves afterwards.</span>
          </div>
          <p style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
            They'll sign in as <strong>{form.loginName || 'loginname'}@{profile?.organizations?.short_code}</strong>.
          </p>
          <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>{adding ? 'Creating…' : 'Create Staff Login'}</button>
        </div>
      )}

      {loading ? (
        <p className="empty-note">Loading…</p>
      ) : (
        <div className="voucher-grid">
          <div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Name</th><th>Login</th><th>Designation</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id} onClick={() => selectStaff(s.id)} style={{ cursor: 'pointer', background: selectedId === s.id ? 'var(--accent-soft)' : undefined }}>
                      <td className="strong">{s.full_name}{s.is_owner ? ' (Owner)' : ''}</td>
                      <td>{s.login_name}</td>
                      <td>{s.designation ?? '—'}</td>
                      <td><span className={`chip ${s.status === 'active' ? 'ok' : 'out'}`}>{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            {!selectedUser ? (
              <p className="empty-note">Select a staff member to manage their access.</p>
            ) : (
              <>
                <h3>{selectedUser.full_name}</h3>
                <p className="sub">{selectedUser.login_name}@{profile?.organizations?.short_code}</p>

                {!selectedUser.is_owner && canEdit('user_staff') && (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                    <button className="btn btn-ghost" onClick={() => toggleStatus(selectedUser)}>
                      {selectedUser.status === 'active' ? 'Disable login' : 'Re-enable login'}
                    </button>
                  </div>
                )}

                {selectedUser.is_owner ? (
                  <p className="empty-note">The owner always has full access to every module.</p>
                ) : (
                  <>
                    {canEdit('user_staff') && (
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '.75rem', color: 'var(--muted)' }}>Reset password</label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ flex: 1 }} />
                          <button className="btn btn-ghost" onClick={handleResetPassword}>Set</button>
                        </div>
                        {pwMsg && <p style={{ fontSize: '.75rem', marginTop: 4 }}>{pwMsg}</p>}
                      </div>
                    )}

                    {Object.entries(grouped).map(([group, mods]) => (
                      <div key={group} style={{ marginBottom: 14 }}>
                        <div className="nav-grp-label" style={{ padding: 0, marginBottom: 6 }}>{group}</div>
                        {mods.map((m) => (
                          <div key={m.id} className="list-row">
                            <div className="name">{m.label}</div>
                            <select
                              value={permMap[m.id] ?? 'none'}
                              onChange={(e) => changeLevel(m.id, e.target.value)}
                              disabled={!canEdit('user_staff')}
                            >
                              {LEVELS.map((lvl) => (
                                <option key={lvl} value={lvl}>{LEVEL_LABEL[lvl]}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
