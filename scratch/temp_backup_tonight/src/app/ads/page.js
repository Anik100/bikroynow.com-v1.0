'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { getRelativeTime, formatPrice, getPromotionBadgeText } from '../../lib/utils';
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

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '0.62rem',
        fontWeight: 800,
        padding: '0.15rem 0.4rem',
        borderRadius: '5px',
        marginLeft: '0.5rem',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        verticalAlign: 'middle',
        gap: '0.15rem',
        ...badgeStyle
      }}>
        🛡️ {label}
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
    const savedView = localStorage.getItem('bikroyhut_viewMode');
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
    localStorage.setItem('bikroyhut_viewMode', mode);
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
    let query = supabase.from('listings').select('*').neq('status', 'pending').order('is_verified', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });

    const cat = searchParams.get('category');
    const loc = searchParams.get('location');
    const minP = searchParams.get('minPrice');
    const maxP = searchParams.get('maxPrice');

    if (cat) {
      if (CATEGORIES[cat]) {
        // Selected a Main Category - fetch all specific subcategory items underneath
        const subcategories = CATEGORIES[cat];
        const specificItems = [];
        Object.entries(subcategories).forEach(([subKey, items]) => {
          items.forEach(item => specificItems.push(item));
        });
        query = query.in('category_id', specificItems);
      } else {
        // Selected a specific subcategory/item - query directly
        query = query.eq('category_id', cat);
      }
    }
    
    const verifiedOnly = searchParams.get('verified') === 'true';
    
    if (loc && loc !== 'All of Bangladesh') {
      const isDivision = Object.keys(LOCATIONS).includes(loc);
      const isAllOfDivision = loc.startsWith('All of ') && loc.endsWith(' Division');
      
      if (isDivision || isAllOfDivision) {
        const divisionName = isDivision ? loc : loc.replace('All of ', '').replace(' Division', '');
        const districtsInDivision = LOCATIONS[divisionName];
        if (districtsInDivision) {
          query = query.in('location', [loc, ...districtsInDivision]);
        } else {
          query = query.eq('location', loc);
        }
      } else {
        query = query.eq('location', loc);
      }
    }
    if (minP) query = query.gte('price', parseFloat(minP));
    if (maxP) query = query.lte('price', parseFloat(maxP));
    if (verifiedOnly) query = query.eq('is_verified', true);

    let { data, error } = await query;

    if (error && error.message.includes('is_verified')) {
      console.warn('Fallback: is_verified column missing in database. Fetching search results without verification ordering.');
      let fallbackQuery = supabase.from('listings').select('*').neq('status', 'pending').order('created_at', { ascending: false });
      
      if (cat) {
        if (CATEGORIES[cat]) {
          const subcategories = CATEGORIES[cat];
          const specificItems = [];
          Object.entries(subcategories).forEach(([subKey, items]) => {
            items.forEach(item => specificItems.push(item));
          });
          fallbackQuery = fallbackQuery.in('category_id', specificItems);
        } else {
          fallbackQuery = fallbackQuery.eq('category_id', cat);
        }
      }
      if (loc && loc !== 'All of Bangladesh') {
        const isDivision = Object.keys(LOCATIONS).includes(loc);
        const isAllOfDivision = loc.startsWith('All of ') && loc.endsWith(' Division');
        
        if (isDivision || isAllOfDivision) {
          const divisionName = isDivision ? loc : loc.replace('All of ', '').replace(' Division', '');
          const districtsInDivision = LOCATIONS[divisionName];
          if (districtsInDivision) {
            fallbackQuery = fallbackQuery.in('location', [loc, ...districtsInDivision]);
          } else {
            fallbackQuery = fallbackQuery.eq('location', loc);
          }
        } else {
          fallbackQuery = fallbackQuery.eq('location', loc);
        }
      }
      if (minP) fallbackQuery = fallbackQuery.gte('price', parseFloat(minP));
      if (maxP) fallbackQuery = fallbackQuery.lte('price', parseFloat(maxP));
      if (verifiedOnly) fallbackQuery = fallbackQuery.eq('is_verified', true);

      const fallbackResult = await fallbackQuery;
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error('Error fetching filtered ads:', error);
    }
    
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(item => item.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, membership_type, membership_expires_at')
          .in('id', userIds);
          
        if (profilesData) {
          const profilesMap = {};
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
          const enrichedData = data.map(item => ({
            ...item,
            profiles: profilesMap[item.user_id] || null
          }));
          setListings(enrichedData);
        } else {
          setListings(data);
        }
      } else {
        setListings(data);
      }
    } else {
      setListings(data || []);
    }
    setLoading(false);
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
          <main className={styles.adsMainFull}>
            <div className={styles.pageHeader}>
              <h2 className={styles.pageTitle}>
                {selectedCategory ? t(selectedCategory) : t('allAds').replace(' →', '')}
                <span className={styles.resultsCount}>({listings.length} {t('results')})</span>
              </h2>
            </div>

            <div className={viewMode === 'list' ? styles.adListFull : styles.adGridFull}>
              {loading ? (
                <div style={{gridColumn: '1/-1', textAlign: 'center', padding: '2rem'}}>{t('loading')}</div>
              ) : listings.length > 0 ? (
                listings.map((ad) => (
                  <Link href={`/ad/${ad.id}`} key={ad.id} className={viewMode === 'list' ? styles.adCard : styles.adCardGrid}>
                    {/* Left Compact Image */}
                    <div className={styles.imageBox}>
                      {ad.is_verified && (
                        <div className={styles.verifiedBadge}>
                          {lang === 'bn' ? '★ টপ অ্যাড' : '★ Top Ad'}
                        </div>
                      )}
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
                      {ad.is_verified && (
                        <div style={{ marginTop: 'auto', paddingTop: '0.6rem', borderTop: '1px dashed #fef08a', textAlign: 'center', alignSelf: 'stretch' }}>
                          <span style={{ color: '#d97706', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                            ★ {getPromotionBadgeText(ad.promotion_type, lang)}
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
