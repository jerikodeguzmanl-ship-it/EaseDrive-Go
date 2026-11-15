'use client'
export default function Err({ error, reset }: { error: Error; reset: () => void }) {
  return (<div className="wrap"><div className="panel narrow" style={{ margin: '40px auto', textAlign: 'center' }}><h2>Something went wrong</h2>
    <p style={{ color: 'var(--m)', margin: '8px 0 14px' }}>{process.env.NODE_ENV === 'development' ? error.message : 'Please try again. If it keeps happening, check your Supabase settings (.env.local and the SQL files).'}</p>
    <button className="btn" onClick={reset}>Try again</button> <a className="btn dk" style={{ marginTop: 8 }} href="/">Go home</a></div></div>)
}
