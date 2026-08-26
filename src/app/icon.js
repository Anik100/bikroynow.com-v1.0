import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 20,
          background: 'linear-gradient(135deg, #008b5e 0%, #00583b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '7px',
          color: 'white',
          fontWeight: 900,
          fontFamily: 'sans-serif',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#ffffff', marginRight: '1px' }}>B</span>
          <span style={{ color: '#fbbf24', fontSize: '14px', fontWeight: 900 }}>N</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
