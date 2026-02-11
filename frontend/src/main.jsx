import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import MapVotePage from './pages/MapVotePage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import NewsPage from './pages/NewsPage.jsx'
import { LANGS, getLang, setLang, t } from './i18n.js'
import './styles.css'

function AppShell() {
  const [lang, setLangState] = useState(getLang())
  const labels = useMemo(() => ({
    vote: t(lang, 'nav_vote'),
    stats: t(lang, 'nav_stats'),
    news: t(lang, 'nav_news')
  }), [lang])

  const toggleLang = (next) => {
    setLang(next)
    setLangState(next)
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <Link to="/">
            <div className="brand">
              <div className="brand-title">{t(lang, 'brand_title')}</div>
              <div className="brand-sub">{t(lang, 'brand_sub')}</div>
            </div>
          </Link>
          <nav className="nav">
            <Link to="/">{labels.vote}</Link>
            <Link to="/stats">{labels.stats}</Link>
            <Link to="/news">{labels.news}</Link>
          </nav>
          <div className="lang-toggle">
            {LANGS.map((l) => (
              <button
                key={l.key}
                className={`lang-btn ${lang === l.key ? 'active' : ''}`}
                onClick={() => toggleLang(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<MapVotePage lang={lang} />} />
            <Route path="/stats" element={<StatsPage lang={lang} />} />
            <Route path="/news" element={<NewsPage lang={lang} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<AppShell />)
