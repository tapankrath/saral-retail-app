import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_LABEL = { trial: 'Trial', active: 'Active', past_due: 'Past due', cancelled: 'Cancelled' }
const STATUSES = ['trial', 'active', 'past_due', 'cancelled']

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN') : '—'
}

function daysLeft(trialEndsAt) {
  if (!trialEndsAt) return null
  return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// Only reachable by a platform admin — this manages billing across every
// organization on Saral Retail, not just the signed-in owner's own business.
// There's no payment gateway wired up yet, so this is where a payment
// received outside the app (bank transfer, UPI, invoice) gets recorded by
// switching the organization over to the plan they paid for.
export default function PlatformAdmin() {
  const [orgs, setOrgs] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  async function load() {
    setLoading(true)
    const [{ data: orgRows }, { data: planRows }] = await Promise.all([
      supabase.from('v_admin_org_billing').select('*').order('created_at', { ascending: false }),
      supabase.from('subscription_plans').select('*').order('sort_order'),
    ])
    setOrgs(orgRows ?? [])
    setPlans(planRows ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function selectOrg(org) {
    setSelectedId(org.organization_id)
    setMsg(null)
    setForm({
      subscription_status: org.subscription_status,
      plan_id: org.plan_id ?? '',
      trial_ends_at: org.trial_ends_at ? org.trial_ends_at.slice(0, 10) : '',
      billing_notes: org.billing_notes ?? '',
      clear_upgrade_request: false,
    })
  }

  const selected = orgs.find((o) => o.organization_id === selectedId)

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    const { error } = await supabase.rpc('admin_set_org_billing', {
      p_org_id: selectedId,
      p_subscription_status: form.subscription_status || null,
      p_plan_id: form.plan_id || null,
      p_trial_ends_at: form.trial_ends_at ? new Date(form.trial_ends_at + 'T23:59:59').toISOString() : null,
      p_billing_notes: form.billing_notes || null,
      p_clear_upgrade_request: !!form.clear_upgrade_request,
    })
    setSaving(false)
    if (error) {
      setMsg({ ok: false, text: error.message })
      return
    }
    setMsg({ ok: true, text: 'Saved.' })
    await load()
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Platform Billing Admin</h1>
          <p className="sub">Every organization on Saral Retail — trial status, plan, and manual billing notes</p>
        </div>
      </div>

      {loading ? (
        <p className="empty-note">Loading…</p>
      ) : (
        <div className="voucher-grid">
          <div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Status</th>
                    <th>Plan</th>
                    <th>Trial ends</th>
                    <th>Requested</th>
                    <th>Users</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((o) => {
                    const dl = daysLeft(o.trial_ends_at)
                    return (
                      <tr
                        key={o.organization_id}
                        onClick={() => selectOrg(o)}
                        style={{ cursor: 'pointer', background: selectedId === o.organization_id ? 'var(--accent-soft)' : undefined }}
                      >
                        <td className="strong">
                          {o.name}
                          <div className="sub" style={{ fontSize: '.7rem' }}>{o.short_code} · {o.city ?? '—'}</div>
                        </td>
                        <td>
                          <span className={`chip ${o.subscription_status === 'active' ? 'ok' : o.subscription_status === 'trial' ? '' : 'out'}`}>
                            {STATUS_LABEL[o.subscription_status] ?? o.subscription_status}
                          </span>
                        </td>
                        <td>{o.plan_name ?? '—'}</td>
                        <td>{o.subscription_status === 'trial' ? (dl !== null ? (dl >= 0 ? `${dl}d left` : 'expired') : '—') : '—'}</td>
                        <td>{o.requested_plan_name ?? '—'}</td>
                        <td className="tnum">{o.active_user_count}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            {!selected ? (
              <p className="empty-note">Select an organization to manage its billing.</p>
            ) : (
              <>
                <h3>{selected.name}</h3>
                <p className="sub">{selected.short_code} · created {fmtDate(selected.created_at)}</p>
                <p className="sub" style={{ marginTop: 4 }}>{selected.email ?? '—'} {selected.mobile ? `· ${selected.mobile}` : ''}</p>

                {msg && <div className={msg.ok ? 'login-hint' : 'login-error'} style={{ marginTop: 10 }}>{msg.text}</div>}

                <div className="field" style={{ marginTop: 14 }}>
                  <label>Subscription status</label>
                  <select
                    value={form.subscription_status}
                    onChange={(e) => setForm((p) => ({ ...p, subscription_status: e.target.value }))}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Plan</label>
                  <select value={form.plan_id} onChange={(e) => setForm((p) => ({ ...p, plan_id: e.target.value }))}>
                    <option value="">No plan assigned</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Trial ends (only relevant while status is Trial)</label>
                  <input
                    type="date"
                    value={form.trial_ends_at}
                    onChange={(e) => setForm((p) => ({ ...p, trial_ends_at: e.target.value }))}
                  />
                </div>

                <div className="field">
                  <label>Billing notes (visible to the org owner)</label>
                  <textarea
                    rows={3}
                    value={form.billing_notes}
                    onChange={(e) => setForm((p) => ({ ...p, billing_notes: e.target.value }))}
                    placeholder="e.g. Paid ₹1,999 via UPI on 12 Sep, ref #4471 — switched to Growth."
                  />
                </div>

                {selected.requested_plan_id && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.82rem', marginTop: 4, marginBottom: 14 }}>
                    <input
                      type="checkbox"
                      checked={!!form.clear_upgrade_request}
                      onChange={(e) => setForm((p) => ({ ...p, clear_upgrade_request: e.target.checked }))}
                    />
                    Clear the pending request for {selected.requested_plan_name}
                  </label>
                )}

                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save billing changes'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
