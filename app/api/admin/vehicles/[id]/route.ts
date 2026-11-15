import { call } from '@/lib/api'
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) { return call('review_vehicle', { p_vehicle: (await params).id, p_approve: !!(await req.json()).approve }) }
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { return call('admin_delete_vehicle', { p_vehicle: (await params).id }) }
