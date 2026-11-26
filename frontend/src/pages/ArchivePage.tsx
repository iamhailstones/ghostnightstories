import { api, loadSeed } from '../api'
import { useAsync } from '../hooks'
import type { Case } from '../types'

export default function ArchivePage() {
  const { data } = useAsync(async () => { try { return await api<Case[]>('/archive') } catch { return (await loadSeed()).archive } }, [])
  return (
    <>
      <h2 className="s">The Unknown Archive</h2>
      {data?.map(c => (
        <div className="file" key={c.id}>
          <div className="stamp">CLASSIFIED</div>
          <h3>{c.code}</h3>
          <div>LOCATION: {c.location}</div><div>DATE: {c.date} · LEVEL: {c.level}</div><div>STATUS: {c.status}</div>
          <p><b>EVIDENCE</b> {c.evidence}</p><p><b>WITNESS</b> {c.witness}</p><p><b>NOTES</b> {c.notes}</p>
          <div className="fic">Fictional case file. Not a real-world report.</div>
        </div>
      ))}
    </>
  )
}
