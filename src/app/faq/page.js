'use client';

import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import styles from '../about-us/static-pages.module.css';

export default function FAQ() {
  const { lang } = useLanguage();
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqs = [
    {
      q_en: 'How do I post a free ad on BikroyNow?',
      q_bn: 'আমি কীভাবে বিক্রয়নাউতে একটি ফ্রি বিজ্ঞাপন দেবো?',
      a_en: 'To post a free ad, click on the orange "Post Ad" button at the top right, choose your category, upload high-quality pictures, enter a valid phone number, title, description, and price. Then submit!',
      a_bn: 'ফ্রি বিজ্ঞাপন দিতে ওপরের ডানদিকের কমলা রঙের "বিজ্ঞাপন দিন" বোতামে ক্লিক করুন। এরপর আপনার ক্যাটাগরি বেছে নিন, সঠিক ছবি আপলোড করুন, একটি সচল মোবাইল নম্বর দিন এবং বিবরণ ও দাম লিখে সাবমিট করুন!'
    },
    {
      q_en: 'What is the required format for the phone number?',
      q_bn: 'মোবাইল নম্বরের সঠিক ফরম্যাট বা নিয়ম কী?',
      a_en: 'For security reasons, we require a valid Bangladeshi mobile number starting with 013 to 019, containing exactly 11 digits (e.g. 017XXXXXXXX). This prevents spam.',
      a_bn: 'নিরাপত্তার স্বার্থে সঠিক বাংলাদেশি মোবাইল নম্বর দিতে হবে যা ০১ দিয়ে শুরু হবে, এবং মোট ১১ ডিজিট হতে হবে (যেমন: 017XXXXXXXX)। এটি স্প্যাম ও প্রতারণা প্রতিরোধ করে।'
    },
    {
      q_en: 'How can I contact a seller directly?',
      q_bn: 'আমি কীভাবে বিজ্ঞাপনদাতার সাথে সরাসরি যোগাযোগ করব?',
      a_en: 'On the ad detail page, you can click on the "Show Phone Number" button to dial directly from your mobile device, or click "Chat" to send an instant real-time message.',
      a_bn: 'বিজ্ঞাপনটির বিস্তারিত পেজে গিয়ে আপনি "ফোন নম্বর" বাটনে ক্লিক করে সরাসরি কল করতে পারেন অথবা "চ্যাট করুন" বাটনে ক্লিক করে সাথে সাথে রিয়েল-টাইম চ্যাটিং শুরু করতে পারেন।'
    },
    {
      q_en: 'How do I edit or delete my active ads?',
      q_bn: 'আমি কীভাবে আমার দেওয়া বিজ্ঞাপন এডিট বা ডিলিট করব?',
      a_en: 'Go to your Dashboard or "My Ads" page from the global menu. Under each active ad card, you will find options to "Edit" or "Delete". Click delete to invoke our safe inline confirmation modal.',
      a_bn: 'গ্লোবাল মেনু থেকে আপনার ড্যাশবোর্ড বা "আমার বিজ্ঞাপন" পেজে যান। সেখানে প্রতিটি বিজ্ঞাপনের নিচে "এডিট" এবং "ডিলিট" বোতাম পাবেন। ডিলিটে ক্লিক করলে ডিলিট কনফার্মেশন প্রম্পট আসবে।'
    },
    {
      q_en: 'Is buying and selling safe on BikroyNow?',
      q_bn: 'বিক্রয়নাউতে বেচাকেনা করা কি নিরাপদ?',
      a_en: 'Yes, but always follow safety guidelines. Meet in public well-lit places, inspect the item thoroughly before making any payments, and never pay in advance to unknown sellers.',
      a_bn: 'হ্যাঁ, তবে সর্বদা নিরাপত্তা নির্দেশিকা মেনে চলুন। বেচাকেনার জন্য পাবলিক ও জনাকীর্ণ জায়গায় দেখা করুন, টাকা দেওয়ার আগে পণ্যটি ভালোভাবে পরীক্ষা করে দেখুন এবং অপরিচিত কাউকে অগ্রিম টাকা দেবেন না।'
    }
  ];

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>
            {lang === 'bn' ? 'সাধারণ জিজ্ঞাসা (FAQ)' : 'Frequently Asked Questions'}
          </h1>
          <p className={styles.subtitle}>
            {lang === 'bn' 
              ? 'বিক্রয়নাউ সম্পর্কিত সাধারণ প্রশ্ন ও উত্তর' 
              : 'Find quick answers to common questions about using BikroyNow'}
          </p>
        </div>

        <div className={styles.contentSection} style={{ marginTop: '1.5rem' }}>
          {faqs.map((faq, index) => (
            <div key={index} className={styles.faqItem} onClick={() => toggleFAQ(index)}>
              <div className={styles.faqQuestion}>
                <span>{lang === 'bn' ? faq.q_bn : faq.q_en}</span>
                <span style={{ fontSize: '0.8rem', color: '#ff7519', transition: 'transform 0.2s' }}>
                  {openIndex === index ? '▲' : '▼'}
                </span>
              </div>
              
              {openIndex === index && (
                <div className={styles.faqAnswer}>
                  {lang === 'bn' ? faq.a_bn : faq.a_en}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
