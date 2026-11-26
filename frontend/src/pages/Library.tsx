import { Link } from 'react-router-dom'
import { listStories } from '../api'
import { useAsync } from '../hooks'
import { useAuth } from '../auth'
import StoryCard from '../components/StoryCard'

export default function Library() {
  const { user } = useAuth()
  const { data } = useAsync(() => listStories({}), [])
  if (!user) return <p style={{ paddingTop: 40 }}>Sign in to keep bookmarks and reading progress. <Link to="/login" style={{ color: 'var(--hot)' }}>Sign in</Link></p>
  const mine = (data?.items ?? []).filter(s => user.bookmarks?.includes(s.id) || user.progress?.[String(s.id)])
  return (
    <>
      <h2 className="s">My library</h2>
      {mine.length === 0 && <p>Nothing saved yet. Bookmark a story in the reader.</p>}
      <div className="grid">{mine.map(s => <div key={s.id}><StoryCard s={s} /><div className="meta" style={{ marginTop: 4 }}>Read {user.progress?.[String(s.id)] ?? 0}%{user.bookmarks?.includes(s.id) ? ' · Bookmarked' : ''}</div></div>)}</div>
    </>
  )
}
