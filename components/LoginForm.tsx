'use client'
import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

const human = (m: string) => /invalid login/i.test(m) ? 'Wrong email or password.' : /not confirmed/i.test(m) ? 'Please confirm your email first. Check your inbox.' : /already registered/i.test(m) ? 'This email already has an account. Log in instead.' : /rate limit|too many/i.test(m) ? 'Too many attempts. Please wait a minute.' : /fetch|network/i.test(m) ? 'Network error. Check your connection.' : m

export default function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [mode, setMode] = useState<'in' | 'up'>('in'), [email, setE] = useState(''), [pw, setPw] = useState(''), [name, setName] = useState(''), [show, setShow] = useState(false)
  const [msg, setMsg] = useState(linkError ? 'That link is invalid or expired. Please try again.' : ''), [ok, setOk] = useState(false), [busy, setBusy] = useState(false)
  const say = (m: string, good = false) => { setMsg(m); setOk(good) }

  async function go(e: React.FormEvent) {
    e.preventDefault(); say('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return say('Enter a valid email address.')
    if (mode === 'up' && !name.trim()) return say('Enter your full name.')
    if (pw.length < 8) return say('Password must be at least 8 characters.')
    setBusy(true)
    try {
      const sb = supabaseBrowser(), em = email.trim()
      if (mode === 'in') {
        const { error } = await sb.auth.signInWithPassword({ email: em, password: pw })
        if (error) return say(human(error.message))
        window.location.assign(next ?? '/portal') // full reload so header/menus always match the session
      } else {
        const { data, error } = await sb.auth.signUp({ email: em, password: pw, options: { data: { full_name: name.trim() }, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next ?? '/')}` } })
        if (error) return say(human(error.message))
        if (data.user && data.user.identities?.length === 0) return say('This email already has an account. Log in instead.')
        if (!data.session) return say('Account created. Check your email to confirm it, then log in.', true)
        window.location.assign(next ?? '/')
      }
    } catch (err: any) { say(human(err?.message || 'Something went wrong. Try again.')) } finally { setBusy(false) }
  }
  async function forgot() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return say('Enter your email above first.')
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/auth/callback?next=/reset-password` })
    error ? say(human(error.message)) : say('Password reset link sent. Check your email.', true)
  }
  return (<form className="panel narrow" style={{ margin: '24px auto' }} onSubmit={go} noValidate>
    <h2>{mode === 'in' ? 'Welcome back' : 'Create your account'}</h2><p style={{ color: 'var(--m)', margin: '4px 0 14px' }}>{next ? 'Log in to continue. Your selected vehicle and dates are saved.' : 'Book trusted rental vehicles from local partners.'}</p>
    {mode === 'up' && <><label>Full name</label><input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></>}
    <label>Email</label><input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setE(e.target.value)} />
    <label>Password</label><input type={show ? 'text' : 'password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={show} onChange={() => setShow(!show)} />Show password</label>
    {msg && <small className={ok ? 'ok' : 'err'} role="alert" style={{ marginTop: 8 }}>{msg}</small>}
    <button className="btn full" disabled={busy} style={{ marginTop: 10 }}>{busy ? 'Please wait…' : mode === 'in' ? 'Log in' : 'Sign up'}</button>
    <p style={{ marginTop: 14, textAlign: 'center' }}><a href="#" onClick={(e) => { e.preventDefault(); say(''); setMode(mode === 'in' ? 'up' : 'in') }}><u>{mode === 'in' ? 'No account? Sign up' : 'Have an account? Log in'}</u></a>{mode === 'in' && <> · <a href="#" onClick={(e) => { e.preventDefault(); forgot() }}><u>Forgot password?</u></a></>}</p></form>)
}
