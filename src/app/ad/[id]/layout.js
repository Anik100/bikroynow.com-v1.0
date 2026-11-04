import { getAdForSeo, buildAdMetadata, buildAdJsonLd } from '../../../lib/seoHelper';

export async function generateMetadata({ params }) {
  const ad = await getAdForSeo(params.id);
  return buildAdMetadata(ad, params.id);
}

export default async function AdLayout({ children, params }) {
  const ad = await getAdForSeo(params.id);
  const jsonLd = buildAdJsonLd(ad, params.id);

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
