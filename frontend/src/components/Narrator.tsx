import { useEffect, useRef, useState } from 'react'

type Props = {
  paras: string[]
  storyId: number
  chapterIndex: number
}

export default function Narrator({ paras, storyId, chapterIndex }: Props) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [rate, setRate] = useState(0.9)
  const [vol, setVol] = useState(1)
  const [amb, setAmb] = useState(false)
  const [error, setError] = useState('')

  const live = useRef(false)
  const requestId = useRef(0)
  const indexRef = useRef(0)
  const cache = useRef(new Map<number, string>())
  const audio = useRef<HTMLAudioElement | null>(null)

  const ctx = useRef<AudioContext | null>(null)
  const noise = useRef<AudioBufferSourceNode | null>(null)
  const knocks = useRef<number | null>(null)

  const chapterKey = `${storyId}:${chapterIndex}:${paras.join('\u0000')}`

  function playCached(idx: number) {
    if (!live.current) return

    while (idx < paras.length && !paras[idx]?.trim()) {
      idx++
    }

    if (idx >= paras.length) {
      live.current = false
      setPlaying(false)
      setI(0)
      indexRef.current = 0
      return
    }

    const url = cache.current.get(idx)

    if (!url) {
      live.current = false
      setPlaying(false)
      setError(`Audio for paragraph ${idx + 1} is not ready.`)
      return
    }

    const player = audio.current ?? new Audio()
    audio.current = player

    player.pause()
    player.src = url
    player.volume = vol
    player.playbackRate = rate

    indexRef.current = idx
    setI(idx)

    player.onended = () => {
      if (live.current) playCached(idx + 1)
    }

    player.onerror = () => {
      live.current = false
      setPlaying(false)
      setError(`Could not load paragraph ${idx + 1}. Check that its audio file exists.`)
    }

    void player.play().catch(err => {
      live.current = false
      setPlaying(false)
      setError('Could not start audio playback.')
      console.error(err)
    })
  }

  async function prepareAll() {
    const id = requestId.current
    const total = paras.length

    setLoading(true)
    setError('')

    try {
      cache.current.clear()

      for (let n = 0; n < total; n++) {
        if (id !== requestId.current) return

        if (!paras[n]?.trim()) continue

        const url =
          `/audio/story-${storyId}/chapter-${chapterIndex + 1}/paragraph-${n + 1}.mp3`

        cache.current.set(n, url)
        setProgress(`Preparing ${n + 1}/${total}`)
      }

      if (id !== requestId.current) return

      setProgress('Ready')

      if (live.current) playCached(indexRef.current)
    } catch (err) {
      if (id !== requestId.current) return

      live.current = false
      setPlaying(false)
      setError(err instanceof Error ? err.message : 'Could not prepare narration.')
      console.error('Narration error:', err)
    } finally {
      if (id === requestId.current) {
        setLoading(false)
        setProgress('')
      }
    }
  }

  const toggle = () => {
    if (playing) {
      live.current = false
      audio.current?.pause()
      setPlaying(false)
      return
    }

    live.current = true
    setPlaying(true)
    setError('')

    if (loading) return

    const total = paras.filter(p => p.trim()).length

    if (cache.current.size === total && total > 0) {
      playCached(indexRef.current)
    } else {
      void prepareAll()
    }
  }

  const skip = (direction: number) => {
    let next = Math.min(
      paras.length - 1,
      Math.max(0, indexRef.current + direction)
    )

    if (next === indexRef.current) return

    indexRef.current = next
    setI(next)

    if (playing && !loading) playCached(next)
  }

  useEffect(() => {
    requestId.current++
    live.current = false
    audio.current?.pause()
    cache.current.clear()
    indexRef.current = 0

    setI(0)
    setPlaying(false)
    setLoading(false)
    setProgress('')
    setError('')

    return () => {
      requestId.current++
      live.current = false
      audio.current?.pause()
    }
  }, [chapterKey])

  useEffect(() => {
    if (audio.current) {
      audio.current.volume = vol
      audio.current.playbackRate = rate
    }
  }, [vol, rate])

  useEffect(() => {
    return () => {
      live.current = false
      requestId.current++
      audio.current?.pause()
      audio.current = null
      noise.current?.stop()

      if (knocks.current !== null) {
        window.clearInterval(knocks.current)
      }
    }
  }, [])

  function ambient(on: boolean) {
    setAmb(on)

    if (!on) {
      noise.current?.stop()
      noise.current = null

      if (knocks.current !== null) {
        window.clearInterval(knocks.current)
        knocks.current = null
      }

      return
    }

    const ac = (ctx.current ??= new AudioContext())

    if (ac.state === 'suspended') void ac.resume()

    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
    const data = buf.getChannelData(0)

    for (let k = 0; k < data.length; k++) {
      data[k] = Math.random() * 2 - 1
    }

    const src = ac.createBufferSource()
    src.buffer = buf
    src.loop = true

    const filter = ac.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 420

    const gain = ac.createGain()
    gain.gain.value = 0.05

    src.connect(filter).connect(gain).connect(ac.destination)
    src.start()
    noise.current = src

    knocks.current = window.setInterval(() => {
      if (Math.random() > 0.35) return

      for (let n = 0; n < 3; n++) {
        const oscillator = ac.createOscillator()
        const knockGain = ac.createGain()
        const time = ac.currentTime + n * 0.28

        oscillator.frequency.value = 90
        knockGain.gain.setValueAtTime(0.12, time)
        knockGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15)

        oscillator.connect(knockGain).connect(ac.destination)
        oscillator.start(time)
        oscillator.stop(time + 0.2)
      }
    }, 9000)
  }

  return (
    <div className="play" role="group" aria-label="Narration">
      <button
        className="ghost"
        onClick={() => skip(-1)}
        aria-label="Previous paragraph"
        disabled={i <= 0}
      >
        Back
      </button>

      <button className="ghost on" onClick={toggle}>
        {loading ? progress || 'Preparing...' : playing ? 'Pause' : 'Listen'}
      </button>

      <button
        className="ghost"
        onClick={() => skip(1)}
        aria-label="Next paragraph"
        disabled={i >= paras.length - 1}
      >
        Forward
      </button>

      <div className="bar">
        <i style={{ width: `${(i / Math.max(1, paras.length)) * 100}%` }} />
      </div>

      <select
        value={rate}
        onChange={e => setRate(+e.target.value)}
        style={{ width: 'auto' }}
        aria-label="Speed"
      >
        <option value={0.75}>0.75x</option>
        <option value={0.9}>0.9x</option>
        <option value={1}>1x</option>
        <option value={1.15}>1.15x</option>
      </select>

      <input
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={vol}
        onChange={e => setVol(+e.target.value)}
        style={{ width: 80 }}
        aria-label="Volume"
      />

      {error && (
        <span role="alert" style={{ color: '#ff7777' }}>
          {error}
        </span>
      )}

      <label>
        <input
          type="checkbox"
          checked={amb}
          onChange={e => ambient(e.target.checked)}
        />
        Wind and knocking
      </label>
    </div>
  )
}
