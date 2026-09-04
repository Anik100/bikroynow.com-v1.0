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
  description: 'BikroyNow.com - The largest online marketplace in Bangladesh to buy, sell, and find used mobile phones, second-hand laptops, routers, cars, bikes, properties, and jobs safely and fast. বাংলাদেশের বিশ্বস্ত অনলাইন কেনাবেচা মার্কেটপ্লেস।',
  keywords: [
    // Brand Variations
    'BikroyNow', 'bikroynow.com', 'bikroy now', 'বিক্রয়নও', 'বিক্রয় নাও', 'bikroyhut', 'bikroy marketplace',

    // Bengali Search Terms (বাংলা সার্চ)
    'বাই সেল বাংলাদেশ', 'পুরাতন জিনিস ক্রয় বিক্রয়', 'পুরাতন মোবাইল কেনা বেচা', 'সেকেন্ড হ্যান্ড ল্যাপটপ',
    'ব্যবহৃত রাউটার দাম', 'পুরাতন গাড়ি বিক্রি', 'সেকেন্ড হ্যান্ড বাইক বিডি', 'অনলাইন মার্কেটপ্লেস বাংলাদেশ',
    'ফ্রি বিজ্ঞাপন পোস্ট', 'বাসা ভাড়া ও জমি বিক্রয়', 'চাকরির খবর বাংলাদেশ', 'ইলেকট্রনিক্স কেনাবেচা টাঙ্গাইল',
    'ব্যবহৃত ফোন কিনুন', 'পুরোনো জিনিস বেচাকেনা', 'সেরা মার্কেটপ্লেস বিডি', 'অনলাইন কেনাবেচা',

    // Banglish Search Terms (বাংলিশ সার্চ)
    'puraton jinish kroy bikroy', 'purano mobile bikroy', 'puraton phone kinbo', 'second hand laptop dam',
    'used router price bd', 'purano bike becha kena', 'online buy sell bangladesh', 'free ad post bd',
    'tangail buy sell', 'dhaka used electronics', 'kom dame used phone', 'bhalo classified website',
    'basha bhara ad', 'chakri khobor bangladesh', 'used gari bikroy', 'puran jinis sell', 'becha kena bd',

    // English Search Terms (ইংরেজি সার্চ)
    'buy and sell Bangladesh', 'used mobile phone bd', 'second hand laptops bangladesh',
    'used router price in bangladesh', 'online marketplace bd', 'free classified ads bangladesh',
    'electronics tangail', 'buy second hand electronics', 'used cars and bikes bd',
    'post free ad in bangladesh', 'classifieds marketplace bangladesh', 'sell fast bd'
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
  verification: {
    google: 'fhC9HvJp-lIaXm3VnKC1W_EtPwoGY6dHeXWSTgYiAm0',
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
        <meta name="google-site-verification" content="fhC9HvJp-lIaXm3VnKC1W_EtPwoGY6dHeXWSTgYiAm0" />
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
