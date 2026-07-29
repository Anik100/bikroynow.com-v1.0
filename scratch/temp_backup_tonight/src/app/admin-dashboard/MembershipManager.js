'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp, Star, Database, AlertCircle, Copy, Check, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatPrice } from '../../lib/utils';

const EMPTY_PACKAGE = {
  type: 'boost',
  name_en: '',
  name_bn: '',
  price: '',
  offer_price: '',
  duration: '',
  duration_unit: 'days',
  tagline_en: '',
  tagline_bn: '',
  features: [{ en: '', bn: '' }],
  badge_en: '',
  badge_bn: '',
  color: 'silver',
  icon: 'zap',
  is_featured: false,
  is_active: true,
  sort_order: 0,
};

const DEFAULT_SEEDS = [
  // 🥈 SILVER TIER
  {
    type: 'boost', name_en: '3-Day Silver Boost', name_bn: '৩ দিনের সিলভার বুস্ট',
    price: 99, duration: 3, duration_unit: 'days',
    tagline_en: 'Perfect for quick budget emergency sales', tagline_bn: 'খুব দ্রুত বাজেট ফ্রেন্ডলি বিক্রির জন্য সেরা',
    features: [
      {en: "Get 5x more buyer reach & views", bn: "৫ গুণ (5x) বেশি কাস্টমার রিচ ও ভিউ"},
      {en: "Place ad higher in the feed", bn: "বিজ্ঞাপন ফিডের ওপরে প্রদর্শন"},
      {en: "Express Sale badge for 3 days", bn: "৩ দিনের জন্য এক্সপ্রেস সেল ট্যাগ"}
    ],
    color: 'silver', icon: 'zap', is_featured: false, sort_order: 1
  },
  {
    type: 'boost', name_en: '7-Day Silver Boost', name_bn: '৭ দিনের সিলভার বুস্ট',
    price: 199, duration: 7, duration_unit: 'days',
    tagline_en: 'Perfect for 1-week budget sales', tagline_bn: '১ সপ্তাহের মধ্যে কম বাজেটে বিক্রির জন্য সেরা',
    features: [
      {en: "Get 10x more buyer reach & views", bn: "১০ গুণ (10x) বেশি কাস্টমার রিচ ও ভিউ"},
      {en: "Place ad higher in the feed", bn: "বিজ্ঞাপন ফিডের ওপরে প্রদর্শন"},
      {en: "Express Sale badge for 7 days", bn: "৭ দিনের জন্য এক্সপ্রেস সেল ট্যাগ"}
    ],
    color: 'silver', icon: 'zap', is_featured: false, sort_order: 2
  },
  {
    type: 'boost', name_en: '15-Day Silver Boost', name_bn: '১৫ দিনের সিলভার বুস্ট',
    price: 349, duration: 15, duration_unit: 'days',
    tagline_en: 'Extended reach for minor items', tagline_bn: 'দীর্ঘমেয়াদী বাজেট ফ্রেন্ডলি কাস্টমার রিচ',
    features: [
      {en: "Get 15x more buyer reach & views", bn: "১৫ গুণ (15x) বেশি কাস্টমার রিচ ও ভিউ"},
      {en: "Place ad higher in the feed", bn: "বিজ্ঞাপন ফিডের ওপরে প্রদর্শন"},
      {en: "Express Sale badge for 15 days", bn: "১৫ দিনের জন্য এক্সপ্রেস সেল ট্যাগ"}
    ],
    color: 'silver', icon: 'zap', is_featured: false, sort_order: 3
  },
  {
    type: 'boost', name_en: '30-Day Silver Boost', name_bn: '৩০ দিনের সিলভার বুস্ট',
    price: 599, duration: 30, duration_unit: 'days',
    tagline_en: 'Full month budget ad promotion', tagline_bn: 'পুরো এক মাসব্যাপী বাজেট ফ্রেন্ডলি বুস্ট',
    features: [
      {en: "Get 20x more buyer reach & views", bn: "২০ গুণ (20x) বেশি কাস্টমার রিচ ও ভিউ"},
      {en: "Place ad higher in the feed", bn: "বিজ্ঞাপন ফিডের ওপরে প্রদর্শন"},
      {en: "Express Sale badge for 30 days", bn: "৩০ দিনের জন্য এক্সপ্রেস সেল ট্যাগ"}
    ],
    color: 'silver', icon: 'zap', is_featured: false, sort_order: 4
  },
  {
    type: 'membership', name_en: 'Silver Member', name_bn: 'সিলভার মেম্বার',
    price: 999, duration: 1, duration_unit: 'month',
    tagline_en: 'Perfect for small sellers & startups', tagline_bn: 'ছোট বিক্রেতা ও স্টার্টআপদের জন্য আদর্শ',
    features: [
      {en: "Get 30x more customer reach & sales", bn: "৩০ গুণ (30x) বেশি কাস্টমার সেলস ও রিচ"},
      {en: "Up to 50 active ads simultaneously", bn: "সর্বোচ্চ ৫০টি সক্রিয় বিজ্ঞাপন"},
      {en: "Custom Shop Page with your own logo", bn: "কাস্টম শপ পেইজ (লোগো সহ)"},
      {en: "Silver Member badge on profile", bn: "প্রোফাইলে সিলভার মেম্বার ব্যাজ"}
    ],
    color: 'silver', icon: 'award', is_featured: false, sort_order: 5
  },

  // 🥇 GOLD TIER
  {
    type: 'membership', name_en: '3-Day Gold Member', name_bn: '৩ দিনের গোল্ড মেম্বার',
    price: 399, duration: 3, duration_unit: 'days',
    tagline_en: 'Quick trial of premium gold membership', tagline_bn: 'স্বল্পমেয়াদী গোল্ড মেম্বারশিপের প্রিমিয়াম ট্রায়াল',
    features: [
      {en: "Get 40x more customer reach & sales", bn: "৪০ গুণ (40x) বেশি কাস্টমার সেলস ও রিচ"},
      {en: "Unlimited active ads for 3 days", bn: "৩ দিনের জন্য আনলিমিটেড বিজ্ঞাপন পোস্ট"},
      {en: "Custom Shop Page with logo & banner", bn: "কাস্টম শপ পেইজ (লোগো ও ব্যানার)"},
      {en: "Gold Member badge on profile", bn: "প্রোফাইলে গোল্ড মেম্বার ব্যাজ"}
    ],
    color: 'gold', icon: 'award', is_featured: false, sort_order: 6
  },
  {
    type: 'membership', name_en: '7-Day Gold Member', name_bn: '৭ দিনের গোল্ড মেম্বার',
    price: 799, duration: 7, duration_unit: 'days',
    tagline_en: '1-week premium gold membership', tagline_bn: '১ সপ্তাহের জন্য প্রিমিয়াম গোল্ড মেম্বারশিপ',
    features: [
      {en: "Get 45x more customer reach & sales", bn: "৪৫ গুণ (45x) বেশি কাস্টমার সেলস ও রিচ"},
      {en: "Unlimited active ads for 7 days", bn: "৭ দিনের জন্য আনলিমিটেড বিজ্ঞাপন পোস্ট"},
      {en: "Custom Shop Page with logo & banner", bn: "কাস্টম শপ পেইজ (লোগো ও ব্যানার)"},
      {en: "Gold Member badge on profile", bn: "প্রোফাইলে গোল্ড মেম্বার ব্যাজ"}
    ],
    color: 'gold', icon: 'award', is_featured: false, sort_order: 7
  },
  {
    type: 'membership', name_en: '15-Day Gold Member', name_bn: '১৫ দিনের গোল্ড মেম্বার',
    price: 1499, duration: 15, duration_unit: 'days',
    tagline_en: 'Half-month premium gold membership', tagline_bn: '১৫ দিনের জন্য প্রিমিয়াম গোল্ড মেম্বারশিপ',
    features: [
      {en: "Get 48x more customer reach & sales", bn: "৪৮ গুণ (48x) বেশি কাস্টমার সেলস ও রিচ"},
      {en: "Unlimited active ads for 15 days", bn: "১৫ দিনের জন্য আনলিমিটেড বিজ্ঞাপন পোস্ট"},
      {en: "Custom Shop Page with logo & banner", bn: "কাস্টম শপ পেইজ (লোগো ও ব্যানার)"},
      {en: "Gold Member badge on profile", bn: "প্রোফাইলে গোল্ড মেম্বার ব্যাজ"}
    ],
    color: 'gold', icon: 'award', is_featured: false, sort_order: 8
  },
  {
    type: 'membership', name_en: 'Gold Member', name_bn: 'গোল্ড মেম্বার',
    price: 2499, duration: 1, duration_unit: 'month',
    tagline_en: 'Best for professional & busy sellers', tagline_bn: 'পেশাদার ও নিয়মিত বিক্রেতাদের জন্য সেরা',
    features: [
      {en: "Get 50x more customer reach & sales", bn: "৫০ গুণ (50x) বেশি কাস্টমার সেলস ও রিচ"},
      {en: "Unlimited active ads", bn: "আনলিমিটেড বিজ্ঞাপন পোস্ট"},
      {en: "Custom Shop Page with logo & banner", bn: "কাস্টম শপ পেইজ (লোগো ও ব্যানার)"},
      {en: "5 Free Top Ad promotions / month", bn: "৫টি ফ্রি টপ অ্যাড প্রমোশন / মাস"},
      {en: "Dedicated Customer Relation Manager", bn: "ডেডিকেটেড কাস্টমার রিলেশন ম্যানেজার"}
    ],
    badge_en: 'Popular', badge_bn: 'সবচেয়ে জনপ্রিয়',
    color: 'gold', icon: 'award', is_featured: true, sort_order: 9
  },
  {
    type: 'boost', name_en: '7-Day Premium Boost', name_bn: '৭ দিনের প্রিমিয়াম বুস্ট',
    price: 399, duration: 7, duration_unit: 'days',
    tagline_en: 'Ensure selling within 1 week', tagline_bn: '১ সপ্তাহের মধ্যে পণ্য বিক্রি নিশ্চিত করতে',
    features: [
      {en: "Get 20x more buyer calls & responses", bn: "২০ গুণ (20x) বেশি ক্রেতা ও রিয়েল কল"},
      {en: "Top position for 3 full days", bn: "৩ দিন বিজ্ঞাপন টপ পজিশনে থাকবে"},
      {en: "Highlighted background in Search", bn: "সার্চ রেজাল্ট পেজে হাইলাইটেড ব্যাকগ্রাউন্ড"}
    ],
    color: 'gold', icon: 'zap', is_featured: false, sort_order: 10
  },

  // 💼 BUSINESS TIER
  {
    type: 'membership', name_en: '7-Day Business Member', name_bn: '৭ দিনের বিজনেস মেম্বার',
    price: 1499, duration: 7, duration_unit: 'days',
    tagline_en: '1-week trial of high-tier business membership', tagline_bn: '১ সপ্তাহের জন্য প্রিমিয়াম বিজনেস মেম্বারশিপ',
    features: [
      {en: "Get 80x more customer reach & sales", bn: "৮০ গুণ (80x) বেশি কাস্টমার সেলস ও রিচ"},
      {en: "Unlimited ads & API Listing Access", bn: "আনলিমিটেড বিজ্ঞাপন ও এপিআই অ্যাক্সেস"},
      {en: "Multi-user shop access controls", bn: "মাল্টি-ইউজার শপ অ্যাক্সেস"},
      {en: "Business Member badge on profile", bn: "প্রোফাইলে বিজনেস মেম্বার ব্যাজ"}
    ],
    color: 'business', icon: 'briefcase', is_featured: false, sort_order: 11
  },
  {
    type: 'membership', name_en: '15-Day Business Member', name_bn: '১৫ দিনের বিজনেস মেম্বার',
    price: 2999, duration: 15, duration_unit: 'days',
    tagline_en: 'Half-month premium business membership', tagline_bn: '১৫ দিনের জন্য প্রিমিয়াম বিজনেস মেম্বারশিপ',
    features: [
      {en: "Get 90x more customer reach & sales", bn: "৯০ গুণ (90x) বেশি কাস্টমার সেলস ও রিচ"},
      {en: "Unlimited ads & API Listing Access", bn: "আনলিমিটেড বিজ্ঞাপন ও এপিআই অ্যাক্সেস"},
      {en: "Multi-user shop access controls", bn: "মাল্টি-ইউজার শপ অ্যাক্সেস"},
      {en: "Business Member badge on profile", bn: "প্রোফাইলে বিজনেস মেম্বার ব্যাজ"}
    ],
    color: 'business', icon: 'briefcase', is_featured: false, sort_order: 12
  },
  {
    type: 'membership', name_en: 'Business Member', name_bn: 'বিজনেস মেম্বার',
    price: 4999, duration: 1, duration_unit: 'month',
    tagline_en: 'Built for showrooms, dealers & companies', tagline_bn: 'শোরুম, ডিলার ও বড় কোম্পানির জন্য',
    features: [
      {en: "Get 100x more customer reach & sales", bn: "১০০ গুণ (100x) বেশি কাস্টমার সেলস ও রিচ"},
      {en: "Unlimited ads & API Listing Access", bn: "আনলিমিটেড বিজ্ঞাপন ও এপিআই অ্যাক্সেস"},
      {en: "Multi-user shop access controls", bn: "মাল্টি-ইউজার শপ অ্যাক্সেস"},
      {en: "15 Free Promo & Bump Credits / month", bn: "১৫টি ফ্রি প্রমোশন ও বাম্প ক্রেডিট"},
      {en: "Advanced Sales Analytics Report", bn: "Advanced Sales Analytics Report"}
    ],
    color: 'business', icon: 'briefcase', is_featured: false, sort_order: 13
  },
  {
    type: 'boost', name_en: '15-Day Mega Boost', name_bn: '১৫ দিনের মেগা বুস্ট',
    price: 699, duration: 15, duration_unit: 'days',
    tagline_en: 'Best for heavy items like cars, bikes', tagline_bn: 'গাড়ি, বাইক বা ভারী পণ্য বিক্রির জন্য সেরা',
    features: [
      {en: "Get 40x more buyer traffic & impressions", bn: "৪০ গুণ (40x) বেশি কাস্টমার ট্রাফিক ও ভিউ"},
      {en: "Top position for 7 full days", bn: "৭ দিন বিজ্ঞাপন সবার ওপরে থাকবে"},
      {en: "Mega Boost border & badge for 15 days", bn: "১৫ দিন মেগা বুস্ট ব্যাজ ও বর্ডার"}
    ],
    color: 'business', icon: 'zap', is_featured: false, sort_order: 14
  }
];
const toBengaliNumber = (num, lang) => {
  if (lang !== 'bn') return num;
  if (num == null) return '';
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/[0-9]/g, (digit) => bengaliDigits[englishDigits.indexOf(digit)]);
};

