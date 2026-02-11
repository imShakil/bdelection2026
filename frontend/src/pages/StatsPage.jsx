import React, { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api.js'

function StatList({ title, data }) {
  const entries = Object.entries(data || {})
  if (!entries.length) return null
  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <div className="list-rows">
        {entries.map(([key, value]) => (
          <div key={key} className="candidate-row" style={{ padding: '8px 10px' }}>
            <span>{key}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SeatResult({ seat, totals }) {
  if (!seat) return null
  return (
    <div className="stat-card">
      <h3>Seat Result</h3>
      <div className="panel-title" style={{ marginBottom: 6 }}>{seat.seat}</div>
      <div className="panel-sub">{seat.division} · Constituency #{seat.constituency_no}</div>
      <div className="candidate-list" style={{ marginTop: 10 }}>
        {(seat.candidates || []).map((c) => (
          <div className="candidate-row" key={c.candidate_id}>
            <span>{c.name} <span className="small">({c.party})</span></span>
            <span>{totals?.[c.candidate_id] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatsPage() {
  const [stats, setStats] = useState(null)
  const [constituencies, setConstituencies] = useState([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [seatDetail, setSeatDetail] = useState(null)

  useEffect(() => {
    let active = true
    const load = () => {
      apiGet('/api/results/overall').then((data) => {
        if (active) setStats(data)
      })
    }
    load()
    const id = setInterval(load, 10000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    apiGet('/api/constituencies').then(setConstituencies)
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setSeatDetail(null)
    apiGet(`/api/results/constituency/${selectedId}`).then((data) => {
      setSeatDetail(data)
    })
  }, [selectedId])

  const filtered = useMemo(() => {
    if (!query) return constituencies
    return constituencies.filter((c) => c.seat.toLowerCase().includes(query.toLowerCase()))
  }, [query, constituencies])

  if (!stats) {
    return <div className="card">Loading stats...</div>
  }

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: 18 }}>
        <div className="stat-card">
          <h3>Total Votes</h3>
          <div className="stat-value">{stats.total_votes}</div>
        </div>
        <div className="stat-card">
          <h3>Constituencies</h3>
          <div className="stat-value">{stats.constituencies_count}</div>
        </div>
        <div className="stat-card">
          <h3>Disabled Seats</h3>
          <div className="stat-value">{stats.disabled_count}</div>
        </div>
      </div>

      <div className="page-grid" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="panel-title">Search seat results</div>
          <div className="panel-sub">Type a seat name (e.g., Tangail-7).</div>
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
          <div className="candidate-list" style={{ marginTop: 12, maxHeight: 360, overflowY: 'auto' }}>
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
        <SeatResult seat={seatDetail} totals={seatDetail?.totals} />
      </div>

      <div className="stats-grid">
        <StatList title="Votes by Alliance" data={stats.votes_by_alliance} />
        <StatList title="Votes by Party" data={stats.votes_by_party} />
        <StatList title="Seats Leading by Alliance" data={stats.seats_leading_by_alliance} />
        <StatList title="Seats Leading by Party" data={stats.seats_leading_by_party} />
      </div>
      <div className="small" style={{ marginTop: 16 }}>
        Updated at {stats.updated_at}
      </div>
    </div>
  )
}
