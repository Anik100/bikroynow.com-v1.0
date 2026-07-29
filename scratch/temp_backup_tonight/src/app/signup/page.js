'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import styles from '../login/login.module.css'; // Reusing login styles

export default function Signup() {
  const { lang, t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Bangladeshi phone validation regex (e.g. 01712345678, 11 digits, starts with 01)
    const bdPhoneRegex = /^01[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(phone)) {
      setError(lang === 'bn' ? 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।' : 'Please provide a valid Bangladeshi phone number (e.g., 017XXXXXXXX).');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      if (data?.user && !data?.session) {
        setSuccess(true);
        setLoading(false);
      } else {
        router.push('/');
        router.refresh();
      }
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) setError(error.message);
  };

  return (
    <div className={`container ${styles.authContainer}`}>
      <div className={styles.authCard}>
        <h2>Create an Account</h2>
        <p>Join BikroyHut to buy and sell easily.</p>
        
        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.error} style={{backgroundColor: '#dcfce7', color: '#16a34a'}}>Signup successful! Please check your email to confirm your account.</div>}

        <form onSubmit={handleSignup} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Full Name</label>
            <input 
              type="text" 
              required 
              className="input-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Phone Number</label>
            <input 
              type="tel" 
              required 
              className="input-field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 01712345678"
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Email</label>
            <input 
              type="email" 
              required 
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Password</label>
            <input 
              type="password" 
              required 
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading}>
            {loading ? 'Signing up...' : 'Sign up'}
          </button>
        </form>

        <div className={styles.divider}>
          <span>OR</span>
        </div>

        <button onClick={handleGoogleLogin} className={`btn-secondary ${styles.googleBtn}`}>
          <img src="https://www.google.com/favicon.ico" alt="Google" width="16" />
          Continue with Google
        </button>

        <div className={styles.footerText}>
          Already have an account? <Link href="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
