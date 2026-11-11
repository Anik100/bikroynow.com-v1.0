import { getHomeData } from '../lib/getHomeData';
import HomeClient from './HomeClient';

// Incremental Static Regeneration (ISR): Background regenerate every 60 seconds.
// This serves cached instant HTML (< 30ms TTFB) with server-rendered featured ads
// and product listings, giving mobile crawlers instant discovery of LCP hero images
// without client-side waterfalls or CLS layout shifts.
export const revalidate = 60;

export default async function Home() {
  const { initialFeaturedAds, initialListings } = await getHomeData();

  return (
    <HomeClient
      initialFeaturedAds={initialFeaturedAds}
      initialListings={initialListings}
    />
  );
}
