'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import styles from './membership.module.css';
import { CheckCircle2, Zap, Award, Briefcase, AlertCircle, Copy, Check, UploadCloud, ArrowLeft, Store } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { uploadToImgBB } from '../../lib/imgbb';
import { compressImage } from '../../lib/utils';

// Static default clean packages (used instantly, seamlessly synced with database)
const DEFAULT_BOOST_PACKAGES = [
  {
    id: 'boost_3d',
    name_bn: '৩ দিনের কুইক বুস্ট (Quick Boost)',
    name_en: '3-Day Quick Boost',
    tagline_bn: 'কম বাজেটে ১টি পণ্য দ্রুত বিক্রি করার জন্য সেরা',
    tagline_en: 'Best budget option to sell 1 item fast',
    price: 99,
    duration: 3,
    duration_unit: 'days',
    type: 'boost',
    color: 'silver',
    badge_bn: '⚡ FAST SALE',
    badge_en: '⚡ FAST SALE',
    is_featured: false,
    features: [
      { bn: '৫ গুণ বেশি কাস্টমার রিচ ও ভিউ', en: '5x more buyer reach & views' },
      { bn: 'ক্যাটাগরি পেজের ওপরের তালিকায় অবস্থান', en: 'Top position in category search' },
      { bn: '৩ দিনের জন্য "Top Ad" ব্যাজ', en: '"Top Ad" badge for 3 days' },
      { bn: 'দ্রুত ক্রেতা পাওয়ার সুবিধা', en: 'Faster buyer response' }
    ]
  },
  {
    id: 'boost_7d',
    name_bn: '৭ দিনের সুপার বুস্ট (Super Boost)',
    name_en: '7-Day Super Boost',
    tagline_bn: 'সর্বোচ্চ বিক্রি নিশ্চিত করার সবচেয়ে জনপ্রিয় চয়েস',
    tagline_en: 'Most popular choice to guarantee fast sales',
    price: 299,
    offer_price: 199,
    duration: 7,
    duration_unit: 'days',
    type: 'boost',
    color: 'gold',
    badge_bn: '🔥 সেরা অফার',
    badge_en: '🔥 MOST POPULAR',
    is_featured: true,
    features: [
      { bn: '১০ গুণ বেশি কাস্টমার রিচ ও কল', en: '10x more buyer reach & calls' },
      { bn: 'হোম ফিড ও সার্চে সবার ওপরের স্থানে পোস্ট', en: 'Top position in main feed & search' },
      { bn: '৭ দিনের জন্য "Super Ad" গোল্ডেন ব্যাজ', en: '"Super Ad" golden badge for 7 days' },
      { bn: 'হাইলাইটেড সোনালী বর্ডার ও ভিজিবিলিটি', en: 'Highlighted golden border & visibility' }
    ]
  },
  {
    id: 'boost_15d',
    name_bn: '১৫ দিনের মেগা বুস্ট (Mega Boost)',
    name_en: '15-Day Mega Boost',
    tagline_bn: 'দামি বা বড় পণ্য (গাড়ি, জমি, ইলেকট্রনিক্স) বিক্রির জন্য',
    tagline_en: 'Ideal for high-value items like vehicles & property',
    price: 349,
    duration: 15,
    duration_unit: 'days',
    type: 'boost',
    color: 'business',
    badge_bn: '🚀 ম্যাক্সিমাম রিচ',
    badge_en: '🚀 MAXIMUM REACH',
    is_featured: false,
    features: [
      { bn: '২০ গুণ ম্যাক্সিমাম কাস্টমার রিচ', en: '20x maximum customer reach' },
      { bn: '১৫ দিন টানা প্রথম ১-৩ সারিতে অবস্থান', en: 'Top position for 15 full days' },
      { bn: '১৫ দিনের জন্য "Urgent Sale" ব্যাজ', en: '"Urgent Sale" badge on ad' },
      { bn: 'সার্চ ফলাফলে হাইলাইটেড ব্যাকগ্রাউন্ড', en: 'Highlighted search background' }
    ]
  }
];

