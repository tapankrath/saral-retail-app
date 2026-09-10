import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const emptyOrg = {
  name: '', contact_person: '', designation: '', address: '', city: '', state: '',
  pincode: '', email: '', mobile: '', gstin_state_code: '',
}
const emptyBranch = { name: '', voucher_prefix: '', gstin: '', address_lines: '', logo_url: '', signature_url: '' }

export default function OrgSetup() {
  const { profile, canView, canEdit } = useAuth()
  const canOrg = canView('system_setup')
  const canBranch = canView('branch_setup')
  const [tab, setTab] = useState(canOrg ? 'org' : 'branch')
  const [org, setOrg] = useState(emptyOrg)
  const [branch, setBranch] = useState(emptyBranch)
  const [loading, setLoading] = useState(true)
  const [savingOrg, setSavingOrg] = useState(false)
  const [savingBranch, setSavingBranch] = useState(false)
  const [orgMsg, setOrgMsg] = useState(null)
  const [branchMsg, setBranchMsg] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: orgRow } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single()
      if (orgRow) setOrg({ ...emptyOrg, ...orgRow })
      const { data: branchRow } = await supabase.from('branches').select('*').eq('id', profile.home_branch_id).single()
      if (branchRow) setBranch({ ...emptyBranch, ...branchRow, address_lines: (branchRow.address_lines ?? []).join('\n') })
      setLoading(false)
    }
    if (profile) load()
  }, [profile])

  async function saveOrg() {
    setError(null)
    setOrgMsg(null)
    setSavingOrg(true)
    const { error } = await supabase
      .from('organizations')
      .update({
        name: org.name, contact_person: org.contact_person || null, designation: org.designation || null,
        address: org.address || null, city: org.city || null, state: org.state || null,
        pincode: org.pincode || null, email: org.email || null, mobile: org.mobile || null,
        gstin_state_code: org.gstin_state_code || null,
      })
      .eq('id', profile.organization_id)
    setSavingOrg(false)
    if (error) { setError(error.message); return }
    setOrgMsg('Saved.')
  }

  async function saveBranch() {
    setError(null)
    setBranchMsg(null)
    setSavingBranch(true)
    const { error } = await supabase
      .from('branches')
      .update({
        name: branch.name, voucher_prefix: branch.voucher_prefix || '', gstin: branch.gstin || null,
        address_lines: branch.address_lines ? branch.address_lines.split('\n').map((l) => l.trim()).filter(Boolean) : null,
        logo_url: branch.logo_url || null, signature_url: branch.signature_url || null,
      })
      .eq('id', profile.home_branch_id)
    setSavingBranch(false)
    if (error) { setError(error.message); return }
    setBranchMsg('Saved.')
  }

  if (!canOrg && !canBranch) {
    return (
      <section>
        <div className="page-head"><h1>Organization &amp; Branch Setup</h1></div>
        <p className="empty-note">Your account doesn't have permission to view setup.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Organization &amp; Branch Setup</h1>
          <p className="sub">Business details used on invoices and reports</p>
        </div>
      </div>

      <div className="tab-row">
        {canOrg && <button className={`tab${tab === 'org' ? ' active' : ''}`} onClick={() => setTab('org')}>Organization</button>}
        {canBranch && <button className={`tab${tab === 'branch' ? ' active' : ''}`} onClick={() => setTab('branch')}>Branch</button>}
      </div>

      {error && <div className="login-error">{error}</div>}
      {loading ? (
        <p className="empty-note">Loading…</p>
      ) : tab === 'org' ? (
        <div className="card" style={{ maxWidth: 640 }}>
          {orgMsg && <p className="login-hint" style={{ color: 'var(--accent-strong)' }}>{orgMsg}</p>}
          <div className="field" style={{ marginTop: 0 }}>
            <label>Business name</label>
            <input value={org.name} onChange={(e) => setOrg((p) => ({ ...p, name: e.target.value }))} disabled={!canEdit('system_setup')} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Contact person</label>
              <input value={org.contact_person ?? ''} onChange={(e) => setOrg((p) => ({ ...p, contact_person: e.target.value }))} disabled={!canEdit('system_setup')} />
            </div>
            <div className="field">
              <label>Designation</label>
              <input value={org.designation ?? ''} onChange={(e) => setOrg((p) => ({ ...p, designation: e.target.value }))} disabled={!canEdit('system_setup')} />
            </div>
          </div>
          <div className="field">
            <label>Address</label>
            <input value={org.address ?? ''} onChange={(e) => setOrg((p) => ({ ...p, address: e.target.value }))} disabled={!canEdit('system_setup')} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>City</label>
              <input value={org.city ?? ''} onChange={(e) => setOrg((p) => ({ ...p, city: e.target.value }))} disabled={!canEdit('system_setup')} />
            </div>
            <div className="field">
              <label>State</label>
              <input value={org.state ?? ''} onChange={(e) => setOrg((p) => ({ ...p, state: e.target.value }))} disabled={!canEdit('system_setup')} />
            </div>
            <div className="field">
              <label>Pincode</label>
              <input value={org.pincode ?? ''} onChange={(e) => setOrg((p) => ({ ...p, pincode: e.target.value }))} disabled={!canEdit('system_setup')} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Email</label>
              <input value={org.email ?? ''} onChange={(e) => setOrg((p) => ({ ...p, email: e.target.value }))} disabled={!canEdit('system_setup')} />
            </div>
            <div className="field">
              <label>Mobile</label>
              <input value={org.mobile ?? ''} onChange={(e) => setOrg((p) => ({ ...p, mobile: e.target.value }))} disabled={!canEdit('system_setup')} />
            </div>
            <div className="field">
              <label>GSTIN state code</label>
              <input value={org.gstin_state_code ?? ''} onChange={(e) => setOrg((p) => ({ ...p, gstin_state_code: e.target.value }))} placeholder="e.g. 21" maxLength={2} disabled={!canEdit('system_setup')} />
            </div>
          </div>
          {canEdit('system_setup') && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={saveOrg} disabled={savingOrg}>
              {savingOrg ? 'Saving…' : 'Save Organization'}
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 640 }}>
          {branchMsg && <p className="login-hint" style={{ color: 'var(--accent-strong)' }}>{branchMsg}</p>}
          <div className="field" style={{ marginTop: 0 }}>
            <label>Branch name</label>
            <input value={branch.name} onChange={(e) => setBranch((p) => ({ ...p, name: e.target.value }))} disabled={!canEdit('branch_setup')} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Voucher prefix (e.g. "HO" → invoices like HO0000001)</label>
              <input value={branch.voucher_prefix} onChange={(e) => setBranch((p) => ({ ...p, voucher_prefix: e.target.value.toUpperCase() }))} maxLength={5} disabled={!canEdit('branch_setup')} />
            </div>
            <div className="field">
              <label>Branch GSTIN</label>
              <input value={branch.gstin ?? ''} onChange={(e) => setBranch((p) => ({ ...p, gstin: e.target.value }))} disabled={!canEdit('branch_setup')} />
            </div>
          </div>
          <div className="field">
            <label>Invoice heading lines (one per line — address, phone, GSTIN etc.)</label>
            <textarea rows={3} value={branch.address_lines} onChange={(e) => setBranch((p) => ({ ...p, address_lines: e.target.value }))} disabled={!canEdit('branch_setup')} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Logo URL (optional)</label>
              <input value={branch.logo_url ?? ''} onChange={(e) => setBranch((p) => ({ ...p, logo_url: e.target.value }))} disabled={!canEdit('branch_setup')} />
            </div>
            <div className="field">
              <label>Signature image URL (optional)</label>
              <input value={branch.signature_url ?? ''} onChange={(e) => setBranch((p) => ({ ...p, signature_url: e.target.value }))} disabled={!canEdit('branch_setup')} />
            </div>
          </div>
          {canEdit('branch_setup') && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={saveBranch} disabled={savingBranch}>
              {savingBranch ? 'Saving…' : 'Save Branch'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
