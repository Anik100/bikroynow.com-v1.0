'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { getRelativeTime, compressImage } from '../../lib/utils';
import { uploadToImgBB } from '../../lib/imgbb';
import { MessageSquare, Mail, Phone, Loader2, ArrowLeft, Send, Camera } from 'lucide-react';
import styles from './support.module.css';

const categories = [
  { id: 'posting', labelEn: 'Ad Posting Problems', labelBn: 'বিজ্ঞাপন পোস্ট করতে সমস্যা' },
  { id: 'payment', labelEn: 'Payment & Boosts', labelBn: 'পেমেন্ট ও বুস্ট সংক্রান্ত' },
  { id: 'membership', labelEn: 'Account & Membership', labelBn: 'অ্যাকাউন্ট ও মেম্বারশিপ' },
  { id: 'report', labelEn: 'Report Scam/Ad', labelBn: 'প্রতারণা বা বিজ্ঞাপন রিপোর্ট' },
  { id: 'other', labelEn: 'Others', labelBn: 'অন্যান্য' }
];

const formatTime = (timeStr, lang) => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (lang === 'bn') {
    const period = h >= 12 ? 'রাত' : 'সকাল';
    const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const displayM = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
    return `${period} ${displayH}${displayM}টা`;
  } else {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const displayM = m.toString().padStart(2, '0');
    return `${displayH}:${displayM} ${period}`;
  }
};

