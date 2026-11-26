import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, coverUrl, uploadCover } from '../api'
import { useAuth } from '../auth'
import { CATEGORIES } from './Explore'
import type { Story, StoryChapter } from '../types'

const blank: Story = {
  id: 0,
  title: '',
  category: CATEGORIES[0],
  author: 'Ghost Night',
  desc: '',
  body: [''],
  chapterData: [{ title: 'Chapter 1', body: [''] }],
  minutes: 5,
  intensity: 3,
  chapters: 1,
  cover: '',
  status: 'draft',
  created: '',
  kind: 'story',
  triggers: [40, 75],
}

const makeChapter = (index: number): StoryChapter => ({
  title: `Chapter ${index + 1}`,
  body: [''],
})

export default function StoryEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()

  const [s, setS] = useState<Story | null>(id === 'new' ? blank : null)
  const [chapterData, setChapterData] = useState<StoryChapter[]>([
    makeChapter(0),
  ])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [prev, setPrev] = useState(false)

  useEffect(() => {
    if (id === 'new') return

    api<Story[]>('/admin/stories')
      .then(list => {
        const f = list.find(x => x.id === Number(id))

        if (!f) {
          setMsg('Story not found')
          return
        }

        const chapters = f.chapterData?.length
          ? f.chapterData
          : [{ title: 'Chapter 1', body: f.body?.length ? f.body : [''] }]

        setS(f)
        setChapterData(chapters)
      })
      .catch(e => setMsg((e as Error).message))
  }, [id])

  if (!user || user.role !== 'admin') {
    return (
      <p style={{ paddingTop: 40 }}>
        Administrator access only.{' '}
        <Link to="/login" style={{ color: 'var(--hot)' }}>Sign in</Link>
      </p>
    )
  }

  if (!s) return <p style={{ paddingTop: 40 }}>{msg || 'Loading…'}</p>

  const set = <K extends keyof Story>(k: K, v: Story[K]) => {
    setS(current => current ? { ...current, [k]: v } : current)
  }

  const updateChapter = (index: number, changes: Partial<StoryChapter>) => {
    setChapterData(current =>
      current.map((chapter, i) =>
        i === index ? { ...chapter, ...changes } : chapter
      )
    )
  }

  const addChapter = () => {
    setChapterData(current => [...current, makeChapter(current.length)])
  }

  const removeChapter = (index: number) => {
    if (chapterData.length <= 1) {
      setMsg('A story must have at least one chapter.')
      return
    }

    setChapterData(current =>
      current
        .filter((_, i) => i !== index)
        .map((chapter, i) => ({
          ...chapter,
          title: chapter.title || `Chapter ${i + 1}`,
        }))
    )
    setMsg('')
  }

  const moveChapter = (index: number, direction: number) => {
    const target = index + direction
    if (target < 0 || target >= chapterData.length) return

    setChapterData(current => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const paragraphs = (value: string) =>
    value.split(/\n+/).map(p => p.trim()).filter(Boolean)

  const pick = async (file?: File) => {
    if (!file) return

    setBusy(true)
    setMsg('')

    try {
      set('cover', await uploadCover(file))
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = async (status?: string) => {
    const cleanedChapters = chapterData.map((chapter, index) => ({
      title: chapter.title.trim() || `Chapter ${index + 1}`,
      body: chapter.body.map(p => p.trim()).filter(Boolean),
    }))

    if (cleanedChapters.some(chapter => chapter.body.length === 0)) {
      setMsg('Every chapter needs at least one paragraph.')
      return
    }

    const allParagraphs = cleanedChapters.flatMap(chapter => chapter.body)

    if (!allParagraphs.length) {
      setMsg('Add some story text before saving.')
      return
    }

    setBusy(true)
    setMsg('')

    const payload = {
      ...s,
      chapterData: cleanedChapters,
      body: allParagraphs,
      chapters: cleanedChapters.length,
      status: status ?? s.status,
    }

    try {
      if (id === 'new') {
        await api('/admin/stories', { method: 'POST', body: payload })
      } else {
        await api('/admin/stories/' + id, { method: 'PUT', body: payload })
      }

      nav('/admin')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const num = (
    k: 'minutes' | 'intensity',
    label: string
  ) => (
    <label style={{ font: '13px var(--u)' }}>
      {label}
      <input
        type="number"
        value={s[k]}
        onChange={e => set(k, Number(e.target.value))}
      />
    </label>
  )

  return (
    <>
      <h2 className="s">{id === 'new' ? 'New story' : 'Edit story'}</h2>

      <div style={{ display: 'grid', gap: 10 }}>
        <input
          type="text"
          placeholder="Title"
          value={s.title}
          onChange={e => set('title', e.target.value)}
          maxLength={120}
        />

        <select
          value={s.category}
          onChange={e => set('category', e.target.value)}
        >
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>

        <input
          type="text"
          placeholder="Author"
          value={s.author}
          onChange={e => set('author', e.target.value)}
          maxLength={60}
        />

        <input
          type="text"
          placeholder="One-sentence description"
          value={s.desc}
          onChange={e => set('desc', e.target.value)}
          maxLength={300}
        />

        <div className="ctl" style={{ margin: 0 }}>
          {num('minutes', 'Minutes')}
          {num('intensity', 'Intensity 1-5')}
        </div>

        <label style={{ font: '13px var(--u)' }}>
          Cover image
          {s.cover && (
            <img
              src={coverUrl(s.cover)}
              alt="Cover preview"
              style={{
                display: 'block',
                width: '100%',
                maxWidth: 420,
                aspectRatio: '16/9',
                objectFit: 'cover',
                borderRadius: 8,
                margin: '8px 0',
              }}
            />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={e => pick(e.target.files?.[0])}
          />
        </label>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <div className="ctl" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Story chapters ({chapterData.length})</h3>
            <button className="go" type="button" onClick={addChapter}>
              + Add chapter
            </button>
          </div>

          {chapterData.map((chapter, index) => (
            <section
              key={index}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: 12,
                marginTop: 14,
              }}
            >
              <div className="ctl" style={{ justifyContent: 'space-between' }}>
                <strong>Chapter {index + 1}</strong>
                <div className="ctl" style={{ margin: 0 }}>
                  <button
                    className="ghost"
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveChapter(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="ghost"
                    type="button"
                    disabled={index === chapterData.length - 1}
                    onClick={() => moveChapter(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => removeChapter(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder={`Chapter ${index + 1} title`}
                value={chapter.title}
                onChange={e =>
                  updateChapter(index, { title: e.target.value })
                }
                maxLength={120}
              />

              <textarea
                rows={12}
                placeholder="Write this chapter here. Start a new paragraph on a new line."
                value={chapter.body.join('\n\n')}
                onChange={e =>
                  updateChapter(index, { body: paragraphs(e.target.value) })
                }
              />
            </section>
          ))}
        </div>

        <select
          value={s.status}
          onChange={e => set('status', e.target.value)}
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>

        <div className="ctl" style={{ margin: 0 }}>
          <button
            className="ghost"
            type="button"
            onClick={() => setPrev(!prev)}
          >
            {prev ? 'Hide preview' : 'Preview'}
          </button>

          <button
            className="ghost"
            type="button"
            disabled={busy}
            onClick={() => save()}
          >
            Save
          </button>

          <button
            className="go"
            type="button"
            disabled={busy}
            onClick={() => save('published')}
          >
            Save and publish
          </button>

          <Link to="/admin">
            <button className="ghost" type="button">Cancel</button>
          </Link>
        </div>

        {msg && <p className="err" role="alert">{msg}</p>}
      </div>

      {prev && (
        <section style={{ paddingTop: 20 }}>
          <h1 style={{ fontSize: 44 }}>{s.title || 'Untitled'}</h1>

          {s.cover && (
            <img
              src={coverUrl(s.cover)}
              alt=""
              style={{
                width: '100%',
                aspectRatio: '16/9',
                objectFit: 'cover',
                borderRadius: 8,
                margin: '0 0 18px',
              }}
            />
          )}

          {chapterData.map((chapter, index) => (
            <article key={index}>
              <h2>{chapter.title || `Chapter ${index + 1}`}</h2>
              {chapter.body.map((p, k) => <p key={k}>{p}</p>)}
            </article>
          ))}
        </section>
      )}
    </>
  )
}
