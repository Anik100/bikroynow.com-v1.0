import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 100,
          background: 'linear-gradient(135deg, #008b5e 0%, #00583b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '40px',
          color: 'white',
          fontWeight: 900,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#ffffff', marginRight: '4px' }}>B</span>
          <span style={{ color: '#fbbf24', fontSize: '72px', fontWeight: 900 }}>N</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
