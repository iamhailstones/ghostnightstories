import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { coverUrl } from '../api'
import type { Story } from '../types'

const hues = ['#2a1020', '#1a2230', '#241a10', '#380a0a', '#10281c', '#1f1f2e', '#12202a']
export const dots = (n: number) => (
  <span className="int">{[1, 2, 3, 4, 5].map(x => <i key={x} className={x <= n ? 'f' : ''} />)}</span>
)

export default function StoryCard({ s, narrow }: { s: Story; narrow?: boolean }) {
  return (
    <Link to={`/story/${s.id}`} className={'card' + (narrow ? ' st' : '')} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div className="cv" style={{ ['--c1' as string]: hues[s.id % hues.length], backgroundImage: s.cover ? `url(${coverUrl(s.cover)})` : undefined, backgroundSize: 'cover' } as CSSProperties} />
      <div className="meta">{s.category}</div>
      <h3>{s.title}</h3>
      <p>{s.desc}</p>
      <div className="meta" style={{ marginTop: 8 }}>{s.minutes} min · {s.chapters} ch · {dots(s.intensity)}</div>
    </Link>
  )
}