export default function MembershipManager() {
  const { lang } = useLanguage();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_PACKAGE });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);

  // Dynamic Payment Settings & Purchases State
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [bkashNum, setBkashNum] = useState('');
  const [nagadNum, setNagadNum] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchPackages();
    fetchSettings();
    fetchPurchases();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('admin_settings').select('*');
      if (data) {
        const bkash = data.find(s => s.key === 'bkash_number');
        const nagad = data.find(s => s.key === 'nagad_number');
        if (bkash) setBkashNum(bkash.value);
        if (nagad) setNagadNum(nagad.value);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  const fetchPurchases = async () => {
    setPurchasesLoading(true);
    try {
      const { data } = await supabase
        .from('membership_purchases')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setPurchases(data);
    } catch (err) {
      console.error('Error loading purchases:', err);
    }
    setPurchasesLoading(false);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const { error: e1 } = await supabase
        .from('admin_settings')
        .upsert({ key: 'bkash_number', value: bkashNum });
        
      const { error: e2 } = await supabase
        .from('admin_settings')
        .upsert({ key: 'nagad_number', value: nagadNum });

      if (!e1 && !e2) {
        showToast('⚙️ Gateway phone numbers updated successfully!');
      } else {
        showToast('Error saving payment configurations', 'error');
      }
    } catch (err) {
      showToast('Exception: ' + err.message, 'error');
    }
    setSavingSettings(false);
  };

  const handlePurchaseStatus = async (id, status) => {
    try {
      if (status === 'approved') {
        const { data: purchase, error: fetchErr } = await supabase
          .from('membership_purchases')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchErr || !purchase) {
          throw new Error('Could not retrieve purchase request');
        }

        const { data: pkg, error: pkgErr } = await supabase
          .from('membership_packages')
          .select('*')
          .eq('id', purchase.package_id)
          .single();

        if (pkgErr || !pkg) {
          throw new Error('Could not retrieve package details');
        }

        if (pkg.type === 'membership') {
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', purchase.user_email)
            .single();

          if (profileErr || !profile) {
            throw new Error(`Profile with email ${purchase.user_email} not found`);
          }

          const expiresAt = new Date();
          if (pkg.duration_unit === 'month') {
            expiresAt.setMonth(expiresAt.getMonth() + (pkg.duration || 1));
          } else if (pkg.duration_unit === 'days') {
            expiresAt.setDate(expiresAt.getDate() + (pkg.duration || 30));
          } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          }

          const { error: profileUpdateErr } = await supabase
            .from('profiles')
            .update({
              membership_type: pkg.name_en,
              membership_expires_at: expiresAt.toISOString()
            })
            .eq('id', profile.id);

          if (profileUpdateErr) {
            throw profileUpdateErr;
          }

          // Automatically add Business Member's active listings to featured_ads
          if (pkg.color?.toLowerCase() === 'business' || pkg.name_en?.toLowerCase().includes('business')) {
            const { data: userListings } = await supabase
              .from('listings')
              .select('id')
              .eq('user_id', profile.id)
              .eq('status', 'active');

            if (userListings && userListings.length > 0) {
              const featuredInserts = userListings.map((lst, idx) => ({
                listing_id: lst.id,
                is_active: true,
                sort_order: idx
              }));

              const { error: featErr } = await supabase
                .from('featured_ads')
                .upsert(featuredInserts, { onConflict: 'listing_id' });

              if (featErr) {
                console.error('Error inserting business featured ads in MembershipManager:', featErr);
              }
            }
          }
        } else if (pkg.type === 'boost') {
          if (purchase.listing_id) {
            const { error: boostErr } = await supabase
              .from('listings')
              .update({
                is_verified: true,
                promotion_type: pkg.name_en,
                created_at: new Date().toISOString()
              })
              .eq('id', purchase.listing_id);

            if (boostErr) {
              throw boostErr;
            }
          }

          // ALSO update user's profile with the boost tag and expiry!
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', purchase.user_email.trim())
            .single();

          if (!profileErr && profile) {
            const expiresAt = new Date();
            if (pkg.duration_unit === 'month') {
              expiresAt.setMonth(expiresAt.getMonth() + (pkg.duration || 1));
            } else if (pkg.duration_unit === 'days') {
              expiresAt.setDate(expiresAt.getDate() + (pkg.duration || 3));
            } else {
              expiresAt.setDate(expiresAt.getDate() + 3); // Default to 3 days
            }

            const { error: profileUpdateErr } = await supabase
              .from('profiles')
              .update({
                membership_type: pkg.name_en,
                membership_expires_at: expiresAt.toISOString()
              })
              .eq('id', profile.id);

            if (profileUpdateErr) {
              console.error('Error updating profile for boost in MembershipManager:', profileUpdateErr);
            }
          }
        }
      } else if (status === 'rejected') {
        const { data: purchase } = await supabase
          .from('membership_purchases')
          .select('*')
          .eq('id', id)
          .single();

        if (purchase) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', purchase.user_email)
            .single();

          if (profile) {
            await supabase
              .from('profiles')
              .update({
                membership_type: 'free',
                membership_expires_at: null
              })
              .eq('id', profile.id);
          }
        }
      }

      const { error } = await supabase
        .from('membership_purchases')
        .update({ status })
        .eq('id', id);

      if (!error) {
        showToast(`Request marked as ${status.toUpperCase()}!`);
        fetchPurchases();
      } else {
        showToast('Error updating request status', 'error');
      }
    } catch (err) {
      showToast('Exception: ' + err.message, 'error');
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPackages = async () => {
    if (packages.length === 0) {
      setLoading(true);
    }
    setPackagesLoading(true);
    setDbError(false);
    try {
      const { data, error } = await supabase
        .from('membership_packages')
        .select('*')
        .order('sort_order', { ascending: true });
        
      if (error) {
        console.error('Supabase fetch error:', error);
        setDbError(true);
      } else {
        // Enforce strict Silver -> Gold -> Business color order, followed by price
        const colorPriority = { silver: 1, gold: 2, business: 3 };
        const sorted = (data || []).sort((a, b) => {
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
    } catch (err) {
      console.error('Catch error fetching:', err);
      setDbError(true);
    }
    setPackagesLoading(false);
    setLoading(false);
  };

  // Auto seed default packages directly via frontend
  const handleAutoSeed = async () => {
    setSeeding(true);
    try {
      // 1. Clear all existing packages first to completely prevent duplication
      const { error: deleteError } = await supabase
        .from('membership_packages')
        .delete()
        .not('id', 'is', null);

      if (deleteError) {
        showToast('Reset error (delete failed): ' + deleteError.message, 'error');
        setSeeding(false);
        return;
      }

      // 2. Insert the fresh, correctly sorted DEFAULT_SEEDS
      const { error } = await supabase
        .from('membership_packages')
        .insert(DEFAULT_SEEDS);

      if (!error) {
        showToast('⚡ Default offers successfully seeded!');
        fetchPackages();
      } else {
        showToast('Seeding error: ' + error.message, 'error');
        // If it means table doesn't exist, we keep dbError showing
        if (error.message.includes('does not exist')) {
          setDbError(true);
        }
      }
    } catch (err) {
      showToast('Exception seeding: ' + err.message, 'error');
    }
    setSeeding(false);
  };

  // Reordering packages logic - highly robust sequential normalization
  const handleMove = async (pkg, direction) => {
    setSaving(true);
    try {
      // 1. Fetch fresh list from database to avoid any stale data issues
      const { data: freshList, error: fetchErr } = await supabase
        .from('membership_packages')
        .select('*')
        .eq('type', pkg.type)
        .order('sort_order', { ascending: true });

      if (fetchErr || !freshList || freshList.length === 0) {
        showToast('Failed to retrieve fresh list', 'error');
        setSaving(false);
        return;
      }

      // 2. Normalize sort_order of all packages sequentially (1, 2, 3...)
      // This completely solves the identical sort_order bug!
      const normalizedList = [];
      for (let i = 0; i < freshList.length; i++) {
        const item = freshList[i];
        const cleanOrder = i + 1;
        if (item.sort_order !== cleanOrder) {
          await supabase
            .from('membership_packages')
            .update({ sort_order: cleanOrder })
            .eq('id', item.id);
          item.sort_order = cleanOrder;
        }
        normalizedList.push(item);
      }

      // 3. Find the current item index in our normalized sequential list
      const index = normalizedList.findIndex(p => p.id === pkg.id);
      if (index === -1) {
        setSaving(false);
        return;
      }

      // 4. Calculate swap index
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= normalizedList.length) {
        setSaving(false);
        return; // Out of bounds
      }

      const targetPkg = normalizedList[swapIndex];

      // 5. Swap sort_order between pkg and targetPkg in Supabase
      const currentOrder = normalizedList[index].sort_order;
      const targetOrder = targetPkg.sort_order;

      // Use a distinct temp order first to prevent unique constraint conflicts (if any)
      await supabase
        .from('membership_packages')
        .update({ sort_order: 9999 })
        .eq('id', pkg.id);

      await supabase
        .from('membership_packages')
        .update({ sort_order: currentOrder })
        .eq('id', targetPkg.id);

      await supabase
        .from('membership_packages')
        .update({ sort_order: targetOrder })
        .eq('id', pkg.id);

      showToast('↕️ Serial updated successfully!');
      fetchPackages();
    } catch (err) {
      showToast('Exception reordering: ' + err.message, 'error');
    }
    setSaving(false);
  };

  // Feature helpers
  const updateFeature = (form, setForm, index, field, value) => {
    const updated = form.features.map((f, i) =>
      i === index ? { ...f, [field]: value } : f
    );
    setForm({ ...form, features: updated });
  };

  const addFeature = (form, setForm) => {
    setForm({ ...form, features: [...form.features, { en: '', bn: '' }] });
  };

  const removeFeature = (form, setForm, index) => {
    setForm({ ...form, features: form.features.filter((_, i) => i !== index) });
  };

  // Save new
  const handleCreate = async () => {
    if (!newForm.name_en || !newForm.price) {
      showToast('Name and Price are required!', 'error'); return;
    }
    setSaving(true);
    // Automatically place at the end of its type list
    const typeList = newForm.type === 'boost' ? boosts : memberships;
    const nextOrder = typeList.length > 0 ? Math.max(...typeList.map(p => p.sort_order)) + 1 : 1;

    const { error } = await supabase.from('membership_packages').insert([{
      ...newForm,
      price: parseInt(newForm.price),
      offer_price: newForm.offer_price ? parseInt(newForm.offer_price) : null,
      duration: newForm.duration ? parseInt(newForm.duration) : null,
      duration_unit: newForm.type === 'boost' ? newForm.duration_unit : 'month',
      features: newForm.features.filter(f => f.en || f.bn),
      sort_order: nextOrder
    }]);
    setSaving(false);
    if (!error) {
      showToast('✅ New package added!');
      setShowAddForm(false);
      setNewForm({ ...EMPTY_PACKAGE });
      fetchPackages();
    } else {
      showToast('Error: ' + error.message, 'error');
    }
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editForm.name_en || !editForm.price) {
      showToast('Name and Price are required!', 'error'); return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('membership_packages')
      .update({
        ...editForm,
        price: parseInt(editForm.price),
        offer_price: editForm.offer_price ? parseInt(editForm.offer_price) : null,
        duration: editForm.duration ? parseInt(editForm.duration) : null,
        features: editForm.features.filter(f => f.en || f.bn),
      })
      .eq('id', editingId);
    setSaving(false);
    if (!error) {
      showToast('✅ Changes saved successfully!');
      setEditingId(null);
      setEditForm(null);
      fetchPackages();
    } else {
      showToast('Error saving: ' + error.message, 'error');
    }
  };

  // Delete
  const handleDelete = async (id) => {
    if (!id) return;
    const { error } = await supabase
      .from('membership_packages')
      .delete()
      .eq('id', id);
    if (!error) {
      showToast('🗑️ Package permanently deleted!');
      setPackages(prev => prev.filter(p => p.id !== id));
    } else {
      showToast('Error deleting: ' + error.message, 'error');
    }
  };

  const confirmAction = (titleBn, titleEn, messageBn, messageEn, onConfirm, isDestructive = false) => {
    setConfirmDialog({
      title: lang === 'bn' ? titleBn : titleEn,
      message: lang === 'bn' ? messageBn : messageEn,
      onConfirm,
      isDestructive
    });
  };

  // Toggle active
  const toggleActive = async (pkg) => {
    const { error } = await supabase
      .from('membership_packages')
      .update({ is_active: !pkg.is_active })
      .eq('id', pkg.id);
    if (!error) {
      setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, is_active: !p.is_active } : p));
      showToast(pkg.is_active ? 'Package hidden from site' : 'Package is now live');
    }
  };

  const sqlSchema = `CREATE TABLE IF NOT EXISTS membership_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('boost', 'membership')),
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  price INTEGER NOT NULL,
  offer_price INTEGER,
  duration INTEGER,
  duration_unit TEXT CHECK (duration_unit IN ('days', 'month')),
  tagline_en TEXT,
  tagline_bn TEXT,
  features JSONB DEFAULT '[]',
  badge_en TEXT,
  badge_bn TEXT,
  color TEXT DEFAULT 'silver' CHECK (color IN ('silver', 'gold', 'business')),
  icon TEXT DEFAULT 'zap',
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Enablement
ALTER TABLE membership_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages"
  ON membership_packages FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admin can do everything on packages"
  ON membership_packages FOR ALL
  USING (auth.email() = 'anikh0000@gmail.com')
  WITH CHECK (auth.email() = 'anikh0000@gmail.com');

-- Profiles table extensions for active memberships
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_type TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const boosts = packages.filter(p => p.type === 'boost');
  const memberships = packages.filter(p => p.type === 'membership');
  const silverPacks = packages.filter(p => p.color?.toLowerCase() === 'silver');
  const goldPacks = packages.filter(p => p.color?.toLowerCase() === 'gold');
  const businessPacks = packages.filter(p => p.color?.toLowerCase() === 'business');

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5rem 0', gap: '1rem' }}>
      <div style={{
        width: '40px', height: '40px', border: '3px solid #f3f4f6', borderTopColor: '#008b5e',
        borderRadius: '50%', animation: 'spin 1s linear infinite'
      }} />
      <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>Loading Membership Offers...</span>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // 1. DATABASE SCHEMA ERROR SCREEN (If Table doesn't exist)
  if (dbError) {
    return (
      <div style={{
        background: 'white', borderRadius: '24px', padding: '2.5rem',
        boxShadow: '0 10px 30px rgba(0,0,0,0.04)', border: '1px solid #fee2e2',
        maxWidth: '700px', margin: '1rem auto 3rem auto', textAlign: 'center'
      }}>
        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1.25rem' }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem' }}>
          Database Setup & Sync Required
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          আপনার Supabase ডেটাবেজে <code>membership_packages</code> টেবিলটি এখনও তৈরি করা হয়নি। 
          নিচের সহজ কাজটি করে এটি ১ মিনিটে ঠিক করে ফেলুন:
        </p>

        <div style={{ textAlign: 'left', background: '#f8fafc', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={14} /> SQL Query Code
            </span>
            <button
              onClick={handleCopySql}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem', background: copied ? '#dcfce7' : 'white',
                color: copied ? '#15803d' : '#475569', border: '1px solid #cbd5e1', borderRadius: '8px',
                padding: '0.4rem 0.8rem', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied!' : 'Copy SQL'}
            </button>
          </div>
          <pre style={{
            fontSize: '0.8rem', color: '#334155', margin: 0, overflowX: 'auto',
            padding: '1rem', background: '#0f172a', color: '#cbd5e1', borderRadius: '10px',
            fontFamily: 'monospace', maxHeight: '180px', lineHeight: 1.5
          }}>
            {sqlSchema}
          </pre>
        </div>

        <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '1rem', border: '1px solid #bfdbfe', textAlign: 'left', marginBottom: '2rem' }}>
          <p style={{ color: '#1e40af', fontSize: '0.85rem', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
            <strong>💡 কিভাবে রান করবেন:</strong> <br />
            ১. উপরের <strong>Copy SQL</strong> বাটনে চাপ দিন।<br />
            ২. আপনার <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ fontWeight: 700, textDecoration: 'underline', color: '#1e40af' }}>Supabase Dashboard</a> এ যান।<br />
            ৩. বাম পাশের মেনু থেকে <strong>SQL Editor</strong> সিলেক্ট করুন → <strong>New Query</strong> চাপুন।<br />
            ৪. কোডটি পেস্ট করে নিচে ডানে থাকা <strong>Run</strong> বাটনে ক্লিক করুন। তারপর এই পেজটি রিফ্রেশ করুন!
          </p>
        </div>

        <button
          onClick={fetchPackages}
          style={{
            background: 'linear-gradient(135deg, #008b5e, #05b078)', color: 'white', border: 'none',
            borderRadius: '12px', padding: '0.8rem 2rem', fontWeight: 700, fontSize: '0.95rem',
            cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 139, 94, 0.3)'
          }}
        >
          🔄 আমি রান করেছি, রিফ্রেশ দিন
        </button>
      </div>
    );
  }

  // 2. EMPTY STATE WITH ONE-CLICK AUTO SEED
  if (packages.length === 0) {
    return (
      <div style={{
        background: 'white', borderRadius: '24px', padding: '3rem',
        boxShadow: '0 10px 30px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0',
        maxWidth: '650px', margin: '2rem auto', textAlign: 'center'
      }}>
        <Database size={52} color="#008b5e" style={{ marginBottom: '1.25rem', opacity: 0.85 }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem' }}>
          No Active Offers in Database
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2.25rem' }}>
          আপনার ডেটাবেজ টেবিলটি খালি রয়েছে। আপনি যদি আপনার আগের ৩টি বুস্ট প্যাকেজ এবং ৩টি বিজনেস মেম্বারশিপ অফার 
          ১-ক্লিকে এখানে লোড করতে চান, তবে নিচের বাটনে চাপ দিন। এরপর আপনি যেকোনোটি এডিট ও সিরিয়াল করতে পারবেন!
        </p>
        <button
          onClick={handleAutoSeed}
          disabled={seeding}
          style={{
            background: 'linear-gradient(135deg, #008b5e, #05b078)', color: 'white', border: 'none',
            borderRadius: '12px', padding: '0.9rem 2.25rem', fontWeight: 700, fontSize: '0.95rem',
            cursor: seeding ? 'not-allowed' : 'pointer', boxShadow: '0 4px 15px rgba(0, 139, 94, 0.3)',
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
          }}
        >
          {seeding ? 'Seeding offers...' : '⚡ ১-ক্লিকে ডিফল্ট অফারগুলো লোড করুন'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <style>{`
        .spin-packages {
          animation: spin-packages 1s linear infinite;
          display: inline-block;
        }
        @keyframes spin-packages {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: toast.type === 'error' ? '#e11d48' : '#10b981',
          color: 'white', padding: '0.9rem 1.4rem', borderRadius: '14px',
          fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.2s ease', border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Generic Confirmation Modal */}
      {confirmDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: 'white', borderRadius: '20px', padding: '2rem',
            maxWidth: '360px', width: '90%', textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#1e293b', fontSize: '1.2rem', fontWeight: 800 }}>{confirmDialog.title}</h3>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmDialog(null)} style={{...cancelBtnStyle, padding: '0.75rem'}}>
                {lang === 'bn' ? 'না (No)' : 'No'}
              </button>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }} 
                style={{
                  ...(confirmDialog.isDestructive ? deleteBtnStyle : saveBtnStyle),
                  padding: '0.75rem', flex: 1
                }}
              >
                {lang === 'bn' ? 'হ্যাঁ (Yes)' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Section Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        background: 'white',
        padding: '1.25rem 1.5rem',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        border: '1px solid #e2e8f0'
      }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            💼 {lang === 'bn' ? 'মেম্বারশিপ ও বুস্ট পরিচালনা' : 'Manage Memberships & Boosts'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0 0', fontWeight: 500 }}>
            {lang === 'bn' ? 'মোট অফার' : 'Total Offers'}: {toBengaliNumber(packages.length, lang)} {lang === 'bn' ? 'টি' : ''} · {lang === 'bn' ? 'বুস্ট' : 'Boosts'}: {toBengaliNumber(boosts.length, lang)} {lang === 'bn' ? 'টি' : ''} · {lang === 'bn' ? 'বিজনেস মেম্বারশিপ' : 'Business Memberships'}: {toBengaliNumber(memberships.length, lang)} {lang === 'bn' ? 'টি' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={fetchPackages}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: 'white', border: '1px solid #cbd5e1', borderRadius: '12px',
              padding: '0.65rem 1.1rem', fontWeight: 700, cursor: 'pointer', color: '#475569',
              fontSize: '0.85rem', transition: 'all 0.2s', outline: 'none'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#94a3b8';
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.color = '#475569';
            }}
          >
            <RefreshCw size={14} className={packagesLoading ? 'spin-packages' : ''} /> {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
          </button>
          <button
            onClick={() => confirmAction(
              'সব অফার ডিফল্ট রিসেট করবেন?', 'Reset all offers to default?',
              'এটি করলে আপনার বর্তমান সব অফার মুছে যাবে এবং ৬টি ডিফল্ট অফার (সিলভার, গোল্ড, বিজনেস ক্রমানুসারে) লোড হবে।', 'This will delete all current offers and load the 6 default sorted offers.',
              handleAutoSeed,
              true
            )}
            disabled={seeding}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
              borderRadius: '12px', padding: '0.65rem 1.1rem', fontWeight: 700,
              cursor: seeding ? 'not-allowed' : 'pointer', fontSize: '0.85rem', transition: 'all 0.2s'
            }}
            title={lang === 'bn' ? "সব অফার ডিফল্ট রিসেট করুন" : "Reset all offers to default"}
          >
            🔄 {lang === 'bn' ? 'রিসেট ডিফল্ট' : 'Reset Defaults'}
          </button>
          
          <button
            onClick={() => { setShowAddForm(true); window.scrollTo({ top: 120, behavior: 'smooth' }); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: 'linear-gradient(135deg, #008b5e, #05b078)',
              color: 'white', border: 'none', borderRadius: '12px',
              padding: '0.65rem 1.25rem', fontWeight: 700, cursor: 'pointer',
              fontSize: '0.88rem', boxShadow: '0 4px 15px rgba(0, 139, 94, 0.25)',
              transition: 'transform 0.15s'
            }}
          >
            <Plus size={16} /> {lang === 'bn' ? 'নতুন অফার' : 'Add Custom Offer'}
          </button>
        </div>
      </div>

      {/* Add New Offer Form */}
      {showAddForm && (
        <PackageForm
          form={newForm}
          setForm={setNewForm}
          onSave={() => confirmAction(
            'অফারটি যুক্ত করবেন?', 'Add Offer?',
            'আপনি কি নিশ্চিত যে নতুন অফারটি যুক্ত করতে চান?', 'Are you sure you want to add this new offer?',
            handleCreate
          )}
          onCancel={() => { setShowAddForm(false); setNewForm({ ...EMPTY_PACKAGE }); }}
          saving={saving}
          title="➕ নতুন অফার বা বুস্ট যুক্ত করুন"
          updateFeature={updateFeature}
          addFeature={addFeature}
          removeFeature={removeFeature}
        />
      )}

      {/* 1. Silver Packages List */}
      <SectionTitle label="🥈 Silver Tier Packages (সিলভার মেম্বারশিপ ও বুস্ট অফার)" count={silverPacks.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {silverPacks.map((pkg, idx) => (
          <PackageRow
            key={pkg.id}
            pkg={pkg}
            idx={idx}
            totalCount={silverPacks.length}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            setEditingId={setEditingId}
            onSaveEdit={handleSaveEdit}
            onDelete={() => confirmAction(
              'প্যাকেজটি মুছে ফেলবেন?', 'Delete Package?',
              'এটি ডিলেট করলে আপনার ওয়েবসাইট থেকে অফারটি স্থায়ীভাবে চলে যাবে।', 'This will permanently remove the offer from your website.',
              () => handleDelete(pkg.id),
              true
            )}
            onToggleActive={() => confirmAction(
              pkg.is_active ? 'অফারটি লুকাবেন?' : 'অফারটি লাইভ করবেন?',
              pkg.is_active ? 'Hide Offer?' : 'Publish Offer?',
              pkg.is_active ? 'এই অফারটি ওয়েবসাইট থেকে লুকানো হবে।' : 'এই অফারটি ওয়েবসাইটে লাইভ হবে।',
              pkg.is_active ? 'This offer will be hidden from the website.' : 'This offer will be live on the website.',
              () => toggleActive(pkg)
            )}
            onMove={handleMove}
            saving={saving}
            updateFeature={updateFeature}
            addFeature={addFeature}
            removeFeature={removeFeature}
          />
        ))}
      </div>

      {/* 2. Gold Packages List */}
      <div style={{ marginTop: '2.5rem' }}>
        <SectionTitle label="🥇 Gold Tier Packages (গোল্ড মেম্বারশিপ ও বুস্ট অফার)" count={goldPacks.length} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {goldPacks.map((pkg, idx) => (
          <PackageRow
            key={pkg.id}
            pkg={pkg}
            idx={idx}
            totalCount={goldPacks.length}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            setEditingId={setEditingId}
            onSaveEdit={handleSaveEdit}
            onDelete={() => confirmAction(
              'প্যাকেজটি মুছে ফেলবেন?', 'Delete Package?',
              'এটি ডিলেট করলে আপনার ওয়েবসাইট থেকে অফারটি স্থায়ীভাবে চলে যাবে।', 'This will permanently remove the offer from your website.',
              () => handleDelete(pkg.id),
              true
            )}
            onToggleActive={() => confirmAction(
              pkg.is_active ? 'অফারটি লুকাবেন?' : 'অফারটি লাইভ করবেন?',
              pkg.is_active ? 'Hide Offer?' : 'Publish Offer?',
              pkg.is_active ? 'এই অফারটি ওয়েবসাইট থেকে লুকানো হবে।' : 'এই অফারটি ওয়েবসাইটে লাইভ হবে।',
              pkg.is_active ? 'This offer will be hidden from the website.' : 'This offer will be live on the website.',
              () => toggleActive(pkg)
            )}
            onMove={handleMove}
            saving={saving}
            updateFeature={updateFeature}
            addFeature={addFeature}
            removeFeature={removeFeature}
          />
        ))}
      </div>

      {/* 3. Business Packages List */}
      <div style={{ marginTop: '2.5rem' }}>
        <SectionTitle label="💼 Business Tier Packages (বিজনেস মেম্বারশিপ ও বুস্ট অফার)" count={businessPacks.length} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {businessPacks.map((pkg, idx) => (
          <PackageRow
            key={pkg.id}
            pkg={pkg}
            idx={idx}
            totalCount={businessPacks.length}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            setEditingId={setEditingId}
            onSaveEdit={handleSaveEdit}
            onDelete={() => confirmAction(
              'প্যাকেজটি মুছে ফেলবেন?', 'Delete Package?',
              'এটি ডিলেট করলে আপনার ওয়েবসাইট থেকে অফারটি স্থায়ীভাবে চলে যাবে।', 'This will permanently remove the offer from your website.',
              () => handleDelete(pkg.id),
              true
            )}
            onToggleActive={() => confirmAction(
              pkg.is_active ? 'অফারটি লুকাবেন?' : 'অফারটি লাইভ করবেন?',
              pkg.is_active ? 'Hide Offer?' : 'Publish Offer?',
              pkg.is_active ? 'এই অফারটি ওয়েবসাইট থেকে লুকানো হবে।' : 'এই অফারটি ওয়েবসাইটে লাইভ হবে।',
              pkg.is_active ? 'This offer will be hidden from the website.' : 'This offer will be live on the website.',
              () => toggleActive(pkg)
            )}
            onMove={handleMove}
            saving={saving}
            updateFeature={updateFeature}
            addFeature={addFeature}
            removeFeature={removeFeature}
          />
        ))}
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function SectionTitle({ label, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      margin: '1.5rem 0 1rem 0'
    }}>
      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e293b', letterSpacing: '0.3px' }}>{label}</span>
      <span style={{
        background: '#e0f2fe', color: '#0369a1', fontSize: '0.78rem',
        padding: '0.2rem 0.6rem', borderRadius: '99px', fontWeight: 800
      }}>{count}</span>
      <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
    </div>
  );
}

