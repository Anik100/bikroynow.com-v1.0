/**
 * Automated Search Engine Ping & Indexing Helper for BikroyNow
 * Notifies Google and Bing whenever an ad is posted or updated.
 */
export async function notifySearchEngines(adId = null) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bikroynow.com';
  const sitemapUrl = `${siteUrl}/sitemap.xml`;

  // We run asynchronously in background without blocking API response
  Promise.allSettled([
    // Google Sitemap Ping
    fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, {
      method: 'GET',
      headers: { 'User-Agent': 'BikroyNow-SEOBot/1.0' },
      cache: 'no-store'
    }).catch(() => {}),

    // Bing Sitemap Ping
    fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, {
      method: 'GET',
      headers: { 'User-Agent': 'BikroyNow-SEOBot/1.0' },
      cache: 'no-store'
    }).catch(() => {})
  ]).then(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Auto-SEO] Notified search engines for sitemap update${adId ? ` (Ad: ${adId})` : ''}`);
    }
  }).catch(() => {});
}
