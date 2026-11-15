import { call, json } from '@/lib/api'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(req: Request) { const b = await req.json(); return call('send_message', { p_booking: b.bookingId, p_body: b.body }) }
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('bookingId')!, sb = await supabaseServer()
  const { data, error } = await sb.from('messages').select('*').eq('booking_id', id).order('created_at')
  return error ? json({ error: error.message }, 400) : json(data)
}
