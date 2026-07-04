/**
 * DonghuaStream Scraper
 * 
 * Scrapes luciferdonghua.in to build a JSON database of:
 *   - All donghua series (name, poster, status, genres)
 *   - All episodes per series (embed URLs for Dailymotion, Rumble)
 * 
 * Usage:
 *   node scraper/scrape.js              # scrape ALL series
 *   node scraper/scrape.js soul-land-2  # scrape one series only
 * 
 * Output: public/data/series.json + public/data/<slug>.json per series
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'https://luciferdonghua.in';
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const DELAY_MS = 1500; // be polite, don't hammer the server

// ─── HTTP helpers ─────────────────────────────────────────────────────

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'DonghuaStream-Scraper/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Extract iframe src from episode HTML ─────────────────────────────

function extractIframes(html) {
  const servers = {};

  // Dailymotion
  const dmMatch = html.match(/src=["'](https?:\/\/geo\.dailymotion\.com\/player\/[^"']+)["']/i)
    || html.match(/src=["'](https?:\/\/www\.dailymotion\.com\/embed\/[^"']+)["']/i);
  if (dmMatch) servers.dailymotion = dmMatch[1].replace(/&amp;/g, '&');

  // Rumble
  const rbMatch = html.match(/src=["'](https?:\/\/rumble\.com\/embed\/[^"']+)["']/i);
  if (rbMatch) servers.rumble = rbMatch[1].replace(/&amp;/g, '&');

  // OK.ru
  const okMatch = html.match(/src=["'](https?:\/\/ok\.ru\/videoembed\/[^"']+)["']/i);
  if (okMatch) servers.okru = okMatch[1].replace(/&amp;/g, '&');

  // VidHide / yurn.online
  const vhMatch = html.match(/src=["'](https?:\/\/yurn\.online\/embed\/[^"']+)["']/i)
    || html.match(/src=["'](https?:\/\/vidhide\.\w+\/embed\/[^"']+)["']/i);
  if (vhMatch) servers.vidhide = vhMatch[1].replace(/&amp;/g, '&');

  // MisterDonghua
  const mdMatch = html.match(/src=["'](https?:\/\/misterdonghua\.in\/[^"']+)["']/i);
  if (mdMatch) servers.misterdonghua = mdMatch[1].replace(/&amp;/g, '&');

  return servers;
}

// ─── Extract server links from mirror select options ──────────────────

function extractMirrorPaths(html) {
  const paths = [];
  const regex = /<option[^>]*value=["']([^"']*\/v\/\d+\/?)["'][^>]*>([^<]*)<\/option>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    paths.push({ path: m[1], label: m[2].trim() });
  }
  return paths;
}

// ─── Scrape series list from the homepage ─────────────────────────────

async function scrapeSeriesList() {
  console.log('📡 Fetching series list from WP API...');
  
  const allSeries = [];
  let page = 1;
  
  // Get categories (each donghua series is a category in this theme)
  while (true) {
    const url = `${BASE}/wp-json/wp/v2/categories?per_page=100&page=${page}&_fields=id,name,slug,count,description`;
    try {
      const json = await fetch(url);
      const cats = JSON.parse(json);
      if (!cats.length) break;
      
      for (const cat of cats) {
        if (cat.count > 0 && cat.slug !== 'uncategorized') {
          allSeries.push({
            id: cat.slug,
            wpCategoryId: cat.id,
            title: decodeHTMLEntities(cat.name),
            totalEpisodes: cat.count,
          });
        }
      }
      page++;
    } catch (e) {
      break;
    }
  }
  
  console.log(`✅ Found ${allSeries.length} series`);
  return allSeries;
}

// ─── Scrape series detail page for poster, genres, status ────────────

async function scrapeSeriesDetail(seriesSlug) {
  // Try the /anime/<slug>/ page
  const possibleUrls = [
    `${BASE}/anime/${seriesSlug}/`,
    `${BASE}/category/${seriesSlug}/`,
  ];
  
  for (const url of possibleUrls) {
    try {
      const html = await fetch(url);
      
      // Extract poster
      const posterMatch = html.match(/class="ts-post-image[^"]*"[^>]*src=["']([^"']+)["']/i)
        || html.match(/<img[^>]*class="[^"]*thumb[^"]*"[^>]*src=["']([^"']+)["']/i)
        || html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      
      // Extract genres  
      const genres = [];
      const genreRegex = /<a[^>]*href="[^"]*genre[^"]*"[^>]*>([^<]+)<\/a>/gi;
      let gm;
      while ((gm = genreRegex.exec(html)) !== null) {
        genres.push(gm[1].trim());
      }
      
      // Extract status
      const statusMatch = html.match(/<span[^>]*>(?:Status|status)[^<]*<\/span>\s*[:\s]*([^<]+)/i)
        || html.match(/class="status[^"]*"[^>]*>([^<]+)/i);
      
      return {
        poster: posterMatch ? posterMatch[1].replace(/\?resize=\d+,\d+/, '?resize=300,420') : null,
        genres: [...new Set(genres)].slice(0, 5),
        status: statusMatch ? statusMatch[1].trim() : 'Unknown',
      };
    } catch (e) {
      continue;
    }
  }
  
  return { poster: null, genres: [], status: 'Unknown' };
}

// ─── Scrape all episodes for a series ────────────────────────────────

async function scrapeEpisodes(seriesSlug, wpCategoryId) {
  console.log(`  📺 Scraping episodes for: ${seriesSlug}`);
  
  const episodes = [];
  let page = 1;
  
  // Get all posts in this category via WP REST API
  while (true) {
    const url = `${BASE}/wp-json/wp/v2/posts?categories=${wpCategoryId}&per_page=50&page=${page}&_fields=id,slug,title,date,link`;
    try {
      const json = await fetch(url);
      const posts = JSON.parse(json);
      if (!posts.length || posts.code) break;
      
      for (const post of posts) {
        const title = decodeHTMLEntities(post.title.rendered);
        
        // Extract episode number from title
        const epMatch = title.match(/episode\s+(\d+)/i) || title.match(/ep\s*(\d+)/i);
        const epNum = epMatch ? parseInt(epMatch[1]) : null;
        
        episodes.push({
          wpPostId: post.id,
          number: epNum,
          title: title,
          date: post.date ? post.date.split('T')[0] : null,
          slug: post.slug,
          link: post.link,
          servers: {}, // filled below
        });
      }
      
      page++;
      await sleep(500);
    } catch (e) {
      break;
    }
  }
  
  // Sort by episode number
  episodes.sort((a, b) => (b.number || 0) - (a.number || 0));
  
  console.log(`    Found ${episodes.length} episode posts`);
  
  // Now fetch each episode page to get iframe embed URLs
  // Only fetch the first mirror page (default), then try /v/2/ for Rumble
  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    console.log(`    [${i + 1}/${episodes.length}] Scraping Ep ${ep.number || '?'}: ${ep.slug}`);
    
    try {
      // Fetch default page (usually Dailymotion)
      const html = await fetch(ep.link);
      ep.servers = { ...ep.servers, ...extractIframes(html) };
      
      // Get mirror paths
      const mirrors = extractMirrorPaths(html);
      
      // Fetch Rumble mirror if available
      const rumbleMirror = mirrors.find(m => m.label.toLowerCase().includes('rumble'));
      if (rumbleMirror && !ep.servers.rumble) {
        await sleep(DELAY_MS);
        try {
          const rumbleHtml = await fetch(ep.link.replace(/\/$/, '') + rumbleMirror.path);
          const rumbleServers = extractIframes(rumbleHtml);
          if (rumbleServers.rumble) ep.servers.rumble = rumbleServers.rumble;
        } catch (e) { /* skip */ }
      }
    } catch (e) {
      console.log(`    ⚠️  Failed: ${e.message}`);
    }
    
    await sleep(DELAY_MS);
  }
  
  return episodes;
}

