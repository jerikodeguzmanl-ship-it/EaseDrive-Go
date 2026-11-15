import { call } from '@/lib/api'
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { return call('admin_delete_booking', { p_id: (await params).id }) }
