'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import styles from './page.module.css';
import { CATEGORIES } from '../lib/constants';
import { useLanguage } from '../context/LanguageContext';
import { getRelativeTime, formatFullDate, formatPrice, getPromotionBadgeText, sortPremiumListings } from '../lib/utils';
import { Heart, Smartphone, Laptop, Zap, Car, Home as HouseIcon, Briefcase, Box, ChevronDown } from 'lucide-react';
import FeaturedSlider from '../components/FeaturedSlider';

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

export default function Home() {
  const { t, lang } = useLanguage();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

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
        setLoading(true);
        const apiRes = await fetch(`/api/listings?t=${Date.now()}`, { cache: 'no-store' });
        if (apiRes.ok) {
          const apiJson = await apiRes.json();
          if (Array.isArray(apiJson.listings) && !isCancelled) {
            setListings(sortPremiumListings(apiJson.listings));
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
      <h1 className={styles.seoMainHeading}>
        {lang === 'bn' 
          ? 'বিক্রয়নও - বাংলাদেশের সবচেয়ে বড় ও বিশ্বস্ত অনলাইন মার্কেটপ্লেস' 
          : 'BikroyNow - Largest Buy & Sell Marketplace in Bangladesh'}
      </h1>

      <div className={`container ${styles.categorySection}`}>
        <div 
          className={styles.sectionTitleToggle} 
          onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
        >
          <div className={styles.titleLeft}>
            <span className={styles.accentBar}></span>
            <h2 className={styles.sectionTitleText}>
              {t('browseCategories')}
            </h2>
          </div>
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

        <div className={`${styles.sliderWrapper} ${isCategoriesExpanded ? styles.expanded : ''}`}>
          <div className={styles.sliderContent}>
            <div className={styles.categoryGrid}>
              {categories.map((cat, i) => (
                <div 
                  key={i} 
                  className={styles.categoryCard}
                  style={{
                    '--card-bg': cat.bg,
                    '--card-border': cat.border,
                    '--card-text': cat.text,
                    '--icon-glow': cat.color
                  }}
                  onClick={() => {
                    setActiveCategory(cat.name);
                    setSelectedCategoryFilter(cat.name);
                    if (CATEGORIES[cat.name]) {
                      const firstSub = Object.keys(CATEGORIES[cat.name])[0];
                      setActiveSub(firstSub);
                    } else {
                      setActiveSub(null);
                    }
                    setShowCategoryModal(true);
                  }}
                >
                  <div className={styles.iconBox} style={{ background: cat.gradient }}>
                    <cat.icon size={20} color="#ffffff" className={styles.categoryIcon} />
                  </div>
                  <h3 style={{ color: cat.text }}>{t(cat.name)}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showCategoryModal && activeCategory && mounted && createPortal(
        <div className={styles.modalOverlay} onClick={closeCategoryModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{t(activeCategory)}</h2>
              <button className={styles.modalCloseBtn} onClick={closeCategoryModal}>
                {lang === 'bn' ? '← ফিরে যান' : '← Go Back'}
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* Prominent Banner for viewing ALL items in this Category */}
              <div 
                style={{
                  marginBottom: '1rem',
                  padding: '0.85rem 1.1rem',
                  background: 'linear-gradient(135deg, #008b5e 0%, #00704c 100%)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0, 139, 94, 0.25)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s'
                }}
                onClick={() => {
                  setSelectedCategoryFilter(activeCategory);
                  closeCategoryModal();
                }}
              >
                <Link 
                  href={`/ads?category=${encodeURIComponent(activeCategory)}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    color: 'white',
                    textDecoration: 'none'
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                    🌐 {lang === 'bn' 
                      ? `সকল ${t(activeCategory)} (সবগুলো অ্যাড)`
                      : `All ${t(activeCategory)} (All Ads)`}
                  </span>
                  <span style={{ 
                    background: 'rgba(255, 255, 255, 0.25)', 
                    padding: '0.35rem 0.75rem', 
                    borderRadius: '20px', 
                    fontSize: '0.78rem', 
                    fontWeight: 800,
                    letterSpacing: '0.3px',
                    whiteSpace: 'nowrap'
                  }}>
                    {lang === 'bn' ? 'সব দেখুন →' : 'View All →'}
                  </span>
                </Link>
              </div>

              {CATEGORIES[activeCategory] ? (
                Object.keys(CATEGORIES[activeCategory]).map(sub => {
                  const isExpanded = activeSub === sub;
                  return (
                    <div key={sub} className={styles.subCatAccordionGroup}>
                      <div 
                        className={`${styles.subCatAccordionHeader} ${isExpanded ? styles.activeHeader : ''}`}
                        onClick={() => {
                          setActiveSub(prev => (prev === sub ? null : sub));
                        }}
                      >
                        <div className={styles.subCatAccordionTitle}>
                          <span className={styles.subHeaderDot}></span>
                          <span>{t(sub)}</span>
                        </div>
                        <div className={`${styles.subChevronCircle} ${isExpanded ? styles.rotated : ''}`}>
                          <ChevronDown size={18} />
                        </div>
                      </div>

                      <div className={`${styles.accordionBody} ${isExpanded ? styles.expanded : ''}`}>
                        <div className={styles.accordionContent}>
                          <div className={styles.itemGrid}>
                            <div 
                              className={styles.categoryLink} 
                              onClick={() => {
                                setSelectedCategoryFilter(sub);
                                closeCategoryModal();
                              }} 
                              style={{ background: '#e6f4ef', border: '1px solid #bbf7d0' }}
                            >
                              <Link href={`/ads?category=${encodeURIComponent(sub)}`}>
                                <span style={{ fontWeight: 800, color: '#008b5e' }}>
                                  🌐 {lang === 'bn' ? `সকল ${t(sub)}` : `All ${t(sub)}`}
                                </span>
                                <span className={styles.arrowIcon} style={{ color: '#008b5e' }}>→</span>
                              </Link>
                            </div>
                            {CATEGORIES[activeCategory][sub].map(item => (
                              <div 
                                key={item} 
                                className={styles.categoryLink} 
                                onClick={() => {
                                  setSelectedCategoryFilter(item);
                                  closeCategoryModal();
                                }}
                              >
                                <Link href={`/ads?category=${encodeURIComponent(item)}`}>
                                  <span>{t(item)}</span>
                                  <span className={styles.arrowIcon}>→</span>
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={styles.noSub}>{t('noSub')}</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className={`container ${styles.adSection}`}>
        {/* ── Featured Business Ads Slider (Prominently at the top) ── */}
        <FeaturedSlider lang={lang} />

        {/* All Ads Center Button (Placed below Featured Slider) */}
        <div className={styles.allAdsCenterWrapper} style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
          <Link href="/ads" className={styles.allAdsCenterBtn}>
            {t('allAds')}
          </Link>
        </div>

        {/* Header with Active Category Filter Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
            {selectedCategoryFilter 
              ? `${lang === 'bn' ? 'ক্যাটাগরি ভিত্তিক পোস্ট:' : 'Filtered Ads:'} ${t(selectedCategoryFilter)}`
              : t('freshRecommendations')}
          </h2>
          {selectedCategoryFilter && (
            <button
              onClick={() => setSelectedCategoryFilter(null)}
              style={{
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                boxShadow: '0 2px 5px rgba(220, 38, 38, 0.1)'
              }}
            >
              ✕ {lang === 'bn' ? 'সব পোস্ট দেখুন (ফিল্টার তুলুন)' : 'Show All Ads (Clear Filter)'}
            </button>
          )}
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
            const displayedListings = listings.filter(ad => {
              if (!selectedCategoryFilter) return true;
              const cat = selectedCategoryFilter;
              if (ad.category_id === cat) return true;
              
              if (CATEGORIES[cat]) {
                const subcategories = CATEGORIES[cat];
                for (const [subKey, items] of Object.entries(subcategories)) {
                  if (subKey === ad.category_id || items.includes(ad.category_id)) return true;
                }
              }
              
              for (const mainCatObj of Object.values(CATEGORIES)) {
                if (mainCatObj[cat] && (mainCatObj[cat].includes(ad.category_id) || ad.category_id === cat)) {
                  return true;
                }
              }
              return false;
            });

            return displayedListings.length > 0 ? (
              displayedListings.map((ad) => (
                <Link href={`/ad/${ad.id}`} key={ad.id} className={styles.adCard}>
                  <div className={styles.adImageWrapper}>
                    {ad.is_featured ? (
                      <div className={styles.verifiedBadge} style={{ background: 'linear-gradient(135deg, #10b981, #047857)', color: '#ffffff', fontWeight: 900, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)' }}>
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
                        size={18} 
                        fill={favorites.includes(ad.id) ? "#ef4444" : "none"} 
                        color={favorites.includes(ad.id) ? "#ef4444" : "#64748b"} 
                      />
                    </button>
                    <img 
                      src={ad.images[0] || 'https://via.placeholder.com/300x200?text=No+Image'} 
                      alt={ad.title} 
                      className={styles.adImage}
                      loading="lazy"
                      decoding="async"
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
                    {(ad.is_featured || ad.is_verified) && (
                      <div style={{ marginTop: 'auto', paddingTop: '0.8rem', borderTop: '1px dashed #fef08a', textAlign: 'center' }}>
                        <span style={{ color: ad.is_featured ? '#047857' : '#d97706', fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
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
            );
          })()}
        </div>
      </div>
    </div>
  );
}
