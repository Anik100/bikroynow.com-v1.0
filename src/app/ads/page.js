'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { getRelativeTime, formatPrice, getPromotionBadgeText, sortPremiumListings } from '../../lib/utils';
import { LOCATIONS, CATEGORIES } from '../../lib/constants';
import styles from './ads.module.css';
import { Filter, ChevronDown, X, List, Grid, Heart } from 'lucide-react';

const CAT_ICONS = {
  Electronics: '⚡',
  'Mobile Phones': '📱',
  Computers: '💻',
  Vehicles: '🚗',
  Property: '🏠',
  Jobs: '💼',
  'অন্যান্য': '📦',
};

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
  
  // Filters
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedLocation, setSelectedLocation] = useState(searchParams.get('location') || '');
  const [onlyVerified, setOnlyVerified] = useState(searchParams.get('verified') === 'true');
  const [memberFilter, setMemberFilter] = useState('all'); // 'all', 'featured_premium', 'business', 'premium_sellers', 'verified'
  
  // Interaction States
  const [showFilters, setShowFilters] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  const [locationSearch, setLocationSearch] = useState('');
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [locationType, setLocationType] = useState('division'); // 'division' or 'district'

  useEffect(() => {
    if (!showLocationModal) {
      setSelectedDivision(null);
      setLocationType('division');
      setLocationSearch('');
    }
  }, [showLocationModal]);

  const [selectedMainCategory, setSelectedMainCategory] = useState(null);
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

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('bikroynow_viewMode', mode);
  };

  useEffect(() => {
    setMinPrice(searchParams.get('minPrice') || '');
    setMaxPrice(searchParams.get('maxPrice') || '');
    setSelectedCategory(searchParams.get('category') || '');
    setSelectedLocation(searchParams.get('location') || '');
    setOnlyVerified(searchParams.get('verified') === 'true');
    fetchFilteredAds();
  }, [searchParams]);

  const fetchFilteredAds = async () => {
    setLoading(true);
    try {
      const apiRes = await fetch(`/api/listings?t=${Date.now()}`, { cache: 'no-store' });
      if (apiRes.ok) {
        const apiJson = await apiRes.json();
        let allItems = Array.isArray(apiJson.listings) ? apiJson.listings : [];

        // Apply filters locally in Javascript to bypass RLS restrictions completely for all accounts
        const cat = searchParams.get('category');
        const loc = searchParams.get('location');
        const minP = searchParams.get('minPrice');
        const maxP = searchParams.get('maxPrice');
        const q = searchParams.get('q');
        const verifiedOnly = searchParams.get('verified') === 'true';

        let filtered = allItems;

        // 1. Category Filter
        if (cat) {
          if (CATEGORIES[cat]) {
            const subcategories = CATEGORIES[cat];
            const specificItems = [];
            Object.entries(subcategories).forEach(([subKey, items]) => {
              items.forEach(item => specificItems.push(item));
            });
            filtered = filtered.filter(item => specificItems.includes(item.category_id));
          } else {
            filtered = filtered.filter(item => item.category_id === cat);
          }
        }

        // 2. Location Filter
        if (loc && loc !== 'All of Bangladesh') {
          const isDivision = Object.keys(LOCATIONS).includes(loc);
          const isAllOfDivision = loc.startsWith('All of ') && loc.endsWith(' Division');
          
          if (isDivision || isAllOfDivision) {
            const divisionName = isDivision ? loc : loc.replace('All of ', '').replace(' Division', '');
            const districtsInDivision = LOCATIONS[divisionName];
            if (districtsInDivision) {
              const locs = [loc, ...districtsInDivision];
              filtered = filtered.filter(item => locs.includes(item.location));
            } else {
              filtered = filtered.filter(item => item.location === loc);
            }
          } else {
            filtered = filtered.filter(item => item.location === loc);
          }
        }

        // 3. Price Filter
        if (minP) {
          filtered = filtered.filter(item => item.price >= parseFloat(minP));
        }
        if (maxP) {
          filtered = filtered.filter(item => item.price <= parseFloat(maxP));
        }

        // 4. Verified Only Filter
        if (verifiedOnly) {
          filtered = filtered.filter(item => item.is_verified);
        }

        // 5. Search query Filter
        if (q) {
          const queryTerm = q.toLowerCase().trim();
          filtered = filtered.filter(item => 
            (item.title && item.title.toLowerCase().includes(queryTerm)) ||
            (item.description && item.description.toLowerCase().includes(queryTerm))
          );
        }

        setListings(sortPremiumListings(filtered));
      }
    } catch (err) {
      console.error('Error fetching filtered ads:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedLocation) params.set('location', selectedLocation);
    if (onlyVerified) params.set('verified', 'true');
    router.push(`/ads?${params.toString()}`);
    setShowFilters(false); // Modal goes back up upon applying
  };

  const resetFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setSelectedCategory('');
    setSelectedLocation('');
    setOnlyVerified(false);
    router.push('/ads');
    setShowFilters(false); // Modal goes back up upon resetting
  };

  return (
    <div className={styles.adsWrapper}>
      <div className="container">
        <div className={styles.adsLayoutFullWidth}>
          {/* Top Filter Button Bar (Premium compact centering) */}
          <div className={styles.topFilterBar}>
            <div className={styles.filterBarWrapper}>
              <button 
                className={styles.premiumFilterBtn}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter size={15} />
                <span>{t('filterAds')}</span>
                <ChevronDown 
                  size={14} 
                  style={{ 
                    transform: showFilters ? 'rotate(180deg)' : 'rotate(0deg)', 
                    transition: 'transform 0.2s ease' 
                  }} 
                />
              </button>

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
            {(selectedCategory || selectedLocation || minPrice || maxPrice || onlyVerified) && (
              <div className={styles.activeFiltersRow}>
                {selectedCategory && <span className={styles.filterBadge}>🏷️ {t(selectedCategory)}</span>}
                {selectedLocation && <span className={styles.filterBadge}>📍 {t(selectedLocation)}</span>}
                {onlyVerified && <span className={styles.filterBadge}>⭐ {lang === 'bn' ? 'ভেরিফাইড' : 'Verified'}</span>}
                {(minPrice || maxPrice) && (
                  <span className={styles.filterBadge}>
                    💰 {minPrice ? `≥ ${minPrice}` : ''} {maxPrice ? `≤ ${maxPrice}` : ''} Tk
                  </span>
                )}
                <button className={styles.badgeResetBtn} onClick={resetFilters}>
                  {lang === 'bn' ? 'সব মুছুন' : 'Clear All'}
                </button>
              </div>
            )}
          </div>

          {/* Floating Filter Options Overlay Panel (Overlay on top of ads grid) */}
          {showFilters && (
            <div className={styles.floatingFilterOverlay} onClick={() => setShowFilters(false)}>
              <div className={styles.floatingFilterCard} onClick={e => e.stopPropagation()}>
                <div className={styles.floatingFilterHeader}>
                  <h4>{t('filterAds')}</h4>
                  <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowFilters(false)} />
                </div>
                
                <div className={styles.floatingFilterBody}>
                  {/* Category Filter Group */}
                  <div className={styles.filterGroup}>
                    <label>{t('category')}</label>
                    <div className={styles.filterSelector} onClick={() => setShowCategoryModal(true)}>
                      <span>{selectedCategory ? t(selectedCategory) : (lang === 'bn' ? 'সব ক্যাটাগরি' : 'All Categories')}</span>
                      <ChevronDown size={16} />
                    </div>
                  </div>

                  {/* Location Filter Group */}
                  <div className={styles.filterGroup}>
                    <label>{t('location')}</label>
                    <div className={styles.filterSelector} onClick={() => setShowLocationModal(true)}>
                      <span>{selectedLocation ? t(selectedLocation) : t('allLocations')}</span>
                      <ChevronDown size={16} />
                    </div>
                  </div>

                  {/* Price Filter Group */}
                  <div className={styles.filterGroup}>
                    <label>{t('price')} (Tk)</label>
                    <div className={styles.priceInputs}>
                      <input 
                        type="number" placeholder={t('min')} 
                        value={minPrice} onChange={(e) => setMinPrice(e.target.value)} 
                      />
                      <input 
                        type="number" placeholder={t('max')} 
                        value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} 
                      />
                    </div>
                  </div>

                  {/* Verified Filter Group */}
                  <div className={styles.filterGroup} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                    <label style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#1e293b', fontSize: '0.82rem', fontWeight: 700 }} htmlFor="verified-toggle">
                      ⭐ {lang === 'bn' ? 'শুধুমাত্র ভেরিফাইড বিজ্ঞাপন' : 'Verified Ads Only'}
                    </label>
                    <input 
                      type="checkbox" 
                      id="verified-toggle"
                      checked={onlyVerified} 
                      onChange={(e) => setOnlyVerified(e.target.checked)} 
                      style={{ 
                        width: '18px', 
                        height: '18px', 
                        accentColor: '#008b5e', 
                        cursor: 'pointer' 
                      }} 
                    />
                  </div>
                </div>

                <div className={styles.filterActions}>
                  <button className={styles.applyBtn} onClick={applyFilters}>{t('apply')}</button>
                  <button className={styles.resetBtn} onClick={resetFilters}>{t('reset')}</button>
                </div>
              </div>
            </div>
          )}

          {/* Full Width Compact Ad List (Bikroy.com Horizontal Stack) */}
          {(() => {
            const filteredListings = listings.filter(ad => {
              if (memberFilter === 'featured_premium') {
                return ad.is_featured || ad.promotion_type || ad.is_verified;
              }
              if (memberFilter === 'business') {
                return ad.profiles?.membership_type?.toLowerCase().includes('business');
              }
              if (memberFilter === 'premium_sellers') {
                const type = ad.profiles?.membership_type?.toLowerCase() || '';
                return type.includes('gold') || type.includes('silver');
              }
              if (memberFilter === 'verified') {
                return ad.is_verified || (ad.profiles?.membership_type && ad.profiles.membership_type.toLowerCase() !== 'free');
              }
              if (memberFilter === 'free') {
                const isPaidUser = ad.profiles?.membership_type && ad.profiles.membership_type.toLowerCase() !== 'free';
                const isPromoted = ad.is_featured || ad.promotion_type || ad.is_verified;
                return !isPaidUser && !isPromoted;
              }
              return true;
            });

            return (
              <main className={styles.adsMainFull}>
                <div className={styles.pageHeader}>
                  <h1 className={styles.pageTitle}>
                    {selectedCategory ? t(selectedCategory) : t('allAds').replace(' →', '')}
                    <span className={styles.resultsCount}>({filteredListings.length} {t('results')})</span>
                  </h1>
                </div>

                {/* Quick Member & Promotion Filter Chips Bar */}
                <div style={{
                  display: 'flex',
                  gap: '0.45rem',
                  overflowX: 'auto',
                  paddingBottom: '0.75rem',
                  marginBottom: '1rem',
                  scrollbarWidth: 'none',
                  WebkitOverflowScrolling: 'touch'
                }}>
                  <button
                    onClick={() => setMemberFilter('all')}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '20px',
                      border: memberFilter === 'all' ? '2px solid #008b5e' : '1px solid #cbd5e1',
                      background: memberFilter === 'all' ? '#e6f4ef' : '#ffffff',
                      color: memberFilter === 'all' ? '#008b5e' : '#475569',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: memberFilter === 'all' ? '0 2px 8px rgba(0, 139, 94, 0.15)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    🌐 {lang === 'bn' ? 'সকল বিজ্ঞাপন' : 'All Ads'}
                  </button>

                  <button
                    onClick={() => setMemberFilter('free')}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '20px',
                      border: memberFilter === 'free' ? '2px solid #64748b' : '1px solid #cbd5e1',
                      background: memberFilter === 'free' ? '#f1f5f9' : '#ffffff',
                      color: memberFilter === 'free' ? '#0f172a' : '#475569',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: memberFilter === 'free' ? '0 2px 8px rgba(100, 116, 139, 0.15)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    🆓 {lang === 'bn' ? 'ফ্রি সাধারণ পোস্ট' : 'Free Regular Ads'}
                  </button>

                  <button
                    onClick={() => setMemberFilter('featured_premium')}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '20px',
                      border: memberFilter === 'featured_premium' ? '2px solid #d97706' : '1px solid #cbd5e1',
                      background: memberFilter === 'featured_premium' ? '#fffdf5' : '#ffffff',
                      color: memberFilter === 'featured_premium' ? '#b45309' : '#475569',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: memberFilter === 'featured_premium' ? '0 2px 8px rgba(217, 119, 6, 0.15)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    ⭐ {lang === 'bn' ? 'প্রিমিয়াম অ্যাড' : 'Premium Ads'}
                  </button>

                  <button
                    onClick={() => setMemberFilter('business')}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '20px',
                      border: memberFilter === 'business' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: memberFilter === 'business' ? '#eff6ff' : '#ffffff',
                      color: memberFilter === 'business' ? '#1d4ed8' : '#475569',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: memberFilter === 'business' ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    💼 {lang === 'bn' ? 'বিক্রয়নাউ বিজনেস মেম্বার' : 'Business Members'}
                  </button>

                  <button
                    onClick={() => setMemberFilter('premium_sellers')}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '20px',
                      border: memberFilter === 'premium_sellers' ? '2px solid #ca8a04' : '1px solid #cbd5e1',
                      background: memberFilter === 'premium_sellers' ? '#fefce8' : '#ffffff',
                      color: memberFilter === 'premium_sellers' ? '#854d0e' : '#475569',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: memberFilter === 'premium_sellers' ? '0 2px 8px rgba(202, 138, 4, 0.15)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    🥇 {lang === 'bn' ? 'গোল্ড/সিলভার মেম্বারশিপ' : 'Gold/Silver Members'}
                  </button>

                  <button
                    onClick={() => setMemberFilter('verified')}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '20px',
                      border: memberFilter === 'verified' ? '2px solid #059669' : '1px solid #cbd5e1',
                      background: memberFilter === 'verified' ? '#ecfdf5' : '#ffffff',
                      color: memberFilter === 'verified' ? '#047857' : '#475569',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: memberFilter === 'verified' ? '0 2px 8px rgba(5, 150, 105, 0.15)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    🛡️ {lang === 'bn' ? 'ভেরিফাইড বিক্রেতা' : 'Verified Sellers'}
                  </button>
                </div>

                <div className={viewMode === 'list' ? styles.adListFull : styles.adGridFull}>
                  {loading ? (
                    <div style={{gridColumn: '1/-1', textAlign: 'center', padding: '2rem'}}>{t('loading')}</div>
                  ) : filteredListings.length > 0 ? (
                    filteredListings.map((ad) => (
                      <Link href={`/ad/${ad.id}`} key={ad.id} className={viewMode === 'list' ? styles.adCard : styles.adCardGrid}>
                        {/* Left Compact Image */}
                        <div className={styles.imageBox}>
                          {ad.is_featured ? (
                            <div className={styles.verifiedBadge} style={{ background: 'linear-gradient(135deg, #10b981, #047857)', color: '#ffffff', fontWeight: 900 }}>
                              {lang === 'bn' ? '⭐ স্লাইডার অ্যাড' : '⭐ Slider Ad'}
                            </div>
                          ) : ad.is_verified ? (
                            <div className={styles.verifiedBadge}>
                              {lang === 'bn' ? '★ টপ অ্যাড' : '★ Top Ad'}
                            </div>
                          ) : null}
                          {/* Heart / Favorite Button */}
                          <button 
                            className={`${styles.favoriteBtn} ${favorites.includes(ad.id) ? styles.active : ''}`}
                            onClick={(e) => toggleFavorite(e, ad.id)}
                          >
                            <Heart 
                              size={15} 
                              fill={favorites.includes(ad.id) ? "#ef4444" : "none"} 
                              color={favorites.includes(ad.id) ? "#ef4444" : "#64748b"} 
                            />
                          </button>
                          <img 
                            src={ad.images[0] || 'https://via.placeholder.com/300x200?text=No+Image'} 
                            alt={ad.title} 
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
                          {(ad.is_featured || ad.is_verified) && (
                            <div style={{ marginTop: 'auto', paddingTop: '0.6rem', borderTop: '1px dashed #fef08a', textAlign: 'center', alignSelf: 'stretch' }}>
                              <span style={{ color: ad.is_featured ? '#047857' : '#d97706', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                {ad.is_featured 
                                  ? (lang === 'bn' ? '⭐ স্লাইডার অফিশিয়াল প্রমোশন' : '⭐ Slider Official Promotion')
                                  : `★ ${getPromotionBadgeText(ad.promotion_type, lang)}`}
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
            );
          })()}
        </div>
      </div>

      {/* Reusable Location Modal for Filters */}
      {showLocationModal && (
        <div className={styles.darkModalOverlay} onClick={() => setShowLocationModal(false)}>
          <div className={styles.darkModal} onClick={e => e.stopPropagation()}>
            <div className={styles.darkModalHeader}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3>{t('selectLocation')}</h3>
                <X style={{cursor: 'pointer'}} onClick={() => setShowLocationModal(false)} />
              </div>
              <input 
                type="text" placeholder={t('searchLoc')} 
                className={styles.darkModalSearch}
                value={locationSearch} onChange={e => setLocationSearch(e.target.value)}
              />
            </div>
            <div className={styles.radioList}>
              {locationSearch ? (
                // FLAT SEARCH RESULTS
                Object.entries(LOCATIONS).flatMap(([div, dists]) => {
                  const isDivMatch = div.toLowerCase().includes(locationSearch.toLowerCase());
                  const filtered = dists.filter(d => d.toLowerCase().includes(locationSearch.toLowerCase()));
                  let res = [];
                  if (isDivMatch || filtered.length > 0) {
                    res.push({name: div, type: 'division'});
                    res.push({name: `All of ${div} Division`, type: 'district', parent: div});
                    filtered.forEach(d => res.push({name: d, type: 'district', parent: div}));
                  }
                  return res;
                }).slice(0, 50).map((loc, i) => (
                  <label key={i} className={styles.radioItem}>
                    <div className={styles.locInfo}>
                      <span className={styles.locName}>
                        {t(loc.name)} {loc.type === 'division' ? (lang === 'bn' ? 'বিভাগ' : 'Division') : ''}
                      </span>
                      {loc.parent && <span className={styles.locParent}>{t(loc.parent)}</span>}
                    </div>
                    <input type="radio" name="floc" onChange={() => { setSelectedLocation(loc.name); setShowLocationModal(false); setLocationSearch(''); }} checked={selectedLocation === loc.name} />
                    <span className={styles.radioCircle}></span>
                  </label>
                ))
              ) : (
                // HIERARCHICAL ACCORDION/TAB VIEW
                <>
                  {/* Always show "All of Bangladesh" at the top */}
                  <label className={styles.radioItem}>
                    <span>{t('allLocations')}</span>
                    <input type="radio" name="floc" onChange={() => { setSelectedLocation(''); setShowLocationModal(false); }} checked={!selectedLocation || selectedLocation === 'All of Bangladesh'} />
                    <span className={styles.radioCircle}></span>
                  </label>

                  {locationType === 'division' ? (
                    // DIVISION LIST VIEW
                    Object.keys(LOCATIONS).map(div => (
                      <label key={div} className={styles.radioItem}>
                        <div className={styles.locInfo}>
                          <span className={styles.locName}>
                            {t(div)} {lang === 'bn' ? 'বিভাগ' : 'Division'}
                          </span>
                        </div>
                        <input 
                          type="radio" 
                          name="floc" 
                          onChange={() => {
                            setSelectedDivision(div);
                            setLocationType('district');
                          }}
                          checked={selectedLocation === div || (selectedLocation.startsWith('All of ') && selectedLocation.includes(div))}
                        />
                        <span className={styles.radioCircle}></span>
                      </label>
                    ))
                  ) : (
                    // DISTRICT LIST VIEW FOR SELECTED DIVISION
                    <>
                      <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button 
                          type="button"
                          onClick={() => {
                            setLocationType('division');
                            setSelectedDivision(null);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#008b5e',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.9rem',
                            padding: 0
                          }}
                        >
                          ← {lang === 'bn' ? 'বিভাগসমূহে ফিরে যান' : 'Back to Divisions'}
                        </button>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                          {t(selectedDivision)}
                        </span>
                      </div>

                      {[`All of ${selectedDivision} Division`, ...LOCATIONS[selectedDivision]].map(dist => (
                        <label key={dist} className={styles.radioItem}>
                          <div className={styles.locInfo}>
                            <span className={styles.locName}>{t(dist)}</span>
                          </div>
                          <input 
                            type="radio" 
                            name="floc" 
                            onChange={() => {
                              setSelectedLocation(dist);
                              setShowLocationModal(false);
                            }}
                            checked={selectedLocation === dist}
                          />
                          <span className={styles.radioCircle}></span>
                        </label>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reusable Category Modal for Filters */}
      {showCategoryModal && (
        <div className={styles.darkModalOverlay} onClick={() => { setShowCategoryModal(false); setSelectedMainCategory(null); }}>
          <div className={styles.darkModal} onClick={e => e.stopPropagation()}>
            <div className={styles.darkModalHeader}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3>
                  {selectedMainCategory
                    ? (lang === 'bn' ? 'উপ-ক্যাটাগরি' : 'Select Subcategory')
                    : (lang === 'bn' ? 'ক্যাটাগরি নির্বাচন করুন' : 'Select Category')}
                </h3>
                <X style={{cursor: 'pointer'}} onClick={() => { setShowCategoryModal(false); setSelectedMainCategory(null); }} />
              </div>
            </div>
            <div className={styles.radioList}>
              {!selectedMainCategory ? (
                <>
                  <label className={styles.radioItem}>
                    <span>{lang === 'bn' ? 'সব ক্যাটাগরি' : 'All Categories'}</span>
                    <input 
                      type="radio" 
                      name="fcat" 
                      checked={!selectedCategory}
                      onChange={() => { setSelectedCategory(''); setShowCategoryModal(false); }} 
                    />
                    <span className={styles.radioCircle}></span>
                  </label>

                  {Object.keys(CATEGORIES).map(main => (
                    <label 
                      key={main} 
                      className={styles.radioItem}
                      onClick={() => setSelectedMainCategory(main)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{CAT_ICONS[main] || '📦'}</span>
                        <span>{t(main)}</span>
                      </div>
                      <span style={{ color: '#9ca3af', marginLeft: 'auto' }}>›</span>
                    </label>
                  ))}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => setSelectedMainCategory(null)}
                  >
                    ← {lang === 'bn' ? 'ফিরে যান' : 'Back'}
                  </button>

                  <label className={styles.radioItem}>
                    <span style={{ fontWeight: 'bold' }}>
                      {lang === 'bn' ? `সব ${t(selectedMainCategory)}-এ` : `All in ${t(selectedMainCategory)}`}
                    </span>
                    <input 
                      type="radio" 
                      name="fcat" 
                      checked={selectedCategory === selectedMainCategory}
                      onChange={() => { 
                        setSelectedCategory(selectedMainCategory); 
                        setShowCategoryModal(false); 
                        setSelectedMainCategory(null);
                      }} 
                    />
                    <span className={styles.radioCircle}></span>
                  </label>

                  {Object.entries(CATEGORIES[selectedMainCategory]).map(([sub, items]) => (
                    <div key={sub} style={{ padding: '0.2rem 0' }}>
                      <div className={styles.subCatHeader}>{t(sub)}</div>
                      {items.map(item => (
                        <label key={item} className={styles.radioItem}>
                          <span style={{ paddingLeft: '0.5rem' }}>{t(item)}</span>
                          <input 
                            type="radio" 
                            name="fcat" 
                            checked={selectedCategory === item}
                            onChange={() => { 
                              setSelectedCategory(item); 
                              setShowCategoryModal(false); 
                              setSelectedMainCategory(null);
                            }} 
                          />
                          <span className={styles.radioCircle}></span>
                        </label>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
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
