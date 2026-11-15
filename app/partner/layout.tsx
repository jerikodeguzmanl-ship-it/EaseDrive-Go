import { requireRole } from '@/lib/supabase/server'
export default async function L({ children }: { children: React.ReactNode }) { await requireRole(['owner', 'admin']); return children }
