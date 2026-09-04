'use client';

import Link from 'next/link';
import styles from './SeoKeywordSection.module.css';
import { useLanguage } from '../context/LanguageContext';
import { Search, Sparkles, ShieldCheck, Tag } from 'lucide-react';

export default function SeoKeywordSection() {
  const { lang } = useLanguage();

  const keywordTags = [
    { titleBn: '📱 পুরাতন মোবাইল ফোন', titleEn: 'Used Mobile Phones', href: '/ads?category=Mobile%20Phones' },
    { titleBn: '💻 সেকেন্ড হ্যান্ড ল্যাপটপ', titleEn: 'Used Laptops & PC', href: '/ads?category=Computers' },
    { titleBn: '⚡ ব্যবহৃত রাউটার ও অনু', titleEn: 'Used Routers & ONU', href: '/ads?category=Electronics' },
    { titleBn: '🏍️ পুরাতন বাইক ও মোটরসাইকেল', titleEn: 'Used Bikes & Motorcycles', href: '/ads?category=Vehicles' },
    { titleBn: '🚗 সেকেন্ড হ্যান্ড গাড়ি', titleEn: 'Used Cars & Vehicles', href: '/ads?category=Vehicles' },
    { titleBn: '🏠 বাসা ভাড়া ও ফ্ল্যাট বিক্রয়', titleEn: 'Flat Rent & Property', href: '/ads?category=Property' },
    { titleBn: '💼 চাকরির বিজ্ঞপ্তি', titleEn: 'Jobs & Careers BD', href: '/ads?category=Jobs' },
    { titleBn: '📍 টাঙ্গাইল বাই অ্যান্ড সেল', titleEn: 'Tangail Buy & Sell', href: '/ads?location=Tangail' },
    { titleBn: '📍 ঢাকা কেনাবেচা মার্কেট', titleEn: 'Dhaka Marketplace', href: '/ads?location=Dhaka' },
    { titleBn: '🏷️ ফ্রি বিজ্ঞাপন পোস্ট করুন', titleEn: 'Post Free Ads Online', href: '/post-ad' },
    { titleBn: '🛡️ বিশ্বস্ত মেম্বারশিপ প্যাকেজ', titleEn: 'Verified Membership Plans', href: '/membership' },
  ];

  return (
    <section className={styles.seoSection}>
      <div className="container">
        {/* Keyword Tags Cloud */}
        <div className={styles.tagsWrapper}>
          <div className={styles.tagsHeader}>
            <Tag size={18} color="#008b5e" />
            <h3 className={styles.tagsTitle}>
              {lang === 'bn' ? 'জনপ্রিয় সার্চ ও কেনাবেচা ক্যাটাগরি' : 'Popular Searches & Categories'}
            </h3>
          </div>
          <div className={styles.tagsGrid}>
            {keywordTags.map((tag, index) => (
              <Link key={index} href={tag.href} className={styles.keywordTag}>
                {lang === 'bn' ? tag.titleBn : tag.titleEn}
              </Link>
            ))}
          </div>
        </div>

        {/* SEO Informational Text for Google Crawlers */}
        <div className={styles.seoInfoBox}>
          <h2 className={styles.seoHeading}>
            {lang === 'bn' 
              ? 'BikroyNow.com - বাংলাদেশের বিশ্বস্ত অনলাইন বাই-সেল ও কেনাবেচা মার্কেটপ্লেস' 
              : 'BikroyNow.com - The Leading Online Buy & Sell Marketplace in Bangladesh'}
          </h2>
          <p className={styles.seoText}>
            {lang === 'bn' ? (
              <>
                <strong>BikroyNow.com (বিক্রয়নও)</strong> হলো বাংলাদেশের সবচেয়ে দ্রুত বর্ধনশীল ও নির্ভরযোগ্য অনলাইন ক্লাসিফাইড প্ল্যাটফর্ম। এখানে আপনি ঘরে বসেই আপনার <em>পুরাতন মোবাইল ফোন, সেকেন্ড হ্যান্ড ল্যাপটপ ও কম্পিউটার, ব্যবহৃত রাউটার, ক্যামেরা, বাইক, ব্যবহৃত গাড়ি, ফ্ল্যাট, জমি ও অন্যান্য গ্যাজেট</em> খুব সহজে সম্পূর্ণ ফ্রিতে ক্রয়-বিক্রয়ের বিজ্ঞাপন পোস্ট করতে পারবেন। 
                নিরাপদ লাইভ চ্যাট সুবিধা এবং বিশ্বস্ত ভেরিফায়েড বিক্রেতাদের সাথে সরাসরি যোগাযোগ করে সেরা দামে ক্রয়-বিক্রয় করুন আজই!
              </>
            ) : (
              <>
                <strong>BikroyNow.com</strong> is Bangladesh&apos;s leading online classifieds platform to buy and sell second-hand goods easily and securely. Find genuine deals on <em>used smartphones, second-hand laptops, routers, motorbikes, used cars, property rentals, and electronics</em> in Dhaka, Tangail, and across all 64 districts of Bangladesh.
              </>
            )}
          </p>

          <div className={styles.featurePills}>
            <div className={styles.pill}>
              <Sparkles size={16} color="#008b5e" />
              <span>{lang === 'bn' ? '১০০% ফ্রি বিজ্ঞাপন পোস্ট' : '100% Free Ad Posting'}</span>
            </div>
            <div className={styles.pill}>
              <ShieldCheck size={16} color="#008b5e" />
              <span>{lang === 'bn' ? 'নিরাপদ রিয়েলটাইম চ্যাট' : 'Safe Real-Time Chat'}</span>
            </div>
            <div className={styles.pill}>
              <Search size={16} color="#008b5e" />
              <span>{lang === 'bn' ? 'দ্রুত সার্চ ও লাইভ ফিল্টারিং' : 'Fast Live Search'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
