'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import { X, FileText, Star, Award, Settings, HelpCircle, LogOut, User as UserIcon, MessageSquare, Heart, Loader2, Download, Smartphone, Share, PlusSquare, MoreVertical, Bell } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import styles from './ProfileMenu.module.css';
import { uploadToImgBB } from '../lib/imgbb';
import { compressImage } from '../lib/utils';
import { isStandalone, isPWAInstalled, promptPWAInstall, markPWAInstalled, isIOS, isAndroid } from '../lib/pwaInstall';
import { requestNotificationPermission, subscribeUserToPush } from '../lib/notificationAudio';

export default function ProfileMenu({ user: propUser, hasAdminAccess: propAdmin, unreadCount = 0, onClose, onLogout }) {
  const { lang, t, toggleLanguage } = useLanguage();
  const [user, setUser] = useState(propUser || null);
  const [profile, setProfile] = useState(null);
  const [hasAdminAccess, setHasAdminAccess] = useState(propAdmin || false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isNative = !!window.AndroidNative || navigator.userAgent.includes('BikroyNowApp');
      setIsNativeApp(isNative);
      if ('Notification' in window) {
        setNotifGranted(Notification.permission === 'granted' || isNative);
      } else if (isNative) {
        setNotifGranted(true);
      }

      if (window.AndroidNative?.setSwipeRefreshEnabled) {
        window.AndroidNative.setSwipeRefreshEnabled(false);
      }
    }

    return () => {
      if (typeof window !== 'undefined' && window.AndroidNative?.setSwipeRefreshEnabled) {
        window.AndroidNative.setSwipeRefreshEnabled(true);
      }
    };
  }, []);

  useEffect(() => {
    setIsInstalled(isPWAInstalled() || isStandalone());
    const handleInstalled = () => setIsInstalled(true);
    const handleCanInstall = () => setIsInstalled(false);
    window.addEventListener('pwa_installed', handleInstalled);
    window.addEventListener('pwa_can_install', handleCanInstall);
    return () => {
      window.removeEventListener('pwa_installed', handleInstalled);
      window.removeEventListener('pwa_can_install', handleCanInstall);
    };
  }, []);

  useEffect(() => {
    const adminEmails = [
      'anikh0000@gmail.com',
      'anikh00000@gmail.com',
      'anikh00@gmail.com',
      'aunik008@gmail.com',
      'aunik003@gmail.com'
    ];

    if (propUser) {
      setUser(propUser);
      if (propUser.email && adminEmails.includes(propUser.email.toLowerCase().trim())) {
        setHasAdminAccess(true);
      }
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
          if (session.user.email && adminEmails.includes(session.user.email.toLowerCase().trim())) {
            setHasAdminAccess(true);
          }
        } else {
          try {
            const localUser = localStorage.getItem('bikroynow_demo_user');
            if (localUser) {
              const parsed = JSON.parse(localUser);
              setUser(parsed);
              if (parsed.email && adminEmails.includes(parsed.email.toLowerCase().trim())) {
                setHasAdminAccess(true);
              }
            }
          } catch (e) {}
        }
      });
    }
  }, [propUser]);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const executeLogout = async () => {
    setLoggingOut(true);
    try {
      if (onLogout) {
        await Promise.race([
          onLogout(),
          new Promise(r => setTimeout(r, 1500))
        ]);
      } else {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise(r => setTimeout(r, 1200))
        ]);
      }
    } catch (err) {
      console.warn('Logout error:', err);
    }
    try {
      localStorage.removeItem('bikroynow_demo_user');
      sessionStorage.clear();
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('bkr_') || key.includes('auth-token') || key.includes('supabase'))) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}
    window.location.href = '/';
  };

  // Profile editing states
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (data) {
          setProfile(data);
          setNewName(data.full_name || '');
          setNewAvatar(data.avatar_url || '');
          return;
        }
      } catch (e) {}
      
      // Fallback profile details from user metadata or email
      const fallbackName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
      setProfile({
        full_name: fallbackName,
        avatar_url: user.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
        membership_type: 'free'
      });
      setNewName(fallbackName);
    };
    fetchProfile();
  }, [user]);

  const [unreadSupportCount, setUnreadSupportCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadSupportCount(0);
      return;
    }

    const fetchUnreadSupport = async () => {
      try {
        const { data: chat } = await supabase
          .from('support_chats')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (chat) {
          const { count } = await supabase
            .from('support_messages')
            .select('*', { count: 'exact', head: true })
            .eq('support_chat_id', chat.id)
            .neq('sender_id', user.id)
            .eq('is_read', false);

          setUnreadSupportCount(count || 0);
        } else {
          setUnreadSupportCount(0);
        }
      } catch (err) {
        console.error('Error fetching support unread count:', err);
      }
    };

    fetchUnreadSupport();

    const subscription = supabase
      .channel('profile-menu-support-messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_messages'
      }, () => {
        fetchUnreadSupport();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setEditError('');
    try {
      const compressed = await compressImage(file);
      const url = await uploadToImgBB(compressed);
      if (url) {
        setNewAvatar(url);
      } else {
        setEditError(lang === 'bn' ? 'ছবি আপলোড ব্যর্থ হয়েছে।' : 'Image upload failed.');
      }
    } catch (err) {
      console.error(err);
      setEditError(lang === 'bn' ? 'ছবি আপলোড করতে সমস্যা হয়েছে।' : 'Error uploading image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!newName.trim()) {
      setEditError(lang === 'bn' ? 'অনুগ্রহ করে আপনার নাম লিখুন।' : 'Please enter your name.');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const updates = {
        full_name: newName.trim(),
        avatar_url: newAvatar || profile?.avatar_url,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        setEditError(error.message);
      } else {
        setProfile(prev => ({
          ...prev,
          full_name: updates.full_name,
          avatar_url: updates.avatar_url
        }));
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getMembershipBadge = () => {
    if (!profile) return null;
    const expiresAt = profile.membership_expires_at ? new Date(profile.membership_expires_at) : null;
    const isNotExpired = !expiresAt || new Date() < expiresAt;

    if (profile.membership_type && profile.membership_type !== 'free' && isNotExpired) {
      const name = profile.membership_type.toLowerCase();
      let colorClass = '';
      let label = profile.membership_type;

      if (name.includes('silver')) {
        colorClass = styles.silverBadge;
        label = lang === 'bn' ? 'সিলভার মেম্বার' : 'Silver Member';
      } else if (name.includes('gold')) {
        colorClass = styles.goldBadge;
        label = lang === 'bn' ? 'গোল্ড মেম্বার' : 'Gold Member';
      } else if (name.includes('business')) {
        colorClass = styles.businessBadge;
        label = lang === 'bn' ? 'বিজনেস মেম্বার' : 'Business Member';
      }

      return (
        <span className={`${styles.memberBadge} ${colorClass}`}>
          🛡️ {label}
        </span>
      );
    }
    return null;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div 
        className={styles.menu} 
        onClick={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        
        {/* Sleek Slide-over profile editor */}
        {isEditing && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'white',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            padding: '1.25rem',
            boxShadow: 'inset 0 0 15px rgba(0,0,0,0.05)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1c2b38' }}>
                {lang === 'bn' ? 'প্রোফাইল এডিট করুন' : 'Edit Profile'}
              </h3>
              <button 
                onClick={() => { setIsEditing(false); setEditError(''); }} 
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
              
              {/* Avatar Upload Container */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f6b10a 0%, #f97316 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '3px solid #f1f5f9',
                  position: 'relative',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                }}>
                  {newAvatar ? (
                    <img 
                      src={newAvatar} 
                      alt="Preview" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <UserIcon size={36} color="white" />
                  )}
                  {uploading && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                      fontSize: '0.62rem', fontWeight: 800, textAlign: 'center', padding: '2px'
                    }}>
                      {lang === 'bn' ? 'আপলোড...' : 'Uploading...'}
                    </div>
                  )}
                </div>

                {/* Upload Input Button */}
                <label style={{
                  background: '#f8fafc',
                  border: '1.5px dashed #cbd5e1',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'inline-block'
                }}>
                  📷 {lang === 'bn' ? 'ছবি পরিবর্তন' : 'Change Photo'}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    style={{ display: 'none' }}
                    disabled={uploading || saving}
                  />
                </label>
              </div>

              {/* Name Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>
                  {lang === 'bn' ? 'আপনার নাম' : 'Full Name'}
                </label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={lang === 'bn' ? 'নাম লিখুন' : 'Enter name'}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#1c2b38',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  disabled={saving}
                />
              </div>

              {editError && (
                <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 800 }}>
                  ⚠️ {editError}
                </span>
              )}

              {/* Save / Cancel Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', paddingBottom: '1.5rem' }}>
                <button 
                  onClick={() => { setIsEditing(false); setEditError(''); }}
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    background: 'white',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                  disabled={saving || uploading}
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button 
                  onClick={handleSaveProfile}
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #008b5e, #05b078)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(0, 139, 94, 0.15)'
                  }}
                  disabled={saving || uploading}
                >
                  {saving ? (lang === 'bn' ? 'সংরক্ষণ...' : 'Saving...') : (lang === 'bn' ? 'সংরক্ষণ' : 'Save')}
                </button>
              </div>

            </div>
          </div>
        )}

        <div className={styles.header}>
          <div className={styles.profileInfo}>
            <div className={styles.avatarWrapper}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div className={styles.avatar}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className={styles.avatarImage} />
                  ) : (
                    <UserIcon size={30} color="white" />
                  )}
                </div>
                {(unreadCount + unreadSupportCount) > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      minWidth: '20px',
                      height: '20px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 5px',
                      border: '2px solid #ffffff',
                      boxShadow: '0 2px 6px rgba(239, 68, 68, 0.55)',
                      zIndex: 10
                    }}
                    title={lang === 'bn' ? `${unreadCount + unreadSupportCount}টি নতুন মেসেজ` : `${unreadCount + unreadSupportCount} unread messages`}
                  >
                    {(unreadCount + unreadSupportCount) > 99 ? '99+' : (unreadCount + unreadSupportCount)}
                  </span>
                )}
              </div>
              {user && (
                <button 
                  onClick={() => {
                    setNewName(profile?.full_name || '');
                    setNewAvatar(profile?.avatar_url || '');
                    setIsEditing(true);
                  }} 
                  className={styles.editBtn}
                  title={lang === 'bn' ? 'প্রোফাইল এডিট করুন' : 'Edit Profile'}
                >
                  📝 {lang === 'bn' ? 'এডিট' : 'Edit'}
                </button>
              )}
            </div>
            <div className={styles.userDetails}>
              {user ? (
                <>
                  <h3>{(typeof window !== 'undefined' && user?.id ? localStorage.getItem('bkr_custom_name_' + user.id) : null) || profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || t('user')}</h3>
                  <p>{user.email}</p>
                  {getMembershipBadge()}
                </>
              ) : (
                <>
                  <h3>{t('welcome')}</h3>
                  <Link href="/login" className={styles.loginLink} onClick={onClose}>
                    {t('login')} / {t('signup')}
                  </Link>
                </>
              )}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.langSection}>
          <div className={styles.langPills}>
            <button 
              className={`${styles.langPill} ${lang === 'en' ? styles.active : ''}`}
              onClick={() => lang !== 'en' && toggleLanguage()}
            >
              English
            </button>
            <button 
              className={`${styles.langPill} ${lang === 'bn' ? styles.active : ''}`}
              onClick={() => lang !== 'bn' && toggleLanguage()}
            >
              বাংলা
            </button>
          </div>
        </div>

        <div className={styles.menuList}>
          <Link href="/my-ads" className={styles.menuItem} onClick={onClose}>
            <FileText size={20} color="#1c2b38" />
            <span>{t('myAds')}</span>
          </Link>
          <Link href="/chat" className={styles.menuItem} onClick={onClose}>
            <MessageSquare size={20} color="#3b82f6" />
            <span>{t('messages')}</span>
            {unreadCount > 0 && (
              <span className={styles.supportBadge} style={{ background: '#ef4444', marginLeft: 'auto' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <Link href="/favorites" className={styles.menuItem} onClick={onClose}>
            <Heart size={20} color="#ef4444" fill="#ef4444" />
            <span>{t('favorites')}</span>
          </Link>
          <Link href="/membership" className={styles.menuItem} onClick={onClose}>
            <Award size={20} color="#008b5e" />
            <span>{t('membership')}</span>
          </Link>
          
          {hasAdminAccess && (
            <Link href="/admin-dashboard" className={styles.menuItem} onClick={onClose} style={{ borderLeft: '4px solid #d97706', paddingLeft: '0.8rem' }}>
              <Settings size={20} color="#d97706" />
              <span style={{ fontWeight: 600, color: '#d97706' }}>
                {lang === 'bn' ? 'অ্যাডমিন ড্যাশবোর্ড' : 'Admin Dashboard'}
              </span>
            </Link>
          )}
          <div className={styles.menuItem}>
            <Settings size={20} color="#6b7280" />
            <span>{t('settings')}</span>
          </div>
          <Link href="/support" className={styles.menuItem} onClick={onClose}>
            <HelpCircle size={20} color="#3b82f6" />
            <span>{lang === 'bn' ? 'সাহায্য' : 'Help'}</span>
            {unreadSupportCount > 0 && (
              <span className={styles.supportBadge}>
                {unreadSupportCount}
              </span>
            )}
          </Link>

          {/* Notification Permission Item in Profile */}
          <div
            className={styles.menuItem}
            onClick={async () => {
              if (isNativeApp) {
                if (typeof window !== 'undefined' && window.AndroidNative?.requestNotificationPermission) {
                  window.AndroidNative.requestNotificationPermission();
                }
                setNotifGranted(true);
                alert(lang === 'bn' 
                  ? 'অফিসিয়াল অ্যান্ড্রয়েড অ্যাপে সরাসরি সিস্টেম নোটিফিকেশন সক্রিয় রয়েছে! 🎉' 
                  : 'System notifications are active in the official Android app! 🎉');
                return;
              }

              if (typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'granted') {
                  if (user?.id) {
                    await subscribeUserToPush(user.id, user.email);
                  }
                  alert(lang === 'bn' ? 'মেসেজ নোটিফিকেশন ইতিমধ্যে চালু রয়েছে! ✓' : 'Message notifications are already active! ✓');
                  return;
                }
                const perm = await requestNotificationPermission(user?.id, user?.email);
                if (perm === 'granted') {
                  setNotifGranted(true);
                  if (user?.id) {
                    await subscribeUserToPush(user.id, user.email);
                  }
                  alert(lang === 'bn' ? 'মেসেজ নোটিফিকেশন সফলভাবে চালু হয়েছে! 🎉' : 'Notifications successfully enabled! 🎉');
                } else if (perm === 'denied') {
                  const wantApk = confirm(lang === 'bn' 
                    ? 'আপনার ব্রাউজারে নোটিফিকেশন ব্লক করা আছে। ক্রোম ব্রাউজারে সাইট সেটিংসে গিয়ে Notifications: Allow করতে পারেন।\n\nঅথবা আপনি কি সরাসরি নোটিফিকেশন পেতে অফিসিয়াল BikroyNow APK ডাউনলোড করতে চান?' 
                    : 'Notifications are blocked in browser settings.\n\nWould you like to download the official BikroyNow APK for direct notifications?');
                  if (wantApk) {
                    window.location.href = '/BikroyNow.apk';
                  }
                }
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <Bell size={20} color={notifGranted || isNativeApp ? '#059669' : '#f59e0b'} />
            <span style={{ color: notifGranted || isNativeApp ? '#059669' : '#1c2b38' }}>
              {lang === 'bn' ? 'মেসেজ অ্যালার্ট' : 'Message Alerts'}
            </span>
            {(notifGranted || isNativeApp) ? (
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                ✓ {lang === 'bn' ? 'চালু' : 'Active'}
              </span>
            ) : (
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#d97706', fontWeight: 600, background: '#fffbeb', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                {lang === 'bn' ? 'চালু করুন' : 'Enable'}
              </span>
            )}
          </div>

          {/* App Install / PC Standalone / APK Download Button in Profile */}
          <div
            className={styles.menuItem}
            onClick={() => {
              if (isNativeApp) {
                alert(lang === 'bn' 
                  ? 'আপনি ইতিমধ্যে অফিসিয়াল BikroyNow Native Android App ব্যবহার করছেন! ✓' 
                  : 'You are using the official BikroyNow Native Android App! ✓');
                return;
              }

              if (isStandalone()) {
                alert(lang === 'bn'
                  ? 'আপনি ইতিমধ্যে কম্পিউটারে BikroyNow অফিসিয়াল অ্যাপ ব্যবহার করছেন! ✓'
                  : 'You are already using the official BikroyNow desktop app! ✓');
                return;
              }

              if (isIOS()) {
                setShowInstallGuide(true);
                return;
              }

              if (isAndroid()) {
                // Directly download official Android APK on Android phones
                window.location.href = '/BikroyNow.apk';
                return;
              }

              // On PC / Desktop: Trigger browser PWA install prompt to make it a standalone tab / desktop app window
              promptPWAInstall({
                onAccepted: () => {
                  markPWAInstalled();
                  setIsInstalled(true);
                },
                onFallback: () => {
                  setShowInstallGuide(true);
                }
              });
            }}
            style={{ cursor: 'pointer' }}
          >
            <Download size={20} color={isNativeApp || isStandalone() ? '#059669' : '#0284c7'} />
            <span style={{ color: isNativeApp || isStandalone() ? '#059669' : '#1c2b38' }}>
              {isNativeApp
                ? (lang === 'bn' ? 'অফিসিয়াল অ্যাপ' : 'Official App')
                : isStandalone()
                  ? (lang === 'bn' ? 'পিসি অ্যাপ' : 'PC App')
                  : isAndroid()
                    ? (lang === 'bn' ? 'অফিসিয়াল অ্যাপ' : 'Official App')
                    : (lang === 'bn' ? 'পিসি অ্যাপ' : 'PC App')}
            </span>
            {isNativeApp || isStandalone() ? (
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                ✓ {lang === 'bn' ? 'চালু' : 'Active'}
              </span>
            ) : isAndroid() ? (
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, background: '#f0f9ff', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                APK
              </span>
            ) : (
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, background: '#f0f9ff', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                {lang === 'bn' ? 'ইনস্টল' : 'Install'}
              </span>
            )}
          </div>
          
          {user && (
            <div className={`${styles.menuItem} ${styles.logout}`} onClick={() => setShowLogoutConfirm(true)} style={{ cursor: 'pointer' }}>
              <LogOut size={20} color="#dc2626" />
              <span style={{ color: '#dc2626', fontWeight: 700 }}>{t('logout')}</span>
            </div>
          )}
        </div>
      </div>

      {showLogoutConfirm && mounted && createPortal(
        <div className={styles.confirmOverlay} onClick={() => !loggingOut && setShowLogoutConfirm(false)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIconBox}>
              <LogOut size={28} />
            </div>
            <h3 className={styles.confirmTitle}>
              {lang === 'bn' ? 'লগআউট করতে চান?' : 'Sign Out of BikroyNow?'}
            </h3>
            <p className={styles.confirmDesc}>
              {lang === 'bn' 
                ? 'আপনি কি নিশ্চিতভাবে আপনার অ্যাকাউন্ট থেকে লগআউট করতে চান?' 
                : 'Are you sure you want to log out of your account?'}
            </p>
            <div className={styles.confirmActions}>
              <button 
                type="button"
                className={styles.confirmCancelBtn}
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
              >
                {lang === 'bn' ? 'না, থাক' : 'Cancel'}
              </button>
              <button 
                type="button"
                className={styles.confirmLogoutBtn}
                onClick={executeLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <>
                    <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>{lang === 'bn' ? 'লগআউট হচ্ছে...' : 'Signing out...'}</span>
                  </>
                ) : (
                  <>
                    <LogOut size={16} />
                    <span>{lang === 'bn' ? 'হ্যাঁ, লগআউট' : 'Yes, Sign Out'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showInstallGuide && mounted && createPortal(
        <div className={styles.confirmOverlay} onClick={() => setShowInstallGuide(false)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={22} color="#008b5e" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  {lang === 'bn' ? 'অ্যাপ ইনস্টল করার নিয়ম' : 'How to Install App'}
                </h3>
              </div>
              <button 
                onClick={() => setShowInstallGuide(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {typeof window !== 'undefined' && isIOS() ? (
              <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 10px 0' }}>
                  {lang === 'bn'
                    ? 'আইফোনে অ্যাপ ইনস্টল করতে নিচের ধাপগুলো অনুসরণ করুন:'
                    : 'To install on iPhone / iPad:'}
                </p>
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>১. Safari ব্রাউজারের নিচে <strong>Share <Share size={13} style={{ display: 'inline' }} /></strong> বাটনে চাপ দিন</div>
                  <div>২. <strong>&quot;Add to Home Screen&quot; <PlusSquare size={13} style={{ display: 'inline' }} /></strong> চাপুন</div>
                  <div>৩. উপরে ডানপাশে <strong>&quot;Add&quot;</strong> ট্যাপ করুন</div>
                </div>
              </div>
            ) : typeof window !== 'undefined' && isAndroid() ? (
              <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: 600, color: '#1e293b' }}>
                  {lang === 'bn'
                    ? 'ব্রাউজার মেনু থেকে সরাসরি অ্যাপ ইনস্টল করুন:'
                    : 'Install app directly from your browser menu:'}
                </p>
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>১. ব্রাউজারের ৩-ডট <strong>(⋮) <MoreVertical size={13} style={{ display: 'inline' }} /></strong> মেনুতে চাপ দিন</div>
                  <div>২. <strong>&quot;Install app&quot;</strong> বা <strong>&quot;Add to Home screen&quot;</strong> বেছে নিন</div>
                  <div>৩. <strong>&quot;Install&quot;</strong> ট্যাপ করলেই BikroyNow অ্যাপটি মোবাইলে ইনস্টল হয়ে যাবে</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: 600, color: '#1e293b' }}>
                  {lang === 'bn'
                    ? 'কম্পিউটারে আলাদা উইন্ডো অ্যাপ হিসেবে ইনস্টল করুন:'
                    : 'Install as standalone desktop app window:'}
                </p>
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>১. ব্রাউজারের অ্যাড্রেস বারের ডানপাশে থাকা <strong>ইনস্টল আইকন <Download size={13} style={{ display: 'inline' }} /></strong> এ ক্লিক করুন</div>
                  <div>২. অথবা ৩-ডট <strong>(⋮)</strong> মেনু থেকে <strong>&quot;Install BikroyNow&quot;</strong> বেছে নিন</div>
                  <div>৩. <strong>&quot;Install&quot;</strong> বাটনে চাপলেই কম্পিউটারের ডেস্কটপ ও টাস্কবারে আলাদা অ্যাপ তৈরি হয়ে যাবে</div>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setShowInstallGuide(false);
              }}
              style={{
                marginTop: '1.25rem',
                width: '100%',
                background: '#008b5e',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '0.65rem',
                fontWeight: 750,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
