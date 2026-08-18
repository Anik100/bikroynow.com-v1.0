'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import styles from './AiSupportWidget.module.css';
import { Bot, X, Send, Sparkles, ChevronRight, Globe, ShieldCheck, Zap } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

const toBengaliNumber = (num, lang) => {
  if (lang !== 'bn') return num;
  if (num == null) return '';
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/[0-9]/g, (digit) => bengaliDigits[englishDigits.indexOf(digit)]);
};

export default function AiSupportWidget() {
  const pathname = usePathname();
  const { lang: globalLang } = useLanguage();

  const [aiLang, setAiLang] = useState(globalLang || 'bn'); // 'bn' or 'en'
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  // Dynamic DB State synced with Admin Dashboard
  const [dbPackages, setDbPackages] = useState(null);
  const [paymentSettings, setPaymentSettings] = useState({ bkash: '', nagad: '' });

  // Fetch real-time active packages & gateway settings from Admin Dashboard DB
  useEffect(() => {
    async function loadDynamicAdminData() {
      try {
        const { data: pkgs } = await supabase
          .from('membership_packages')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (pkgs && pkgs.length > 0) {
          setDbPackages(pkgs);
        }

        const { data: settings } = await supabase.from('admin_settings').select('*');
        if (settings) {
          const bkash = settings.find(s => s.key === 'bkash_number');
          const nagad = settings.find(s => s.key === 'nagad_number');
          setPaymentSettings({
            bkash: bkash?.value || '',
            nagad: nagad?.value || ''
          });
        }
      } catch (err) {
        console.log('Using default package fallback for AI:', err);
      }
    }
    loadDynamicAdminData();
  }, []);

  const getGreetingMessage = (language) => ({
    id: 'greeting',
    sender: 'bot',
    text: language === 'bn'
      ? `👋 **আসসালামু আলাইকুম! BikroyNow AI অ্যাসিস্ট্যান্টে আপনাকে স্বাগতম।**\n\nআমি কীভাবে সাহায্য করতে পারি? যেকোনো শর্টকাট (যেমন: "post", "bkash", "price") বা আপনার প্রশ্ন টাইপ করুন:`
      : `👋 **Welcome to BikroyNow AI Assistant!**\n\nHow can I help you today? Type any query or shortcut (e.g., "post", "bkash", "price"):`
  });

  const [messages, setMessages] = useState([getGreetingMessage(aiLang)]);

  useEffect(() => {
    if (globalLang && (globalLang === 'bn' || globalLang === 'en')) {
      setAiLang(globalLang);
      setMessages(prev => {
        if (prev.length === 1 && prev[0].id === 'greeting') {
          return [getGreetingMessage(globalLang)];
        }
        return prev;
      });
    }
  }, [globalLang]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isOpen]);

  const handleToggleLanguage = () => {
    const nextLang = aiLang === 'bn' ? 'en' : 'bn';
    setAiLang(nextLang);
    setMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'bot',
      text: nextLang === 'bn'
        ? `🌐 ভাষা পরিবর্তন করা হয়েছে: **বাংলা**। যেকোনো প্রশ্ন বা শর্টকার্ট টাইপ করুন।`
        : `🌐 Language switched to: **English**. Feel free to ask or type shortcuts.`
    }]);
  };

  // Smart Dynamic Response Generator (Builds answers directly from Admin DB packages)
  const getAiResponse = (userQuery, currentLang) => {
    const raw = userQuery.toLowerCase().trim();
    const q = raw.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ");
    const words = q.split(/\s+/).filter(Boolean);

    const hasAny = (list) => list.some(k => q.includes(k) || words.includes(k));
    const isBn = currentLang === 'bn';

    // Dynamic Shop Memberships Response Generator
    const getDynamicMembershipsText = () => {
      const membershipList = dbPackages?.filter(p => p.type === 'membership') || [];
      if (membershipList.length > 0) {
        let text = isBn
          ? `💼 **বিক্রয়নাউ প্রিমিয়াম মেম্বারশিপ প্ল্যানসমূহ (লাইভ আপডেট):**\n\n`
          : `💼 **BikroyNow Shop Membership Plans (Live Updated):**\n\n`;

        membershipList.forEach((p, idx) => {
          const name = isBn ? (p.name_bn || p.name_en) : (p.name_en || p.name_bn);
          const priceVal = p.offer_price ? p.offer_price : p.price;
          const displayPrice = toBengaliNumber(priceVal, isBn ? 'bn' : 'en');
          const featuresStr = p.features ? p.features.map(f => typeof f === 'object' ? (isBn ? f.bn || f.en : f.en || f.bn) : f).slice(0, 3).join(', ') : '';

          text += `${idx + 1}. **${name} (Tk ${displayPrice}/${isBn ? 'মাস' : 'mo'}):** ${featuresStr}।\n\n`;
        });

        text += isBn ? `👉 [মেম্বারশিপ কিনতে এখানে ক্লিক করুন](/membership)` : `👉 [Click to Subscribe](/membership)`;
        return text;
      }

      // Fallback
      return isBn
        ? `💼 **বিক্রয়নাউ প্রিমিয়াম মেম্বারশিপ প্ল্যানসমূহ:**\n\n১. **🥈 সিলভার মেম্বার (Tk ৯৯৯/মাস):** একসাথে ৫০টি অ্যাড + লোগোসহ কাস্টম শপ পেজ + Verified Silver Badge।\n\n২. **🥇 গোল্ড মেম্বার (Tk ২,৪৯৯/মাস):** একসাথে ১৫০টি অ্যাড + ৫টি ফ্রি টপ অ্যাড + শপ ব্যানার + Verified Gold Badge।\n\n৩. **💼 বিজনেস পার্টনার (Tk ৪,৯৯৯/মাস):** আনলিমিটেড অ্যাড + ১৫টি ফ্রি টপ অ্যাড + হোম স্লাইডার সাপোর্ট + একাউন্ট ম্যানেজার।\n\n👉 [মেম্বারশিপ কিনতে এখানে ক্লিক করুন](/membership)`
        : `💼 **BikroyNow Shop Membership Plans:**\n\n1. **Silver Member (Tk 999/mo):** 50 Active Ads + Shop Page + Silver Badge.\n2. **Gold Member (Tk 2,499/mo):** 150 Active Ads + 5 Free Top Ads + Shop Banner + Gold Badge.\n3. **Business Partner (Tk 4,999/mo):** Unlimited Ads + 15 Free Top Ads + Home Slider Banner + Dedicated Manager.\n\n👉 [Click to Subscribe](/membership)`;
    };

    // Dynamic Single Ad Boost Response Generator
    const getDynamicBoostText = () => {
      const boostList = dbPackages?.filter(p => p.type === 'boost') || [];
      if (boostList.length > 0) {
        let text = isBn
          ? `⚡ **বিজ্ঞাপন দ্রুত বিক্রির বুস্ট প্ল্যান (লাইভ আপডেট):**\n\n`
          : `⚡ **Single Ad Boost Plans (Live Updated):**\n\n`;

        boostList.forEach((p, idx) => {
          const name = isBn ? (p.name_bn || p.name_en) : (p.name_en || p.name_bn);
          const priceVal = p.offer_price ? p.offer_price : p.price;
          const displayPrice = toBengaliNumber(priceVal, isBn ? 'bn' : 'en');
          const featuresStr = p.features ? p.features.map(f => typeof f === 'object' ? (isBn ? f.bn || f.en : f.en || f.bn) : f).slice(0, 3).join(', ') : '';

          text += `${idx + 1}. **${name} (Tk ${displayPrice}):** ${featuresStr}।\n\n`;
        });

        text += isBn ? `👉 [বিজ্ঞাপন বুস্ট করতে এখানে ক্লিক করুন](/membership)` : `👉 [Boost your ad now](/membership)`;
        return text;
      }

      // Fallback
      return isBn
        ? `⚡ **বিজ্ঞাপন দ্রুত বিক্রির বুস্ট প্ল্যান:**\n\n১. **৩ দিনের কুইক বুস্ট (Tk ৯৯):** ৫ গুণ বেশি রিচ ও ক্যাটাগরি পেজের ওপরের পজিশন।\n\n২. **৭ দিনের সুপার বুস্ট (Tk ১৯৯):** ১০ গুণ বেশি রিচ + ফিড ও সার্চের ওপরে প্রমোশন [সেরা পছন্দ]।\n\n৩. **১৫ দিনের মেগা বুস্ট (Tk ৩৪৯):** ২০ গুণ ম্যাক্সিমাম রিচ + হোম পেজ প্রধান স্লাইডারে প্রদর্শন।\n\n👉 [বিজ্ঞাপন বুস্ট করতে এখানে ক্লিক করুন](/membership)`
        : `⚡ **Single Ad Boost Plans:**\n\n1. **3-Day Quick Boost (Tk 99):** 5x reach & top category placement.\n2. **7-Day Super Boost (Tk 199):** 10x reach + top feed ranking [Best Seller].\n3. **15-Day Mega Boost (Tk 349):** 20x reach + Homepage main slider showcase.\n\n👉 [Boost your ad now](/membership)`;
    };

    // Dynamic Payment Info
    const getDynamicPaymentText = () => {
      const bkash = paymentSettings.bkash;
      const nagad = paymentSettings.nagad;
      const numbersInfo = (bkash || nagad) ? ` (${[bkash ? `বিকাশ: ${bkash}` : '', nagad ? `নগদ: ${nagad}` : ''].filter(Boolean).join(', ')})` : '';

      return isBn
        ? `💳 **বিকাশ/নগদ পেমেন্ট করার নিয়ম:**\n\n১. [মেম্বারশিপ পেজে](/membership) গিয়ে আপনার পছন্দের বুস্ট বা মেম্বারশিপে ক্লিক করুন।\n২. আমাদের অফিশিয়াল নম্বরে${numbersInfo} পেমেন্ট (Send Money) সম্পন্ন করুন।\n৩. আপনার বিকাশ/নগদ নম্বর ও ট্রানজেকশন আইডি (TxnID) দিয়ে ফরমটি সাবমিট করুন।\n৪. অ্যাডমিন পেমেন্ট ভেরিফাই করে ১ মিনিটে প্যাকেজ একটিভ করে দেবেন।`
        : `💳 **bKash / Nagad Payment Steps:**\n\n1. Visit [Membership Page](/membership) & select your plan.\n2. Send Money to our official number${numbersInfo}.\n3. Submit your sender number & Transaction ID (TxnID).\n4. Admin verifies and activates your package immediately!`;
    };

    // 1. Slider / Hero Banner Intent
    if (hasAny(['slider', 'slidr', 'slide', 'hero', 'front', 'banner', 'baner', 'স্লাইডার', 'স্ক্রিন', 'হোম পেজ', 'স্লাইট', 'স্লাইড', 'সামনে', 'মেইন স্লাইডার'])) {
      return isBn
        ? `🔥 **হোম পেজের প্রিমিয়াম স্লাইডারে অ্যাড দেখানোর নিয়ম:**\n\nওয়েবসাইটের সামনের স্লাইডারে আপনার প্রোডাক্টের ছবি ও লিঙ্ক দেখাতে ২টি সেরা উপায় রয়েছে:\n\n১. **১৫ দিনের মেগা বুস্ট (Tk ৩৪৯):** আপনার ১টি বিজ্ঞাপন সরাসরি ১৫ দিনের জন্য স্লাইডারে হাইলাইট থাকবে।\n\n২. **বিজনেস পার্টনার মেম্বারশিপ (Tk ৪,৯৯৯/মাস):** আপনার দোকানের আনলিমিটেড অ্যাডগুলো অটোমেটিক এই স্লাইডারে স্থান পাবে।\n\n👉 [প্যাকেজ দেখতে ও বুক করতে এখানে ক্লিক করুন](/membership)`
        : `🔥 **Homepage Main Slider Rules:**\n\nTo showcase your ad inside the main homepage hero banner, choose one of these plans:\n\n1. **15-Day Mega Boost (Tk 349):** Features 1 ad on the main slider for 15 days.\n2. **Business Partner Membership (Tk 4,999/mo):** Automatically rotates your active shop ads on the top slider.\n\n👉 [Click here to view & book packages](/membership)`;
    }

    // 2. Single Ad Boost Intent
    if (hasAny(['boost', 'bst', 'top', 'promot', 'promote', 'fast sale', 'fast sell', 'বুস্ট', 'টপ', 'সেল', 'তাড়াতাড়ি', 'বিক্রি', 'কুইক', 'সুপার'])) {
      return getDynamicBoostText();
    }

    // 3. Shop Memberships & Packages Intent
    if (hasAny(['member', 'mbr', 'pkg', 'pack', 'package', 'price', 'dam', 'daam', 'taka', 'tk', 'cost', 'সিলভার', 'গোল্ড', 'দোকান', 'মেম্বার', 'মেম্বারশিপ', 'প্যাকেজ', 'দাম', 'টাকা', 'কতো', 'কত'])) {
      return getDynamicMembershipsText();
    }

    // 4. Post Ad / Free Ad Intent
    if (hasAny(['post', 'pst', 'add', 'ad', 'dibo', 'দিবো', 'পোস্ট', 'ফ্রি', 'free', 'বিজ্ঞাপন', 'পোষ্ট', 'পস্ট', 'লাগবে', 'নতুন অ্যাড', 'ক্রিয়েট'])) {
      return isBn
        ? `📢 **বিজ্ঞাপন পোস্ট করার নিয়ম:**\n\nবিক্রয়নাউতে প্রতি মাসে আপনি **৩টি বিজ্ঞাপন সম্পূর্ণ ফ্রিতে** পোস্ট করতে পারবেন!\n\n১. ওপরের **'+ Post Ad'** বাটনে ক্লিক করুন।\n২. আপনার পণ্যের ক্যাটাগরি, ছবি, সঠিক দাম ও জেলা সিলেক্ট করুন।\n৩. আপনার ফোন নম্বর ও বর্ণনা দিয়ে সাবমিট করুন।\n\n👉 [বিজ্ঞাপন পোস্ট করতে এখানে ক্লিক করুন](/post-ad)`
        : `📢 **How to Post an Ad:**\n\nYou can post **3 Ads FREE every month** on BikroyNow!\n\n1. Click the **'+ Post Ad'** button at the top.\n2. Select category, upload photos, set price & district.\n3. Add title, description & submit.\n\n👉 [Click here to Post an Ad](/post-ad)`;
    }

    // 5. Payment Intent
    if (hasAny(['pay', 'pymt', 'bkash', 'bksh', 'nagad', 'ngd', 'trx', 'txnid', 'money', 'পেমেন্ট', 'বিকাশ', 'নগদ', 'সেন্ড মানি', 'টাকা পাঠাব'])) {
      return getDynamicPaymentText();
    }

    // 6. Contact Seller Intent
    if (hasAny(['call', 'chat', 'cntct', 'contact', 'num', 'nongbor', 'number', 'phone', 'mobile', 'seller', 'কল', 'চ্যাট', 'নাম্বার', 'নম্বর', 'মোবাইল', 'ফোন', 'যোগাযোগ', 'বিক্রেতা'])) {
      return isBn
        ? `💬 **বিক্রেতার সাথে যোগাযোগ করার নিয়ম:**\n\n১. যেকোনো বিজ্ঞাপনের ওপর ক্লিক করে ডিটেইলস পেজে যান।\n২. নিচে **'Chat with Seller'** বাটনে ক্লিক করে সরাসরি চ্যাট করতে পারবেন অথবা **'Call Seller'** বাটনে চাপ দিয়ে মোবাইল নম্বর পাবেন।`
        : `💬 **How to Contact Seller:**\n\n1. Click on any listing to open details page.\n2. Click **'Chat with Seller'** to text directly, or **'Call Seller'** to get phone number.`;
    }

    // 7. Manage / Edit / Delete Intent
    if (hasAny(['edit', 'edt', 'del', 'delete', 'change', 'myad', 'manage', 'এডিট', 'ডিলেট', 'মুছব', 'আমার অ্যাড', 'পরিবর্তন'])) {
      return isBn
        ? `📝 **বিজ্ঞাপন পরিবর্তন/মুছে ফেলার নিয়ম:**\n\nআপনার পোস্ট করা সকল বিজ্ঞাপন দেখতে এবং এডিট করতে আপনার প্রোফাইলের **My Ads (আমার বিজ্ঞাপন)** সেকশনে যান। সেখান থেকে এক ক্লিকেই অ্যাড এডিট বা ডিলেট করতে পারবেন।\n\n👉 [আপনার বিজ্ঞাপনে যান](/my-ads)`
        : `📝 **Manage Your Ads:**\n\nTo edit, update, or delete your posted ads, go to your **My Ads** dashboard.\n\n👉 [Go to My Ads](/my-ads)`;
    }

    // 8. Account / Login / OTP Intent
    if (hasAny(['login', 'lgn', 'signup', 'reg', 'register', 'otp', 'pass', 'password', 'acc', 'account', 'লগইন', 'সাইনআপ', 'রেজিস্টার', 'ওটিপি', 'পাসওয়ার্ড', 'একাউন্ট'])) {
      return isBn
        ? `🔐 **একাউন্ট তৈরি ও লগইন করা:**\n\n১. ইমেইল ও নাম দিয়ে সাইনআপ করলে আপনার ইমেইলে ৬ ডিজিটের ওটিপি (OTP) কোড পাঠানো হবে।\n২. ওটিপি কোডটি বসালেই অটোমেটিক রেজিস্টার সম্পন্ন হয়ে যাবে।\n৩. এছাড়া আপনি ১-ক্লিকে **Continue with Google** দিয়েও সরাসরি লগইন করতে পারবেন।\n\n👉 [লগইন পেজে যান](/login) | [সাইনআপ পেজে যান](/signup)`
        : `🔐 **Account & Login Guidance:**\n\n1. Register using Email OTP or 1-Click **Continue with Google**.\n2. Enter the 6-digit OTP code sent to your Primary Inbox.\n\n👉 [Go to Login](/login) | [Go to Signup](/signup)`;
    }

    // 9. District / Search Filter Intent
    if (hasAny(['loc', 'location', 'dist', 'district', 'dhaka', 'search', 'find', 'জেলা', 'লোকেশন', 'সার্চ', 'খুঁজব', 'ঢাকা', 'চট্টগ্রাম'])) {
      return isBn
        ? `📍 **জেলা ও লোকেশন অনুযায়ী পণ্য খোঁজা:**\n\nওয়েবসাইটের ওপরে বাম কোণায় **'সমগ্র বাংলাদেশ'** বাটনে ক্লিক করে দেশের যেকোনো ৬৪টি জেলার যেকোনো একটি সিলেক্ট করে সেই এলাকার বিজ্ঞাপনগুলো দেখতে পারবেন।`
        : `📍 **Filter by 64 Districts:**\n\nClick **'All of Bangladesh'** at the top left to filter listings by any specific district!`;
    }

    // 10. Moderation Time Intent
    if (hasAny(['pend', 'pending', 'time', 'active', 'delay', 'late', 'এক্টিভ', 'পেন্ডিং', 'সময়', 'দেট', 'অনুমোদন'])) {
      return isBn
        ? `⏱️ **পেমেন্ট ভেরিফিকেশন ও এক্টিভেশন সময়:**\n\nবিকাশ/নগদ পেমেন্ট সাবমিট করার পর আমাদের অ্যাডমিন প্যানেল **১ থেকে ৫ মিনিটের মধ্যে** পেমেন্ট চেক করে আপনার মেম্বারশিপ বা বুস্ট একটিভ করে দেবে।`
        : `⏱️ **Verification Turnaround Time:**\n\nAfter submitting your bKash/Nagad TxnID, our admin team verifies and activates your package within **1 to 5 minutes**!`;
    }

    // 11. Safety Tips Intent
    if (hasAny(['safe', 'safety', 'scam', 'fraud', 'cheat', 'সেফ', 'নিরাপত্তা', 'প্রতারণা', 'দালাল'])) {
      return isBn
        ? `🛡️ **নিরাপদে কেনাবেচার জরুরি টিপস:**\n\n১. পণ্য না দেখে বা ডেলিভারি নেওয়ার আগে কাউকে অগ্রিম টাকা দেবেন না।\n২. কেনাবেচার জন্য জনবহুল ও নিরাপদ স্থান বেছে নিন।\n৩. পণ্য হাতে পেয়ে ভালোভাবে পরীক্ষা করে তারপর মূল্য পরিশোধ করুন।\n\n👉 [নিরাপত্তা গাইড বিস্তারিত পড়ুন](/stay-safe)`
        : `🛡️ **Safety Guidelines:**\n\n1. Never send advance money before seeing or inspecting the item.\n2. Always meet in a safe, well-lit public area.\n3. Inspect item quality thoroughly before making payment.\n\n👉 [Read Full Safety Tips](/stay-safe)`;
    }

    // 12. Human Agent Transfer Intent
    if (hasAny(['admin', 'human', 'manush', 'help', 'hlp', 'agent', 'support', 'অ্যাডমিন', 'মানুষ', 'হেল্প', 'সাপোর্ট'])) {
      return isBn
        ? `👤 **লাইভ অ্যাডমিন সাপোর্ট:**\n\nআমাদের অ্যাডমিন সাপোর্ট টিম লাইনে রয়েছে। আপনার নির্দিষ্ট প্রশ্নটি নিচে টাইপ করে রাখুন, অ্যাডমিন প্রতিচ্ছবি পাওয়ার সাথে সাথে আপনাকে রিপ্লাই দেবেন।`
        : `👤 **Live Admin Support:**\n\nOur support moderators are active! Type your custom question below and an admin will get back to you shortly.`;
    }

    // 13. Facebook Page Intent
    if (hasAny(['facebook', 'fb', 'page', 'social', 'ফেসবুক', 'পেজ', 'মেসেঞ্জার'])) {
      return isBn
        ? `👍 **আমাদের অফিশিয়াল ফেসবুক পেজ:**\n\nআমাদের সাথে ফেসবুকে যুক্ত থাকতে বা মেসেঞ্জারে কথা বলতে নিচের লিঙ্কে ক্লিক করুন:\n\n👉 [BikroyNow Facebook Page](https://www.facebook.com/profile.php?id=61592653021446)`
        : `👍 **Our Official Facebook Page:**\n\nTo connect with us on Facebook or chat on Messenger, click the link below:\n\n👉 [BikroyNow Facebook Page](https://www.facebook.com/profile.php?id=61592653021446)`;
    }

    // Default Smart Fallback
    return isBn
      ? `ধন্যবাদ আপনার প্রশ্নের জন্য! 😊\n\nআমি শর্টকাট কিওয়ার্ড (যেমন: **post**, **price**, **bkash**, **slider**, **boost**, **login**) খুব সহজে বুঝতে পারি।\n\nঅন্যান্য তথ্যের জন্য:\n• [মেম্বারশিপ প্যাকেজ ও দাম](/membership)\n• [ফ্রি অ্যাড পোস্ট করুন](/post-ad)\n• [নিরাপত্তা টিপস](/stay-safe)`
      : `Thank you for your question! 😊\n\nI understand quick shortcuts like **post**, **price**, **bkash**, **slider**, **boost**, **login**.\n\nExplore more:\n• [Shop Memberships & Pricing](/membership)\n• [Post Free Ad](/post-ad)\n• [Safety Tips](/stay-safe)`;
  };

  const handleSend = (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg = { id: Date.now(), sender: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');

    setTimeout(() => {
      const aiReply = getAiResponse(text, aiLang);
      const botMsg = { id: Date.now() + 1, sender: 'bot', text: aiReply };
      setMessages(prev => [...prev, botMsg]);
    }, 350);
  };

  const quickPrompts = aiLang === 'bn' ? [
    { label: '🔥 স্লাইডারে কীভাবে অ্যাড দেখাব?', query: 'হোম পেজ স্লাইডার' },
    { label: '💼 মেম্বারশিপের প্যাকেজ ও দাম কত?', query: 'মেম্বারশিপ প্যাকেজ' },
    { label: '📢 কীভাবে ফ্রি বিজ্ঞাপন পোস্ট করব?', query: 'ফ্রি বিজ্ঞাপন পোস্ট' },
    { label: '💳 বিকাশ/নগদে পেমেন্ট নিয়ম', query: 'পেমেন্ট নিয়ম' },
  ] : [
    { label: '🔥 How to feature ad on slider?', query: 'home screen slider' },
    { label: '💼 Shop Membership plans & pricing', query: 'membership packages' },
    { label: '📢 How to post a free ad?', query: 'how to post ad' },
    { label: '💳 bKash / Nagad payment guide', query: 'payment guide' },
  ];

  // Pure Yellow Smile Logo Icon (Without "HUT" text)
  const pureYellowLogoIcon = (
    <div className={styles.yellowLogoIcon}>
      <svg viewBox="0 0 44 30" width="16" height="12" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="8" r="3" fill="white"/>
        <circle cx="30" cy="8" r="3" fill="white"/>
        <path d="M 7 17 Q 22 30 37 17" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
  );

  return (
    <div className={styles.floatingContainer}>
      {/* Compact & Ultra-Sleek Floating Trigger Button */}
      {!isOpen && (
        <button className={styles.triggerBtn} onClick={() => setIsOpen(true)}>
          {pureYellowLogoIcon}
          <div className={styles.triggerText}>
            <span className={styles.triggerTitle}>AI</span>
            <div className={styles.greenDotSmall} />
          </div>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className={styles.chatWindow}>
          {/* Header */}
          <div className={styles.chatHeader}>
            <div className={styles.headerLeft}>
              {pureYellowLogoIcon}
              <div className={styles.headerTitleBox}>
                <h4 className={styles.headerTitle}>
                  {aiLang === 'bn' ? 'বিক্রয়নাউ AI অ্যাসিস্ট্যান্ট' : 'BikroyNow AI Assistant'}
                </h4>
                <div className={styles.headerStatus}>
                  <div className={styles.greenDotSmall} style={{ background: '#22c55e' }} />
                  <span>{aiLang === 'bn' ? 'ইনস্ট্যান্ট অনলাইন সাহায্য' : 'Instant AI Answers'}</span>
                </div>
              </div>
            </div>

            {/* Language Switcher & Close Button */}
            <div className={styles.headerRight}>
              <button 
                className={styles.langToggleBtn}
                onClick={handleToggleLanguage}
                title="Switch Language / ভাষা পরিবর্তন"
              >
                <Globe size={12} />
                {aiLang === 'bn' ? 'English' : 'বাংলা'}
              </button>
              <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body / Messages Area */}
          <div className={styles.chatBody}>
            {/* 1. Initial Greeting Message (Top) */}
            {messages.length > 0 && (
              <div className={`${styles.messageRow} ${styles.msgBot}`}>
                <div className={styles.msgBubble}>
                  {messages[0].text.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Quick Option Buttons (Positioned directly under greeting, stays on top of answers) */}
            <div className={styles.quickPrompts}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>
                {aiLang === 'bn' ? 'এক ক্লিকে জানতে চয়ন করুন:' : 'Quick Questions:'}
              </span>
              {quickPrompts.map((p, idx) => (
                <button key={idx} className={styles.quickPromptBtn} onClick={() => handleSend(p.label)}>
                  <span>{p.label}</span>
                  <ChevronRight size={13} />
                </button>
              ))}
            </div>

            {/* 3. Conversation Answers & User Queries (Appears below the options) */}
            {messages.slice(1).map(msg => (
              <div key={msg.id} className={`${styles.messageRow} ${msg.sender === 'bot' ? styles.msgBot : styles.msgUser}`}>
                <div className={styles.msgBubble}>
                  {msg.text.split('\n').map((line, i) => {
                    if (line.includes('[') && line.includes('](')) {
                      const linkMatch = line.match(/\[(.*?)\]\((.*?)\)/);
                      if (linkMatch) {
                        const before = line.substring(0, linkMatch.index);
                        const label = linkMatch[1];
                        const href = linkMatch[2];
                        const after = line.substring(linkMatch.index + linkMatch[0].length);
                        return (
                          <div key={i} style={{ marginTop: '0.35rem' }}>
                            {before}
                            <Link href={href} style={{ color: '#d97706', fontWeight: 800, textDecoration: 'underline' }}>
                              {label}
                            </Link>
                            {after}
                          </div>
                        );
                      }
                    }
                    return <div key={i}>{line}</div>;
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <div className={styles.chatFooter}>
            <input
              type="text"
              className={styles.inputField}
              placeholder={aiLang === 'bn' ? 'আপনার প্রশ্ন বা শর্টকাট লিখুন (যেমন: post, price)...' : 'Type question or shortcut (e.g. post, price)...'}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button className={styles.sendBtn} onClick={() => handleSend()}>
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
