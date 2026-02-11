import React from 'react'

export default function ConstituencyPanel({ constituency, selectedCandidate, onSelectCandidate, totals, lang, t }) {
  if (!constituency) {
    return (
      <div className="card">
        <div className="panel-title">{t(lang, 'vote_find_title')}</div>
        <div className="panel-sub">{t(lang, 'vote_find_sub')}</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="panel-title">{constituency.seat}</div>
      <div className="panel-sub">
        {constituency.division} · Constituency #{constituency.constituency_no}
      </div>
      {constituency.notes ? (
        <div className="notice">{constituency.notes}</div>
      ) : null}
      <div className="candidate-list">
        {(constituency.candidates || []).map((c) => (
          <label className="candidate-row" key={c.candidate_id}>
            <span>
              <input
                type="radio"
                name="candidate"
                value={c.candidate_id}
                checked={selectedCandidate === c.candidate_id}
                onChange={() => onSelectCandidate(c.candidate_id)}
              />{' '}
              {c.name} <span className="small">({c.party})</span>
            </span>
            <span>{totals?.[c.candidate_id] || 0}</span>
          </label>
        ))}
        {!constituency.candidates ? (
          <div className="small">{t(lang, 'loading_candidates')}</div>
        ) : null}
      </div>
    </div>
  )
}
