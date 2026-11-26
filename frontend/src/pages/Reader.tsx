import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, coverUrl, getStory, listStories } from '../api'
import { useAsync } from '../hooks'
import { useAuth } from '../auth'
import Jumpscare from '../components/Jumpscare'
import Narrator from '../components/Narrator'
import StoryCard, { dots } from '../components/StoryCard'
import type { User } from '../types'

export default function Reader() {
  const id = Number(useParams().id)
  const { user, setUser } = useAuth()
  const { data: s, error } = useAsync(() => getStory(id), [id])
  const rel = useAsync(() => listStories({}), [id])

  const [mute, setMute] = useState(false)
  const [full, setFull] = useState(true)
  const [chapterIndex, setChapterIndex] = useState(0)

  const lastSave = useRef(0)
  const resumed = useRef(false)

  const chapters = s
    ? s.chapterData?.length
      ? s.chapterData
      : [{ title: 'Chapter 1', body: s.body ?? [] }]
    : []

  const currentChapter = chapters[chapterIndex] ?? chapters[0]
  const currentBody = currentChapter?.body ?? []

  useEffect(() => {
    setChapterIndex(0)
    resumed.current = false
  }, [id])

  useEffect(() => {
    const p = user?.progress?.[String(id)]

    if (s && p !== undefined && !resumed.current) {
      resumed.current = true
      setTimeout(() => {
        window.scrollTo(
          0,
          ((document.body.scrollHeight - window.innerHeight) * p) / 100
        )
      }, 50)
    }
  }, [s, user, id])

  useEffect(() => {
    if (!user) return

    const saveProgress = () => {
      if (Date.now() - lastSave.current < 4000) return

      lastSave.current = Date.now()

      const pct = Math.round(
        (scrollY / Math.max(
          1,
          document.body.scrollHeight - window.innerHeight
        )) * 100
      )

      api('/me/progress/' + id, {
        method: 'POST',
        body: { pct },
      }).catch(() => {})
    }

    addEventListener('scroll', saveProgress, { passive: true })
    return () => removeEventListener('scroll', saveProgress)
  }, [user, id])

  if (error) {
    return <p className="err" style={{ paddingTop: 40 }}>{error}</p>
  }

  if (!s || !currentChapter) {
    return <p style={{ paddingTop: 40 }}>Opening the story…</p>
  }

  const saved = user?.bookmarks?.includes(s.id)

  const bookmark = async () => {
    if (!user) return alert('Sign in to bookmark stories')

    setUser(
      await api<User>('/me/bookmarks/' + s.id, { method: 'POST' })
    )
  }

  const report = () =>
    api('/stories/' + s.id + '/report', { method: 'POST' })
      .then(() => alert('Thanks. A moderator will review this story.'))
      .catch(e => alert((e as Error).message))

  const previousChapter = () => {
    setChapterIndex(index => Math.max(0, index - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const nextChapter = () => {
    setChapterIndex(index => Math.min(chapters.length - 1, index + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section style={{ paddingTop: 30 }}>
      <div className="meta">
        {s.category} · {s.author} · {s.minutes} min · {dots(s.intensity)}
      </div>

      <h1 style={{ fontSize: 'clamp(38px,9vw,64px)', margin: '8px 0 14px' }}>
        {s.title}
      </h1>

      <div className="ctl">
        <button
          className={'ghost' + (saved ? ' on' : '')}
          onClick={bookmark}
        >
          {saved ? 'Bookmarked' : 'Bookmark'}
        </button>

        <label>
          <input
            type="checkbox"
            checked={mute}
            onChange={e => setMute(e.target.checked)}
          />
          Mute
        </label>

        <label>
          <input
            type="checkbox"
            checked={full}
            onChange={e => setFull(e.target.checked)}
          />
          Full-screen
        </label>
      </div>

      {s.cover && (
        <img
          src={coverUrl(s.cover)}
          alt={`Cover for ${s.title}`}
          loading="lazy"
          style={{
            width: '100%',
            aspectRatio: '16/9',
            objectFit: 'cover',
            borderRadius: 8,
            margin: '0 0 18px',
          }}
        />
      )}

      <div
        style={{
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: 14,
          margin: '20px 0',
        }}
      >
        <div className="meta">
          Chapter {chapterIndex + 1} of {chapters.length}
        </div>

        <select
          aria-label="Choose chapter"
          value={chapterIndex}
          onChange={e => {
            setChapterIndex(Number(e.target.value))
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          {chapters.map((chapter, index) => (
            <option key={index} value={index}>
              {chapter.title || `Chapter ${index + 1}`}
            </option>
          ))}
        </select>

        <div
          className="ctl"
          style={{ justifyContent: 'space-between', marginBottom: 0 }}
        >
          <button
            className="ghost"
            disabled={chapterIndex === 0}
            onClick={previousChapter}
          >
            Previous chapter
          </button>

          <button
            className="go"
            disabled={chapterIndex === chapters.length - 1}
            onClick={nextChapter}
          >
            Next chapter
          </button>
        </div>
      </div>

      <article>
        <h2>{currentChapter.title || `Chapter ${chapterIndex + 1}`}</h2>
        {currentBody.map((p, k) => <p key={k}>{p}</p>)}
      </article>

      <div className="ctl">
        <button
          className="ghost"
          disabled={chapterIndex === 0}
          onClick={previousChapter}
        >
          Previous chapter
        </button>

        <button
          className="go"
          disabled={chapterIndex === chapters.length - 1}
          onClick={nextChapter}
        >
          Next chapter
        </button>
      </div>

      <button className="ghost" onClick={report}>
        Report this story
      </button>

      <Narrator paras={currentBody} />

      <h2 className="s">Related</h2>

      <div className="grid">
        {rel.data?.items
          .filter(x => x.id !== s.id && x.category === s.category)
          .slice(0, 2)
          .map(x => <StoryCard key={x.id} s={x} />)}
      </div>

      <Jumpscare muted={mute} fullscreen={full} />
    </section>
  )
}
