'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { formatPrice, getRelativeTime } from '../../lib/utils';
import { Heart, ArrowLeft, Loader2, Star } from 'lucide-react';
import styles from './favorites.module.css';

export default function FavoritesPage() {
  const { t, lang } = useLanguage();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      setUser(session.user);

      // Get favorite mapping
      const { data: favs, error: favsError } = await supabase
        .from('favorites')
        .select('listing_id')
        .eq('user_id', session.user.id);

      if (favsError) {
        console.error('Error fetching favorites mapping:', favsError);
        setLoading(false);
        return;
      }

      if (favs && favs.length > 0) {
        const listingIds = favs.map(f => f.listing_id);
        const { data: listingsData, error: listingsError } = await supabase
          .from('listings')
          .select('*')
          .in('id', listingIds)
          .order('created_at', { ascending: false });

        if (listingsError) {
          console.error('Error fetching listings details:', listingsError);
        } else {
          setListings(listingsData || []);
        }
      } else {
        setListings([]);
      }
      setLoading(false);
    };

    fetchFavorites();
  }, []);

  const handleRemoveFavorite = async (e, adId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('listing_id', adId);

    if (!error) {
      setListings(prev => prev.filter(item => item.id !== adId));
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 size={40} className={styles.spinner} />
        <p>{lang === 'bn' ? 'অপেক্ষা করুন...' : 'Loading saved ads...'}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <div className={styles.unauthorizedCard}>
          <div className={styles.iconBox}>🔑</div>
          <h2>{lang === 'bn' ? 'লগইন করুন' : 'Authentication Required'}</h2>
          <p>{lang === 'bn' ? 'আপনার প্রিয় বিজ্ঞাপনগুলো দেখতে অনুগ্রহ করে লগইন করুন।' : 'Please sign in to view your favorite ads.'}</p>
          <Link href="/login" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem', textDecoration: 'none' }}>
            {lang === 'bn' ? 'লগইন করুন' : 'Login'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <div className="container">
        {/* Back Link */}
        <div className={styles.backLinkWrapper}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={16} />
            <span>{lang === 'bn' ? 'হোমপেজে ফিরে যান' : 'Back to Home'}</span>
          </Link>
        </div>

        {/* Page Title */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>
            <Heart size={24} fill="#ef4444" color="#ef4444" />
            <span>{lang === 'bn' ? 'আমার প্রিয় বিজ্ঞাপন' : 'My Saved Ads'}</span>
            <span className={styles.resultsCount}>({listings.length})</span>
          </h1>
        </div>

        {/* Listings List */}
        {listings.length > 0 ? (
          <div className={styles.adList}>
            {listings.map((ad) => (
              <Link href={`/ad/${ad.id}`} key={ad.id} className={styles.adCard}>
                <div className={styles.imageBox}>
                  {ad.is_verified && (
                    <div className={styles.verifiedBadge}>
                      {lang === 'bn' ? '★ টপ অ্যাড' : '★ Top Ad'}
                    </div>
                  )}
                  {/* Heart Toggle Button */}
                  <button 
                    className={styles.favoriteBtn}
                    onClick={(e) => handleRemoveFavorite(e, ad.id)}
                    title={lang === 'bn' ? 'প্রিয় তালিকা থেকে বাদ দিন' : 'Remove from Favorites'}
                  >
                    <Heart size={18} fill="#ef4444" color="#ef4444" />
                  </button>
                  <img 
                    src={ad.images[0] || 'https://via.placeholder.com/300x200?text=No+Image'} 
                    alt={ad.title} 
                  />
                </div>
                
                <div className={styles.adInfo}>
                  <div className={styles.titleMeta}>
                    <h3 className={styles.adTitle}>{ad.title}</h3>
                    <p className={styles.adMeta}>
                      📍 {t(ad.location)} • {ad.category_id}
                    </p>
                  </div>
                  <div className={styles.priceTime}>
                    <div className={styles.adPrice}>{formatPrice(ad.price, lang)}</div>
                    <div className={styles.cardFooter}>
                      {getRelativeTime(ad.created_at, lang)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>❤️</div>
            <h3>{lang === 'bn' ? 'কোনো বিজ্ঞাপন পাওয়া যায়নি' : 'No Saved Ads Yet'}</h3>
            <p>
              {lang === 'bn' 
                ? 'আপনার প্রিয় কোনো বিজ্ঞাপন এখনও সংরক্ষণ করা হয়নি। বিজ্ঞাপন দেখার সময় লাভ বাটনে ক্লিক করে এখানে জমা রাখতে পারেন!' 
                : 'Browse listings and tap the heart icon on any ad to save it here for later!'}
            </p>
            <Link href="/ads" className="btn-secondary" style={{ display: 'inline-block', marginTop: '1.5rem', textDecoration: 'none' }}>
              {lang === 'bn' ? 'বিজ্ঞাপনগুলো দেখুন' : 'Browse Ads'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
