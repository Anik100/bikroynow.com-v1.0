'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../context/LanguageContext';
import { Sparkles, CheckCircle2, User, Phone, Loader2 } from 'lucide-react';
import styles from './OnboardingModal.module.css';

export default function OnboardingModal({ user, isOpen, onClose, onProfileUpdated }) {
  const { lang } = useLanguage();

  const savedLocalName = typeof window !== 'undefined' && user?.id 
    ? localStorage.getItem('bkr_custom_name_' + user.id) 
    : null;

  const initialName = savedLocalName || 
                      user?.user_metadata?.full_name || 
                      user?.user_metadata?.name || 
                      (user?.email ? user.email.split('@')[0] : '');

  const [displayName, setDisplayName] = useState(initialName);
  const [phoneNumber, setPhoneNumber] = useState(user?.user_metadata?.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;

    const localName = localStorage.getItem('bkr_custom_name_' + user.id);
    const bestName = localName || 
                     user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     (user.email ? user.email.split('@')[0] : '');
    setDisplayName(bestName);

    // Fetch existing phone/name from profiles table if previously saved
    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          if (data.full_name) {
            setDisplayName(data.full_name);
            localStorage.setItem('bkr_custom_name_' + user.id, data.full_name);
          }
          if (data.phone) setPhoneNumber(data.phone);
        }
      } catch (err) {
        console.warn('Error fetching profile in onboarding modal:', err);
      }
    };

    loadProfile();
  }, [user]);

  if (!isOpen || !user) return null;

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const finalName = displayName.trim();
    if (!finalName) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে একটি নাম লিখুন।' : 'Please enter a name.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Immediately store in localStorage so the whole app knows this name instantly
      try {
        localStorage.setItem('bkr_profile_saved_' + user.id, 'true');
        localStorage.setItem('bkr_custom_name_' + user.id, finalName);
        if (phoneNumber.trim()) {
          localStorage.setItem('bkr_custom_phone_' + user.id, phoneNumber.trim());
        }
        sessionStorage.setItem('bkr_prompt_dismissed_' + user.id, 'true');
      } catch (e) {}

      // 2. Fast background database upsert with timeout race
      await Promise.race([
        supabase.from('profiles').upsert({
          id: user.id,
          email: user.email.toLowerCase().trim(),
          full_name: finalName,
          phone: phoneNumber.trim() || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' }),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);

      // 3. Update auth metadata asynchronously
      supabase.auth.updateUser({
        data: {
          full_name: finalName,
          name: finalName,
          phone: phoneNumber.trim() || undefined,
          profile_completed: true
        }
      }).catch(() => {});

      if (onProfileUpdated) {
        onProfileUpdated({ full_name: finalName, phone: phoneNumber.trim() });
      }

      onClose();

      // 4. Immediately hard refresh page as requested so the new name appears everywhere instantly!
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (err) {
      console.error('Save profile error:', err);
      try {
        localStorage.setItem('bkr_profile_saved_' + user.id, 'true');
        localStorage.setItem('bkr_custom_name_' + user.id, finalName);
        sessionStorage.setItem('bkr_prompt_dismissed_' + user.id, 'true');
      } catch (e) {}
      onClose();
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    // Only dismiss for this active session so on next login it can appear again
    try {
      sessionStorage.setItem('bkr_prompt_dismissed_' + user.id, 'true');
    } catch (e) {}
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={handleSkip}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.topBadge}>
          <Sparkles size={14} />
          <span>{lang === 'bn' ? 'প্রোফাইল কনফার্মেশন' : 'Profile Confirmation'}</span>
        </div>

        <h3 className={styles.title}>
          {lang === 'bn' ? 'নাম ও মোবাইল নম্বর দিন' : 'Enter Name & Mobile Number'}
        </h3>
        <p className={styles.subtitle}>
          {lang === 'bn'
            ? 'ক্রেতা ও বিক্রেতারা আপনার এই নাম এবং নম্বর দেখতে পাবে। প্রয়োজনমতো পরিবর্তন করে নিন।'
            : 'Buyers and sellers will see this name and phone on your listings and chats.'}
        </p>

        <div className={styles.avatarWrapper}>
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={displayName} 
              className={styles.avatarImg}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={styles.avatarFallback}>
              {displayName ? displayName[0].toUpperCase() : 'U'}
            </div>
          )}
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '0.75rem', fontWeight: 600 }}>{error}</div>}

        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              <User size={15} />
              <span>{lang === 'bn' ? 'প্রোফাইলের নাম' : 'Display Name'}</span>
            </label>
            <input
              type="text"
              required
              className={styles.input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={lang === 'bn' ? 'যেমন: তানভীর আহমেদ বা অনিক গ্যাজেট' : 'e.g. Tanvir Ahmed or Anik Gadget'}
              autoFocus
            />
            <span className={styles.helperText}>
              {lang === 'bn' ? '💡 আপনি এটি নিজের নাম বা দোকানের নাম হিসেবে দিতে পারেন।' : '💡 You can use your personal name or shop name.'}
            </span>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>
              <Phone size={15} />
              <span>{lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}</span>
            </label>
            <input
              type="tel"
              className={styles.input}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="01XXXXXXXXX"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className={styles.btnPrimary}
          >
            {saving ? (
              <>
                <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>{lang === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>{lang === 'bn' ? 'নিশ্চিত করুন ও এগিয়ে যান' : 'Confirm & Continue'}</span>
              </>
            )}
          </button>
        </form>

        <button type="button" onClick={handleSkip} className={styles.btnSecondary}>
          {lang === 'bn' ? 'এখন না (পরে দিব)' : 'Not now (Skip)'}
        </button>
      </div>
    </div>
  );
}
