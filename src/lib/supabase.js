import { createClient } from '@supabase/supabase-js'

// The publishable key is safe to ship in client code by design — it can
// only do what row-level security in the database allows for whoever is
// signed in (or nothing at all, if no one is signed in yet).
const SUPABASE_URL = 'https://rjxjlxlgpwvqrtnkcvkg.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kcUNWxvJ2iLYtcFXOIJ-dQ_wr9VsTKX'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
