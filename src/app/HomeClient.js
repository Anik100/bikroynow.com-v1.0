'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '../lib/supabaseClient';
import styles from './page.module.css';
import { LOCATIONS, CATEGORIES, CATEGORY_TRANSLATIONS, getCategoryName } from '../lib/constants';
import { isCategoryMatch } from '../lib/categoryMatcher';
import { useLanguage } from '../context/LanguageContext';
import { getRelativeTime, formatFullDate, formatPrice, getPromotionBadgeText, sortPremiumListings } from '../lib/utils';
import { Heart, Smartphone, Laptop, Zap, Car, Home as HouseIcon, Briefcase, Box, ChevronDown, Search, Filter } from 'lucide-react';
import FeaturedSlider from '../components/FeaturedSlider';

const FilterModal = dynamic(() => import('../components/FilterModal'), { ssr: false });

const getSellerBadge = (profiles, lang) => {
  if (!profiles) return null;
  const expiresAt = profiles.membership_expires_at ? new Date(profiles.membership_expires_at) : null;
  const isNotExpired = !expiresAt || new Date() < expiresAt;

  if (profiles.membership_type && profiles.membership_type !== 'free' && isNotExpired) {
    const name = profiles.membership_type.toLowerCase();
    let badgeStyle = {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: 'white',
      border: '1px solid #34d399'
    };
    let label = profiles.membership_type;

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

    const shieldSvg = (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px', flexShrink: 0 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    );

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '0.62rem',
        fontWeight: 800,
        padding: '0.15rem 0.4rem',
        borderRadius: '5px',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        gap: '0.15rem',
        lineHeight: 1,
        ...badgeStyle
      }}>
        {shieldSvg}
        {label}
      </span>
    );
  }
  return null;
};