const DEFAULT_MEMBERSHIP_PACKAGES = [
  {
    id: 'mem_silver',
    name_bn: 'সিলভার মেম্বার (Silver Member)',
    name_en: 'Silver Member',
    tagline_bn: 'ছোট বিক্রেতা ও শুরু করা দোকানদারদের জন্য',
    tagline_en: 'Perfect for small sellers & growing shops',
    price: 999,
    duration: 1,
    duration_unit: 'month',
    type: 'membership',
    color: 'silver',
    badge_bn: '🥈 STARTER',
    badge_en: '🥈 STARTER',
    is_featured: false,
    features: [
      { bn: 'একসাথে ৫০টি পর্যন্ত পণ্য অ্যাক্টিভ রাখার সুযোগ', en: 'Up to 50 active ads simultaneously' },
      { bn: 'নিজের লোগোসহ কাস্টম শপ পেজ (Shop Page)', en: 'Custom Shop Page with Logo' },
      { bn: 'প্রোফাইলে Verified Silver Member ব্যাজ', en: 'Verified Silver Member badge' },
      { bn: 'হোয়াটসঅ্যাপ ও সরাসরি কলিং বাটন', en: 'Direct WhatsApp & phone call button' }
    ]
  },
  {
    id: 'mem_gold',
    name_bn: 'গোল্ড মেম্বার (Gold Member)',
    name_en: 'Gold Member',
    tagline_bn: 'নিয়মিত বিক্রেতা ও পরিচিত শোরুমের সেরা পছন্দ',
    tagline_en: 'Top choice for active shops & showrooms',
    price: 2499,
    duration: 1,
    duration_unit: 'month',
    type: 'membership',
    color: 'gold',
    badge_bn: '🥇 সেরা পছন্দ',
    badge_en: '🥇 POPULAR SHOP',
    is_featured: true,
    features: [
      { bn: 'একসাথে ১৫০টি পণ্য অ্যাক্টিভ রাখার সুযোগ', en: 'Up to 150 active ads simultaneously' },
      { bn: 'প্রতি মাসে ৫টি ফ্রি Top Ad প্রমোশন', en: '5 FREE Top Ad promotions every month' },
      { bn: 'লোগো ও কাস্টম ব্যানারসহ প্রিমিয়াম শপ পেজ', en: 'Custom Shop Page with Logo & Banner' },
      { bn: 'প্রোফাইল ও বিজ্ঞাপনে Gold Member ব্যাজ', en: 'Gold Member badge on profile & ads' },
      { bn: '২৪/৭ অগ্রাধিকার ভিত্তিতে কাস্টমার সাপোর্ট', en: 'Priority Customer Support 24/7' }
    ]
  },
  {
    id: 'mem_business',
    name_bn: 'বিজনেস পার্টনার (Business Partner)',
    name_en: 'Business Partner',
    tagline_bn: 'বড় কোম্পানি, ডিলার ও পাইকারি বিক্রেতাদের জন্য',
    tagline_en: 'Tailored for large dealers, brands & wholesalers',
    price: 4999,
    duration: 1,
    duration_unit: 'month',
    type: 'membership',
    color: 'business',
    badge_bn: '💼 ENTERPRISE',
    badge_en: '💼 ENTERPRISE',
    is_featured: false,
    features: [
      { bn: 'আনলিমিটেড (Unlimited) পণ্য পোস্ট করার সুবিধা', en: 'Unlimited active ads' },
      { bn: '১৫টি ফ্রি Top Ad প্রমোশন প্রতি মাসে', en: '15 FREE Top Ad promotions every month' },
      { bn: 'ডেডিকেটেড একাউন্ট ম্যানেজার সাপোর্ট', en: 'Dedicated Customer Success Manager' },
      { bn: 'হোম পেজে স্পেশাল পার্টনার ব্যানার প্রমোশন', en: 'Custom Shop Page + Home Partner Banner' },
      { bn: 'অফিসিয়াল Verified Business Partner ব্যাজ', en: 'Verified Business Partner Badge' }
    ]
  }
];

