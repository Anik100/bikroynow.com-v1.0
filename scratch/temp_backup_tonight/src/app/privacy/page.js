'use client';

import { useLanguage } from '../../context/LanguageContext';
import styles from '../about-us/static-pages.module.css';

export default function Privacy() {
  const { lang } = useLanguage();

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>
            {lang === 'bn' ? 'গোপনীয়তার নীতি' : 'Privacy Policy'}
          </h1>
          <p className={styles.subtitle}>
            {lang === 'bn' 
              ? 'আপনার তথ্যের গোপনীয়তা ও নিরাপত্তা রক্ষা আমাদের মূল লক্ষ্য' 
              : 'Protecting your privacy and securing your personal information is our main priority'}
          </p>
        </div>

        <div className={styles.contentSection}>
          <p>
            {lang === 'bn'
              ? 'বিক্রয়হাটে আমরা আপনার ব্যক্তিগত তথ্যের গোপনীয়তা বজায় রাখতে সম্পূর্ণ প্রতিশ্রুতিবদ্ধ। আমরা আপনার তথ্য কীভাবে সংগ্রহ, ব্যবহার এবং সুরক্ষিত রাখি তা এই নীতিমালার মাধ্যমে ব্যাখ্যা করা হলো।'
              : 'At BikroyHut, we are fully committed to maintaining the confidentiality of your personal information. This policy explains how we collect, use, and safeguard your details.'}
          </p>

          <h2>
            🛡️ {lang === 'bn' ? '১. তথ্য সংগ্রহ ও ব্যবহার' : '1. Information We Collect'}
          </h2>
          <p>
            {lang === 'bn'
              ? 'আপনার অ্যাকাউন্ট তৈরি করার সময় আমরা আপনার নাম, ইমেইল এবং মোবাইল নম্বর সংগ্রহ করি। আপনি যখন কোনো বিজ্ঞাপন দেন, তখন আপনার দেওয়া যোগাযোগের ফোন নম্বর এবং বিবরণ সাইটের ভিজিটরদের কাছে দৃশ্যমান হয় যাতে ক্রেতারা সরাসরি যোগাযোগ করতে পারেন।'
              : 'When you create an account, we collect your name, email, and phone number. When you post an ad, your contact number and listing details are visible to site visitors so that potential buyers can connect with you directly.'}
          </p>

          <h2>
            🔐 {lang === 'bn' ? '২. ডেটা নিরাপত্তা' : '2. Data Security'}
          </h2>
          <p>
            {lang === 'bn'
              ? 'আমরা আপনার ডেটা সুরক্ষার জন্য অত্যন্ত আধুনিক এবং বিশ্বস্ত ক্লাউড ডেটাবেস (Supabase) এবং এনক্রিপশন সিস্টেম ব্যবহার করি। আমরা কোনো অবস্থাতেই আপনার ব্যক্তিগত তথ্য কোনো থার্ড-পার্টি বা বাইরের কোনো প্রতিষ্ঠানের কাছে বিক্রি বা অপব্যবহার করি না।'
              : 'We utilize state-of-the-art secure cloud database (Supabase) and encryption protocols to secure your data. Under no circumstances do we sell or disclose your personal information to third parties for marketing purposes.'}
          </p>

          <h2>
            🍪 {lang === 'bn' ? '৩. কুকিজ ব্যবহার' : '3. Cookies'}
          </h2>
          <p>
            {lang === 'bn'
              ? 'আপনার কেনাকাটার অভিজ্ঞতাকে আরও সহজ ও গতিশীল করতে আমরা ব্রাউজার কুকিজ ব্যবহার করি। এটি আপনার পছন্দের ক্যাটাগরি, অবস্থান এবং ভাষা সংরক্ষণ করতে সাহায্য করে যাতে আপনাকে বারবার রি-সিলেক্ট করতে না হয়।'
              : 'We use browser cookies to enhance and streamline your shopping experience. Cookies help remember your preferred category, location, and language settings so you do not have to re-select them constantly.'}
          </p>
        </div>
      </div>
    </div>
  );
}
