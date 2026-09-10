import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function daysLeft(trialEndsAt) {
  if (!trialEndsAt) return null
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function money(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export default function Billing() {
  const { profile, requestPlanUpgrade } = useAuth()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyPlanId, setBusyPlanId] = useState(null)
  const [message, setMessage] = useState(null)

  const org = profile?.organizations

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setPlans(data ?? [])
        setLoading(false)
      })
  }, [])

  const remaining = useMemo(() => daysLeft(org?.trial_ends_at), [org?.trial_ends_at])
  const currentPlan = plans.find((p) => p.id === org?.plan_id)
  const requestedPlan = plans.find((p) => p.id === org?.requested_plan_id)

  async function handleRequest(planId) {
    setMessage(null)
    setBusyPlanId(planId)
    const { error } = await requestPlanUpgrade(planId)
    setBusyPlanId(null)
    if (error) {
      setMessage({ ok: false, text: error })
      return
    }
    setMessage({ ok: true, text: 'Request sent — we’ll be in touch shortly to confirm payment and switch you over.' })
  }

  let statusBanner = null
  if (org?.subscription_status === 'trial') {
    const urgent = remaining !== null && remaining <= 3
    statusBanner = (
      <div className={`callout-banner ${urgent ? 'warn' : ''}`}>
        {remaining !== null && remaining >= 0
          ? <><strong>{remaining} day{remaining === 1 ? '' : 's'}</strong> left in your free trial.</>
          : <><strong>Your trial has ended.</strong> Choose a plan below to keep billing, inventory and reports working.</>}
        {' '}Pick a plan below any time — nothing is charged automatically.
      </div>
    )
  } else if (org?.subscription_status === 'active') {
    statusBanner = (
      <div className="callout-banner ok">
        You're on the <strong>{currentPlan?.name ?? 'active'}</strong> plan.
      </div>
    )
  } else if (org?.subscription_status === 'past_due') {
    statusBanner = (
      <div className="callout-banner warn">
        <strong>Payment due.</strong> Your subscription is marked past due — please renew to avoid interruption.
      </div>
    )
  } else if (org?.subscription_status === 'cancelled') {
    statusBanner = (
      <div className="callout-banner warn">
        <strong>Subscription cancelled.</strong> Choose a plan below to reactivate.
      </div>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Billing &amp; Plan</h1>
          <p className="sub">Your subscription status and available plans</p>
        </div>
      </div>

      {statusBanner}

      {org?.requested_plan_id && (
        <div className="callout-banner" style={{ marginTop: 12 }}>
          Upgrade to <strong>{requestedPlan?.name ?? 'the requested plan'}</strong> requested
          {org?.upgrade_requested_at ? ' on ' + new Date(org.upgrade_requested_at).toLocaleDateString('en-IN') : ''}.
          We'll confirm payment with you and switch your organization over shortly.
        </div>
      )}

      {org?.billing_notes && (
        <div className="callout-banner" style={{ marginTop: 12 }}>
          <strong>Note from Saral Retail:</strong> {org.billing_notes}
        </div>
      )}

      {message && (
        <div className={message.ok ? 'login-hint' : 'login-error'} style={{ marginTop: 12 }}>
          {message.text}
        </div>
      )}

      {loading ? (
        <p className="empty-note">Loading plans…</p>
      ) : (
        <div className="plan-grid">
          {plans.map((p) => {
            const isCurrent = p.id === org?.plan_id
            const isRequested = p.id === org?.requested_plan_id
            return (
              <div key={p.id} className={`card plan-card${isCurrent ? ' current' : ''}`}>
                {isCurrent && <span className="plan-badge">Current plan</span>}
                <h3>{p.name}</h3>
                <div className="plan-price">
                  {p.is_custom_pricing ? 'Custom' : money(p.price_monthly)}
                  {!p.is_custom_pricing && <span className="per"> / month</span>}
                </div>
                <p className="sub" style={{ marginTop: 4 }}>
                  {p.max_branches ? `Up to ${p.max_branches} branch${p.max_branches > 1 ? 'es' : ''}` : 'Unlimited branches'}
                </p>
                <p style={{ fontSize: '.86rem', marginTop: 8 }}>{p.tagline}</p>
                <ul className="plan-features">
                  {(p.features ?? []).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {profile?.is_owner ? (
                  <button
                    className={`btn ${isCurrent ? 'btn-ghost' : 'btn-primary'} btn-block`}
                    disabled={isCurrent || isRequested || busyPlanId === p.id}
                    onClick={() => handleRequest(p.id)}
                  >
                    {isCurrent
                      ? 'Current plan'
                      : isRequested
                        ? 'Requested — pending'
                        : busyPlanId === p.id
                          ? 'Sending…'
                          : p.is_custom_pricing
                            ? 'Request a quote'
                            : 'Request this plan'}
                  </button>
                ) : (
                  <p className="empty-note" style={{ marginTop: 10 }}>Only the owner can change plans.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
