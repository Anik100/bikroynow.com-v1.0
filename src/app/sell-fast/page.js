'use client';

import { useLanguage } from '../../context/LanguageContext';
import styles from '../about-us/static-pages.module.css';
import Link from 'next/link';

export default function SellFast() {
  const { lang } = useLanguage();

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>
            {lang === 'bn' ? 'দ্রুত বিক্রি করার টিপস' : 'Tips to Sell Fast'}
          </h1>
          <p className={styles.subtitle}>
            {lang === 'bn' 
              ? 'বিক্রয়নাউতে আপনার পণ্যের জন্য দ্রুত কাস্টমার পাওয়ার সেরা উপায়সমূহ' 
              : 'Best ways to attract buyers and sell your products quickly on BikroyNow'}
          </p>
        </div>

        <div className={styles.contentSection}>
          <p>
            {lang === 'bn'
              ? 'বিক্রয়নাউতে হাজার হাজার ক্রেতা প্রতিদিন তাদের পছন্দের পণ্য খুঁজছেন। আপনার বিজ্ঞাপনটি কীভাবে সহজেই ক্রেতাদের নজরে আনবেন এবং দ্রুততম সময়ে পণ্যটি বিক্রি করবেন, তার কিছু সেরা টিপস নিচে দেওয়া হলো:'
              : 'Every day, thousands of buyers are searching for products on BikroyNow. Here are some pro tips to get your ad noticed and sell your items in the fastest time possible:'}
          </p>

          <h2>
            📸 {lang === 'bn' ? '১. আকর্ষণীয় ও আসল ছবি ব্যবহার করুন' : '1. Use Clear & Real Photos'}
          </h2>
          <p>
            {lang === 'bn'
              ? 'বিজ্ঞাপনে পণ্যের আসল ছবি আপলোড করুন। ভালো আলোতে বিভিন্ন অ্যাঙ্গেল (সামনে, পেছনে, পাশে) থেকে ৪-৫টি পরিষ্কার ছবি তুলুন। ইন্টারনেট থেকে ডাউনলোড করা ডেমো ছবি ব্যবহার করা এড়িয়ে চলুন, কারণ ক্রেতারা আসল ছবি দেখতে পছন্দ করেন।'
              : 'Always upload real photos of the item. Take 4-5 clear pictures from different angles (front, back, sides) in good lighting. Avoid using stock photos from the internet, as buyers prefer to see the actual condition.'}
          </p>

          <h2>
            🏷️ {lang === 'bn' ? '২. যৌক্তিক মূল্য নির্ধারণ করুন' : '2. Price it Right'}
          </h2>
          <p>
            {lang === 'bn'
              ? 'অন্যান্য একই ধরণের ব্যবহৃত পণ্যের বর্তমান বাজারমূল্য যাচাই করে একটি প্রতিযোগিতামূলক ও যৌক্তিক মূল্য নির্ধারণ করুন। অতিরিক্ত বেশি দাম দিলে ক্রেতারা আগ্রহ হারিয়ে ফেলতে পারেন। যদি একটু দাম কমাতে পারেন, তবে বিবরণে "দাম আলোচনা সাপেক্ষে" বা "Negotiable" লিখে দিতে পারেন।'
              : 'Check the market price of similar used items and set a competitive, realistic price. Overpricing can discourage buyers. If you are open to offers, mention "Negotiable" in your description.'}
          </p>

          <h2>
            ✍️ {lang === 'bn' ? '৩. বিস্তারিত ও তথ্যবহুল বিবরণ দিন' : '3. Write a Detailed Description'}
          </h2>
          <p>
            {lang === 'bn'
              ? 'পণ্যের ব্র্যান্ড, মডেল, কতদিন ব্যবহার করা হয়েছে, পণ্যের বর্তমান অবস্থা (কোনো দাগ বা সমস্যা আছে কি না) এবং আপনি কী কী সাথে দিচ্ছেন (যেমন: চার্জার, বক্স, মেমোরি কার্ড) তা স্পষ্টভাবে বিবরণে লিখুন। তথ্যবহুল বিবরণ ক্রেতার মনে বিশ্বাস তৈরি করে।'
              : 'Clearly describe the brand, model, usage duration, and the item\'s current condition (any scratches or minor issues). Mention what accessories are included (e.g. charger, box, invoice). Honest details build buyer trust.'}
          </p>

          <h2>
            ⚡ {lang === 'bn' ? '৪. দ্রুত মেসেজের উত্তর দিন' : '4. Respond Quickly to Messages'}
          </h2>
          <p>
            {lang === 'bn'
              ? 'ক্রেতারা যখন ইনবক্সে মেসেজ পাঠান বা ফোনে কল করেন, তখন দ্রুত উত্তর দেওয়ার চেষ্টা করুন। দ্রুত এবং বিনয়ী যোগাযোগ ডিলটি দ্রুত সফল করতে সাহায্য করে।'
              : 'When interested buyers send messages in the built-in chat or call you, try to respond as quickly as possible. Quick and polite communication helps seal the deal faster.'}
          </p>

          <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
            <Link href="/post-ad" className={styles.ctaBtn}>
              {lang === 'bn' ? 'আপনার বিজ্ঞাপন পোস্ট করুন' : 'Post Your Ad'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
