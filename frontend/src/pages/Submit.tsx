import { useState } from 'react'
import { api } from '../api'
import { CATEGORIES } from './Explore'

export default function Submit() {
  const [f, setF] = useState({ title: '', category: CATEGORIES[0], desc: '', body: '', author: '', anonymous: false, website: '' })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const set = (k: string, v: string | boolean) => setF(p => ({ ...p, [k]: v }))
  const send = async () => {
    setErr(''); setMsg('')
    try { await api('/submissions', { method: 'POST', body: f }); setMsg('Received. Status: In moderation. It will not appear until a moderator approves it.'); setF({ ...f, title: '', desc: '', body: '' }) }
    catch (e) { setErr((e as Error).message) }
  }
  return (
    <>
      <h2 className="s">Submit your story</h2>
      <p className="meta">Every story is reviewed by a moderator before it appears. Submit only stories you wrote yourself.</p>
      <div style={{ display: 'grid', gap: 10 }}>
        <input type="text" placeholder="Title" value={f.title} onChange={e => set('title', e.target.value)} maxLength={120} />
        <select value={f.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <input type="text" placeholder="One-sentence description" value={f.desc} onChange={e => set('desc', e.target.value)} maxLength={300} />
        <textarea rows={8} placeholder="Full story (at least 200 characters)" value={f.body} onChange={e => set('body', e.target.value)} />
        <input type="text" placeholder="Author name" value={f.author} onChange={e => set('author', e.target.value)} maxLength={40} />
        <label className="ctl"><input type="checkbox" checked={f.anonymous} onChange={e => set('anonymous', e.target.checked)} /> Post as anonymous</label>
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={e => set('website', e.target.value)} style={{ position: 'absolute', left: -9999 }} />
        <div><button className="go" onClick={send}>Send for review</button></div>
        {msg && <p className="ok">{msg}</p>}{err && <p className="err">{err}</p>}
      </div>
    </>
  )
}
