'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, FileText, Star, Award, Settings, HelpCircle, LogOut, User as UserIcon, MessageSquare, Heart } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import styles from './ProfileMenu.module.css';
import { uploadToImgBB } from '../lib/imgbb';
import { compressImage } from '../lib/utils';

export default function ProfileMenu({ user, hasAdminAccess, onClose, onLogout }) {
  const { lang, t, toggleLanguage } = useLanguage();
  const [profile, setProfile] = useState(null);
  
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
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) {
        setProfile(data);
        setNewName(data.full_name || '');
        setNewAvatar(data.avatar_url || '');
      }
    };
    fetchProfile();
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

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
        
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
              <div className={styles.avatar}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className={styles.avatarImage} />
                ) : (
                  <UserIcon size={30} color="white" />
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
                  <h3>{profile?.full_name || user.email?.split('@')[0] || t('user')}</h3>
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
          
          {user && (
            <div className={`${styles.menuItem} ${styles.logout}`} onClick={() => { onLogout(); onClose(); }}>
              <LogOut size={20} color="#dc2626" />
              <span style={{ color: '#dc2626' }}>{t('logout')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
