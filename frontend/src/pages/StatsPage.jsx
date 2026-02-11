import React, { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api.js'

const STATS_CACHE_KEY = 'bd_stats_cache_v1'

const PARTY_COLORS = {
  BNP: '#1b4b8f',
  'JP(E)': '#2a7b5f',
  'Jatiya Party (Ershad)': '#2a7b5f',
  Jamaat: '#7a4b1b',
  NCP: '#6b2f5f',
  '11 Party Alliance': '#6b2f5f'
}

function ColorBadge({ label }) {
  const color = PARTY_COLORS[label] || '#5b6066'
  return (
    <span className="badge" style={{ background: color }}>
      {label}
    </span>
  )
}

function StatList({ title, data }) {
  const entries = Object.entries(data || {})
  if (!entries.length) return null
  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <div className="list-rows">
        {entries.map(([key, value]) => (
          <div key={key} className="candidate-row" style={{ padding: '8px 10px' }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ColorBadge label={key} />
            </span>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SeatResult({ seat, totals, loading }) {
  if (loading) {
    return (
      <div className="stat-card">
        <h3>Seat Result</h3>
        <div className="skeleton" style={{ height: 16, width: '70%', marginTop: 10 }}></div>
        <div className="skeleton" style={{ height: 12, width: '40%', marginTop: 10 }}></div>
        <div className="skeleton" style={{ height: 120, width: '100%', marginTop: 16 }}></div>
      </div>
    )
  }
  if (!seat) return null
  const maxVotes = Math.max(0, ...Object.values(totals || {}))
  return (
    <div className="stat-card">
      <h3>Seat Result</h3>
      <div className="panel-title" style={{ marginBottom: 6 }}>{seat.seat}</div>
      <div className="panel-sub">{seat.division} · Constituency #{seat.constituency_no}</div>
      <div className="candidate-list" style={{ marginTop: 10 }}>
        {(seat.candidates || []).map((c) => {
          const value = totals?.[c.candidate_id] || 0
          const width = maxVotes ? Math.round((value / maxVotes) * 100) : 0
          return (
            <div className="candidate-row" key={c.candidate_id}>
              <span>{c.name} <span className="small">({c.party})</span></span>
              <span>{value}</span>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${width}%` }}></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function StatsPage() {
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [constituencies, setConstituencies] = useState([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [seatDetail, setSeatDetail] = useState(null)
  const [loadingSeat, setLoadingSeat] = useState(false)

  useEffect(() => {
    const cached = localStorage.getItem(STATS_CACHE_KEY)
    if (cached) {
      try {
        setStats(JSON.parse(cached))
        setLoadingStats(false)
      } catch {
        // ignore
      }
    }

    let active = true
    const load = () => {
      setLoadingStats(true)
      apiGet('/api/results/overall').then((data) => {
        if (!active) return
        setStats(data)
        setLoadingStats(false)
        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(data))
      }).catch(() => {
        setLoadingStats(false)
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
    setLoadingSeat(true)
    apiGet(`/api/results/constituency/${selectedId}`).then((data) => {
      setSeatDetail(data)
      setLoadingSeat(false)
    }).catch(() => setLoadingSeat(false))
  }, [selectedId])

  const filtered = useMemo(() => {
    if (!query) return constituencies
    return constituencies.filter((c) => c.seat.toLowerCase().includes(query.toLowerCase()))
  }, [query, constituencies])

  if (!stats && loadingStats) {
    return (
      <div className="card">
        <div className="panel-title">Loading election dashboard...</div>
        <div className="skeleton" style={{ height: 160, marginTop: 16 }}></div>
      </div>
    )
  }

  const tied = stats?.seats_leading_by_alliance?.tied || 0
  const noVotes = stats?.seats_leading_by_alliance?.no_votes || 0
  const reporting = Math.max(0, (stats?.constituencies_count || 0) - (stats?.disabled_count || 0) - tied - noVotes)

  return (
    <div>
      <div className="section-head">
        <div>
          <div className="panel-title">Election Dashboard</div>
          <div className="panel-sub">Live tally snapshot with seat‑level detail.</div>
        </div>
        <div className="small">{loadingStats ? 'Refreshing…' : `Updated at ${stats?.updated_at || ''}`}</div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 18 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Votes</div>
          <div className="kpi-value">{stats?.total_votes || 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Seats Reporting</div>
          <div className="kpi-value">{reporting}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Tied Seats</div>
          <div className="kpi-value">{tied}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">No Votes</div>
          <div className="kpi-value">{noVotes}</div>
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
                style={{ cursor: 'pointer', background: selectedId === c.constituency_no ? '#eef3fb' : '#fff' }}
                onClick={() => setSelectedId(c.constituency_no)}
              >
                <span>{c.seat}</span>
                <span>#{c.constituency_no}</span>
              </button>
            ))}
          </div>
        </div>
        <SeatResult seat={seatDetail} totals={seatDetail?.totals} loading={loadingSeat} />
      </div>

      <div className="stats-grid" style={{ marginBottom: 18 }}>
        <div className="stat-card">
          <h3>Top 10 Seats by Votes</h3>
          <div className="list-rows">
            {(stats?.top_seats_by_votes || []).map((s) => (
              <div key={s.constituency_no} className="candidate-row" style={{ padding: '8px 10px' }}>
                <span>{s.seat}</span>
                <span>{s.total_votes}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="stat-card">
          <h3>Party Legend</h3>
          <div className="legend">
            {Object.keys(PARTY_COLORS).map((label) => (
              <div key={label} className="legend-item">
                <span className="legend-swatch" style={{ background: PARTY_COLORS[label] }}></span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <StatList title="Votes by Alliance" data={stats?.votes_by_alliance} />
        <StatList title="Votes by Party" data={stats?.votes_by_party} />
        <StatList title="Seats Leading by Alliance" data={stats?.seats_leading_by_alliance} />
        <StatList title="Seats Leading by Party" data={stats?.seats_leading_by_party} />
      </div>
    </div>
  )
}