function PackageRow({ pkg, idx, totalCount, editingId, editForm, setEditForm, setEditingId, onSaveEdit, onDelete, onToggleActive, onMove, saving, updateFeature, addFeature, removeFeature }) {
  const { lang } = useLanguage();
  const isEditing = editingId === pkg.id;
  
  const borderColors = {
    silver: '#cbd5e1',
    gold: '#fde047',
    business: '#93c5fd'
  };
  const glowColors = {
    silver: 'rgba(148, 163, 184, 0.05)',
    gold: 'rgba(253, 224, 71, 0.06)',
    business: 'rgba(59, 130, 246, 0.05)'
  };
  const badgeTextColors = {
    silver: '#475569',
    gold: '#854d0e',
    business: '#1d4ed8'
  };
  const badgeBgColors = {
    silver: '#f1f5f9',
    gold: '#fef08a',
    business: '#dbeafe'
  };

  return (
    <div style={{
      border: isEditing ? '2px solid #008b5e' : `1.5px solid ${borderColors[pkg.color] || '#e2e8f0'}`,
      borderRadius: '16px',
      background: pkg.is_active ? 'white' : '#f8fafc',
      overflow: 'hidden',
      boxShadow: isEditing ? '0 10px 25px rgba(0, 139, 94, 0.08)' : '0 4px 12px rgba(0, 0, 0, 0.015)',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative'
    }}>
      {/* Glow Effect matching Color Tier */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: glowColors[pkg.color] || 'transparent'
      }} />

      {/* Row Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
        
        {/* Reordering Controls (UP / DOWN Arrows) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center', marginRight: '0.25rem' }}>
          <button
            disabled={idx === 0 || saving}
            onClick={() => onMove(pkg, 'up')}
            style={{
              padding: '0.15rem', border: 'none', background: 'transparent',
              color: idx === 0 ? '#cbd5e1' : '#64748b', cursor: idx === 0 ? 'not-allowed' : 'pointer',
              transition: 'color 0.2s', display: 'flex', alignItems: 'center'
            }}
            title="ওপরে তুলুন"
          >
            <ChevronUp size={20} style={{ strokeWidth: 3 }} />
          </button>
          <button
            disabled={idx === totalCount - 1 || saving}
            onClick={() => onMove(pkg, 'down')}
            style={{
              padding: '0.15rem', border: 'none', background: 'transparent',
              color: idx === totalCount - 1 ? '#cbd5e1' : '#64748b', cursor: idx === totalCount - 1 ? 'not-allowed' : 'pointer',
              transition: 'color 0.2s', display: 'flex', alignItems: 'center'
            }}
            title="নিচে নামান"
          >
            <ChevronDown size={20} style={{ strokeWidth: 3 }} />
          </button>
        </div>

        {/* Status Indicator */}
        <div style={{
          width: '10px', height: '10px', borderRadius: '50%',
          background: pkg.is_active ? '#10b981' : '#94a3b8', flexShrink: 0,
          boxShadow: pkg.is_active ? '0 0 8px #10b981' : 'none'
        }} />

        {/* Offer Details */}
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>{pkg.name_en}</span>
            <span style={{ fontWeight: 700, color: '#64748b', fontSize: '0.85rem' }}>{pkg.name_bn}</span>
            
            {/* Color style badge */}
            <span style={{
              background: badgeBgColors[pkg.color] || '#f1f5f9',
              color: badgeTextColors[pkg.color] || '#475569',
              fontSize: '0.68rem', fontWeight: 800,
              padding: '0.15rem 0.5rem', borderRadius: '6px',
              textTransform: 'uppercase', letterSpacing: '0.5px'
            }}>
              {pkg.color}
            </span>

            {pkg.is_featured && (
              <span style={{ background: '#fef08a', color: '#854d0e', fontSize: '0.68rem', fontWeight: 900, padding: '0.15rem 0.5rem', borderRadius: '6px', border: '1px solid #fde047', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                ★ Featured
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              {pkg.offer_price ? (
                <>
                  <span style={{ color: '#008b5e', fontWeight: 850, fontSize: '0.98rem' }}>
                    {formatPrice(pkg.offer_price, lang)}
                  </span>
                  <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem', textDecoration: 'line-through' }}>
                    {formatPrice(pkg.price, lang)}
                  </span>
                  <span style={{ background: '#fef08a', color: '#b45309', fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                    {toBengaliNumber(Math.round(((pkg.price - pkg.offer_price) / pkg.price) * 100), lang)}% {lang === 'bn' ? 'ছাড়' : 'OFF'}
                  </span>
                </>
              ) : (
                <span style={{ color: '#008b5e', fontWeight: 850, fontSize: '0.98rem' }}>
                  {formatPrice(pkg.price, lang)}
                </span>
              )}
              {pkg.duration && (
                <span style={{ fontWeight: 600, color: '#64748b', fontSize: '0.82rem', marginLeft: '0.2rem' }}>
                  / {toBengaliNumber(pkg.duration, lang)} {pkg.duration_unit === 'month' ? (lang === 'bn' ? 'মাস' : 'month') : (lang === 'bn' ? 'দিন' : 'days')}
                </span>
              )}
            </div>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }} />
            <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
              {toBengaliNumber(pkg.features?.length || 0, lang)} {lang === 'bn' ? 'টি সুবিধা' : 'Features'}
            </span>
          </div>
        </div>

        {/* Row Operations */}
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
          <button
            onClick={onToggleActive}
            style={{
              padding: '0.4rem 0.85rem', borderRadius: '10px', border: 'none',
              background: pkg.is_active ? '#dcfce7' : '#fee2e2',
              color: pkg.is_active ? '#166534' : '#991b1b',
              fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {pkg.is_active ? (lang === 'bn' ? 'লাইভ' : 'Live') : (lang === 'bn' ? 'লুকায়িত' : 'Hidden')}
          </button>
          
          <button
            onClick={() => {
              setEditingId(pkg.id);
              setEditForm({ ...pkg });
            }}
            style={iconBtnStyle('#f1f5f9', '#475569')}
            title={lang === 'bn' ? 'সম্পাদনা করুন' : 'Edit'}
          >
            <Edit2 size={15} />
          </button>
          
          <button 
            onClick={onDelete} 
            style={iconBtnStyle('#fee2e2', '#dc2626')} 
            title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Row Expanded Editing Form */}
      {isEditing && editForm && (
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '1.25rem', background: '#fafbfc', position: 'relative', zIndex: 2 }}>
          <PackageForm
            form={editForm}
            setForm={setEditForm}
            onSave={onSaveEdit}
            onCancel={() => { setEditingId(null); setEditForm(null); }}
            saving={saving}
            title={lang === 'bn' ? "অফারটি সম্পাদনা করুন" : "Edit Offer"}
            updateFeature={updateFeature}
            addFeature={addFeature}
            removeFeature={removeFeature}
            isEdit
          />
        </div>
      )}
    </div>
  );
}

function PackageForm({ form, setForm, onSave, onCancel, saving, title, updateFeature, addFeature, removeFeature, isEdit }) {
  const { lang } = useLanguage();
  return (
    <div style={{
      background: isEdit ? 'transparent' : 'white',
      border: isEdit ? 'none' : '2px dashed #008b5e',
      borderRadius: '20px',
      padding: isEdit ? '0' : '1.5rem',
      marginBottom: isEdit ? '0' : '1.5rem',
      boxShadow: isEdit ? 'none' : '0 4px 20px rgba(0,0,0,0.02)'
    }}>
      {!isEdit && (
        <h3 style={{ marginBottom: '1.25rem', color: '#1e293b', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {title}
        </h3>
      )}

      {/* Pricing & Duration Config Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.85rem' }}>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'অফারের ধরন' : 'Offer Type'}</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
            <option value="boost">{lang === 'bn' ? '⚡ কুইক বুস্ট (স্বল্পমেয়াদী বিজ্ঞাপন বুস্ট)' : '⚡ Quick Boost (Short-term Ad Boost)'}</option>
            <option value="membership">{lang === 'bn' ? '🏆 বিজনেস মেম্বারশিপ' : '🏆 Business Membership'}</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'কার্ড কালার থিম' : 'Card Color Theme'}</label>
          <select value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={inputStyle}>
            <option value="silver">{lang === 'bn' ? 'সিলভার স্টাইল' : 'Silver Style'}</option>
            <option value="gold">{lang === 'bn' ? 'গোল্ড স্টাইল' : 'Gold Style'}</option>
            <option value="business">{lang === 'bn' ? 'বিজনেস স্টাইল' : 'Business Style'}</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'কার্ড আইকন সিলেক্ট' : 'Card Icon Select'}</label>
          <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} style={inputStyle}>
            <option value="zap">{lang === 'bn' ? '⚡ বিজলি (Zap Icon)' : '⚡ Zap Icon'}</option>
            <option value="award">{lang === 'bn' ? '🏅 মেডেল (Award Icon)' : '🏅 Award Icon'}</option>
            <option value="briefcase">{lang === 'bn' ? '💼 স্যুটকেস (Briefcase Icon)' : '💼 Briefcase Icon'}</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'মূল্য / দাম (টাকা)' : 'Price (Tk)'}</label>
          <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={inputStyle} placeholder={lang === 'bn' ? "যেমন: ৪৯৯" : "e.g. 499"} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'অফার প্রাইস / ছাড়ে দাম (টাকা)' : 'Offer Price (Tk)'}</label>
          <input type="number" value={form.offer_price || ''} onChange={e => setForm({ ...form, offer_price: e.target.value })} style={inputStyle} placeholder={lang === 'bn' ? "যেমন: ২৯৯ (ঐচ্ছিক)" : "e.g. 299 (Optional)"} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'মেয়াদ' : 'Duration'}</label>
          <input type="number" value={form.duration || ''} onChange={e => setForm({ ...form, duration: e.target.value })} style={inputStyle} placeholder={lang === 'bn' ? "যেমন: ৭" : "e.g. 7"} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'মেয়াদের একক (Unit)' : 'Duration Unit'}</label>
          <select value={form.duration_unit} onChange={e => setForm({ ...form, duration_unit: e.target.value })} style={inputStyle}>
            <option value="days">{lang === 'bn' ? 'দিন (Days)' : 'Days'}</option>
            <option value="month">{lang === 'bn' ? 'মাস (Month)' : 'Month'}</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'সিরিয়াল ক্রমানুসার (Sort Order)' : 'Sort Order'}</label>
          <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} style={inputStyle} placeholder={lang === 'bn' ? "যেমন: ১" : "e.g. 1"} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.3rem' }}>
          <input type="checkbox" id={`featured-${form.id || 'new'}`} checked={form.is_featured} onChange={e => setForm({ ...form, is_featured: e.target.checked })} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
          <label htmlFor={`featured-${form.id || 'new'}`} style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            ★ {lang === 'bn' ? 'ফিচার্ড অফার (হাইলাইটেড কার্ড করুন)' : 'Featured Offer (Highlight Card)'}
          </label>
        </div>
      </div>

      {/* Translations Config Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginTop: '1rem' }}>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'নাম (English)' : 'Name (English)'}</label>
          <input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} style={inputStyle} placeholder={lang === 'bn' ? "যেমন: Gold Member" : "e.g. Gold Member"} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'নাম (বাংলা)' : 'Name (Bengali)'}</label>
          <input value={form.name_bn} onChange={e => setForm({ ...form, name_bn: e.target.value })} style={inputStyle} placeholder={lang === 'bn' ? "যেমন: গোল্ড মেম্বার" : "e.g. Gold Member (Bengali)"} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'ট্যাগলাইন (English)' : 'Tagline (English)'}</label>
          <input value={form.tagline_en || ''} onChange={e => setForm({ ...form, tagline_en: e.target.value })} style={inputStyle} placeholder={lang === 'bn' ? "যেমন: Sell items within 1 week" : "e.g. Sell items within 1 week"} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'ট্যাগলাইন (বাংলা)' : 'Tagline (Bengali)'}</label>
          <input value={form.tagline_bn || ''} onChange={e => setForm({ ...form, tagline_bn: e.target.value })} style={inputStyle} placeholder={lang === 'bn' ? "যেমন: ১ সপ্তাহের মধ্যে বিক্রি নিশ্চিত করুন" : "e.g. Sell within 1 week (Bengali)"} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'ব্যাজ / রিবন টেক্সট (English)' : 'Badge / Ribbon Text (English)'} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({lang === 'bn' ? 'ঐচ্ছিক' : 'Optional'})</span></label>
          <input value={form.badge_en || ''} onChange={e => setForm({ ...form, badge_en: e.target.value })} style={inputStyle} placeholder={lang === 'bn' ? "যেমন: Best Value" : "e.g. Best Value"} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'bn' ? 'ব্যাজ / রিবন টেক্সট (বাংলা)' : 'Badge / Ribbon Text (Bengali)'} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({lang === 'bn' ? 'ঐচ্ছিক' : 'Optional'})</span></label>
          <input value={form.badge_bn || ''} onChange={e => setForm({ ...form, badge_bn: e.target.value })} style={inputStyle} placeholder={lang === 'bn' ? "যেমন: সেরা ভ্যালু" : "e.g. Best Value (Bengali)"} />
        </div>
      </div>

      {/* Features Config Section */}
      <div style={{ marginTop: '1.25rem' }}>
        <label style={{ ...labelStyle, display: 'block', marginBottom: '0.6rem' }}>
          {lang === 'bn' ? 'প্যাকেজের প্রধান সুবিধাসমূহ (Features List - ✅ আকারে দেখাবে)' : 'Key Package Features (shown with ✅)'}
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {(form.features || []).map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', width: '25px' }}>#{toBengaliNumber(i + 1, lang)}</span>
              <input
                value={f.en}
                onChange={e => updateFeature(form, setForm, i, 'en', e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
                placeholder={lang === 'bn' ? `সুবিধা ${toBengaliNumber(i + 1, lang)} (ইংরেজি)` : `Feature ${i + 1} (English)`}
              />
              <input
                value={f.bn}
                onChange={e => updateFeature(form, setForm, i, 'bn', e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
                placeholder={lang === 'bn' ? `সুবিধা ${toBengaliNumber(i + 1, lang)} (বাংলা)` : `Feature ${i + 1} (Bengali)`}
              />
              <button
                onClick={() => removeFeature(form, setForm, i)}
                style={{ ...iconBtnStyle('#fee2e2', '#ef4444'), flexShrink: 0 }}
                title={lang === 'bn' ? 'রিমুভ করুন' : 'Remove Feature'}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => addFeature(form, setForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            background: '#f0fdf4', color: '#16a34a', border: '1px dashed #86efac',
            borderRadius: '10px', padding: '0.5rem 1rem', cursor: 'pointer',
            fontWeight: 700, fontSize: '0.82rem', marginTop: '0.65rem',
            transition: 'background 0.2s'
          }}
        >
          <Plus size={14} /> {lang === 'bn' ? 'আরও সুবিধা যোগ করুন' : 'Add Feature Row'}
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem' }}>
        <button onClick={onCancel} style={cancelBtnStyle}>{lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}</button>
        <button onClick={onSave} disabled={saving} style={saveBtnStyle}>
          <Save size={15} /> {saving 
            ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') 
            : (lang === 'bn' ? 'অফারটি সংরক্ষণ করুন' : 'Save Offer')}
        </button>
      </div>
    </div>
  );
}

// ─── STYLES & PRESETS ─────────────────────────────────────────────────────────

const labelStyle = { 
  display: 'block', 
  fontSize: '0.8rem', 
  fontWeight: 700, 
  color: '#475569', 
  marginBottom: '0.35rem' 
};

const inputStyle = {
  width: '100%', 
  padding: '0.65rem 0.85rem', 
  border: '1.5px solid #cbd5e1',
  borderRadius: '10px', 
  fontSize: '0.9rem', 
  color: '#1e293b', 
  background: 'white',
  boxSizing: 'border-box', 
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s'
};

const iconBtnStyle = (bg, color) => ({
  width: '34px', 
  height: '34px', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center',
  border: 'none', 
  borderRadius: '9px', 
  background: bg, 
  color, 
  cursor: 'pointer', 
  flexShrink: 0,
  transition: 'all 0.2s'
});

const cancelBtnStyle = {
  flex: 1, 
  padding: '0.75rem', 
  borderRadius: '12px', 
  border: '1.5px solid #cbd5e1',
  background: 'white', 
  fontWeight: 700, 
  cursor: 'pointer', 
  fontSize: '0.9rem', 
  color: '#475569',
  transition: 'background 0.2s'
};

const saveBtnStyle = {
  flex: 2, 
  padding: '0.75rem', 
  borderRadius: '12px', 
  border: 'none',
  background: 'linear-gradient(135deg, #008b5e, #05b078)', 
  color: 'white',
  fontWeight: 700, 
  cursor: 'pointer', 
  fontSize: '0.9rem',
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center', 
  gap: '0.4rem',
  boxShadow: '0 4px 15px rgba(0, 139, 94, 0.2)',
  transition: 'all 0.2s'
};

const deleteBtnStyle = {
  flex: 1, 
  padding: '0.75rem', 
  borderRadius: '12px', 
  border: 'none',
  background: '#ef4444', 
  color: 'white', 
  fontWeight: 700, 
  cursor: 'pointer', 
  fontSize: '0.9rem',
  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
};
