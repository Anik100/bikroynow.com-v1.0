'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Unhandled Application Error:', error);
  }, [error]);

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
        fontSize: '3.5rem',
        marginBottom: '1rem'
      }}>
        ⚠️
      </div>
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: 800,
        color: '#1e293b',
        marginBottom: '0.5rem'
      }}>
        কিছু একটা সমস্যা হয়েছে!
      </h2>
      <p style={{
        fontSize: '0.95rem',
        color: '#64748b',
        maxWidth: '450px',
        marginBottom: '1.5rem',
        lineHeight: 1.5
      }}>
        একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন অথবা হোমপেজে ফিরে যান।
      </p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={() => reset()}
          style={{
            background: '#008b5e',
            color: '#ffffff',
            border: 'none',
            padding: '0.65rem 1.4rem',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 139, 94, 0.25)'
          }}
        >
          আবার চেষ্টা করুন (Retry)
        </button>
        <Link
          href="/"
          style={{
            background: '#f1f5f9',
            color: '#334155',
            border: '1px solid #cbd5e1',
            padding: '0.65rem 1.4rem',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.9rem',
            textDecoration: 'none'
          }}
        >
          হোমে ফিরে যান
        </Link>
      </div>
    </div>
  );
}
