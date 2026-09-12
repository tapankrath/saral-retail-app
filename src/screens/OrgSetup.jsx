import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const emptyNewTax = { name: '', tax_percent: '', state_code: '' }

const emptyOrg = {
  name: '', contact_person: '', designation: '', address: '', city: '', state: '',
  pincode: '', email: '', mobile: '', gstin_state_code: '', country: 'IN', ein: '', sales_tax_permit_no: '',
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

  const [taxTypes, setTaxTypes] = useState([])
  const [taxLoading, setTaxLoading] = useState(true)
  const [taxError, setTaxError] = useState(null)
  const [newTax, setNewTax] = useState(emptyNewTax)
  const [addingTax, setAddingTax] = useState(false)
  const [editingTaxId, setEditingTaxId] = useState(null)
  const [editTax, setEditTax] = useState(emptyNewTax)
  const [savingTaxId, setSavingTaxId] = useState(null)

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

  async function loadTaxTypes() {
    setTaxLoading(true)
    const { data, error } = await supabase.from('tax_types').select('id, name, tax_percent, state_code').order('tax_percent')
    if (error) setTaxError(error.message)
    setTaxTypes(data ?? [])
    setTaxLoading(false)
  }

  useEffect(() => {
    if (profile) loadTaxTypes()
  }, [profile])

  async function handleAddTax() {
    setTaxError(null)
    if (!newTax.name.trim()) {
      setTaxError('Name is required.')
      return
    }
    if (newTax.tax_percent === '' || Number(newTax.tax_percent) < 0) {
      setTaxError('Enter a tax percent of zero or greater.')
      return
    }
    setAddingTax(true)
    const { error } = await supabase.rpc('create_tax_type', {
      p_name: newTax.name.trim(),
      p_tax_percent: Number(newTax.tax_percent),
      p_state_code: newTax.state_code ? newTax.state_code.trim().toUpperCase() : null,
    })
    setAddingTax(false)
    if (error) {
      setTaxError(error.message)
      return
    }
    setNewTax(emptyNewTax)
    await loadTaxTypes()
  }

  function startEditTax(t) {
    setEditingTaxId(t.id)
    setEditTax({ name: t.name, tax_percent: String(t.tax_percent), state_code: t.state_code ?? '' })
    setTaxError(null)
  }

  async function handleSaveTax(id) {
    setTaxError(null)
    if (!editTax.name.trim()) {
      setTaxError('Name is required.')
      return
    }
    if (editTax.tax_percent === '' || Number(editTax.tax_percent) < 0) {
      setTaxError('Enter a tax percent of zero or greater.')
      return
    }
    setSavingTaxId(id)
    const { error } = await supabase.rpc('update_tax_type', {
      p_id: id,
      p_name: editTax.name.trim(),
      p_tax_percent: Number(editTax.tax_percent),
      p_state_code: editTax.state_code ? editTax.state_code.trim().toUpperCase() : null,
    })
    setSavingTaxId(null)
    if (error) {
      setTaxError(error.message)
      return
    }
    setEditingTaxId(null)
    await loadTaxTypes()
  }

  async function handleDeleteTax(t) {
    if (!window.confirm(`Delete "${t.name}"? This can't be undone.`)) return
    setTaxError(null)
    const { error } = await supabase.rpc('delete_tax_type', { p_id: t.id })
    if (error) {
      setTaxError(error.message)
      return
    }
    await loadTaxTypes()
  }

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
        country: org.country || 'IN', ein: org.ein || null, sales_tax_permit_no: org.sales_tax_permit_no || null,
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
        {canOrg && <button className={`tab${tab === 'tax' ? ' active' : ''}`} onClick={() => setTab('tax')}>Tax Rates</button>}
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
              <label>Country</label>
              <select
                value={org.country || 'IN'}
                onChange={(e) => setOrg((p) => ({ ...p, country: e.target.value }))}
                disabled={!canEdit('system_setup')}
              >
                <option value="IN">India</option>
                <option value="US">United States</option>
              </select>
            </div>
          </div>
          {org.country === 'US' && (
            <p className="card-sub" style={{ marginTop: -6, marginBottom: 12 }}>
              United States is set up for internal testing — new sign-ups always start on India. Currency, tax fields
              and reports below switch to US conventions for this business.
            </p>
          )}
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
            {org.country === 'US' ? (
              <>
                <div className="field">
                  <label>EIN</label>
                  <input value={org.ein ?? ''} onChange={(e) => setOrg((p) => ({ ...p, ein: e.target.value }))} placeholder="e.g. 12-3456789" disabled={!canEdit('system_setup')} />
                </div>
                <div className="field">
                  <label>Sales tax permit / resale cert. no.</label>
                  <input
                    value={org.sales_tax_permit_no ?? ''}
                    onChange={(e) => setOrg((p) => ({ ...p, sales_tax_permit_no: e.target.value }))}
                    disabled={!canEdit('system_setup')}
                  />
                </div>
              </>
            ) : (
              <div className="field">
                <label>GSTIN state code</label>
                <input value={org.gstin_state_code ?? ''} onChange={(e) => setOrg((p) => ({ ...p, gstin_state_code: e.target.value }))} placeholder="e.g. 21" maxLength={2} disabled={!canEdit('system_setup')} />
              </div>
            )}
          </div>
          {canEdit('system_setup') && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={saveOrg} disabled={savingOrg}>
              {savingOrg ? 'Saving…' : 'Save Organization'}
            </button>
          )}
        </div>
      ) : tab === 'tax' ? (
        <div className="card" style={{ maxWidth: 720 }}>
          <p className="card-sub" style={{ marginTop: 0 }}>
            Rates goods are taxed at. {org.country === 'US'
              ? 'Set up one per state you collect sales tax in (e.g. "California Sales Tax", 7.25%, state CA).'
              : 'These are your GST rates — set at sign-up, editable here if they ever change.'}
          </p>
          {taxError && <div className="login-error">{taxError}</div>}
          {taxLoading ? (
            <p className="empty-note">Loading…</p>
          ) : (
            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style={{ textAlign: 'right' }}>Tax %</th>
                    {org.country === 'US' && <th>State</th>}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {taxTypes.map((t) => (
                    <tr key={t.id}>
                      {editingTaxId === t.id ? (
                        <>
                          <td>
                            <input
                              style={{ width: '100%', font: 'inherit' }}
                              value={editTax.name}
                              onChange={(e) => setEditTax((p) => ({ ...p, name: e.target.value }))}
                            />
                          </td>
                          <td className="num" style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              style={{ width: 80, font: 'inherit', textAlign: 'right' }}
                              value={editTax.tax_percent}
                              onChange={(e) => setEditTax((p) => ({ ...p, tax_percent: e.target.value }))}
                            />
                          </td>
                          {org.country === 'US' && (
                            <td>
                              <input
                                style={{ width: 60, font: 'inherit' }}
                                value={editTax.state_code}
                                onChange={(e) => setEditTax((p) => ({ ...p, state_code: e.target.value }))}
                                placeholder="CA"
                                maxLength={2}
                              />
                            </td>
                          )}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="btn btn-primary" style={{ padding: '5px 10px' }} onClick={() => handleSaveTax(t.id)} disabled={savingTaxId === t.id}>
                              {savingTaxId === t.id ? 'Saving…' : 'Save'}
                            </button>{' '}
                            <button className="btn btn-ghost" style={{ padding: '5px 10px' }} onClick={() => setEditingTaxId(null)}>Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="strong">{t.name}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{t.tax_percent}%</td>
                          {org.country === 'US' && <td>{t.state_code ?? '—'}</td>}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {canEdit('system_setup') && (
                              <>
                                <button className="btn btn-ghost" style={{ padding: '5px 10px' }} onClick={() => startEditTax(t)}>Edit</button>{' '}
                                <button className="icon-btn" onClick={() => handleDeleteTax(t)} aria-label="Delete">✕</button>
                              </>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {taxTypes.length === 0 && (
                    <tr>
                      <td colSpan={org.country === 'US' ? 4 : 3} className="empty-note">No tax rates yet — add one below.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {canEdit('system_setup') && (
            <div className="field-row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ marginTop: 0 }}>
                <label>Name</label>
                <input
                  value={newTax.name}
                  onChange={(e) => setNewTax((p) => ({ ...p, name: e.target.value }))}
                  placeholder={org.country === 'US' ? 'e.g. California Sales Tax' : 'e.g. GST 5%'}
                />
              </div>
              <div className="field" style={{ marginTop: 0 }}>
                <label>Tax %</label>
                <input type="number" value={newTax.tax_percent} onChange={(e) => setNewTax((p) => ({ ...p, tax_percent: e.target.value }))} placeholder="e.g. 7.25" />
              </div>
              {org.country === 'US' && (
                <div className="field" style={{ marginTop: 0 }}>
                  <label>State</label>
                  <input value={newTax.state_code} onChange={(e) => setNewTax((p) => ({ ...p, state_code: e.target.value }))} placeholder="CA" maxLength={2} />
                </div>
              )}
              <button className="btn btn-primary" onClick={handleAddTax} disabled={addingTax}>
                {addingTax ? 'Adding…' : '+ Add Tax Rate'}
              </button>
            </div>
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
