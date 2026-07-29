'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { uploadToImgBB } from '../../lib/imgbb';
import { LOCATIONS, CATEGORIES } from '../../lib/constants';
import { useLanguage } from '../../context/LanguageContext';
import { compressImage } from '../../lib/utils';
import { ChevronRight, X, Plus } from 'lucide-react';
import styles from './post-ad.module.css';

// Map category names to emojis
const CAT_ICONS = {
  Electronics: '⚡',
  'Mobile Phones': '📱',
  Computers: '💻',
  Vehicles: '🚗',
  Property: '🏠',
  Jobs: '💼',
  'অন্যান্য': '📦',
};

const BN_CAT_NAMES = {
  Electronics: 'ইলেকট্রনিক্স',
  'Mobile Phones': 'মোবাইল ফোন',
  Computers: 'কম্পিউটার',
  Vehicles: 'যানবাহন',
  Property: 'প্রপার্টি',
  Jobs: 'চাকরি',
  'অন্যান্য': 'অন্যান্য',
};

export default function PostAd() {
  const [user, setUser] = useState(null);
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState(null);

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
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState(null);
  const [displayCategory, setDisplayCategory] = useState('');
  const [limitReached, setLimitReached] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdAdId, setCreatedAdId] = useState(null);

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

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      checkPostLimit(session.user.id);
    };
    fetchUser();
  }, [router]);

  const checkPostLimit = async (userId) => {
    // 1. Fetch user's profile to check active membership status
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('membership_type, membership_expires_at')
      .eq('id', userId)
      .single();

    let allowedLimit = 7; // Default free limit
    let hasActiveMembership = false;
    let membershipType = 'free';

    if (!profileErr && profile) {
      const expiresAt = profile.membership_expires_at ? new Date(profile.membership_expires_at) : null;
      const isNotExpired = !expiresAt || new Date() < expiresAt;

      if (profile.membership_type && profile.membership_type !== 'free') {
        if (isNotExpired) {
          hasActiveMembership = true;
          membershipType = profile.membership_type;

          // Enforce limits based on membership type name
          if (membershipType.toLowerCase().includes('silver')) {
            allowedLimit = 50;
          } else if (membershipType.toLowerCase().includes('gold') || membershipType.toLowerCase().includes('business')) {
            allowedLimit = Infinity;
          } else {
            // Custom or fallback
            allowedLimit = 50;
          }
        } else {
          // Reset expired membership in the database automatically
          await supabase
            .from('profiles')
            .update({
              membership_type: 'free',
              membership_expires_at: null
            })
            .eq('id', userId);
        }
      }
    }

    // 2. Fetch active/pending ads count for this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    if (!error && count >= allowedLimit) {
      setLimitReached(true);
    }
  };

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length + imageUrls.length > 5) {
      setError(lang === 'bn' ? 'সর্বোচ্চ ৫টি ছবি দেওয়া যাবে।' : 'You can upload up to 5 images.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setUploading(true);
    setError(null);
    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        const url = await uploadToImgBB(compressed);
        setImageUrls(prev => [...prev, url]);
      } catch (err) {
        console.error('Upload failed:', err);
        setError(lang === 'bn' ? `ছবি আপলোড ব্যর্থ হয়েছে: ${err.message || err}` : `Image upload failed: ${err.message || err}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    setUploading(false);
  };

  const removeImage = (index) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.category_id) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে একটি ক্যাটাগরি নির্বাচন করুন।' : 'Please select a category.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!formData.district && !formData.division) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে একটি অবস্থান নির্বাচন করুন।' : 'Please select a location.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (imageUrls.length === 0) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে অন্তত একটি ছবি যোগ করুন।' : 'Please add at least one image.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const bdPhoneRegex = /^01[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(formData.contact_phone)) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে একটি সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।' : 'Please provide a valid Bangladeshi phone number (e.g., 017XXXXXXXX).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    const location = formData.district || formData.division;

    const { data, error: insertError } = await supabase.from('listings').insert([
      {
        user_id: user.id,
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        category_id: formData.category_id,
        location,
        condition: formData.condition,
        contact_phone: formData.contact_phone,
        images: imageUrls,
        status: 'pending'
      }
    ]).select();

    if (insertError) {
      setError('Error: ' + insertError.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setSubmitting(false);
    } else {
      setCreatedAdId(data[0].id);
      setShowSuccessModal(true);
    }
  };

  if (!user) return <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>{t('loading')}</div>;

  if (limitReached) {
    return (
      <div className={styles.postContainer}>
        <div className={styles.postCard} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💎</div>
          <h2 style={{ color: '#1c2b38', marginBottom: '1rem', fontSize: '1.8rem', fontWeight: 800 }}>
            {lang === 'bn' ? 'পোস্টিং লিমিট শেষ!' : 'Posting Limit Reached!'}
          </h2>
          <p style={{ color: '#4b5563', marginBottom: '2.5rem', lineHeight: '1.6', fontSize: '1rem' }}>
            {lang === 'bn' 
              ? 'আপনি এই মাসে আপনার ৭টি ফ্রি অ্যাড পোস্ট করার লিমিট পার করেছেন। আরও অ্যাড পোস্ট করতে এবং স্পেশাল সুবিধা পেতে আজই আমাদের মেম্বারশিপ গ্রহণ করুন।' 
              : 'You have reached your free limit of 7 posts this month. Please purchase a membership to post more ads and get premium features.'}
          </p>
          <Link href="/membership" className={styles.submitBtn} style={{ display: 'inline-block', textDecoration: 'none', maxWidth: '300px' }}>
            {lang === 'bn' ? 'মেম্বারশিপ প্যাকেজ দেখুন' : 'View Membership Packages'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.postContainer}>
      <div className={styles.postCard}>
        <h1 className={styles.pageTitle}>{t('postAdSubmit')}</h1>

        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '0.8rem 1.2rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>

          {/* === CATEGORY === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('selectCategory')} *</label>
            <div className={styles.categorySelectBtn} onClick={() => setShowCategoryModal(true)}>
              {displayCategory ? (
                <span className={styles.selectedCatText}>{displayCategory}</span>
              ) : (
                <span className={styles.placeholderText}>{t('selectCategory')}</span>
              )}
              <span style={{ color: '#9ca3af' }}>▼</span>
            </div>
          </div>

          {/* === TITLE (Product Name) === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              {lang === 'bn' ? 'পণ্যের নাম' : 'Product Name'} *
            </label>
            <input
              type="text"
              required
              className={styles.premiumInput}
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder={lang === 'bn' ? 'যেমন: iPhone 14 Pro Max' : 'e.g., iPhone 14 Pro Max'}
            />
          </div>

          {/* === IMAGES === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              {lang === 'bn' ? 'ছবি যোগ করুন' : 'Add Images'}
            </label>
            <div className={styles.imageGrid}>
              {/* 5 fixed slots - filled or empty */}
              {[0, 1, 2, 3, 4].map((slot) => {
                const url = imageUrls[slot];
                return (
                  <div key={slot} className={styles.imageBox}>
                    {url ? (
                      <div className={styles.previewWrapper}>
                        <img src={url} alt="preview" />
                        <button type="button" onClick={() => removeImage(slot)} className={styles.removeBtn}>×</button>
                      </div>
                    ) : (
                      <label className={styles.uploadPlaceholder} style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                        {slot === imageUrls.length ? (
                          // Only the next empty slot is clickable
                          <>
                            <input
                              type="file"
                              hidden
                              accept=".jpg,.jpeg,.png,.webp"
                              onChange={handleImageChange}
                              disabled={uploading}
                            />
                            <span className={styles.plusIcon}>{uploading && slot === imageUrls.length ? '...' : '+'}</span>
                          </>
                        ) : (
                          <span className={styles.plusIcon} style={{ color: '#e0e0e0' }}>+</span>
                        )}
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            <p className={styles.imageHint}>
              💡 {lang === 'bn' ? 'ছবিতে ক্লিক করে আপলোড করুন' : 'Click to upload image'}
            </p>
          </div>

          {/* === PRICE === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              {lang === 'bn' ? 'মূল্য (টাকা)' : 'Price (BDT)'} *
            </label>
            <input
              type="number"
              required
              className={styles.premiumInput}
              value={formData.price}
              onChange={e => setFormData({ ...formData, price: e.target.value })}
              placeholder={lang === 'bn' ? 'যেমন: ৪৫০০০' : 'e.g., 45000'}
              min="0"
            />
          </div>

          {/* === PHONE === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              {lang === 'bn' ? 'ফোন নম্বর' : 'Phone Number'} *
            </label>
            <input
              type="tel"
              required
              className={styles.premiumInput}
              value={formData.contact_phone}
              onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
              placeholder="01XXXXXXXXX"
            />
          </div>

          {/* === LOCATION === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              {lang === 'bn' ? 'অবস্থান' : 'Location'} *
            </label>
            <div className={styles.locationRow}>
              <select
                className={styles.nativeSelect}
                value={formData.division}
                onChange={e => setFormData({ ...formData, division: e.target.value, district: '' })}
              >
                <option value="">{lang === 'bn' ? 'বিভাগ নির্বাচন করুন' : 'Select Division'}</option>
                {Object.keys(LOCATIONS).map(div => (
                  <option key={div} value={div}>
                    {lang === 'bn' ? {
                      Dhaka: 'ঢাকা', Chattogram: 'চট্টগ্রাম', Rajshahi: 'রাজশাহী',
                      Khulna: 'খুলনা', Barishal: 'বরিশাল', Sylhet: 'সিলেট',
                      Rangpur: 'রংপুর', Mymensingh: 'ময়মনসিংহ'
                    }[div] || div : div}
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
            <label className={styles.label}>
              {t('condition')}
            </label>
            <div className={styles.conditionRow}>
              <button
                type="button"
                className={`${styles.conditionBtn} ${formData.condition === 'Used' ? styles.conditionBtnActive : ''}`}
                onClick={() => setFormData({ ...formData, condition: 'Used' })}
              >
                {t('used')}
              </button>
              <button
                type="button"
                className={`${styles.conditionBtn} ${formData.condition === 'New' ? styles.conditionBtnActive : ''}`}
                onClick={() => setFormData({ ...formData, condition: 'New' })}
              >
                {t('new')}
              </button>
            </div>
          </div>

          {/* === DESCRIPTION === */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              {t('description')}
            </label>
            <textarea
              className={styles.premiumTextarea}
              rows="4"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder={lang === 'bn' ? 'পণ্যের অবস্থা ও বিস্তারিত লিখুন...' : 'Write product condition and details...'}
            />
          </div>

          {/* === SUBMIT === */}
          <button type="submit" className={styles.submitBtn} disabled={submitting || uploading}>
            {submitting ? t('processing') : (lang === 'bn' ? 'বিজ্ঞাপন দিন' : 'Post Ad')}
          </button>
        </form>
      </div>

      {/* ===== CATEGORY MODAL (Slide-up from bottom) ===== */}
      {showCategoryModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setShowCategoryModal(false);
            setSelectedMainCategory(null);
          }}
        >
          <div className={styles.categoryModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                {selectedMainCategory
                  ? (lang === 'bn' ? 'উপ-ক্যাটাগরি' : 'Sub Category')
                  : (lang === 'bn' ? 'ক্যাটাগরি নির্বাচন করুন' : 'Select Category')}
              </h3>
              <button className={styles.modalCloseBtn} onClick={() => {
                setShowCategoryModal(false);
                setSelectedMainCategory(null);
              }}>×</button>
            </div>

            <div className={styles.modalBody}>
              {!selectedMainCategory ? (
                // MAIN CATEGORY LIST
                <div className={styles.mainCatList}>
                  {Object.keys(CATEGORIES).map(main => (
                    <div
                      key={main}
                      className={styles.mainCatItem}
                      onClick={() => setSelectedMainCategory(main)}
                    >
                      <span className={styles.mainCatIcon}>{CAT_ICONS[main] || '📦'}</span>
                      <span className={styles.mainCatName}>
                        {lang === 'bn' ? (BN_CAT_NAMES[main] || main) : main}
                      </span>
                      <span className={styles.mainCatArrow}>›</span>
                    </div>
                  ))}
                </div>
              ) : (
                // SUB CATEGORY LIST
                <div className={styles.subCatPanel}>
                  <button
                    className={styles.subCatBackBtn}
                    onClick={() => setSelectedMainCategory(null)}
                  >
                    ← {lang === 'bn' ? 'ফিরে যান' : 'Back'}
                  </button>

                  {Object.entries(CATEGORIES[selectedMainCategory]).map(([sub, items]) => (
                    <div key={sub} className={styles.subCatGroup}>
                      <div className={styles.subCatHeader}>{t(sub)}</div>
                      {items.map(item => (
                        <div
                          key={item}
                          className={styles.subCatItem}
                          onClick={() => {
                            setFormData({ ...formData, category_id: item });
                            const mainTranslated = lang === 'bn' ? (BN_CAT_NAMES[selectedMainCategory] || selectedMainCategory) : selectedMainCategory;
                            const subTranslated = t(sub);
                            const itemTranslated = t(item);
                            setDisplayCategory(`${mainTranslated} › ${subTranslated} › ${itemTranslated}`);
                            setShowCategoryModal(false);
                            setSelectedMainCategory(null);
                          }}
                        >
                          <span>{t(item)}</span>
                          <ChevronRight size={16} color="#9ca3af" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success / Pending Admin Approval Modal */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '2.5rem 2rem',
            maxWidth: '440px', width: '100%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            animation: 'modalFadeIn 0.3s ease-out'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem' }}>⏳</div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem', color: '#111' }}>
              {lang === 'bn' ? 'বিজ্ঞাপনটি অনুমোদনের অপেক্ষায় আছে!' : 'Ad is Pending Approval!'}
            </h3>
            <p style={{ color: '#4b5563', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.6 }}>
              {lang === 'bn' 
                ? 'আপনার বিজ্ঞাপনটি সফলভাবে পোস্ট করা হয়েছে। এটি বর্তমানে এডমিন অনুমোদনের অপেক্ষায় আছে। দয়া করে এডমিন এপ্রুভালের জন্য অপেক্ষা করুন।' 
                : 'Your ad has been successfully posted. It is currently under review by our moderation team. Please wait for admin approval.'}
            </p>
            <button
              onClick={() => {
                setShowSuccessModal(false);
                router.push(`/ad/${createdAdId}`);
              }}
              style={{
                width: '100%', padding: '0.85rem', borderRadius: '10px',
                border: 'none', background: '#008b5e',
                color: 'white', fontWeight: 700, cursor: 'pointer',
                fontSize: '1rem', transition: 'background 0.2s',
                boxShadow: '0 4px 12px rgba(0, 139, 94, 0.2)'
              }}
            >
              {lang === 'bn' ? 'ঠিক আছে' : 'Okay'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}