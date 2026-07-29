'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import styles from './AiSupportWidget.module.css';
import { Bot, X, Send, Sparkles, ChevronRight, Globe, ShieldCheck, Zap } from 'lucide-react';
import Link from 'next/link';

import { usePathname } from 'next/navigation';

export default function AiSupportWidget() {
  const pathname = usePathname();
  const { lang: globalLang } = useLanguage();

  const [aiLang, setAiLang] = useState(globalLang || 'bn'); // 'bn' or 'en'
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  // Show the AI floating button ONLY on the root home page ('/')
  if (pathname !== '/') {
    return null;
  }

  const getAiResponse = (userQuery, currentLang) => {
    const q = userQuery.toLowerCase().trim();

    // 1. Home Screen Slider Query (Banglish: "slider a kivabe ad dibo", "home page a kivabe dekhabo", "front screen")
    if (q.includes('স্লাইডার') || q.includes('স্ক্রিন') || q.includes('হোম পেজ') || q.includes('slider') || q.includes('hero') || q.includes('front screen') || q.includes('home page') || q.includes('slidr')) {
      return currentLang === 'bn'
        ? `🔥 **হোম পেজের প্রিমিয়াম স্লাইডারে অ্যাড দেখানোর নিয়ম:**\n\nওয়েবসাইটের সামনের স্লাইডারে আপনার প্রোডাক্টের ছবি ও লিঙ্ক দেখাতে ২টি সেরা উপায় রয়েছে:\n\n১. **১৫ দিনের মেগা বুস্ট (Tk ৩৪৯):** আপনার ১টি বিজ্ঞাপন সরাসরি ১৫ দিনের জন্য স্লাইডারে হাইলাইট থাকবে।\n\n২. **বিজনেস পার্টনার মেম্বারশিপ (Tk ৪,৯৯৯/মাস):** আপনার দোকানের আনলিমিটেড অ্যাডগুলো অটোমেটিক এই স্লাইডারে স্থান পাবে।\n\n👉 [প্যাকেজ দেখতে ও বুক করতে এখানে ক্লিক করুন](/membership)`
        : `🔥 **Homepage Main Slider Rules:**\n\nTo showcase your ad inside the main homepage hero banner, choose one of these plans:\n\n1. **15-Day Mega Boost (Tk 349):** Features 1 ad on the main slider for 15 days.\n2. **Business Partner Membership (Tk 4,999/mo):** Automatically rotates your active shop ads on the top slider.\n\n👉 [Click here to view & book packages](/membership)`;
    }

    // 2. Shop Memberships Query (Banglish: "membership koto", "package er dam", "koto taka lagbe", "dokan")
    if (q.includes('মেম্বারশিপ') || q.includes('প্যাকেজ') || q.includes('membership') || q.includes('package') || q.includes('দোকান') || q.includes('dam') || q.includes('taka') || q.includes('price')) {
      return currentLang === 'bn'
        ? `💼 **বিক্রয়নাউ প্রিমিয়াম মেম্বারশিপ প্ল্যানসমূহ:**\n\n১. **🥈 সিলভার মেম্বার (Tk ৯৯৯/মাস):** একসাথে ৫০টি অ্যাড + লোগোসহ কাস্টম শপ পেজ + Verified Silver Badge।\n\n২. **🥇 গোল্ড মেম্বার (Tk ২,৪৯৯/মাস):** একসাথে ১৫০টি অ্যাড + ৫টি ফ্রি টপ অ্যাড + শপ ব্যানার + Verified Gold Badge।\n\n৩. **💼 বিজনেস পার্টনার (Tk ৪,৯৯৯/মাস):** আনলিমিটেড অ্যাড + ১৫টি ফ্রি টপ অ্যাড + হোম স্লাইডার সাপোর্ট + একাউন্ট ম্যানেজার।\n\n👉 [মেম্বারশিপ কিনতে এখানে ক্লিক করুন](/membership)`
        : `💼 **BikroyNow Shop Membership Plans:**\n\n1. **Silver Member (Tk 999/mo):** 50 Active Ads + Shop Page + Silver Badge.\n2. **Gold Member (Tk 2,499/mo):** 150 Active Ads + 5 Free Top Ads + Shop Banner + Gold Badge.\n3. **Business Partner (Tk 4,999/mo):** Unlimited Ads + 15 Free Top Ads + Home Slider Banner + Dedicated Manager.\n\n👉 [Click to Subscribe](/membership)`;
    }

    // 3. Single Ad Boost Query (Banglish: "ad boost korbo kivabe", "boost koto taka", "sales barabo", "top ad")
    if (q.includes('বুস্ট') || q.includes('boost') || q.includes('দ্রুত বিক্রি') || q.includes('fast sale') || q.includes('top ad') || q.includes('pro promotion')) {
      return currentLang === 'bn'
        ? `⚡ **বিজ্ঞাপন দ্রুত বিক্রির বুস্ট প্ল্যান:**\n\n১. **৩ দিনের কুইক বুস্ট (Tk ৯৯):** ৫ গুণ বেশি রিচ ও ক্যাটাগরি পেজের ওপরের পজিশন।\n\n২. **৭ দিনের সুপার বুস্ট (Tk ১৯৯):** ১০ গুণ বেশি রিচ + ফিড ও সার্চের ওপরে প্রমোশন [সেরা পছন্দ]।\n\n৩. **১৫ দিনের মেগা বুস্ট (Tk ৩৪৯):** ২০ গুণ ম্যাক্সিমাম রিচ + হোম পেজ প্রধান স্লাইডারে প্রদর্শন।\n\n👉 [বিজ্ঞাপন বুস্ট করতে এখানে ক্লিক করুন](/membership)`
        : `⚡ **Single Ad Boost Plans:**\n\n1. **3-Day Quick Boost (Tk 99):** 5x reach & top category placement.\n2. **7-Day Super Boost (Tk 199):** 10x reach + top feed ranking [Best Seller].\n3. **15-Day Mega Boost (Tk 349):** 20x reach + Homepage main slider showcase.\n\n👉 [Boost your ad now](/membership)`;
    }

    // 4. How to Post Free Ads Query (Banglish: "kivabe ad dibo", "kivabe post ad korbo", "free ad kivabe dibo", "post ad")
    if (q.includes('বিজ্ঞাপন') || q.includes('পোস্ট') || q.includes('ফ্রি') || q.includes('post ad') || q.includes('free ad') || q.includes('ad dibo') || q.includes('kivabe post')) {
      return currentLang === 'bn'
        ? `📢 **বিজ্ঞাপন পোস্ট করার নিয়ম:**\n\nবিক্রয়নাউতে প্রতি মাসে আপনি **৩টি বিজ্ঞাপন সম্পূর্ণ ফ্রিতে** পোস্ট করতে পারবেন!\n\n১. ওপরের **'+ Post Ad'** বাটনে ক্লিক করুন।\n২. আপনার পণ্যের ক্যাটাগরি, ছবি, সঠিক দাম ও জেলা সিলেক্ট করুন।\n৩. আপনার ফোন নম্বর ও বর্ণনা দিয়ে সাবমিট করুন।\n\n👉 [বিজ্ঞাপন পোস্ট করতে এখানে ক্লিক করুন](/post-ad)`
        : `📢 **How to Post an Ad:**\n\nYou can post **3 Ads FREE every month** on BikroyNow!\n\n1. Click the **'+ Post Ad'** button at the top.\n2. Select category, upload photos, set price & district.\n3. Add title, description & submit.\n\n👉 [Click here to Post an Ad](/post-ad)`;
    }

    // 5. Payment Steps Query (Banglish: "bkash no koto", "kivabe taka pathabo", "nagad no", "payment kivabe korbo")
    if (q.includes('পেমেন্ট') || q.includes('বিকাশ') || q.includes('নগদ') || q.includes('payment') || q.includes('bkash') || q.includes('nagad') || q.includes('taka pathabo')) {
      return currentLang === 'bn'
        ? `💳 **বিকাশ/নগদ পেমেন্ট করার নিয়ম:**\n\n১. [মেম্বারশিপ পেজে](/membership) গিয়ে আপনার পছন্দের বুস্ট বা মেম্বারশিপে ক্লিক করুন।\n২. আমাদের অফিশিয়াল বিকাশ/নগদ নম্বরে পেমেন্ট (Send Money) সম্পন্ন করুন।\n৩. আপনার বিকাশ/নগদ নম্বর ও ট্রানজেকশন আইডি (TxnID) দিয়ে ফরমটি সাবমিট করুন।\n৪. অ্যাডমিন পেমেন্ট ভেরিফাই করে ১ মিনিটে প্যাকেজ একটিভ করে দেবেন।`
        : `💳 **bKash / Nagad Payment Steps:**\n\n1. Visit [Membership Page](/membership) & select your plan.\n2. Send Money to our official bKash/Nagad number.\n3. Submit your sender number & Transaction ID (TxnID).\n4. Admin verifies and activates your package immediately!`;
    }

    // 6. Contact Seller / Chat Query (Banglish: "seller er sathe kotha bolbo kivabe", "call dibo kivabe", "chat")
    if (q.includes('কথা') || q.includes('বিক্রেতা') || q.includes('কল') || q.includes('seller') || q.includes('chat') || q.includes('call') || q.includes('message') || q.includes('nongbor')) {
      return currentLang === 'bn'
        ? `💬 **বিক্রেতার সাথে যোগাযোগ করার নিয়ম:**\n\n১. যেকোনো বিজ্ঞাপনের ওপর ক্লিক করে ডিটেইলস পেজে যান।\n২. নিচে **'Chat with Seller'** বাটনে ক্লিক করে সরাসরি চ্যাট করতে পারবেন অথবা **'Call Seller'** বাটনে চাপ দিয়ে মোবাইল নম্বর পাবেন।`
        : `💬 **How to Contact Seller:**\n\n1. Click on any listing to open details page.\n2. Click **'Chat with Seller'** to text directly, or **'Call Seller'** to get phone number.`;
    }

    // 7. Manage / Edit / Delete Ads Query (Banglish: "ad edit korbo kivabe", "ad delete korbo kivabe", "my ad")
    if (q.includes('এডিট') || q.includes('ডিলেট') || q.includes('আমার অ্যাড') || q.includes('my ad') || q.includes('edit') || q.includes('delete') || q.includes('manage')) {
      return currentLang === 'bn'
        ? `📝 **বিজ্ঞাপন পরিবর্তন/মুছে ফেলার নিয়ম:**\n\nআপনার পোস্ট করা সকল বিজ্ঞাপন দেখতে এবং এডিট করতে আপনার প্রোফাইলের **My Ads (আমার বিজ্ঞাপন)** সেকশনে যান। সেখান থেকে এক ক্লিকেই অ্যাড এডিট বা ডিলেট করতে পারবেন।\n\n👉 [আপনার বিজ্ঞাপনে যান](/my-ads)`
        : `📝 **Manage Your Ads:**\n\nTo edit, update, or delete your posted ads, go to your **My Ads** dashboard.\n\n👉 [Go to My Ads](/my-ads)`;
    }

    // 8. Account / Login / OTP Query (Banglish: "login hocche na", "sign up kivabe korbo", "otp asche na")
    if (q.includes('লগইন') || q.includes('সাইন আপ') || q.includes('পাসওয়ার্ড') || q.includes('login') || q.includes('signup') || q.includes('otp') || q.includes('password')) {
      return currentLang === 'bn'
        ? `🔐 **একাউন্ট তৈরি ও লগইন করা:**\n\n১. ইমেইল ও নাম দিয়ে সাইনআপ করলে আপনার ইমেইলে ৬ ডিজিটের ওটিপি (OTP) কোড পাঠানো হবে।\n২. ওটিপি কোডটি বসালেই অটোমেটিক রেজিস্টার সম্পন্ন হয়ে যাবে।\n৩. এছাড়া আপনি ১-ক্লিকে **Continue with Google** দিয়েও সরাসরি লগইন করতে পারবেন।\n\n👉 [লগইন পেজে যান](/login) | [সাইনআপ পেজে যান](/signup)`
        : `🔐 **Account & Login Guidance:**\n\n1. Register using Email OTP or 1-Click **Continue with Google**.\n2. Enter the 6-digit OTP code sent to your Primary Inbox.\n\n👉 [Go to Login](/login) | [Go to Signup](/signup)`;
    }

    // 9. District / Search Filter Query (Banglish: "location kivabe set korbo", "district search", "dhaka ad")
    if (q.includes('জেলা') || q.includes('লোকেশন') || q.includes('সার্চ') || q.includes('district') || q.includes('location') || q.includes('search')) {
      return currentLang === 'bn'
        ? `📍 **জেলা ও লোকেশন অনুযায়ী পণ্য খোঁজা:**\n\nওয়েবসাইটের ওপরে বাম কোণায় **'সমগ্র বাংলাদেশ'** বাটনে ক্লিক করে দেশের যেকোনো ৬৪টি জেলার যেকোনো একটি সিলেক্ট করে সেই এলাকার বিজ্ঞাপনগুলো দেখতে পারবেন।`
        : `📍 **Filter by 64 Districts:**\n\nClick **'All of Bangladesh'** at the top left to filter listings by any specific district!`;
    }

    // 10. Moderation Time Query (Banglish: "taka dilam tao active hoy nai keno", "pending keno", "approval time")
    if (q.includes('এক্টিভ') || q.includes('পেন্ডিং') || q.includes('দেট') || q.includes('active') || q.includes('pending') || q.includes('approve') || q.includes('time')) {
      return currentLang === 'bn'
        ? `⏱️ **পেমেন্ট ভেরিফিকেশন ও এক্টিভেশন সময়:**\n\nবিকাশ/নগদ পেমেন্ট সাবমিট করার পর আমাদের অ্যাডমিন প্যানেল **১ থেকে ৫ মিনিটের মধ্যে** পেমেন্ট চেক করে আপনার মেম্বারশিপ বা বুস্ট একটিভ করে দেবে।`
        : `⏱️ **Verification Turnaround Time:**\n\nAfter submitting your bKash/Nagad TxnID, our admin team verifies and activates your package within **1 to 5 minutes**!`;
    }

    // 11. Safety Tips Query (Banglish: "protarona", "safe kivabe thakbo", "safety")
    if (q.includes('নিরাপত্তা') || q.includes('সেফ') || q.includes('safety') || q.includes('safe') || q.includes('প্রতারণা')) {
      return currentLang === 'bn'
        ? `🛡️ **নিরাপদে কেনাবেচার জরুরি টিপস:**\n\n১. পণ্য না দেখে বা ডেলিভারি নেওয়ার আগে কাউকে অগ্রিম টাকা দেবেন না।\n২. কেনাবেচার জন্য জনবহুল ও নিরাপদ স্থান বেছে নিন।\n৩. পণ্য হাতে পেয়ে ভালোভাবে পরীক্ষা করে তারপর মূল্য পরিশোধ করুন।\n\n👉 [নিরাপত্তা গাইড বিস্তারিত পড়ুন](/stay-safe)`
        : `🛡️ **Safety Guidelines:**\n\n1. Never send advance money before seeing or inspecting the item.\n2. Always meet in a safe, well-lit public area.\n3. Inspect item quality thoroughly before making payment.\n\n👉 [Read Full Safety Tips](/stay-safe)`;
    }

    // 12. Human Agent Transfer Query
    if (q.includes('মানুষ') || q.includes('অ্যাডমিন') || q.includes('human') || q.includes('admin') || q.includes('কাস্টমার কেয়ার') || q.includes('support')) {
      return currentLang === 'bn'
        ? `👤 **লাইভ অ্যাডমিন সাপোর্ট:**\n\nআমাদের অ্যাডমিন সাপোর্ট টিম লাইনে রয়েছে। আপনার নির্দিষ্ট প্রশ্নটি নিচে টাইপ করে রাখুন, অ্যাডমিন প্রতিচ্ছবি পাওয়ার সাথে সাথে আপনাকে রিপ্লাই দেবেন।`
        : `👤 **Live Admin Support:**\n\nOur support moderators are active! Type your custom question below and an admin will get back to you shortly.`;
    }

    // Default Smart Fallback
    return currentLang === 'bn'
      ? `ধন্যবাদ আপনার প্রশ্নের জন্য! 😊\n\nআমি আপনাকে সাহায্য করতে পারি:\n\n• **হোম পেজ স্লাইডারে অ্যাড দেখানোর উপায়**\n• **মেম্বারশিপ প্যাকেজ ও দাম**\n• **ফ্রি বিজ্ঞাপন পোস্ট করার নিয়ম**\n• **বিকাশ/নগদ পেমেন্ট গাইড**\n• **বিজ্ঞাপন এডিট বা একাউন্ট সহায়তা**\n\nঅথবা সরাসরি আমাদের [মেম্বারশিপ পেজে যান](/membership)।`
      : `Thank you for your question! 😊\n\nI can assist you with:\n• Featuring ads on Homepage Slider\n• Shop Membership Plans & Pricing\n• How to post Free Ads\n• bKash / Nagad Payment Info\n• Account & Listing Guidance\n\nOr visit our [Membership Page](/membership).`;
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
    }, 450);
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
            {messages.map(msg => (
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

            {/* Quick Suggested Questions */}
            {messages.length < 6 && (
              <div className={styles.quickPrompts}>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                  {aiLang === 'bn' ? 'এক ক্লিকে জানতে চয়ন করুন:' : 'Quick Questions:'}
                </span>
                {quickPrompts.map((p, idx) => (
                  <button key={idx} className={styles.quickPromptBtn} onClick={() => handleSend(p.query)}>
                    <span>{p.label}</span>
                    <ChevronRight size={13} />
                  </button>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <div className={styles.chatFooter}>
            <input
              type="text"
              className={styles.inputField}
              placeholder={aiLang === 'bn' ? 'আপনার প্রশ্ন লিখুন...' : 'Type your question...'}
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
