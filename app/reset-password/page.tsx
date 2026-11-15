'use client'
import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import PhoneFrame from '@/components/PhoneFrame'

export default function Reset() {
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  async function go(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    if (pw.length < 8) return setMsg('Password must be at least 8 characters.')
    if (pw !== pw2) return setMsg('Passwords do not match.')
    setBusy(true); const { error } = await supabaseBrowser().auth.updateUser({ password: pw }); setBusy(false)
    if (error) return setMsg(error.message)
    window.location.assign('/portal')
  }
  return (<PhoneFrame active="profile"><div className="customer-screen"><form className="panel narrow" style={{ margin: '24px auto' }} onSubmit={go}><h2>Set a new password</h2>
    <label>New password</label><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
    <label>Confirm password</label><input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
    {msg && <small className="err" role="alert">{msg}</small>}<button className="btn full" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button></form></div></PhoneFrame>)
}
