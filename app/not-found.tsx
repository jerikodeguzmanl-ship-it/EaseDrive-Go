import Link from 'next/link'
export default function NF() { return <div className="wrap"><div className="panel narrow" style={{ margin: '40px auto', textAlign: 'center' }}><h2>Page not found</h2><p style={{ color: 'var(--m)', margin: '8px 0 14px' }}>This vehicle or page is not available.</p><Link className="btn" href="/">Back to vehicles</Link></div></div> }
