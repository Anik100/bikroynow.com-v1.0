'use client';

import { useLanguage } from '../../context/LanguageContext';
import styles from './static-pages.module.css';
import Link from 'next/link';

export default function AboutUs() {
  const { lang } = useLanguage();

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>
            {lang === 'bn' ? 'আমাদের সম্পর্কে' : 'About Us'}
          </h1>
          <p className={styles.subtitle}>
            {lang === 'bn' 
              ? 'বিক্রয়হাট - বাংলাদেশের অন্যতম সেরা বাই-সেল ও ক্লাসিফাইডস প্ল্যাটফর্ম' 
              : 'BikroyHut - One of the leading Buy-Sell & Classifieds Platform in Bangladesh'}
          </p>
        </div>

        <div className={styles.contentSection}>
          <p>
            {lang === 'bn' 
              ? 'বিক্রয়হাটে আপনাকে স্বাগতম! বিক্রয়হাট হলো বাংলাদেশের একটি নির্ভরযোগ্য এবং আধুনিক লোকাল ক্লাসিফাইডস মার্কেটপ্লেস, যেখানে খুব সহজেই নতুন ও ব্যবহৃত পণ্য বেচাকেনা করা যায়। আমাদের লক্ষ্য হলো দেশের প্রতিটি মানুষের বেচাকেনার অভিজ্ঞতাকে সহজ, নিরাপদ এবং দ্রুততম করা।' 
              : 'Welcome to BikroyHut! BikroyHut is a reliable and modern local classifieds marketplace in Bangladesh, where buying and selling new and used items is incredibly easy. Our goal is to make the buying and selling experience easy, secure, and fast for everyone in the country.'}
          </p>

          <h2>
            🎯 {lang === 'bn' ? 'আমাদের লক্ষ্য' : 'Our Mission'}
          </h2>
          <p>
            {lang === 'bn'
              ? 'আমরা বিশ্বাস করি যে প্রতিটি ব্যবহৃত পণ্যেরও একটি নতুন মূল্য রয়েছে। বিক্রয়হাট ক্রেতা ও বিক্রেতাদের সরাসরি সংযুক্ত করে ঝামেলামুক্ত কেনাকাটা এবং পণ্য পুনরায় ব্যবহারের মাধ্যমে পরিবেশগত স্থায়িত্ব অর্জনে সহায়তা করে। মোবাইল ফোন, গ্যাজেট, বাইক, গাড়ি, ইলেকট্রনিক্স থেকে শুরু করে যেকোনো কিছু এখানে সহজেই পোস্ট করা যায়।'
              : 'We believe that every used item has a new value. BikroyHut directly connects buyers and sellers to achieve hassle-free trading and support environmental sustainability through recycling. From mobile phones, gadgets, bikes, cars, to electronics, anything can be posted here with ease.'}
          </p>

          <h2>
            ⭐ {lang === 'bn' ? 'কেন বিক্রয়হাট বেছে নেবেন?' : 'Why Choose BikroyHut?'}
          </h2>
          <ul>
            <li>
              <strong>{lang === 'bn' ? 'দ্রুত বিজ্ঞাপন দিন:' : 'Post Ads Fast:'}</strong>{' '}
              {lang === 'bn' ? 'মাত্র ১ মিনিটে যেকোনো বিজ্ঞাপন একদম ফ্রিতে পোস্ট করতে পারবেন।' : 'You can post any ad absolutely for free in just 1 minute.'}
            </li>
            <li>
              <strong>{lang === 'bn' ? 'নিরাপদ চ্যাটিং ও সরাসরি যোগাযোগ:' : 'Safe Chat & Direct Contact:'}</strong>{' '}
              {lang === 'bn' ? 'আমাদের প্ল্যাটফর্মে রয়েছে ইনবিল্ট চ্যাট অপশন ও সরাসরি কলিং সুবিধা।' : 'Our platform features built-in chat options and direct call facilities.'}
            </li>
            <li>
              <strong>{lang === 'bn' ? 'লোকাল সার্চ ও ফিল্টারিং:' : 'Local Search & Filtering:'}</strong>{' '}
              {lang === 'bn' ? 'আপনার বিভাগ বা শহরের কাছাকাছি সঠিক বিজ্ঞাপনটি সহজেই খুঁজে নিন।' : 'Easily find the right ad close to your division or city.'}
            </li>
          </ul>

          <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
            <Link href="/post-ad" className={styles.ctaBtn}>
              {lang === 'bn' ? 'বিজ্ঞাপন দিন এখনই' : 'Post Ad Now'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
