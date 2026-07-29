'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { uploadToImgBB } from '../../../lib/imgbb';
import { CATEGORIES, LOCATIONS } from '../../../lib/constants';
import { useLanguage } from '../../../context/LanguageContext';
import { compressImage } from '../../../lib/utils';
import styles from '../../post-ad/post-ad.module.css';
import { Camera, X, MapPin, ChevronRight, Loader2 } from 'lucide-react';

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

  useEffect(() => {
    const fetchAd = async () => {
      // ১. আগে session চেক করুন
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
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

      const isAdmin = session.user.email === 'anikh0000@gmail.com';

      // ২. Owner check — যদি এই ad আপনার না হয় এবং আপনি অ্যাডমিন না হন
      if (data.user_id !== session.user.id && !isAdmin) {
        alert(lang === 'bn' ? 'এই বিজ্ঞাপনটি আপনার নয়। শুধুমাত্র নিজের বিজ্ঞাপন এডিট করতে পারবেন।' : 'You can only edit your own ads.');
        router.push('/my-ads');
        return;
      }

      setFormData({
        title: data.title,
        category_id: data.category_id,
        condition: data.condition,
        price: data.price,
        location: data.location,
        description: data.description,
        contact_phone: data.contact_phone,
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

    const bdPhoneRegex = /^01[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(formData.contact_phone)) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে একটি সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।' : 'Please provide a valid Bangladeshi phone number (e.g., 017XXXXXXXX).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setUpdating(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    const isAdmin = session.user.email === 'anikh0000@gmail.com';

    let query = supabase
      .from('listings')
      .update({
        ...formData,
        price: parseFloat(formData.price)
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
                  const filtered = dists.filter(d => d.toLowerCase().includes(locationSearch.toLowerCase()));
                  let res = [];
                  if (div.toLowerCase().includes(locationSearch.toLowerCase())) res.push({name: div, type: 'division'});
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
    </div>
  );
}
