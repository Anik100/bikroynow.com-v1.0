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
          background: 'linear-gradient(135deg, #FFB703 0%, #F59E0B 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          color: 'white',
          fontWeight: 900,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', gap: '5px', marginTop: '1px' }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'white' }} />
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'white' }} />
        </div>
        <div
          style={{
            width: '12px',
            height: '6px',
            borderBottom: '2px solid white',
            borderRadius: '0 0 10px 10px',
            margin: '1px 0 2px 0',
          }}
        />
        <div style={{ fontSize: '7px', fontWeight: 900, letterSpacing: '0.5px', lineHeight: 1 }}>
          NOW
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
