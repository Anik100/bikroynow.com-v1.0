'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import styles from './FeaturedSlider.module.css';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';

const SLIDE_DURATION = 20000; // 20 seconds

export default function FeaturedSlider({ lang = 'en' }) {
  const [featuredAds, setFeaturedAds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    fetchFeaturedAds();
  }, []);

  const fetchFeaturedAds = async () => {
    try {
      const { data, error } = await supabase
        .from('featured_ads')
        .select(`
          *,
          listing:listing_id (
            id, title, price, location, images, user_id
          )
        `)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (data && !error) {
        const valid = data.filter(ad => ad.listing && !ad.listing.error);
        setFeaturedAds(valid);
      }
    } catch (err) {
      console.error('Error fetching featured ads:', err);
    }
    setLoading(false);
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
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % featuredAds.length);
        setIsAnimating(false);
      }, 300);
    }, SLIDE_DURATION);
  }, [featuredAds.length, stopAutoSlide]);

  useEffect(() => {
    if (featuredAds.length > 1) {
      startAutoSlide();
    }
    return () => stopAutoSlide();
  }, [featuredAds, currentIndex, startAutoSlide, stopAutoSlide]);

  const goToSlide = (index) => {
    if (index === currentIndex) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsAnimating(false);
    }, 250);
    startAutoSlide();
  };

  const goNext = () => goToSlide((currentIndex + 1) % featuredAds.length);
  const goPrev = () => goToSlide((currentIndex - 1 + featuredAds.length) % featuredAds.length);

  if (loading) return null;

  // Placeholder when no featured ads exist
  if (featuredAds.length === 0) {
    return (
      <div className={styles.sliderContainer}>
        <div className={styles.placeholder}>
          <div className={styles.placeholderContent}>
            <span className={styles.placeholderLogo}>BikroyHut<span>.com</span></span>
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

  const currentAd = featuredAds[currentIndex];
  const listing = currentAd?.listing;

  return (
    <div className={styles.sliderContainer}>
      {/* Featured Badge */}
      <div className={styles.featuredBadge}>
        <Star size={11} fill="#fff" color="#fff" />
        {lang === 'bn' ? 'বিজনেস ফিচার্ড বিজ্ঞাপন' : 'Business Featured Ad'}
      </div>

      {/* Slide Count */}
      {featuredAds.length > 1 && (
        <div className={styles.slideCount}>
          {currentIndex + 1} / {featuredAds.length}
        </div>
      )}

      {/* Main Slide */}
      <Link
        href={listing ? `/ad/${listing.id}` : '#'}
        className={`${styles.slide} ${isAnimating ? styles.slideHide : styles.slideShow}`}
      >
        <div className={styles.slideImageWrapper}>
          {listing?.images?.[0] ? (
            <img
              src={listing.images[0]}
              alt={listing.title || 'Featured Ad'}
              className={styles.slideImage}
            />
          ) : (
            <div className={styles.noImageBg}>
              <span className={styles.noImageLogo}>BikroyHut<span>.com</span></span>
              <p>{lang === 'bn' ? 'বিজ্ঞাপন' : 'Advertisement'}</p>
            </div>
          )}

          {/* Gradient overlay */}
          <div className={styles.slideGradient} />

          {/* Info */}
          <div className={styles.slideInfo}>
            <h3 className={styles.slideTitle}>{listing?.title}</h3>
            <div className={styles.slideMeta}>
              {listing?.price > 0 && (
                <span className={styles.slidePrice}>
                  Tk {Number(listing.price).toLocaleString()}
                </span>
              )}
              {listing?.location && (
                <span className={styles.slideLocation}>📍 {listing.location}</span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Progress Bar */}
      <div className={styles.progressBarWrap}>
        <div
          className={styles.progressBarFill}
          style={{ width: `${progress}%`, transition: 'width 0.08s linear' }}
        />
      </div>

      {/* Navigation Buttons */}
      {featuredAds.length > 1 && (
        <>
          <button className={`${styles.navBtn} ${styles.navLeft}`} onClick={goPrev} aria-label="Previous">
            <ChevronLeft size={18} />
          </button>
          <button className={`${styles.navBtn} ${styles.navRight}`} onClick={goNext} aria-label="Next">
            <ChevronRight size={18} />
          </button>

          {/* Indicator Dots */}
          <div className={styles.dots}>
            {featuredAds.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`}
                onClick={() => goToSlide(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
