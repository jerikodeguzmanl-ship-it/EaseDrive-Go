import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const b = await req.json()
  const sb = await supabaseServer()
  const { data, error } = await sb.rpc('quote_booking', { p_vehicle: b.vehicleId, p_service: b.service, p_start: b.start, p_end: b.end, p_delivery: !!b.delivery })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
