'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../context/LanguageContext';
import { Sparkles, CheckCircle2, User, Phone, Loader2 } from 'lucide-react';
import styles from './OnboardingModal.module.css';

export default function OnboardingModal({ user, isOpen, onClose, onProfileUpdated }) {
  const { lang } = useLanguage();

  const initialName = user?.user_metadata?.full_name || 
                      user?.user_metadata?.name || 
                      (user?.email ? user.email.split('@')[0] : '');

  const [displayName, setDisplayName] = useState(initialName);
  const [phoneNumber, setPhoneNumber] = useState(user?.user_metadata?.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      const bestName = user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       (user.email ? user.email.split('@')[0] : '');
      setDisplayName(bestName);
      if (user.user_metadata?.phone) {
        setPhoneNumber(user.user_metadata.phone);
      }
    }
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
      // 1. Update Supabase Auth metadata
      await supabase.auth.updateUser({
        data: {
          full_name: finalName,
          phone: phoneNumber.trim() || undefined,
          name_onboarded: true
        }
      });

      // 2. Update Supabase profiles table
      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email.toLowerCase().trim(),
        full_name: finalName,
        phone: phoneNumber.trim() || null,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      // 3. Mark as onboarded in localStorage
      localStorage.setItem('bkr_name_onboarded_' + user.id, 'true');

      if (onProfileUpdated) {
        onProfileUpdated({ full_name: finalName, phone: phoneNumber.trim() });
      }

      onClose();
    } catch (err) {
      console.error('Save profile error:', err);
      // Even if network glitches, mark onboarded locally so user isn't stuck
      localStorage.setItem('bkr_name_onboarded_' + user.id, 'true');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('bkr_name_onboarded_' + user.id, 'true');
    // Also save the default Google name to avoid prompting again
    supabase.auth.updateUser({
      data: { name_onboarded: true }
    }).catch(() => {});
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={handleSkip}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.topBadge}>
          <Sparkles size={14} />
          <span>{lang === 'bn' ? 'স্বাগতম BikroyNow-এ' : 'Welcome to BikroyNow'}</span>
        </div>

        <h3 className={styles.title}>
          {lang === 'bn' ? 'আপনার প্রোফাইলের নাম সেট করুন' : 'Set Your Profile Name'}
        </h3>
        <p className={styles.subtitle}>
          {lang === 'bn'
            ? 'আপনার বিজ্ঞাপন ও চ্যাটে ক্রেতা-বিক্রেতারা এই নামটি দেখতে পাবে। আপনি নিজের বা দোকানের নাম ব্যবহার করতে পারেন।'
            : 'This name will appear on your ads and chats. You can use your personal or business name.'}
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
              {lang === 'bn' ? '💡 আপনি পরবর্তীতে যেকোনো সময় প্রোফাইল থেকে এটি পরিবর্তন করতে পারবেন।' : '💡 You can edit this anytime from your profile settings.'}
            </span>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>
              <Phone size={15} />
              <span>{lang === 'bn' ? 'মোবাইল নম্বর (ঐচ্ছিক)' : 'Phone Number (Optional)'}</span>
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
                <span>{lang === 'bn' ? 'নিশ্চিত করুন ও শুরু করুন' : 'Confirm & Get Started'}</span>
              </>
            )}
          </button>
        </form>

        <button type="button" onClick={handleSkip} className={styles.btnSecondary}>
          {lang === 'bn' ? 'পরে ঠিক করব (গুগলের নামেই থাক)' : 'Keep Google name for now'}
        </button>
      </div>
    </div>
  );
}
