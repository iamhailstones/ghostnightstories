import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [f, setF] = useState({ email: '', password: '', name: '' })
  const [err, setErr] = useState('')
  const go = async () => { try { await login(mode, f); nav('/') } catch (e) { setErr((e as Error).message) } }
  return (
    <>
      <h2 className="s">{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
      <div style={{ display: 'grid', gap: 10, maxWidth: 380 }}>
        {mode === 'register' && <input type="text" placeholder="Display name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />}
        <input type="text" inputMode="email" autoComplete="email" placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Password (8+ characters)" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
        <button className="go" onClick={go}>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button className="ghost" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}>{mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}</button>
        {err && <p className="err">{err}</p>}
      </div>
    </>
  )
}
