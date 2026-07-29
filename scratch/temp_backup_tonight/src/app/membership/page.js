'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import styles from './membership.module.css';
import { CheckCircle2, Award, Briefcase, Zap, AlertCircle, Copy, Check, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { uploadToImgBB } from '../../lib/imgbb';
import { compressImage } from '../../lib/utils';

const ICON_MAP = {
  zap: Zap,
  award: Award,
  briefcase: Briefcase,
};

const COLOR_MAP = {
  silver: { icon: '#718096', name: '#4a5568', btn: styles.btnSilver },
  gold:   { icon: '#d69e2e', name: '#d69e2e', btn: styles.btnGold },
  business: { icon: '#2b6cb0', name: '#2b6cb0', btn: styles.btnBusiness },
};

export default function Membership() {
  const { lang } = useLanguage();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Checkout Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('bkash');
  const [bkashNumber, setBkashNumber] = useState('01700000000');
  const [nagadNumber, setNagadNumber] = useState('01800000000');
  
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

  // Listing selection & custom gateways states
  const [userListings, setUserListings] = useState([]);
  const [selectedListingId, setSelectedListingId] = useState('');
  const [bkashType, setBkashType] = useState('Personal');
  const [nagadType, setNagadType] = useState('Personal');

  useEffect(() => {
    fetchPackagesAndSettings();
    checkUserSession();
  }, []);

  const fetchPackagesAndSettings = async () => {
    setLoading(true);
    try {
      // 1. Fetch Packages
      const { data: pkgData } = await supabase
        .from('membership_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (pkgData) {
        // Enforce strict Silver -> Gold -> Business color order, followed by price
        const colorPriority = { silver: 1, gold: 2, business: 3 };
        const sorted = [...pkgData].sort((a, b) => {
          const priorityA = colorPriority[a.color?.toLowerCase()] || 99;
          const priorityB = colorPriority[b.color?.toLowerCase()] || 99;
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          if (a.price !== b.price) {
            return a.price - b.price;
          }
          return (a.sort_order || 0) - (b.sort_order || 0);
        });
        setPackages(sorted);
      }

      // 2. Fetch Admin Payment Numbers & Types
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
    } catch (err) {
      console.error('Fetch error:', err);
    }
    setLoading(false);
  };

  const checkUserSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      setUserEmail(session.user.email);
      setIsEmailReadOnly(true);

      // Fetch user's listings for boosting
      try {
        const { data: listings } = await supabase
          .from('listings')
          .select('id, title')
          .eq('user_id', session.user.id)
          .order('title', { ascending: true });
        if (listings) {
          setUserListings(listings);
          if (listings.length > 0) {
            setSelectedListingId(listings[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching user listings:', err);
      }
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 900;
          const MAX_HEIGHT = 900;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name || 'receipt.jpg', {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.65);
        };
      };
    });
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

    // 1. Bangladeshi Mobile Phone Number Validation Check
    const bdMobileRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;
    const formattedSender = senderNumber.trim();
    if (!bdMobileRegex.test(formattedSender)) {
      setErrorMsg(lang === 'bn'
        ? 'অনুগ্রহ করে একটি সঠিক বাংলাদেশী মোবাইল নাম্বার দিন (যেমন: 017XXXXXXXX)'
        : 'Please enter a valid Bangladeshi mobile number (e.g. 017XXXXXXXX)');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      // 2. Transaction ID Uniqueness Check (Prevent Duplicates)
      const cleanTxnId = transactionId.trim();
      const { data: existingTxn, error: checkError } = await supabase
        .from('membership_purchases')
        .select('id')
        .eq('transaction_id', cleanTxnId)
        .limit(1);

      if (checkError) {
        console.error('Check Error:', checkError);
      }

      if (existingTxn && existingTxn.length > 0) {
        setErrorMsg(lang === 'bn'
          ? 'এই ট্রানজেকশন আইডিটি ইতিমধ্যে ব্যবহৃত হয়েছে! দয়া করে সঠিক আইডিটি দিন।'
          : 'This Transaction ID has already been used! Please enter a valid unique Transaction ID.');
        setSubmitting(false);
        return;
      }

      // 3. Insert Purchase Request
      const purchasePayload = {
        user_email: userEmail.trim(),
        package_id: selectedPack.id,
        package_name: selectedPack.name_en,
        price: selectedPack.price,
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

  const silverPacks = packages.filter(p => p.color?.toLowerCase() === 'silver');
  const goldPacks = packages.filter(p => p.color?.toLowerCase() === 'gold');
  const businessPacks = packages.filter(p => p.color?.toLowerCase() === 'business');

  const receiverNumber = paymentMethod === 'bkash' ? bkashNumber : nagadNumber;

  return (
    <div className={styles.container}>
      {/* Back to Home Button */}
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
        onMouseEnter={e => {
          e.currentTarget.style.background = '#f8fafc';
          e.currentTarget.style.color = '#0f172a';
          e.currentTarget.style.borderColor = '#94a3b8';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'white';
          e.currentTarget.style.color = '#475569';
          e.currentTarget.style.borderColor = '#cbd5e1';
        }}
      >
        ⬅️ {lang === 'bn' ? 'হোমে ফিরে যান' : 'Back to Home'}
      </button>

      {/* Hero Banner Section */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>
          {lang === 'bn' ? 'বিক্রয়হাট প্রমোশন ও মেম্বারশিপ' : 'BikroyHut Boosts & Memberships'}
        </h1>
        <p className={styles.heroSubtitle}>
          {lang === 'bn'
            ? 'আপনার পণ্য বিক্রয়হাটের সাথে আরও দ্রুত ও নিশ্চিতভাবে বিক্রি করুন। ব্যক্তিগত বিজ্ঞাপনের জন্য কুইক বুস্ট অথবা ব্যবসায়ের জন্য প্রিমিয়াম মেম্বারশিপ নিয়ে আপনার সেলস বহুগুণ বৃদ্ধি করুন!'
            : 'Sell your items lightning-fast on BikroyHut. Choose a quick ad boost for individual products or get a premium business membership to multiply your sales!'}
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af', fontSize: '1.05rem', fontWeight: 600 }}>
          Loading packages & payment modes...
        </div>
      ) : (
        <>
          {/* 🥈 Silver Packages Section */}
          <div className={styles.sectionHeader}>
            <h2>{lang === 'bn' ? '🥈 সিলভার মেম্বার ও বুস্ট অফার (Silver Tier Packages)' : '🥈 Silver Tier Packages & Boosts'}</h2>
            <p>{lang === 'bn' ? 'ছোট বিক্রেতা ও দ্রুত বিজ্ঞাপনের সেরা বাজেট অফার সমূহ' : 'Best budget offers for quick promotions and small-scale sellers'}</p>
          </div>
          <div className={styles.packagesGrid}>
            {silverPacks.map(pkg => (
              <PackageCard key={pkg.id} pkg={pkg} lang={lang} onApply={() => handleApply(pkg)} />
            ))}
          </div>

          {/* 🥇 Gold Packages Section */}
          <div className={styles.sectionHeader} style={{ marginTop: '3rem' }}>
            <h2>{lang === 'bn' ? '🥇 গোল্ড প্রিমিয়াম মেম্বার ও বুস্ট অফার (Gold Premium Packages)' : '🥇 Gold Premium Packages & Boosts'}</h2>
            <p>{lang === 'bn' ? 'পেশাদার ও নিয়মিত বিক্রেতাদের জন্য সবচেয়ে জনপ্রিয় চয়েস' : 'Most popular choices for professional and active regular sellers'}</p>
          </div>
          <div className={styles.packagesGrid}>
            {goldPacks.map(pkg => (
              <PackageCard key={pkg.id} pkg={pkg} lang={lang} onApply={() => handleApply(pkg)} />
            ))}
          </div>

          {/* 💼 Business Packages Section */}
          <div className={styles.sectionHeader} style={{ marginTop: '3rem' }}>
            <h2>{lang === 'bn' ? '💼 বিজনেস মেম্বার ও বুস্ট অফার (Business Enterprise Packages)' : '💼 Business Enterprise Packages & Boosts'}</h2>
            <p>{lang === 'bn' ? 'শোরুম, ডিলার ও বড় কোম্পানির ব্যবসার পরিধি বাড়ানোর জন্য সেরা প্যাকেজ' : 'Ultimate high-reach options tailored for showrooms, dealers and large businesses'}</p>
          </div>
          <div className={styles.packagesGrid}>
            {businessPacks.map(pkg => (
              <PackageCard key={pkg.id} pkg={pkg} lang={lang} onApply={() => handleApply(pkg)} />
            ))}
          </div>
        </>
      )}

      {/* 💳 Checkout Multi-step Payment Modal */}
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
                  অফার: <strong style={{ color: '#008b5e' }}>{lang === 'bn' ? selectedPack.name_bn : selectedPack.name_en}</strong> (Tk {selectedPack.price.toLocaleString()})
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
                    ? 'আপনার পেমেন্ট রিকোয়েস্টটি এডমিন প্যানেলে পাঠানো হয়েছে। এডমিন পেমেন্ট চেক করে আপনার প্যাকেজটি দ্রুত সক্রিয় করে দিবেন। ধন্যবাদ!'
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
                          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Uploading screenshot to ImgBB...</span>
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
  const IconComponent = ICON_MAP[pkg.icon] || Zap;
  const colorConfig = COLOR_MAP[pkg.color] || COLOR_MAP.silver;
  const name = lang === 'bn' ? pkg.name_bn : pkg.name_en;
  const tagline = lang === 'bn' ? pkg.tagline_bn : pkg.tagline_en;
  const badge = lang === 'bn' ? pkg.badge_bn : pkg.badge_en;
  const features = Array.isArray(pkg.features) ? pkg.features : [];
  const isBoost = pkg.type === 'boost';

  const getPriceDisplay = () => {
    const durationText = isBoost
      ? ` / ${pkg.duration} ${lang === 'bn' ? (pkg.duration_unit === 'days' ? 'দিন' : 'মাস') : pkg.duration_unit}`
      : ` / ${lang === 'bn' ? 'মাস' : 'month'}`;

    if (pkg.offer_price) {
      const discountPercent = Math.round(((pkg.price - pkg.offer_price) / pkg.price) * 100);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: '#94a3b8', textDecoration: 'line-through', fontWeight: 600 }}>
              Tk {pkg.price.toLocaleString()}
            </span>
            <span style={{ background: '#fef08a', color: '#b45309', fontSize: '0.7rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
              {discountPercent}% OFF
            </span>
          </div>
          <div>
            Tk {pkg.offer_price.toLocaleString()}<span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>{durationText}</span>
          </div>
        </div>
      );
    }

    return (
      <>Tk {pkg.price.toLocaleString()}<span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>{durationText}</span></>
    );
  };

  const btnLabel = isBoost
    ? (lang === 'bn' ? 'বুস্ট করুন' : 'Boost Now')
    : (lang === 'bn' ? 'আবেদন করুন' : 'Apply Now');

  return (
    <div className={`${styles.card} ${pkg.is_featured ? styles.featuredCard : ''}`}>
      {badge && (
        <div className={styles.badge}>{badge}</div>
      )}
      <div className={styles.cardHeader}>
        <IconComponent
          size={isBoost ? 28 : 34}
          color={colorConfig.icon}
          style={{ margin: '0 auto 0.75rem auto' }}
        />
        <h2
          className={styles.packageName}
          style={{ color: colorConfig.name }}
        >
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
            <CheckCircle2 size={13} className={styles.checkIcon} />
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
        className={`${styles.selectBtn} ${colorConfig.btn}`}
        onClick={onApply}
      >
        {btnLabel}
      </button>
    </div>
  );
}

// Inline Styles for Checkout Modal Fields
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
