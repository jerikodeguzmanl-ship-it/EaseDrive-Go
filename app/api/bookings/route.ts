import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// Totals are ignored from the client: the database recomputes everything.
export async function POST(req: Request) {
  const b = await req.json()
  const sb = await supabaseServer()
  const { data: { user }, error: authError } = await sb.auth.getUser()
  if (authError?.name === 'AuthSessionMissingError') return NextResponse.json({ error: 'Login required' }, { status: 401 })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })
  const { data, error } = await sb.rpc('create_booking', { p_vehicle: b.vehicleId, p_service: b.service, p_start: b.start, p_end: b.end, p_delivery: !!b.delivery, p_time: b.time ?? null, p_pass: Number(b.passengers) || 1, p_addr: b.address ?? '', p_notes: b.notes ?? '' })
  if (error) return NextResponse.json({ error: error.message }, { status: error.message === 'Login required' ? 401 : 400 })
  return NextResponse.json(data, { status: 201 })
}
