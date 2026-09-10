import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [profile, setProfile] = useState(null)
  const [permissions, setPermissions] = useState(null)

  async function loadProfileAndPermissions(userId) {
    const { data: profileRow } = await supabase
      .from('users')
      .select('*, branches(id, name, voucher_prefix), organizations(id, name, short_code)')
      .eq('id', userId)
      .single()
    setProfile(profileRow ?? null)

    const { data: permRows } = await supabase
      .from('user_permissions')
      .select('level, extra_flags, permission_modules(code, label)')
      .eq('user_id', userId)
    const map = {}
    for (const row of permRows ?? []) {
      map[row.permission_modules.code] = { level: row.level, flags: row.extra_flags }
    }
    setPermissions({ isOwner: !!profileRow?.is_owner, modules: map })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadProfileAndPermissions(session.user.id)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadProfileAndPermissions(session.user.id)
      } else {
        setProfile(null)
        setPermissions(null)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loginWithLoginNameAndOrg(loginName, orgShortCode, password) {
    const { data: email, error: resolveError } = await supabase.rpc('resolve_login_email', {
      p_login_name: loginName,
      p_org_short_code: orgShortCode,
    })
    if (resolveError || !email) {
      return { error: 'Invalid username or password' }
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      return { error: 'Invalid username or password' }
    }
    supabase.rpc('touch_last_login').then(() => {})
    return { error: null }
  }

  async function signUpOrganization(fields) {
    const { data, error: signupError } = await supabase.rpc('signup_organization', {
      p_org_name: fields.orgName,
      p_short_code: fields.shortCode,
      p_owner_full_name: fields.ownerFullName,
      p_login_name: fields.loginName,
      p_password: fields.password,
      p_owner_mobile: fields.ownerMobile || null,
      p_contact_email: fields.contactEmail || null,
      p_city: fields.city || null,
      p_state: fields.state || null,
      p_recovery_pin: fields.recoveryPin || null,
    })
    if (signupError) {
      return { error: signupError.message }
    }
    const row = Array.isArray(data) ? data[0] : data
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: row.login_email,
      password: fields.password,
    })
    if (signInError) {
      return {
        error: `Account created, but automatic sign-in failed. Sign in with ${fields.loginName}@${fields.shortCode}.`,
      }
    }
    return { error: null }
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  // Self-service "forgot password" — since login accounts use synthetic,
  // non-deliverable email addresses under the hood, Supabase's normal
  // email-link reset can't be used. Instead each person can set a 6-digit
  // recovery PIN and use it (together with their login name + org code) to
  // set a brand-new password without needing to be signed in.
  async function resetPasswordWithPin(loginName, orgShortCode, pin, newPassword) {
    const { error } = await supabase.rpc('reset_password_with_pin', {
      p_login_name: loginName,
      p_org_short_code: orgShortCode,
      p_recovery_pin: pin,
      p_new_password: newPassword,
    })
    if (error) {
      return { error: 'That login, organization code, or recovery PIN was not recognized.' }
    }
    return { error: null }
  }

  async function setMyRecoveryPin(pin) {
    const { error } = await supabase.rpc('set_my_recovery_pin', { p_recovery_pin: pin })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function changeMyPassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }
    return { error: null }
  }

  function moduleLevel(code) {
    if (permissions?.isOwner) return 'full'
    return permissions?.modules?.[code]?.level ?? 'none'
  }
  function canView(code) {
    return moduleLevel(code) !== 'none'
  }
  function canAdd(code) {
    return ['add_only', 'full'].includes(moduleLevel(code))
  }
  function canEdit(code) {
    return moduleLevel(code) === 'full'
  }

  const value = {
    session,
    profile,
    permissions,
    loading: session === undefined || (session && !permissions),
    loginWithLoginNameAndOrg,
    signUpOrganization,
    resetPasswordWithPin,
    setMyRecoveryPin,
    changeMyPassword,
    logout,
    moduleLevel,
    canView,
    canAdd,
    canEdit,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
