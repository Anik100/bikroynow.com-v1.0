'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabaseClient';
import { uploadToImgBB } from '../../../lib/imgbb';
import { CATEGORIES, LOCATIONS, matchesLocationQuery, getCategoryName } from '../../../lib/constants';
import { useLanguage } from '../../../context/LanguageContext';
import { compressImage } from '../../../lib/utils';
import styles from '../../post-ad/post-ad.module.css';
import { Smartphone, Laptop, Zap, Car, Home as HouseIcon, Briefcase, Box, Loader2 } from 'lucide-react';

const ADMIN_EMAILS = [
  'anikh0000@gmail.com',
  'anikh00000@gmail.com',
  'anikh00@gmail.com',
  'aunik008@gmail.com',
  'aunik003@gmail.com'
];

const CAT_CONFIG = {
  'Mobile Phones': { icon: Smartphone, color: '#2563eb', bg: '#f0f7ff' },
  Computers: { icon: Laptop, color: '#059669', bg: '#ecfdf5' },
  Electronics: { icon: Zap, color: '#d97706', bg: '#fffbeb' },
  Vehicles: { icon: Car, color: '#dc2626', bg: '#fef2f2' },
  Property: { icon: HouseIcon, color: '#7c3aed', bg: '#f5f3ff' },
  Jobs: { icon: Briefcase, color: '#db2777', bg: '#fdf2f8' },
  'অন্যান্য': { icon: Box, color: '#475569', bg: '#f8fafc' },
};

function getCategoryDisplay(categoryId, lang) {
  if (!categoryId) return '';
  for (const [mainCat, subs] of Object.entries(CATEGORIES)) {
    if (subs && Object.prototype.hasOwnProperty.call(subs, categoryId)) {
      return `${getCategoryName(mainCat, lang)} › ${getCategoryName(categoryId, lang)}`;
    }
  }
  return getCategoryName(categoryId, lang);
}

