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

  async function logout() {
    await supabase.auth.signOut()
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
