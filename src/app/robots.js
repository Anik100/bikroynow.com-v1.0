export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bikroynow.com';

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
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
