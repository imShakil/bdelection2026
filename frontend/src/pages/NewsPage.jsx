import React, { useEffect, useState } from 'react'
import { apiGet } from '../api.js'
import { t } from '../i18n.js'

export default function NewsPage({ lang }) {
  const [news, setNews] = useState(null)

  useEffect(() => {
    apiGet('/api/news').then(setNews)
  }, [])

  return (
    <div>
      <div className="section-head">
        <div>
          <div className="panel-title">{t(lang, 'news_title')}</div>
          <div className="panel-sub">{t(lang, 'news_sub')}</div>
        </div>
        <div className="small">{t(lang, 'news_disclaimer')}</div>
      </div>

      <div className="stat-card" style={{ marginBottom: 18 }}>
        <h3>{t(lang, 'news_headlines')}</h3>
        <div className="list-rows">
          {(news?.items || []).map((item, idx) => (
            <a key={`${item.link}-${idx}`} className="news-item" href={item.link} target="_blank" rel="noreferrer">
              <div className="news-title">{item.title}</div>
              <div className="small">{item.source} · {item.published || ''}</div>
            </a>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="panel-title">{t(lang, 'news_fun')}</div>
        <div className="panel-sub">{t(lang, 'news_tip')}</div>
      </div>
    </div>
  )
}
