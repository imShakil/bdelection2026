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
      <div className="panel-title">{lang === 'bn' && constituency.seat_bn ? constituency.seat_bn : constituency.seat}</div>
      <div className="panel-sub">
        {(lang === 'bn' && constituency.division_bn ? constituency.division_bn : constituency.division)} · Constituency #{constituency.constituency_no}
      </div>
      {constituency.notes ? (
        <div className="notice">{constituency.notes}</div>
      ) : null}
      <div className="candidate-list">
        {(constituency.candidates || []).map((c) => (
          <label className="candidate-row candidate-option" key={c.candidate_id}>
            <span className="candidate-option-main">
              <input
                type="radio"
                name="candidate"
                value={c.candidate_id}
                checked={selectedCandidate === c.candidate_id}
                onChange={() => onSelectCandidate(c.candidate_id)}
              />{' '}
              {(lang === 'bn' && c.name_bn ? c.name_bn : c.name)} <span className="small">({(lang === 'bn' && c.party_bn ? c.party_bn : c.party)})</span>
            </span>
            <span className="candidate-option-votes">{totals?.[c.candidate_id] || 0}</span>
          </label>
        ))}
        {!constituency.candidates ? (
          <div className="small">{t(lang, 'loading_candidates')}</div>
        ) : null}
      </div>
    </div>
  )
}
