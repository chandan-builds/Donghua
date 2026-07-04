/**
 * API service for fetching data from luciferdonghua.in WordPress REST API.
 * This is where the site gets ALL its data from.
 * 
 * When deployed to Vercel: uses our own /api/proxy Edge Function (Mumbai region, fast in India)
 * When running locally: falls back to public CORS proxies
 */

const WP_BASE = 'https://luciferdonghua.in/wp-json/wp/v2';

// Detect if we're running on Vercel (production) or localhost (dev)
const IS_DEPLOYED = !window.location.hostname.includes('localhost')
  && !window.location.hostname.includes('127.0.0.1');

// Fallback public CORS proxies for local development only
const DEV_CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

let activeDevProxy = 0;

async function fetchWithProxy(url) {
  // In production (Vercel): use our own Edge proxy — fast, reliable, no third-party deps
  if (IS_DEPLOYED) {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) return res;
    // If our proxy fails, fall through to public proxies
  }

  // In development or fallback: try public CORS proxies
  for (let i = 0; i < DEV_CORS_PROXIES.length; i++) {
    const proxyIdx = (activeDevProxy + i) % DEV_CORS_PROXIES.length;
    const proxyUrl = DEV_CORS_PROXIES[proxyIdx] + encodeURIComponent(url);
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        activeDevProxy = proxyIdx;
        return res;
      }
    } catch (e) {
      continue;
    }
  }

  // Last resort: try direct (may work with CORS extension)
  return fetch(url);
}

/**
 * Fetch all donghua series from the WordPress categories API.
 * Each donghua series is a WordPress "category".
 */
export async function fetchSeriesList() {
  const allSeries = [];
  let page = 1;

  while (true) {
    const url = `${WP_BASE}/categories?per_page=100&page=${page}&_fields=id,name,slug,count,description`;
    const res = await fetchWithProxy(url);
    
    if (!res.ok) break;
    
    const cats = await res.json();
    if (!cats.length) break;

    for (const cat of cats) {
      // Filter out non-series categories
      if (cat.count > 0 && cat.slug !== 'uncategorized' && cat.slug !== 'anime') {
        allSeries.push({
          id: cat.slug,
          wpCategoryId: cat.id,
          title: decodeHTML(cat.name),
          totalEpisodes: cat.count,
          description: cat.description ? decodeHTML(cat.description) : '',
        });
      }
    }

    page++;
    if (cats.length < 100) break; // no more pages
  }

  // Sort by episode count (most popular first)
  allSeries.sort((a, b) => b.totalEpisodes - a.totalEpisodes);

  return allSeries;
}

/**
 * Fetch all episodes for a given series by WordPress category ID.
 */
export async function fetchEpisodes(wpCategoryId) {
  const episodes = [];
  let page = 1;

  while (true) {
    const url = `${WP_BASE}/posts?categories=${wpCategoryId}&per_page=100&page=${page}&_fields=id,slug,title,date,link,featured_media`;
    const res = await fetchWithProxy(url);
    
    if (!res.ok) break;

    const posts = await res.json();
    if (!posts.length || posts.code) break;

    for (const post of posts) {
      const title = decodeHTML(post.title.rendered);
      const epMatch = title.match(/episode\s+(\d+)/i) || title.match(/ep\s*\.?\s*(\d+)/i);
      const epNum = epMatch ? parseInt(epMatch[1]) : null;

      episodes.push({
        id: post.id,
        number: epNum,
        title,
        date: post.date ? post.date.split('T')[0] : null,
        slug: post.slug,
        link: post.link,
      });
    }

    page++;
    if (posts.length < 100) break;
  }

  // Sort by episode number descending
  episodes.sort((a, b) => (b.number || 0) - (a.number || 0));

  return episodes;
}

/**
 * Fetch the embed URLs (iframe src) from an episode page.
 * We fetch the HTML and parse out the iframe sources and mirror options.
 * 
 * Dailymotion uses TWO embed formats:
 *   1. <iframe src="https://geo.dailymotion.com/player/xj8x3.html?video=VIDEO_ID">
 *   2. <script src="https://geo.dailymotion.com/player/xj8x3.js" data-video="VIDEO_ID">
 * We handle both.
 */
