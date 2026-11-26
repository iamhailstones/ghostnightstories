import { Link } from 'react-router-dom'
import { listStories, loadSeed } from '../api'
import { useAsync } from '../hooks'
import StoryCard from '../components/StoryCard'

export default function Home() {
  const { data } = useAsync(() => listStories({ sort: 'n' }), [])
  const m = useAsync(async () => (await loadSeed()).mysteries[0], [])
  const items = data?.items ?? []
  return (
    <>
      <section className="hero">
        <h1>Stories for psychopaths.</h1>
        <p>Original horror. Read it, hear it, choose how it ends.</p>
        <div className="ctl"><Link to="/explore"><button className="go">Enter the night</button></Link><Link to="/interactive"><button className="ghost">Play an interactive story</button></Link></div>
      </section>
      <h2 className="s">Featured</h2>
      <div className="row">{items.slice(0, 4).map(s => <StoryCard key={s.id} s={s} narrow />)}</div>
      <h2 className="s">Recently published</h2>
      <div className="row">{[...items].sort((a, b) => b.id - a.id).slice(0, 5).map(s => <StoryCard key={s.id} s={s} narrow />)}</div>
      <h2 className="s">Today's mystery</h2>
      {m.data && <Link to="/mystery" className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}><div className="meta">Daily Mystery · Fictional</div><h3>{m.data.title}</h3><p>{m.data.body}</p></Link>}
      <h2 className="s">From the community</h2>
      <div className="grid">{items.filter(s => s.kind !== 'story').slice(0, 2).map(s => <StoryCard key={s.id} s={s} />)}</div>
      <p className="meta" style={{ marginTop: 10 }}>Community stories appear here after a moderator approves them. <Link to="/submit" style={{ color: 'var(--hot)' }}>Submit yours</Link>.</p>
    </>
  )
}
