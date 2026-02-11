import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import MapVotePage from './pages/MapVotePage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import './styles.css'

function AppShell() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">
            <div className="brand-title">Bangladesh Map Voting</div>
            <div className="brand-sub">Public demo · one vote per device</div>
          </div>
          <nav className="nav">
            <Link to="/">Vote</Link>
            <Link to="/stats">Stats</Link>
          </nav>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<MapVotePage />} />
            <Route path="/stats" element={<StatsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<AppShell />)
