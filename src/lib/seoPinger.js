/**
 * Automated SEO & Indexing Pipeline for BikroyNow.com
 * Supports:
 * - Real-time Instant Indexing (IndexNow, Bing, Yandex, Google Indexing API)
 * - Dynamic Batch Submissions
 * - Search Engine Sitemap Ping
 */

export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'b8f9e0a2417c4de296f7c139db08e5c1';
export const CANONICAL_HOST = 'www.bikroynow.com';
export const CANONICAL_BASE = 'https://www.bikroynow.com';

/**
 * Pings IndexNow API (Supported by Microsoft Bing, Yandex, Seznam, Naver)
 * Enables crawling and indexing of newly published ad URLs within minutes.
 */
export async function pingIndexNow(urls = []) {
  const urlList = (Array.isArray(urls) ? urls : [urls])
    .filter(Boolean)
    .map((u) => {
      if (u.startsWith('http')) return u;
      return `${CANONICAL_BASE}/ad/${u}`;
    });

  if (urlList.length === 0) return { success: false, reason: 'Empty URL list' };

  const payload = {
    host: CANONICAL_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${CANONICAL_BASE}/${INDEXNOW_KEY}.txt`,
    urlList: urlList.slice(0, 1000), // IndexNow batch limit
  };

  const endpoints = [
    'https://api.indexnow.org/indexnow',
    'https://www.bing.com/indexnow',
    'https://yandex.com/indexnow',
  ];

  const results = await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'User-Agent': 'BikroyNow-IndexingBot/2.0',
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
        });
        return {
          endpoint,
          status: res.status,
          ok: res.ok || res.status === 200 || res.status === 202,
        };
      } catch (err) {
        return { endpoint, ok: false, error: err.message };
      }
    })
  );

  const successfulPings = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
  console.log(`[IndexNow] Submitted ${urlList.length} URL(s) to ${successfulPings}/${endpoints.length} engines.`);

  return {
    success: successfulPings > 0,
    submittedCount: urlList.length,
    results,
  };
}

/**
 * Pings Google Indexing API if service account credentials are provided.
 * Uses official Google OAuth2 JWT authentication flow.
 */
export async function pingGoogleIndexingApi(targetUrl, action = 'URL_UPDATED') {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    // Graceful skip when service account is not yet configured
    return {
      success: true,
      skipped: true,
      message: 'Google Service Account credentials not set in env (optional).',
    };
  }

  try {
    const crypto = await import('crypto');

    // Generate JWT for Google OAuth2
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsignedJwt = `${b64(header)}.${b64(claimSet)}`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsignedJwt);
    const signature = sign.sign(privateKey, 'base64url');
    const jwt = `${unsignedJwt}.${signature}`;

    // Request access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(`Failed to retrieve Google access token: ${tokenData.error_description || 'Unknown error'}`);
    }

    // Publish URL notification
    const publishRes = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify({
        url: targetUrl,
        type: action,
      }),
    });

    const publishData = await publishRes.json();
    console.log(`[Google Indexing API] Published ${targetUrl}:`, publishRes.status);
    return { success: publishRes.ok, data: publishData };
  } catch (err) {
    console.warn('[Google Indexing API] Ping failed gracefully:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Universal Event Hook for Real-Time Instant Indexing
 * Triggered on ad creation or moderation approval.
 * Non-blocking background execution.
 */
export async function notifySearchEngines(adIdOrUrl, options = {}) {
  const fullUrl = adIdOrUrl?.startsWith('http')
    ? adIdOrUrl
    : `${CANONICAL_BASE}/ad/${adIdOrUrl}`;

  const sitemapUrl = `${CANONICAL_BASE}/sitemap.xml`;

  // Run in background asynchronously without blocking user response
  Promise.allSettled([
    // 1. IndexNow Real-Time Ping
    pingIndexNow([fullUrl]),

    // 2. Google Indexing API
    pingGoogleIndexingApi(fullUrl, 'URL_UPDATED'),

    // 3. Fallback Sitemap Pings
    fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, {
      method: 'GET',
      headers: { 'User-Agent': 'BikroyNow-SEOBot/2.0' },
      cache: 'no-store',
    }).catch(() => {}),

    fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, {
      method: 'GET',
      headers: { 'User-Agent': 'BikroyNow-SEOBot/2.0' },
      cache: 'no-store',
    }).catch(() => {}),
  ])
    .then(() => {
      console.log(`[Auto-SEO] Real-time indexing triggered successfully for: ${fullUrl}`);
    })
    .catch((err) => {
      console.error('[Auto-SEO] Error in notifySearchEngines:', err);
    });
}
