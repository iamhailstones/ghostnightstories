import { useState } from 'react'
import { api, loadSeed } from '../api'
import { useAsync } from '../hooks'
import type { Interactive } from '../types'

export default function InteractivePage() {
  const { data } = useAsync(async () => { try { return await api<Interactive[]>('/interactive') } catch { return (await loadSeed()).interactive } }, [])
  const [idx, setIdx] = useState(0)
  const [node, setNode] = useState<string | null>(null)
  const [path, setPath] = useState<string[]>([])
  const [endings, setEndings] = useState<Record<string, string[]>>({})
  if (!data) return <p style={{ paddingTop: 40 }}>Loading…</p>
  const st = data[idx]
  const cur = st.nodes[node ?? st.start]
  const choose = (to: string) => {
    const n = st.nodes[to]
    setPath(p => [...p, to]); setNode(to)
    if (n.ending) setEndings(e => ({ ...e, [st.id]: [...new Set([...(e[st.id] ?? []), to])] }))
  }
  const found = endings[st.id]?.length ?? 0
  const total = Object.values(st.nodes).filter(n => n.ending).length
  return (
    <>
      <h2 className="s">Interactive stories</h2>
      <div className="ctl">{data.map((d, i) => <button key={d.id} className={'ghost' + (i === idx ? ' on' : '')} onClick={() => { setIdx(i); setNode(null); setPath([]) }}>{d.name}</button>)}</div>
      <div className="card" style={{ cursor: 'default' }}>
        <div className="meta">{cur.ending ? 'Ending reached' : `Decision ${path.length + 1}`} · Endings found {found} of {total} · Survival: {cur.ending ? 'decided' : path.length > 1 ? 'at risk' : 'alive'}</div>
        <h3 style={{ fontSize: 26, lineHeight: 1.2 }}>{cur.text}</h3>
        <div style={{ marginTop: 12 }}>
          {cur.options.map(o => <button key={o.label} className="opt" onClick={() => { if (o.to === st.start) { setNode(null); setPath([]) } else choose(o.to) }}>{o.label}</button>)}
        </div>
      </div>
    </>
  )
}
