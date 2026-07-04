import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchSeriesList, fetchEpisodes, fetchEmbedUrls } from '../api'

const SERVER_META = {
  dailymotion: { label: 'Dailymotion', icon: 'D', iconClass: 'dm', quality: '4K' },
  rumble: { label: 'Rumble', icon: 'R', iconClass: 'rb', quality: '4K' },
  okru: { label: 'OK.ru', icon: 'O', iconClass: 'ok', quality: '4K' },
  vidhide: { label: 'VidHide', icon: 'V', iconClass: 'vh', quality: '4K' },
}

export default function Watch() {
  const { slug, episode: epParam } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [episodeInfo, setEpisodeInfo] = useState(location.state?.episode || null)
  const [seriesInfo, setSeriesInfo] = useState(location.state?.seriesInfo || null)
  const [allEpisodes, setAllEpisodes] = useState(location.state?.allEpisodes || [])
  const [servers, setServers] = useState({})
  const [activeServer, setActiveServer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playerLoading, setPlayerLoading] = useState(true)
  const [error, setError] = useState(null)

  const epNumber = parseInt(epParam) || null

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setServers({})
    setActiveServer(null)

    try {
      let ep = episodeInfo
      let series = seriesInfo
      let eps = allEpisodes

      // If we navigated directly (no state), fetch everything
      if (!ep || !series || eps.length === 0) {
        const allSeries = await fetchSeriesList()
        series = allSeries.find(s => s.id === slug)
        if (!series) throw new Error('Series not found')
        setSeriesInfo(series)

        eps = await fetchEpisodes(series.wpCategoryId)
        setAllEpisodes(eps)

        ep = eps.find(e => e.number === epNumber) || eps.find(e => e.id === epNumber)
        if (!ep) throw new Error(`Episode ${epParam} not found`)
        setEpisodeInfo(ep)
      }

      // Fetch embed URLs from the episode page
      const { servers: srv } = await fetchEmbedUrls(ep.link)
      setServers(srv)

      // Pick the best available server (prefer dailymotion, then rumble)
      const preferOrder = ['dailymotion', 'rumble', 'okru', 'vidhide']
      const best = preferOrder.find(s => srv[s]) || Object.keys(srv)[0]
      setActiveServer(best || null)

      if (!best && Object.keys(srv).length === 0) {
        setError('No video sources found for this episode')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [slug, epParam, epNumber])

  useEffect(() => {
    loadData()
    // Reset episode info when URL changes
    setEpisodeInfo(location.state?.episode || null)
  }, [slug, epParam])

  const switchServer = (server) => {
    if (server === activeServer) return
    setPlayerLoading(true)
    setActiveServer(server)
  }

  const currentUrl = activeServer ? servers[activeServer] : null
  const serverList = Object.keys(servers).filter(s => SERVER_META[s])

  // Find prev/next episodes
  const sortedEps = [...allEpisodes].sort((a, b) => (a.number || 0) - (b.number || 0))
  const currentIdx = sortedEps.findIndex(e => e.number === epNumber)
  const prevEp = currentIdx > 0 ? sortedEps[currentIdx - 1] : null
  const nextEp = currentIdx < sortedEps.length - 1 ? sortedEps[currentIdx + 1] : null

  const goToEp = (ep) => {
    navigate(`/watch/${slug}/${ep.number || ep.id}`, {
      state: { episode: ep, seriesInfo, allEpisodes },
    })
  }

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>Loading video sources...</p>
      </div>
    )
  }

  if (error && !currentUrl) {
    return (
      <div className="error-state">
        <div className="emoji">📺</div>
        <h2>Can't load video</h2>
        <p>{error}</p>
        <button className="retry-btn" onClick={loadData}>Try Again</button>
        <Link to={`/series/${slug}`}
          style={{ marginTop: 12, color: 'var(--accent-light)', fontSize: '0.88rem' }}>
          ← Back to episodes
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="breadcrumb animate-in">
        <Link to="/">Home</Link>
        <span className="sep">›</span>
        <Link to={`/series/${slug}`}>{seriesInfo?.title || slug}</Link>
        <span className="sep">›</span>
        <span>Episode {epNumber || epParam}</span>
      </nav>

      {/* Title */}
      <h1 className="watch-title animate-in delay-1">
        {episodeInfo?.title || `${seriesInfo?.title} — Episode ${epNumber || epParam}`}
      </h1>

      {/* Server Switcher */}
      {serverList.length > 0 && (
        <div className="server-switcher animate-in delay-1">
          <span className="server-label">Server:</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {serverList.map(s => (
              <button
                key={s}
                className={`server-btn ${activeServer === s ? 'active' : ''}`}
                onClick={() => switchServer(s)}
              >
                <span className={`server-icon ${SERVER_META[s].iconClass}`}>
                  {SERVER_META[s].icon}
                </span>
                {SERVER_META[s].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Video Player */}
      <div className="player-wrapper animate-in delay-2">
        <div className="player-aspect">
          <div className={`player-loading ${!playerLoading ? 'hidden' : ''}`}>
            <div className="spinner" />
            <p>Loading player...</p>
          </div>
          {currentUrl ? (
            <iframe
              key={currentUrl}
              src={currentUrl}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => setPlayerLoading(false)}
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: '0.9rem',
            }}>
              No video source available
            </div>
          )}
        </div>
        <div className="player-toolbar">
          <div className="toolbar-info">
            <span className="status-dot" />
            <span>
              {activeServer && SERVER_META[activeServer]
                ? `Playing from ${SERVER_META[activeServer].label} — ${SERVER_META[activeServer].quality}`
                : 'No server selected'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Prev / Next Episode Navigation */}
      <div className="ep-nav animate-in delay-3">
        <button
          className="ep-nav-btn"
          disabled={!prevEp}
          onClick={() => prevEp && goToEp(prevEp)}
        >
          ← Episode {prevEp?.number || '?'}
        </button>
        <button
          className="ep-nav-btn"
          disabled={!nextEp}
          onClick={() => nextEp && goToEp(nextEp)}
        >
          Episode {nextEp?.number || '?'} →
        </button>
      </div>

      {/* Episode Grid Below Player */}
      {allEpisodes.length > 0 && (
        <div style={{ marginTop: 28 }} className="animate-in delay-3">
          <div className="episode-list-header">
            <h2>
              All Episodes
              <span className="ep-count">{allEpisodes.length}</span>
            </h2>
          </div>
          <div className="episode-grid">
            {allEpisodes.map(ep => (
              <button
                key={ep.id}
                className={`ep-btn ${ep.number === epNumber ? 'current' : ''}`}
                onClick={() => goToEp(ep)}
              >
                {ep.number || '?'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
