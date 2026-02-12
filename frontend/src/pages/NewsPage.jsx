import React, { useEffect, useState } from 'react'
import { apiGet } from '../api.js'
import { t } from '../i18n.js'

export default function NewsPage({ lang }) {
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    apiGet('/api/news')
      .then((data) => setNews(data))
      .catch(() => {
        setError(lang === 'bn' ? 'সংবাদ লোড করা যায়নি।' : 'Failed to load news.')
      })
      .finally(() => setLoading(false))
  }, [lang])

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
        {loading ? (
          <div className="list-rows">
            <div className="skeleton" style={{ height: 60 }}></div>
            <div className="skeleton" style={{ height: 60 }}></div>
            <div className="skeleton" style={{ height: 60 }}></div>
          </div>
        ) : null}
        {!loading && error ? <div className="notice">{error}</div> : null}
        {!loading && !error ? (
          <div className="list-rows">
            {(news?.items || []).map((item, idx) => (
              <a key={`${item.link}-${idx}`} className="news-item" href={item.link} target="_blank" rel="noreferrer">
                <div className="news-title">{item.title}</div>
                <div className="small">{item.source} · {item.published || ''}</div>
              </a>
            ))}
            {(news?.items || []).length === 0 ? (
              <div className="small">{lang === 'bn' ? 'কোনো সংবাদ পাওয়া যায়নি।' : 'No news items found.'}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="panel-title">{t(lang, 'news_fun')}</div>
        <div className="panel-sub">{t(lang, 'news_tip')}</div>
      </div>
    </div>
  )
}
