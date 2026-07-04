import { useState, useEffect } from 'react'
import { fetchSeriesPoster } from '../api'

// Cache popular posters statically to avoid extra network requests on load
const POPULAR_POSTERS = {
  'soul-land-2-the-peerless-tang-sect-new-2023': 'https://i0.wp.com/luciferdonghua.in/wp-content/uploads/2023/06/Untitled.webp',
  'battle-through-the-heavens-season-5-new': 'https://i1.wp.com/luciferdonghua.in/wp-content/uploads/2026/01/battle-through-the-heavens-season-5.webp',
  'perfect-world-wanmei-shijie-new': 'https://i0.wp.com/luciferdonghua.in/wp-content/uploads/2021/11/perfect-world-wanmei-shijie-lucifer-donghua-chinese-anime-donghua-1.webp',
  'martial-master-new': 'https://i0.wp.com/luciferdonghua.in/wp-content/uploads/2020/09/Martial-Master-lucifer-donghua.webp',
  'swallowed-star-season-2-new': 'https://i2.wp.com/luciferdonghua.in/wp-content/uploads/2020/12/swallowed-star-lucifer-donghua-chinese-anime-donghua-1.webp',
  'renegade-immortal-xian-ni': 'https://i2.wp.com/luciferdonghua.in/wp-content/uploads/2023/09/renegade-immortal-xian-ni-lucifer-donghua.webp',
  'a-record-of-mortals-journey-to-immortality-season-4-2025': 'https://i3.wp.com/luciferdonghua.in/wp-content/uploads/2025/01/a-record-of-mortals-journey-to-immortality-season-5-2026.webp',
  'shrouding-the-heavens-zhe-tian': 'https://i2.wp.com/luciferdonghua.in/wp-content/uploads/2023/04/shrouding-the-heavens-zhe-tian-lucifer-donghua.webp',
  'against-the-sky-supreme': 'https://i0.wp.com/luciferdonghua.in/wp-content/uploads/2021/11/against-the-sky-supreme-lucifer-donghua.webp',
  'one-hundred-thousand-years-of-qi-refining': 'https://i3.wp.com/luciferdonghua.in/wp-content/uploads/2023/02/one-hundred-thousand-years-of-qi-refining-lucifer-donghua.webp',
  'ten-thousand-worlds-season-2': 'https://i2.wp.com/luciferdonghua.in/wp-content/uploads/2022/08/ten-thousand-worlds-season-2-lucifer-donghua.webp',
  'the-demon-hunter': 'https://i2.wp.com/luciferdonghua.in/wp-content/uploads/2026/03/the-demon-hunter-season-3.jpg',
  'peerless-martial-spirit': 'https://i1.wp.com/luciferdonghua.in/wp-content/uploads/2020/10/Peerless-Martial-Spirit-lucifer-donghua.webp',
  'spirit-sword-sovereign': 'https://i2.wp.com/luciferdonghua.in/wp-content/uploads/2020/09/Spirit-Sword-Sovereign-lucifer-donghua.webp',
  'supreme-god-emperor-season-2': 'https://i0.wp.com/luciferdonghua.in/wp-content/uploads/2025/12/supreme-god-emperor-wu-shang-shen-di-season-02.webp',
  'the-great-ruler-season-2': 'https://i0.wp.com/luciferdonghua.in/wp-content/uploads/2026/01/the-great-ruler-season-2-lucifer-donghua.webp',
  'ever-night-jiang-ye': 'https://i0.wp.com/luciferdonghua.in/wp-content/uploads/2026/04/ever-night-jiang-ye-lucifer-donghua-chinese-anime.webp',
  'lord-of-all-lords': 'https://i2.wp.com/luciferdonghua.in/wp-content/uploads/2020/10/Lord-of-All-Lords-lucifer-donghua.webp',
  'martial-universe-season-4': 'https://i0.wp.com/luciferdonghua.in/wp-content/uploads/2023/11/martial-universe-season-4-lucifer-donghua.webp',
  'throne-of-seal-shen-yin-wang-zuo': 'https://i1.wp.com/luciferdonghua.in/wp-content/uploads/2022/04/throne-of-seal-shen-yin-wang-zuo-lucifer-donghua.webp'
}

// Global runtime cache to store dynamically loaded posters
const POSTER_CACHE = {}

export default function SeriesPoster({ slug, title, className, style, isHero = false }) {
  const [posterUrl, setPosterUrl] = useState(
    POPULAR_POSTERS[slug] || POSTER_CACHE[slug] || null
  )

  useEffect(() => {
    // If we already have it in static or runtime cache, do nothing
    if (POPULAR_POSTERS[slug] || POSTER_CACHE[slug]) {
      setPosterUrl(POPULAR_POSTERS[slug] || POSTER_CACHE[slug])
      return
    }

    let isMounted = true

    const loadPoster = async () => {
      try {
        const url = await fetchSeriesPoster(slug)
        if (url && isMounted) {
          POSTER_CACHE[slug] = url
          setPosterUrl(url)
        }
      } catch (e) {
        console.error('Failed to load poster for', slug, e)
      }
    }

    loadPoster()

    return () => {
      isMounted = false
    }
  }, [slug])

  // Fallback to high-quality gradient with title letters if still loading or missing
  if (!posterUrl) {
    return (
      <div
        className={className}
        style={{
          ...style,
          background: 'linear-gradient(135deg, #1b133a, #110d24)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          textAlign: 'center',
          border: '1px solid var(--border)'
        }}
      >
        <span style={{ fontSize: '3rem', marginBottom: '8px' }}>🐲</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-light)', opacity: 0.8 }}>
          {title}
        </span>
      </div>
    )
  }

  // Optimize Jetpack CDN sizing
  let optimizedUrl = posterUrl
  if (optimizedUrl.includes('wp.com') || optimizedUrl.includes('luciferdonghua.in')) {
    const cleanUrl = optimizedUrl.split('?')[0]
    optimizedUrl = isHero 
      ? `${cleanUrl}?w=800`
      : `${cleanUrl}?resize=300,420`
  }

  const IS_DEPLOYED = !window.location.hostname.includes('localhost')
    && !window.location.hostname.includes('127.0.0.1');

  const displayUrl = IS_DEPLOYED
    ? `/api/proxy?url=${encodeURIComponent(optimizedUrl)}`
    : optimizedUrl;

  return (
    <img
      src={displayUrl}
      alt={title}
      className={className}
      style={style}
      loading="lazy"
    />
  )
}

// Export the mapping so other components can fetch Hero banners directly
export { POPULAR_POSTERS }
