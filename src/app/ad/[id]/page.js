import { getAdForSeo } from '../../../lib/seoHelper';
import AdDetailsClient from './AdDetailsClient';

// Cache on edge/server for 60 seconds so ad pages load instantaneously in milliseconds
export const revalidate = 60;

export default async function AdPage({ params }) {
  const id = params?.id;
  const ad = await getAdForSeo(id);
  return <AdDetailsClient initialAd={ad} adId={id} />;
}
