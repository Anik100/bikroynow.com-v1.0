'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '../lib/supabaseClient';
import styles from './FeaturedSlider.module.css';
import { Star, ChevronLeft, ChevronRight, MapPin, ArrowRight } from 'lucide-react';
import { sortFeaturedAds } from '../lib/utils';
import { normalizeLocationName } from '../lib/constants';

const SLIDE_DURATION = 5000; // 5 seconds

function getInitialSavedPage() {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('bikroynow_slider_page') || sessionStorage.getItem('bikroynow_slider_page');
      if (saved !== null && saved !== undefined) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    } catch (e) {}
  }
  return 0;
}

export default function FeaturedSlider({ lang = 'en', initialFeaturedAds = [] }) {
  const [featuredAds, setFeaturedAds] = useState(() => sortFeaturedAds(initialFeaturedAds || []));
  const [currentPage, setCurrentPage] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(initialFeaturedAds && initialFeaturedAds.length > 0 ? false : true);
  const [progress, setProgress] = useState(0);

  const currentPageRef = useRef(0);
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const startTimeRef = useRef(null);

  const totalPages = Math.max(1, Math.ceil(featuredAds.length / 2));

  // Sync ref with state
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Helper to synchronize slide position across React state, CSS variables, and storage
  const updateSlidePosition = useCallback((nextPage, animate = true) => {
    currentPageRef.current = nextPage;
    setCurrentPage(nextPage);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bikroynow_slider_page', String(nextPage));
        sessionStorage.setItem('bikroynow_slider_page', String(nextPage));
        document.documentElement.style.setProperty('--slider-page', nextPage);
        document.documentElement.style.setProperty(
          '--slider-transition',
          animate ? 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
        );
      } catch (e) {}
    }
  }, []);

  // Restore saved slide on mount safely after hydration, THEN enable timer
  useEffect(() => {
    const saved = getInitialSavedPage();
    if (saved > 0 && totalPages > 0) {
      const valid = saved < totalPages ? saved : totalPages - 1;
      currentPageRef.current = valid;
      setCurrentPage(valid);
    }
    setIsReady(true);
  }, [totalPages]);

  // Validate and clamp saved slide position if it exceeds available pages
  useEffect(() => {
    if (totalPages > 0 && currentPage >= totalPages) {
      updateSlidePosition(totalPages - 1, false);
    }
  }, [totalPages, currentPage, updateSlidePosition]);

  useEffect(() => {
    // Only refetch if initial data from SSR wasn't provided, preventing any array jitter
    if (!initialFeaturedAds || initialFeaturedAds.length === 0) {
      fetchFeaturedAds();
    }
    // Enable smooth animation for future auto-slides shortly after initial paint
    const t = setTimeout(() => {
      if (typeof window !== 'undefined') {
        document.documentElement.style.setProperty(
          '--slider-transition',
          'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)'
        );
      }
    }, 150);
    return () => clearTimeout(t);
  }, []);

  const fetchFeaturedAds = async () => {
    try {
      let deletedIds = new Set();
      try {
        deletedIds = new Set(JSON.parse(localStorage.getItem('bikroynow_deleted_ad_ids') || '[]').map(String));
      } catch (e) {}

      // 1. Try server endpoint with fresh cache
      const res = await fetch(`/api/admin/featured-ads?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          const now = new Date();
          const active = json.data.filter(ad => {
            if (!ad.is_active || !ad.listing || ad.listing.error || ad.listing.status === 'deleted') return false;
            if (deletedIds.has(String(ad.listing_id || ad.listing.id))) return false;
            // Filter out if user membership is free or expired
            if (ad.listing.user_id) {
              const prof = ad.listing.profiles;
              if (!prof || !prof.membership_type || prof.membership_type === 'free') return false;
              const exp = prof.membership_expires_at;
              if (exp && new Date(exp) <= now) return false;
            }
            return true;
          });
          setFeaturedAds(sortFeaturedAds(active));
          setLoading(false);
          return;
        }
      }

      // 2. Fallback to direct supabase query
      const { data, error } = await supabase
        .from('featured_ads')
        .select(`
          *,
          listing:listing_id (
            id, title, price, location, images, user_id, status
          )
        `)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (data && !error) {
        const valid = data.filter(ad => 
          ad.listing && 
          !ad.listing.error && 
          ad.listing.status !== 'deleted' &&
          !deletedIds.has(String(ad.listing_id || ad.listing.id))
        );
        setFeaturedAds(sortFeaturedAds(valid));
      }
    } catch (err) {
      console.error('Error fetching featured ads:', err);
    } finally {
      setLoading(false);
    }
  };

  const stopAutoSlide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
  }, []);

  const startAutoSlide = useCallback(() => {
    stopAutoSlide();
    setProgress(0);
    startTimeRef.current = Date.now();

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
      setProgress(pct);
    }, 80);

    timerRef.current = setTimeout(() => {
      const next = (currentPageRef.current + 1) % totalPages;
      updateSlidePosition(next, true);
    }, SLIDE_DURATION);
  }, [totalPages, updateSlidePosition, stopAutoSlide]);

  useEffect(() => {
    if (isReady && totalPages > 1) {
      startAutoSlide();
    }
    return () => stopAutoSlide();
  }, [isReady, totalPages, currentPage, startAutoSlide, stopAutoSlide]);

  const goToPage = (pageIndex) => {
    if (pageIndex === currentPage) return;
    updateSlidePosition(pageIndex, true);
    startAutoSlide();
  };

  const goNext = () => goToPage((currentPage + 1) % totalPages);
  const goPrev = () => goToPage((currentPage - 1 + totalPages) % totalPages);

  if (loading && featuredAds.length === 0) {
    return (
      <div className={styles.sliderContainer} aria-hidden="true">
        <div className={styles.placeholder} style={{ opacity: 0.6 }}>
          <div className={styles.placeholderContent}>
            <span className={styles.placeholderLogo}>BikroyNow<span>.com</span></span>
          </div>
        </div>
      </div>
    );
  }

  // Placeholder when no featured ads exist
  if (featuredAds.length === 0) {
    return (
      <div className={styles.sliderContainer}>
        <div className={styles.placeholder}>
          <div className={styles.placeholderContent}>
            <span className={styles.placeholderLogo}>BikroyNow<span>.com</span></span>
            <p className={styles.placeholderText}>
              {lang === 'bn' ? 'বিজ্ঞাপন বোর্ড' : 'Advertisement Board'}
            </p>
            <span className={styles.placeholderSub}>
              {lang === 'bn'
                ? 'বিজনেস মেম্বার হিসেবে আপনার বিজ্ঞাপন এখানে দেখান'
                : 'Get a Business Membership to feature your ad here'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const renderSlideCard = (listItem, { isPriority = false, isLazy = false, fetchPriority = 'auto', extraClass = '' } = {}) => (
    <Link
      href={listItem ? `/ad/${listItem.id}` : '#'}
      className={`${styles.slideCard} ${extraClass}`.trim()}
    >
      <div className={styles.slideImageWrapper}>
        {listItem?.images?.[0] ? (
          <Image
            src={listItem.images[0]}
            alt={listItem?.title ? `${listItem.title} - ফিচার্ড বিজ্ঞাপন | BikroyNow` : 'BikroyNow Featured Ad'}
            fill
            priority={isPriority}
            loading={isLazy ? 'lazy' : 'eager'}
            fetchPriority={fetchPriority}
            sizes="(max-width: 768px) 50vw, 450px"
            quality={90}
            style={{ objectFit: 'cover' }}
            className={styles.slideImage}
          />
        ) : (
          <div className={styles.noImageBg}>
            <span className={styles.noImageLogo}>BikroyNow<span>.com</span></span>
          </div>
        )}
        <div className={styles.cardBadge}>
          <Star size={10} fill="#f59e0b" color="#f59e0b" />
          <span>{lang === 'bn' ? 'ফিচার্ড' : 'Featured'}</span>
        </div>
      </div>

      <div className={styles.slideInfo}>
        <h3 className={styles.slideTitle}>{listItem?.title}</h3>
        <div className={styles.slideMeta}>
          {listItem?.price > 0 && (
            <span className={styles.slidePrice}>
              {lang === 'bn' ? `৳ ${Number(listItem.price).toLocaleString('bn-BD')}` : `Tk ${Number(listItem.price).toLocaleString()}`}
            </span>
          )}
          {listItem?.location && (
            <span className={styles.slideLocation}>
              <MapPin size={12} color="#38bdf8" style={{ flexShrink: 0 }} /> {normalizeLocationName(listItem.location)}
            </span>
          )}
        </div>
        <div className={styles.slideAction}>
          <span>{lang === 'bn' ? 'বিজ্ঞাপন দেখুন' : 'View Ad'}</span>
          <ArrowRight size={13} />
        </div>
      </div>
    </Link>
  );

  return (
    <div className={styles.sliderContainer}>
      {/* Single crisp Slide Count Indicator at top-right */}
      {totalPages > 1 && (
        <div className={styles.slideCount} aria-hidden="true" suppressHydrationWarning>
          {currentPage + 1} / {totalPages}
        </div>
      )}

      {/* ── Horizontal Sliding Track (Smooth App-Style Carousel, Zero-Flicker Pre-paint) ── */}
      <div 
        id="featured-slider-track"
        className={`${styles.sliderTrack} ${totalPages > 1 ? styles.multiPageTrack : ''}`.trim()} 
        suppressHydrationWarning
      >
        {Array.from({ length: totalPages }).map((_, pageIdx) => {
          const idx1 = (pageIdx * 2) % featuredAds.length;
          const idx2 = (pageIdx * 2 + 1) % featuredAds.length;
          const ad1 = featuredAds[idx1];
          const ad2 = featuredAds.length > 1 ? featuredAds[idx2] : featuredAds[0];
          const list1 = ad1?.listing;
          const list2 = ad2?.listing;
          const isLCP = pageIdx === 0;
          const isCurrent = pageIdx === currentPage;

          return (
            <div key={pageIdx} className={styles.slidePage}>
              {renderSlideCard(list1, {
                isPriority: isLCP || isCurrent,
                isLazy: !(isLCP || isCurrent),
                fetchPriority: isLCP || isCurrent ? 'high' : 'auto'
              })}

              {renderSlideCard(list2, {
                isPriority: false,
                isLazy: !isCurrent,
                fetchPriority: isCurrent ? 'high' : 'low',
                extraClass: styles.desktopSecondCard
              })}
            </div>
          );
        })}

        {/* Desktop-only Clone of Page 0 so 4-card laptop view never shows a half-empty slide */}
        {totalPages > 1 && (
          <div className={`${styles.slidePage} ${styles.desktopClonePage}`} aria-hidden="true">
            {renderSlideCard(featuredAds[0]?.listing, { isPriority: false, isLazy: true })}
            {renderSlideCard((featuredAds.length > 1 ? featuredAds[1] : featuredAds[0])?.listing, {
              isPriority: false,
              isLazy: true,
              extraClass: styles.desktopSecondCard
            })}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className={styles.progressBarWrap}>
        <div
          className={styles.progressBarFill}
          style={{ width: `${progress}%`, transition: 'width 0.08s linear' }}
        />
      </div>

      {/* Navigation Buttons */}
      {totalPages > 1 && (
        <>
          <button 
            className={`${styles.navBtn} ${styles.navLeft}`} 
            onClick={goPrev} 
            aria-label={lang === 'bn' ? 'পূর্ববর্তী স্লাইড' : 'Previous slide'}
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            className={`${styles.navBtn} ${styles.navRight}`} 
            onClick={goNext} 
            aria-label={lang === 'bn' ? 'পরবর্তী স্লাইড' : 'Next slide'}
          >
            <ChevronRight size={20} />
          </button>

          {/* Indicator Dots */}
          <div className={styles.dots}>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${i === currentPage ? styles.dotActive : ''}`}
                onClick={() => goToPage(i)}
                aria-label={lang === 'bn' ? `স্লাইড ${i + 1}` : `Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
