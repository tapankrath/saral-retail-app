import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_LABEL = { trial: 'Trial', active: 'Active', past_due: 'Past due', cancelled: 'Cancelled' }
const STATUSES = ['trial', 'active', 'past_due', 'cancelled']

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN') : '—'
}

function fmtDateTime(d) {
  if (!d) return 'never'
  const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(d).toLocaleDateString('en-IN')
}

function daysLeft(trialEndsAt) {
  if (!trialEndsAt) return null
  return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// Only reachable by a platform admin — this is the single place to see every
// organization on Saral Retail, what stage they're at (trial vs paying),
// how much they've actually used the product, and to record a payment that
// was collected outside the app (there's no payment gateway wired up yet)
// by switching them onto the plan they paid for.
export default function PlatformAdmin() {
  const [orgs, setOrgs] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  async function load() {
    setLoading(true)
    const [{ data: orgRows }, { data: planRows }] = await Promise.all([
      supabase.from('v_admin_org_overview').select('*').order('signed_up_at', { ascending: false }),
      supabase.from('subscription_plans').select('*').order('sort_order'),
    ])
    setOrgs(orgRows ?? [])
    setPlans(planRows ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo(() => {
    const s = { total: orgs.length, trial: 0, expiringSoon: 0, active: 0, pastDue: 0, cancelled: 0 }
    for (const o of orgs) {
      if (o.subscription_status === 'trial') {
        s.trial++
        const dl = daysLeft(o.trial_ends_at)
        if (dl !== null && dl <= 3) s.expiringSoon++
      } else if (o.subscription_status === 'active') s.active++
      else if (o.subscription_status === 'past_due') s.pastDue++
      else if (o.subscription_status === 'cancelled') s.cancelled++
    }
    return s
  }, [orgs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orgs.filter((o) => {
      if (statusFilter !== 'all' && o.subscription_status !== statusFilter) return false
      if (!q) return true
      return (
        o.name?.toLowerCase().includes(q) ||
        o.short_code?.toLowerCase().includes(q) ||
        o.owner_name?.toLowerCase().includes(q) ||
        o.owner_login?.toLowerCase().includes(q) ||
        o.owner_email?.toLowerCase().includes(q) ||
        o.owner_mobile?.includes(q)
      )
    })
  }, [orgs, search, statusFilter])

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
          <h1>Platform Admin</h1>
          <p className="sub">Every organization on Saral Retail — signups, trials, usage, and billing</p>
        </div>
      </div>

      <div className="admin-stat-row">
        <div className="admin-stat"><div className="n">{stats.total}</div><div className="l">Organizations</div></div>
        <div className="admin-stat"><div className="n">{stats.trial}</div><div className="l">On trial</div></div>
        <div className={`admin-stat${stats.expiringSoon > 0 ? ' warn' : ''}`}><div className="n">{stats.expiringSoon}</div><div className="l">Trial ends ≤3 days</div></div>
        <div className="admin-stat ok"><div className="n">{stats.active}</div><div className="l">Active (paying)</div></div>
        <div className={`admin-stat${stats.pastDue > 0 ? ' warn' : ''}`}><div className="n">{stats.pastDue}</div><div className="l">Past due</div></div>
        <div className="admin-stat"><div className="n">{stats.cancelled}</div><div className="l">Cancelled</div></div>
      </div>

      <div className="admin-filters">
        <input
          placeholder="Search by org, owner, login, email or mobile…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
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
                    <th>Owner</th>
                    <th>Signed up</th>
                    <th>Status</th>
                    <th>Trial</th>
                    <th>Plan</th>
                    <th>Requested</th>
                    <th>Users</th>
                    <th>Usage</th>
                    <th>Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const dl = daysLeft(o.trial_ends_at)
                    const lastActive = [o.last_login_at, o.last_voucher_at].filter(Boolean).sort().pop()
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
                          {o.owner_name ?? '—'}
                          <div className="sub" style={{ fontSize: '.7rem' }}>{o.owner_login}{o.owner_mobile ? ` · ${o.owner_mobile}` : ''}</div>
                        </td>
                        <td>{fmtDate(o.signed_up_at)}</td>
                        <td>
                          <span className={`chip ${o.subscription_status === 'active' ? 'ok' : o.subscription_status === 'trial' ? '' : 'out'}`}>
                            {STATUS_LABEL[o.subscription_status] ?? o.subscription_status}
                          </span>
                        </td>
                        <td>
                          {o.subscription_status === 'trial'
                            ? (dl !== null ? (dl >= 0 ? `${dl}d left` : 'expired') : '—')
                            : '—'}
                        </td>
                        <td>{o.plan_name ?? '—'}</td>
                        <td>{o.requested_plan_name ?? '—'}</td>
                        <td className="tnum">{o.active_user_count}/{o.total_user_count}</td>
                        <td className="tnum">{o.goods_count}g · {o.sales_voucher_count + o.purchase_voucher_count}v</td>
                        <td>{fmtDateTime(lastActive)}</td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} className="empty-note">No organizations match.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            {!selected ? (
              <p className="empty-note">Select an organization to see full detail and manage its billing.</p>
            ) : (
              <>
                <h3>{selected.name}</h3>
                <p className="sub">{selected.short_code} · signed up {fmtDate(selected.signed_up_at)}</p>
                <p className="sub" style={{ marginTop: 4 }}>
                  Owner: {selected.owner_name} ({selected.owner_login})
                  {selected.owner_email ? ` · ${selected.owner_email}` : ''}
                  {selected.owner_mobile ? ` · ${selected.owner_mobile}` : ''}
                </p>
                <p className="sub" style={{ marginTop: 4 }}>
                  {selected.total_user_count} user{selected.total_user_count === 1 ? '' : 's'} ({selected.active_user_count} active) ·{' '}
                  {selected.goods_count} goods · {selected.sales_voucher_count} sales · {selected.purchase_voucher_count} purchases
                </p>
                <p className="sub" style={{ marginTop: 4 }}>
                  Last login {fmtDateTime(selected.last_login_at)} · last voucher {fmtDateTime(selected.last_voucher_at)}
                </p>

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