// ─── Utilities ───────────────────────────────────────────────────────

function decodeHTMLEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#8211;/g, '–')
    .replace(/&nbsp;/g, ' ').replace(/&#8217;/g, ''');
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const targetSlug = process.argv[2]; // optional: scrape only this series
  
  // Ensure output directory
  fs.mkdirSync(DATA_DIR, { recursive: true });
  
  // Step 1: Get series list
  let seriesList = await scrapeSeriesList();
  
  if (targetSlug) {
    seriesList = seriesList.filter(s => s.id.includes(targetSlug));
    if (!seriesList.length) {
      console.log(`❌ No series found matching: ${targetSlug}`);
      console.log('Available:', seriesList.map(s => s.id).join(', '));
      return;
    }
  }
  
  // Step 2: Get details + episodes for each series
  const catalog = [];
  
  for (const series of seriesList) {
    console.log(`\n🎬 Processing: ${series.title}`);
    
    // Get poster, genres, status
    const detail = await scrapeSeriesDetail(series.id);
    await sleep(DELAY_MS);
    
    const seriesEntry = {
      id: series.id,
      title: series.title,
      poster: detail.poster,
      status: detail.status,
      genres: detail.genres,
      totalEpisodes: series.totalEpisodes,
    };
    catalog.push(seriesEntry);
    
    // Get episodes
    const episodes = await scrapeEpisodes(series.id, series.wpCategoryId);
    
    // Save episodes JSON
    const episodeFile = path.join(DATA_DIR, `${series.id}.json`);
    fs.writeFileSync(episodeFile, JSON.stringify({
      seriesId: series.id,
      title: series.title,
      episodes: episodes.map(ep => ({
        number: ep.number,
        title: ep.title,
        date: ep.date,
        servers: ep.servers,
      })),
    }, null, 2));
    console.log(`  💾 Saved ${episodes.length} episodes to ${series.id}.json`);
  }
  
  // Save catalog
  const catalogFile = path.join(DATA_DIR, 'series.json');
  fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2));
  console.log(`\n✅ Done! Saved ${catalog.length} series to series.json`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
