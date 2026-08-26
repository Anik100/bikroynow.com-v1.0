import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '65vh',
      textAlign: 'center',
      padding: '2rem 1rem'
    }}>
      <div style={{
        fontSize: '4.5rem',
        fontWeight: 900,
        color: '#008b5e',
        lineHeight: 1,
        marginBottom: '0.5rem'
      }}>
        404
      </div>
      <h2 style={{
        fontSize: '1.4rem',
        fontWeight: 800,
        color: '#1e293b',
        marginBottom: '0.5rem'
      }}>
        পেজটি খুঁজে পাওয়া যায়নি!
      </h2>
      <p style={{
        fontSize: '0.95rem',
        color: '#64748b',
        maxWidth: '420px',
        marginBottom: '1.5rem',
        lineHeight: 1.5
      }}>
        আপনি যে পেজ বা বিজ্ঞাপনটি খুঁজছেন তা মুছে ফেলা হয়েছে অথবা লিংকটি পরিবর্তিত হয়েছে।
      </p>
      <Link
        href="/"
        style={{
          background: '#008b5e',
          color: '#ffffff',
          textDecoration: 'none',
          padding: '0.7rem 1.6rem',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '0.95rem',
          boxShadow: '0 4px 12px rgba(0, 139, 94, 0.25)',
          transition: 'all 0.2s'
        }}
      >
        হোমপেজে ফিরে যান →
      </Link>
    </div>
  );
}
