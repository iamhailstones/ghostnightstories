import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'

interface Props {
  muted: boolean
  fullscreen: boolean
}

const INTERVAL = 5 * 60 * 1000
const DURATION = 3500
const VIDEO_LEVEL = 'Extreme'

export default function Jumpscare({ muted, fullscreen }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const pool = useRef<string[]>([])
  const used = useRef<Set<string>>(new Set())
  const failed = useRef<Set<string>>(new Set())
  const savedY = useRef(0)
  const vid = useRef<HTMLVideoElement>(null)
  const watchdog = useRef<number>()
  const scareRef = useRef<() => void>(() => {})

  useEffect(() => {
    api<string[]>('/videos/play?level=' + VIDEO_LEVEL)
      .then(v => { pool.current = v })
      .catch(() => { pool.current = [] })
  }, [])

  const pick = useCallback((): string => {
    const available = pool.current.filter(
      url => !failed.current.has(url)
    )

    if (!available.length) return ''

    let fresh = available.filter(url => !used.current.has(url))

    if (!fresh.length) {
      used.current.clear()
      fresh = available
    }

    const url = fresh[Math.floor(Math.random() * fresh.length)]
    used.current.add(url)
    return url
  }, [])

  const close = useCallback(() => {
    window.clearTimeout(watchdog.current)
    setOpen(false)
    setSrc(null)
    document.body.style.overflow = ''
    window.scrollTo(0, savedY.current)
  }, [])

  const scare = useCallback(() => {
    if (open) return

    savedY.current = window.scrollY
    document.body.style.overflow = 'hidden'
    setSrc(pick())
    setOpen(true)
  }, [open, pick])

  useEffect(() => {
    scareRef.current = scare
  }, [scare])

  // First scare after five minutes, then every five minutes.
  useEffect(() => {
    const timer = window.setInterval(() => {
      scareRef.current()
    }, INTERVAL)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(close, DURATION)
    return () => window.clearTimeout(timer)
  }, [open, src, close])

  useEffect(() => {
    if (!open || !src || !vid.current) return

    const video = vid.current
    video.muted = muted

    video.play().catch(() => {
      video.muted = true
      video.play().catch(next)
    })

    watchdog.current = window.setTimeout(() => {
      if (video.readyState < 3) next()
    }, 3500)

    return () => window.clearTimeout(watchdog.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, src])

  function next() {
    if (src) failed.current.add(src)
    setSrc(pick())
  }

  if (!open) return null

  return (
    <div
      id="scare"
      style={{
        display: 'flex',
        ...(fullscreen ? {} : { inset: '15%' }),
      }}
      className="f"
      onClick={close}
      role="dialog"
      aria-label="Jumpscare. Tap to dismiss."
    >
      {src ? (
        <video
          ref={vid}
          src={src}
          playsInline
          preload="auto"
          onError={next}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <img src="/icon.png" alt="" />
      )}
    </div>
  )
}
