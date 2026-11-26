import { NavLink, Route, Routes, Link } from 'react-router-dom'
import { useAuth } from './auth'
import Home from './pages/Home'
import Explore from './pages/Explore'
import Reader from './pages/Reader'
import InteractivePage from './pages/InteractivePage'
import MysteryPage from './pages/MysteryPage'
import ArchivePage from './pages/ArchivePage'
import Submit from './pages/Submit'
import Library from './pages/Library'
import Login from './pages/Login'
import Admin from './pages/Admin'
import StoryEditor from './pages/StoryEditor'

const links: [string, string][] = [['/', 'Home'], ['/explore', 'Explore'], ['/interactive', 'Interactive'], ['/mystery', 'Daily Mystery'], ['/archive', 'Archive'], ['/submit', 'Submit a story'], ['/library', 'My Library']]

export default function App() {
  const { user, logout } = useAuth()
  return (
    <>
      <div className="fog" />
      <header>
        <div className="top">
          <img src="/icon.png" alt="" />
          <Link to="/" className="logo" style={{ color: 'inherit', textDecoration: 'none' }}>Ghost Night Stories</Link>
          {user?.role === 'admin' && <Link className="ad" to="/admin" style={{ marginLeft: 'auto' }}>Admin</Link>}
          {user ? <button className="ad" style={user.role === 'admin' ? {} : { marginLeft: 'auto' }} onClick={logout}>Sign out</button>
            : <Link className="ad" style={{ marginLeft: 'auto' }} to="/login">Sign in</Link>}
        </div>
        <nav>{links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}><button>{label}</button></NavLink>)}</nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/story/:id" element={<Reader />} />
          <Route path="/interactive" element={<InteractivePage />} />
          <Route path="/mystery" element={<MysteryPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/library" element={<Library />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/story/:id" element={<StoryEditor />} />
          <Route path="*" element={<p style={{ paddingTop: 60 }}>Nothing here. <Link to="/">Go home</Link>.</p>} />
        </Routes>
      </main>
    </>
  )
}
