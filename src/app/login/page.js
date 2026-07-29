'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import styles from './login.module.css';

export default function Login() {
  const { lang } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
        }
      });
      if (error) setError(error.message);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={`container ${styles.authContainer}`}>
      <div className={`${styles.authCard} ${styles.loginCard}`}>
        <h2>{lang === 'bn' ? 'BikroyNow-এ স্বাগতম' : 'Welcome to BikroyNow'}</h2>
        <p>{lang === 'bn' ? 'আপনার বিজ্ঞাপন প্রমোশন করতে ও ক্রেতাদের সাথে চ্যাট করতে লগইন করুন।' : 'Log in to manage your ads and chat with buyers.'}</p>
        
        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>{lang === 'bn' ? 'ইমেইল অ্যাড্রেস' : 'Email'}</label>
            <input 
              type="email" 
              required 
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={lang === 'bn' ? 'আপনার ইমেইল অ্যাড্রেস লিখুন' : 'Enter your email address'}
            />
          </div>
          <div className={styles.inputGroup}>
            <label>{lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}</label>
            <input 
              type="password" 
              required 
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={lang === 'bn' ? 'আপনার পাসওয়ার্ড লিখুন' : 'Enter your password'}
            />
          </div>
          <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading}>
            {loading ? (lang === 'bn' ? 'লগইন হচ্ছে...' : 'Logging in...') : (lang === 'bn' ? 'লগইন করুন' : 'Log in')}
          </button>
        </form>

        <div className={styles.divider}>
          <span>{lang === 'bn' ? 'অথবা' : 'OR'}</span>
        </div>

        <button onClick={handleGoogleLogin} className={`btn-secondary ${styles.googleBtn}`}>
          <img src="https://www.google.com/favicon.ico" alt="Google" width="16" />
          {lang === 'bn' ? 'Google দিয়ে প্রবেশ করুন' : 'Continue with Google'}
        </button>

        <div className={styles.footerText}>
          {lang === 'bn' ? 'অ্যাকাউন্ট নেই?' : "Don't have an account?"}{' '}
          <Link href="/signup">{lang === 'bn' ? 'রেজিস্ট্রেশন করুন' : 'Sign up'}</Link>
        </div>
      </div>
    </div>
  );
}
