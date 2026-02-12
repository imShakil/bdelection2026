import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiPost } from '../api.js'
import ConstituencyPanel from '../components/ConstituencyPanel.jsx'
import CaptchaWidget from '../components/CaptchaWidget.jsx'
import { t } from '../i18n.js'

const PARTY_COLORS = {
  BNP: '#1b4b8f',
  'JP(E)': '#2a7b5f',
  'Jatiya Party (Ershad)': '#2a7b5f',
  Jamaat: '#7a4b1b',
  NCP: '#6b2f5f',
  '11 Party Alliance': '#6b2f5f'
}

function ResultSummary({ seat, totals, lang }) {
  if (!seat) return null
  const totalVotes = Object.values(totals || {}).reduce((a, b) => a + b, 0)
  const leader = seat.leader
  let status = t(lang, 'status_no_votes')
  if (seat.is_tied) status = t(lang, 'status_tied')
  if (leader) status = `${leader.name} (${leader.party}) ${t(lang, 'status_leading')}`

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="panel-title">{t(lang, 'vote_receipt')}</div>
      <div className="panel-sub">{status}</div>
      <div className="kpi-row" style={{ marginTop: 12 }}>
        <div className="kpi">
          <div className="kpi-label">{t(lang, 'stats_total_votes')}</div>
          <div className="kpi-value">{totalVotes}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t(lang, 'label_constituency')}</div>
          <div className="kpi-value">#{seat.constituency_no}</div>
        </div>
      </div>
      <div className="legend" style={{ marginTop: 12 }}>
        {Object.keys(PARTY_COLORS).map((label) => (
          <div key={label} className="legend-item">
            <span className="legend-swatch" style={{ background: PARTY_COLORS[label] }}></span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MapVotePage({ lang }) {
  const detailRef = useRef(null)
  const candidatePanelRef = useRef(null)
  const [constituencies, setConstituencies] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [totals, setTotals] = useState({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [captchaConfig, setCaptchaConfig] = useState({ provider: 'none', siteKey: '' })
  const [captchaToken, setCaptchaToken] = useState('')
  const [query, setQuery] = useState('')
  const [loadingSeat, setLoadingSeat] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showSeatPicker, setShowSeatPicker] = useState(true)

  useEffect(() => {
    apiGet('/api/constituencies').then(setConstituencies)
    apiGet('/api/config').then((cfg) => {
      setCaptchaConfig({ provider: cfg.captcha_provider || 'none', siteKey: cfg.captcha_site_key || '' })
    })
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)')
    const onChange = (e) => setIsMobile(e.matches)
    setIsMobile(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setSelectedDetail(null)
    setLoadingSeat(true)
    if (window.matchMedia('(max-width: 720px)').matches) {
      setShowSeatPicker(false)
    }
    apiGet(`/api/constituencies/${selectedId}`).then((data) => {
      setSelectedDetail(data)
      setTotals(data.totals || {})
      setSelectedCandidate('')
      setMessage('')
      setError('')
      setLoadingSeat(false)
      if (window.matchMedia('(max-width: 720px)').matches) {
        requestAnimationFrame(() => {
          const target = candidatePanelRef.current || detailRef.current
          if (!target) return
          const headerOffset = 110
          const top = target.getBoundingClientRect().top + window.scrollY - headerOffset
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
        })
      }
    }).catch(() => setLoadingSeat(false))
  }, [selectedId])

  const filtered = useMemo(() => {
    if (!query) return constituencies
    return constituencies.filter((c) => {
      const seat = (c.seat || '').toLowerCase()
      const seatBn = (c.seat_bn || '').toLowerCase()
      const q = query.toLowerCase()
      return seat.includes(q) || seatBn.includes(q)
    })
  }, [query, constituencies])

  const voteDisabled = !selectedDetail || !selectedCandidate

  const handleVote = async () => {
    setMessage('')
    setError('')
    try {
      const res = await apiPost('/api/vote', {
        constituency_no: selectedDetail.constituency_no,
        candidate_id: selectedCandidate,
        captcha_token: captchaToken
      })
      setTotals(res.new_tallies || {})
      setMessage(t(lang, 'vote_thanks'))
    } catch (err) {
      if (err.status === 409) {
        setError(t(lang, 'vote_already'))
      } else {
        setError(err.message || t(lang, 'vote_failed'))
      }
    }
  }

  return (
    <div className="page-grid">
      {(!isMobile || showSeatPicker) ? (
      <div className="card sticky-column">
        <div className="panel-title">{t(lang, 'vote_find_title')}</div>
        <div className="panel-sub">{t(lang, 'vote_find_sub')}</div>
        <div className="map-controls" style={{ marginTop: 12 }}>
          <input
            className="input"
            placeholder={t(lang, 'vote_search_placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="notice" style={{ marginTop: 12 }}>
          {filtered.length} {t(lang, 'vote_seats_found')}
        </div>
        <div className="candidate-list seat-list" style={{ marginTop: 12, maxHeight: 520, overflowY: 'auto' }}>
          {filtered.map((c) => (
            <button
              key={c.constituency_no}
              className="candidate-row"
              style={{ cursor: 'pointer', background: selectedId === c.constituency_no ? '#eef3fb' : '#fff' }}
              onClick={() => setSelectedId(c.constituency_no)}
            >
              <span>{lang === 'bn' && c.seat_bn ? c.seat_bn : c.seat}</span>
              <span>#{c.constituency_no}</span>
            </button>
          ))}
        </div>
      </div>
      ) : null}
      <div ref={detailRef}>
        {isMobile && selectedDetail ? (
          <div style={{ marginBottom: 10 }}>
            <button className="vote-btn" style={{ marginTop: 0 }} onClick={() => setShowSeatPicker(true)}>
              {lang === 'bn' ? 'আসন পরিবর্তন করুন' : 'Change Seat'}
            </button>
          </div>
        ) : null}
        {loadingSeat && !selectedDetail ? (
          <div className="card">
            <div className="panel-title">{t(lang, 'vote_loading_seat')}</div>
            <div className="skeleton" style={{ height: 140, marginTop: 12 }}></div>
          </div>
        ) : (
          <div ref={candidatePanelRef}>
            <ConstituencyPanel
              constituency={selectedDetail}
              selectedCandidate={selectedCandidate}
              onSelectCandidate={setSelectedCandidate}
              totals={totals}
              lang={lang}
              t={t}
            />
          </div>
        )}
        {selectedDetail ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="panel-title">{t(lang, 'vote_cast_title')}</div>
            <div className="panel-sub">{t(lang, 'vote_cast_sub')}</div>
            <CaptchaWidget
              provider={captchaConfig.provider}
              siteKey={captchaConfig.siteKey}
              onToken={setCaptchaToken}
            />
            <button className="vote-btn" onClick={handleVote} disabled={voteDisabled}>
              {t(lang, 'vote_submit')}
            </button>
            {message ? <div className="toast">{message}</div> : null}
            {error ? <div className="notice">{error}</div> : null}
            <div className="small" style={{ marginTop: 8 }}>{t(lang, 'vote_why')}</div>
          </div>
        ) : null}
        <div className="steps card" style={{ marginTop: 16 }}>
          <div className="panel-title">{t(lang, 'vote_steps_title')}</div>
          <div className="step-row"><span className="step-dot"></span>{t(lang, 'vote_step1')}</div>
          <div className="step-row"><span className="step-dot"></span>{t(lang, 'vote_step2')}</div>
          <div className="step-row"><span className="step-dot"></span>{t(lang, 'vote_step3')}</div>
        </div>
        <ResultSummary seat={selectedDetail} totals={totals} lang={lang} />
         <div className="notice" style={{ marginTop: 16 }}>
          <strong>{t(lang, 'vote_notice_title')}</strong>
          <div className="small" style={{ marginTop: 6, whiteSpace: 'pre-line' }}>
            {t(lang, 'vote_notice_description')}
          </div>
        </div>
      </div>
    </div>
  )
}
