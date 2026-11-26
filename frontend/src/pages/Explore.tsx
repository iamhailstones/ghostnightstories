import { useState } from 'react'
import { listStories } from '../api'
import { useAsync } from '../hooks'
import StoryCard from '../components/StoryCard'

export const CATEGORIES = ['Paranormal Encounters', 'Ghost Stories', 'Demonic Encounters', 'Haunted Houses', 'Psychological Horror', 'Serial Killers', 'Supernatural Mysteries', 'Urban Legends', 'Disturbing True Experiences', 'Possession Stories', 'Creature Horror', 'Dark Mysteries', 'African Folklore Horror', 'Unexplained Disappearances']

export default function Explore() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('i')
  const [page, setPage] = useState(1)
  const { data, loading } = useAsync(() => listStories({ q, category, sort, page }), [q, category, sort, page])
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 12))
  return (
    <>
      <h2 className="s">Explore</h2>
      <div className="ctl">
        <input type="search" placeholder="Search stories" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} style={{ flex: 1, minWidth: 140 }} />
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1) }} style={{ width: 'auto' }}>
          <option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ width: 'auto' }}>
          <option value="i">Most intense</option><option value="m">Shortest</option><option value="n">Newest</option>
        </select>
      </div>
      <div className="grid">{data?.items.map(s => <StoryCard key={s.id} s={s} />)}</div>
      {!loading && data?.items.length === 0 && <p>No stories match. Clear the search or pick another category.</p>}
      <div className="ctl">{Array.from({ length: pages }, (_, i) => <button key={i} className={'ghost' + (page === i + 1 ? ' on' : '')} onClick={() => setPage(i + 1)}>{i + 1}</button>)}</div>
    </>
  )
}
