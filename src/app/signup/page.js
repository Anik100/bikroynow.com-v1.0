'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import styles from '../login/login.module.css';

export default function Signup() {
  const { lang } = useLanguage();
  const router = useRouter();

  // Step 1 states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 states
  const [step, setStep] = useState(1); // 1 = Form, 2 = OTP Verification
  const [otpCode, setOtpCode] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Status states
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [simulatedOtp, setSimulatedOtp] = useState(null);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval = null;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // Handle Step 1: Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, phone, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ওটিপি পাঠাতে সমস্যা হয়েছে।');
      }

      setStep(2);
      setTimer(60);
      setCanResend(false);
      setSuccessMsg(data.message);

      if (data.simulated && data.simulatedOtp) {
        setSimulatedOtp(data.simulatedOtp);
      } else {
        setSimulatedOtp(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ওটিপি ভেরিফাই করতে সমস্যা হয়েছে।');
      }

      // If backend returned session, set it on client-side Supabase client!
      if (data.session) {
        try {
          await supabase.auth.setSession(data.session);
        } catch (e) {}
      }

      setSuccessMsg(data.message);

      // Auto redirect to homepage after short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (!canResend || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, phone, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ওটিপি পুনরায় পাঠাতে সমস্যা হয়েছে।');
      }

      setTimer(60);
      setCanResend(false);
      setSuccessMsg('নতুন ওটিপি কোড পাঠানো হয়েছে।');

      if (data.simulated && data.simulatedOtp) {
        setSimulatedOtp(data.simulatedOtp);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      <div className={styles.authCard}>
        <h2>{lang === 'bn' ? 'অ্যাকাউন্ট তৈরি করুন' : 'Create an Account'}</h2>
        <p>{lang === 'bn' ? 'BikroyNow-এ যোগ দিয়ে সহজে কেনাবেচা করুন।' : 'Join BikroyNow to buy and sell easily.'}</p>
        
        {error && <div className={styles.error}>⚠️ {error}</div>}
        {successMsg && <div className={styles.error} style={{ backgroundColor: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }}>✅ {successMsg}</div>}

        {/* Development simulation mode badge */}
        {simulatedOtp && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde047', color: '#854d0e', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
            ℹ️ <strong>টেস্টিং ওটিপি কোড:</strong> <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '2px' }}>{simulatedOtp}</span>
            <br />
            <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>(.env.local-এ অ্যাপ পাসওয়ার্ড বসানোর পর মেইলে মেসেজ যাবে)</span>
          </div>
        )}

        {step === 1 ? (
          /* STEP 1: INITIAL SIGNUP FORM */
          <form onSubmit={handleSendOtp} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>{lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}</label>
              <input 
                type="text" 
                required 
                className="input-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={lang === 'bn' ? 'আপনার নাম লিখুন' : 'Enter your full name'}
              />
            </div>
            <div className={styles.inputGroup}>
              <label>{lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone Number'}</label>
              <input 
                type="tel" 
                required 
                className="input-field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={lang === 'bn' ? 'মোবাইল নম্বর লিখুন' : 'Enter your phone number'}
              />
            </div>
            <div className={styles.inputGroup}>
              <label>{lang === 'bn' ? 'ইমেইল অ্যাড্রেস' : 'Email Address'}</label>
              <input 
                type="email" 
                required 
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={lang === 'bn' ? 'ইমেইল অ্যাড্রেস লিখুন' : 'Enter your email address'}
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
                placeholder={lang === 'bn' ? 'পাসওয়ার্ড লিখুন' : 'Enter your password'}
                minLength={6}
              />
            </div>
            <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? (lang === 'bn' ? 'ওটিপি পাঠানো হচ্ছে...' : 'Sending OTP...') : (lang === 'bn' ? 'ওটিপি কোড পাঠান ✉️' : 'Send OTP Code ✉️')}
            </button>
          </form>
        ) : (
          /* STEP 2: 6-DIGIT OTP VERIFICATION FORM */
          <form onSubmit={handleVerifyOtp} className={styles.form}>
            <div style={{ textAlign: 'center', marginBottom: '1rem', background: '#f8fafc', padding: '0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
                কোড পাঠানো হয়েছে: <strong>{email}</strong>
              </p>
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                style={{ background: 'none', border: 'none', color: '#008b5e', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginTop: '4px', textDecoration: 'underline' }}
              >
                ✏️ {lang === 'bn' ? 'ইমেইল পরিবর্তন করুন' : 'Change Email'}
              </button>
            </div>

            <div className={styles.inputGroup}>
              <label style={{ textAlign: 'center', fontSize: '1rem', color: '#008b5e', fontWeight: 700 }}>
                {lang === 'bn' ? '৬-ডিজিটের ওটিপি কোডটি লিখুন' : 'Enter 6-Digit OTP Code'}
              </label>
              <input 
                type="text" 
                required 
                maxLength={6}
                className="input-field"
                style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '8px', color: '#008b5e', border: '2px solid #008b5e' }}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                autoFocus
              />
            </div>

            <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading || otpCode.length !== 6}>
              {loading ? (lang === 'bn' ? 'ভেরিফাই হচ্ছে...' : 'Verifying...') : (lang === 'bn' ? 'কোড ভেরিফাই করুন ✅' : 'Verify & Complete Signup ✅')}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
              {canResend ? (
                <button 
                  type="button" 
                  onClick={handleResendOtp} 
                  style={{ background: 'none', border: 'none', color: '#008b5e', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  🔄 {lang === 'bn' ? 'পুনরায় ওটিপি পাঠান' : 'Resend OTP Code'}
                </button>
              ) : (
                <span style={{ color: '#64748b' }}>
                  ⏳ {lang === 'bn' ? `পুনরায় কোড পাঠাতে অপেক্ষা করুন: ${timer} সেকেন্ড` : `Resend code in: ${timer}s`}
                </span>
              )}
            </div>
          </form>
        )}

        {step === 1 && (
          <>
            <div className={styles.divider}>
              <span>{lang === 'bn' ? 'অথবা' : 'OR'}</span>
            </div>

            <button onClick={handleGoogleLogin} className={`btn-secondary ${styles.googleBtn}`}>
              <img src="https://www.google.com/favicon.ico" alt="Google" width="16" />
              {lang === 'bn' ? 'Google দিয়ে প্রবেশ করুন' : 'Continue with Google'}
            </button>
          </>
        )}

        <div className={styles.footerText}>
          {lang === 'bn' ? 'পূর্বেই অ্যাকাউন্ট আছে?' : 'Already have an account?'}{' '}
          <Link href="/login">{lang === 'bn' ? 'লগইন করুন' : 'Log in'}</Link>
        </div>
      </div>
    </div>
  );
}
