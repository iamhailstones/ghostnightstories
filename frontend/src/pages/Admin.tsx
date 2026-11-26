import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAsync } from '../hooks'
import { useAuth } from '../auth'
import type { Story, Video } from '../types'

export default function Admin() {
  const { user } = useAuth()
  const stats = useAsync(() => api<Record<string, number>>('/admin/stats'), [user?.id])
  const queue = useAsync(() => api<Story[]>('/admin/queue'), [user?.id])
  const vids = useAsync(() => api<Video[]>('/admin/videos'), [user?.id])
  const all = useAsync(() => api<Story[]>('/admin/stories'), [user?.id])
  const [url, setUrl] = useState('')
  const [level, setLevel] = useState('Mild')
  const [cat, setCat] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  if (!user || user.role !== 'admin') return <p style={{ paddingTop: 40 }}>Administrator access only. <Link to="/login" style={{ color: 'var(--hot)' }}>Sign in</Link></p>
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg('')
    try { await fn(); setMsg(ok); queue.setData(await api('/admin/queue')); vids.setData(await api('/admin/videos')); stats.setData(await api('/admin/stats')); all.setData(await api('/admin/stories')) }
    catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  const vid = vids.data ?? []
  return (
    <>
      <h2 className="s">Admin dashboard</h2>
      {msg && <p className="meta" role="status">{msg}</p>}
      <div className="stat">{stats.data && Object.entries(stats.data).map(([k, v]) => <div key={k}><b>{v}</b>{k}</div>)}</div>

      <h2 className="s" style={{ fontSize: 24 }}>All stories</h2>
      <div className="ctl"><Link to="/admin/story/new"><button className="go">New story</button></Link></div>
      {all.data?.map(s => (
        <div className="card" key={s.id} style={{ cursor: 'default' }}>
          <div className="meta">{s.status} · {s.category}</div><h3>{s.title}</h3>
          <div className="ctl"><Link to={`/admin/story/${s.id}`}><button className="ghost">Edit</button></Link></div>
        </div>
      ))}

      <h2 className="s" style={{ fontSize: 24 }}>Moderation and review queue</h2>
      {queue.data?.length === 0 && <p>Nothing waiting.</p>}
      {queue.data?.map(s => (
        <div className="card" key={s.id} style={{ cursor: 'default' }}>
          <div className="meta">Community submission · {s.author}</div>
          <h3>{s.title}</h3><p>{s.body.slice(0, 2).join(' ')}</p>
          <div className="ctl">
            <button className="ghost" disabled={busy} onClick={() => run(() => api(`/admin/stories/${s.id}/status`, { method: 'POST', body: { status: 'published' } }), 'Published')}>Approve</button>
            <button className="ghost" disabled={busy} onClick={() => run(() => api(`/admin/stories/${s.id}/status`, { method: 'POST', body: { status: 'rejected' } }), 'Rejected')}>Reject</button>
            <button className="ghost" disabled={busy} onClick={() => confirm('Delete permanently?') && run(() => api(`/admin/stories/${s.id}`, { method: 'DELETE' }), 'Deleted')}>Delete</button>
          </div>
        </div>
      ))}

      <h2 className="s" style={{ fontSize: 24 }}>Jumpscare video manager</h2>
      <div style={{ overflowX: 'auto' }}><table>
        <thead><tr><th>URL</th><th>Category</th><th>Level</th><th>Status</th><th>On</th><th /></tr></thead>
        <tbody>{vid.map(v => (
          <tr key={v.id}>
            <td>{v.url}</td><td>{v.category}</td><td>{v.level}</td>
            <td className={v.ok ? 'ok' : 'bad'}>{v.ok ? 'Playable' : `Broken${v.error ? ': ' + v.error : ''}`}</td>
            <td><button className={'tg' + (v.enabled ? ' on' : '')} aria-label="Enable video" onClick={() => run(() => api(`/admin/videos/${v.id}`, { method: 'PATCH', body: { enabled: !v.enabled } }), 'Updated')} /></td>
            <td><button className="ghost" onClick={() => run(() => api(`/admin/videos/${v.id}/test`, { method: 'POST' }), 'Tested')}>Test</button> <button className="ghost" onClick={() => run(() => api(`/admin/videos/${v.id}`, { method: 'DELETE' }), 'Removed')}>Remove</button></td>
          </tr>))}</tbody>
      </table></div>
      <div className="ctl">
        <input type="text" placeholder="https://host.example/clip.mp4" value={url} onChange={e => setUrl(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <input type="text" placeholder="Category label" value={cat} onChange={e => setCat(e.target.value)} style={{ width: 150 }} />
        <select value={level} onChange={e => setLevel(e.target.value)} style={{ width: 'auto' }}><option>Mild</option><option>Extreme</option><option>Nightmare</option></select>
        <button className="go" disabled={busy} onClick={() => run(() => api('/admin/videos', { method: 'POST', body: { url, category: cat, level } }).then(() => setUrl('')), 'Checked and added (see status)')}>Add and test</button>
      </div>
      <p className="meta">Only add footage you own or have written permission to use. Videos are checked server-side before they can play.</p>
    </>
  )
}
