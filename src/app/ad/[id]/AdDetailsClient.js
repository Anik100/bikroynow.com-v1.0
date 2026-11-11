'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabaseClient';
import styles from './ad-details.module.css';
import { MapPin, Clock, Phone, User as UserIcon, ShieldCheck, Heart, Share2, ChevronLeft, ChevronRight, Trash2, Star, Edit, Check, X, MessageCircle } from 'lucide-react';
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
        color: '#0f172a',
        border: '1px solid #94a3b8'
      };
      label = lang === 'bn' ? 'সিলভার মেম্বার' : 'Silver Member';
    } else if (name.includes('gold')) {
      badgeStyle = {
        background: 'linear-gradient(135deg, #fef08a 0%, #ca8a04 100%)',
        color: '#451a03',
        border: '1px solid #ca8a04'
      };
      label = lang === 'bn' ? 'গোল্ড মেম্বার' : 'Gold Member';
    } else if (name.includes('business')) {
      badgeStyle = {
        background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
        color: '#ffffff',
        border: '1px solid #3b82f6'
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


const renderPackageBadge = (profile, ad, lang) => {
  const expiresAt = profile?.membership_expires_at ? new Date(profile.membership_expires_at) : null;
  const isNotExpired = !expiresAt || new Date() < expiresAt;
  const membershipType = (profile?.membership_type && profile.membership_type !== 'free' && isNotExpired)
    ? profile.membership_type.toLowerCase()
    : null;

  if (membershipType) {
    if (membershipType.includes('business')) {
      return (
        <span className={`${styles.pkgBadge} ${styles.pkgBusiness}`}>
          💎 {lang === 'bn' ? 'বিজনেস মেম্বার' : 'Business Member'}
        </span>
      );
    } else if (membershipType.includes('gold')) {
      return (
        <span className={`${styles.pkgBadge} ${styles.pkgGold}`}>
          ⭐ {lang === 'bn' ? 'গোল্ড মেম্বার' : 'Gold Member'}
        </span>
      );
    } else if (membershipType.includes('silver')) {
      return (
        <span className={`${styles.pkgBadge} ${styles.pkgSilver}`}>
          🥈 {lang === 'bn' ? 'সিলভার মেম্বার' : 'Silver Member'}
        </span>
      );
    } else {
      return (
        <span className={`${styles.pkgBadge} ${styles.pkgBusiness}`}>
          🛡️ {profile.membership_type}
        </span>
      );
    }
  }

  if (ad?.promotion_type) {
    return (
      <span className={`${styles.pkgBadge} ${styles.pkgPromo}`}>
        🚀 {getPromotionBadgeText(ad.promotion_type, lang)}
      </span>
    );
  }

  if (ad?.is_featured) {
    return (
      <span className={`${styles.pkgBadge} ${styles.pkgGold}`}>
        ⭐ {lang === 'bn' ? 'ফিচার্ড সেলার' : 'Featured Seller'}
      </span>
    );
  }

  return (
    <span className={`${styles.pkgBadge} ${styles.pkgVerified}`}>
      🛡️ {lang === 'bn' ? 'ভেরিফাইড সেলার' : 'Verified Seller'}
    </span>
  );
};

export default function AdDetailsClient({ initialAd, adId, params }) {
  const routeParams = useParams();
  const effectiveId = adId || routeParams?.id || params?.id;
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [ad, setAd] = useState(initialAd || null);
  const [profile, setProfile] = useState(initialAd?.profiles || null);
  const [similarAds, setSimilarAds] = useState([]);
  const [loading, setLoading] = useState(!initialAd);
  const [sendingChat, setSendingChat] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentUser, setCurrentUser] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  const handleStartChat = async () => {
    setSendingChat(true);
    try {
      let activeUser = currentUser;

      if (!activeUser) {
        try {
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 1200));
          const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
          if (session?.user) activeUser = session.user;
        } catch (e) {}
      }

      if (!activeUser) {
        try {
          const localUser = localStorage.getItem('bikroynow_demo_user');
          if (localUser) activeUser = JSON.parse(localUser);
        } catch (e) {}
      }

      if (!activeUser) {
        router.push(`/login?redirect=${encodeURIComponent('/ad/' + effectiveId)}`);
        return;
      }
      
      const isOwnAd = activeUser.id === ad.user_id || 
        (activeUser.email && profile?.email && activeUser.email.toLowerCase() === profile.email.toLowerCase());
      if (isOwnAd) {
        alert(lang === 'bn' ? 'আপনি নিজের বিজ্ঞাপনে চ্যাট করতে পারবেন না।' : 'You cannot chat on your own ad.');
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const chatRes = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: ad.id,
          buyer_id: activeUser.id,
          seller_id: ad.user_id || 'seller-business-1'
        }),
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timer);

      if (chatRes && chatRes.ok) {
        const chatJson = await chatRes.json();
        if (chatJson.id) {
          try {
            const instantChatObj = {
              id: chatJson.id,
              listing_id: ad.id,
              buyer_id: activeUser.id,
              seller_id: ad.user_id || 'seller-business-1',
              created_at: new Date().toISOString(),
              listing: {
                id: ad.id,
                title: ad.title,
                images: ad.images || [],
                price: ad.price,
                location: ad.location || ''
              },
              seller: profile || {
                full_name: 'বিক্রেতা (Seller)',
                avatar_url: null,
                email: null
              },
              buyer: {
                id: activeUser.id,
                full_name: activeUser.user_metadata?.full_name || activeUser.email || 'ক্রেতা (Buyer)',
                avatar_url: activeUser.user_metadata?.avatar_url || null,
                email: activeUser.email
              }
            };
            localStorage.setItem('bikroynow_chat_meta_' + chatJson.id, JSON.stringify(instantChatObj));
          } catch (e) {}

          router.push(`/chat/${chatJson.id}`);
          return;
        }
      }

      throw new Error(lang === 'bn' ? 'সার্ভার চ্যাট তৈরি করতে ব্যর্থ হয়েছে।' : 'Failed to create chat session on server.');
    } catch (err) {
      console.error('Chat error full:', err);
      alert((lang === 'bn' ? 'চ্যাট শুরু করতে সমস্যা হয়েছে: ' : 'Error starting chat: ') + (err?.message || 'Network error'));
    } finally {
      setSendingChat(false);
    }
  };


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

  // Main Gallery Touch Swipe Gestures for Mobile
  const galleryTouchRef = useRef({ startX: 0, startY: 0, startTime: 0, hasSwiped: false });

  const handleGalleryTouchStart = (e) => {
    if (e.touches.length === 1) {
      galleryTouchRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startTime: Date.now(),
        hasSwiped: false
      };
    }
  };

  const handleGalleryTouchEnd = (e) => {
    if (!ad?.images || ad.images.length <= 1) return;
    if (e.changedTouches && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const diffX = touch.clientX - galleryTouchRef.current.startX;
      const diffY = touch.clientY - galleryTouchRef.current.startY;
      const elapsed = Date.now() - galleryTouchRef.current.startTime;

      // Swipe detection: horizontal move > vertical move and distance > 35px within 750ms
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35 && elapsed < 750) {
        galleryTouchRef.current.hasSwiped = true;
        if (diffX < 0) {
          // Swiped left -> next image
          setActiveImage(prev => (prev < ad.images.length - 1 ? prev + 1 : 0));
        } else {
          // Swiped right -> previous image
          setActiveImage(prev => (prev > 0 ? prev - 1 : ad.images.length - 1));
        }
      }
    }
  };

  const handleMainImageClick = () => {
    if (galleryTouchRef.current.hasSwiped) {
      galleryTouchRef.current.hasSwiped = false;
      return;
    }
    setShowLightbox(true);
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
      // 1. Delete from global listings store and Supabase via server API
      try {
        await fetch(`/api/listings?id=${encodeURIComponent(ad.id)}`, { method: 'DELETE' });
      } catch (e) {}

      // 2. Also delete from Supabase if valid UUID
      if (isValidUUID(ad.id)) {
        try {
          await supabase.from('listings').delete().eq('id', ad.id);
        } catch (e) {}
      }

      // 3. Also clean up from local storage & deleted blacklist
      try {
        const deletedIds = JSON.parse(localStorage.getItem('bikroynow_deleted_ad_ids') || '[]').map(String);
        if (!deletedIds.includes(String(ad.id))) {
          deletedIds.push(String(ad.id));
          localStorage.setItem('bikroynow_deleted_ad_ids', JSON.stringify(deletedIds));
        }
        const localAds = JSON.parse(localStorage.getItem('bikroynow_public_ads') || '[]');
        const filtered = localAds.filter(l => String(l.id) !== String(ad.id));
        localStorage.setItem('bikroynow_public_ads', JSON.stringify(filtered));

        const pending = JSON.parse(localStorage.getItem('bikroynow_user_pending_ads') || '[]');
        localStorage.setItem('bikroynow_user_pending_ads', JSON.stringify(pending.filter(l => String(l.id) !== String(ad.id))));
      } catch (e) {}

      // 4. Also delete from featured store API
      try {
        await fetch(`/api/admin/featured-ads?listing_id=${encodeURIComponent(ad.id)}`, { method: 'DELETE' });
      } catch (e) {}

      // 5. Force hard navigate to homepage to completely bypass any browser/router cache
      window.location.href = `/?refresh=${Date.now()}`;
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

    let isCancelled = false;

    // Helper for fast fetch with timeout so UI never hangs
    const fetchWithTimeout = async (url, ms = 2500) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res;
      } catch (e) {
        clearTimeout(timer);
        return null;
      }
    };

    const fetchAdData = async () => {
      try {
        let adData = null;
        const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        // 1. Instant cache check from localStorage (renders in 0ms)
        try {
          const localAds = JSON.parse(localStorage.getItem('bikroynow_public_ads') || '[]');
          const localFound = localAds.find(l => String(l.id) === String(effectiveId));
          if (localFound) {
            adData = localFound;
            if (!isCancelled) {
              setAd(localFound);
              if (localFound.profiles) setProfile(localFound.profiles);
              setLoading(false);
            }
          }
        } catch (e) {}

        // 2. Fetch from fast internal API /api/listings?id=... (fastest server response ~50ms)
        try {
          const res = await fetchWithTimeout(`/api/listings?id=${encodeURIComponent(effectiveId)}&t=${Date.now()}`, 2500);
          if (res && res.ok) {
            const data = await res.json();
            if (data?.listing) {
              adData = data.listing;
              if (!isCancelled) {
                setAd(adData);
                if (adData.profiles) setProfile(adData.profiles);
                setLoading(false);
              }
            }
          }
        } catch (e) {}

        // 3. Fallback: Check full /api/listings feed
        if (!adData) {
          try {
            const res = await fetchWithTimeout(`/api/listings?t=${Date.now()}`, 2500);
            if (res && res.ok) {
              const resJson = await res.json();
              const allListings = Array.isArray(resJson) ? resJson : (resJson?.listings || []);
              const found = allListings.find(l => String(l.id) === String(effectiveId));
              if (found) {
                adData = found;
                if (!isCancelled) {
                  setAd(adData);
                  if (adData.profiles) setProfile(adData.profiles);
                  setLoading(false);
                }
              }
            }
          } catch (e) {}
        }

        // 4. Fallback: Direct Supabase query with 2.5s race timeout
        if (!adData && isValidUUID(effectiveId)) {
          try {
            const sbPromise = supabase.from('listings').select('*').eq('id', effectiveId).maybeSingle();
            const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2500));
            const { data } = await Promise.race([sbPromise, timeoutPromise]);
            if (data) {
              adData = data;
              if (!isCancelled) {
                setAd(adData);
                setLoading(false);
              }
            }
          } catch (e) {}
        }

        // Always end loading state promptly
        if (!isCancelled) {
          setLoading(false);
        }

        // 5. Background non-blocking load: Fetch similar ads & profile without freezing UI
        if (adData?.category_id) {
          supabase
            .from('listings')
            .select('*')
            .eq('category_id', adData.category_id)
            .neq('status', 'pending')
            .neq('id', adData.id)
            .order('created_at', { ascending: false })
            .limit(4)
            .then(({ data: similarAdsData }) => {
              if (similarAdsData && !isCancelled) setSimilarAds(similarAdsData);
            })
            .catch(() => {});
        }

        if (adData?.user_id && isValidUUID(adData.user_id) && (!adData.profiles || !adData.profiles.full_name)) {
          supabase
            .from('profiles')
            .select('*')
            .eq('id', adData.user_id)
            .maybeSingle()
            .then(({ data: profileData }) => {
              if (profileData && !isCancelled) setProfile(profileData);
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error('Fetch Error:', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    const checkUser = async () => {
      try {
        // Explicitly consume OAuth hash if redirected from Google
        if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
          try {
            const hashStr = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash;
            const hashParams = new URLSearchParams(hashStr);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken) {
              const { data: authData } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
              });
              if (authData?.session?.user && !isCancelled) {
                setCurrentUser(authData.session.user);
                try {
                  window.history.replaceState(null, '', window.location.pathname + window.location.search);
                } catch (e) {}
              }
            }
          } catch (e) {}
        }

        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ data: { session: null } }), 1500));
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        let activeUser = session?.user;
        if (!activeUser) {
          try {
            const localUser = localStorage.getItem('bikroynow_demo_user');
            if (localUser) activeUser = JSON.parse(localUser);
          } catch (e) {}
        }
        if (!isCancelled) {
          setCurrentUser(activeUser || null);
          if (activeUser && effectiveId && isValidUUID(effectiveId)) {
            supabase
              .from('favorites')
              .select('*')
              .eq('user_id', activeUser.id)
              .eq('listing_id', effectiveId)
              .maybeSingle()
              .then(({ data }) => {
                if (data && !isCancelled) setIsFavorite(true);
              })
              .catch(() => {});
          }
        }
      } catch (e) {}
    };

    checkUser();
    fetchAdData();

    return () => {
      isCancelled = true;
    };
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

  const adminEmails = [
    'anikh0000@gmail.com',
    'anikh00000@gmail.com',
    'anikh00@gmail.com',
    'aunik008@gmail.com',
    'aunik003@gmail.com'
  ];

  const isOwner = Boolean(
    currentUser && ad && (
      String(currentUser.id) === String(ad.user_id) ||
      (currentUser.email && ad.user_id && String(ad.user_id).includes(currentUser.email.split('@')[0]))
    )
  );

  const isAdminUser = Boolean(
    currentUser && (
      (currentUser.email && adminEmails.includes(currentUser.email.toLowerCase().trim())) ||
      currentUser.user_metadata?.role === 'admin'
    )
  );

  // If ad is pending and viewer is NOT the owner or admin, do not disclose seller info
  if (ad && ad.status === 'pending' && !isOwner && !isAdminUser) {
    return (
      <div className="container" style={{ paddingTop: '5rem', paddingBottom: '6rem', textAlign: 'center' }}>
        <div style={{
          maxWidth: '520px',
          margin: '0 auto',
          background: '#ffffff',
          padding: '2.5rem 1.5rem',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
          border: '1px solid #fde68a'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1c2b38', marginBottom: '0.6rem' }}>
            {lang === 'bn' ? 'বিজ্ঞাপনটি অনুমোদনের অপেক্ষায় রয়েছে' : 'Ad is Pending Approval'}
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {lang === 'bn' 
              ? 'এই বিজ্ঞাপনটি এখনও এডমিন কর্তৃক অনুমোদিত হয়নি। অ্যাডমিন যাচাই-বাছাই করে অনুমোদন করার পর এটি সবার জন্য উন্মুক্ত হবে।' 
              : 'This listing is awaiting moderation review and has not yet been approved.'}
          </p>
          <Link href="/ads" className="btn-primary" style={{ display: 'inline-flex', padding: '0.75rem 1.5rem', borderRadius: '10px' }}>
            {lang === 'bn' ? 'অন্যান্য বিজ্ঞাপনগুলো দেখুন' : 'Browse Other Ads'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      

      {adminActionMessage && (
        <div className="container" style={{ paddingTop: '1rem' }}>
          <div style={{ background: adminActionMessage.type === 'error' ? '#fef2f2' : '#f0fdf4', color: adminActionMessage.type === 'error' ? '#991b1b' : '#166534', padding: '1rem', borderRadius: '8px', border: `1px solid ${adminActionMessage.type === 'error' ? '#fecaca' : '#bbf7d0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{adminActionMessage.text}</span>
            <button onClick={() => setAdminActionMessage(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>
        </div>
      )}

      {showAdminDeleteModal && isMounted && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999999,
          padding: '1.25rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '1.8rem 1.5rem',
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(0, 0, 0, 0.08)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              margin: '0 auto 1rem auto'
            }}>
              🗑️
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: '#0f172a' }}>
              {lang === 'bn' ? 'বিজ্ঞাপনটি মুছে ফেলবেন?' : 'Delete Advertisement?'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: '1.6rem', lineHeight: 1.5 }}>
              {lang === 'bn' 
                ? 'আপনি কি নিশ্চিত যে এই বিজ্ঞাপনটি স্থায়ীভাবে ডিলিট করতে চান? এটি আর ফিরিয়ে আনা যাবে না।' 
                : 'Are you sure you want to permanently delete this ad? This action cannot be undone.'}
            </p>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button
                type="button"
                onClick={() => setShowAdminDeleteModal(false)}
                style={{
                  flex: 1,
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  background: '#f8fafc',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  color: '#475569',
                  transition: 'all 0.2s'
                }}
              >
                {lang === 'bn' ? 'বাতিল (না)' : 'Cancel (No)'}
              </button>
              <button
                type="button"
                onClick={executeAdminDelete}
                style={{
                  flex: 1,
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
                  transition: 'all 0.2s'
                }}
              >
                {lang === 'bn' ? 'ডিলিট (হ্যাঁ)' : 'Delete (Yes)'}
              </button>
            </div>
          </div>
        </div>,
        document.body
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
                aria-label={isFavorite ? (lang === 'bn' ? 'প্রিয় তালিকা থেকে বাদ দিন' : 'Remove from favorites') : (lang === 'bn' ? 'প্রিয় তালিকায় যোগ করুন' : 'Save to favorites')}
              >
                <Heart 
                  size={22} 
                  fill={isFavorite ? "#ef4444" : "none"} 
                  color={isFavorite ? "#ef4444" : "#64748b"} 
                />
              </button>
              <div 
                className={styles.mainImageWrapper}
                onTouchStart={handleGalleryTouchStart}
                onTouchEnd={handleGalleryTouchEnd}
              >
                {ad.images && ad.images.length > 0 ? (
                  <img 
                    src={ad.images[activeImage]} 
                    alt={`${ad.condition === 'New' ? (lang === 'bn' ? 'নতুন' : 'Brand New') : (lang === 'bn' ? 'ব্যবহৃত' : 'Used')} ${ad.title} for sale in ${ad.location || 'Bangladesh'} - BikroyNow`} 
                    className={styles.mainImage} 
                    onClick={handleMainImageClick}
                    title={lang === 'bn' ? 'বড় করে দেখতে ক্লিক করুন' : 'Click to zoom'}
                    width={800}
                    height={500}
                    fetchPriority="high"
                    draggable={false}
                  />
                ) : (
                  <div className={styles.noImage}>{t('noImage')}</div>
                )}

                {/* Mobile / Desktop Slide Counter Badge */}
                {ad.images && ad.images.length > 1 && (
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    background: 'rgba(15, 23, 42, 0.72)',
                    color: '#ffffff',
                    padding: '3px 9px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    backdropFilter: 'blur(4px)',
                    pointerEvents: 'none',
                    zIndex: 2
                  }}>
                    {activeImage + 1} / {ad.images.length}
                  </div>
                )}
                
                {ad.images && ad.images.length > 1 && (
                  <>
                    <button 
                      className={styles.navBtn + ' ' + styles.prev}
                      onClick={() => setActiveImage(prev => prev > 0 ? prev - 1 : ad.images.length - 1)}
                      aria-label={lang === 'bn' ? 'পূর্ববর্তী ছবি' : 'Previous photo'}
                    >
                      <ChevronLeft />
                    </button>
                    <button 
                      className={styles.navBtn + ' ' + styles.next}
                      onClick={() => setActiveImage(prev => prev < ad.images.length - 1 ? prev + 1 : 0)}
                      aria-label={lang === 'bn' ? 'পরবর্তী ছবি' : 'Next photo'}
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
                    <img src={img} alt={`${ad.title} photo ${i + 1} - BikroyNow`} loading="lazy" decoding="async" />
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.infoSection}>
              <div className={styles.header}>
                                {/* Sleek Integrated Seller Top Box */}
                {(() => {
                  const rawPhone = ad.contact_phone || '';
                  const cleanPhone = rawPhone.replace(/\|.*/, '').trim();
                  const hasWhatsApp = Boolean(cleanPhone && !rawPhone.includes('|nowa'));
                  const sellerDisplayName = profile?.full_name || ad.seller_name || (profile?.email ? profile.email.split('@')[0] : null) || t('verifiedSeller');
                  
                  const isBusiness = Boolean(
                    (profile?.membership_type && profile.membership_type.toLowerCase().includes('business')) ||
                    (ad.promotion_type && ad.promotion_type.toLowerCase().includes('business'))
                  );
                  const isVerified = Boolean(ad.is_verified || profile?.is_verified || profile?.membership_type || isBusiness);

                  const formatMemberDate = (dateStr, lang) => {
                    if (!dateStr) return lang === 'bn' ? 'সদস্য: ২০২৬' : 'Member since: 2026';
                    const d = new Date(dateStr);
                    const year = d.getFullYear();
                    const monthsBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
                    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const month = lang === 'bn' ? monthsBn[d.getMonth()] : monthsEn[d.getMonth()];
                    return lang === 'bn' ? `সদস্য: ${month} ${year}` : `Member since: ${month} ${year}`;
                  };

                  return (
                    <div className={styles.sellerTopBox}>
                      {/* Top Strip (সবার উপরে): Package Badge + Clean Location */}
                      <div className={styles.sellerCardTopStrip}>
                        <div className={styles.sellerPackageRow}>
                          {renderPackageBadge(profile, ad, lang)}
                        </div>
                        {ad.location && (
                          <div className={styles.sellerTopLocation}>
                            <span>📍</span>
                            <span>{ad.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Main Body */}
                      <div className={styles.sellerCardBody}>
                        {/* 1. Seller Profile Row: Big Avatar + Name (with Verified Badge) + Clean Date */}
                        <div className={styles.sellerProfileRow}>
                          <div className={styles.sellerAvatarImg}>
                            {profile?.avatar_url ? (
                              <img 
                                src={profile.avatar_url} 
                                alt={sellerDisplayName} 
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <UserIcon size={28} color="#64748b" />
                            )}
                          </div>
                          <div className={styles.sellerNameCol}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span className={styles.sellerName} title={sellerDisplayName}>
                                {sellerDisplayName}
                              </span>
                              {isVerified && (
                                <span 
                                  title={lang === 'bn' ? 'ভেরিফাইড বিক্রেতা' : 'Verified Seller'}
                                  style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                                  aria-label="Verified Seller"
                                >
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" style={{ flexShrink: 0 }}>
                                    <path d="M10.29 2.308a2.5 2.5 0 0 1 3.42 0l.73.684a2.5 2.5 0 0 0 1.954.724l.998-.073a2.5 2.5 0 0 1 2.628 2.19l.118.995a2.5 2.5 0 0 0 1.258 1.677l.888.46a2.5 2.5 0 0 1 1.134 3.238l-.403.918a2.5 2.5 0 0 0 0 2.098l.403.918a2.5 2.5 0 0 1-1.134 3.238l-.888.46a2.5 2.5 0 0 0-1.258 1.677l-.118.995a2.5 2.5 0 0 1-2.628 2.19l-.998-.073a2.5 2.5 0 0 0-1.954.724l-.73.684a2.5 2.5 0 0 1-3.42 0l-.73-.684a2.5 2.5 0 0 0-1.954-.724l-.998.073a2.5 2.5 0 0 1-2.628-2.19l-.118-.995a2.5 2.5 0 0 0-1.258-1.677l-.888-.46a2.5 2.5 0 0 1-1.134-3.238l.403-.918a2.5 2.5 0 0 0 0-2.098l-.403-.918a2.5 2.5 0 0 1 1.134-3.238l.888-.46a2.5 2.5 0 0 0 1.258-1.677l.118-.995a2.5 2.5 0 0 1 2.628-2.19l.998.073a2.5 2.5 0 0 0 1.954-.724l.73-.684z" />
                                    <path d="M9 12.5l2 2 4-4" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            <span className={styles.sellerSub}>
                              {formatMemberDate(profile?.created_at, lang)}
                            </span>
                          </div>
                        </div>

                        {/* 2. Action Buttons Row: 1. Chat, 2. Call, 3. WhatsApp */}
                        <div className={styles.sellerButtonsRow}>
                          {/* 1. Chat */}
                          <button 
                            onClick={handleStartChat}
                            disabled={sendingChat}
                            className={styles.btnChat}
                            title={t('chatWithSeller')}
                          >
                            <MessageCircle size={15} color="#0284c7" />
                            <span>{sendingChat ? '...' : (lang === 'bn' ? 'চ্যাট' : 'Chat')}</span>
                          </button>

                          {/* 2. Call */}
                          {cleanPhone && (
                            <a 
                              href={`tel:${cleanPhone}`} 
                              className={styles.btnCall} 
                              title={cleanPhone || (lang === 'bn' ? 'সরাসরি কল করুন' : 'Call seller')}
                            >
                              <Phone size={15} />
                              <span className={styles.callTextMobile}>{lang === 'bn' ? 'কল করুন' : 'Call'}</span>
                              <span className={styles.callTextDesktop}>{cleanPhone}</span>
                            </a>
                          )}

                          {/* 3. WhatsApp (only if poster enabled WhatsApp) */}
                          {hasWhatsApp && cleanPhone && (
                            <a 
                              href={`https://wa.me/${cleanPhone.replace(/\D/g, '').startsWith('01') ? '88' + cleanPhone.replace(/\D/g, '') : cleanPhone.replace(/\D/g, '')}?text=${encodeURIComponent(lang === 'bn' ? `আসসালামু আলাইকুম, আমি BikroyNow-এ আপনার "${ad.title}" বিজ্ঞাপনটি দেখেছি।` : `Hello, I saw your ad "${ad.title}" on BikroyNow.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.btnWhatsApp}
                              aria-label="Chat on WhatsApp"
                              title={lang === 'bn' ? 'হোয়াটসঅ্যাপে মেসেজ পাঠান' : 'Chat on WhatsApp'}
                            >
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <h1 className={styles.title}>{ad.title}</h1>
                <div className={styles.price} itemProp="offers" itemScope itemType="https://schema.org/Offer">
                  <meta itemProp="priceCurrency" content="BDT" />
                  <meta itemProp="price" content={String(Number(ad.price || 0).toFixed(2))} />
                  <link itemProp="availability" href={(ad.status === 'active' || ad.status === 'approved') ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'} />
                  {formatPrice(ad.price, lang)}
                </div>
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
                 <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.8rem', color: '#0f172a' }}>{t('description')}</h2>
                 <p>{ad.description}</p>

                 <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#475569', fontWeight: 500, borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                   {t('postedOn')} {formatFullDate(ad.created_at, lang)}
                 </div>
               </div>
            </div>
          </div>

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

          <div className={`${styles.card} ${styles.safetyCard}`}>
            <div className={styles.safetyHeader}>
              <ShieldCheck size={20} color="#d97706" />
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

      {/* Similar Ads Section (Positioned below seller contact info and main content) */}
      {similarAds.length > 0 && (
        <div className="container" style={{ marginTop: "2.5rem" }}>
          {/* Similar Ads Section */}
          {similarAds.length > 0 && (
            <div className={styles.similarAdsSection}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem', color: '#0f172a' }}>{lang === 'bn' ? 'একই ক্যাটাগরির আরও বিজ্ঞাপন' : 'Similar Ads'}</h2>
              <div className={styles.similarAdsGrid}>
                {similarAds.map(similarAd => (
                  <Link href={`/ad/${similarAd.id}`} key={similarAd.id} className={styles.similarAdCard}>
                    <img 
                      src={similarAd.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image'} 
                      alt={`${similarAd.title} - ${similarAd.location || 'Bangladesh'} | BikroyNow`} 
                      className={styles.similarAdImg}
                      loading="lazy"
                      decoding="async"
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
      )}

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
