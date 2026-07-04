import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchSeriesList } from '../api'

export default function Home() {
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search') || ''

  const loadSeries = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSeriesList()
      setSeries(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSeries() }, [])

  const filtered = useMemo(() => {
    if (!searchQuery) return series
    const q = searchQuery.toLowerCase()
    return series.filter(s =>
      s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    )
  }, [series, searchQuery])

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>Loading donghua catalog...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-state">
        <div className="emoji">😵</div>
        <h2>Failed to load catalog</h2>
        <p>{error}</p>
        <button className="retry-btn" onClick={loadSeries}>Try Again</button>
      </div>
    )
  }

  return (
    <div className="animate-in">
      <h1 className="page-title">
        {searchQuery ? `Results for "${searchQuery}"` : 'Donghua Catalog'}
      </h1>
      <p className="page-subtitle">
        {searchQuery
          ? `${filtered.length} series found`
          : `${series.length} series available — streaming from Dailymotion & Rumble`
        }
      </p>

      {filtered.length === 0 ? (
        <div className="error-state">
          <div className="emoji">🔍</div>
          <h2>No results</h2>
          <p>Try a different search term</p>
        </div>
      ) : (
        <div className="series-grid">
          {filtered.map((s, i) => (
            <Link
              to={`/series/${s.id}`}
              key={s.id}
              className="series-card animate-in"
              state={{ series: s }}
              style={{ animationDelay: `${Math.min(i * 0.03, 0.5)}s` }}
            >
              <div className="series-card-poster">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(s.title)}&size=300&background=1e1e2e&color=a78bfa&font-size=0.25&bold=true`}
                  alt={s.title}
                  loading="lazy"
                />
                <div className="series-card-overlay">
                  <span className="series-card-eps">{s.totalEpisodes} EP</span>
                </div>
              </div>
              <div className="series-card-info">
                <h3>{s.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
