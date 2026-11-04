import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'BikroyNow.com - Buy & Sell Anything in Bangladesh';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#171717',
          backgroundImage: 'radial-gradient(circle at 50% 45%, rgba(245, 158, 11, 0.18) 0%, rgba(23, 23, 23, 1) 70%)',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle decorative border */}
        <div
          style={{
            position: 'absolute',
            inset: 24,
            border: '2px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 36,
          }}
        />

        {/* Hero Orange Logo Badge */}
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: 56,
            background: 'linear-gradient(135deg, #FFB703 0%, #F59E0B 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 24px 60px rgba(245, 158, 11, 0.45), 0 4px 12px rgba(0,0,0,0.5)',
            marginBottom: 36,
          }}
        >
          {/* Eyes */}
          <div style={{ display: 'flex', gap: 34, marginTop: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
            <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
          </div>

          {/* Smile Curve */}
          <div
            style={{
              width: 90,
              height: 38,
              borderBottom: '12px solid #FFFFFF',
              borderRadius: '0 0 60px 60px',
              marginTop: 10,
              marginBottom: 16,
            }}
          />

          {/* NOW Text */}
          <div
            style={{
              fontSize: 46,
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: 4,
              lineHeight: 1,
            }}
          >
            NOW
          </div>
        </div>

        {/* Brand Name Typography */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 76, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-1px' }}>
            Bikroy
          </span>
          <span
            style={{
              fontSize: 76,
              fontWeight: 900,
              color: '#FFB703',
              letterSpacing: '-1px',
              marginLeft: 4,
            }}
          >
            Now
          </span>
          <span
            style={{
              fontSize: 76,
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-1px',
              marginLeft: 2,
            }}
          >
            .com
          </span>
        </div>

        {/* Subtitle / Tagline */}
        <div
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: '#cbd5e1',
            marginTop: 18,
            letterSpacing: '0.5px',
          }}
        >
          Buy & Sell Anything in Bangladesh | বাংলাদেশের বিশ্বস্ত অনলাইন মার্কেটপ্লেস
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
