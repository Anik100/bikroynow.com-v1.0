'use client';

import { useLanguage } from '../../context/LanguageContext';
import styles from '../about-us/static-pages.module.css';

export default function Terms() {
  const { lang } = useLanguage();

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>
            {lang === 'bn' ? 'ব্যবহারের শর্তাবলী' : 'Terms and Conditions'}
          </h1>
          <p className={styles.subtitle}>
            {lang === 'bn' 
              ? 'বিক্রয়হাট ব্যবহার করার নিয়ম এবং নির্দেশনাবলী' 
              : 'Rules and regulations for using BikroyHut classifieds platform'}
          </p>
        </div>

        <div className={styles.contentSection}>
          <p>
            {lang === 'bn'
              ? 'বিক্রয়হাট ব্যবহারের পূর্বে অনুগ্রহ করে আমাদের শর্তাবলী মনোযোগ দিয়ে পড়ুন। আমাদের সাইটটি ব্যবহার বা এক্সেস করার অর্থ হলো আপনি এই শর্তাবলী সম্পূর্ণভাবে মেনে নিচ্ছেন।'
              : 'Please read our terms and conditions carefully before using BikroyHut. Accessing or using this site means you accept these terms and conditions in full.'}
          </p>

          <h2>
            📝 {lang === 'bn' ? '১. ব্যবহারকারীর দায়বদ্ধতা' : '1. User Obligations'}
          </h2>
          <p>
            {lang === 'bn'
              ? 'বিজ্ঞাপন পোস্ট করার সময় ব্যবহারকারীকে অবশ্যই সঠিক, সম্পূর্ণ এবং বৈধ তথ্য প্রদান করতে হবে। বিশেষ করে, সঠিক বাংলাদেশি মোবাইল নম্বর প্রদান করা বাধ্যতামূলক। বিজ্ঞাপনে কোনো প্রকার উস্কানিমূলক, অবৈধ, চুরি করা বা ভুয়া পণ্য প্রদর্শন করা কঠোরভাবে নিষিদ্ধ।'
              : 'When posting an ad, the user must provide accurate, complete, and valid information. Specifically, providing a valid Bangladeshi mobile number is mandatory. Displaying provocative, illegal, stolen, or fake items in ads is strictly prohibited.'}
          </p>

          <h2>
            ⚖️ {lang === 'bn' ? '২. কপিরাইট ও ওনারশিপ' : '2. Copyright and Ownership'}
          </h2>
          <p>
            {lang === 'bn'
              ? 'ব্যবহারকারীরা তাদের বিজ্ঞাপনে যে সমস্ত ছবি এবং বিবরণ আপলোড করেন তার সম্পূর্ণ ওনারশিপ ও দায়বদ্ধতা তাদের নিজেদের। তবে, আমাদের সাইটে আপলোড করার মাধ্যমে বিক্রয়হাটকে সেই কন্টেন্টগুলো প্রদর্শনের ও প্রমোট করার অনুমতি দেওয়া হয়।'
              : 'Users hold complete ownership and responsibility for all images and details uploaded to their ads. However, by uploading to our site, you grant BikroyHut the permission to display and promote that content.'}
          </p>

          <h2>
            ⚠️ {lang === 'bn' ? '৩. দায়মুক্তি (Disclaimer)' : '3. Disclaimer'}
          </h2>
          <p>
            {lang === 'bn'
              ? 'বিক্রয়হাট ক্রেতা ও বিক্রেতার মাঝে সরাসরি যোগাযোগের মাধ্যম হিসেবে কাজ করে। পণ্য ক্রয়ের আগে পণ্যের গুণগত মান ও সত্যতা ক্রেতাকে যাচাই করে নিতে হবে। কেনাবেচা বা লেনদেন সংক্রান্ত কোনো প্রকার আর্থিক বা অন্য কোনো ক্ষতির জন্য বিক্রয়হাট কর্তৃপক্ষ দায়ী থাকবে না।'
              : 'BikroyHut acts solely as a communication bridge between buyers and sellers. Buyers must inspect the quality and authenticity of any item before making a purchase. BikroyHut will not be liable for any financial or other damages resulting from transactions.'}
          </p>
        </div>
      </div>
    </div>
  );
}
