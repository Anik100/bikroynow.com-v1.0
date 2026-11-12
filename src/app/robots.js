export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bikroynow.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin-dashboard/',
          '/api/',
          '/chat/',
          '/edit-ad/',
          '/post-ad/',
          '/my-ads/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/ads',
          '/ad/*',
          '/about-us',
          '/contact',
          '/faq',
          '/terms',
          '/privacy',
          '/sell-fast',
          '/membership',
        ],
        disallow: [
          '/admin-dashboard/',
          '/api/',
          '/chat/',
          '/edit-ad/',
          '/post-ad/',
          '/my-ads/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
