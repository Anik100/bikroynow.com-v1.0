'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AuthCallbackPage() {
  const [intentLink, setIntentLink] = useState('');
  const [schemeLink, setSchemeLink] = useState('');
  const [status, setStatus] = useState('processing');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const params = hash || search;

    // 1. Android Intent URL format (Bypasses Chrome custom-scheme navigation blockers)
    const androidIntent = `intent://login-callback${params}#Intent;scheme=io.supabase.bikroynow;package=com.bikroynow.bikroynow_app;end;`;
    // 2. Direct Custom Scheme URL
    const customScheme = `io.supabase.bikroynow://login-callback${params}`;

    setIntentLink(androidIntent);
    setSchemeLink(customScheme);

    // Auto-launch mobile app
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      try {
        // First try Android Intent scheme
        window.location.href = androidIntent;
      } catch (e) {
        try {
          window.location.href = customScheme;
        } catch (_) {}
      }

      const timer = setTimeout(() => {
        setStatus('ready');
      }, 1200);

      return () => clearTimeout(timer);
    } else {
      // Desktop Web: Return to homepage after 1 second
      const timer = setTimeout(() => {
        window.location.href = '/';
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      backgroundColor: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '430px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        boxShadow: '0 12px 36px rgba(0,0,0,0.09)',
        textAlign: 'center',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#ecfdf5',
          color: '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.4rem',
          fontSize: '32px',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)'
        }}>
          ✓
        </div>

        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>
          গুগল সাইন-ইন সফল হয়েছে!
        </h2>

        <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: '1.8rem', lineHeight: 1.55 }}>
          আপনার অ্যাকাউন্টে সফলভাবে প্রবেশ করা হয়েছে। BikroyNow অ্যাপে ফিরে যাওয়ার জন্য নিচের বাটনে ক্লিক করুন:
        </p>

        {intentLink && (
          <a
            href={intentLink}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '0.95rem 1rem',
              borderRadius: '12px',
              background: '#FF7519',
              color: '#ffffff',
              fontWeight: 800,
              textDecoration: 'none',
              fontSize: '1.05rem',
              boxShadow: '0 4px 16px rgba(255, 117, 25, 0.35)',
              marginBottom: '1rem',
              transition: 'transform 0.15s ease'
            }}
          >
            <span>📱 BikroyNow অ্যাপ খুলুন (লগইন সম্পন্ন)</span>
          </a>
        )}

        {schemeLink && (
          <a
            href={schemeLink}
            style={{
              display: 'inline-block',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#334155',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '0.85rem',
              marginBottom: '1.4rem'
            }}
          >
            বিকল্প লিংক দিয়ে অ্যাপ খুলুন
          </a>
        )}

        <div>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              color: '#94a3b8',
              fontSize: '0.85rem',
              textDecoration: 'underline'
            }}
          >
            ওয়েবসাইটে যান
          </Link>
        </div>
      </div>
    </div>
  );
}
