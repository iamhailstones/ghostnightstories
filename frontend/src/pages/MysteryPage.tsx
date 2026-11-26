import { useState } from 'react'
import { api, loadSeed } from '../api'
import { useAsync } from '../hooks'
import type { Mystery } from '../types'

export default function MysteryPage() {
  const { data, setData } = useAsync(async () => { try { return await api<Mystery[]>('/mysteries') } catch { return [(await loadSeed()).mysteries[0]] } }, [])
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  if (!data) return <p style={{ paddingTop: 40 }}>Loading…</p>
  const today = data[data.length - 1]
  if (!today) return <p style={{ paddingTop: 40 }}>No mystery has been published yet.</p>
  const send = async () => {
    try {
      const th = await api<Mystery['theories']>(`/mysteries/${today.id}/theories`, { method: 'POST', body: { text } })
      setData(data.map(m => (m.id === today.id ? { ...m, theories: th } : m))); setText(''); setMsg('')
    } catch (e) { setMsg((e as Error).message) }
  }
  return (
    <>
      <h2 className="s">{today.title}</h2>
      <div className="meta">{today.date} · Fictional incident</div>
      <p>{today.body}</p>
      <h3 style={{ fontSize: 22, margin: '18px 0 4px' }}>Evidence</h3><p>{today.clues}</p>
      <h3 style={{ fontSize: 22, margin: '18px 0 4px' }}>Reader theories</h3>
      {today.theories.map((t, i) => <div key={i} className="card" style={{ cursor: 'default' }}><p>{t.text}</p><div className="meta">{t.author}</div></div>)}
      <div className="ctl"><textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Your theory" /><button className="go" onClick={send}>Submit theory</button></div>
      {msg && <p className="err">{msg}</p>}
      <h3 style={{ fontSize: 22, margin: '18px 0 4px' }}>The revelation</h3>
      <p>{today.reveal || 'Locked until tomorrow.'}</p>
      {data.length > 1 && <><h3 style={{ fontSize: 22, margin: '18px 0 4px' }}>Earlier mysteries</h3>{data.slice(0, -1).map(m => <div key={m.id} className="card" style={{ cursor: 'default' }}><h3>{m.title}</h3><p>{m.reveal}</p></div>)}</>}
    </>
  )
}
