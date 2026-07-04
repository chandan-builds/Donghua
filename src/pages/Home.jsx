import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchSeriesList, fetchRecentReleases } from '../api'

export default function Home() {
  const [series, setSeries] = useState([])
  const [recentReleases, setRecentReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  const navigate = useNavigate()

  const recentSliderRef = useRef(null)
  const trendingSliderRef = useRef(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [seriesData, recentData] = await Promise.all([
        fetchSeriesList(),
        fetchRecentReleases()
      ])
      setSeries(seriesData)
      setRecentReleases(recentData)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Helper to map category ID to series slug
  const getSeriesSlug = (categoryId, postSlug) => {
    const found = series.find(s => s.wpCategoryId === categoryId)
    if (found) return found.id
    
    // Guessing fallback slug from post slug
    // e.g. "battle-through-the-heavens-season-5-episode-206-lucifer-donghua" -> "battle-through-the-heavens-season-5"
    const cleaned = postSlug
      .replace(/-episode-\d+.*$/, '')
      .replace(/-ep-\d+.*$/, '')
      .replace(/-lucifer-donghua$/, '')
    return cleaned
  }

  const filteredSeries = useMemo(() => {
    if (!searchQuery) return series
    const q = searchQuery.toLowerCase()
    return series.filter(s =>
      s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    )
  }, [series, searchQuery])

  // Select a spotlight show for the Hero Banner (e.g. Soul Land 2 or Battle Through the Heavens)
  const spotlight = useMemo(() => {
    if (series.length === 0) return null
    // Prefer "soul-land" or "battle-through" or just pick the top one
    const popular = series.find(s => s.id.includes('soul-land') || s.id.includes('battle-through'))
    return popular || series[0]
  }, [series])

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>Loading your ad-free stream universe...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-state">
        <div className="emoji">😵</div>
        <h2>Failed to sync with sources</h2>
        <p>{error}</p>
        <button className="retry-btn" onClick={loadData}>Try Again</button>
      </div>
    )
  }

  return (
    <div className="animate-in">
      {searchQuery ? (
        // Search Results Layout
        <div>
          <h1 className="page-title">Search Results</h1>
          <p className="page-subtitle">Found {filteredSeries.length} series matching "{searchQuery}"</p>
          {filteredSeries.length === 0 ? (
            <div className="error-state">
              <div className="emoji">🔍</div>
              <h2>No matching shows found</h2>
              <p>Try searching for generic terms like "Land" or "Heavens"</p>
            </div>
          ) : (
            <div className="series-grid">
              {filteredSeries.map((s, i) => (
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
      ) : (
        // Netflix Dashboard Layout
        <div>
          {/* Hero Spotlight Billboard */}
          {spotlight && (
            <div
              className="hero-billboard"
              style={{
                backgroundImage: `linear-gradient(rgba(8, 8, 13, 0.4), rgba(8, 8, 13, 0.9)), url(https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1280&auto=format&fit=crop)`
              }}
            >
              <div className="hero-overlay" />
              <div className="hero-content">
                <span className="hero-logo-tag">✦ Trending Now</span>
                <h1 className="hero-title">{spotlight.title}</h1>
                <div className="hero-meta">
                  <span className="meta-tag quality">4K UHD</span>
                  <span className="meta-tag sub">ENG SUB</span>
                  <span className="meta-tag ongoing">{spotlight.totalEpisodes} Episodes</span>
                </div>
                <p className="hero-description">
                  {spotlight.description || 'Step into the ultimate battle of immortals. Experience stunning 4K visual animations, deep tactical encounters, and magical cultivation journeys in this top-rated series.'}
                </p>
                <div className="hero-buttons">
                  <button
                    className="btn-netflix btn-netflix-primary"
                    onClick={() => navigate(`/series/${spotlight.id}`)}
                  >
                    <span>▶</span> Play Latest
                  </button>
                  <button
                    className="btn-netflix btn-netflix-secondary"
                    onClick={() => navigate(`/series/${spotlight.id}`)}
                  >
                    ⓘ More Info
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Row 1: Recent Releases (Episodes) */}
          {recentReleases.length > 0 && (
            <div className="netflix-row">
              <div className="row-header">
                <h2 className="row-title">Recent Releases</h2>
              </div>
              <div className="slider-wrapper">
                <div className="row-slider" ref={recentSliderRef}>
                  {recentReleases.map((post) => {
                    const seriesSlug = getSeriesSlug(post.categoryId, post.slug)
                    return (
                      <div
                        key={post.id}
                        className="netflix-card"
                        onClick={() => navigate(`/watch/${seriesSlug}/${post.episode || post.id}`)}
                      >
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(post.title)}&size=300&background=1a1a2e&color=a78bfa&font-size=0.3&bold=true`}
                          alt={post.title}
                          loading="lazy"
                        />
                        <div className="netflix-card-overlay">
                          <h3 className="netflix-card-title">{post.title}</h3>
                          <div className="netflix-card-meta">
                            <span className="netflix-card-tag">EP {post.episode || '?'}</span>
                            <span>{post.date}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Row 2: Trending Series */}
          {series.length > 0 && (
            <div className="netflix-row">
              <div className="row-header">
                <h2 className="row-title">Trending Series</h2>
              </div>
              <div className="slider-wrapper">
                <div className="row-slider" ref={trendingSliderRef}>
                  {series.slice(0, 15).map((s) => (
                    <div
                      key={s.id}
                      className="netflix-card"
                      onClick={() => navigate(`/series/${s.id}`)}
                    >
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(s.title)}&size=300&background=141424&color=a78bfa&font-size=0.25&bold=true`}
                        alt={s.title}
                        loading="lazy"
                      />
                      <div className="netflix-card-overlay">
                        <h3 className="netflix-card-title">{s.title}</h3>
                        <div className="netflix-card-meta">
                          <span className="netflix-card-tag">{s.totalEpisodes} EP</span>
                          <span>Cultivation</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Row 3: All Series Catalog Grid */}
          <div className="netflix-row">
            <div className="row-header">
              <h2 className="row-title">All Catalog</h2>
            </div>
            <div className="series-grid">
              {series.slice(15).map((s, i) => (
                <Link
                  to={`/series/${s.id}`}
                  key={s.id}
                  className="series-card"
                  state={{ series: s }}
                >
                  <div className="series-card-poster">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(s.title)}&size=300&background=12121a&color=a78bfa&font-size=0.25&bold=true`}
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
          </div>
        </div>
      )}
    </div>
  )
}
