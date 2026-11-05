'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { uploadToImgBB } from '../../../lib/imgbb';
import { useLanguage } from '../../../context/LanguageContext';
import { getRelativeTime, formatLastSeen, compressImage } from '../../../lib/utils';
import styles from '../chat.module.css';
import { Send, Camera, ChevronLeft, Loader2, User as UserIcon, ZoomIn, ZoomOut, X, Trash2, ShieldAlert, ShieldCheck } from 'lucide-react';

// Instant synchronous user resolution from localStorage (0ms delay)
const getInstantUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.user) return parsed.user;
        }
      }
    }
    const localUser = localStorage.getItem('bikroynow_demo_user');
    if (localUser) return JSON.parse(localUser);
  } catch (e) {}
  return null;
};

export default function ChatWindow({ params }) {
  const routeParams = useParams();
  const effectiveId = routeParams?.id || params?.id;
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [chat, setChat] = useState(() => {
    if (typeof window !== 'undefined' && effectiveId) {
      try {
        const cachedMeta = localStorage.getItem('bikroynow_chat_meta_' + effectiveId);
        if (cachedMeta) return JSON.parse(cachedMeta);
      } catch (e) {}
    }
    return null;
  });
  const [messages, setMessages] = useState(() => {
    if (typeof window !== 'undefined' && effectiveId) {
      try {
        const cached = localStorage.getItem('bikroynow_chat_' + effectiveId);
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(() => getInstantUser());
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined' && effectiveId) {
      try {
        const cachedMeta = localStorage.getItem('bikroynow_chat_meta_' + effectiveId);
        if (cachedMeta) return false;
      } catch (e) {}
    }
    return true;
  });
  const [sending, setSending] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const getPartnerId = () => {
    if (!chat || !user) return null;
    const myIds = new Set([
      user?.id,
      user?.email?.toLowerCase(),
      user?.email ? 'user-' + user.email.toLowerCase().replace(/[^a-z0-9]/g, '') : null
    ].filter(Boolean));

    const amBuyer = myIds.has(chat.buyer_id) || (chat.buyer?.email && myIds.has(chat.buyer.email?.toLowerCase()));
    return amBuyer ? chat.seller_id : chat.buyer_id;
  };

  const checkBlockStatus = async (uid, pid) => {
    if (!uid || !pid) return;
    try {
      const res = await fetch(`/api/user/block?user_id=${encodeURIComponent(uid)}&partner_id=${encodeURIComponent(pid)}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setIsBlockedByMe(Boolean(json.is_blocked_by_me));
        setIsBlockedByThem(Boolean(json.is_blocked_by_them));
      }
    } catch (e) {}
  };

  const handleToggleBlock = async () => {
    if (!user || !chat) return;
    const partnerId = getPartnerId();
    if (!partnerId) {
      console.error('Partner ID missing for block toggle');
      return;
    }

    setIsBlocking(true);
    const nextAction = isBlockedByMe ? 'unblock' : 'block';
    try {
      const res = await fetch('/api/user/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: nextAction,
          blocker_id: user.id,
          blocked_id: partnerId
        })
      });
      if (res.ok) {
        setIsBlockedByMe(nextAction === 'block');
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || 'ব্লক পরিবর্তন করতে সমস্যা হয়েছে।');
      }
    } catch (e) {
      console.error('Error toggling block:', e);
    } finally {
      setIsBlocking(false);
      setShowBlockModal(false);
    }
  };

  const handleDeleteEntireChat = async () => {
    setIsDeletingChat(true);
    try {
      try {
        const existing = JSON.parse(localStorage.getItem('bikroynow_deleted_chats') || '[]');
        if (!existing.includes(effectiveId)) {
          existing.push(effectiveId);
          localStorage.setItem('bikroynow_deleted_chats', JSON.stringify(existing));
        }
        localStorage.removeItem('bikroynow_chat_' + effectiveId);
        localStorage.removeItem('bikroynow_chat_meta_' + effectiveId);
      } catch (e) {}

      await fetch(`/api/chats/${effectiveId}?user_id=${encodeURIComponent(user?.id || '')}`, {
        method: 'DELETE'
      });

      router.push('/chat');
    } catch (e) {
      console.error('Delete chat error:', e);
      setIsDeletingChat(false);
      setShowDeleteModal(false);
    }
  };
  const touchStartRef = useRef({ distance: 0, x: 0, y: 0 });
  const openTimeRef = useRef(0);
  const lastTapRef = useRef(0);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      touchStartRef.current = { distance: dist, x: midX, y: midY, initialScale: zoomScale, initialOffset: { ...panOffset } };
    } else if (e.touches.length === 1 && zoomScale > 1) {
      touchStartRef.current = { 
        x: e.touches[0].clientX, 
        y: e.touches[0].clientY, 
        initialOffset: { ...panOffset } 
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && touchStartRef.current.distance > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartRef.current.distance;
      const newScale = Math.max(1, Math.min(4, touchStartRef.current.initialScale * factor));
      setZoomScale(newScale);
    } else if (e.touches.length === 1 && zoomScale > 1) {
      const deltaX = e.touches[0].clientX - touchStartRef.current.x;
      const deltaY = e.touches[0].clientY - touchStartRef.current.y;
      setPanOffset({
        x: touchStartRef.current.initialOffset.x + deltaX,
        y: touchStartRef.current.initialOffset.y + deltaY
      });
    }
  };

  const handleTouchEnd = () => {
    if (zoomScale <= 1.05) {
      setZoomScale(1);
      setPanOffset({ x: 0, y: 0 });
    }
    touchStartRef.current = { distance: 0, x: 0, y: 0 };
  };

  const openLightbox = (url) => {
    openTimeRef.current = Date.now();
    setPreviewImage(url);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    try {
      window.history.pushState({ imageLightbox: true }, '');
    } catch (e) {}
  };

  const closeLightbox = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (Date.now() - openTimeRef.current < 350) return;
    setPreviewImage(null);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    try {
      if (window.history.state?.imageLightbox) {
        window.history.back();
      }
    } catch (e) {}
  };

  const forceCloseLightbox = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setPreviewImage(null);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    try {
      if (window.history.state?.imageLightbox) {
        window.history.back();
      }
    } catch (e) {}
  };

  const handleImageClick = (e) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setZoomScale(prev => (prev > 1.2 ? 1 : 2.5));
      setPanOffset({ x: 0, y: 0 });
    }
    lastTapRef.current = now;
  };

  useEffect(() => {
    if (!previewImage) return;
    document.body.style.overflow = 'hidden';

    // Mobile Phone System / Hardware Back Button Listener
    const handlePopState = () => {
      setPreviewImage(null);
      setZoomScale(1);
      setPanOffset({ x: 0, y: 0 });
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        forceCloseLightbox(e);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewImage]);

  const fetchMessages = async () => {
    if (!effectiveId) return;
    try {
      const res = await fetch(`/api/chats/${effectiveId}/messages?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.messages)) {
          setMessages(prev => {
            // Never wipe out local messages if server returns an empty array!
            if (json.messages.length === 0 && prev.length > 0) {
              return prev;
            }
            const serverMap = new Map();
            json.messages.forEach(m => {
              if (m.id) serverMap.set(String(m.id), m);
            });
            const merged = [...json.messages];
            prev.forEach(p => {
              const pId = String(p.id);
              if (!serverMap.has(pId)) {
                const isDuplicate = json.messages.some(sm => 
                  (p.content && sm.content === p.content) || 
                  (p.image_url && sm.image_url === p.image_url)
                );
                if (!isDuplicate) {
                  merged.push(p);
                }
              }
            });
            merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            try {
              localStorage.setItem('bikroynow_chat_' + effectiveId, JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const markAsRead = async (userId) => {
    if (!effectiveId || !userId) return;
    try {
      fetch(`/api/chats/${effectiveId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      }).catch(() => {});
    } catch (e) {}
  };

  useEffect(() => {
    let isCancelled = false;
    if (!effectiveId) return;

    const setupChat = async () => {
      let activeUser = getInstantUser();

      // Check URL hash for OAuth token
      if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
        try {
          const hashStr = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash;
          const hashParams = new URLSearchParams(hashStr);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken) {
            const { data: authData } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });
            if (authData?.session?.user) {
              activeUser = authData.session.user;
              try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
            }
          }
        } catch (e) {}
      }

      if (!activeUser) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          activeUser = session.user;
        }
      }

      if (!activeUser) {
        if (!isCancelled) {
          setLoading(false);
        }
        return;
      }
      if (!isCancelled) setUser(activeUser);

      // Immediately load cached messages from localStorage so screen is never blank
      try {
        const cached = localStorage.getItem('bikroynow_chat_' + effectiveId);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch (e) {}

      // Mark messages as read when opening room
      markAsRead(activeUser.id);

      let chatData = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const chatRes = await fetch(`/api/chats/${effectiveId}?t=${Date.now()}`, {
            cache: 'no-store'
          });
          if (chatRes.ok) {
            const chatJson = await chatRes.json();
            if (chatJson.chat) {
              chatData = chatJson.chat;
              break;
            }
          }
        } catch (err) {
          console.error('Error fetching chat session attempt ' + attempt, err);
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 350));
      }

      if (!isCancelled) {
        if (chatData) {
          setChat(chatData);
          try {
            localStorage.setItem('bikroynow_chat_meta_' + effectiveId, JSON.stringify(chatData));
          } catch (e) {}
          fetchMessages();
        } else {
          // If server failed, check if we have cached metadata in localStorage
          try {
            const cachedMeta = localStorage.getItem('bikroynow_chat_meta_' + effectiveId);
            if (cachedMeta) {
              setChat(JSON.parse(cachedMeta));
              fetchMessages();
            }
          } catch (e) {}
        }
        setLoading(false);
      }
    };

    setupChat();

    // Auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && !isCancelled) {
        setUser(session.user);
      }
    });

    // Supabase Realtime subscription for instant message delivery
    const channel = supabase
      .channel(`chat-room-${effectiveId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${effectiveId}`
      }, (payload) => {
        if (payload.new && !isCancelled) {
          setMessages(prev => {
            const filtered = prev.filter(m => !String(m.id).startsWith('temp-') || m.content !== payload.new.content);
            if (filtered.some(m => m.id === payload.new.id)) return filtered;
            return [...filtered, payload.new];
          });
          setTimeout(scrollToBottom, 50);
        }
      })
      .subscribe();

    const fetchPartnerStatus = async () => {
      try {
        const res = await fetch(`/api/chats/${effectiveId}?t=${Date.now()}`, {
          cache: 'no-store'
        });
        if (res.ok) {
          const json = await res.json();
          if (json.chat && !isCancelled) {
            setChat(prev => {
              if (!prev) return json.chat;
              return {
                ...prev,
                buyer: json.chat.buyer,
                seller: json.chat.seller
              };
            });
          }
        }
      } catch (e) {}
    };

    // Background poll every 2.5s for instant messages and live partner online status
    const interval = setInterval(() => {
      if (!isCancelled) {
        fetchMessages();
        fetchPartnerStatus();
      }
    }, 2500);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [effectiveId, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-focus mouse cursor into chat input immediately on page load and trigger mobile keyboard
  useEffect(() => {
    if (!loading && chat) {
      const doFocus = () => {
        if (chatInputRef.current) {
          try {
            chatInputRef.current.focus({ preventScroll: true });
          } catch (e) {
            chatInputRef.current.focus();
          }
        }
      };

      doFocus();
      const focusTimer1 = setTimeout(doFocus, 60);
      const focusTimer2 = setTimeout(doFocus, 220);
      const focusTimer3 = setTimeout(doFocus, 500);
      return () => {
        clearTimeout(focusTimer1);
        clearTimeout(focusTimer2);
        clearTimeout(focusTimer3);
      };
    }
  }, [loading, chat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e, imageUrl = null) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !imageUrl) return;

    const content = newMessage.trim();
    setNewMessage(''); // Clear input immediately for UX

    // Optimistic UI: Add message to list immediately so it never vanishes
    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      id: tempId,
      chat_id: effectiveId,
      sender_id: user.id,
      content: content || null,
      image_url: imageUrl || null,
      created_at: new Date().toISOString(),
      is_read: false
    };

    setMessages(prev => {
      const updated = [...prev, optimisticMsg];
      try {
        localStorage.setItem('bikroynow_chat_' + effectiveId, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setTimeout(() => {
      scrollToBottom();
      chatInputRef.current?.focus();
    }, 20);

    setSending(true);

    try {
      const res = await fetch(`/api/chats/${effectiveId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: user.id,
          content: content || null,
          image_url: imageUrl || null
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.message) {
          setMessages(prev => {
            const updated = prev.map(m => m.id === tempId ? json.message : m);
            try {
              localStorage.setItem('bikroynow_chat_' + effectiveId, JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 30);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSending(true);
    try {
      const compressed = await compressImage(file);
      const url = await uploadToImgBB(compressed);
      if (url) {
        await handleSend(null, url);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      alert(lang === 'bn' ? 'ছবি আপলোড ব্যর্থ হয়েছে, আবার চেষ্টা করুন।' : 'Image upload failed, please try again.');
    } finally {
      setSending(false);
      if (e.target) e.target.value = '';
    }
  };

  if (loading) return (
    <div className="container" style={{padding: '5rem 0', textAlign: 'center', color: '#64748b', fontSize: '1.05rem', fontWeight: 600}}>
      {lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
    </div>
  );

  if (!user) return (
    <div className="container" style={{maxWidth: '500px', padding: '5rem 1.5rem', textAlign: 'center'}}>
      <UserIcon size={54} strokeWidth={1.3} color="#cbd5e1" style={{marginBottom: '1rem'}} />
      <h3 style={{fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem'}}>
        {lang === 'bn' ? 'চ্যাট করতে লগইন প্রয়োজন' : 'Please login to chat'}
      </h3>
      <p style={{fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem'}}>
        {lang === 'bn' ? 'বিক্রেতা বা ক্রেতার সাথে চ্যাট করতে আপনার অ্যাকাউন্টে সাইন ইন করুন।' : 'Sign in to your account to start chatting.'}
      </p>
      <Link href={`/login?redirect=${encodeURIComponent('/chat/' + effectiveId)}`} className="btn-primary" style={{borderRadius: '12px', padding: '0.75rem 2rem', textDecoration: 'none', display: 'inline-block'}}>
        {lang === 'bn' ? 'লগইন করুন' : 'Login Now'}
      </Link>
    </div>
  );

  if (!chat) return (
    <div className="container" style={{maxWidth: '500px', padding: '5rem 1.5rem', textAlign: 'center'}}>
      <h3 style={{fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem'}}>
        {lang === 'bn' ? 'চ্যাট সেশন লোড হচ্ছে...' : 'Loading chat session...'}
      </h3>
      <p style={{fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem'}}>
        {lang === 'bn' ? 'অনুগ্রহ করে অপেক্ষা করুন অথবা রিফ্রেশ করুন।' : 'Please wait or refresh the page.'}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
        <button 
          onClick={() => window.location.reload()} 
          className="btn-primary" 
          style={{borderRadius: '12px', padding: '0.75rem 1.75rem', border: 'none', cursor: 'pointer'}}
        >
          {lang === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}
        </button>
        <Link href="/chat" style={{borderRadius: '12px', padding: '0.75rem 1.75rem', textDecoration: 'none', background: '#f1f5f9', color: '#334155', fontWeight: 700}}>
          {lang === 'bn' ? 'মেসেজ তালিকায় যান' : 'Go to Messages'}
        </Link>
      </div>
    </div>
  );

  const myIdentifiers = new Set([
    user?.id,
    user?.email?.toLowerCase(),
    user?.email ? 'user-' + user.email.toLowerCase().replace(/[^a-z0-9]/g, '') : null
  ].filter(Boolean));

  const isBuyer = myIdentifiers.has(chat.buyer_id) || (chat.buyer?.email && myIdentifiers.has(chat.buyer.email?.toLowerCase()));
  const partner = isBuyer ? chat.seller : chat.buyer;

  const isOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    return (now - lastSeenDate) < 180000; // 3 mins threshold
  };

  return (
    <div className={styles.chatLayout}>
      <div className={styles.chatWindow}>
        {/* Header */}
        <div className={styles.windowHeader}>
          <div className={styles.headerLeft}>
            <button className={styles.backBtn} onClick={() => router.push('/chat')}>
              <ChevronLeft size={20} />
            </button>
            <div className={styles.headerPartner}>
              <div style={{fontWeight: '800', color: '#0f172a', fontSize: '1rem'}}>{partner?.full_name || 'User'}</div>
              <div style={{
                fontSize: '0.75rem', 
                color: isOnline(partner?.last_seen) ? '#16a34a' : '#64748b', 
                fontWeight: '700', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '5px'
              }}>
                <span style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: isOnline(partner?.last_seen) ? '#22c55e' : '#94a3b8',
                  boxShadow: isOnline(partner?.last_seen) ? '0 0 6px rgba(34, 197, 94, 0.6)' : 'none'
                }} />
                <span>{formatLastSeen(partner?.last_seen, lang)}</span>
              </div>
            </div>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            {chat.listing && (
              <Link href={`/ad/${chat.listing_id || ''}`} style={{display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', background: '#f8fafc', padding: '0.35rem 0.65rem', borderRadius: '12px', border: '1px solid #e2e8f0'}}>
                <div style={{textAlign: 'right', display: 'flex', flexDirection: 'column'}}>
                  <span style={{fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {chat.listing?.title}
                  </span>
                  <span style={{fontSize: '0.75rem', fontWeight: 800, color: '#008b5e'}}>
                    {chat.listing?.price ? `Tk ${Number(chat.listing.price).toLocaleString()}` : ''}
                  </span>
                </div>
                <img src={chat.listing?.images?.[0] || 'https://via.placeholder.com/100'} alt="Listing" style={{width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #cbd5e1'}} />
              </Link>
            )}
            <button
              type="button"
              title={isBlockedByMe ? (lang === 'bn' ? 'আনব্লক করুন' : 'Unblock User') : (lang === 'bn' ? 'ব্যবহারকারীকে ব্লক করুন' : 'Block User')}
              onClick={() => setShowBlockModal(true)}
              style={{
                background: isBlockedByMe ? '#fef3c7' : '#f1f5f9',
                border: isBlockedByMe ? '1px solid #fde68a' : '1px solid #e2e8f0',
                color: isBlockedByMe ? '#d97706' : '#64748b',
                padding: '0.55rem',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              {isBlockedByMe ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
            </button>
            <button
              type="button"
              title={lang === 'bn' ? 'আমার দিক থেকে চ্যাট মুছুন' : 'Delete for Me'}
              onClick={() => setShowDeleteModal(true)}
              style={{
                background: '#fee2e2',
                border: 'none',
                color: '#ef4444',
                padding: '0.55rem',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Block Status Banners */}
        {isBlockedByMe && (
          <div style={{background: '#fffbeb', borderBottom: '1px solid #fef3c7', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#92400e', fontSize: '0.86rem'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700}}>
              <ShieldAlert size={18} color="#d97706" />
              <span>{lang === 'bn' ? 'আপনি এই ব্যবহারকারীকে ব্লক করেছেন।' : 'You have blocked this user.'}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setShowBlockModal(true)}
              style={{background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer'}}
            >
              {lang === 'bn' ? 'আনব্লক করুন' : 'Unblock'}
            </button>
          </div>
        )}
        {isBlockedByThem && (
          <div style={{background: '#fef2f2', borderBottom: '1px solid #fee2e2', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b', fontSize: '0.86rem', fontWeight: 700}}>
            <ShieldAlert size={18} color="#ef4444" />
            <span>{lang === 'bn' ? 'এই ব্যবহারকারী আপনাকে ব্লক করেছেন। আপনি আর কোনো বার্তা পাঠাতে পারবেন না।' : 'This user has blocked you. You cannot send messages.'}</span>
          </div>
        )}

        {/* Messages area */}
        <div className={styles.messages}>
          {messages.map((msg, i) => {
            const isMe = myIdentifiers.has(msg.sender_id) || msg.sender_id === user?.id;
            return (
              <div key={msg.id || i} className={`${styles.messageRow} ${isMe ? styles.sent : styles.received}`}>
              <div className={styles.bubble}>
                {msg.image_url && (
                  <div className={styles.imageMessageWrapper}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openLightbox(msg.image_url);
                      }}
                      style={{ 
                        cursor: 'pointer', 
                        display: 'inline-block', 
                        position: 'relative',
                        borderRadius: '10px',
                        overflow: 'hidden'
                      }}
                    >
                      <img 
                        src={msg.image_url} 
                        alt="Shared" 
                        className={styles.msgImg} 
                      />
                      <div 
                        style={{
                          position: 'absolute',
                          bottom: '6px',
                          right: '6px',
                          background: 'rgba(0, 0, 0, 0.65)',
                          color: '#ffffff',
                          borderRadius: '12px',
                          padding: '2px 7px',
                          fontSize: '0.68rem',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          pointerEvents: 'none'
                        }}
                      >
                        🔍 {lang === 'bn' ? 'বড় করে দেখুন' : 'View'}
                      </div>
                    </div>
                  </div>
                )}
                {msg.content && <p className={styles.bubbleText}>{msg.content}</p>}
                <span className={styles.msgTime}>{getRelativeTime(msg.created_at, lang)}</span>
              </div>
            </div>
          );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form className={styles.inputArea} onSubmit={handleSend}>
          <label className={styles.uploadBtn}>
            <input type="file" hidden accept=".jpg,.jpeg,.png,.webp" onChange={handleImageUpload} disabled={sending || isBlockedByMe || isBlockedByThem} />
            <Camera size={22} />
          </label>
          <div className={styles.inputWrapper}>
            <input 
              ref={chatInputRef}
              type="text" 
              className={styles.input} 
              placeholder={isBlockedByMe ? (lang === 'bn' ? 'মেসেজ পাঠাতে প্রথমে ব্যবহারকারীকে আনব্লক করুন' : 'Unblock user to send messages') : isBlockedByThem ? (lang === 'bn' ? 'আপনাকে ব্লক করা হয়েছে' : 'You have been blocked') : t('typeMessage')}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
              autoFocus
            />
          </div>
          <button type="submit" className={styles.sendBtn} disabled={sending || (!newMessage.trim())}>
            {sending ? <Loader2 className="spinner" size={18} /> : <Send size={20} />}
          </button>
        </form>
      </div>

      {/* Full-screen Professional Image Lightbox Modal via Portal */}
      {previewImage && mounted && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={closeLightbox}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            inset: 0,
            width: '100vw',
            height: '100vh',
            height: '100dvh',
            backgroundColor: '#000000',
            zIndex: 99999999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            touchAction: 'none',
            overflow: 'hidden'
          }}
        >
          {/* Top Control Bar */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem calc(0.85rem + env(safe-area-inset-top, 0px)) 1rem',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0) 100%)',
              zIndex: 1000,
              width: '100%',
              gap: '0.5rem'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Primary Back Button */}
            <button 
              type="button"
              onClick={forceCloseLightbox}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: '#008b5e',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '24px',
                padding: '0.55rem 1.15rem',
                fontSize: '0.95rem',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 139, 94, 0.5)',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <ChevronLeft size={22} />
              <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
            </button>

            <span style={{ color: 'rgba(255, 255, 255, 0.95)', fontSize: '0.92rem', fontWeight: 800 }}>
              {zoomScale > 1 ? `Zoom: ${Math.round(zoomScale * 100)}%` : (lang === 'bn' ? 'ছবি প্রিভিউ' : 'Photo')}
            </span>

            {/* Zoom Controls & Close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                type="button"
                onClick={() => setZoomScale(prev => (prev > 1.2 ? 1 : 2.5))}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                {zoomScale > 1.2 ? '1x' : '2.5x'}
              </button>

              <button 
                type="button"
                onClick={forceCloseLightbox}
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.9)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
                }}
                title="Close"
              >
                <X size={19} />
              </button>
            </div>
          </div>

          {/* Center Image Container */}
          <div 
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
              width: '100%',
              height: '100%',
              userSelect: 'none',
              padding: '0.5rem'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={closeLightbox}
          >
            <img 
              src={previewImage} 
              alt="Full Preview" 
              onClick={handleImageClick}
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                transition: zoomScale === 1 ? 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)' : 'none',
                maxWidth: '98vw',
                maxHeight: '90dvh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 12px 50px rgba(0,0,0,0.95)',
                cursor: zoomScale > 1 ? 'grab' : 'zoom-in',
                display: 'block'
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
