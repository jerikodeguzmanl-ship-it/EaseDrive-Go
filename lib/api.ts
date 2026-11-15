import { NextResponse } from 'next/server'
import { supabaseServer } from './supabase/server'

export const json = (d: unknown, s = 200) => NextResponse.json(d, { status: s })

// Calls a Postgres function as the logged-in user. RLS + function checks enforce permissions.
export async function call(fn: string, args: Record<string, unknown> = {}) {
  const sb = await supabaseServer()
  const { data, error } = await sb.rpc(fn, args)
  if (error) return json({ error: error.code === '23P01' ? 'Dates already confirmed for another booking' : error.message }, error.message === 'Login required' ? 401 : 400)
  return json(data ?? { ok: true })
}

// Server-side admin check for API routes that do more than call one SQL function.
export async function adminOnly() {
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser()
  if (!user) return { err: json({ error: 'Login required' }, 401) }
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return { err: json({ error: 'Admin only' }, 403) }
  return { sb, user }
}
