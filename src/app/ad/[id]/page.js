'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabaseClient';
import styles from './ad-details.module.css';
import { MapPin, Clock, Phone, User as UserIcon, ShieldCheck, Heart, Share2, ChevronLeft, ChevronRight, Trash2, Star, Edit, Check, X } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '../../../context/LanguageContext';
import { getRelativeTime, formatFullDate, formatPrice, getPromotionBadgeText } from '../../../lib/utils';

const getSellerBadge = (profile, lang) => {
  if (!profile) return null;
  const expiresAt = profile.membership_expires_at ? new Date(profile.membership_expires_at) : null;
  const isNotExpired = !expiresAt || new Date() < expiresAt;

  if (profile.membership_type && profile.membership_type !== 'free' && isNotExpired) {
    const name = profile.membership_type.toLowerCase();
    let badgeStyle = {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: 'white',
      border: '1px solid #34d399'
    };
    let label = profile.membership_type;

    if (name.includes('silver')) {
      badgeStyle = {
        background: 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)',
        color: '#334155',
        border: '1px solid #cbd5e1'
      };
      label = lang === 'bn' ? 'সিলভার মেম্বার' : 'Silver Member';
    } else if (name.includes('gold')) {
      badgeStyle = {
        background: 'linear-gradient(135deg, #fef08a 0%, #ca8a04 100%)',
        color: '#713f12',
        border: '1px solid #fde047'
      };
      label = lang === 'bn' ? 'গোল্ড মেম্বার' : 'Gold Member';
    } else if (name.includes('business')) {
      badgeStyle = {
        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        color: 'white',
        border: '1px solid #60a5fa'
      };
      label = lang === 'bn' ? 'বিজনেস মেম্বার' : 'Business Member';
    } else {
      if (lang === 'bn') {
        const translations = {
          '3-day express boost': '৩ দিনের এক্সপ্রেস বুস্ট',
          '7-day premium boost': '৭ দিনের প্রিমিয়াম বুস্ট',
          '15-day mega boost': '১৫ দিনের মেগা বুস্ট'
        };
        label = translations[name] || label;
      }
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '0.62rem',
        fontWeight: 800,
        padding: '0.15rem 0.4rem',
        borderRadius: '5px',
        marginTop: '0.25rem',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        gap: '0.15rem',
        ...badgeStyle
      }}>
        🛡️ {label}
      </span>
    );
  }
  return null;
};

