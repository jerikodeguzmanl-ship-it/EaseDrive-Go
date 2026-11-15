import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import LoginForm from '@/components/LoginForm'
import PhoneFrame from '@/components/PhoneFrame'

const safe = (n?: string) => (n && n.startsWith('/') && !n.startsWith('//') ? n : undefined)

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser()
  if (user) redirect(safe(next) ?? '/portal')
  return <PhoneFrame active="profile"><div className="customer-screen"><LoginForm next={safe(next)} linkError={error === 'link'} /></div></PhoneFrame>
}