export async function fetchEmbedUrls(episodeLink) {
  const res = await fetchWithProxy(episodeLink);
  if (!res.ok) throw new Error('Failed to fetch episode page');

  const html = await res.text();
  const servers = {};

  // Extract Dailymotion embed — Method 1: iframe src with .html
  const dmIframeMatch = html.match(/src=["'](https?:\/\/geo\.dailymotion\.com\/player\/[^"']+\.html[^"']*)["']/i)
    || html.match(/src=["'](https?:\/\/www\.dailymotion\.com\/embed\/[^"']+)["']/i);
  if (dmIframeMatch) {
    servers.dailymotion = dmIframeMatch[1].replace(/&amp;/g, '&');
  }

  // Extract Dailymotion embed — Method 2: <script> tag with data-video attribute
  // Format: <script src="https://geo.dailymotion.com/player/PLAYER_ID.js" data-video="VIDEO_ID">
  if (!servers.dailymotion) {
    const dmScriptMatch = html.match(/<script[^>]*src=["'](https?:\/\/geo\.dailymotion\.com\/player\/([^"']+?)\.js)["'][^>]*data-video=["']([^"']+)["']/i)
      || html.match(/data-video=["']([^"']+)["'][^>]*src=["'](https?:\/\/geo\.dailymotion\.com\/player\/([^"']+?)\.js)["']/i);
    if (dmScriptMatch) {
      // First regex: groups are [full, scriptUrl, playerId, videoId]
      // Second regex: groups are [full, videoId, scriptUrl, playerId]
      const playerId = dmScriptMatch[2] || dmScriptMatch[3];
      const videoId = dmScriptMatch[3] || dmScriptMatch[1];
      servers.dailymotion = `https://geo.dailymotion.com/player/${playerId}.html?video=${videoId}`;
    }
  }

  // Also try: just a .js src without data-video on same tag (data-video could be on a sibling)
  if (!servers.dailymotion) {
    const dmJsMatch = html.match(/src=["'](https?:\/\/geo\.dailymotion\.com\/player\/([^"']+?)\.js)["']/i);
    const dvMatch = html.match(/data-video=["']([^"']+)["']/i);
    if (dmJsMatch && dvMatch) {
      servers.dailymotion = `https://geo.dailymotion.com/player/${dmJsMatch[2]}.html?video=${dvMatch[1]}`;
    }
  }

  // Extract Rumble embed
  const rbMatch = html.match(/src=["'](https?:\/\/rumble\.com\/embed\/[^"']+)["']/i);
  if (rbMatch) servers.rumble = rbMatch[1].replace(/&amp;/g, '&');

  // Extract OK.ru embed
  const okMatch = html.match(/src=["'](https?:\/\/ok\.ru\/videoembed\/[^"']+)["']/i);
  if (okMatch) servers.okru = okMatch[1].replace(/&amp;/g, '&');

  // Extract VidHide / yurn.online embed
  const vhMatch = html.match(/src=["'](https?:\/\/yurn\.online\/embed\/[^"']+)["']/i)
    || html.match(/src=["'](https?:\/\/vidhide\.\w+\/embed\/[^"']+)["']/i);
  if (vhMatch) servers.vidhide = vhMatch[1].replace(/&amp;/g, '&');

  // Extract mirror paths for fetching other servers
  const mirrorPaths = [];
  const mirrorRegex = /<option[^>]*value=["']([^"']*\/v\/\d+\/?)[^>]*>([^<]*)<\/option>/gi;
  let m;
  while ((m = mirrorRegex.exec(html)) !== null) {
    mirrorPaths.push({ path: m[1], label: m[2].trim() });
  }

  // If we're missing servers, try fetching mirror pages
  const serversToTry = [
    { key: 'rumble', keyword: 'rumble' },
    { key: 'dailymotion', keyword: 'dailymotion' },
    { key: 'okru', keyword: 'ok.ru' },
  ];

  for (const { key, keyword } of serversToTry) {
    if (servers[key] || mirrorPaths.length === 0) continue;
    const mirror = mirrorPaths.find(mp => mp.label.toLowerCase().includes(keyword));
    if (!mirror) continue;

    try {
      // Handle both relative paths (/v/2/) and full URLs
      let mirrorUrl;
      if (mirror.path.startsWith('http')) {
        mirrorUrl = mirror.path;
      } else {
        mirrorUrl = episodeLink.replace(/\/$/, '') + mirror.path;
      }

      const mirrorRes = await fetchWithProxy(mirrorUrl);
      if (mirrorRes.ok) {
        const mirrorHtml = await mirrorRes.text();
        const extracted = extractServersFromHtml(mirrorHtml);
        if (extracted[key]) servers[key] = extracted[key];
      }
    } catch (e) { /* skip */ }
  }

  return { servers, mirrorPaths };
}

/** Helper to extract server URLs from HTML (reusable for mirror pages) */
function extractServersFromHtml(html) {
  const servers = {};

  // Dailymotion iframe
  const dmi = html.match(/src=["'](https?:\/\/geo\.dailymotion\.com\/player\/[^"']+\.html[^"']*)["']/i);
  if (dmi) servers.dailymotion = dmi[1].replace(/&amp;/g, '&');

  // Dailymotion script tag
  if (!servers.dailymotion) {
    const dms = html.match(/src=["'](https?:\/\/geo\.dailymotion\.com\/player\/([^"']+?)\.js)["']/i);
    const dvs = html.match(/data-video=["']([^"']+)["']/i);
    if (dms && dvs) servers.dailymotion = `https://geo.dailymotion.com/player/${dms[2]}.html?video=${dvs[1]}`;
  }

  const rb = html.match(/src=["'](https?:\/\/rumble\.com\/embed\/[^"']+)["']/i);
  if (rb) servers.rumble = rb[1].replace(/&amp;/g, '&');

  const ok = html.match(/src=["'](https?:\/\/ok\.ru\/videoembed\/[^"']+)["']/i);
  if (ok) servers.okru = ok[1].replace(/&amp;/g, '&');

  return servers;
}

/**
 * Fetch poster image URL for a series from the anime page.
 */
export async function fetchSeriesPoster(seriesSlug) {
  const url = `https://luciferdonghua.in/anime/${seriesSlug}/`;
  try {
    const res = await fetchWithProxy(url);
    if (!res.ok) return null;
    const html = await res.text();

    // Try to find the poster image
    const posterMatch = html.match(/class="ts-post-image[^"]*"[^>]*src=["']([^"']+)["']/i)
      || html.match(/<img[^>]*class="[^"]*thumb[^"]*"[^>]*src=["']([^"']+)["']/i)
      || html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);

    return posterMatch ? posterMatch[1] : null;
  } catch (e) {
    return null;
  }
}

function decodeHTML(str) {
  const el = document.createElement('textarea');
  el.innerHTML = str;
  return el.value;
}
