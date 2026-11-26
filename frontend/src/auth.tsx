import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, token } from './api'
import type { User } from './types'

interface Ctx { user: User | null; setUser: (u: User | null) => void; login: (path: 'login' | 'register', body: object) => Promise<void>; logout: () => void }
const AuthCtx = createContext<Ctx>({ user: null, setUser: () => {}, login: async () => {}, logout: () => {} })
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => { if (token.get()) api<User>('/me').then(setUser).catch(() => token.set(null)) }, [])
  const login: Ctx['login'] = async (path, body) => {
    const r = await api<{ token: string; user: User }>('/auth/' + path, { method: 'POST', body })
    token.set(r.token); setUser(r.user)
  }
  const logout = () => { token.set(null); setUser(null) }
  return <AuthCtx.Provider value={{ user, setUser, login, logout }}>{children}</AuthCtx.Provider>
}
