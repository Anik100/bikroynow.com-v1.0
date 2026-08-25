'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { uploadToImgBB } from '../../lib/imgbb';
import { compressImage } from '../../lib/utils';
import { LOCATIONS, CATEGORIES } from '../../lib/constants';
import { useLanguage } from '../../context/LanguageContext';
import { Smartphone, Laptop, Zap, Car, Home as HouseIcon, Briefcase, Box, ChevronRight, ChevronDown } from 'lucide-react';
import styles from './post-ad.module.css';

const CAT_CONFIG = {
  'Mobile Phones': { icon: Smartphone, color: '#2563eb', bg: '#f0f7ff', border: '#bfdbfe', text: '#1e40af', gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #60a5fa 100%)' },
  Computers: { icon: Laptop, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', gradient: 'linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)' },
  Electronics: { icon: Zap, color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e', gradient: 'linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #fbbf24 100%)' },
  Vehicles: { icon: Car, color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', gradient: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 50%, #f87171 100%)' },
  Property: { icon: HouseIcon, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', gradient: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 50%, #a78bfa 100%)' },
  Jobs: { icon: Briefcase, color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d', gradient: 'linear-gradient(135deg, #be185d 0%, #ec4899 50%, #f472b6 100%)' },
  'অন্যান্য': { icon: Box, color: '#475569', bg: '#f8fafc', border: '#cbd5e1', text: '#1e293b', gradient: 'linear-gradient(135deg, #334155 0%, #64748b 50%, #94a3b8 100%)' },
};

const BN_CAT_NAMES = {
  Electronics: 'ইলেকট্রনিক্স',
  Computers: 'কম্পিউটার ও আইটি',
  'Mobile Phones': 'মোবাইল ফোন',
  Vehicles: 'গাড়ি ও যানবাহন',
  Property: 'জমি ও ফ্ল্যাট',
  Jobs: 'চাকরি',
  'অন্যান্য': 'অন্যান্য',
};

export default function PostAd() {
  const [user, setUser] = useState(null);
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    price: '',
    location: '',
    condition: 'Used',
    contact_phone: '',
    division: '',
    district: '',
  });

  const [imageUrls, setImageUrls] = useState([]);
  const [uploadingSlots, setUploadingSlots] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [displayCategory, setDisplayCategory] = useState('');
  const [mounted, setMounted] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [monthlyAdsCount, setMonthlyAdsCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    const fetchUserAndQuota = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let activeUser = session?.user;
        if (!activeUser) {
          const localUser = localStorage.getItem('bikroynow_demo_user');
          if (localUser) {
            activeUser = JSON.parse(localUser);
          } else {
            activeUser = { id: 'default-user', email: 'user@bikroynow.com' };
          }
        }
        setUser(activeUser);

        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('membership_type, membership_expires_at')
            .eq('id', session.user.id)
            .maybeSingle();

          setUserProfile(profile || { membership_type: 'free' });
        } else {
          setUserProfile({ membership_type: 'free' });
        }
      } catch (err) {
        let fallbackUser = { id: 'default-user', email: 'user@bikroynow.com' };
        try {
          const localUser = localStorage.getItem('bikroynow_demo_user');
          if (localUser) fallbackUser = JSON.parse(localUser);
        } catch (e) {}
        setUser(fallbackUser);
        setUserProfile({ membership_type: 'free' });
      }
    };
    fetchUserAndQuota();
  }, [router]);

  // Drag-to-reorder state
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showCategoryModal) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflowY = 'scroll';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflowY = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflowY = '';
    };
  }, [showCategoryModal]);

  // Concurrent Non-blocking Multi-image upload handler
  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Reset input value safely after extracting files
    if (fileInputRef.current) fileInputRef.current.value = '';

    const currentTotal = imageUrls.length + uploadingSlots.length;
    const remaining = Math.max(0, 5 - currentTotal);

    if (remaining === 0) {
      setError(lang === 'bn'
        ? 'সর্বোচ্চ ৫টি ছবি যোগ করা যাবে।'
        : 'Maximum 5 images allowed.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const filesToUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      setError(lang === 'bn'
        ? `সর্বোচ্চ ৫টি ছবি দেওয়া যাবে। শুধুমাত্র প্রথম ${remaining}টি ছবি নেওয়া হয়েছে।`
        : `Only first ${remaining} image(s) added. Max 5 total.`);
    } else {
      setError(null);
    }

    // Create temporary task objects with instant local blob previews
    const newTasks = filesToUpload.map(file => ({
      id: 'task-' + Math.random().toString(36).slice(2, 9) + '-' + Date.now(),
      preview: URL.createObjectURL(file),
      file
    }));

    setUploadingSlots(prev => [...prev, ...newTasks]);

    // Process each upload independently in parallel
    newTasks.forEach(async (task) => {
      try {
        const compressed = await compressImage(task.file);
        const url = await uploadToImgBB(compressed || task.file);
        if (url) {
          setImageUrls(prev => {
            if (prev.length >= 5) return prev;
            return [...prev, url];
          });
        }
      } catch (err) {
        console.error('Parallel upload error:', err);
      } finally {
        setUploadingSlots(prev => prev.filter(t => t.id !== task.id));
        try {
          URL.revokeObjectURL(task.preview);
        } catch (e) {}
      }
    });
  };

  const removeImage = (index) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  // Drag-to-reorder handlers
  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newUrls = [...imageUrls];
    const [moved] = newUrls.splice(dragIndex, 1);
    newUrls.splice(index, 0, moved);
    setImageUrls(newUrls);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.category_id) {
      setError(lang === 'bn' ? '⚠️ অনুগ্রহ করে একটি ক্যাটাগরি নির্বাচন করুন।' : '⚠️ Please select a category.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!formData.title || !formData.title.trim()) {
      setError(lang === 'bn' ? '⚠️ অনুগ্রহ করে পণ্যের নাম লিখুন।' : '⚠️ Please enter a product title.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (imageUrls.length === 0) {
      setError(lang === 'bn' ? '⚠️ অনুগ্রহ করে অন্তত একটি ছবি যোগ করুন।' : '⚠️ Please add at least one image.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const phoneInput = (formData.contact_phone || '').trim();
    const bdPhoneRegex = /^01[3-9]\d{8}$/;
    if (phoneInput && !bdPhoneRegex.test(phoneInput)) {
      setError(lang === 'bn' ? '⚠️ অনুগ্রহ করে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)।' : '⚠️ Please provide a valid 11-digit Bangladeshi phone number (e.g., 01712345678).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const parsedPrice = parseFloat(formData.price) || 0;
    setSubmitting(true);

    try {
      const location = formData.district || formData.division || 'Dhaka';
      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      let adUserId = user?.id;
      if (!isValidUUID(adUserId)) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id && isValidUUID(session.user.id)) {
            adUserId = session.user.id;
          }
        } catch (e) {}
      }

      const newAdPayload = {
        id: generateUUID(),
        user_id: adUserId,
        title: formData.title.trim(),
        description: formData.description || '',
        price: parsedPrice,
        category_id: formData.category_id,
        location,
        condition: formData.condition || 'Used',
        contact_phone: phoneInput || formData.contact_phone || '01700000000',
        images: imageUrls,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      // 1. Post to server-side API endpoint
      const res = await fetch('/api/post-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdPayload)
      });
      const data = await res.json();
      if (data?.ad?.id) {
        newAdPayload.id = data.ad.id;
      }

      // 2. Save to shared public ads pool in localStorage as client fallback
      try {
        const existingPublic = JSON.parse(localStorage.getItem('bikroynow_public_ads') || '[]');
        localStorage.setItem('bikroynow_public_ads', JSON.stringify([newAdPayload, ...existingPublic]));
      } catch (e) {}

      setSubmittedSuccess(true);
    } catch (err) {
      console.error('Submit ad error:', err);
      setError(lang === 'bn' ? 'বিজ্ঞাপনটি জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' : 'Failed to submit ad. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedSuccess) {
    return (
      <div className={styles.postContainer}>
        <div className={styles.postCard} style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%', background: '#e6f7f0', color: '#008b5e',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2.5rem', fontWeight: 800
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 850, color: '#0f172a', marginBottom: '0.8rem' }}>
            {lang === 'bn' ? 'বিজ্ঞাপনটি সফলভাবে জমা দেওয়া হয়েছে!' : 'Ad Submitted for Review!'}
          </h2>
          <p style={{ color: '#475569', fontSize: '0.98rem', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 2rem', fontWeight: 600 }}>
            {lang === 'bn' 
              ? 'আপনার বিজ্ঞাপনটি পেন্ডিং এ রয়েছে। অ্যাডমিন প্যানেল থেকে অনুমোদন (Approve) করার পর এটি ওয়েবসাইটে প্রকাশিত হবে।' 
              : 'Your ad has been submitted and is currently pending. It will be published after admin approval.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className={styles.submitBtn} style={{ width: 'auto', padding: '0.75rem 2rem', fontSize: '0.95rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {lang === 'bn' ? 'হোম পেজে যান' : 'Go to Homepage'}
            </Link>
            <button 
              type="button" 
              onClick={() => {
                setSubmittedSuccess(false);
                setFormData({ title: '', category_id: '', division: '', district: '', condition: 'Used', price: '', description: '', contact_phone: '' });
                setImageUrls([]);
                setDisplayCategory('');
              }}
              style={{
                padding: '0.75rem 2rem', fontSize: '0.95rem', background: '#ffffff',
                border: '1.5px solid #cbd5e1', borderRadius: '12px', color: '#0f172a',
                fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s ease'
              }}
            >
              {lang === 'bn' ? 'আরেকটি বিজ্ঞাপন দিন' : 'Post Another Ad'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.postContainer}>
      <div className={styles.postCard}>
        <h1 className={styles.pageTitle}>{t('postAdSubmit')}</h1>

        {/* Free Monthly Ads Quota Indicator Badge */}
        {userProfile && (!userProfile.membership_type || userProfile.membership_type.toLowerCase() === 'free') && (
          <div style={{
            background: monthlyAdsCount >= 3 ? '#fff1f2' : '#f0fdf4',
            border: `1.5px solid ${monthlyAdsCount >= 3 ? '#fecdd3' : '#bbf7d0'}`,
            color: monthlyAdsCount >= 3 ? '#991b1b' : '#166534',
            padding: '0.75rem 1.1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontSize: '0.88rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💡 {lang === 'bn' ? 'চলতি মাসের ফ্রি বিজ্ঞাপন কোটা:' : 'Monthly Free Ads Quota:'}
            </span>
            <span style={{
              background: monthlyAdsCount >= 3 ? '#dc2626' : '#008b5e',
              color: '#ffffff',
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: 850
            }}>
              {monthlyAdsCount}/3 {lang === 'bn' ? 'ব্যবহৃত' : 'Used'}
            </span>
          </div>
        )}

        {error && (
          <div style={{
            background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.8rem 1.2rem', borderRadius: '8px', marginBottom: '1.5rem',
            fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>

          {/* === CATEGORY === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('selectCategory')} *</label>
            <div className={styles.categorySelectBtn} onClick={() => setShowCategoryModal(true)}>
              {displayCategory
                ? <span className={styles.selectedCatText}>{displayCategory}</span>
                : <span className={styles.placeholderText}>{t('selectCategory')}</span>
              }
              <span style={{ color: '#9ca3af' }}>▼</span>
            </div>
          </div>

          {/* === TITLE === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{lang === 'bn' ? 'পণ্যের নাম' : 'Product Name'} *</label>
            <input
              type="text" required className={styles.premiumInput}
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder={lang === 'bn' ? 'পণ্যের নাম লিখুন...' : 'Enter product name...'}
            />
          </div>

          {/* === IMAGES === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              {lang === 'bn' ? 'ছবি যোগ করুন' : 'Add Images'}
              <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: '4px' }}>({imageUrls.length}/5)</span>
            </label>

            {/* Hidden persistent file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />

            <div className={styles.imageGrid}>
              {/* 1. Completed uploaded image slots — draggable */}
              {imageUrls.map((url, index) => (
                <div
                  key={`img-${index}-${url.slice(-8)}`}
                  className={[
                    styles.imageBox,
                    dragIndex === index ? styles.dragging : '',
                    dragOverIndex === index && dragIndex !== index ? styles.dragOver : ''
                  ].join(' ')}
                  draggable
                  onDragStart={e => handleDragStart(e, index)}
                  onDragOver={e => handleDragOver(e, index)}
                  onDrop={e => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className={styles.previewWrapper}>
                    {index === 0 && (
                      <div className={styles.coverBadge}>
                        {lang === 'bn' ? 'কভার' : 'Cover'}
                      </div>
                    )}
                    <img src={url} alt="preview" />
                    <button type="button" onClick={() => removeImage(index)} className={styles.removeBtn}>×</button>
                    <div className={styles.dragHandle} title="Drag to reorder">⠿</div>
                  </div>
                </div>
              ))}

              {/* 2. Uploading in-progress slots with instant photo preview + modern spinner */}
              {uploadingSlots.map((task) => (
                <div key={task.id} className={`${styles.imageBox} ${styles.uploadingSlot}`} style={{ position: 'relative', overflow: 'hidden' }}>
                  <img 
                    src={task.preview} 
                    alt="uploading" 
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} 
                  />
                  <div className={styles.spinnerSmall} style={{ position: 'relative', zIndex: 2 }} />
                  <span className={styles.uploadingText} style={{ position: 'relative', zIndex: 2, background: 'rgba(255, 255, 255, 0.88)', borderRadius: '4px', padding: '1px 4px' }}>
                    {lang === 'bn' ? 'আপলোড...' : 'Uploading...'}
                  </span>
                </div>
              ))}

              {/* 3. Empty active clickable upload slots (always fill total to 5) */}
              {Array.from({ length: Math.max(0, 5 - imageUrls.length - uploadingSlots.length) }).map((_, i) => (
                <div
                  key={`empty-upload-${i}`}
                  className={`${styles.imageBox} ${styles.uploadBox}`}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.uploadPlaceholder}>
                    <span className={styles.plusIcon}>+</span>
                  </div>
                </div>
              ))}
            </div>

            <p className={styles.imageHint}>
              💡 {lang === 'bn'
                ? 'একসাথে ৫টি পর্যন্ত ছবি সিলেক্ট করুন। টেনে ধরে সাজান।'
                : 'Select up to 5 images at once. Drag to reorder.'}
            </p>
          </div>

          {/* === PRICE === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{lang === 'bn' ? 'মূল্য (টাকা)' : 'Price (BDT)'} *</label>
            <input
              type="number" required className={styles.premiumInput}
              value={formData.price}
              onChange={e => setFormData({ ...formData, price: e.target.value })}
              placeholder={lang === 'bn' ? 'মূল্য লিখুন (যেমন: ৫০০০)' : 'Enter price (e.g. 5000)'}
              min="0"
            />
          </div>

          {/* === PHONE === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{lang === 'bn' ? 'ফোন নম্বর' : 'Phone Number'} *</label>
            <input
              type="tel" required className={styles.premiumInput}
              value={formData.contact_phone}
              onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
              placeholder="01XXXXXXXXX"
            />
          </div>

          {/* === LOCATION === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{lang === 'bn' ? 'অবস্থান' : 'Location'} *</label>
            <div className={styles.locationRow}>
              <select
                className={styles.nativeSelect}
                value={formData.division}
                onChange={e => setFormData({ ...formData, division: e.target.value, district: '' })}
              >
                <option value="">{lang === 'bn' ? 'বিভাগ নির্বাচন করুন' : 'Select Division'}</option>
                {Object.keys(LOCATIONS).map(div => (
                  <option key={div} value={div}>
                    {t(div)}
                  </option>
                ))}
              </select>
              <select
                className={styles.nativeSelect}
                value={formData.district}
                onChange={e => setFormData({ ...formData, district: e.target.value })}
                disabled={!formData.division}
              >
                <option value="">{lang === 'bn' ? 'জেলা নির্বাচন করুন' : 'Select District'}</option>
                {formData.division && LOCATIONS[formData.division]?.map(dist => (
                  <option key={dist} value={dist}>{t(dist)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* === CONDITION === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('condition')}</label>
            <div className={styles.conditionRow}>
              <button type="button"
                className={`${styles.conditionBtn} ${formData.condition === 'Used' ? styles.conditionBtnActive : ''}`}
                onClick={() => setFormData({ ...formData, condition: 'Used' })}
              >{t('used')}</button>
              <button type="button"
                className={`${styles.conditionBtn} ${formData.condition === 'New' ? styles.conditionBtnActive : ''}`}
                onClick={() => setFormData({ ...formData, condition: 'New' })}
              >{t('new')}</button>
            </div>
          </div>

          {/* === DESCRIPTION === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('description')}</label>
            <textarea
              className={styles.premiumTextarea} rows="4"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder={lang === 'bn' ? 'পণ্যের অবস্থা ও বিস্তারিত লিখুন...' : 'Write product condition and details...'}
            />
          </div>

          {/* === SUBMIT === */}
          <button type="submit" className={styles.submitBtn} disabled={submitting || uploadingSlots.length > 0}>
            {submitting ? t('processing') : (lang === 'bn' ? 'বিজ্ঞাপন দিন' : 'Post Ad')}
          </button>
        </form>
      </div>

      {/* ===== CATEGORY MODAL ===== */}
      {showCategoryModal && mounted && createPortal(
        <div
          className={styles.modalOverlay}
          onClick={() => { if (!selectedMainCategory) setShowCategoryModal(false); }}
          onTouchMove={e => e.stopPropagation()}
        >
          <div className={styles.categoryModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                {selectedMainCategory
                  ? selectedMainCategory
                  : (lang === 'bn' ? 'ক্যাটাগরি নির্বাচন করুন' : 'Select Category')}
              </h3>
              <button 
                className={styles.modalCloseBtn} 
                onClick={() => { 
                  setShowCategoryModal(false); 
                  setSelectedMainCategory(null); 
                  setActiveSub(null);
                }}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              {!selectedMainCategory ? (
                /* Level 1: Main Categories List */
                <div className={styles.mainCatList}>
                  {Object.keys(CATEGORIES).map(main => {
                    const config = CAT_CONFIG[main] || CAT_CONFIG['অন্যান্য'];
                    const Icon = config.icon;
                    return (
                      <div 
                        key={main} 
                        className={styles.mainCatItem} 
                        onClick={() => {
                          setSelectedMainCategory(main);
                          if (CATEGORIES[main]) {
                            const firstSub = Object.keys(CATEGORIES[main])[0];
                            setActiveSub(firstSub);
                          } else {
                            setActiveSub(null);
                          }
                        }}
                      >
                        <div className={styles.iconBox} style={{ background: config.gradient }}>
                          <Icon size={16} color="#ffffff" />
                        </div>
                        <span className={styles.mainCatName}>{lang === 'bn' ? (BN_CAT_NAMES[main] || main) : main}</span>
                        <span className={styles.mainCatArrow}>›</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Level 2: Accordion Subcategories List */
                <div className={styles.subCatPanel}>
                  <button className={styles.subCatBackBtn} onClick={() => setSelectedMainCategory(null)}>
                    ← {lang === 'bn' ? 'ফিরে যান' : 'Back'}
                  </button>

                  <div className={styles.accordionContainer}>
                    {Object.entries(CATEGORIES[selectedMainCategory]).map(([sub, items]) => {
                      const isExpanded = activeSub === sub;
                      return (
                        <div key={sub} className={styles.subCatAccordionGroup}>
                          <div 
                            className={`${styles.subCatAccordionHeader} ${isExpanded ? styles.activeHeader : ''}`}
                            onClick={() => {
                              setActiveSub(prev => (prev === sub ? null : sub));
                            }}
                          >
                            <div className={styles.subCatAccordionTitle}>
                              <span className={styles.subHeaderDot}></span>
                              <span>{sub}</span>
                            </div>
                            <div className={`${styles.subChevronCircle} ${isExpanded ? styles.rotated : ''}`}>
                              <ChevronDown size={18} />
                            </div>
                          </div>

                          <div className={`${styles.accordionBody} ${isExpanded ? styles.expanded : ''}`}>
                            <div className={styles.accordionContent}>
                              <div className={styles.itemGrid}>
                                {items.map(item => (
                                  <div 
                                    key={item} 
                                    className={styles.subCatItem}
                                    onClick={() => {
                                      setFormData({ ...formData, category_id: item });
                                      const mainCatName = lang === 'bn' ? (BN_CAT_NAMES[selectedMainCategory] || selectedMainCategory) : selectedMainCategory;
                                      setDisplayCategory(`${mainCatName} › ${sub} › ${item}`);
                                      setShowCategoryModal(false);
                                      setSelectedMainCategory(null);
                                      setActiveSub(null);
                                    }}
                                  >
                                    <span>{item}</span>
                                    <span className={styles.arrowIcon}>→</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}