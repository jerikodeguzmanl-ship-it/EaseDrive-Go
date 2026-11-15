import { call } from '@/lib/api'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { action, reason } = await req.json()
  if (action === 'cancel') return call('cancel_booking', { p_id: id })
  if (action === 'complete') return call('complete_booking', { p_id: id })
  return call('decide_booking', { p_id: id, p_approve: action === 'approve', p_reason: reason ?? null })
}