export default function EditAd({ params }) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    category_id: '',
    condition: 'Used',
    price: '',
    location: '',
    description: '',
    contact_phone: '',
    images: []
  });

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationType, setLocationType] = useState('division');
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchAd = async () => {
      let activeSession = null;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        activeSession = session;
      } else {
        await new Promise(r => setTimeout(r, 350));
        const retry = await supabase.auth.getSession();
        if (retry.data.session?.user) activeSession = retry.data.session;
      }

      if (!activeSession) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', params.id)
        .single();
      
      if (!data) {
        alert('Ad not found.');
        router.push('/my-ads');
        return;
      }

      const isAdmin = ADMIN_EMAILS.includes((activeSession.user.email || '').toLowerCase().trim());

      // ২. Owner check — যদি এই ad আপনার না হয় এবং আপনি অ্যাডমিন না হন
      if (data.user_id !== activeSession.user.id && !isAdmin) {
        alert(lang === 'bn' ? 'এই বিজ্ঞাপনটি আপনার নয়। শুধুমাত্র নিজের বিজ্ঞাপন এডিট করতে পারবেন।' : 'You can only edit your own ads.');
        router.push('/my-ads');
        return;
      }

      setFormData({
        title: data.title || '',
        category_id: data.category_id || '',
        condition: data.condition || 'Used',
        price: data.price ?? '',
        location: data.location || '',
        description: data.description || '',
        contact_phone: data.contact_phone || '',
        images: data.images || []
      });
      setLoading(false);
    };
    fetchAd();
  }, [params.id]);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (formData.images.length + files.length > 5) {
      setError(lang === 'bn' ? 'সর্বোচ্চ ৫টি ছবি দেওয়া যাবে।' : 'You can upload up to 5 images.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setUpdating(true);
    setError(null);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const compressed = await compressImage(file);
        return await uploadToImgBB(compressed);
      });
      
      const urls = await Promise.all(uploadPromises);
      setFormData({ ...formData, images: [...formData.images, ...urls] });
    } catch (err) {
      console.error('Image upload failed:', err);
    }
    
    setUpdating(false);
  };

  const handleRemoveImage = (index) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.category_id) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে একটি ক্যাটাগরি নির্বাচন করুন।' : 'Please select a category.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!formData.condition) {
      setError(lang === 'bn' ? '⚠️ অনুগ্রহ করে পণ্যের অবস্থা নির্বাচন করুন (ব্যবহৃত নাকি নতুন)।' : '⚠️ Please select the product condition (Used or New).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const bdPhoneRegex = /^01[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(formData.contact_phone)) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে একটি সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।' : 'Please provide a valid Bangladeshi phone number (e.g., 017XXXXXXXX).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setUpdating(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    const isAdmin = ADMIN_EMAILS.includes((session.user.email || '').toLowerCase().trim());

    let query = supabase
      .from('listings')
      .update({
        title: formData.title,
        category_id: formData.category_id,
        condition: formData.condition,
        price: parseFloat(formData.price),
        location: formData.location,
        description: formData.description,
        contact_phone: formData.contact_phone,
        images: formData.images
      })
      .eq('id', params.id);

    if (!isAdmin) {
      query = query.eq('user_id', session.user.id);
    }

    const { error: updateError } = await query;

    if (updateError) {
      setError('Update failed: ' + updateError.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (isAdmin) {
        router.push(`/ad/${params.id}`);
      } else {
        router.push('/my-ads');
      }
    }
    setUpdating(false);
  };

  if (loading) return <div className="container" style={{padding: '5rem 0', textAlign: 'center'}}>Loading...</div>;

  return (
    <div className={styles.postContainer}>
      <div className={styles.postCard}>
        <h1 className={styles.pageTitle}>{lang === 'bn' ? 'বিজ্ঞাপন এডিট করুন' : 'Edit Your Ad'}</h1>

        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            fontWeight: 600
          }}>
            {error}
          </div>
        )}
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('photos')}</label>
            <div className={styles.imageGrid}>
              {formData.images.map((url, i) => (
                <div key={i} className={styles.imageBox}>
                  <div className={styles.previewWrapper}>
                    <img src={url} alt="Listing" />
                    <button type="button" onClick={() => handleRemoveImage(i)} className={styles.removeBtn}>×</button>
                  </div>
                </div>
              ))}
              {formData.images.length < 5 && (
                <div className={styles.imageBox}>
                  <label className={styles.uploadPlaceholder}>
                    <input type="file" multiple accept=".jpg,.jpeg,.png,.webp" onChange={handleImageUpload} hidden />
                    <span className={styles.plusIcon}>+</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('selectCategory')} *</label>
            <div className={styles.categorySelectBtn} onClick={() => setShowCategoryModal(true)}>
              {formData.category_id
                ? <span className={styles.selectedCatText}>{getCategoryDisplay(formData.category_id, lang)}</span>
                : <span className={styles.placeholderText}>{t('selectCategory')}</span>
              }
              <span style={{ color: '#9ca3af' }}>▼</span>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('condition')} <span style={{ color: '#ef4444', fontWeight: 900 }}>*</span></label>
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

          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('location')}</label>
            <div className={styles.selectBox} onClick={() => setShowLocationModal(true)}>
              <span>{formData.location || t('selectLocation')}</span>
              <span>▼</span>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('title')}</label>
            <input 
              type="text" required className={styles.premiumInput} value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('price')}</label>
            <input 
              type="number" required className={styles.premiumInput} value={formData.price}
              onChange={e => setFormData({...formData, price: e.target.value})}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('description')}</label>
            <textarea 
              required rows={5} className={styles.premiumTextarea} value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            ></textarea>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('contactPhone')}</label>
            <input 
              type="text" required className={styles.premiumInput} value={formData.contact_phone}
              onChange={e => setFormData({...formData, contact_phone: e.target.value})}
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={updating}>
            {updating ? <Loader2 className="spinner" /> : (lang === 'bn' ? 'আপডেট করুন' : 'Update Ad')}
          </button>
        </form>
      </div>

      {/* Location Modal */}
      {showLocationModal && (
        <div className={styles.darkModalOverlay} onClick={() => setShowLocationModal(false)}>
          <div className={styles.darkModal} onClick={e => e.stopPropagation()}>
            <div className={styles.darkModalHeader}>
              <h3>{locationType === 'division' ? t('selectDiv') : t('selectDist')}</h3>
              <input 
                type="text" placeholder={t('searchLoc')} 
                className={styles.darkModalSearch}
                value={locationSearch} onChange={e => setLocationSearch(e.target.value)}
              />
            </div>
            <div className={styles.radioList}>
              {locationSearch ? (
                Object.entries(LOCATIONS).flatMap(([div, dists]) => {
                  const filtered = dists.filter(d => matchesLocationQuery(d, locationSearch));
                  let res = [];
                  if (matchesLocationQuery(div, locationSearch)) res.push({name: div, type: 'division'});
                  filtered.forEach(d => res.push({name: d, type: 'district', parent: div}));
                  return res;
                }).map((loc, i) => (
                  <label key={i} className={styles.radioItem}>
                    <div className={styles.locInfo}>
                      <span className={styles.locName}>{t(loc.name)}</span>
                      {loc.parent && <span className={styles.locParent}>{t(loc.parent)}</span>}
                    </div>
                    <input type="radio" name="loc" onChange={() => {
                      if (loc.type === 'division') { setSelectedDivision(loc.name); setLocationType('district'); }
                      else { setFormData({...formData, location: loc.name}); setShowLocationModal(false); }
                      setLocationSearch('');
                    }} />
                    <span className={styles.radioCircle}></span>
                  </label>
                ))
              ) : (
                (locationType === 'division' ? Object.keys(LOCATIONS) : LOCATIONS[selectedDivision]).map(loc => (
                  <label key={loc} className={styles.radioItem}>
                    <span className={styles.locName}>{t(loc)} {locationType === 'division' ? (lang === 'bn' ? 'বিভাগ' : 'Division') : ''}</span>
                    <input type="radio" name="loc" onChange={() => {
                      if (locationType === 'division') { setSelectedDivision(loc); setLocationType('district'); }
                      else { setFormData({...formData, location: loc}); setShowLocationModal(false); }
                    }} />
                    <span className={styles.radioCircle}></span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
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
                  ? getCategoryName(selectedMainCategory, lang)
                  : (lang === 'bn' ? 'ক্যাটাগরি নির্বাচন করুন' : 'Select Category')}
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedMainCategory(null);
                }}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              {!selectedMainCategory ? (
                <div className={styles.stepList}>
                  <p className={styles.stepNotice}>
                    {lang === 'bn' ? '১. একটি ক্যাটাগরি নির্বাচন করুন:' : '1. Select Category:'}
                  </p>
                  {Object.keys(CATEGORIES).map(main => {
                    const config = CAT_CONFIG[main] || CAT_CONFIG['অন্যান্য'];
                    const Icon = config.icon;
                    return (
                      <div
                        key={main}
                        className={styles.stepItem}
                        onClick={() => setSelectedMainCategory(main)}
                      >
                        <div className={styles.stepIcon} style={{ background: config.bg, color: config.color }}>
                          <Icon size={18} />
                        </div>
                        <span className={styles.stepText}>{getCategoryName(main, lang)}</span>
                        <span className={styles.stepArrow}>›</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.stepList}>
                  <div className={styles.stepHeader}>
                    <button
                      type="button"
                      className={styles.backButton}
                      onClick={() => setSelectedMainCategory(null)}
                    >
                      ← {lang === 'bn' ? 'পূর্ববর্তী' : 'Back'}
                    </button>
                    <span className={styles.activeCategoryTitle}>
                      {getCategoryName(selectedMainCategory, lang)}
                    </span>
                  </div>

                  <p className={styles.stepNotice}>
                    {lang === 'bn' ? '২. সাব-ক্যাটাগরি নির্বাচন করুন:' : '2. Select Subcategory:'}
                  </p>

                  <div className={styles.subListGrid}>
                    {Object.keys(CATEGORIES[selectedMainCategory]).map(subKey => (
                      <div
                        key={subKey}
                        className={styles.stepSubItem}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, category_id: subKey }));
                          setShowCategoryModal(false);
                          setSelectedMainCategory(null);
                        }}
                      >
                        <span>{getCategoryName(subKey, lang)}</span>
                        <span className={styles.stepArrow}>›</span>
                      </div>
                    ))}
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
