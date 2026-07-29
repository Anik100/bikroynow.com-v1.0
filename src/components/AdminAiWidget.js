'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Bot, X, Send, ShieldCheck, Zap, Star, Award, CreditCard, CheckCircle, MessageSquare, Settings } from 'lucide-react';

export default function AdminAiWidget() {
  const { lang: globalLang } = useLanguage();
  const [aiLang, setAiLang] = useState(globalLang || 'bn');
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const getGreetingMessage = (language) => ({
    id: 'greeting',
    sender: 'bot',
    text: language === 'bn' 
      ? `👑 **আসসালামু আলাইকুম অ্যাডমিন স্যার!**\n\nআমি **BikroyNow অ্যাডমিন AI গাইড**। অ্যাডমিন ড্যাশবোর্ডের সব ফিচার সম্পর্কে আপনার যেকোনো প্রশ্ন নিচে টাইপ করতে পারেন অথবা কুইক গাইড অপশনগুলো থেকে বেছে নিতে পারেন:`
      : `👑 **Welcome Admin Master!**\n\nI am the **BikroyNow Admin AI Guide**. Ask any technical or operational question about managing your Admin Dashboard or select from quick option guides below:`
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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleToggleLanguage = () => {
    const nextLang = aiLang === 'bn' ? 'en' : 'bn';
    setAiLang(nextLang);
    setMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'bot',
      text: nextLang === 'bn'
        ? `🌐 ভাষা পরিবর্তন করা হয়েছে: **বাংলা**। ড্যাশবোর্ডের যেকোনো অপশন সম্পর্কে জিজ্ঞাসা করুন।`
        : `🌐 Language switched to: **English**. Ask anything about dashboard controls.`
    }]);
  };

  const getAdminAiResponse = (userQuery, language) => {
    const q = userQuery.toLowerCase();
    const isBn = language === 'bn';

    if (q.includes('স্লাইডার') || q.includes('slider') || q.includes('featured')) {
      return isBn
        ? `⭐ **হোমপেজ স্লাইডার গাইড (Homepage Slider Guide):**\n\n১. **১-ক্লিক স্লাইডার বাটন:** "সকল বিজ্ঞাপন" বা "অ্যাড মডারেশন" তালিকায় থাকা যেকোনো একটি সক্রিয় বিজ্ঞাপনের কার্ডে **\`⭐ স্লাইডারে দিন\`** বা **\`⭐ স্লাইডারে যুক্ত\`** বাটনে ক্লিক করলেই ১-ক্লিকে অ্যাডটি হোমপেজ ড্রপডাউন মেগা স্লাইডারে যুক্ত বা বাদ হয়ে যাবে!\n\n২. **স্লাইডার ম্যানেজ & অর্ডার:** ড্যাশবোর্ডের **"Featured Slider"** ট্যাবে গেলে সমস্ত স্লাইডার বিজ্ঞাপনের তালিকা দেখতে পাবেন। সেখানে Sort Order ড্রপডাউন দিয়ে কোন অ্যাডটি ১ নম্বর বা ২ নম্বরে স্লাইড করবে তা ইচ্ছেমতো সাজানো যাবে।`
        : `⭐ **Homepage Slider Management Guide:**\n\n1. **1-Click Slider Toggle:** On any active ad card inside Admin Dashboard, simply click the **\`⭐ Add Slider\`** button. The item instantly embeds into the 5-second automatic Homepage Hero Slider!\n\n2. **Reordering & Deleting:** Switch to the **"Featured Slider"** tab to set custom sort positions (0, 1, 2...) or temporarily hide slider banners.`;
    }

    if (q.includes('প্রিমিয়াম') || q.includes('premium') || q.includes('বুস্ট') || q.includes('boost') || q.includes('সিরিয়াল') || q.includes('rank') || q.includes('সিরিয়াল') || q.includes('পজিশন')) {
      return isBn
        ? `👑 **প্রিমিয়াম প্রমোশন ও LIFO র‍্যাংকিং গাইড:**\n\n১. **১-ক্লিক প্রমোশন ড্রপডাউন:** প্রতিটি বিজ্ঞাপনের নিচে গোল্ডেন ড্রপডাউন থেকে পছন্দের প্রমোশন লেভেল বেছে নিন:\n   - **⚪ সাধারণ ফ্রি অ্যাড** (সব প্রমোশনের নিচে)\n   - **★ প্রিমিয়াম লিস্টিং** (গোল্ডেন প্রিমিয়াম ট্যাগ)\n   - **⚡ ৩ দিনের এক্সপ্রেস বুস্ট** (এক্সপ্রেস ট্যাগ)\n   - **🔥 ৭ দিনের প্রিমিয়াম বুস্ট** (সবচেয়ে জনপ্রিয়)\n   - **🚀 ১৫ দিনের মেগা বুস্ট** (মেগা বুস্ট ব্যাজ ও বর্ডার)\n\n২. **LIFO র‍্যাংকিং রুলস (Last-In First-Out):** কোনো অ্যাডমিন বা ইউজার যে মুহূর্তে একটি বিজ্ঞাপন প্রিমিয়াম করবেন, সেটি ইনস্ট্যান্ট **Position #1 (সবার উপরে ১ম পজিশনে)** চলে যাবে এবং আগের প্রিমিয়াম অ্যাডগুলো স্বয়ংক্রিয়ভাবে ২য়, ৩য় পজিশনে সরে যাবে।`
        : `👑 **Premium Promotion & LIFO Top Ranking Guide:**\n\n1. **Instant Promotion Dropdown:** Select any boost tier on the listing card:\n   - Regular Ad (Standard position below all boosts)\n   - Premium Listing (Verified Gold Badge)\n   - 3-Day Express Boost\n   - 7-Day Premium Boost\n   - 15-Day Mega Boost\n\n2. **LIFO Top Rank Rules:** The most recently promoted listing automatically captures **Position #1 (Top Row First Spot)** on Homepage and Search feeds!`;
    }

    if (q.includes('অনুমোদন') || q.includes('approve') || q.includes('পেন্ডিং') || q.includes('pending') || q.includes('বাতিল') || q.includes('reject') || q.includes('মডারেশন')) {
      return isBn
        ? `✅ **বিজ্ঞাপন অনুমোদন ও মডারেশন গাইড:**\n\n১. নতুন যেকোনো ইউজার পোস্ট করলে বিজ্ঞাপনটি প্রথমে **"Pending"** ট্যাবে জমা থাকে।\n২. **অনুমোদন:** সবুজ **\`✓ অনুমোদন দিন\`** বাটনে ক্লিক করা মাত্রই অ্যাডটি পাবলিকলি লাইভ হয়ে যায়।\n৩. **বাতিল & রিকভার:** ভুল বা ভুয়া তথ্য থাকলে লাল **\`বাতিল\`** বাটনে চাপুন। পরে চাইলে যেকোনো সময় "Rejected" ট্যাব থেকে **\`পুনরুদ্ধার করুন\`** চাপ দিয়ে পুনরায় পেন্ডিংয়ে আনা যাবে।`
        : `✅ **Ad Moderation & Approval Workflow:**\n\n1. All user-submitted listings enter the **"Pending"** review queue.\n2. **Approval:** Click green **\`✓ Approve\`** to instantly publish it live.\n3. **Rejection & Recovery:** Click red **\`Reject\`** for invalid entries. You can restore rejected ads back to pending anytime from the Rejected tab.`;
    }

    if (q.includes('পেমেন্ট') || q.includes('payment') || q.includes('বিকাশ') || q.includes('bkash') || q.includes('নগদ') || q.includes('nagad') || q.includes('টাকা') || q.includes('trx')) {
      return isBn
        ? `💳 **পেমেন্ট তথ্য ও বিকাশ/নগদ ভেরিফিকেশন গাইড:**\n\n১. **পেমেন্ট চেক:** গ্রাহক যখন মেম্বারশিপ বা বুস্টের জন্য বিকাশ/নগদে টাকা পাঠিয়ে TrxID সাবমিট করেন, তা **"Payment Info"** ট্যাবে জমা হয়।\n২. **ভেরিফাই:** আপনার বিকাশ/নগদ স্টেটমেন্ট মিলিয়ে দেখে **\`Approve\`** দিন। সাথে সাথে কাস্টমারের প্রোফাইল ব্যাজ বা বুস্ট এক্টিভ হয়ে যাবে!\n৩. **গেটোয়ে নাম্বার সেটআপ:** **"Gateway Settings"** এ গিয়ে আপনার বিকাশ ও নগদ নম্বর (Personal/Agent/Merchant) পরিবর্তন করতে পারবেন।`
        : `💳 **Payments & Gateway Setup:**\n\n1. Customer payments submit TrxIDs to the **"Payment Info"** tab.\n2. Verify the TrxID with your mobile banking SMS, then click **\`Approve\`** to automatically upgrade seller badges or boosts!\n3. Update your bKash & Nagad receiving numbers in the **"Gateway Settings"** tab.`;
    }

    if (q.includes('মেম্বারশিপ') || q.includes('membership') || q.includes('ইউজার') || q.includes('user') || q.includes('সিলভার') || q.includes('গোল্ড') || q.includes('বিজনেস')) {
      return isBn
        ? `🏆 **ইউজার মেম্বারশিপ ও প্রোফাইল এডিট গাইড:**\n\n১. **"User Memberships"** ট্যাবে ওয়েবসাইটে নিবন্ধিত সকল ইউজারের তালিকা দেখা যায়।\n২. আপনি ম্যানুয়ালি যেকোনো ইউজারের **সিলভার**, **গোল্ড** বা **বিজনেস** মেম্বারশিপ লেভেল এবং মেয়াদ সেটিং করে দিতে পারেন।\n৩. **বিজনেস মেম্বার সুবিধা:** বিজনেস মেম্বারদের পোস্ট করা সকল বিজ্ঞাপন ইনস্ট্যান্ট প্রমোট হয় এবং হোমপেজ স্লাইডারে স্বয়ংক্রিয়ভাবে সংযুক্ত হয়!`
        : `🏆 **User Memberships & Seller Badges:**\n\n1. Inspect all registered accounts in the **"User Memberships"** tab.\n2. Manually set seller tiers (**Silver Member**, **Gold Member**, **Business Member**) and expiration dates.\n3. Active Business Members get automatic home slider placement on every published ad!`;
    }

    if (q.includes('মডারেটর') || q.includes('moderator') || q.includes('সাব অ্যাডমিন') || q.includes('পারমিশন')) {
      return isBn
        ? `👥 **সাব-অ্যাডমিন ও মডারেটর পারমিশন গাইড:**\n\n১. **"Moderators"** অংশে আপনার টিমের যেকোনো সদস্যকে মডারেটর ইমেইল দিয়ে যুক্ত করতে পারবেন।\n২. **অ্যাক্সেস পারমিশন:** মডারেটরকে কেবল নির্দিষ্ট কিছু কাজ (যেমন শুধু বিজ্ঞাপন অনুমোদন দেওয়া বা পেমেন্ট ভেরিফাই করা) করার পারমিশন দিয়ে নিয়ন্ত্রণ করা যায়।`
        : `👥 **Moderators & Team Permissions:**\n\n1. Add sub-admin team members under **"Moderators"** section.\n2. Restrict moderator access to specific sections (e.g. Ads Moderation only, Payment Info only).`;
    }

    if (q.includes('চ্যাট') || q.includes('chat') || q.includes('লাইভ') || q.includes('support') || q.includes('সাপোর্ট')) {
      return isBn
        ? `💬 **লাইভ কাস্টমার সাপোর্ট ডেস্ক গাইড:**\n\n১. **"Live Support"** ট্যাবে কাস্টমারদের পাঠানো রিয়েল-টাইম সাপোর্ট মেসেজ রিসিভ করুন।\n২. সাপোর্ট এজেন্টের মতো কাস্টমারের সাথে রিয়েল-টাইমে কথা বলতে, ছবি পাঠাতে এবং চ্যাট সেশন হ্যান্ডেল করতে পারবেন।`
        : `💬 **Live Customer Support Desk:**\n\n1. Receive customer inquiries in real-time under the **"Live Support"** tab.\n2. Reply with text and photos directly to help buyers and sellers on BikroyNow!`;
    }

    return isBn
      ? `⚙️ **অ্যাডমিন ড্যাশবোর্ডের সব প্রধান অপশনসমূহ:**\n\n১. **অ্যাড মডারেশন:** পেন্ডিং অ্যাড অনুমোদন/বাতিল এবং ১-ক্লিক ড্রপডাউনে প্রমোশন পরিবর্তন।\n২. **Featured Slider:** ১-ক্লিকে হোমপেজের স্লাইডারে বিজ্ঞাপন পাঠানো ও কাস্টম সাজানো।\n৩. **Payment Info:** বিকাশ ও নগদ TrxID মিলিয়ে দেখা ও অনুমোদন দেওয়া।\n৪. **User Memberships:** সেলারদের সিলভার, গোল্ড ও বিজনেস মেম্বার ব্যাজ সেট করা।\n৫. **Gateway Settings & Moderators:** বিকাশ/নগদ নম্বর এবং সাব-অ্যাডমিন পারমিশন সেট করা।\n৬. **Live Support:** গ্রাহকদের রিয়েল-টাইম চ্যাটে সাহায্য করা।`
      : `⚙️ **Admin Dashboard Key Features Summary:**\n\n1. **Ads Moderation:** Approve/reject listings & 1-click promotion dropdowns.\n2. **Featured Slider:** 1-Click home slider publishing & sorting.\n3. **Payment Info:** Verify bKash/Nagad transactions.\n4. **User Memberships:** Assign Silver, Gold, or Business Seller Badges.\n5. **Gateway Settings & Moderators:** Manage payment numbers & sub-admin roles.\n6. **Live Support:** Instant real-time customer desk chat.`;
  };

  const handleSendMessage = (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    const userMsg = { id: Date.now(), sender: 'user', text: query };
    const botReply = { id: Date.now() + 1, sender: 'bot', text: getAdminAiResponse(query, aiLang) };

    setMessages(prev => [...prev, userMsg, botReply]);
    setInputText('');
  };

  return (
    <div style={{ position: 'fixed', bottom: '25px', right: '25px', zIndex: 99990, fontFamily: 'Inter, sans-serif' }}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            padding: '0.65rem 1.2rem',
            borderRadius: '99px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            color: '#ffffff',
            border: '2px solid #f59e0b',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.4), 0 0 15px rgba(245, 158, 11, 0.35)',
            cursor: 'pointer',
            fontWeight: 900,
            fontSize: '0.86rem',
            transition: 'all 0.25s ease'
          }}
        >
          <div style={{ background: '#f59e0b', padding: '4px', borderRadius: '50%', color: '#0f172a', display: 'flex' }}>
            <Bot size={18} />
          </div>
          <span>{aiLang === 'bn' ? '⚡ অ্যাডমিন AI গাইড' : '⚡ Admin AI Guide'}</span>
        </button>
      ) : (
        <div style={{
          width: '400px',
          maxWidth: 'calc(100vw - 30px)',
          height: '540px',
          maxHeight: 'calc(100vh - 90px)',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(15, 23, 42, 0.4)',
          border: '2px solid #1e1b4b',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            color: 'white',
            padding: '0.9rem 1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '3px solid #f59e0b'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ background: '#f59e0b', padding: '6px', borderRadius: '10px', color: '#0f172a', display: 'flex' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 900, color: '#ffffff' }}>
                  {aiLang === 'bn' ? 'অ্যাডমিন AI গাইড সেন্টার' : 'Admin AI Guide Center'}
                </h4>
                <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 800 }}>
                  {aiLang === 'bn' ? '● ড্যাশবোর্ড কন্ট্রোল অ্যাসিস্ট্যান্ট' : '● Dashboard Control Assistant'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={handleToggleLanguage}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid #f59e0b',
                  color: '#ffb703',
                  padding: '0.22rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                {aiLang === 'bn' ? 'ENGLISH' : 'বাংলা'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div style={{ flex: 1, padding: '0.9rem', overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%',
                  padding: '0.8rem 1rem',
                  borderRadius: '14px',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  fontWeight: 500,
                  whiteSpace: 'pre-wrap',
                  background: msg.sender === 'user' ? '#1e1b4b' : '#ffffff',
                  color: msg.sender === 'user' ? '#ffffff' : '#1e293b',
                  border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Horizontal Chips */}
          <div style={{ padding: '0.6rem 0.8rem', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
            <button
              onClick={() => handleSendMessage(aiLang === 'bn' ? 'স্লাইডারে কিভাবে পোস্ট দিব?' : 'How to add to home slider?')}
              style={{ padding: '0.35rem 0.7rem', borderRadius: '20px', border: '1px solid #f59e0b', background: '#fffdf5', color: '#b45309', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Star size={12} /> {aiLang === 'bn' ? 'স্লাইডার অপশন' : 'Slider Option'}
            </button>
            <button
              onClick={() => handleSendMessage(aiLang === 'bn' ? 'প্রিমিয়াম সিরিয়াল এবং LIFO র‍্যাংকিং কীভাবে কাজ করে?' : 'How does premium LIFO work?')}
              style={{ padding: '0.35rem 0.7rem', borderRadius: '20px', border: '1px solid #6366f1', background: '#f5f3ff', color: '#4338ca', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Award size={12} /> {aiLang === 'bn' ? 'প্রিমিয়াম & র‍্যাংক' : 'Premium Rank'}
            </button>
            <button
              onClick={() => handleSendMessage(aiLang === 'bn' ? 'পেন্ডিং অ্যাড কিভাবে অনুমোদন করব?' : 'How to approve pending ads?')}
              style={{ padding: '0.35rem 0.7rem', borderRadius: '20px', border: '1px solid #10b981', background: '#ecfdf5', color: '#047857', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <CheckCircle size={12} /> {aiLang === 'bn' ? 'অ্যাড অনুমোদন' : 'Ad Approval'}
            </button>
            <button
              onClick={() => handleSendMessage(aiLang === 'bn' ? 'বিকাশ নগদ পেমেন্ট কিভাবে চেক করব?' : 'How to verify bKash/Nagad payments?')}
              style={{ padding: '0.35rem 0.7rem', borderRadius: '20px', border: '1px solid #0284c7', background: '#f0f9ff', color: '#0369a1', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <CreditCard size={12} /> {aiLang === 'bn' ? 'পেমেন্ট ভেরিফাই' : 'Payment Info'}
            </button>
            <button
              onClick={() => handleSendMessage(aiLang === 'bn' ? 'মেম্বারশিপ ব্যাজ কিভাবে দেওয়া হয়?' : 'How to set seller memberships?')}
              style={{ padding: '0.35rem 0.7rem', borderRadius: '20px', border: '1px solid #eab308', background: '#fefce8', color: '#a16207', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Award size={12} /> {aiLang === 'bn' ? 'সেলার ব্যাজ' : 'Seller Badges'}
            </button>
            <button
              onClick={() => handleSendMessage(aiLang === 'bn' ? 'লাইভ সাপোর্ট চ্যাট কিভাবে ব্যবহার করব?' : 'How to use Live Support chat?')}
              style={{ padding: '0.35rem 0.7rem', borderRadius: '20px', border: '1px solid #ec4899', background: '#fdf2f8', color: '#be185d', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <MessageSquare size={12} /> {aiLang === 'bn' ? 'লাইভ চ্যাট' : 'Live Chat'}
            </button>
          </div>

          {/* Input Footer */}
          <div style={{ padding: '0.65rem 0.85rem', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={aiLang === 'bn' ? 'ড্যাশবোর্ড নিয়ে জিজ্ঞাসা করুন...' : 'Ask about admin controls...'}
              style={{ flex: 1, padding: '0.55rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '0.8rem', outline: 'none' }}
            />
            <button
              onClick={() => handleSendMessage()}
              style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#1e1b4b', color: '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
