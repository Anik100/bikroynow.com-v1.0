'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import styles from './FeaturedSlider.module.css';
import { Star, ChevronLeft, ChevronRight, MapPin, ArrowRight } from 'lucide-react';

const SLIDE_DURATION = 5000; // 5 seconds

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
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 1500);

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
    } finally {
      clearTimeout(timeout);
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

  const currentAd1 = featuredAds[currentIndex];
  const listing1 = currentAd1?.listing;

  // Second ad for desktop split view (if 2 or more exist)
  const secondIndex = (currentIndex + 1) % featuredAds.length;
  const currentAd2 = featuredAds.length > 1 ? featuredAds[secondIndex] : featuredAds[0];
  const listing2 = currentAd2?.listing;

  return (
    <div className={styles.sliderContainer}>
      {/* Featured Badge (Mobile View) */}
      <div className={styles.mobileFeaturedBadge}>
        <Star size={11} fill="#fff" color="#fff" />
        {lang === 'bn' ? 'বিজনেস ফিচার্ড অ্যাড' : 'Business Featured Ad'}
      </div>

      {/* Slide Count */}
      {featuredAds.length > 1 && (
        <div className={styles.slideCount}>
          {currentIndex + 1} / {featuredAds.length}
        </div>
      )}

      {/* Main Slide Wrapper */}
      <div className={`${styles.slidesWrapper} ${isAnimating ? styles.slideHide : styles.slideShow}`}>
        {/* Card 1 */}
        <Link
          href={listing1 ? `/ad/${listing1.id}` : '#'}
          className={styles.slideCard}
        >
          <div className={styles.slideImageWrapper}>
            {listing1?.images?.[0] ? (
              <>
                <div 
                  className={styles.blurredBg} 
                  style={{ backgroundImage: `url(${listing1.images[0]})` }} 
                />
                <img
                  src={listing1.images[0]}
                  alt={listing1.title || 'Featured Ad 1'}
                  className={styles.slideImage}
                />
              </>
            ) : (
              <div className={styles.noImageBg}>
                <span className={styles.noImageLogo}>BikroyNow<span>.com</span></span>
              </div>
            )}
            <div className={styles.slideGradient} />
            <div className={styles.cardBadge}>
              <Star size={10} fill="#fff" color="#fff" />
              <span>{lang === 'bn' ? 'স্পনসরড অ্যাড' : 'Sponsored'}</span>
            </div>
          </div>

          <div className={styles.slideInfo}>
            <h3 className={styles.slideTitle}>{listing1?.title}</h3>
            <div className={styles.slideMeta}>
              {listing1?.price > 0 && (
                <span className={styles.slidePrice}>
                  {lang === 'bn' ? `৳ ${Number(listing1.price).toLocaleString('bn-BD')}` : `Tk ${Number(listing1.price).toLocaleString()}`}
                </span>
              )}
              {listing1?.location && (
                <span className={styles.slideLocation}>
                  <MapPin size={13} color="#38bdf8" /> {listing1.location}
                </span>
              )}
            </div>
            <div className={styles.slideAction}>
              <span>{lang === 'bn' ? 'বিস্তারিত দেখুন' : 'View Details'}</span>
              <ArrowRight size={15} />
            </div>
          </div>
        </Link>

        {/* Card 2 (Desktop Widescreen Dual View) */}
        <Link
          href={listing2 ? `/ad/${listing2.id}` : '#'}
          className={`${styles.slideCard} ${styles.desktopSecondCard}`}
        >
          <div className={styles.slideImageWrapper}>
            {listing2?.images?.[0] ? (
              <>
                <div 
                  className={styles.blurredBg} 
                  style={{ backgroundImage: `url(${listing2.images[0]})` }} 
                />
                <img
                  src={listing2.images[0]}
                  alt={listing2.title || 'Featured Ad 2'}
                  className={styles.slideImage}
                />
              </>
            ) : (
              <div className={styles.noImageBg}>
                <span className={styles.noImageLogo}>BikroyNow<span>.com</span></span>
              </div>
            )}
            <div className={styles.cardBadge} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <Star size={10} fill="#fff" color="#fff" />
              <span>{lang === 'bn' ? 'বিজনেস ফিচার্ড' : 'Featured'}</span>
            </div>
          </div>

          <div className={styles.slideInfo}>
            <h3 className={styles.slideTitle}>{listing2?.title}</h3>
            <div className={styles.slideMeta}>
              {listing2?.price > 0 && (
                <span className={styles.slidePrice}>
                  {lang === 'bn' ? `৳ ${Number(listing2.price).toLocaleString('bn-BD')}` : `Tk ${Number(listing2.price).toLocaleString()}`}
                </span>
              )}
              {listing2?.location && (
                <span className={styles.slideLocation}>
                  <MapPin size={13} color="#38bdf8" /> {listing2.location}
                </span>
              )}
            </div>
            <div className={styles.slideAction}>
              <span>{lang === 'bn' ? 'বিস্তারিত দেখুন' : 'View Details'}</span>
              <ArrowRight size={15} />
            </div>
          </div>
        </Link>
      </div>

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
            <ChevronLeft size={20} />
          </button>
          <button className={`${styles.navBtn} ${styles.navRight}`} onClick={goNext} aria-label="Next">
            <ChevronRight size={20} />
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