export default function HomeClient({ initialFeaturedAds = [], initialListings = [] }) {
  const { t, lang } = useLanguage();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);
  const [activeCategoryModal, setActiveCategoryModal] = useState(null);

  // Redesigned Filter & Browsing states
  const [memberFilter, setMemberFilter] = useState('all'); // 'all', 'free', 'verified', 'business', 'premium_sellers'
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'price_asc', 'price_desc'
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [listings, setListings] = useState(initialListings || []);
  const [loading, setLoading] = useState(initialListings && initialListings.length > 0 ? false : true);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [subCatSearchQuery, setSubCatSearchQuery] = useState('');
  const [customItemInput, setCustomItemInput] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);

  const handleFilterApply = (applied) => {
    setMemberFilter(applied.memberFilter || 'all');
    setSelectedCategoryFilter(applied.category || null);
    setSelectedLocationFilter(applied.location || '');
    setMinPrice(applied.minPrice || '');
    setMaxPrice(applied.maxPrice || '');
    setSortBy(applied.sortBy || 'newest');
  };

  const handleFilterReset = () => {
    setMemberFilter('all');
    setSelectedCategoryFilter(null);
    setSelectedLocationFilter('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
  };

  const hasActiveFilters = Boolean(
    (memberFilter && memberFilter !== 'all') ||
    selectedCategoryFilter ||
    selectedLocationFilter ||
    minPrice ||
    maxPrice ||
    (sortBy && sortBy !== 'newest')
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Favorites state
  const [favorites, setFavorites] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchListings = async () => {
      try {
        if (!initialListings || initialListings.length === 0) {
          setLoading(true);
        }
        const apiRes = await fetch(`/api/listings?t=${Date.now()}`, { cache: 'no-store' });
        if (apiRes.ok) {
          const apiJson = await apiRes.json();
          if (Array.isArray(apiJson.listings) && !isCancelled) {
            let deletedIds = new Set();
            try {
              deletedIds = new Set(JSON.parse(localStorage.getItem('bikroynow_deleted_ad_ids') || '[]').map(String));
            } catch (e) {}
            const activeOnly = apiJson.listings.filter(ad => (ad.status === 'active' || ad.status === 'approved') && !deletedIds.has(String(ad.id)));
            setListings(sortPremiumListings(activeOnly));
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Unexpected error fetching listings:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchListings();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Fetch session and user's favorites dynamically
  useEffect(() => {
    const fetchFavorites = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('favorites')
          .select('listing_id')
          .eq('user_id', session.user.id);
        if (data) {
          setFavorites(data.map(f => f.listing_id));
        }
      }
    };

    fetchFavorites();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('favorites')
          .select('listing_id')
          .eq('user_id', session.user.id);
        if (data) {
          setFavorites(data.map(f => f.listing_id));
        }
      } else {
        setUser(null);
        setFavorites([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const toggleFavorite = async (e, adId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      alert(lang === 'bn' ? 'প্রিয় বিজ্ঞাপনের তালিকা ব্যবহার করতে অনুগ্রহ করে লগইন করুন।' : 'Please login to use favorites.');
      return;
    }

    const isFav = favorites.includes(adId);

    // Optimistic UI Update: turn it red/empty instantly
    if (isFav) {
      setFavorites(prev => prev.filter(id => id !== adId));
    } else {
      setFavorites(prev => [...prev, adId]);
    }

    if (isFav) {
      // Remove favorite
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', adId);
      if (error) {
        // Revert on error
        setFavorites(prev => [...prev, adId]);
        console.error('Error removing favorite:', error);
      }
    } else {
      // Add favorite
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: adId });
      if (error) {
        // Revert on error
        setFavorites(prev => prev.filter(id => id !== adId));
        console.error('Error adding favorite:', error);
      }
    }
  };

  // Handle native mobile/browser back button to close the modal
  useEffect(() => {
    if (showCategoryModal) {
      window.history.pushState({ modalOpen: true }, '');
      
      const handlePopState = (e) => {
        setShowCategoryModal(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [showCategoryModal]);

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setActiveCategory(null);
    setActiveSub(null);
    setSubCatSearchQuery('');
    setCustomItemInput('');
    setShowOtherInput(false);
    if (window.history.state && window.history.state.modalOpen) {
      window.history.back();
    }
  };

  const categories = [
    { 
      name: 'Mobile Phones', 
      icon: Smartphone, 
      color: '#2563eb', 
      bg: '#f0f7ff', 
      border: '#bfdbfe', 
      text: '#1e40af', 
      gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #60a5fa 100%)' 
    },
    { 
      name: 'Computers', 
      icon: Laptop, 
      color: '#059669', 
      bg: '#ecfdf5', 
      border: '#a7f3d0', 
      text: '#065f46', 
      gradient: 'linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)' 
    },
    { 
      name: 'Electronics', 
      icon: Zap, 
      color: '#d97706', 
      bg: '#fffbeb', 
      border: '#fde68a', 
      text: '#92400e', 
      gradient: 'linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #fbbf24 100%)' 
    },
    { 
      name: 'Vehicles', 
      icon: Car, 
      color: '#dc2626', 
      bg: '#fef2f2', 
      border: '#fca5a5', 
      text: '#991b1b', 
      gradient: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 50%, #f87171 100%)' 
    },
    { 
      name: 'Property', 
      icon: HouseIcon, 
      color: '#7c3aed', 
      bg: '#f5f3ff', 
      border: '#ddd6fe', 
      text: '#5b21b6', 
      gradient: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 50%, #a78bfa 100%)' 
    },
    { 
      name: 'Jobs', 
      icon: Briefcase, 
      color: '#db2777', 
      bg: '#fdf2f8', 
      border: '#fbcfe8', 
      text: '#9d174d', 
      gradient: 'linear-gradient(135deg, #be185d 0%, #ec4899 50%, #f472b6 100%)' 
    },
    { 
      name: 'অন্যান্য', 
      icon: Box, 
      color: '#475569', 
      bg: '#f8fafc', 
      border: '#cbd5e1', 
      text: '#1e293b', 
      gradient: 'linear-gradient(135deg, #334155 0%, #64748b 50%, #94a3b8 100%)' 
    },
  ];

  return (
    <div className={styles.homeContainer}>
      {/* Top Accessible Heading for strict WCAG sequential hierarchy */}
      <h1 className="sr-only">
        {lang === 'bn' 
          ? 'BikroyNow – বাংলাদেশের বিশ্বস্ত লোকাল কেনাবেচার অনলাইন মার্কেটপ্লেস' 
          : 'BikroyNow – Bangladesh’s Trusted Local Buy & Sell Classifieds Marketplace'}
      </h1>

      {/* === CATEGORY SECTION WITH AUTO-COLLAPSE ON SELECTION === */}
      <div className={`container ${styles.categorySection}`}>
        {/* Toggle Title Bar */}
        <div 
          className={styles.sectionTitleToggle} 
          onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
          role="button"
          tabIndex={0}
          aria-expanded={isCategoriesExpanded}
          aria-label={isCategoriesExpanded ? (lang === 'bn' ? 'ক্যাটাগরি বন্ধ করুন' : 'Collapse categories') : (lang === 'bn' ? 'ক্যাটাগরি খুলুন' : 'Expand categories')}
        >
          <div className={styles.titleLeft}>
            <span className={styles.accentBar}></span>
            <h2 className={styles.sectionTitleText}>
              {lang === 'bn' ? 'ক্যাটাগরি ব্রাউজ করুন' : 'Browse Categories'}
            </h2>
          </div>
          <div className={styles.toggleRight}>
            {selectedCategoryFilter && (
              <button 
                type="button"
                className={styles.resetFilterBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveCategory(null);
                  setActiveSub(null);
                  setSelectedCategoryFilter(null);
                }}
              >
                {lang === 'bn' ? 'ফিল্টার রিসেট ✕' : 'Clear ✕'}
              </button>
            )}
            <div className={styles.chevronCircle}>
              <svg 
                className={`${styles.chevronIcon} ${isCategoriesExpanded ? styles.rotated : ''}`} 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>

        {/* Smooth Expandable Slider Content */}
        <div className={`${styles.sliderWrapper} ${isCategoriesExpanded ? styles.expanded : ''}`}>
          <div className={styles.sliderContent}>
            {/* Level 1: Category Cards Grid */}
            <div className={styles.categoryGrid}>
              {categories.map((cat, i) => {
                const isSelected = activeCategory === cat.name;
                const subCount = CATEGORIES[cat.name] ? Object.keys(CATEGORIES[cat.name]).length : 0;
                return (
                  <div 
                    key={i} 
                    className={`${styles.categoryCard} ${(selectedCategoryFilter === cat.name || (selectedCategoryFilter && CATEGORIES[cat.name] && CATEGORIES[cat.name][selectedCategoryFilter])) ? styles.cardActive : ''}`}
                    onClick={() => {
                      setActiveCategoryModal(cat.name);
                    }}
                  >
                    <div className={styles.iconCircle} style={{ background: cat.bg, color: cat.color }}>
                      <cat.icon size={22} />
                    </div>
                    <div className={styles.catDetails}>
                      <h3>{getCategoryName(cat.name, lang)}</h3>
                      <span className={styles.itemCount}>
                        {lang === 'bn' ? `${subCount} টি বিভাগ` : `${subCount} Subcategories`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={`container ${styles.adSection}`}>
        {/* ── Featured Business Ads Slider (Prominently at the top) ── */}
        <FeaturedSlider lang={lang} initialFeaturedAds={initialFeaturedAds} />

        {/* ── Homepage Action Bar (Below Featured Slider) ── */}
        <div className={styles.homepageActionBar}>
          {/* 1. Left: Compact Filter Icon Button */}
          <button 
            type="button" 
            className={`${styles.filterIconButton} ${hasActiveFilters ? styles.filterIconActive : ''}`}
            onClick={() => setShowFilterModal(true)}
            title={lang === 'bn' ? 'ফিল্টার করুন' : 'Filter Ads'}
            aria-label="Filter Ads"
          >
            <Filter size={19} />
            {hasActiveFilters && <span className={styles.activeFilterBadgeDot} />}
          </button>

          {/* 2. Center: All Ads Tab/Button */}
          <button 
            type="button" 
            className={`${styles.actionBarTabBtn} ${memberFilter === 'all' ? styles.actionBarTabActive : ''}`}
            onClick={() => setMemberFilter('all')}
          >
            {lang === 'bn' ? 'সকল বিজ্ঞাপন' : 'All Ads'}
          </button>

          {/* 3. Right: Regular Ads Tab/Button */}
          <button 
            type="button" 
            className={`${styles.actionBarTabBtn} ${memberFilter === 'free' ? styles.actionBarTabActive : ''}`}
            onClick={() => setMemberFilter('free')}
          >
            {lang === 'bn' ? 'সাধারণ বিজ্ঞাপন' : 'Regular Ads'}
          </button>
        </div>

        {/* Active Filter Pills Row */}
        {hasActiveFilters && (
          <div className={styles.activeFiltersRow}>
            {memberFilter !== 'all' && (
              <span className={styles.activeFilterPill}>
                {memberFilter === 'free' ? (lang === 'bn' ? '👤 সাধারণ বিজ্ঞাপন' : 'Regular Ads') :
                 memberFilter === 'business' ? (lang === 'bn' ? '💼 বিজনেস মেম্বার' : 'Business Members') :
                 memberFilter === 'premium_sellers' ? (lang === 'bn' ? '🥇 গোল্ড/সিলভার মেম্বার' : 'Gold/Silver Members') :
                 memberFilter === 'verified' ? (lang === 'bn' ? '🛡️ ভেরিফাইড বিক্রেতা' : 'Verified Sellers') : memberFilter}
                <button type="button" className={styles.pillRemoveBtn} onClick={() => setMemberFilter('all')}>✕</button>
              </span>
            )}
            {selectedCategoryFilter && (
              <span className={styles.activeFilterPill}>
                🏷️ {getCategoryName(selectedCategoryFilter, lang)}
                <button type="button" className={styles.pillRemoveBtn} onClick={() => setSelectedCategoryFilter(null)}>✕</button>
              </span>
            )}
            {selectedLocationFilter && (
              <span className={styles.activeFilterPill}>
                📍 {selectedLocationFilter}
                <button type="button" className={styles.pillRemoveBtn} onClick={() => setSelectedLocationFilter('')}>✕</button>
              </span>
            )}
            {(minPrice || maxPrice) && (
              <span className={styles.activeFilterPill}>
                💰 {minPrice ? `≥ ৳${minPrice}` : ''} {maxPrice ? `≤ ৳${maxPrice}` : ''}
                <button type="button" className={styles.pillRemoveBtn} onClick={() => { setMinPrice(''); setMaxPrice(''); }}>✕</button>
              </span>
            )}
            {sortBy && sortBy !== 'newest' && (
              <span className={styles.activeFilterPill}>
                ↕️ {sortBy === 'price_asc' ? (lang === 'bn' ? 'দাম: কম থেকে বেশি' : 'Price: Low to High') : (lang === 'bn' ? 'দাম: বেশি থেকে কম' : 'Price: High to Low')}
                <button type="button" className={styles.pillRemoveBtn} onClick={() => setSortBy('newest')}>✕</button>
              </span>
            )}
            <button 
              type="button" 
              className={styles.clearAllFiltersBtn}
              onClick={handleFilterReset}
            >
              {lang === 'bn' ? 'সব মুছুন ✕' : 'Clear All ✕'}
            </button>
          </div>
        )}

        {/* Header with Title and Result Count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
            {selectedCategoryFilter 
              ? `${lang === 'bn' ? 'ক্যাটাগরি ভিত্তিক পোস্ট:' : 'Filtered Ads:'} ${getCategoryName(selectedCategoryFilter, lang)}`
              : memberFilter === 'free'
              ? (lang === 'bn' ? 'সাধারণ বিজ্ঞাপন' : 'Regular User Ads')
              : memberFilter === 'business'
              ? (lang === 'bn' ? 'বিজনেস মেম্বার বিজ্ঞাপন' : 'Business Member Ads')
              : memberFilter === 'premium_sellers'
              ? (lang === 'bn' ? 'গোল্ড ও সিলভার মেম্বার বিজ্ঞাপন' : 'Gold/Silver Member Ads')
              : memberFilter === 'verified'
              ? (lang === 'bn' ? 'ভেরিফাইড বিক্রেতার বিজ্ঞাপন' : 'Verified Seller Ads')
              : t('freshRecommendations')}
          </h2>
        </div>

        <div className={styles.adGrid}>
          {loading ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className={styles.adCard} style={{ opacity: 0.7, pointerEvents: 'none' }}>
                <div className={styles.adImageWrapper} style={{ background: '#e2e8f0', minHeight: '150px' }} />
                <div className={styles.adContent} style={{ padding: '0.85rem' }}>
                  <div style={{ height: '14px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '8px', width: '80%' }} />
                  <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '8px', width: '50%' }} />
                  <div style={{ height: '16px', background: '#e2e8f0', borderRadius: '4px', width: '40%' }} />
                </div>
              </div>
            ))
          ) : (() => {
            const displayedListings = listings.filter((ad) => {
              // 1. Seller & Ad Type (memberFilter)
              if (memberFilter === 'free') {
                const isPaidUser = ad.profiles?.membership_type && ad.profiles.membership_type.toLowerCase() !== 'free';
                const isPromoted = ad.is_featured || ad.promotion_type || ad.is_verified;
                if (isPaidUser || isPromoted) return false;
              } else if (memberFilter === 'business') {
                if (!ad.profiles?.membership_type?.toLowerCase().includes('business')) return false;
              } else if (memberFilter === 'premium_sellers') {
                const type = ad.profiles?.membership_type?.toLowerCase() || '';
                if (!type.includes('gold') && !type.includes('silver')) return false;
              } else if (memberFilter === 'verified') {
                const isVerified = ad.is_verified || (ad.profiles?.membership_type && ad.profiles.membership_type.toLowerCase() !== 'free');
                if (!isVerified) return false;
              }

              // 2. Category Filter
              if (selectedCategoryFilter) {
                if (!isCategoryMatch(ad, selectedCategoryFilter)) return false;
              }

              // 3. Location Filter (Division or District)
              if (selectedLocationFilter && selectedLocationFilter !== 'All of Bangladesh') {
                const loc = selectedLocationFilter;
                const isDivision = Object.keys(LOCATIONS).includes(loc);
                const isAllOfDivision = loc.startsWith('All of ') && loc.endsWith(' Division');
                if (isDivision || isAllOfDivision) {
                  const divisionName = isDivision ? loc : loc.replace('All of ', '').replace(' Division', '');
                  const districtsInDivision = LOCATIONS[divisionName];
                  if (districtsInDivision) {
                    const locs = [loc, ...districtsInDivision];
                    if (!locs.includes(ad.location)) return false;
                  } else if (ad.location !== loc) {
                    return false;
                  }
                } else if (ad.location !== loc) {
                  return false;
                }
              }

              // 4. Price Filter
              if (minPrice && parseFloat(ad.price) < parseFloat(minPrice)) return false;
              if (maxPrice && parseFloat(ad.price) > parseFloat(maxPrice)) return false;

              return true;
            });

            // Sort filtered listings
            const sortedListings = [...displayedListings].sort((a, b) => {
              if (sortBy === 'price_asc') {
                return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
              }
              if (sortBy === 'price_desc') {
                return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
              }
              // Default 'newest'
              if (memberFilter === 'all') {
                const isAPremium = Boolean(a.is_featured || a.promotion_type || a.is_verified || (a.profiles?.membership_type && a.profiles.membership_type.toLowerCase() !== 'free'));
                const isBPremium = Boolean(b.is_featured || b.promotion_type || b.is_verified || (b.profiles?.membership_type && b.profiles.membership_type.toLowerCase() !== 'free'));
                if (isAPremium && !isBPremium) return -1;
                if (!isAPremium && isBPremium) return 1;
              }
              return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });

            return sortedListings.length > 0 ? (
              sortedListings.map((ad) => (
                <Link href={`/ad/${ad.id}`} key={ad.id} className={styles.adCard}>
                  <div className={styles.adImageWrapper}>
                    {ad.is_featured ? (
                      <div className={styles.verifiedBadge} style={{ background: 'linear-gradient(135deg, #10b981, #047857)', color: '#ffffff', fontWeight: 900, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)' }}>
                        {lang === 'bn' ? '⭐ প্রিমিয়াম স্লাইডার' : '⭐ Premium Slider'}
                      </div>
                    ) : (ad.promotion_type && ad.promotion_type !== 'free') ? (
                      <div className={styles.verifiedBadge} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', fontWeight: 900, boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)' }}>
                        {lang === 'bn' ? '💎 প্রিমিয়াম' : '💎 Premium'}
                      </div>
                    ) : null}
                    {/* Heart / Favorite Button */}
                    <button 
                      className={`${styles.favoriteBtn} ${favorites.includes(ad.id) ? styles.active : ''}`}
                      onClick={(e) => toggleFavorite(e, ad.id)}
                      aria-label={favorites.includes(ad.id) ? (lang === 'bn' ? 'প্রিয় তালিকা থেকে বাদ দিন' : 'Remove from favorites') : (lang === 'bn' ? 'প্রিয় তালিকায় যোগ করুন' : 'Save to favorites')}
                    >
                      <Heart 
                        size={18} 
                        fill={favorites.includes(ad.id) ? "#ef4444" : "none"} 
                        color={favorites.includes(ad.id) ? "#ef4444" : "#64748b"} 
                      />
                    </button>
                    <Image 
                      src={ad.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image'} 
                      alt={`${ad.condition === 'New' ? (lang === 'bn' ? 'নতুন' : 'Brand New') : (lang === 'bn' ? 'ব্যবহৃত' : 'Used')} ${ad.title} for sale in ${ad.location || 'Bangladesh'} - BikroyNow`} 
                      className={styles.adImage}
                      loading="lazy"
                      priority={false}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      quality={75}
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div className={styles.adContent} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <h3 className={styles.adTitle}>{ad.title}</h3>
                    <p className={styles.adLocation}>
                      {t(ad.location)}
                    </p>
                    {getSellerBadge(ad.profiles, lang) && (
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '-0.1rem', marginBottom: '0.45rem' }}>
                        {getSellerBadge(ad.profiles, lang)}
                      </div>
                    )}
                    <div className={styles.adPrice}>{formatPrice(ad.price, lang)}</div>
                    <div className={styles.adFooter}>
                      <span className={styles.adTime}>
                        {getRelativeTime(ad.created_at, lang)} • {formatFullDate(ad.created_at, lang)}
                      </span>
                    </div>
                    {(ad.is_featured || (ad.promotion_type && ad.promotion_type !== 'free')) && (
                      <div style={{ marginTop: 'auto', paddingTop: '0.8rem', borderTop: '1px dashed #fef08a', textAlign: 'center' }}>
                        <span style={{ color: ad.is_featured ? '#047857' : '#d97706', fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                          {ad.is_featured 
                            ? (lang === 'bn' ? '⭐ প্রিমিয়াম স্লাইডার প্রমোশন' : '⭐ Premium Slider Promotion') 
                            : `💎 ${getPromotionBadgeText(ad.promotion_type, lang)}`}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className={styles.noAds}>{t('noAds')}</div>
            );
          })()}
        </div>
      </div>

      {/* === COMPREHENSIVE BOTTOM SEO CONTENT & BUYER GUIDE SECTION === */}
      <section className={styles.seoGuideSection}>
        <div className="container">
          <div className={styles.seoGuideCard}>
            <h2 className={styles.seoGuideHeading}>
              {lang === 'bn'
                ? 'BikroyNow – বাংলাদেশের বিশ্বস্ত লোকাল কেনাবেচার প্ল্যাটফর্ম'
                : 'BikroyNow – Bangladesh’s Trusted Local Buy & Sell Marketplace'}
            </h2>
            <p>
              {lang === 'bn'
                ? 'BikroyNow.com বাংলাদেশে নির্ভরযোগ্য ও আধুনিক অনলাইন ক্লাসিফাইড মার্কেটপ্লেস। এখানে আপনি আপনার ব্যবহৃত মোবাইল ফোন, কম্পিউটার ও ল্যাপটপ, হোম অ্যাপ্লায়েন্স, ইলেকট্রনিক্স গেজেট, ব্যবহৃত মোটরসাইকেল, গাড়ি, ফ্ল্যাট ও জমি কেনাবেচা করতে পারেন খুব সহজেই কোনো মধ্যস্বত্বভোগী ছাড়া।'
                : 'BikroyNow.com is Bangladesh’s premier modern online classifieds platform. Easily buy and sell second-hand smartphones, laptops, electronics, vehicles, and real estate directly with verified local buyers and sellers across Dhaka, Chittagong, Tangail, Sylhet, and all 64 districts.'}
            </p>
            
            <div className={styles.seoGuideGrid}>
              <div className={styles.seoGuideBox}>
                <h3>{lang === 'bn' ? '⚡ দ্রুত ও সহজ কেনাবেচা' : '⚡ Fast & Simple Trading'}</h3>
                <p>
                  {lang === 'bn'
                    ? 'কয়েক ক্লিকেই আপনার পণ্যের ছবি ও বিবরণ দিয়ে ১০০% বিনামূল্যে বিজ্ঞাপন পোস্ট করুন এবং মুহূর্তেই হাজারো সম্ভাব্য ক্রেতার কাছে পৌঁছান।'
                    : 'Post free advertisements in under two minutes with original photos and details to reach thousands of interested local buyers instantly.'}
                </p>
              </div>
              <div className={styles.seoGuideBox}>
                <h3>{lang === 'bn' ? '🛡️ নিরাপদ ও সরাসরি লেনদেন' : '🛡️ Safe & Verified Direct Deals'}</h3>
                <p>
                  {lang === 'bn'
                    ? 'বিক্রেতার সাথে সরাসরি চ্যাট বা ফোনে কথা বলে পণ্যের আসল অবস্থা যাচাই করুন। সামনাসামনি দেখা করে পণ্য বুঝে নিয়ে লেনদেন সম্পন্ন করুন।'
                    : 'Communicate directly with sellers via live chat or phone. Inspect the product in person to ensure authentic condition before making payment.'}
                </p>
              </div>
              <div className={styles.seoGuideBox}>
                <h3>{lang === 'bn' ? '📍 ৬৪ জেলার স্থানীয় মার্কেটপ্লেস' : '📍 Local Marketplace in 64 Districts'}</h3>
                <p>
                  {lang === 'bn'
                    ? 'ঢাকা, চট্টগ্রাম, রাজশাহী, খুলনা, সিলেট, বরিশাল, রংপুর এবং ময়মনসিংহসহ সারা বাংলাদেশের যেকোনো শহর ও উপজেলা থেকে সহজেই কেনাকাটা করুন।'
                    : 'Find deals right in your neighborhood across Dhaka, Chittagong, Tangail, Sylhet, and every district across Bangladesh.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    
      {/* Subcategory Scrollable Modal (Scrollable bottom-sheet popup) */}
      {activeCategoryModal && CATEGORIES[activeCategoryModal] && mounted && createPortal(
        <div 
          className={styles.subModalOverlay} 
          onClick={() => setActiveCategoryModal(null)}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div 
            className={styles.subModalContent} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.subModalHeader}>
              <div className={styles.subModalTitleWrap}>
                {(() => {
                  const catObj = categories.find(c => c.name === activeCategoryModal);
                  const Icon = catObj ? catObj.icon : Box;
                  return (
                    <div 
                      className={styles.iconCircleSmall} 
                      style={{ background: catObj ? catObj.bg : '#f1f5f9', color: catObj ? catObj.color : '#0f172a' }}
                    >
                      <Icon size={20} />
                    </div>
                  );
                })()}
                <div>
                  <h3 className={styles.subModalTitle}>
                    {getCategoryName(activeCategoryModal, lang)}
                  </h3>
                  <span className={styles.subModalSubtitle}>
                    {lang === 'bn' 
                      ? `${Object.keys(CATEGORIES[activeCategoryModal]).length} টি বিভাগ থেকে নির্বাচন করুন:` 
                      : `Select from ${Object.keys(CATEGORIES[activeCategoryModal]).length} subcategories:`}
                  </span>
                </div>
              </div>
              <button 
                type="button"
                className={styles.subModalCloseBtn}
                onClick={() => setActiveCategoryModal(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className={styles.subModalBody}>
              {/* All in Category */}
              <div 
                className={`${styles.subModalItem} ${selectedCategoryFilter === activeCategoryModal ? styles.subModalItemActive : ''}`}
                onClick={() => {
                  setSelectedCategoryFilter(activeCategoryModal);
                  setActiveCategory(activeCategoryModal);
                  setActiveSub(null);
                  setActiveCategoryModal(null);
                  setIsCategoriesExpanded(false);
                }}
              >
                <div className={styles.subModalItemLeft}>
                  <span className={styles.allBadgeIcon}>★</span>
                  <span className={styles.subModalItemTextBold}>
                    {lang === 'bn' ? `সকল ${getCategoryName(activeCategoryModal, lang)}` : `All in ${getCategoryName(activeCategoryModal, lang)}`}
                  </span>
                </div>
                <span className={styles.subModalArrow}>›</span>
              </div>

              {/* Subcategories */}
              {Object.keys(CATEGORIES[activeCategoryModal]).map((subKey) => {
                const isSelected = selectedCategoryFilter === subKey;
                return (
                  <div 
                    key={subKey}
                    className={`${styles.subModalItem} ${isSelected ? styles.subModalItemActive : ''}`}
                    onClick={() => {
                      setSelectedCategoryFilter(subKey);
                      setActiveCategory(activeCategoryModal);
                      setActiveSub(subKey);
                      setActiveCategoryModal(null);
                      setIsCategoriesExpanded(false);
                    }}
                  >
                    <div className={styles.subModalItemLeft}>
                      <span className={styles.subModalBullet}>•</span>
                      <span className={styles.subModalItemText}>
                        {getCategoryName(subKey, lang)}
                      </span>
                    </div>
                    <span className={styles.subModalArrow}>›</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reusable Consolidated Filter Drawer / Modal */}
      <FilterModal 
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={{
          memberFilter,
          category: selectedCategoryFilter,
          location: selectedLocationFilter,
          minPrice,
          maxPrice,
          sortBy
        }}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
        lang={lang}
      />

    </div>
  );
}