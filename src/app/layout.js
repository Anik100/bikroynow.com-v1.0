import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { LanguageProvider } from '../context/LanguageContext';
import PageTransition from '../components/PageTransition';
import AiSupportWidget from '../components/AiSupportWidget';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bikroynow.com';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'BikroyNow.com - Buy & Sell Anything in Bangladesh',
    template: '%s | BikroyNow.com',
  },
  description: 'The largest online marketplace in Bangladesh to buy, sell, and find electronics, mobile phones, computers, routers, cars, bikes, properties, and jobs safely and fast.',
  keywords: [
    'BikroyNow',
    'bikroynow.com',
    'buy and sell Bangladesh',
    'used mobile phone bd',
    'used router price in bangladesh',
    'online marketplace bd',
    'free classified ads bangladesh',
    'electronics tangail',
    'buy second hand electronics'
  ],
  authors: [{ name: 'BikroyNow Team', url: siteUrl }],
  creator: 'BikroyNow',
  publisher: 'BikroyNow',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'BikroyNow.com - Buy & Sell Anything in Bangladesh',
    description: 'The largest online marketplace in Bangladesh to buy, sell, and find electronics, mobile phones, cars, and properties.',
    url: siteUrl,
    siteName: 'BikroyNow',
    locale: 'bn_BD',
    type: 'website',
    images: [
      {
        url: `${siteUrl}/icon.svg`,
        width: 512,
        height: 512,
        alt: 'BikroyNow.com Marketplace Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BikroyNow.com - Buy & Sell Anything in Bangladesh',
    description: 'The largest online marketplace in Bangladesh to buy, sell, and find electronics, mobiles, and more.',
    images: [`${siteUrl}/icon.svg`],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon', type: 'image/png' },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'BikroyNow',
      description: 'The largest online marketplace in Bangladesh to buy and sell anything.',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${siteUrl}/ads?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
      inLanguage: ['bn', 'en'],
    },
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'BikroyNow',
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <LanguageProvider>
          <Navbar />
          <main style={{ minHeight: 'calc(100vh - 200px)' }}>
            <PageTransition>
              {children}
            </PageTransition>
          </main>
          <Footer />
          <AiSupportWidget />
        </LanguageProvider>
      </body>
    </html>
  );
}
