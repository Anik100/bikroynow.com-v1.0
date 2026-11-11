'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { getRelativeTime, formatPrice, getPromotionBadgeText, sortPremiumListings } from '../../lib/utils';
import { LOCATIONS, CATEGORIES, getCategoryName } from '../../lib/constants';
import { isCategoryMatch } from '../../lib/categoryMatcher';
import styles from './ads.module.css';
import { Filter, ChevronDown, List, Grid, Heart } from 'lucide-react';
import FilterModal from '../../components/FilterModal';

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

function AdsContent() {
  const { t, lang } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedLocation, setSelectedLocation] = useState(searchParams.get('location') || '');
  const [memberFilter, setMemberFilter] = useState(searchParams.get('type') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');
  
  // Interaction States
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  // Favorites state
  const [favorites, setFavorites] = useState([]);
  const [user, setUser] = useState(null);

  // Persist View Mode using Local Storage
  useEffect(() => {
    const savedView = localStorage.getItem('bikroynow_viewMode');
    if (savedView) {
      setViewMode(savedView);
    }
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
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', adId);
      if (error) {
        setFavorites(prev => [...prev, adId]);
        console.error('Error removing favorite:', error);
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: adId });
      if (error) {
        setFavorites(prev => [...prev, adId]);
        console.error('Error adding favorite:', error);
      }
    }
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('bikroynow_viewMode', mode);
  };

  useEffect(() => {
    setMinPrice(searchParams.get('minPrice') || '');
    setMaxPrice(searchParams.get('maxPrice') || '');
    setSelectedCategory(searchParams.get('category') || '');
    setSelectedLocation(searchParams.get('location') || '');
    setMemberFilter(searchParams.get('type') || 'all');
    setSortBy(searchParams.get('sort') || 'newest');
    fetchFilteredAds();
  }, [searchParams]);

  const fetchFilteredAds = async () => {
    setLoading(true);
    try {
      const apiRes = await fetch(`/api/listings?t=${Date.now()}`, { cache: 'no-store' });
      if (apiRes.ok) {
        const apiJson = await apiRes.json();
        let allItems = Array.isArray(apiJson.listings) ? apiJson.listings : [];
        let deletedIds = new Set();
        try {
          deletedIds = new Set(JSON.parse(localStorage.getItem('bikroynow_deleted_ad_ids') || '[]').map(String));
        } catch (e) {}
        allItems = allItems.filter(ad => (ad.status === 'active' || ad.status === 'approved') && !deletedIds.has(String(ad.id)));
        setListings(allItems);
      }
    } catch (err) {
      console.error('Error fetching filtered ads:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (applied) => {
    const params = new URLSearchParams();
    if (applied.minPrice) params.set('minPrice', applied.minPrice);
    if (applied.maxPrice) params.set('maxPrice', applied.maxPrice);
    if (applied.category) params.set('category', applied.category);
    if (applied.location) params.set('location', applied.location);
    if (applied.memberFilter && applied.memberFilter !== 'all') params.set('type', applied.memberFilter);
    if (applied.sortBy && applied.sortBy !== 'newest') params.set('sort', applied.sortBy);
    
    const q = searchParams.get('q') || searchParams.get('search');
    if (q) params.set('q', q);

    router.push(`/ads?${params.toString()}`);
    setMinPrice(applied.minPrice || '');
    setMaxPrice(applied.maxPrice || '');
    setSelectedCategory(applied.category || '');
    setSelectedLocation(applied.location || '');
    setMemberFilter(applied.memberFilter || 'all');
    setSortBy(applied.sortBy || 'newest');
  };

  const resetFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setSelectedCategory('');
    setSelectedLocation('');
    setMemberFilter('all');
    setSortBy('newest');
    router.push('/ads');
  };

  const handleTabSwitch = (type) => {
    setMemberFilter(type);
    const params = new URLSearchParams(searchParams.toString());
    if (type === 'all') {
      params.delete('type');
    } else {
      params.set('type', type);
    }
    router.push(`/ads?${params.toString()}`);
  };

  const hasActiveFilters = Boolean(
    (memberFilter && memberFilter !== 'all') ||
    selectedCategory ||
    selectedLocation ||
    minPrice ||
    maxPrice ||
    (sortBy && sortBy !== 'newest')
  );

  // Filter listings
  const filteredListings = listings.filter((ad) => {
    // 1. Search query
    const q = searchParams.get('q') || searchParams.get('search');
    if (q) {
      const queryTerm = q.toLowerCase().trim();
      const titleMatch = ad.title && ad.title.toLowerCase().includes(queryTerm);
      const descMatch = ad.description && ad.description.toLowerCase().includes(queryTerm);
      if (!titleMatch && !descMatch) return false;
    }

    // 2. Member & Seller Type Filter
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

    // 3. Category Filter
    if (selectedCategory) {
      if (!isCategoryMatch(ad, selectedCategory)) return false;
    }

    // 4. Location Filter
    if (selectedLocation && selectedLocation !== 'All of Bangladesh') {
      const loc = selectedLocation;
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

    // 5. Price Filter
    if (minPrice && parseFloat(ad.price) < parseFloat(minPrice)) return false;
    if (maxPrice && parseFloat(ad.price) > parseFloat(maxPrice)) return false;

    return true;
  });

  // Sort filtered listings
  const sortedListings = [...filteredListings].sort((a, b) => {
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

  return (
    <div className={styles.adsWrapper}>
      <div className="container">
        <div className={styles.adsLayoutFullWidth}>
          {/* Top Action Bar: Filter Icon (Left) | All Ads (Center) | Regular Ads (Right) + View Toggle */}
          <div className={styles.topFilterBar}>
            <div className={styles.filterBarWrapper}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, flexWrap: 'wrap' }}>
                {/* 1. Left: Compact Filter Icon Button */}
                <button 
                  type="button"
                  className={`${styles.premiumFilterBtn} ${hasActiveFilters ? styles.activeFilterHighlight : ''}`}
                  onClick={() => setShowFilters(true)}
                  title={lang === 'bn' ? 'ফিল্টার করুন' : 'Filter Ads'}
                  style={{ position: 'relative' }}
                >
                  <Filter size={16} />
                  <span>{t('filterAds')}</span>
                  {hasActiveFilters && (
                    <span style={{
                      width: '8px',
                      height: '8px',
                      background: '#10b981',
                      borderRadius: '50%',
                      border: '1.5px solid #ffffff',
                      display: 'inline-block'
                    }} />
                  )}
                </button>

                {/* 2. Center: All Ads Button */}
                <button
                  type="button"
                  onClick={() => handleTabSwitch('all')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    border: memberFilter === 'all' ? '1.5px solid #008b5e' : '1.5px solid #cbd5e1',
                    background: memberFilter === 'all' ? '#008b5e' : '#ffffff',
                    color: memberFilter === 'all' ? '#ffffff' : '#475569',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {lang === 'bn' ? 'সকল বিজ্ঞাপন' : 'All Ads'}
                </button>

                {/* 3. Right: Regular Ads Button */}
                <button
                  type="button"
                  onClick={() => handleTabSwitch('free')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    border: memberFilter === 'free' ? '1.5px solid #008b5e' : '1.5px solid #cbd5e1',
                    background: memberFilter === 'free' ? '#008b5e' : '#ffffff',
                    color: memberFilter === 'free' ? '#ffffff' : '#475569',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {lang === 'bn' ? 'সাধারণ বিজ্ঞাপন' : 'Regular Ads'}
                </button>
              </div>

              {/* View Toggle (List vs Grid) */}
              <div className={styles.viewToggleGroup}>
                <button 
                  className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.activeView : ''}`}
                  onClick={() => handleViewModeChange('list')}
                  title={lang === 'bn' ? 'লিস্ট ভিউ' : 'List View'}
                >
                  <List size={18} />
                </button>
                <button 
                  className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.activeView : ''}`}
                  onClick={() => handleViewModeChange('grid')}
                  title={lang === 'bn' ? 'গ্রিড ভিউ' : 'Grid View'}
                >
                  <Grid size={18} />
                </button>
              </div>
            </div>

            {/* Active Filter Badges */}
            {hasActiveFilters && (
              <div className={styles.activeFiltersRow}>
                {memberFilter !== 'all' && (
                  <span className={styles.filterBadge}>
                    {memberFilter === 'free' ? (lang === 'bn' ? '👤 সাধারণ বিজ্ঞাপন' : 'Regular Ads') :
                     memberFilter === 'business' ? (lang === 'bn' ? '💼 বিজনেস মেম্বার' : 'Business Members') :
                     memberFilter === 'premium_sellers' ? (lang === 'bn' ? '🥇 গোল্ড/সিলভার মেম্বার' : 'Gold/Silver Members') :
                     memberFilter === 'verified' ? (lang === 'bn' ? '🛡️ ভেরিফাইড বিক্রেতা' : 'Verified Sellers') : memberFilter}
                    <button type="button" onClick={() => handleTabSwitch('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: '4px' }}>✕</button>
                  </span>
                )}
                {selectedCategory && (
                  <span className={styles.filterBadge}>
                    🏷️ {getCategoryName(selectedCategory, lang)}
                    <button type="button" onClick={() => applyFilters({ memberFilter, category: '', location: selectedLocation, minPrice, maxPrice, sortBy })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: '4px' }}>✕</button>
                  </span>
                )}
                {selectedLocation && (
                  <span className={styles.filterBadge}>
                    📍 {selectedLocation}
                    <button type="button" onClick={() => applyFilters({ memberFilter, category: selectedCategory, location: '', minPrice, maxPrice, sortBy })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: '4px' }}>✕</button>
                  </span>
                )}
                {(minPrice || maxPrice) && (
                  <span className={styles.filterBadge}>
                    💰 {minPrice ? `≥ ৳${minPrice}` : ''} {maxPrice ? `≤ ৳${maxPrice}` : ''}
                    <button type="button" onClick={() => applyFilters({ memberFilter, category: selectedCategory, location: selectedLocation, minPrice: '', maxPrice: '', sortBy })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: '4px' }}>✕</button>
                  </span>
                )}
                {sortBy && sortBy !== 'newest' && (
                  <span className={styles.filterBadge}>
                    ↕️ {sortBy === 'price_asc' ? (lang === 'bn' ? 'দাম: কম থেকে বেশি' : 'Price: Low to High') : (lang === 'bn' ? 'দাম: বেশি থেকে কম' : 'Price: High to Low')}
                    <button type="button" onClick={() => applyFilters({ memberFilter, category: selectedCategory, location: selectedLocation, minPrice, maxPrice, sortBy: 'newest' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: '4px' }}>✕</button>
                  </span>
                )}
                <button className={styles.badgeResetBtn} onClick={resetFilters}>
                  {lang === 'bn' ? 'সব মুছুন' : 'Clear All'}
                </button>
              </div>
            )}
          </div>

          {/* Full Width Compact Ad List (Bikroy.com Horizontal Stack) */}
          <main className={styles.adsMainFull}>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>
                {selectedCategory 
                  ? getCategoryName(selectedCategory, lang) 
                  : memberFilter === 'free' 
                  ? (lang === 'bn' ? 'সাধারণ বিজ্ঞাপন' : 'Regular User Ads')
                  : t('allAds').replace(' →', '')}
                <span className={styles.resultsCount}>({sortedListings.length} {t('results')})</span>
              </h1>
            </div>

            <div className={viewMode === 'list' ? styles.adListFull : styles.adGridFull}>
              {loading ? (
                <div style={{gridColumn: '1/-1', textAlign: 'center', padding: '2rem'}}>{t('loading')}</div>
              ) : sortedListings.length > 0 ? (
                sortedListings.map((ad) => (
                  <Link href={`/ad/${ad.id}`} key={ad.id} className={viewMode === 'list' ? styles.adCard : styles.adCardGrid}>
                    {/* Left Compact Image */}
                    <div className={styles.imageBox}>
                      {ad.is_featured ? (
                        <div className={styles.verifiedBadge} style={{ background: 'linear-gradient(135deg, #10b981, #047857)', color: '#ffffff', fontWeight: 900 }}>
                          {lang === 'bn' ? '⭐ প্রিমিয়াম স্লাইডার' : '⭐ Premium Slider'}
                        </div>
                      ) : (ad.promotion_type && ad.promotion_type !== 'free') ? (
                        <div className={styles.verifiedBadge} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', fontWeight: 900 }}>
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
                          size={15} 
                          fill={favorites.includes(ad.id) ? "#ef4444" : "none"} 
                          color={favorites.includes(ad.id) ? "#ef4444" : "#64748b"} 
                        />
                      </button>
                      <img 
                        src={ad.images[0] || 'https://via.placeholder.com/300x200?text=No+Image'} 
                        alt={`${ad.condition === 'New' ? (lang === 'bn' ? 'নতুন' : 'Brand New') : (lang === 'bn' ? 'ব্যবহৃত' : 'Used')} ${ad.title} for sale in ${ad.location || 'Bangladesh'} - BikroyNow`} 
                        loading="lazy"
                        decoding="async"
                        width={140}
                        height={105}
                      />
                    </div>
                    
                    {/* Right Compact Information Wrapper */}
                    <div className={styles.adInfo} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div className={styles.titleMeta}>
                        <h3 className={styles.adTitle}>{ad.title}</h3>
                        <p className={styles.adMeta}>
                          {t(ad.location)}
                          {getSellerBadge(ad.profiles, lang)}
                        </p>
                      </div>
                      <div className={styles.priceTime}>
                        <div className={styles.adPrice}>{formatPrice(ad.price, lang)}</div>
                        <div className={styles.cardFooter}>
                          {getRelativeTime(ad.created_at, lang)}
                        </div>
                      </div>
                      {(ad.is_featured || (ad.promotion_type && ad.promotion_type !== 'free')) && (
                        <div style={{ marginTop: 'auto', paddingTop: '0.6rem', borderTop: '1px dashed #fef08a', textAlign: 'center', alignSelf: 'stretch' }}>
                          <span style={{ color: ad.is_featured ? '#047857' : '#d97706', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
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
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Shared Consolidated Filter Drawer / Modal */}
      <FilterModal 
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={{
          memberFilter,
          category: selectedCategory,
          location: selectedLocation,
          minPrice,
          maxPrice,
          sortBy
        }}
        onApply={applyFilters}
        onReset={resetFilters}
        lang={lang}
        totalCount={sortedListings.length}
      />
    </div>
  );
}

export default function AllAds() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdsContent />
    </Suspense>
  );
}
