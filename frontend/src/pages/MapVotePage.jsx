import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../api.js'
import ConstituencyPanel from '../components/ConstituencyPanel.jsx'
import CaptchaWidget from '../components/CaptchaWidget.jsx'

export default function MapVotePage() {
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

  useEffect(() => {
    apiGet('/api/constituencies').then(setConstituencies)
    apiGet('/api/config').then((cfg) => {
      setCaptchaConfig({ provider: cfg.captcha_provider || 'none', siteKey: cfg.captcha_site_key || '' })
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setSelectedDetail(null)
    apiGet(`/api/constituencies/${selectedId}`).then((data) => {
      setSelectedDetail(data)
      setTotals(data.totals || {})
      setSelectedCandidate('')
      setMessage('')
      setError('')
    })
  }, [selectedId])

  const filtered = useMemo(() => {
    if (!query) return constituencies
    return constituencies.filter((c) => c.seat.toLowerCase().includes(query.toLowerCase()))
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
      setMessage('Vote recorded. Thank you.')
    } catch (err) {
      if (err.status === 409) {
        setError('You already voted from this device/browser.')
      } else {
        setError(err.message || 'Vote failed')
      }
    }
  }

  return (
    <div className="page-grid">
      <div className="card">
        <div className="panel-title">Find your seat</div>
        <div className="panel-sub">Search by seat name (e.g., Tangail-7).</div>
        <div className="map-controls" style={{ marginTop: 12 }}>
          <input
            className="input"
            placeholder="Search seat name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="notice" style={{ marginTop: 12 }}>
          {filtered.length} seats found
        </div>
        <div className="candidate-list" style={{ marginTop: 12, maxHeight: 520, overflowY: 'auto' }}>
          {filtered.map((c) => (
            <button
              key={c.constituency_no}
              className="candidate-row"
              style={{ cursor: 'pointer', background: selectedId === c.constituency_no ? '#f0e6d2' : '#fffdf8' }}
              onClick={() => setSelectedId(c.constituency_no)}
            >
              <span>{c.seat}</span>
              <span>#{c.constituency_no}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <ConstituencyPanel
          constituency={selectedDetail}
          selectedCandidate={selectedCandidate}
          onSelectCandidate={setSelectedCandidate}
          totals={totals}
        />
        {selectedDetail ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="panel-title">Cast Your Vote</div>
            <CaptchaWidget
              provider={captchaConfig.provider}
              siteKey={captchaConfig.siteKey}
              onToken={setCaptchaToken}
            />
            <button className="vote-btn" onClick={handleVote} disabled={voteDisabled}>
              Submit Vote
            </button>
            {message ? <div className="toast">{message}</div> : null}
            {error ? <div className="notice">{error}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
