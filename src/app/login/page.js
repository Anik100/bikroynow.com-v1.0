'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { CheckCircle2, ShieldCheck, Zap, Loader2 } from 'lucide-react';
import styles from './login.module.css';

function LoginContent() {
  const { lang } = useLanguage();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/';

  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bikroynow.com';
      const redirectUri = `${origin}${redirectTarget.startsWith('/') ? redirectTarget : '/' + redirectTarget}`;

      const { error: authErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri
        }
      });

      if (authErr) {
        throw authErr;
      }
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      setError(err.message || (lang === 'bn' ? 'গুগল সাইন-ইন করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।' : 'Google Sign-in failed. Please try again.'));
      setGoogleLoading(false);
    }
  };

  return (
    <div className={`container ${styles.authContainer}`}>
      <div className={`${styles.authCard} ${styles.loginCard}`}>
        <div className={styles.cardBadge}>
          <Zap size={14} />
          <span>{lang === 'bn' ? '১ ক্লিকে নিরাপদ প্রবেশ' : 'Instant 1-Click Access'}</span>
        </div>

        <h2>{lang === 'bn' ? 'BikroyNow-এ স্বাগতম' : 'Welcome to BikroyNow'}</h2>
        <p>
          {lang === 'bn' 
            ? 'বিজ্ঞাপন পোস্ট, ক্রেতাদের সাথে চ্যাট ও অ্যাকাউন্ট নিয়ন্ত্রণ করতে Google দিয়ে প্রবেশ করুন।' 
            : 'Sign in with Google to post ads, chat with buyers, and manage your account.'}
        </p>

        {error && <div className={styles.error}>{error}</div>}

        {/* Exclusive Hero Google Button */}
        <button 
          onClick={handleGoogleLogin} 
          disabled={googleLoading}
          className={styles.heroGoogleBtn}
        >
          {googleLoading ? (
            <>
              <Loader2 size={20} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>{lang === 'bn' ? 'গুগল কানেক্ট হচ্ছে...' : 'Connecting to Google...'}</span>
            </>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{lang === 'bn' ? 'Google দিয়ে এগিয়ে যান' : 'Continue with Google'}</span>
            </>
          )}
        </button>

        {/* Benefits list */}
        <div className={styles.benefitList}>
          <div className={styles.benefitItem}>
            <CheckCircle2 size={16} className={styles.benefitIcon} />
            <span>{lang === 'bn' ? 'কোনো পাসওয়ার্ড বা ওটিপির ঝামেলা নেই' : 'No passwords or OTP codes required'}</span>
          </div>
          <div className={styles.benefitItem}>
            <ShieldCheck size={16} className={styles.benefitIcon} />
            <span>{lang === 'bn' ? 'গুগলের আধুনিক এনক্রিপশনে ১০০% সুরক্ষিত' : '100% secure with Google encryption'}</span>
          </div>
          <div className={styles.benefitItem}>
            <Zap size={16} className={styles.benefitIcon} />
            <span>{lang === 'bn' ? 'ইনস্ট্যান্ট অ্যাকাউন্ট তৈরি ও ভেরিফিকেশন' : 'Instant account setup & verification'}</span>
          </div>
        </div>

        <p className={styles.switchAuth} style={{ marginTop: '0.75rem' }}>
          {lang === 'bn' ? 'নতুন অ্যাকাউন্ট তৈরি করতে চান?' : "Don't have an account?"}{' '}
          <Link href={`/signup${redirectTarget !== '/' ? `?redirect=${encodeURIComponent(redirectTarget)}` : ''}`} style={{ fontWeight: 700, color: '#ff7519' }}>
            {lang === 'bn' ? 'সাইন আপ করুন' : 'Sign up'}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
