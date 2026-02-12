import React, { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api.js'
import { t } from '../i18n.js'

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
          <div key={key} className="candidate-row stats-row" style={{ padding: '8px 10px' }}>
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

function BarList({ title, data }) {
  const entries = Object.entries(data || {})
  if (!entries.length) return null
  const maxValue = Math.max(...entries.map(([, v]) => v))
  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <div className="list-rows">
        {entries.map(([key, value]) => {
          const width = maxValue ? Math.round((value / maxValue) * 100) : 0
          const color = PARTY_COLORS[key] || '#5b6066'
          return (
            <div key={key} className="bar-row">
              <div className="bar-label">
                <ColorBadge label={key} />
                <span>{value}</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${width}%`, background: color }}></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DonutChart({ title, data, lang }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v > 0)
  if (!entries.length) {
    return (
      <div className="stat-card">
        <h3>{title}</h3>
        <div className="small" style={{ marginTop: 8 }}>{t(lang, 'stats_novotes')}</div>
      </div>
    )
  }

  const total = entries.reduce((sum, [, v]) => sum + v, 0)
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <div className="donut-wrap">
        <svg width="140" height="140" viewBox="0 0 140 140" className="donut">
          <circle cx="70" cy="70" r={radius} className="donut-track" />
          {entries.map(([key, value]) => {
            const dash = (value / total) * circumference
            const style = {
              stroke: PARTY_COLORS[key] || '#5b6066',
              strokeDasharray: `${dash} ${circumference - dash}`,
              strokeDashoffset: -offset
            }
            offset += dash
            return <circle key={key} cx="70" cy="70" r={radius} className="donut-seg" style={style} />
          })}
        </svg>
        <div className="donut-center">
          <div className="donut-total">{total}</div>
          <div className="small">{t(lang, 'stats_total_votes')}</div>
        </div>
      </div>
      <div className="legend compact" style={{ marginTop: 10 }}>
        {entries.map(([label]) => (
          <div key={label} className="legend-item">
            <span className="legend-swatch" style={{ background: PARTY_COLORS[label] || '#5b6066' }}></span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SeatResult({ seat, totals, loading, lang }) {
  if (loading) {
    return (
      <div className="stat-card">
        <h3>{t(lang, 'stats_seat_result')}</h3>
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
      <h3>{t(lang, 'stats_seat_result')}</h3>
      <div className="panel-title" style={{ marginBottom: 6 }}>{lang === 'bn' && seat.seat_bn ? seat.seat_bn : seat.seat}</div>
      <div className="panel-sub">{(lang === 'bn' && seat.division_bn ? seat.division_bn : seat.division)} · Constituency #{seat.constituency_no}</div>
      <div className="candidate-list" style={{ marginTop: 10 }}>
        {(seat.candidates || []).map((c) => {
          const value = totals?.[c.candidate_id] || 0
          const width = maxVotes ? Math.round((value / maxVotes) * 100) : 0
          return (
            <div className="candidate-row stats-row" key={c.candidate_id}>
              <span>{(lang === 'bn' && c.name_bn ? c.name_bn : c.name)} <span className="small">({(lang === 'bn' && c.party_bn ? c.party_bn : c.party)})</span></span>
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

export default function StatsPage({ lang }) {
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
    return constituencies.filter((c) => {
      const seat = (c.seat || '').toLowerCase()
      const seatBn = (c.seat_bn || '').toLowerCase()
      const q = query.toLowerCase()
      return seat.includes(q) || seatBn.includes(q)
    })
  }, [query, constituencies])

  const projectionEntries = useMemo(() => {
    const entries = Object.entries(stats?.projection_by_party || {})
    return entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [stats])

  const projectedWinnerText = useMemo(() => {
    if (!projectionEntries.length) return ''
    const winner = stats?.projected_winner
    if (winner?.is_tied && winner?.tied_parties?.length) {
      return `${t(lang, 'stats_projection_tie')}: ${winner.tied_parties.join(', ')} (${winner.seats})`
    }
    if (winner?.party) {
      return `${t(lang, 'stats_projected_winner')}: ${winner.party} (${winner.seats})`
    }
    const topSeats = projectionEntries[0][1]
    const topParties = projectionEntries.filter(([, seats]) => seats === topSeats).map(([party]) => party)
    if (topParties.length > 1) {
      return `${t(lang, 'stats_projection_tie')}: ${topParties.join(', ')} (${topSeats})`
    }
    return `${t(lang, 'stats_projected_winner')}: ${topParties[0]} (${topSeats})`
  }, [lang, projectionEntries, stats])

  if (!stats && loadingStats) {
    return (
      <div className="card">
        <div className="panel-title">{t(lang, 'stats_title')}</div>
        <div className="skeleton" style={{ height: 160, marginTop: 16 }}></div>
      </div>
    )
  }

  const tied = stats?.seats_leading_by_alliance?.tied || 0
  const noVotes = stats?.seats_leading_by_alliance?.no_votes || 0
  const reporting = Math.max(0, (stats?.constituencies_count || 0) - (stats?.disabled_count || 0) - tied - noVotes)

  return (
    <div className="stats-page">
      <div className="section-head">
        <div>
          <div className="panel-title">{t(lang, 'stats_title')}</div>
          <div className="panel-sub">{t(lang, 'stats_sub')}</div>
        </div>
        <div className="small">{loadingStats ? t(lang, 'stats_refreshing') : `${t(lang, 'stats_updated')} ${stats?.updated_at || ''}`}</div>
      </div>

      <section className="section">
        <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">{t(lang, 'stats_total_votes')}</div>
          <div className="kpi-value">{stats?.total_votes || 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t(lang, 'stats_reporting')}</div>
          <div className="kpi-value">{reporting}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t(lang, 'stats_tied')}</div>
          <div className="kpi-value">{tied}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t(lang, 'stats_novotes')}</div>
          <div className="kpi-value">{noVotes}</div>
        </div>
        </div>
      </section>

      <section className="section">
      <div className="page-grid">
        <div className="card">
          <div className="panel-title">{t(lang, 'stats_search_title')}</div>
          <div className="panel-sub">{t(lang, 'stats_search_sub')}</div>
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
          <div className="candidate-list stats-seat-list" style={{ marginTop: 12, maxHeight: 360, overflowY: 'auto' }}>
            {filtered.map((c) => (
              <button
                key={c.constituency_no}
                className="candidate-row stats-row"
                style={{ cursor: 'pointer', background: selectedId === c.constituency_no ? '#eef3fb' : '#fff' }}
                onClick={() => setSelectedId(c.constituency_no)}
              >
                <span>{lang === 'bn' && c.seat_bn ? c.seat_bn : c.seat}</span>
                <span>#{c.constituency_no}</span>
              </button>
            ))}
          </div>
        </div>
        {seatDetail || loadingSeat ? (
          <SeatResult seat={seatDetail} totals={seatDetail?.totals} loading={loadingSeat} lang={lang} />
        ) : (
          <div className="stat-card">
            <h3>{t(lang, 'stats_seat_result')}</h3>
            <div className="panel-sub" style={{ marginTop: 6 }}>
              {t(lang, 'stats_search_sub')}
            </div>
            <div className="list-rows" style={{ marginTop: 12 }}>
              {(stats?.top_seats_by_votes || []).slice(0, 5).map((s) => (
                <div key={s.constituency_no} className="candidate-row stats-row" style={{ padding: '8px 10px' }}>
                  <span>{lang === 'bn' && s.seat_bn ? s.seat_bn : s.seat}</span>
                  <span>{s.total_votes}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </section>

      <section className="section">
      <div className="stats-grid">
        <BarList title={t(lang, 'stats_votes_by_alliance')} data={stats?.votes_by_alliance} />
        <DonutChart title={t(lang, 'stats_votes_by_party')} data={stats?.votes_by_party} lang={lang} />
      </div>
      </section>

      <section className="section">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>{t(lang, 'stats_top10')}</h3>
          <div className="list-rows">
            {(stats?.top_seats_by_votes || []).filter((s) => s.total_votes > 0).slice(0, 10).map((s) => (
              <div key={s.constituency_no} className="candidate-row stats-row" style={{ padding: '8px 10px' }}>
                <span>{lang === 'bn' && s.seat_bn ? s.seat_bn : s.seat}</span>
                <span>{s.total_votes}</span>
              </div>
            ))}
            {(stats?.top_seats_by_votes || []).filter((s) => s.total_votes > 0).length === 0 ? (
              <div className="small">No vote data yet.</div>
            ) : null}
          </div>
        </div>
        <div className="stat-card">
          <h3>{t(lang, 'stats_legend')}</h3>
          <div className="legend compact">
            {Object.keys(PARTY_COLORS).map((label) => (
              <div key={label} className="legend-item">
                <span className="legend-swatch" style={{ background: PARTY_COLORS[label] }}></span>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <hr />
          <h3>{t(lang, 'stats_projection')}</h3>
          <div className="small" style={{ marginTop: 6 }}>{t(lang, 'stats_projection_sub')}</div>
          {projectedWinnerText ? (
            <div className="panel-title" style={{ marginTop: 10 }}>{projectedWinnerText}</div>
          ) : null}
          <div className="list-rows" style={{ marginTop: 12 }}>
            {projectionEntries.length ? (
              projectionEntries.map(([party, seats]) => (
                <div key={party} className="candidate-row stats-row" style={{ padding: '8px 10px' }}>
                  <span>{party}</span>
                  <span>{seats}</span>
                </div>
              ))
            ) : (
              <div className="small">{t(lang, 'stats_projection_insufficient')}</div>
            )}
          </div>
        </div>
      </div>
      </section>

      <section className="section">
      <div className="stats-grid">
        <StatList title={t(lang, 'stats_seats_by_alliance')} data={stats?.seats_leading_by_alliance} />
        <StatList title={t(lang, 'stats_seats_by_party')} data={stats?.seats_leading_by_party} />
      </div>
      </section>

      <section className="section">
        
      </section>
    </div>
  )
}