export default function Membership() {
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState('boost'); // 'boost' or 'membership'
  const [boostPacks, setBoostPacks] = useState(DEFAULT_BOOST_PACKAGES);
  const [memberPacks, setMemberPacks] = useState(DEFAULT_MEMBERSHIP_PACKAGES);
  const [loading, setLoading] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('bkash');
  const [bkashNumber, setBkashNumber] = useState('01700000000');
  const [nagadNumber, setNagadNumber] = useState('01800000000');
  const [bkashType, setBkashType] = useState('Personal');
  const [nagadType, setNagadType] = useState('Personal');

  // Form input states
  const [userEmail, setUserEmail] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEmailReadOnly, setIsEmailReadOnly] = useState(false);

  // User Listings for Boosting
  const [userListings, setUserListings] = useState([]);
  const [selectedListingId, setSelectedListingId] = useState('');

  useEffect(() => {
    fetchPackagesAndSettings();
    checkUserSession();
  }, []);

  const fetchPackagesAndSettings = async () => {
    try {
      // 1. Fetch DB Payment Numbers & Settings
      const { data: settingsData } = await supabase
        .from('admin_settings')
        .select('*');
      if (settingsData) {
        const bkash = settingsData.find(s => s.key === 'bkash_number');
        const bkType = settingsData.find(s => s.key === 'bkash_type');
        const nagad = settingsData.find(s => s.key === 'nagad_number');
        const ngType = settingsData.find(s => s.key === 'nagad_type');
        if (bkash) setBkashNumber(bkash.value);
        if (bkType) setBkashType(bkType.value);
        if (nagad) setNagadNumber(nagad.value);
        if (ngType) setNagadType(ngType.value);
      }

      // 2. Try fetching custom active packages from DB if available
      const { data: pkgData } = await supabase
        .from('membership_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (pkgData && pkgData.length > 0) {
        const dbBoosts = pkgData.filter(p => p.type === 'boost');
        const dbMembers = pkgData.filter(p => p.type === 'membership' || !p.type);
        if (dbBoosts.length > 0) setBoostPacks(dbBoosts);
        if (dbMembers.length > 0) setMemberPacks(dbMembers);
      }
    } catch (err) {
      console.error('Settings load error:', err);
    }
  };

  const checkUserSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      setUserEmail(session.user.email);
      setIsEmailReadOnly(true);

      try {
        const { data: listings } = await supabase
          .from('listings')
          .select('id, title')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
        if (listings) {
          setUserListings(listings);
          if (listings.length > 0) {
            setSelectedListingId(listings[0].id);
          }
        }
      } catch (err) {
        console.error('Listings load error:', err);
      }
    }
  };

  const handleApply = (pkg) => {
    setSelectedPack(pkg);
    setShowModal(true);
    setSuccess(false);
    setErrorMsg('');
    setSenderNumber('');
    setTransactionId('');
    setScreenshotUrl('');
  };

  const handleCopyNumber = () => {
    const num = paymentMethod === 'bkash' ? bkashNumber : nagadNumber;
    navigator.clipboard.writeText(num);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg('');
    try {
      const compressed = await compressImage(file);
      const url = await uploadToImgBB(compressed);
      if (url) {
        setScreenshotUrl(url);
      } else {
        setErrorMsg('Image upload failed.');
      }
    } catch (err) {
      setErrorMsg('ImgBB Upload Error: ' + err.message);
    }
    setUploading(false);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!userEmail) {
      setErrorMsg(lang === 'bn' ? 'অনুগ্রহ করে আপনার ইমেইল প্রদান করুন।' : 'Please enter your email.');
      return;
    }
    if (!senderNumber || !transactionId) {
      setErrorMsg(lang === 'bn' ? 'সবগুলো ক্ষেত্র পূরণ করুন।' : 'Please fill all required fields.');
      return;
    }

    if (selectedPack && selectedPack.type === 'boost' && !selectedListingId) {
      setErrorMsg(lang === 'bn' 
        ? 'বুস্ট করার জন্য একটি বিজ্ঞাপন সিলেক্ট করা আবশ্যক!' 
        : 'Selecting an ad to boost is required!');
      return;
    }

    const bdMobileRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;
    const formattedSender = senderNumber.trim();
    if (!bdMobileRegex.test(formattedSender)) {
      setErrorMsg(lang === 'bn'
        ? 'অনুগ্রহ করে একটি সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)'
        : 'Please enter a valid Bangladeshi mobile number (e.g. 017XXXXXXXX)');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const cleanTxnId = transactionId.trim();
      const { data: existingTxn } = await supabase
        .from('membership_purchases')
        .select('id')
        .eq('transaction_id', cleanTxnId)
        .limit(1);

      if (existingTxn && existingTxn.length > 0) {
        setErrorMsg(lang === 'bn'
          ? 'এই ট্রানজেকশন আইডিটি ইতিমধ্যে ব্যবহৃত হয়েছে! দয়া করে সঠিক আইডিটি দিন।'
          : 'This Transaction ID has already been used! Please enter a valid unique Transaction ID.');
        setSubmitting(false);
        return;
      }

      const purchasePayload = {
        user_email: userEmail.trim(),
        package_id: selectedPack.id,
        package_name: selectedPack.name_en || selectedPack.name_bn,
        price: selectedPack.offer_price || selectedPack.price,
        payment_method: paymentMethod,
        sender_number: formattedSender,
        transaction_id: cleanTxnId,
        screenshot_url: screenshotUrl || null,
        status: 'pending'
      };

      if (selectedPack.type === 'boost') {
        purchasePayload.listing_id = selectedListingId;
      }

      const { error } = await supabase
        .from('membership_purchases')
        .insert([purchasePayload]);

      if (!error) {
        setSuccess(true);
      } else {
        setErrorMsg(error.message);
      }
    } catch (err) {
      setErrorMsg('Exception: ' + err.message);
    }
    setSubmitting(false);
  };

  const receiverNumber = paymentMethod === 'bkash' ? bkashNumber : nagadNumber;
  const currentPacks = activeTab === 'boost' ? boostPacks : memberPacks;

  return (
    <div className={styles.container}>
      {/* Back Button */}
      <button
        onClick={() => window.location.href = '/'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.85rem',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          background: 'white',
          color: '#475569',
          fontSize: '0.78rem',
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: '1rem',
          transition: 'all 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          fontFamily: "'Inter', sans-serif"
        }}
      >
        <ArrowLeft size={14} /> {lang === 'bn' ? 'হোমে ফিরে যান' : 'Back to Home'}
      </button>

      {/* 2-Tab Switching Navigation Bar at Top */}
      <div className={styles.tabContainer}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'boost' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('boost')}
        >
          <Zap size={16} color={activeTab === 'boost' ? '#ff7519' : '#64748b'} />
          {lang === 'bn' ? 'বিজ্ঞাপন বুস্ট করুন (Ad Boosts)' : 'Boost Single Ad'}
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'membership' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('membership')}
        >
          <Store size={16} color={activeTab === 'membership' ? '#008b5e' : '#64748b'} />
          {lang === 'bn' ? 'মেম্বারশিপ প্ল্যান (Shop Plans)' : 'Shop Memberships'}
        </button>
      </div>

      {/* Active Tab Section Header */}
      <div className={styles.sectionHeader}>
        <h2>
          {activeTab === 'boost'
            ? (lang === 'bn' ? '⚡ ১টি পণ্য দ্রুত বিক্রি করার জন্য সেরা ওটিপি ও বুস্ট প্ল্যান' : '⚡ Promoted & Featured Ad Boost Plans')
            : (lang === 'bn' ? '💼 দোকান ও ব্যবসার প্রসার বাড়াতে মাসিক মেম্বারশিপ প্ল্যান' : '💼 Monthly Business Shop Membership Plans')}
        </h2>
        <p>
          {activeTab === 'boost'
            ? (lang === 'bn' ? 'আপনার বিজ্ঞাপনটি হোম ফিড ও ক্যাটাগরি পেজে সবার ওপরে নিয়ে আসুন' : 'Place your ad at the top of category feeds & search results')
            : (lang === 'bn' ? 'অধিক বিজ্ঞাপন পোস্ট, শপ পেজ ও কাস্টমার ট্রাস্ট ব্যাজ পান' : 'Get unlimited ad listings, custom shop page & verified badge')}
        </p>
      </div>

      {/* Clean 3-Card Grid */}
      <div className={styles.packagesGrid}>
        {currentPacks.map(pkg => (
          <PackageCard key={pkg.id} pkg={pkg} lang={lang} onApply={() => handleApply(pkg)} />
        ))}
      </div>

      {/* Checkout Modal */}
      {showModal && selectedPack && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '520px', textAlign: 'left', padding: '1.5rem 1.75rem', overflowY: 'auto', maxHeight: '90vh' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 850, color: '#0f172a', margin: 0 }}>
                  {lang === 'bn' ? 'পেমেন্ট ও সক্রিয়করণ ফরম' : 'Payment Activation'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  অফার: <strong style={{ color: '#008b5e' }}>{lang === 'bn' ? selectedPack.name_bn : selectedPack.name_en}</strong> (Tk {(selectedPack.offer_price || selectedPack.price).toLocaleString()})
                </span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.4rem',
                  fontWeight: 300, cursor: 'pointer', outline: 'none'
                }}
              >
                &times;
              </button>
            </div>

            {success ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                <CheckCircle2 size={54} color="#10b981" style={{ margin: '0 auto 1rem auto' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                  {lang === 'bn' ? 'পেমেন্ট রিকোয়েস্ট জমা হয়েছে!' : 'Payment Request Submitted!'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                  {lang === 'bn' 
                    ? 'আপনার পেমেন্ট রিকোয়েস্টটি এডমিন প্যানেলে পাঠানো হয়েছে। এডমিন পেমেন্ট চেক করে আপনার প্যাকেজ/বুস্টটি দ্রুত সক্রিয় করে দিবেন। ধন্যবাদ!'
                    : 'Your transaction details have been sent to admin moderation. Once verified, your package/boost will be active immediately. Thank you!'}
                </p>
                <button className={styles.closeBtn} onClick={() => { setShowModal(false); setSuccess(false); }}>
                  {lang === 'bn' ? 'বন্ধ করুন' : 'Close Window'}
                </button>
              </div>
            ) : (
              <div>
                {errorMsg && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fef2f2', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 700, padding: '0.6rem 0.8rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #fee2e2' }}>
                    <AlertCircle size={14} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Package Included Benefits Box */}
                {selectedPack && selectedPack.features && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '0.8rem 0.9rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
                      📦 {lang === 'bn' ? 'এই প্যাকেজে যা যা থাকবে:' : 'Included Package Benefits:'}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                      {Array.isArray(selectedPack.features) && selectedPack.features.map((feat, idx) => (
                        <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.76rem', color: '#334155', marginBottom: '0.3rem', lineHeight: 1.35 }}>
                          <CheckCircle2 size={13} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{lang === 'bn' ? (feat.bn || feat.en) : (feat.en || feat.bn)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Step 1: Payment Method Switch */}
                <label style={modalLabelStyle}>{lang === 'bn' ? '১. পেমেন্ট মাধ্যম সিলেক্ট করুন' : '1. Select Payment Method'}</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bkash')}
                    style={{
                      flex: 1, padding: '0.6rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem',
                      cursor: 'pointer', border: paymentMethod === 'bkash' ? '2px solid #e11d48' : '1px solid #cbd5e1',
                      background: paymentMethod === 'bkash' ? '#fff1f2' : 'white',
                      color: paymentMethod === 'bkash' ? '#e11d48' : '#475569', transition: 'all 0.2s'
                    }}
                  >
                    বিকাশ (bKash)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('nagad')}
                    style={{
                      flex: 1, padding: '0.6rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem',
                      cursor: 'pointer', border: paymentMethod === 'nagad' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                      background: paymentMethod === 'nagad' ? '#fff7ed' : 'white',
                      color: paymentMethod === 'nagad' ? '#ea580c' : '#475569', transition: 'all 0.2s'
                    }}
                  >
                    নগদ (Nagad)
                  </button>
                </div>

                {/* Step 2: Payment Number Box */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    {lang === 'bn' 
                      ? `আমাদের ${paymentMethod === 'bkash' ? 'বিকাশ' : 'নগদ'} (${paymentMethod === 'bkash' ? (bkashType === 'Personal' ? 'পার্সোনাল' : bkashType === 'Agent' ? 'এজেন্ট' : 'মার্চেন্ট') : (nagadType === 'Personal' ? 'পার্সোনাল' : nagadType === 'Agent' ? 'এজেন্ট' : 'মার্চেন্ট')}) নাম্বার` 
                      : `Our ${paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} (${paymentMethod === 'bkash' ? bkashType : nagadType}) Number`}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 850, color: '#0f172a', letterSpacing: '0.5px' }}>{receiverNumber}</span>
                    <button
                      onClick={handleCopyNumber}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem', background: copied ? '#dcfce7' : 'white',
                        color: copied ? '#15803d' : '#475569', border: '1px solid #cbd5e1', borderRadius: '8px',
                        padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600, lineHeight: 1.4 }}>
                    ⚠️ {lang === 'bn' ? 'উপরের নাম্বারে পেমেন্ট (Send Money) সম্পন্ন করে নিচের তথ্যগুলো দিয়ে ফরমটি পূরণ করুন।' : 'Send Money to the number above, then submit your transaction details below.'}
                  </p>
                </div>

                {/* Step 3: Transaction Info Form */}
                <form onSubmit={handleSubmitPayment}>
                  {/* Email Input */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={modalLabelStyle}>{lang === 'bn' ? 'আপনার রেজিস্টার্ড ইমেইল' : 'Your Registered Email'}</label>
                    <input
                      type="email"
                      required
                      value={userEmail}
                      onChange={e => setUserEmail(e.target.value)}
                      readOnly={isEmailReadOnly}
                      placeholder="e.g. buyer@gmail.com"
                      style={{
                        ...modalInputStyle,
                        backgroundColor: isEmailReadOnly ? '#f1f5f9' : 'white',
                        cursor: isEmailReadOnly ? 'not-allowed' : 'text',
                        color: isEmailReadOnly ? '#64748b' : 'inherit'
                      }}
                    />
                  </div>

                  {/* Select Ad to Boost (If Boost type package) */}
                  {selectedPack && selectedPack.type === 'boost' && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={modalLabelStyle}>
                        {lang === 'bn' ? 'বুস্ট করার জন্য বিজ্ঞাপন সিলেক্ট করুন' : 'Select Ad to Boost'}
                      </label>
                      {userListings.length > 0 ? (
                        <select
                          required
                          value={selectedListingId}
                          onChange={e => setSelectedListingId(e.target.value)}
                          style={modalInputStyle}
                        >
                          <option value="">-- Select Listing --</option>
                          {userListings.map(ad => (
                            <option key={ad.id} value={ad.id}>{ad.title}</option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, padding: '0.5rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                          ⚠️ {lang === 'bn' 
                            ? 'আপনার কোনো বিজ্ঞাপন পোস্ট করা নেই! বুস্ট করার আগে দয়া করে একটি বিজ্ঞাপন পোস্ট করুন।' 
                            : 'You have no ads posted! Please post an ad before you can boost one.'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Info Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={modalLabelStyle}>{lang === 'bn' ? 'যে নাম্বার থেকে পাঠিয়েছেন' : 'Sender Phone Number'}</label>
                      <input
                        type="text"
                        required
                        value={senderNumber}
                        onChange={e => setSenderNumber(e.target.value)}
                        placeholder="017xxxxxxxx"
                        style={modalInputStyle}
                      />
                    </div>
                    <div>
                      <label style={modalLabelStyle}>{lang === 'bn' ? 'ট্রানজেকশন আইডি (TxnID)' : 'Transaction ID (TxnID)'}</label>
                      <input
                        type="text"
                        required
                        value={transactionId}
                        onChange={e => setTransactionId(e.target.value)}
                        placeholder="8N2K8DL9S"
                        style={modalInputStyle}
                      />
                    </div>
                  </div>

                  {/* ImgBB Screenshot Uploader */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={modalLabelStyle}>
                      {lang === 'bn' ? 'পেমেন্ট স্ক্রিনশট বা রসিদ (ঐচ্ছিক)' : 'Payment Screenshot/Receipt (Optional)'}
                    </label>
                    
                    <div style={{ position: 'relative' }}>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        id="screenshot-file"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                        disabled={uploading}
                      />
                      <label
                        htmlFor="screenshot-file"
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          border: '1.5px dashed #cbd5e1', borderRadius: '10px', padding: '0.75rem', cursor: uploading ? 'not-allowed' : 'pointer',
                          background: '#f8fafc', transition: 'border-color 0.2s', textAlign: 'center'
                        }}
                      >
                        {uploading ? (
                          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Uploading screenshot...</span>
                        ) : screenshotUrl ? (
                          <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>✓ Screenshot uploaded successfully!</span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#475569', fontWeight: 700 }}>
                            <UploadCloud size={14} /> Upload Screenshot
                          </span>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Submission buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      style={{
                        flex: 1, padding: '0.65rem', borderRadius: '10px', border: '1px solid #cbd5e1',
                        background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem'
                      }}
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    
                    <button
                      type="submit"
                      disabled={submitting || uploading}
                      style={{
                        flex: 2, padding: '0.65rem', borderRadius: '10px', border: 'none',
                        background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #008b5e, #05b078)',
                        color: 'white', fontWeight: 800, cursor: (submitting || uploading) ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem', boxShadow: '0 4px 10px rgba(0, 139, 94, 0.2)'
                      }}
                    >
                      {submitting ? 'Submitting...' : (lang === 'bn' ? 'নিশ্চিত করুন' : 'Confirm Purchase')}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PackageCard({ pkg, lang, onApply }) {
  const name = lang === 'bn' ? pkg.name_bn : pkg.name_en;
  const tagline = lang === 'bn' ? pkg.tagline_bn : pkg.tagline_en;
  const badge = lang === 'bn' ? pkg.badge_bn : pkg.badge_en;
  const features = Array.isArray(pkg.features) ? pkg.features : [];
  const isBoost = pkg.type === 'boost';

  const getPriceDisplay = () => {
    const durationText = isBoost
      ? ` / ${pkg.duration ? (lang === 'bn' ? (pkg.duration_unit === 'days' ? `${pkg.duration} দিন` : `${pkg.duration} মাস`) : `${pkg.duration} ${pkg.duration_unit}`) : ''}`
      : ` / ${lang === 'bn' ? 'মাস' : 'month'}`;

    const regPriceStr = lang === 'bn' ? `৳ ${pkg.price.toLocaleString('bn-BD')}` : `Tk ${pkg.price.toLocaleString()}`;

    if (pkg.offer_price && pkg.offer_price < pkg.price) {
      const offerPriceStr = lang === 'bn' ? `৳ ${pkg.offer_price.toLocaleString('bn-BD')}` : `Tk ${pkg.offer_price.toLocaleString()}`;
      const discountPercent = Math.round(((pkg.price - pkg.offer_price) / pkg.price) * 100);
      const discountText = lang === 'bn' ? `${discountPercent}% ছাড়` : `SAVE ${discountPercent}%`;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#ef4444', textDecoration: 'line-through', fontWeight: 600, opacity: 0.85 }}>
              {regPriceStr}
            </span>
            <span style={{ background: '#fef08a', color: '#b45309', fontSize: '0.68rem', fontWeight: 900, padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #fde047' }}>
              {discountText}
            </span>
          </div>
          <div style={{ color: '#008b5e', fontWeight: 900, fontSize: '1.45rem' }}>
            {offerPriceStr}<span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>{durationText}</span>
          </div>
        </div>
      );
    }

    return (
      <div style={{ color: '#008b5e', fontWeight: 900, fontSize: '1.45rem' }}>
        {regPriceStr}<span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>{durationText}</span>
      </div>
    );
  };

  const btnLabel = isBoost
    ? (lang === 'bn' ? 'বুস্ট করুন ⚡' : 'Boost Now ⚡')
    : (lang === 'bn' ? 'আবেদন করুন 💼' : 'Apply Now 💼');

  const btnStyle = isBoost ? styles.btnGold : styles.btnBusiness;

  return (
    <div className={`${styles.card} ${pkg.is_featured ? styles.featuredCard : ''}`}>
      {badge && (
        <div className={styles.badge}>{badge}</div>
      )}
      <div className={styles.cardHeader}>
        {isBoost ? (
          <Zap size={22} color={pkg.is_featured ? '#ff7519' : '#008b5e'} style={{ margin: '0 auto 0.3rem auto' }} />
        ) : (
          <Store size={22} color={pkg.is_featured ? '#ff7519' : '#008b5e'} style={{ margin: '0 auto 0.3rem auto' }} />
        )}
        
        <h2 className={styles.packageName}>
          {name}
        </h2>

        <div className={styles.price}>
          {getPriceDisplay()}
        </div>
        {tagline && (
          <p className={styles.tagline}>{tagline}</p>
        )}
      </div>

      <ul className={styles.featureList}>
        {features.map((f, i) => (
          <li key={i} className={styles.featureItem}>
            <CheckCircle2 size={15} className={styles.checkIcon} />
            <span>
              {i === 0
                ? <strong>{lang === 'bn' ? f.bn : f.en}</strong>
                : (lang === 'bn' ? f.bn : f.en)
              }
            </span>
          </li>
        ))}
      </ul>

      <button
        className={`${styles.selectBtn} ${btnStyle}`}
        onClick={onApply}
      >
        {btnLabel}
      </button>
    </div>
  );
}

const modalLabelStyle = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 800,
  color: '#475569',
  marginBottom: '0.25rem',
  textTransform: 'uppercase',
  letterSpacing: '0.3px'
};

const modalInputStyle = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  border: '1.5px solid #cbd5e1',
  borderRadius: '8px',
  fontSize: '0.85rem',
  color: '#0f172a',
  background: 'white',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.2s',
  fontFamily: 'inherit'
};
