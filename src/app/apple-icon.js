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
          background: 'linear-gradient(135deg, #FFB703 0%, #F59E0B 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '42px',
          color: 'white',
          fontWeight: 900,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', gap: '26px', marginTop: '4px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'white' }} />
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'white' }} />
        </div>
        <div
          style={{
            width: '74px',
            height: '32px',
            borderBottom: '10px solid white',
            borderRadius: '0 0 50px 50px',
            margin: '8px 0 14px 0',
          }}
        />
        <div style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '3px', lineHeight: 1 }}>
          NOW
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
