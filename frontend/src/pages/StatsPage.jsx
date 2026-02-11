import React, { useEffect, useState } from 'react'
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

export default function StatsPage() {
  const [stats, setStats] = useState(null)

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
