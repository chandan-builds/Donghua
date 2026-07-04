/**
 * Vercel Serverless Proxy
 * 
 * Proxies requests to luciferdonghua.in to avoid CORS issues.
 * Deployed as a Vercel Edge Function in Mumbai (bom1) region.
 * 
 * Usage: /api/proxy?url=https://luciferdonghua.in/wp-json/wp/v2/categories
 */

export const config = {
  runtime: 'edge',
  regions: ['bom1'], // Mumbai — closest to India
};

const ALLOWED_ORIGINS = [
  'luciferdonghua.in',
  'geo.dailymotion.com',
  'api.dailymotion.com',
  'rumble.com',
  'ok.ru',
  'yurn.online',
  'misterdonghua.in',
];

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate the target URL
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Security: only proxy to allowed domains
  const isAllowed = ALLOWED_ORIGINS.some(
    (origin) => parsed.hostname === origin || parsed.hostname.endsWith('.' + origin)
  );

  if (!isAllowed) {
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://luciferdonghua.in/',
      },
    });

    const contentType = response.headers.get('Content-Type') || 'text/plain';
    const body = await response.arrayBuffer();

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': contentType.includes('json')
          ? 'public, s-maxage=300, stale-while-revalidate=600'   // 5min for API
          : 'public, s-maxage=60, stale-while-revalidate=120',   // 1min for HTML
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy fetch failed', details: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
