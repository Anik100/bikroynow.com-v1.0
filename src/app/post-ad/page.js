'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { uploadToImgBB } from '../../lib/imgbb';
import { compressImage } from '../../lib/utils';
import { LOCATIONS, CATEGORIES, getCategoryName } from '../../lib/constants';
import { useLanguage } from '../../context/LanguageContext';
import { Smartphone, Laptop, Zap, Car, Home as HouseIcon, Briefcase, Box, ChevronRight, ChevronDown, Search } from 'lucide-react';
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

const DRAFT_KEY = 'bikroynow_post_ad_draft';

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
  const [authChecking, setAuthChecking] = useState(true);
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
    condition: '',
    contact_phone: '',
    has_whatsapp: true,
    division: '',
    district: '',
  });

  const [imageUrls, setImageUrls] = useState([]);
  const [uploadingSlots, setUploadingSlots] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submittedAdStatus, setSubmittedAdStatus] = useState('pending');
  const [newAdId, setNewAdId] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [customBrandName, setCustomBrandName] = useState('');
  const [modelInput, setModelInput] = useState('');

  const handleBrandOrModelChange = (newBrand, newModel) => {
    const brandVal = newBrand !== undefined ? newBrand : selectedBrand;
    const modelVal = newModel !== undefined ? newModel : modelInput;
    const generatedTitle = [brandVal, modelVal].filter(Boolean).join(' ');
    
    if (generatedTitle) {
      setFormData(prev => ({
        ...prev,
        brand: brandVal,
        model: modelVal,
        title: generatedTitle
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        brand: brandVal,
        model: modelVal
      }));
    }
  };
  const [activeSub, setActiveSub] = useState(null);
  const [displayCategory, setDisplayCategory] = useState('');
  const [subCatSearchQuery, setSubCatSearchQuery] = useState('');
  const [customItemInput, setCustomItemInput] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [monthlyAdsCount, setMonthlyAdsCount] = useState(0);
  const [hasDraftRestored, setHasDraftRestored] = useState(false);
  const draftLoadedRef = useRef(false);

  const resetCategoryWizard = () => {
    setSelectedMainCategory(null);
    setSubCatSearchQuery('');
    setCustomItemInput('');
    setShowOtherInput(false);
  };

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    setFormData({
      title: '',
      description: '',
      category_id: '',
      price: '',
      location: '',
      condition: '',
      contact_phone: '',
      division: '',
      district: '',
    });
    setImageUrls([]);
    setSelectedMainCategory(null);
    setSelectedSubCategory(null);
    setSelectedBrand('');
    setIsCustomBrand(false);
    setCustomBrandName('');
    setModelInput('');
    setDisplayCategory('');
    setCustomItemInput('');
    setShowOtherInput(false);
    setHasDraftRestored(false);
    setError(null);
  };

  // Restore Draft on mount (runs once)
  useEffect(() => {
    if (draftLoadedRef.current || typeof window === 'undefined') return;
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft && typeof draft === 'object') {
          if (draft.formData) {
            setFormData(prev => ({ ...prev, ...draft.formData }));
          }
          if (Array.isArray(draft.imageUrls) && draft.imageUrls.length > 0) {
            setImageUrls(draft.imageUrls);
          }
          if (draft.selectedMainCategory) setSelectedMainCategory(draft.selectedMainCategory);
          if (draft.selectedSubCategory) setSelectedSubCategory(draft.selectedSubCategory);
          if (draft.selectedBrand) setSelectedBrand(draft.selectedBrand);
          if (draft.isCustomBrand !== undefined) setIsCustomBrand(draft.isCustomBrand);
          if (draft.customBrandName) setCustomBrandName(draft.customBrandName);
          if (draft.modelInput) setModelInput(draft.modelInput);
          if (draft.displayCategory) setDisplayCategory(draft.displayCategory);
          if (draft.customItemInput) setCustomItemInput(draft.customItemInput);
          if (draft.showOtherInput !== undefined) setShowOtherInput(draft.showOtherInput);

          const hasSignificantData = Boolean(
            (draft.formData?.title && draft.formData.title.trim()) ||
            draft.formData?.price ||
            draft.formData?.category_id ||
            (draft.imageUrls && draft.imageUrls.length > 0)
          );
          if (hasSignificantData) {
            setHasDraftRestored(true);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore ad draft:', e);
    }
    draftLoadedRef.current = true;
  }, []);

  // Auto-save Draft to localStorage on changes
  useEffect(() => {
    if (!mounted || !draftLoadedRef.current || typeof window === 'undefined') return;
    if (submittedSuccess) return;

    const hasData = Boolean(
      (formData.title && formData.title.trim()) ||
      formData.description ||
      formData.category_id ||
      formData.price ||
      formData.contact_phone ||
      imageUrls.length > 0
    );

    if (!hasData) return;

    try {
      const draft = {
        formData,
        imageUrls,
        selectedMainCategory,
        selectedSubCategory,
        selectedBrand,
        isCustomBrand,
        customBrandName,
        modelInput,
        displayCategory,
        customItemInput,
        showOtherInput,
        savedAt: Date.now()
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn('Failed to save ad draft:', e);
    }
  }, [
    formData,
    imageUrls,
    selectedMainCategory,
    selectedSubCategory,
    selectedBrand,
    isCustomBrand,
    customBrandName,
    modelInput,
    displayCategory,
    customItemInput,
    showOtherInput,
    mounted,
    submittedSuccess
  ]);

  useEffect(() => {
    setMounted(true);
    let isMounted = true;
    const fetchUserAndQuota = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let activeUser = session?.user || null;
        if (!activeUser) {
          try {
            const localUser = localStorage.getItem('bikroynow_demo_user');
            if (localUser) {
              const parsed = JSON.parse(localUser);
              if (parsed?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id)) {
                activeUser = parsed;
              }
            }
          } catch (e) {}
        }
        if (isMounted) setUser(activeUser);

        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('membership_type, membership_expires_at, phone')
            .eq('id', session.user.id)
            .maybeSingle();

          if (isMounted) {
            setUserProfile(profile || { membership_type: 'free' });
            if (profile?.phone) {
              setFormData(prev => prev.contact_phone ? prev : { ...prev, contact_phone: profile.phone });
            }
          }
        } else if (isMounted) {
          setUserProfile({ membership_type: 'free' });
        }
      } catch (err) {
        if (isMounted) {
          setUser(null);
          setUserProfile({ membership_type: 'free' });
        }
      } finally {
        if (isMounted) setAuthChecking(false);
      }
    };
    fetchUserAndQuota();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser(session.user);
        setAuthChecking(false);
      } else {
        setUser(null);
        setAuthChecking(false);
      }
    });

    return () => {
      isMounted = false;
      if (authListener?.subscription) authListener.subscription.unsubscribe();
    };
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

    if (!formData.condition) {
      setError(lang === 'bn' ? '⚠️ অনুগ্রহ করে পণ্যের অবস্থা নির্বাচন করুন (ব্যবহৃত নাকি নতুন)।' : '⚠️ Please select the product condition (Used or New).');
      const condEl = document.getElementById('condition-section');
      if (condEl) {
        condEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
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

      if (!isValidUUID(adUserId)) {
        setSubmitting(false);
        setError(lang === 'bn'
          ? '⚠️ বিজ্ঞাপন পোস্ট করতে অনুগ্রহ করে আপনার অ্যাকাউন্টে লগইন করুন। আপনার তথ্য ড্রাফট হিসেবে সংরক্ষিত আছে।'
          : '⚠️ Please login to your account to post an ad. Your form data is saved as a draft.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => router.push('/login'), 1200);
        return;
      }

      const newAdPayload = {
        id: generateUUID(),
        user_id: adUserId,
        user_email: (user?.email && user.email !== 'user@bikroynow.com') ? user.email : undefined,
        title: formData.title.trim(),
        description: formData.description || '',
        price: parsedPrice,
        category_id: formData.category_id,
        location,
        condition: formData.condition,
        contact_phone: phoneInput || formData.contact_phone || '01700000000',
        has_whatsapp: formData.has_whatsapp !== false,
        images: imageUrls,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      // 1. Post to server-side API endpoint with 12s timeout protection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let data = null;
      try {
        const res = await fetch('/api/post-ad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAdPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        data = await res.json();
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        console.warn('Network delayed on /api/post-ad, activating instant client fallback:', fetchErr);
        data = { success: true, ad: newAdPayload, status: 'pending', fallback: true };
      }

      if (data?.ad?.id) {
        newAdPayload.id = data.ad.id;
        setNewAdId(data.ad.id);
      }
      const finalStatus = data?.status || data?.ad?.status || (data?.autoApproved ? 'active' : 'pending');
      setSubmittedAdStatus(finalStatus);

      // 2. Save to shared public ads pool in localStorage as client fallback
      try {
        const existingPublic = JSON.parse(localStorage.getItem('bikroynow_public_ads') || '[]');
        localStorage.setItem('bikroynow_user_pending_ads', JSON.stringify([newAdPayload, ...existingPublic]));
      } catch (e) {}

      // Clear draft upon successful ad submission
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}
      setHasDraftRestored(false);

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
            {submittedAdStatus === 'active'
              ? (lang === 'bn' ? '🎉 বিজ্ঞাপনটি সফলভাবে সরাসরি লাইভ হয়েছে!' : '🎉 Your Ad is Successfully Live!')
              : (lang === 'bn' ? 'বিজ্ঞাপনটি সফলভাবে জমা দেওয়া হয়েছে!' : 'Ad Submitted for Review!')}
          </h2>
          <p style={{ color: '#475569', fontSize: '0.98rem', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 2rem', fontWeight: 600 }}>
            {submittedAdStatus === 'active'
              ? (lang === 'bn' 
                  ? 'ভেরিফিকেশন ছাড়া সরাসরি আপনার বিজ্ঞাপনটি ওয়েবসাইটে লাইভ হয়ে গেছে। এখনই সবাই এটি দেখতে পাবে!' 
                  : 'Your ad has been published directly and is now live on the website for everyone to see!')
              : (lang === 'bn' 
                  ? 'আপনার বিজ্ঞাপনটি পেন্ডিং এ রয়েছে। অ্যাডমিন প্যানেল থেকে অনুমোদন (Approve) করার পর এটি ওয়েবসাইটে প্রকাশিত হবে।' 
                  : 'Your ad has been submitted and is currently pending. It will be published after admin approval.')}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {submittedAdStatus === 'active' && newAdId && (
              <Link href={`/ad/${newAdId}`} className={styles.submitBtn} style={{ width: 'auto', padding: '0.75rem 2rem', fontSize: '0.95rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
                {lang === 'bn' ? 'বিজ্ঞাপনটি দেখুন' : 'View Ad'}
              </Link>
            )}
            <Link href="/" className={styles.submitBtn} style={{ width: 'auto', padding: '0.75rem 2rem', fontSize: '0.95rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {lang === 'bn' ? 'হোম পেজে যান' : 'Go to Homepage'}
            </Link>
            <button 
              type="button" 
              onClick={() => {
                setSubmittedSuccess(false);
                setFormData({ title: '', category_id: '', division: '', district: '', condition: '', price: '', description: '', contact_phone: '' });
                setImageUrls([]);
                setDisplayCategory('');
                try { localStorage.removeItem(DRAFT_KEY); } catch(e){}
                setHasDraftRestored(false);
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

  if (authChecking) {
    return (
      <div className={styles.postContainer}>
        <div className={styles.postCard} style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#64748b' }}>
            {t('loading')}
          </div>
        </div>
      </div>
    );
  }

  if (!user || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(user.id || ''))) {
    return (
      <div className={styles.postContainer}>
        <div className={styles.postCard} style={{ textAlign: 'center', padding: '3rem 1.5rem', maxWidth: '520px', margin: '1rem auto' }}>
          <div style={{
            width: '68px', height: '68px', borderRadius: '50%',
            background: '#fff7ed', color: '#ea580c',
            border: '2px solid #fed7aa',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem', fontSize: '1.9rem'
          }}>
            🔒
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.65rem' }}>
            {lang === 'bn' ? 'বিজ্ঞাপন পোস্ট করতে লগইন করুন' : 'Account Required to Post an Ad'}
          </h1>
          <p style={{ fontSize: '0.94rem', color: '#475569', lineHeight: 1.55, marginBottom: '1.75rem' }}>
            {lang === 'bn'
              ? 'নিরাপদ কেনাবেচা নিশ্চিত করতে অ্যাকাউন্ট ছাড়া কোনো বিজ্ঞাপন পোস্ট করা যাবে না। মাত্র ১ ক্লিকে Google অ্যাকাউন্ট দিয়ে প্রবেশ করুন।'
              : 'To keep our marketplace safe and trusted, you must sign in with an account before posting an ad.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            <Link
              href="/login?redirect=/post-ad"
              className={styles.submitBtn}
              style={{
                width: '100%', maxWidth: '320px', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
              }}
            >
              <span>{lang === 'bn' ? 'Google দিয়ে লগইন / অ্যাকাউন্ট করুন' : 'Sign In / Create Account'}</span>
            </Link>
            <Link
              href="/"
              style={{ fontSize: '0.88rem', fontWeight: 700, color: '#64748b', textDecoration: 'none', marginTop: '0.25rem' }}
            >
              {lang === 'bn' ? '← হোম পেজে ফিরে যান' : '← Back to Homepage'}
            </Link>
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

        {hasDraftRestored && (
          <div style={{
            background: '#f0fdf4',
            border: '1.5px solid #86efac',
            borderRadius: '12px',
            padding: '0.85rem 1.1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.3rem' }}>💾</span>
              <div>
                <strong style={{ display: 'block', fontSize: '0.9rem', color: '#166534' }}>
                  {lang === 'bn' ? 'আগের খসড়া (Draft) স্বয়ংক্রিয়ভাবে ফিরে এসেছে!' : 'Previous Draft Restored!'}
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#15803d' }}>
                  {lang === 'bn' ? 'আপনার আগের লেখা তথ্য ও ছবিগুলো সংরক্ষিত রয়েছে। সরাসরি পোস্ট করতে পারেন।' : 'All previously filled data & images are preserved.'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearDraft}
              style={{
                background: '#ffffff',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 750,
                color: '#dc2626',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {lang === 'bn' ? '🗑️ ড্রাফট মুছুন' : '🗑️ Clear Draft'}
            </button>
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

          {/* ক্যাটাগরি সিলেক্ট করার পর ব্র্যান্ড এবং মডেল ফিল্ড */}
          {selectedSubCategory && (
            <div className={styles.brandModelRow}>
              {/* BRAND / PARTS SELECTION */}
              <div className={styles.fieldGroup}>
                <label className={styles.premiumLabel}>
                  {selectedSubCategory === 'mobile_parts_components' 
                    ? (lang === 'bn' ? 'যন্ত্রাংশ / পার্টসের ধরন নির্বাচন করুন' : 'Select Part / Component Type')
                    : (selectedSubCategory === 'mobile_accessories'
                        ? (lang === 'bn' ? 'এক্সেসরিজের ধরন নির্বাচন করুন' : 'Select Accessory Type')
                        : (selectedSubCategory === 'batteries'
                            ? (lang === 'bn' ? 'ব্যাটারির ধরন বা সেল নির্বাচন করুন' : 'Select Battery / Cell Type')
                            : (lang === 'bn' ? 'ব্র্যান্ড / ধরন নির্বাচন করুন' : 'Select Brand / Type')
                          )
                      )
                  }
                </label>
                {!isCustomBrand ? (
                  <div className={styles.selectWrapper}>
                    <select
                      className={styles.premiumSelect}
                      value={selectedBrand}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomBrand(true);
                          setSelectedBrand('');
                        } else {
                          setSelectedBrand(val);
                          handleBrandOrModelChange(val, undefined);
                        }
                      }}
                    >
                      <option value="">
                        {selectedSubCategory === 'mobile_parts_components'
                          ? (lang === 'bn' ? '-- পার্টস নির্বাচন করুন --' : '-- Select Part --')
                          : (selectedSubCategory === 'batteries'
                              ? (lang === 'bn' ? '-- ব্যাটারির ধরন নির্বাচন করুন --' : '-- Select Battery Type --')
                              : (lang === 'bn' ? '-- নির্বাচন করুন --' : '-- Select Option --')
                            )
                        }
                      </option>
                      {(() => {
                        const parentCat = Object.keys(CATEGORIES).find(k => CATEGORIES[k][selectedSubCategory]);
                        const brands = CATEGORIES[parentCat]?.[selectedSubCategory]?.brands || [];
                        return brands.map(b => <option key={b} value={b}>{b}</option>);
                      })()}
                      <option value="__custom__">➕ {lang === 'bn' ? 'অন্যান্য (তালিকায় নেই)' : 'Other (Not in list)'}</option>
                    </select>
                  </div>
                ) : (
                  <div className={styles.customBrandInputWrap}>
                    <input
                      type="text"
                      className={styles.premiumInput}
                      placeholder={lang === 'bn' ? 'পার্টস বা ব্র্যান্ডের নাম লিখুন...' : 'Enter part or brand name...'}
                      value={customBrandName}
                      onChange={(e) => {
                        setCustomBrandName(e.target.value);
                        setSelectedBrand(e.target.value);
                        handleBrandOrModelChange(e.target.value, undefined);
                      }}
                    />
                    <button
                      type="button"
                      className={styles.cancelCustomBtn}
                      onClick={() => {
                        setIsCustomBrand(false);
                        setCustomBrandName('');
                        setSelectedBrand('');
                        handleBrandOrModelChange('', undefined);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* MODEL NUMBER INPUT - কোনো ডেমো নাম ছাড়া সম্পূর্ণ ক্লিন */}
              {(() => {
                const parentCat = Object.keys(CATEGORIES).find(k => CATEGORIES[k][selectedSubCategory]);
                const hasModel = CATEGORIES[parentCat]?.[selectedSubCategory]?.hasModel;
                if (!hasModel) return null;
                return (
                  <div className={styles.fieldGroup}>
                    <label className={styles.premiumLabel}>
                      {lang === 'bn' ? 'মডেল' : 'Model'}
                    </label>
                    <input
                      type="text"
                      className={styles.premiumInput}
                      placeholder={lang === 'bn' ? 'মডেল লিখুন...' : 'Enter Model...'}
                      value={modelInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setModelInput(val);
                        handleBrandOrModelChange(undefined, val);
                      }}
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {/* PRODUCT TITLE / AD TITLE - কোনো ডেমো নাম ছাড়া সম্পূর্ণ ক্লিন */}
          <div className={styles.titleSectionGroup}>
            <label className={styles.premiumLabel}>
              {lang === 'bn' ? 'বিজ্ঞাপনের শিরোনাম (Ad Title) *' : 'Ad Title *'}
            </label>
            <input
              type="text"
              name="title"
              className={styles.premiumTitleInput}
              placeholder={lang === 'bn' ? 'বিজ্ঞাপনের শিরোনাম লিখুন...' : 'Enter Ad Title...'}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
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
            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '0.65rem',
              cursor: 'pointer',
              fontSize: '0.88rem',
              color: '#334155',
              fontWeight: 650,
              background: '#f8fafc',
              padding: '0.45rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              userSelect: 'none'
            }}>
              <input 
                type="checkbox"
                checked={formData.has_whatsapp !== false}
                onChange={e => setFormData({ ...formData, has_whatsapp: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: '#25D366', cursor: 'pointer' }}
              />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {lang === 'bn' ? 'এই নম্বরে WhatsApp আছে' : 'This number is on WhatsApp'}
              </span>
            </label>
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
          <div
            id="condition-section"
            className={styles.inputGroup}
            style={!formData.condition && error && (error.includes('অবস্থা') || error.includes('condition')) ? {
              border: '1.5px solid #ef4444',
              padding: '0.75rem',
              borderRadius: '10px',
              backgroundColor: '#fef2f2'
            } : {}}
          >
            <label className={styles.label}>
              {t('condition')} <span style={{ color: '#ef4444', fontWeight: 900 }}>*</span>
            </label>
            <div className={styles.conditionRow}>
              <button type="button"
                className={`${styles.conditionBtn} ${formData.condition === 'Used' ? styles.conditionBtnActive : ''}`}
                onClick={() => {
                  setFormData({ ...formData, condition: 'Used' });
                  if (error && (error.includes('অবস্থা') || error.includes('condition'))) setError(null);
                }}
              >{t('used')}</button>
              <button type="button"
                className={`${styles.conditionBtn} ${formData.condition === 'New' ? styles.conditionBtnActive : ''}`}
                onClick={() => {
                  setFormData({ ...formData, condition: 'New' });
                  if (error && (error.includes('অবস্থা') || error.includes('condition'))) setError(null);
                }}
              >{t('new')}</button>
            </div>
            {!formData.condition && error && (error.includes('অবস্থা') || error.includes('condition')) && (
              <p style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.45rem', fontWeight: 700, marginBottom: 0 }}>
                {lang === 'bn' ? '⚠️ অনুগ্রহ করে যেকোনো একটি নির্বাচন করুন (ব্যবহৃত অথবা নতুন)' : '⚠️ Please select one (Used or New)'}
              </p>
            )}
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
                  resetCategoryWizard();
                }}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              {!selectedMainCategory ? (
                /* Step 1: মূল ক্যাটাগরি */
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
                /* Step 2: সাব-ক্যাটাগরি এবং নির্বাচন সম্পন্ন */
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
                          const mainName = getCategoryName(selectedMainCategory, lang);
                          const subName = getCategoryName(subKey, lang);
                          
                          setSelectedSubCategory(subKey);
                          setSelectedBrand('');
                          setModelInput('');
                          setFormData(prev => ({ 
                            ...prev, 
                            category_id: subKey,
                            brand: '',
                            model: ''
                          }));
                          setDisplayCategory(`${mainName} › ${subName}`);
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