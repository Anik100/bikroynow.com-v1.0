import { getAdForSeo } from '../../../lib/seoHelper';
import AdDetailsClient from './AdDetailsClient';

export const dynamic = 'force-dynamic';

export default async function AdPage({ params }) {
  console.log('>>> AdPage params:', params);
  const id = params?.id;
  const ad = await getAdForSeo(id);
  console.log('>>> AdPage ad found:', !!ad, ad?.title);
  return <AdDetailsClient initialAd={ad} adId={id} />;
}