const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export default function AdDetails({ params }) {
  const routeParams = useParams();
  const effectiveId = routeParams?.id || params?.id;
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [ad, setAd] = useState(null);
  const [profile, setProfile] = useState(null);
  const [similarAds, setSimilarAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingChat, setSendingChat] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentUser, setCurrentUser] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [showAdminDeleteModal, setShowAdminDeleteModal] = useState(false);
  const [adminActionMessage, setAdminActionMessage] = useState(null);
  const touchStartRef = useRef({ distance: 0, x: 0, y: 0 });
  
  // Favorites state
  const [isFavorite, setIsFavorite] = useState(false);

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setScale(prev => Math.min(3, prev + 0.25));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setScale(prev => {
      const next = prev - 0.25;
      if (next <= 1) {
        setPosition({ x: 0, y: 0 });
        return 1;
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const closeLightboxModal = () => {
    setShowLightbox(false);
    handleResetZoom();
  };

  // Dragging / Panning logic
  const handleMouseDown = (e) => {
    if (scale === 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch logic for mobile (supporting pinch-to-zoom, pan, and swipe navigation)
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      touchStartRef.current = { distance: dist, x: midX, y: midY, initialScale: scale, initialOffset: { ...position } };
      setIsDragging(false);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
      // Record starting touch coordinates for swipe gesture detection
      touchStartRef.current.startX = touch.clientX;
      touchStartRef.current.startY = touch.clientY;
      touchStartRef.current.startTime = Date.now();
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && touchStartRef.current.distance > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartRef.current.distance;
      const newScale = Math.max(1, Math.min(4, touchStartRef.current.initialScale * factor));
      setScale(newScale);
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      const touch = e.touches[0];
      setPosition({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
    }
  };

  const handleTouchEnd = (e) => {
    setIsDragging(false);

    // Swipe gesture navigation on mobile (only when scale is normal/unzoomed)
    if (scale === 1 && touchStartRef.current.startX !== undefined && e.changedTouches && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const diffX = touch.clientX - touchStartRef.current.startX;
      const diffY = touch.clientY - touchStartRef.current.startY;
      const timeDiff = Date.now() - touchStartRef.current.startTime;

      // Swipe detection rules: minimum 60px horizontal move, maximum 100px vertical move, within 300ms
      if (ad.images && ad.images.length > 1 && Math.abs(diffX) > 60 && Math.abs(diffY) < 100 && timeDiff < 300) {
        if (diffX > 0) {
          // Swiped right -> go to previous image
          setActiveImage(prev => prev > 0 ? prev - 1 : ad.images.length - 1);
        } else {
          // Swiped left -> go to next image
          setActiveImage(prev => prev < ad.images.length - 1 ? prev + 1 : 0);
        }
        handleResetZoom();
      }
    }

    if (scale <= 1.05) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
    touchStartRef.current = { distance: 0, x: 0, y: 0, startX: undefined, startY: undefined, startTime: 0 };
  };

  const handleAdminApprove = async () => {
    try {
      const currentTime = new Date().toISOString();
      if (isValidUUID(ad.id)) {
        const { error } = await supabase.from('listings').update({ 
          status: 'active',
          created_at: currentTime
        }).eq('id', ad.id);
        if (error) throw error;
      }
      
      try {
        const localAds = JSON.parse(localStorage.getItem('bikroynow_public_ads') || '[]');
        const updated = localAds.map(l => String(l.id) === String(ad.id) ? { ...l, status: 'active', created_at: currentTime } : l);
        localStorage.setItem('bikroynow_public_ads', JSON.stringify(updated));
      } catch (e) {}

      setAdminActionMessage({ type: 'success', text: lang === 'bn' ? 'বিজ্ঞাপনটি সফলভাবে অ্যাপ্রুভ করা হয়েছে।' : 'Ad approved successfully.' });
      setAd(prev => ({ ...prev, status: 'active', created_at: currentTime }));
    } catch (err) {
      setAdminActionMessage({ type: 'error', text: 'Error approving ad: ' + err.message });
    }
  };

  const handleAdminVerify = async () => {
    try {
      const nextVerify = !ad.is_verified;
      const updates = {
        is_verified: nextVerify,
        created_at: new Date().toISOString()
      };
      if (isValidUUID(ad.id)) {
        const { error } = await supabase.from('listings').update(updates).eq('id', ad.id);
        if (error) throw error;
      }

      try {
        const localAds = JSON.parse(localStorage.getItem('bikroynow_public_ads') || '[]');
        const updated = localAds.map(l => String(l.id) === String(ad.id) ? { ...l, ...updates } : l);
        localStorage.setItem('bikroynow_public_ads', JSON.stringify(updated));
      } catch (e) {}

      setAdminActionMessage({ type: 'success', text: lang === 'bn' ? 'বিজ্ঞাপনটি সফলভাবে আপডেট ও সবার ওপরে প্রমোট করা হয়েছে!' : 'Ad successfully updated and promoted to the very top!' });
      setAd(prev => ({ ...prev, is_verified: nextVerify, created_at: updates.created_at }));
    } catch (err) {
      setAdminActionMessage({ type: 'error', text: 'Error verifying ad: ' + err.message });
    }
  };

  const handleAdminDelete = () => {
    setShowAdminDeleteModal(true);
  };

  const executeAdminDelete = async () => {
    try {
      if (isValidUUID(ad.id)) {
        const { error } = await supabase.from('listings').delete().eq('id', ad.id);
        if (error) throw error;
      }

      // Also clean up from local storage
      try {
        const localAds = JSON.parse(localStorage.getItem('bikroynow_public_ads') || '[]');
        const filtered = localAds.filter(l => String(l.id) !== String(ad.id));
        localStorage.setItem('bikroynow_public_ads', JSON.stringify(filtered));
      } catch (e) {}

      // Also delete from featured store API
      try {
        await fetch(`/api/admin/featured-ads?listing_id=${ad.id}`, { method: 'DELETE' });
      } catch (e) {}

      router.push('/');
    } catch (err) {
      setAdminActionMessage({ type: 'error', text: 'Error deleting ad: ' + err.message });
      setShowAdminDeleteModal(false);
    }
  };

  useEffect(() => {
    if (!effectiveId) {
      setLoading(false);
      return;
    }

    const fetchAdData = async () => {
      try {
        let adData = null;
        const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        // 1. If valid UUID, query Supabase DB
        if (isValidUUID(effectiveId)) {
          const { data, error } = await supabase
            .from('listings')
            .select('*')
            .eq('id', effectiveId)
            .maybeSingle();
          if (data) adData = data;
        }

        // 2. Fetch from /api/listings (handling both array & { listings: [] })
        if (!adData) {
          try {
            const res = await fetch(`/api/listings?t=${Date.now()}`);
            if (res.ok) {
              const resJson = await res.json();
              const allListings = Array.isArray(resJson) ? resJson : (resJson?.listings || []);
              adData = allListings.find(l => String(l.id) === String(effectiveId)) || null;
            }
          } catch (e) {}
        }

        // 3. Fallback to localStorage
        if (!adData) {
          try {
            const localAds = JSON.parse(localStorage.getItem('bikroynow_public_ads') || '[]');
            adData = localAds.find(l => String(l.id) === String(effectiveId)) || null;
          } catch (e) {}
        }

        if (!adData) {
          setLoading(false);
          return;
        }

        setAd(adData);

        // Fetch similar ads based on category
        if (adData?.category_id) {
          try {
            let { data: similarAdsData } = await supabase
              .from('listings')
              .select('*')
              .eq('category_id', adData.category_id)
              .neq('status', 'pending')
              .neq('id', adData.id)
              .order('created_at', { ascending: false })
              .limit(4);
            if (similarAdsData) setSimilarAds(similarAdsData);
          } catch (e) {}
        }

        // Fetch Profile separately if user_id is valid UUID
        if (adData?.user_id && isValidUUID(adData.user_id)) {
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', adData.user_id)
              .maybeSingle();
            if (profileData) setProfile(profileData);
          } catch (e) {}
        }
      } catch (err) {
        console.error('Fetch Error:', err);
      } finally {
        setLoading(false);
      }
    };

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let activeUser = session?.user;
      if (!activeUser) {
        try {
          const localUser = localStorage.getItem('bikroynow_demo_user');
          if (localUser) activeUser = JSON.parse(localUser);
        } catch (e) {}
      }
      setCurrentUser(activeUser || null);
      if (activeUser && effectiveId) {
        try {
          const { data } = await supabase
            .from('favorites')
            .select('*')
            .eq('user_id', activeUser.id)
            .eq('listing_id', effectiveId)
            .maybeSingle();
          if (data) setIsFavorite(true);
        } catch (e) {}
      }
    };

    checkUser();
    fetchAdData();
  }, [effectiveId]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      let activeUser = session?.user;
      if (!activeUser) {
        try {
          const localUser = localStorage.getItem('bikroynow_demo_user');
          if (localUser) activeUser = JSON.parse(localUser);
        } catch (e) {}
      }
      if (activeUser) {
        setCurrentUser(activeUser);
        if (effectiveId) {
          try {
            const { data } = await supabase
              .from('favorites')
              .select('*')
              .eq('user_id', activeUser.id)
              .eq('listing_id', effectiveId)
              .maybeSingle();
            if (data) setIsFavorite(true);
          } catch (e) {}
        }
      } else {
        setCurrentUser(null);
        setIsFavorite(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [effectiveId]);

  const toggleFavorite = async () => {
    if (!currentUser) {
      alert(lang === 'bn' ? 'প্রিয় বিজ্ঞাপনের তালিকা ব্যবহার করতে অনুগ্রহ করে লগইন করুন।' : 'Please login to use favorites.');
      return;
    }

    // Optimistic UI Update: turn it red/empty instantly
    setIsFavorite(prev => !prev);

    if (isFavorite) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('listing_id', ad.id);
      if (error) {
        // Revert on error
        setIsFavorite(true);
        console.error('Error removing favorite:', error);
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: currentUser.id, listing_id: ad.id });
      if (error) {
        // Revert on error
        setIsFavorite(false);
        console.error('Error adding favorite:', error);
      }
    }
  };

  if (loading) return <div className="container" style={{padding: '5rem 0', textAlign: 'center'}}>{t('loading')}</div>;
  if (!ad) return <div className="container" style={{padding: '5rem 0', textAlign: 'center'}}>{t('noAds')}</div>;

  return (
    <div className={styles.pageWrapper}>
      {ad && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: ad.title,
              image: Array.isArray(ad.images) && ad.images.length > 0 ? ad.images : undefined,
              description: ad.description || ad.title,
              category: ad.category_id,
              offers: {
                '@type': 'Offer',
                url: `https://bikroynow.com/ad/${ad.id}`,
                priceCurrency: 'BDT',
                price: ad.price || '0',
                itemCondition: ad.condition === 'Used' ? 'https://schema.org/UsedCondition' : 'https://schema.org/NewCondition',
                availability: ad.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                seller: {
                  '@type': 'Person',
                  name: profile?.full_name || 'BikroyNow Seller',
                },
              },
            })
          }}
        />
      )}

      {adminActionMessage && (
        <div className="container" style={{ paddingTop: '1rem' }}>
          <div style={{ background: adminActionMessage.type === 'error' ? '#fef2f2' : '#f0fdf4', color: adminActionMessage.type === 'error' ? '#991b1b' : '#166534', padding: '1rem', borderRadius: '8px', border: `1px solid ${adminActionMessage.type === 'error' ? '#fecaca' : '#bbf7d0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{adminActionMessage.text}</span>
            <button onClick={() => setAdminActionMessage(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>
        </div>
      )}

      {showAdminDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '2rem',
            maxWidth: '360px', width: '100%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111' }}>
              {lang === 'bn' ? 'ডিলিট করবেন?' : 'Delete Ad?'}
            </h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {lang === 'bn' ? 'এই বিজ্ঞাপনটি স্থায়ীভাবে মুছে যাবে।' : 'This ad will be permanently deleted.'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowAdminDeleteModal(false)}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '10px',
                  border: '1px solid #e5e7eb', background: 'white',
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
                  color: '#4b5563'
                }}
              >
                {lang === 'bn' ? 'না' : 'Cancel'}
              </button>
              <button
                onClick={executeAdminDelete}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '10px',
                  border: 'none', background: '#dc2626',
                  color: 'white', fontWeight: 700, cursor: 'pointer',
                  fontSize: '0.95rem', transition: 'background 0.2s'
                }}
              >
                {lang === 'bn' ? 'হ্যাঁ' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {ad.status === 'pending' && (
        <div className="container" style={{ paddingTop: '1rem' }}>
          <div style={{
            background: '#fffbeb',
            color: '#b45309',
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            border: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.92rem',
            fontWeight: 500,
            lineHeight: 1.5,
            boxShadow: '0 2px 10px rgba(245, 158, 11, 0.05)'
          }}>
            <span style={{ fontSize: '1.25rem' }}>⏳</span>
            <div>
              <strong>{lang === 'bn' ? 'বিজ্ঞাপনটি পেন্ডিং অবস্থায় আছে!' : 'Ad is Pending Approval!'}</strong>{' '}
              {lang === 'bn' 
                ? 'আপনার বিজ্ঞাপনটি সফলভাবে পোস্ট করা হয়েছে। এটি বর্তমানে এডমিন অনুমোদনের অপেক্ষায় আছে। দয়া করে এডমিন এপ্রুভালের জন্য অপেক্ষা করুন।' 
                : 'Your ad is currently awaiting review by our moderation team. Please wait for admin approval before it goes public.'}
            </div>
          </div>
        </div>
      )}

      <div className={`container ${styles.detailsContainer}`}>
        <div className={styles.mainContent}>
          <div className={styles.card}>
            <div className={styles.gallerySection}>
              {/* Floating Favorite Heart Button */}
              <button 
                className={`${styles.favoriteBtn} ${isFavorite ? styles.active : ''}`}
                onClick={toggleFavorite}
                title={isFavorite ? (lang === 'bn' ? 'প্রিয় তালিকা থেকে বাদ দিন' : 'Remove from Favorites') : (lang === 'bn' ? 'প্রিয় তালিকায় যোগ করুন' : 'Add to Favorites')}
              >
                <Heart 
                  size={22} 
                  fill={isFavorite ? "#ef4444" : "none"} 
                  color={isFavorite ? "#ef4444" : "#64748b"} 
                />
              </button>
              <div className={styles.mainImageWrapper}>
                {ad.images && ad.images.length > 0 ? (
                  <img 
                    src={ad.images[activeImage]} 
                    alt={ad.title} 
                    className={styles.mainImage} 
                    onClick={() => setShowLightbox(true)}
                    title={lang === 'bn' ? 'বড় করে দেখতে ক্লিক করুন' : 'Click to zoom'}
                  />
                ) : (
                  <div className={styles.noImage}>{t('noImage')}</div>
                )}
                
                {ad.images && ad.images.length > 1 && (
                  <>
                    <button 
                      className={styles.navBtn + ' ' + styles.prev}
                      onClick={() => setActiveImage(prev => prev > 0 ? prev - 1 : ad.images.length - 1)}
                    >
                      <ChevronLeft />
                    </button>
                    <button 
                      className={styles.navBtn + ' ' + styles.next}
                      onClick={() => setActiveImage(prev => prev < ad.images.length - 1 ? prev + 1 : 0)}
                    >
                      <ChevronRight />
                    </button>
                  </>
                )}
              </div>
              
              <div className={styles.thumbnails}>
                {ad.images?.map((img, i) => (
                  <div 
                    key={i} 
                    className={`${styles.thumbWrapper} ${activeImage === i ? styles.activeThumb : ''}`}
                    onClick={() => setActiveImage(i)}
                  >
                    <img src={img} alt={`Thumbnail ${i}`} />
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.infoSection}>
              <div className={styles.header}>
                {ad.is_verified && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#fef08a', color: '#854d0e', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: '0 2px 4px rgba(234, 179, 8, 0.2)' }}>
                    ★ {getPromotionBadgeText(ad.promotion_type, lang)}
                  </div>
                )}
                <h1 className={styles.title}>{ad.title}</h1>
                <div className={styles.price}>{formatPrice(ad.price, lang)}</div>
                <div className={styles.meta}>
                  <span><MapPin size={16}/> {ad.location}</span>
                  <span title={formatFullDate(ad.created_at, lang)}>
                    <Clock size={16}/> {getRelativeTime(ad.created_at, lang)}
                  </span>
                </div>
              </div>

              <div className={styles.divider}></div>

              <div className={styles.attributes}>
                <div className={styles.attrItem}>
                  <span className={styles.attrLabel}>{t('condition')}</span>
                  <span className={styles.attrValue}>{t(ad.condition?.toLowerCase())}</span>
                </div>
                <div className={styles.attrItem}>
                  <span className={styles.attrLabel}>{t('category')}</span>
                  <span className={styles.attrValue}>{ad.category_id}</span>
                </div>
              </div>

               <div className={styles.description}>
                 <h3>{t('description')}</h3>
                 <p>{ad.description}</p>
                 <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#888', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                   {t('postedOn')} {formatFullDate(ad.created_at, lang)}
                 </div>
               </div>
            </div>
          </div>

          {/* Similar Ads Section */}
          {similarAds.length > 0 && (
            <div className={styles.similarAdsSection}>
              <h3>{lang === 'bn' ? 'একই ক্যাটাগরির আরও বিজ্ঞাপন' : 'Similar Ads'}</h3>
              <div className={styles.similarAdsGrid}>
                {similarAds.map(similarAd => (
                  <Link href={`/ad/${similarAd.id}`} key={similarAd.id} className={styles.similarAdCard}>
                    <img 
                      src={similarAd.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image'} 
                      alt={similarAd.title} 
                      className={styles.similarAdImg}
                    />
                    <div className={styles.similarAdInfo}>
                      <div className={styles.similarAdTitle}>{similarAd.title}</div>
                      <div className={styles.similarAdPrice}>{formatPrice(similarAd.price, lang)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.sidebar}>
          {currentUser && currentUser.email === 'anikh0000@gmail.com' && (
            <div className={styles.card} style={{ border: '2.5px dashed #d97706', background: '#fffbeb', marginBottom: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(217, 119, 6, 0.1)' }}>
              <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <ShieldCheck size={22} color="#d97706" />
                  <h3 style={{ color: '#d97706', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                    {lang === 'bn' ? 'অ্যাডমিন অ্যাকশন প্যানেল' : 'Admin Control Panel'}
                  </h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>Status: <strong style={{ color: ad.status === 'pending' ? '#d97706' : '#16a34a' }}>{ad.status?.toUpperCase()}</strong></span>
                    <span>Verified: <strong>{ad.is_verified ? 'Yes' : 'No'}</strong></span>
                  </div>

                  {ad.status === 'pending' && (
                    <button 
                      onClick={handleAdminApprove}
                      style={{ 
                        background: '#10b981', 
                        color: 'white', 
                        border: 'none', 
                        padding: '0.6rem 1rem', 
                        borderRadius: '8px', 
                        fontWeight: 700, 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        fontSize: '0.9rem'
                      }}
                    >
                      <Check size={16} /> Approve Listing
                    </button>
                  )}

                  {ad.status === 'active' && (
                    <button 
                      onClick={handleAdminVerify}
                      style={{ 
                        background: ad.is_verified ? '#eab308' : '#fef08a', 
                        color: ad.is_verified ? 'white' : '#854d0e', 
                        border: '1px solid #fde047', 
                        padding: '0.6rem 1rem', 
                        borderRadius: '8px', 
                        fontWeight: 700, 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        fontSize: '0.9rem'
                      }}
                    >
                      <Star size={16} fill={ad.is_verified ? "currentColor" : "none"} />
                      {ad.is_verified ? 'Remove Verification' : 'Promote & Highlight'}
                    </button>
                  )}

                  <Link 
                    href={`/edit-ad/${ad.id}`}
                    style={{ 
                      background: '#2563eb', 
                      color: 'white', 
                      border: 'none', 
                      padding: '0.6rem 1rem', 
                      borderRadius: '8px', 
                      fontWeight: 700, 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      fontSize: '0.9rem',
                      textDecoration: 'none'
                    }}
                  >
                    <Edit size={16} /> {lang === 'bn' ? 'বিজ্ঞাপন এডিট করুন' : 'Edit Ad (Full Permissions)'}
                  </Link>

                  <button 
                    onClick={handleAdminDelete}
                    style={{ 
                      background: '#ef4444', 
                      color: 'white', 
                      border: 'none', 
                      padding: '0.6rem 1rem', 
                      borderRadius: '8px', 
                      fontWeight: 700, 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      fontSize: '0.9rem'
                    }}
                  >
                    <Trash2 size={16} /> Delete Listing (Remove)
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={styles.card}>
            <div className={styles.sellerCard}>
              <div className={styles.sellerHeader}>
                <div className={styles.avatar}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} />
                  ) : (
                    <UserIcon size={30} color="#666" />
                  )}
                </div>
                <div>
                    <h3 className={styles.sellerName} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      {profile?.full_name || t('verifiedSeller')}
                      {getSellerBadge(profile, lang)}
                    </h3>
                    <p className={styles.memberSince}>{t('memberSince')} {profile?.created_at ? new Date(profile.created_at).getFullYear() : '2024'}</p>
                </div>
              </div>
              
              <div className={styles.contactActions}>
                <a href={`tel:${ad.contact_phone}`} className={styles.phoneBtn} style={{ textDecoration: 'none' }}>
                  <Phone size={20} />
                  <span>{ad.contact_phone || t('showPhone')}</span>
                </a>
                <button 
                  className={styles.chatBtn}
                  disabled={sendingChat}
                  onClick={async () => {
                    setSendingChat(true);
                    try {
                      let activeUser = null;
                      const { data: { session } } = await supabase.auth.getSession();
                      if (session?.user) {
                        activeUser = session.user;
                      } else {
                        try {
                          const localUser = localStorage.getItem('bikroynow_demo_user');
                          if (localUser) activeUser = JSON.parse(localUser);
                        } catch (e) {}
                      }

                      if (!activeUser) {
                        router.push('/login');
                        return;
                      }
                      
                      const isOwnAd = activeUser.id === ad.user_id || 
                        (activeUser.email && profile?.email && activeUser.email.toLowerCase() === profile.email.toLowerCase());
                      if (isOwnAd) {
                        alert(lang === 'bn' ? 'আপনি নিজের বিজ্ঞাপনে চ্যাট করতে পারবেন না।' : 'You cannot chat on your own ad.');
                        return;
                      }

                      // Call server-side chats API to create or get chat session
                      const chatRes = await fetch('/api/chats', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          listing_id: ad.id,
                          buyer_id: activeUser.id,
                          seller_id: ad.user_id || 'seller-business-1'
                        })
                      });

                      if (chatRes.ok) {
                        const chatJson = await chatRes.json();
                        if (chatJson.id) {
                          router.push(`/chat/${chatJson.id}`);
                          return;
                        }
                      }

                      throw new Error(lang === 'bn' ? 'সার্ভার চ্যাট তৈরি করতে ব্যর্থ হয়েছে।' : 'Failed to create chat session on server.');
                    } catch (err) {
                      console.error('Chat error full:', err);
                      alert((lang === 'bn' ? 'চ্যাট শুরু করতে সমস্যা হয়েছে: ' : 'Error starting chat: ') + err.message);
                    } finally {
                      setSendingChat(false);
                    }
                  }}
                >
                  {sendingChat ? '...' : t('chatWithSeller')}
                </button>
              </div>
            </div>
          </div>

          <div className={`${styles.card} ${styles.safetyCard}`}>
            <div className={styles.safetyHeader}>
              <ShieldCheck size={20} color="#008b5e" />
              <h3>{t('safetyTips')}</h3>
            </div>
            <ul className={styles.safetyList}>
              <li>{t('safetyTip1')}</li>
              <li>{t('safetyTip3')}</li>
              <li>{t('safetyTip2')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Image Preview Modal (Lightbox) */}
      {isMounted && showLightbox && ad.images && ad.images.length > 0 && createPortal(
        <div className={styles.lightbox} onClick={closeLightboxModal}>
          {/* Custom Zoom Controls */}
          <div className={styles.zoomControls} onClick={e => e.stopPropagation()}>
            <button className={styles.zoomBtn} onClick={handleZoomIn} title="Zoom In">+</button>
            <button className={styles.zoomBtn} onClick={handleZoomOut} title="Zoom Out">-</button>
            <button className={styles.zoomBtn} onClick={handleResetZoom} title="Reset">↺</button>
          </div>

          <button className={styles.closeLightbox} onClick={closeLightboxModal} aria-label="Close Lightbox">
            <X size={20} />
          </button>

          {/* Navigation Arrows for Laptop/Desktop View */}
          {ad.images && ad.images.length > 1 && (
            <>
              <button 
                className={`${styles.lightboxNavBtn} ${styles.lightboxPrev}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImage(prev => prev > 0 ? prev - 1 : ad.images.length - 1);
                  handleResetZoom();
                }}
                title={lang === 'bn' ? 'আগের ছবি' : 'Previous image'}
              >
                <ChevronLeft size={36} />
              </button>
              <button 
                className={`${styles.lightboxNavBtn} ${styles.lightboxNext}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImage(prev => prev < ad.images.length - 1 ? prev + 1 : 0);
                  handleResetZoom();
                }}
                title={lang === 'bn' ? 'পরের ছবি' : 'Next image'}
              >
                <ChevronRight size={36} />
              </button>
            </>
          )}

          <div className={styles.lightboxContent} onClick={e => e.stopPropagation()}>
            <img 
              src={ad.images[activeImage]} 
              alt={ad.title}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.25s ease-out',
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                touchAction: scale > 1 ? 'none' : 'auto'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
