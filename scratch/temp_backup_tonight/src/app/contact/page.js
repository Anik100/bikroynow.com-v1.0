'use client';

import { useLanguage } from '../../context/LanguageContext';
import styles from '../about-us/static-pages.module.css';

export default function Contact() {
  const { lang } = useLanguage();

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>
            {lang === 'bn' ? 'যোগাযোগ করুন' : 'Contact Us'}
          </h1>
          <p className={styles.subtitle}>
            {lang === 'bn' 
              ? 'যেকোনো প্রয়োজনে বিক্রয়হাট কাস্টমার সাপোর্ট সর্বদা আপনার পাশে রয়েছে' 
              : 'BikroyHut Customer Support is always here to assist you'}
          </p>
        </div>

        <div className={styles.contentSection}>
          <p>
            {lang === 'bn'
              ? 'আমাদের প্ল্যাটফর্ম ব্যবহার করতে গিয়ে কোনো সমস্যা বা জিজ্ঞাসার সম্মুখীন হয়েছেন? অথবা কোনো পরামর্শ দিতে চান? নিচে দেওয়া মাধ্যমগুলোর মাধ্যমে সরাসরি আমাদের কাস্টমার সাপোর্ট টিমের সাথে যোগাযোগ করুন।'
              : 'Encountered an issue or have a query while using our platform? Or want to share some feedback? Get in touch with our dedicated customer support team directly.'}
          </p>

          <div className={styles.contactGrid}>
            <div className={styles.contactCard}>
              <h3>📧 {lang === 'bn' ? 'ইমেইল করুন' : 'Email Support'}</h3>
              <p>support@bikroyhut.com</p>
              <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
                {lang === 'bn' ? 'আমরা ২৪ ঘণ্টার মধ্যে উত্তর দিই' : 'We respond within 24 hours'}
              </p>
            </div>

            <div className={styles.contactCard}>
              <h3>📞 {lang === 'bn' ? 'হেল্পলাইন' : 'Helpline'}</h3>
              <p>+880 9612-488488</p>
              <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
                {lang === 'bn' ? 'সকাল ৯:০০ - রাত ৯:০০ (প্রতিদিন)' : '9:00 AM - 9:00 PM (Daily)'}
              </p>
            </div>

            <div className={styles.contactCard}>
              <h3>📍 {lang === 'bn' ? 'অফিসের ঠিকানা' : 'Office Address'}</h3>
              <p>
                {lang === 'bn'
                  ? 'লেভেল ৪, বিক্রয়হাট টাওয়ার, গুলশান ২, ঢাকা ১২১২, বাংলাদেশ।'
                  : 'Level 4, BikroyHut Tower, Gulshan 2, Dhaka 1212, Bangladesh.'}
              </p>
            </div>

            <div className={styles.contactCard}>
              <h3>🌐 {lang === 'bn' ? 'সোশ্যাল মিডিয়া' : 'Social Media'}</h3>
              <p>facebook.com/BikroyHut</p>
              <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
                {lang === 'bn' ? 'মেসেঞ্জারে নক করুন যেকোনো সময়' : 'Message us on Messenger anytime'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
