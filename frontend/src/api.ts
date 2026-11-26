import type { Seed, Story } from './types'

const BASE: string = import.meta.env.VITE_API_URL || '/api'
export const token = {
  get: () => localStorage.getItem('gns_token'),
  set: (t: string | null) => (t ? localStorage.setItem('gns_token', t) : localStorage.removeItem('gns_token')),
}

export async function api<T>(path: string, opt: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = token.get()
  if (t) headers.Authorization = 'Bearer ' + t
  const r = await fetch(BASE + path, { method: opt.method || 'GET', headers, body: opt.body ? JSON.stringify(opt.body) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((j as { error?: string }).error || `Request failed (${r.status})`)
  return j as T
}

// If the API is down the site still works in read-only mode from the bundled seed file.
let seed: Seed | null = null
export async function loadSeed(): Promise<Seed> {
  if (!seed) seed = (await (await fetch('/seed.json')).json()) as Seed
  return seed
}

export interface Query { q?: string; category?: string; sort?: string; page?: number }
export async function listStories(p: Query): Promise<{ items: Story[]; total: number }> {
  try {
    const qs = new URLSearchParams()
    Object.entries(p).forEach(([k, v]) => v && qs.set(k, String(v)))
    return await api('/stories?' + qs.toString())
  } catch {
    const s = (await loadSeed()).stories.filter(x => x.status === 'published')
    const q = (p.q || '').toLowerCase()
    const items = s.filter(x => (!p.category || x.category === p.category) && (x.title + x.desc + x.category).toLowerCase().includes(q))
    items.sort((a, b) => (p.sort === 'm' ? a.minutes - b.minutes : p.sort === 'n' ? b.id - a.id : b.intensity - a.intensity))
    return { items, total: items.length }
  }
}
export async function getStory(id: number): Promise<Story> {
  try { return await api<Story>('/stories/' + id) } catch {
    const s = (await loadSeed()).stories.find(x => x.id === id)
    if (!s) throw new Error('Story not found')
    return s
  }
}

const ORIGIN = BASE.replace(/\/api$/, '')
export const coverUrl = (c: string) => (c.startsWith('/uploads/') ? ORIGIN + c : c)
export async function uploadCover(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const t = token.get()
  const r = await fetch(BASE + '/admin/upload', { method: 'POST', headers: t ? { Authorization: 'Bearer ' + t } : {}, body: fd })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((j as { error?: string }).error || 'Upload failed')
  return (j as { url: string }).url
}
