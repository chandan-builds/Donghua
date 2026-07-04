import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { fetchSeriesList, fetchEpisodes } from '../api'
import SeriesPoster from '../components/SeriesPoster'

export default function Series() {
  const { slug } = useParams()
  const location = useLocation()
  const [seriesInfo, setSeriesInfo] = useState(location.state?.series || null)
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      // If we don't have series info from navigation state, fetch it
      let info = seriesInfo
      if (!info) {
        const allSeries = await fetchSeriesList()
        info = allSeries.find(s => s.id === slug)
        if (!info) throw new Error('Series not found')
        setSeriesInfo(info)
      }

      // Fetch episodes
      const eps = await fetchEpisodes(info.wpCategoryId)
      setEpisodes(eps)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [slug])

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>Loading episodes...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-state">
        <div className="emoji">😵</div>
        <h2>Failed to load series</h2>
        <p>{error}</p>
        <button className="retry-btn" onClick={loadData}>Try Again</button>
        <Link to="/" style={{ marginTop: 12, color: 'var(--accent-light)', fontSize: '0.88rem' }}>
          ← Back to catalog
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-in">
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span className="sep">›</span>
        <span>{seriesInfo?.title || slug}</span>
      </nav>

      {/* Series Hero */}
      <div className="series-hero animate-in delay-1">
        <div className="series-hero-poster">
          <SeriesPoster slug={slug} title={seriesInfo?.title} />
        </div>
        <div className="series-hero-info">
          <h1>{seriesInfo?.title}</h1>
          <div className="series-meta-tags">
            <span className="meta-tag quality">4K</span>
            <span className="meta-tag sub">ENG SUB</span>
            <span className="meta-tag ongoing">
              {seriesInfo?.totalEpisodes} Episodes
            </span>
            <span className="meta-tag info">Donghua</span>
          </div>
          {seriesInfo?.description && (
            <p className="series-description">{seriesInfo.description}</p>
          )}
        </div>
      </div>

      {/* Episode List */}
      <div className="animate-in delay-2">
        <div className="episode-list-header">
          <h2>
            Episodes
            <span className="ep-count">{episodes.length}</span>
          </h2>
        </div>

        {episodes.length === 0 ? (
          <div className="error-state" style={{ minHeight: '20vh' }}>
            <p style={{ color: 'var(--text-muted)' }}>No episodes found</p>
          </div>
        ) : (
          <div className="episode-grid">
            {episodes.map((ep) => (
              <Link
                to={`/watch/${slug}/${ep.number || ep.id}`}
                key={ep.id}
                className="ep-btn"
                state={{
                  episode: ep,
                  seriesInfo,
                  allEpisodes: episodes,
                }}
              >
                {ep.number || '?'}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
