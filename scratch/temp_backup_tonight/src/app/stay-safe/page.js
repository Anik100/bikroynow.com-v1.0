'use client';

import { useLanguage } from '../../context/LanguageContext';
import styles from '../about-us/static-pages.module.css';
import Link from 'next/link';

export default function StaySafe() {
  const { lang } = useLanguage();

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>
            {lang === 'bn' ? 'নিরাপত্তা নির্দেশনা' : 'Stay Safe'}
          </h1>
          <p className={styles.subtitle}>
            {lang === 'bn' 
              ? 'বিক্রয়হাটে কীভাবে নিরাপদে কেনাবেচা করবেন' 
              : 'Simple tips to trade safely and securely on BikroyHut'}
          </p>
        </div>

        <div className={styles.contentSection}>
          <p>
            {lang === 'bn'
              ? 'বিক্রয়হাটে আমরা আপনার সুরক্ষাকে সর্বোচ্চ অগ্রাধিকার দিই। প্রতারণা ও যেকোনো অপ্রীতিকর পরিস্থিতি এড়াতে অনুগ্রহ করে নিচের গুরুত্বপূর্ণ নিরাপত্তা টিপসগুলো অনুসরণ করুন।'
              : 'At BikroyHut, your safety is our top priority. To prevent scams and avoid unpleasant situations, please always follow these essential safety guidelines.'}
          </p>

          <div className={styles.warningCard}>
            ⚠️ {lang === 'bn' 
              ? 'সবচেয়ে গুরুত্বপূর্ণ নিয়ম: কোনো অপরিচিত বিক্রেতাকে পণ্য হাতে পাওয়ার আগে কখনোই অগ্রিম টাকা পাঠাবেন না!' 
              : 'The Golden Rule: Never send money in advance to any unknown seller before receiving the product!'}
          </div>

          <h2>
            🤝 {lang === 'bn' ? '১. সরাসরি দেখা করুন এবং যাচাই করুন' : '1. Meet in Public & Inspect'}
          </h2>
          <ul>
            <li>
              {lang === 'bn'
                ? 'কেনাবেচার জন্য সবসময় জনাকীর্ণ এবং পাবলিক স্থান বেছে নিন (যেমন: শপিং মল, বাস স্টেশন বা কোনো ব্যস্ত রাস্তা)। কখনো নির্জন বা অচেনা জায়গায় দেখা করবেন না।'
                : 'Always choose a busy and well-lit public place to meet (e.g. shopping malls, bus stations, or active streets). Avoid meeting in remote or isolated areas.'}
            </li>
            <li>
              {lang === 'bn'
                ? 'টাকা পরিশোধের আগে পণ্যটি নিজে ধরে ভালো করে যাচাই করুন। ইলেকট্রনিক্স পণ্য হলে অন করে কাজ করছে কি না পরীক্ষা করুন।'
                : 'Thoroughly inspect the item yourself before handing over any money. If it is an electronics item, turn it on and test all functions.'}
            </li>
          </ul>

          <h2>
            💳 {lang === 'bn' ? '২. নিরাপদ লেনদেন পদ্ধতি' : '2. Secure Payment Methods'}
          </h2>
          <ul>
            <li>
              {lang === 'bn'
                ? 'পণ্য এবং পেমেন্টের লেনদেন একই সাথে সরাসরি সম্পন্ন করুন। মোবাইল ব্যাংকিং (বিকাশ, রকেট, নগদ) ব্যবহারের সময় টাকা প্রাপ্তির মেসেজটি নিজের অ্যাকাউন্ট ব্যালেন্স চেক করে নিশ্চিত হোন।'
                : 'Complete the exchange of product and payment simultaneously face-to-face. When using mobile banking, verify the payment in your own account balance, not just the SMS.'}
            </li>
            <li>
              {lang === 'bn'
                ? 'অযৌক্তিক বা অবিশ্বাস্য কম দামের অফার থেকে সাবধান থাকুন। যদি কোনো অফার অবিশ্বাস্য রকম ভালো মনে হয়, তবে অধিকাংশ ক্ষেত্রে তা স্ক্যাম হতে পারে।'
                : 'Beware of unrealistic or unbelievably cheap offers. If a deal looks too good to be true, it is highly likely a scam.'}
            </li>
          </ul>

          <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
            <Link href="/faq" className={styles.ctaBtn}>
              {lang === 'bn' ? 'সাধারণ জিজ্ঞাসা দেখুন' : 'View FAQ'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
