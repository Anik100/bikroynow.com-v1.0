'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import styles from './page.module.css';
import { CATEGORIES } from '../lib/constants';
import { useLanguage } from '../context/LanguageContext';
import { getRelativeTime, formatFullDate, formatPrice, getPromotionBadgeText } from '../lib/utils';
import { Heart, Smartphone, Laptop, Zap, Car, Home as HouseIcon, Briefcase, Box } from 'lucide-react';
import FeaturedSlider from '../components/FeaturedSlider';

export default function Home() {
  const { t, lang } = useLanguage();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);

  // Favorites state
  const [favorites, setFavorites] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      let { data, error } = await supabase
        .from('listings')
        .select('*')
        .neq('status', 'pending')
        .order('is_verified', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error && error.message.includes('is_verified')) {
        console.warn('Fallback: is_verified column missing in database. Fetching without verification ordering.');
        const fallback = await supabase
          .from('listings')
          .select('*')
          .neq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10);
        data = fallback.data;
        error = fallback.error;
      }
      
      if (error) {
        console.error('Error fetching listings:', error);
      }
      if (data) setListings(data);
      setLoading(false);
    };
    fetchListings();
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
    if (window.history.state && window.history.state.modalOpen) {
      window.history.back();
    }
  };

  const categories = [
    { 
      name: 'Mobile Phones', 
      icon: Smartphone, 
      color: '#3b82f6', 
      bg: '#f0f7ff', 
      border: '#dbeafe', 
      text: '#1e40af', 
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' 
    },
    { 
      name: 'Computers', 
      icon: Laptop, 
      color: '#10b981', 
      bg: '#f0fdf4', 
      border: '#dcfce7', 
      text: '#065f46', 
      gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' 
    },
    { 
      name: 'Electronics', 
      icon: Zap, 
      color: '#f59e0b', 
      bg: '#fffbeb', 
      border: '#fef3c7', 
      text: '#92400e', 
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
    },
    { 
      name: 'Vehicles', 
      icon: Car, 
      color: '#ef4444', 
      bg: '#fef2f2', 
      border: '#fee2e2', 
      text: '#991b1b', 
      gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' 
    },
    { 
      name: 'Property', 
      icon: HouseIcon, 
      color: '#8b5cf6', 
      bg: '#f5f3ff', 
      border: '#ede9fe', 
      text: '#5b21b6', 
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' 
    },
    { 
      name: 'Jobs', 
      icon: Briefcase, 
      color: '#ec4899', 
      bg: '#fdf2f8', 
      border: '#fce7f3', 
      text: '#9d174d', 
      gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' 
    },
    { 
      name: 'অন্যান্য', 
      icon: Box, 
      color: '#6b7280', 
      bg: '#f8fafc', 
      border: '#e2e8f0', 
      text: '#334155', 
      gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)' 
    },
  ];

  return (
    <div className={styles.homeContainer}>
      <div className={`container ${styles.categorySection}`}>
        <div 
          className={styles.sectionTitleToggle} 
          onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
        >
          <div className={styles.titleLeft}>
            <span className={styles.accentBar}></span>
            <h2 className={styles.sectionTitleText}>
              {t('browseCategories')}
              <span className={styles.sectionTitleSubtext}>
                {lang === 'bn' ? 'ক্যাটাগরি অনুযায়ী বিজ্ঞাপন খুঁজুন' : 'Filter and find listings by category'}
              </span>
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

      {showCategoryModal && activeCategory && (
        <div className={styles.modalOverlay} onClick={closeCategoryModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{t(activeCategory)}</h2>
              <button className={styles.modalCloseBtn} onClick={closeCategoryModal}>
                {lang === 'bn' ? '← ফিরে যান' : '← Go Back'}
              </button>
            </div>
            <div className={styles.modalBody}>
              {CATEGORIES[activeCategory] ? (
                Object.keys(CATEGORIES[activeCategory]).map(sub => (
                  <div key={sub} className={styles.subGroup}>
                    <div className={styles.subHeader}>{t(sub)}</div>
                    {CATEGORIES[activeCategory][sub].map(item => (
                      <div key={item} className={styles.categoryLink} onClick={closeCategoryModal}>
                        <Link href={`/ads?category=${item}`}>{t(item)} →</Link>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className={styles.noSub}>{t('noSub')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`container ${styles.adSection}`}>
        <div className={styles.allAdsCenterWrapper}>
          <Link href="/ads" className={styles.allAdsCenterBtn}>
            {t('allAds')}
          </Link>
        </div>

        {/* ── Featured Business Ads Slider ── */}
        <FeaturedSlider lang={lang} />

        <h2 className={styles.sectionTitle}>{t('freshRecommendations')}</h2>
        <div className={styles.adGrid}>
          {loading ? (
            <div style={{gridColumn: '1/-1', textAlign: 'center', padding: '2rem'}}>Loading...</div>
          ) : listings.length > 0 ? (
            listings.map((ad) => (
              <Link href={`/ad/${ad.id}`} key={ad.id} className="card">
                <div className={styles.adImageWrapper}>
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
                      size={18} 
                      fill={favorites.includes(ad.id) ? "#ef4444" : "none"} 
                      color={favorites.includes(ad.id) ? "#ef4444" : "#64748b"} 
                    />
                  </button>
                  <img 
                    src={ad.images[0] || 'https://via.placeholder.com/300x200?text=No+Image'} 
                    alt={ad.title} 
                    className={styles.adImage}
                  />
                </div>
                <div className={styles.adContent} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h3 className={styles.adTitle}>{ad.title}</h3>
                  <p className={styles.adLocation}>{t(ad.location)}</p>
                  <div className={styles.adPrice}>{formatPrice(ad.price, lang)}</div>
                  <div className={styles.adFooter}>
                    <span className={styles.adTime}>
                      {getRelativeTime(ad.created_at, lang)} • {formatFullDate(ad.created_at, lang)}
                    </span>
                  </div>
                  {ad.is_verified && (
                    <div style={{ marginTop: 'auto', paddingTop: '0.8rem', borderTop: '1px dashed #fef08a', textAlign: 'center' }}>
                      <span style={{ color: '#d97706', fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
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
      </div>
    </div>
  );
}