export default function SupportPage() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    email: 'support@bikroynow.com',
    whatsapp: '8801700000000',
    whatsapp_text: 'Hello, I need help with BikroyNow!',
    live_chat_enabled: true,
    support_hours_start: '00:00',
    support_hours_end: '23:59',
  });

  const [isOpen, setIsOpen] = useState(true);
  const [activeChannel, setActiveChannel] = useState(null); // null or 'live_chat'
  
  // Support Category Selection
  const [selectedCategory, setSelectedCategory] = useState('');
  const [hasStartedChat, setHasStartedChat] = useState(false);

  // Chat Room States
  const [chatRoom, setChatRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isAdminOnline, setIsAdminOnline] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endConfirmStep, setEndConfirmStep] = useState(1);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatMessagesRef = useRef(null);

  // Timer for 5-minute reminder
  useEffect(() => {
    if (!chatRoom) {
      setSecondsElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [chatRoom]);

  // Global Presence: Track user online status & check for admins
  useEffect(() => {
    if (!user) return;
    
    const presenceChannel = supabase.channel('support_hub_presence');
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        let adminFound = false;
        Object.values(state).forEach(presences => {
          presences.forEach(p => {
            if (p.isSupportAgent) adminFound = true;
          });
        });
        setIsAdminOnline(adminFound);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ isUser: true, user_id: user.id, timestamp: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  // 1. Initial Load: Check Auth Session & Load Custom Settings
  useEffect(() => {
    const initPage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }
        setUser(session.user);

        // Load customizable parameters from admin_settings
        try {
          const { data: dbSettings } = await supabase.from('admin_settings').select('*');
          if (dbSettings) {
            const supportVal = dbSettings.find(s => s.key === 'support_settings')?.value;
            if (supportVal) {
              const parsed = JSON.parse(supportVal);
              setSettings(prev => ({ ...prev, ...parsed }));
            }
          }
        } catch (err) {
          console.error('Error fetching support settings:', err);
        }
      } catch (err) {
        console.error('Error initializing support page:', err);
      }
      setLoading(false);
    };

    initPage();
  }, []);

  // 2. Dynamically calculate if Support Hours are open (e.g. 9:00 AM to 8:00 PM)
  useEffect(() => {
    const checkSupportHours = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const [startH, startM] = settings.support_hours_start.split(':').map(Number);
      const [endH, endM] = settings.support_hours_end.split(':').map(Number);

      const currentVal = currentHour * 60 + currentMinute;
      const startVal = startH * 60 + startM;
      const endVal = endH * 60 + endM;

      setIsOpen(currentVal >= startVal && currentVal < endVal);
    };

    checkSupportHours();
    const interval = setInterval(checkSupportHours, 30000); // Re-check every 30 seconds
    return () => clearInterval(interval);
  }, [settings]);

  // 2.5 Check active support chat and handle live support click
  const handleLiveChatButtonClick = async () => {
    if (!user) return;
    setChatLoading(true);
    try {
      // Check if user already has an active support chat room in the database
      const { data: chat, error } = await supabase
        .from('support_chats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (chat && !error) {
        // Yes! Active chat session already exists, bypass category selection!
        setChatRoom(chat);
        
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: dbMsgs } = await supabase
          .from('support_messages')
          .select('*')
          .eq('support_chat_id', chat.id)
          .gte('created_at', twentyFourHoursAgo)
          .order('created_at', { ascending: true });

        if (dbMsgs) {
          setMessages(dbMsgs);
        }

        // Mark unread messages as read
        if (dbMsgs && dbMsgs.some(m => m.sender_id !== user.id && !m.is_read)) {
          await supabase
            .from('support_messages')
            .update({ is_read: true })
            .eq('support_chat_id', chat.id)
            .neq('sender_id', user.id)
            .eq('is_read', false);
        }
        
        setHasStartedChat(true);
        setActiveChannel('live_chat');
        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 100);
      } else {
        // No active chat exists, display normal category selection
        setHasStartedChat(false);
        setSelectedCategory('');
        setActiveChannel('live_chat');
      }
    } catch (err) {
      console.error('Error checking active chat room:', err);
      // Fallback
      setHasStartedChat(false);
      setSelectedCategory('');
      setActiveChannel('live_chat');
    } finally {
      setChatLoading(false);
    }
  };

  // 3. Initiate or Load Support Chat
  const startLiveChat = async () => {
    if (!user) return;
    setChatLoading(true);

    try {
      // Check if user already has a support chat room
      let { data: chat, error } = await supabase
        .from('support_chats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!chat && !error) {
        // Create new support chat
        const { data: newChat, error: createError } = await supabase
          .from('support_chats')
          .insert({ user_id: user.id })
          .select()
          .single();

        if (createError) throw createError;
        chat = newChat;
      }

      setChatRoom(chat);

      // Load messages from the last 24 hours only
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let { data: dbMsgs } = await supabase
        .from('support_messages')
        .select('*')
        .eq('support_chat_id', chat.id)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: true });

      if (!dbMsgs) dbMsgs = [];

      // Mark unread admin messages as read
      if (dbMsgs.some(m => m.sender_id !== user.id && !m.is_read)) {
        await supabase
          .from('support_messages')
          .update({ is_read: true })
          .eq('support_chat_id', chat.id)
          .neq('sender_id', user.id)
          .eq('is_read', false);
      }

      // Only insert category message if this is a fresh session (no messages yet)
      if (selectedCategory && dbMsgs.length === 0) {
        const catLabel = lang === 'bn' 
          ? `সাপোর্ট ক্যাটাগরি: ${selectedCategory}` 
          : `Support Category: ${selectedCategory}`;
        
        const { data: newMsg, error: msgErr } = await supabase
          .from('support_messages')
          .insert({
            support_chat_id: chat.id,
            sender_id: user.id,
            content: `📂 ${catLabel}`
          })
          .select()
          .single();
          
        if (!msgErr && newMsg) {
          dbMsgs.push(newMsg);
        }
      }

      setMessages(dbMsgs);
      setActiveChannel('live_chat');
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 100);
    } catch (err) {
      console.error('Chat load error:', err);
      alert(lang === 'bn' ? 'সাপোর্ট চ্যাট লোড করতে সমস্যা হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।' : 'Error loading support chat.');
    }
    setChatLoading(false);
  };

  // 4. Real-time Message Subscription for current support chat room
  useEffect(() => {
    if (!chatRoom || !user) return;

    const subscription = supabase
      .channel(`support_chat:${chatRoom.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `support_chat_id=eq.${chatRoom.id}`
      }, (payload) => {
        // Mark message from admin as read immediately
        if (payload.new.sender_id !== user.id && !payload.new.is_read) {
          supabase
            .from('support_messages')
            .update({ is_read: true })
            .eq('id', payload.new.id)
            .then(() => {});
        }

        setMessages(prev => {
          // Avoid duplicate messages
          if (prev.some(m => m.id === payload.new.id)) return prev;
          
          // Only show message if it is from the last 24 hours
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          if (new Date(payload.new.created_at) < twentyFourHoursAgo) return prev;

          return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [chatRoom, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  // 5. Send message (with optional image)
  const handleSendMessage = async (e, imageUrl = null) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if ((!newMessage.trim() && !imageUrl) || !chatRoom || !user) return;

    setSendingMsg(true);
    const content = newMessage;
    setNewMessage(''); // optimistic input clear

    const { error } = await supabase
      .from('support_messages')
      .insert({
        support_chat_id: chatRoom.id,
        sender_id: user.id,
        content: content || null,
        image_url: imageUrl || null
      });

    if (error) {
      if (!imageUrl) setNewMessage(content); // restore content on failure
      alert(lang === 'bn' ? 'বার্তাটি পাঠানো যায়নি।' : 'Failed to send message.');
    } else {
      // Touch/update chat timestamp
      await supabase
        .from('support_chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatRoom.id);
    }
    setSendingMsg(false);
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 50);
  };

  // 6. Handle image sending via ImgBB
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSendingMsg(true);
    try {
      const compressed = await compressImage(file);
      const url = await uploadToImgBB(compressed);
      await handleSendMessage(null, url);
    } catch (err) {
      alert(lang === 'bn' ? 'ছবি আপলোড সফল হয়নি।' : 'Image upload failed.');
    }
    setSendingMsg(false);
  };

  // 7. End Support Chat Room and Reset
  const handleEndChat = async () => {
    if (!chatRoom) return;
    
    setChatLoading(true);
    try {
      // Delete all messages belonging to this chat
      const { error: msgError } = await supabase
        .from('support_messages')
        .delete()
        .eq('support_chat_id', chatRoom.id);
      if (msgError) throw msgError;
      // Delete the chat room itself
      const { error: chatError } = await supabase
        .from('support_chats')
        .delete()
        .eq('id', chatRoom.id);
      if (chatError) throw chatError;

      // Reset UI state and redirect to home
      setChatRoom(null);
      setMessages([]);
      setActiveChannel(null);
      setHasStartedChat(false);
      setSelectedCategory('');
      setShowEndConfirm(false);
      setEndConfirmStep(1);
      router.push('/');
    } catch (err) {
      console.error('Error ending chat:', err);
      alert(lang === 'bn' ? 'চ্যাট শেষ করতে সমস্যা হয়েছে।' : 'Error ending chat.');
    }
    setChatLoading(false);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer} style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={40} className="spinner" style={{ animation: 'spin 1s linear infinite', color: '#008b5e' }} />
        <p style={{ marginTop: '1rem', color: '#64748b' }}>{lang === 'bn' ? 'অপেক্ষা করুন...' : 'Loading Support Hub...'}</p>
      </div>
    );
  }

  // Not Logged In State
  if (!user) {
    return (
      <div className="container" style={{ padding: '4rem 1rem' }}>
        <div className={styles.unauthorizedCard}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔑</div>
          <h2>{lang === 'bn' ? 'লগইন প্রয়োজন' : 'Authentication Required'}</h2>
          <p>{lang === 'bn' ? 'লাইভ সাপোর্ট চ্যাট এবং কাস্টমার হেল্প পেতে অনুগ্রহ করে প্রথমে লগইন করুন।' : 'Please sign in to access Live Support chat and support hub.'}</p>
          <Link href="/login" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem', textDecoration: 'none' }}>
            {lang === 'bn' ? 'লগইন করুন' : 'Login'}
          </Link>
        </div>
      </div>
    );
  }

  // Redirect to WhatsApp
  const handleWhatsAppRedirect = () => {
    if (!isOpen) return;
    const cleanNum = settings.whatsapp.replace(/\D/g, '');
    const url = `https://wa.me/${cleanNum}?text=${encodeURIComponent(settings.whatsapp_text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className={styles.pageWrapper}>
      <div className="container">
        {/* Back navigation */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link href="/" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', padding: '0.5rem 1rem', borderRadius: '8px' }}>
            <ArrowLeft size={16} />
            <span>{lang === 'bn' ? 'হোমপেজে ফিরে যান' : 'Back to Home'}</span>
          </Link>
        </div>

        {chatLoading ? (
          <div className={styles.supportCard} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
            <Loader2 size={32} className="spinner" style={{ animation: 'spin 1s linear infinite', color: '#008b5e' }} />
            <p style={{ marginTop: '1rem', color: '#64748b' }}>{lang === 'bn' ? 'সাপোর্ট ডেস্ক লোড হচ্ছে...' : 'Loading Support desk...'}</p>
          </div>
        ) : activeChannel === null ? (
          // Support Dashboard Options
          <div className={styles.supportCard}>
            <div className={styles.headerText}>
              <h1>{lang === 'bn' ? 'কাস্টমার সাপোর্ট ও সাহায্য কেন্দ্র' : 'BikroyNow Customer Support'}</h1>
              <p>{lang === 'bn' ? 'আমরা আপনার সহায়তায় সব সময় প্রস্তুত। নিচের যেকোনো মাধ্যমে আমাদের সাথে যোগাযোগ করুন।' : 'We are here to assist you. Choose any communication channel below.'}</p>
            </div>

            {/* Support Hours Banner */}
            <div className={`${styles.hoursBanner} ${isOpen ? styles.bannerOpen : styles.bannerClosed}`}>
              <span style={{ fontSize: '1.25rem' }}>⏰</span>
              <div>
                <strong>
                  {lang === 'bn' 
                    ? `সাপোর্ট সময়সূচী: ${formatTime(settings.support_hours_start, 'bn')} - ${formatTime(settings.support_hours_end, 'bn')}`
                    : `Support Hours: ${formatTime(settings.support_hours_start, 'en')} - ${formatTime(settings.support_hours_end, 'en')}`
                  }
                </strong>
                <div style={{ fontSize: '0.8rem', marginTop: '0.15rem', opacity: 0.9 }}>
                  {isOpen 
                    ? (lang === 'bn' ? '🟢 আমরা এখন অনলাইন আছি!' : '🟢 We are currently online!') 
                    : (lang === 'bn' ? '🔴 আমরা এখন অফলাইনে আছি। অনুগ্রহ করে ইমেইলের মাধ্যমে যোগাযোগ করুন।' : '🔴 We are currently offline. Please contact us via Email.')
                  }
                </div>
              </div>
            </div>

            <div className={styles.channelGrid}>
              {/* 1. Live Chat Button */}
              {settings.live_chat_enabled && (
                <button 
                  onClick={isOpen ? handleLiveChatButtonClick : undefined}
                  className={`${styles.channelCard} ${!isOpen ? styles.cardDisabled : ''}`}
                  disabled={!isOpen}
                >
                  <div className={styles.channelLeft}>
                    <div className={styles.iconWrapper} style={{ background: '#e0f2fe' }}>
                      <MessageSquare size={24} color="#0284c7" />
                    </div>
                    <div className={styles.infoBlock}>
                      <h3>{lang === 'bn' ? 'লাইভ চ্যাট সাপোর্ট' : 'Live Chat Support'}</h3>
                      <p>{lang === 'bn' ? 'সরাসরি কাস্টমার প্রতিনিধির সাথে লাইভ মেসেজে কথা বলুন' : 'Talk with our support agents in real-time'}</p>
                    </div>
                  </div>
                  <span className={`${styles.statusIndicator} ${isOpen ? styles.statusOpen : styles.statusClosed}`}>
                    {isOpen ? (lang === 'bn' ? 'অনলাইন' : 'Online') : (lang === 'bn' ? 'বন্ধ' : 'Offline')}
                  </span>
                </button>
              )}

              {/* 2. WhatsApp Button */}
              <button 
                onClick={isOpen ? handleWhatsAppRedirect : undefined}
                className={`${styles.channelCard} ${!isOpen ? styles.cardDisabled : ''}`}
                disabled={!isOpen}
              >
                <div className={styles.channelLeft}>
                  <div className={styles.iconWrapper} style={{ background: '#dcfce7' }}>
                    <Phone size={24} color="#15803d" />
                  </div>
                  <div className={styles.infoBlock}>
                    <h3>{lang === 'bn' ? 'হোয়াটসঅ্যাপ সাপোর্ট' : 'WhatsApp Support'}</h3>
                    <p>{lang === 'bn' ? 'সরাসরি হোয়াটসঅ্যাপে আমাদের মেসেজ করুন' : 'Message us directly on WhatsApp'}</p>
                  </div>
                </div>
                <span className={`${styles.statusIndicator} ${isOpen ? styles.statusOpen : styles.statusClosed}`}>
                  {isOpen ? (lang === 'bn' ? 'অনলাইন' : 'Online') : (lang === 'bn' ? 'বন্ধ' : 'Offline')}
                </span>
              </button>

              {/* 3. Email Button */}
              <a href={`mailto:${settings.email}`} className={styles.channelCard}>
                <div className={styles.channelLeft}>
                  <div className={styles.iconWrapper} style={{ background: '#fee2e2' }}>
                    <Mail size={24} color="#dc2626" />
                  </div>
                  <div className={styles.infoBlock}>
                    <h3>{lang === 'bn' ? 'ইমেইল সাপোর্ট' : 'Email Support'}</h3>
                    <p>{settings.email}</p>
                  </div>
                </div>
                <span className={`${styles.statusIndicator} ${styles.statusOpen}`} style={{ background: '#f1f5f9', color: '#475569' }}>
                  24/7
                </span>
              </a>
            </div>
          </div>
        ) : !hasStartedChat ? (
          // Category Selection Screen
          <div className={styles.supportCard} style={{ padding: '1.5rem', maxWidth: '460px' }}>
            <div className={styles.chatHeader} style={{ borderRadius: '12px 12px 0 0', margin: '-1.5rem -1.5rem 1.15rem -1.5rem', background: '#008b5e', color: 'white', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button className={styles.backBtn} onClick={() => setActiveChannel(null)}>
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <div className={styles.chatHeaderTitle}>{lang === 'bn' ? 'লাইভ সাপোর্ট ডেস্ক' : 'Support Live Chat'}</div>
                  <div className={styles.chatHeaderSubtitle}>{lang === 'bn' ? 'সহায়তা ক্যাটাগরি নির্বাচন করুন' : 'Select support category'}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600, textAlign: 'center', margin: '0.25rem 0' }}>
                {lang === 'bn' ? 'আপনার সমস্যা অনুযায়ী একটি ক্যাটাগরি সিলেক্ট করুন:' : 'Please select a category for your support query:'}
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {categories.map((cat) => {
                  const currentLabel = lang === 'bn' ? cat.labelBn : cat.labelEn;
                  const isSelected = selectedCategory === currentLabel;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(currentLabel)}
                      style={{
                        padding: '0.85rem 1.1rem',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid #008b5e' : '1px solid #e2e8f0',
                        background: isSelected ? '#ecfdf5' : '#f8fafc',
                        color: isSelected ? '#047857' : '#334155',
                        fontWeight: isSelected ? '700' : '500',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: isSelected ? '0 2px 8px rgba(0, 139, 94, 0.08)' : 'none'
                      }}
                    >
                      <span>{lang === 'bn' ? cat.labelBn : cat.labelEn}</span>
                      {isSelected && <span style={{ color: '#008b5e', fontWeight: 'bold', fontSize: '1.1rem' }}>✓</span>}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={async () => {
                  if (!selectedCategory) {
                    alert(lang === 'bn' ? 'দয়া করে একটি ক্যাটাগরি সিলেক্ট করুন।' : 'Please select a category first.');
                    return;
                  }
                  setHasStartedChat(true);
                  await startLiveChat();
                }}
                disabled={!selectedCategory}
                style={{
                  background: '#008b5e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.9rem',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginTop: '0.5rem',
                  opacity: selectedCategory ? 1 : 0.6,
                  transition: 'opacity 0.2s',
                  boxShadow: '0 4px 12px rgba(0, 139, 94, 0.15)'
                }}
              >
                🚀 {lang === 'bn' ? 'চ্যাট শুরু করুন' : 'Start Chat'}
              </button>
            </div>
          </div>
        ) : (
          // Active Live Chat Window
          <div className={styles.supportCard} style={{ padding: '1rem', maxWidth: '460px' }}>
            <div className={styles.chatContainer} style={{ height: '440px' }}>
              <div className={styles.chatHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button className={styles.backBtn} onClick={() => setActiveChannel(null)}>
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <div className={styles.chatHeaderTitle}>{lang === 'bn' ? 'লাইভ সাপোর্ট ডেস্ক' : 'Support Live Chat'}</div>
                    <div className={styles.chatHeaderSubtitle}>
                      {lang === 'bn' ? 'অনলাইন সহায়তা প্রতিনিধি' : 'Support Agent'}
                      {isAdminOnline && (
                        <span style={{ marginLeft: '0.4rem', color: '#10b981', fontWeight: 'bold' }}>
                          • {lang === 'bn' ? 'অ্যাক্টিভ' : 'Active'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', background: '#059669', padding: '0.15rem 0.5rem', borderRadius: '12px' }}>
                  {lang === 'bn' ? 'লাইভ' : 'LIVE'}
                </span>
              </div>

              {/* Waiting Notification Banner */}
              <div style={{
                background: '#ecfdf5',
                borderBottom: '1px solid #a7f3d0',
                padding: '0.6rem 0.85rem',
                color: '#047857',
                fontSize: '0.8rem',
                textAlign: 'center',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}>
                📢 {lang === 'bn' 
                  ? 'আমাদের এডমিন অতি শীঘ্রই আপনার সাথে যোগাযোগ করবে দয়া করে অপেক্ষা করুন' 
                  : 'Our admin will contact you very soon, please wait.'}
              </div>

              {/* Messages area */}
              <div ref={chatMessagesRef} className={styles.chatMessages}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#64748b', margin: 'auto 0', padding: '2rem 1rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👋</div>
                    <h3>{lang === 'bn' ? 'কাস্টমার কেয়ার সেন্টারে স্বাগতম!' : 'Welcome to Support Chat!'}</h3>
                    <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {lang === 'bn' 
                        ? 'আপনার যেকোনো সমস্যা বা প্রশ্ন এখানে লিখুন। আমাদের সাপোর্ট টিম অবিলম্বে উত্তর দেবে।' 
                        : 'Write down your query or problem here. Our support team will respond shortly.'}
                    </p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isOwn = msg.sender_id === user.id;
                    return (
                      <div key={i} className={`${styles.msgRow} ${isOwn ? styles.msgSent : styles.msgReceived}`}>
                        <div className={styles.msgBubble}>
                          {msg.image_url && (
                            <div style={{ marginBottom: '0.4rem', borderRadius: '8px', overflow: 'hidden', maxWidth: '240px' }}>
                              <img 
                                src={msg.image_url} 
                                alt="Support Attachment" 
                                style={{ width: '100%', display: 'block', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} 
                                onClick={() => window.open(msg.image_url, '_blank')} 
                              />
                            </div>
                          )}
                          {msg.content && <p>{msg.content}</p>}
                          <span className={styles.msgTime}>
                            {getRelativeTime(msg.created_at, lang)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Spacer to prevent float End Chat button from blocking messages */}
                <div style={{ height: '28px' }} />
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Wrapper with End Chat button relative positioned */}
              <div style={{ position: 'relative', width: '100%', background: 'white' }}>
                <div style={{
                  position: 'absolute',
                  top: '-28px',
                  right: '12px',
                  zIndex: 10
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEndConfirmStep(1);
                      setShowEndConfirm(true);
                    }}
                    style={{
                      background: '#fee2e2',
                      color: '#ef4444',
                      border: '1px solid #fca5a5',
                      borderRadius: '6px',
                      padding: '0.15rem 0.5rem',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#ef4444';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fee2e2';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                  >
                    🛑 {lang === 'bn' ? 'চ্যাট শেষ করুন' : 'End Chat'}
                  </button>
                </div>

                <form className={styles.chatInputArea} onSubmit={handleSendMessage}>
                  <label className={styles.uploadBtn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', padding: '0 0.5rem' }}>
                    <input 
                      type="file" 
                      hidden 
                      accept=".jpg,.jpeg,.png,.webp" 
                      onChange={handleImageUpload} 
                      disabled={sendingMsg} 
                    />
                    <Camera size={22} />
                  </label>
                  <input
                    ref={chatInputRef}
                    type="text"
                    className={styles.chatInput}
                    placeholder={lang === 'bn' ? 'আপনার বার্তাটি এখানে লিখুন...' : 'Type your query here...'}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button type="submit" className={styles.chatSendBtn} disabled={sendingMsg || (!newMessage.trim())}>
                    {sendingMsg ? <Loader2 size={16} className="spinner" style={{ animation: 'spin 1s linear' }} /> : <Send size={18} />}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {showEndConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '2rem',
            maxWidth: '360px', width: '100%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', color: '#dc2626' }}>
              {lang === 'bn' ? 'চ্যাট সেশনটি শেষ করতে চান?' : 'End Support Session?'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.5, fontWeight: 500 }}>
              {lang === 'bn' 
                ? 'আপনি কি নিশ্চিত? এই সেশনের সমস্ত মেসেজ ও ছবি চিরতরে মুছে ফেলা হবে।' 
                : 'Are you sure? All messages and session data will be permanently deleted.'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '10px',
                  border: '1px solid #cbd5e1', background: 'white',
                  fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                  color: '#475569'
                }}
              >
                {lang === 'bn' ? 'না (No)' : 'No'}
              </button>
              <button
                onClick={handleEndChat}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '10px',
                  border: 'none', background: '#dc2626',
                  color: 'white', fontWeight: 800, cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                {lang === 'bn' ? 'হ্যাঁ (Yes)' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
