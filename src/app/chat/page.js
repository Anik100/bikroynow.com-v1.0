'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { getRelativeTime, formatLastSeen } from '../../lib/utils';
import styles from './chat.module.css';
import { MessageSquare, ArrowRight, Trash2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

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

// Instant synchronous cache resolution from localStorage (0ms delay)
const getCachedChats = (uid) => {
  if (typeof window === 'undefined' || !uid) return [];
  try {
    const raw = localStorage.getItem('bikroynow_cached_chats_' + uid);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [];
};

export default function ChatListPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [chats, setChats] = useState(() => {
    const instant = getInstantUser();
    return instant?.id ? getCachedChats(instant.id) : [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    const instant = getInstantUser();
    if (instant?.id && getCachedChats(instant.id).length > 0) return false;
    return true;
  });
  const [user, setUser] = useState(() => getInstantUser());

  // Chat thread deletion & blocking states
  const [deletingChat, setDeletingChat] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [blockingChat, setBlockingChat] = useState(null);
  const [isBlockingUser, setIsBlockingUser] = useState(false);
  const [holdingChatId, setHoldingChatId] = useState(null);

  const longPressTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const isLongPressActiveRef = useRef(false);

  // Helper to get local deleted chat IDs per user
  const getLocalDeletedIds = (uid) => {
    try {
      const key = uid ? 'bikroynow_deleted_chats_' + uid : 'bikroynow_deleted_chats';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(arr) ? new Set(arr) : new Set();
    } catch (e) {
      return new Set();
    }
  };

  const fetchChatsForUser = async (userId) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const localDeleted = getLocalDeletedIds(userId);

    try {
      // 1. Try server API
      const res = await fetch(`/api/chats/list?user_id=${userId}&t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.chats)) {
          const filtered = json.chats.filter(c => !localDeleted.has(c.id));
          try {
            localStorage.setItem('bikroynow_cached_chats_' + userId, JSON.stringify(filtered));
          } catch (e) {}
          setChats(filtered);
          setLoading(false);
          return;
        }
      }

      // 2. Direct Supabase query fallback (with active user session if valid UUID)
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (isValidUUID) {
        const { data: directChats } = await supabase
          .from('chats')
          .select('*')
          .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
          .order('updated_at', { ascending: false });

        if (directChats && Array.isArray(directChats) && directChats.length > 0) {
          const enriched = await Promise.all(directChats.map(async (c) => {
            const partnerId = c.buyer_id === userId ? c.seller_id : c.buyer_id;
            const [{ data: listing }, { data: partner }, { data: lastMsgs }] = await Promise.all([
              isValidUUID && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.listing_id)
                ? supabase.from('listings').select('title, images, price').eq('id', c.listing_id).maybeSingle()
                : Promise.resolve({ data: null }),
              isValidUUID && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerId)
                ? supabase.from('profiles').select('full_name, avatar_url, last_seen').eq('id', partnerId).maybeSingle()
                : Promise.resolve({ data: null }),
              isValidUUID && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.id)
                ? supabase.from('messages').select('*').eq('chat_id', c.id).order('created_at', { ascending: false }).limit(1)
                : Promise.resolve({ data: null })
            ]);

            return {
              ...c,
              listing: listing || { title: 'BikroyNow Item', images: [] },
              partner: partner || { full_name: 'ব্যবহারকারী (User)' },
              lastMsg: lastMsgs?.[0] || null,
              unreadCount: 0
            };
          }));

          const filtered = enriched.filter(c => !localDeleted.has(c.id));
          setChats(filtered);
          setLoading(false);
          return;
        }
      }

      setChats([]);
    } catch (err) {
      console.error('Chat list fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    return (now - lastSeenDate) < 180000; // 3 mins threshold
  };

  // Touch Long-Press Handlers (for mobile press & hold)
  const handleTouchStart = (chat, e) => {
    if (e.touches.length !== 1) return;
    touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isLongPressActiveRef.current = false;
    setHoldingChatId(chat.id);

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setHoldingChatId(null);
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      setDeletingChat(chat);
    }, 500); // 500ms press & hold
  };

  const handleTouchMove = (e) => {
    if (!touchStartPosRef.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      // User is scrolling, cancel long-press
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      setHoldingChatId(null);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    setHoldingChatId(null);
  };

  const handleChatClick = (chat, e) => {
    if (isLongPressActiveRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressActiveRef.current = false;
      return;
    }
    router.push(`/chat/${chat.id}`);
  };

  // Confirm block user from chat list
  const confirmBlockFromList = async () => {
    if (!blockingChat || !user) return;
    const targetChat = blockingChat;

    const myIds = new Set([
      String(user.id).toLowerCase().trim(),
      user.email ? String(user.email).toLowerCase().trim() : null,
      user.email ? 'user-' + String(user.email).toLowerCase().replace(/[^a-z0-9]/g, '') : null
    ].filter(Boolean));

    const isBuyer = myIds.has(String(targetChat.buyer_id || '').toLowerCase().trim());
    const partnerId = targetChat.partner?.id || targetChat.partner?.email || (isBuyer ? targetChat.seller_id : targetChat.buyer_id);

    if (!partnerId) {
      alert('Partner ID not found');
      return;
    }

    setIsBlockingUser(true);
    try {
      const res = await fetch('/api/user/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'block',
          blocker_id: user.id,
          blocked_id: partnerId
        })
      });

      if (res.ok) {
        alert(lang === 'bn' ? 'ব্যবহারকারীকে সফলভাবে ব্লক করা হয়েছে।' : 'User blocked successfully.');
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || 'ব্লক করতে সমস্যা হয়েছে।');
      }
    } catch (e) {
      console.error('Error blocking user:', e);
    } finally {
      setIsBlockingUser(false);
      setBlockingChat(null);
    }
  };

    // Confirm delete chat thread for current user (Delete for Me)
  const handleConfirmDelete = async () => {
    if (!deletingChat) return;
    const targetChat = deletingChat;
    setIsDeleting(true);

    try {
      // 1. Optimistic removal from state
      setChats(prev => prev.filter(c => c.id !== targetChat.id));

      // 2. Save to per-user local deleted list immediately
      try {
        const key = user?.id ? 'bikroynow_deleted_chats_' + user.id : 'bikroynow_deleted_chats';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        if (!existing.includes(targetChat.id)) {
          existing.push(targetChat.id);
          localStorage.setItem(key, JSON.stringify(existing));
        }
        localStorage.removeItem('bikroynow_chat_' + targetChat.id);
        localStorage.removeItem('bikroynow_chat_meta_' + targetChat.id);
      } catch (e) {}

      // 3. Call server DELETE endpoint with user_id
      const activeUserId = user?.id || '';
      await fetch(`/api/chats/${targetChat.id}?user_id=${encodeURIComponent(activeUserId)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Error deleting chat:', err);
    } finally {
      setIsDeleting(false);
      setDeletingChat(null);
    }
  };

  // Block user directly from chat list
  const handleBlockFromList = async () => {
    if (!deletingChat || !user) return;
    const targetChat = deletingChat;

    // Accurately resolve partner ID from enriched partner profile or buyer/seller IDs
    const myIds = new Set([
      String(user.id).toLowerCase().trim(),
      user.email ? String(user.email).toLowerCase().trim() : null,
      user.email ? 'user-' + String(user.email).toLowerCase().replace(/[^a-z0-9]/g, '') : null
    ].filter(Boolean));

    const isBuyer = myIds.has(String(targetChat.buyer_id || '').toLowerCase().trim());
    const partnerId = targetChat.partner?.id || targetChat.partner?.email || (isBuyer ? targetChat.seller_id : targetChat.buyer_id);

    if (!partnerId) {
      console.error('Could not determine partner ID for block');
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch('/api/user/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'block',
          blocker_id: user.id,
          blocked_id: partnerId
        })
      });

      if (res.ok) {
        // Also remove chat from current user's list
        await handleConfirmDelete();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || 'ব্লক করতে ব্যর্থ হয়েছে, আবার চেষ্টা করুন।');
      }
    } catch (e) {
      console.error('Error blocking user:', e);
    } finally {
      setIsDeleting(false);
      setDeletingChat(null);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    let activeUserId = null;

    // 1. Immediately check instant user from localStorage
    const instantUser = getInstantUser();
    if (instantUser?.id) {
      activeUserId = instantUser.id;
      setUser(instantUser);
      setLoading(false);
      fetchChatsForUser(instantUser.id);
    }

    // Safety fallback: Never keep screen stuck on loading for more than 1.5 seconds
    const safetyTimer = setTimeout(() => {
      if (!isCancelled) setLoading(false);
    }, 1500);

    // 2. Asynchronous verification with Supabase session & OAuth hash token
    const verifySession = async () => {
      // Check for OAuth access_token in URL hash
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
            if (authData?.session?.user && !isCancelled) {
              activeUserId = authData.session.user.id;
              setUser(authData.session.user);
              setLoading(false);
              fetchChatsForUser(authData.session.user.id);
              try {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              } catch (e) {}
              return;
            }
          }
        } catch (e) {}
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && !isCancelled) {
        activeUserId = session.user.id;
        setUser(session.user);
        setLoading(false);
        fetchChatsForUser(session.user.id);
      } else if (!instantUser && !isCancelled) {
        setLoading(false);
      }
    };

    verifySession();

    // 3. Listen to auth state changes to guarantee seamless login sync
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && !isCancelled) {
        activeUserId = session.user.id;
        setUser(session.user);
        setLoading(false);
        fetchChatsForUser(session.user.id);
      } else if (!isCancelled) {
        const fallback = getInstantUser();
        if (fallback) {
          activeUserId = fallback.id;
          setUser(fallback);
          setLoading(false);
          fetchChatsForUser(fallback.id);
        }
      }
    });

    // 4. Polling for live updates
    const interval = setInterval(() => {
      if (!isCancelled && activeUserId) {
        fetchChatsForUser(activeUserId);
      }
    }, 4000);

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimer);
      clearInterval(interval);
      if (authListener?.subscription) authListener.subscription.unsubscribe();
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  if (loading) return (
    <div className="container" style={{padding: '5rem 0', textAlign: 'center', color: '#64748b', fontSize: '1.05rem', fontWeight: 600}}>
      {t('loading')}
    </div>
  );

  if (!user) return (
    <div className="container" style={{maxWidth: '500px', padding: '5rem 1.5rem', textAlign: 'center'}}>
      <MessageSquare size={54} strokeWidth={1.3} color="#cbd5e1" style={{marginBottom: '1rem'}} />
      <h3 style={{fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem'}}>
        {lang === 'bn' ? 'মেসেজ দেখতে লগইন করুন' : 'Please login to view messages'}
      </h3>
      <p style={{fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem'}}>
        {lang === 'bn' ? 'বিক্রেতা এবং ক্রেতাদের সাথে যোগাযোগ করতে আপনার অ্যাকাউন্টে সাইন ইন করুন।' : 'Sign in to your account to communicate with buyers and sellers.'}
      </p>
      <Link href="/login" className="btn-primary" style={{borderRadius: '12px', padding: '0.75rem 2rem', textDecoration: 'none', display: 'inline-block'}}>
        {lang === 'bn' ? 'লগইন করুন' : 'Login Now'}
      </Link>
    </div>
  );

  return (
    <div className="container" style={{maxWidth: '850px', padding: '2rem 1rem'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
        <h2 style={{fontSize: '1.6rem', fontWeight: '850', color: '#0f172a', margin: 0}}>
          {t('myMessages')}
        </h2>
        <span style={{fontSize: '0.85rem', color: '#64748b', fontWeight: 600}}>
          {chats.length > 0 ? (lang === 'bn' ? `${chats.length}টি চ্যাট সক্রিয়` : `${chats.length} active chats`) : ''}
        </span>
      </div>

      <div style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)'}}>
        {chats.length > 0 ? (
          chats.map((chat) => {
            const isHolding = holdingChatId === chat.id;

            return (
              <div
                key={chat.id}
                className={`${styles.chatItem} ${isHolding ? styles.chatItemHolding : ''}`}
                onClick={(e) => handleChatClick(chat, e)}
                onTouchStart={(e) => handleTouchStart(chat, e)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setDeletingChat(chat);
                }}
                style={{
                  display: 'flex',
                  padding: '1.1rem 1.3rem',
                  gap: '1rem',
                  borderBottom: '1px solid #f1f5f9',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                  transition: 'background 0.2s ease, transform 0.15s ease',
                  background: chat.unreadCount > 0 ? '#fff5f5' : 'transparent'
                }}
              >
                {/* Ad Image Thumbnail */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img 
                    src={chat.listing?.images?.[0] || 'https://via.placeholder.com/100'} 
                    alt={chat.listing?.title} 
                    style={{width: '54px', height: '54px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #e2e8f0', display: 'block'}}
                  />
                  {chat.unreadCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      background: '#ef4444',
                      color: 'white',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      border: '2px solid white',
                      boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                    }}>
                      {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0}}>
                      <span style={{fontWeight: chat.unreadCount > 0 ? '850' : '750', fontSize: '0.98rem', color: '#0f172a'}}>
                        {chat.partner?.full_name || 'User'}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        color: isOnline(chat.partner?.last_seen) ? '#16a34a' : '#64748b',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: isOnline(chat.partner?.last_seen) ? '#dcfce7' : '#f1f5f9',
                        padding: '1px 7px',
                        borderRadius: '10px'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: isOnline(chat.partner?.last_seen) ? '#22c55e' : '#94a3b8',
                          boxShadow: isOnline(chat.partner?.last_seen) ? '0 0 4px rgba(34, 197, 94, 0.6)' : 'none'
                        }} />
                        <span>{formatLastSeen(chat.partner?.last_seen, lang, true)}</span>
                      </span>
                    </div>
                    <span style={{fontSize: '0.72rem', color: chat.unreadCount > 0 ? '#ef4444' : '#94a3b8', fontWeight: chat.unreadCount > 0 ? 700 : 500, flexShrink: 0}}>
                      {getRelativeTime(chat.lastMsg?.created_at || chat.created_at, lang)}
                    </span>
                  </div>

                  <div style={{fontSize: '0.85rem', color: '#008b5e', fontWeight: '700', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {chat.listing?.title} {chat.listing?.price ? `• Tk ${Number(chat.listing.price).toLocaleString()}` : ''}
                  </div>

                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <p style={{
                      fontSize: '0.84rem', 
                      color: chat.unreadCount > 0 ? '#1e293b' : '#64748b', 
                      fontWeight: chat.unreadCount > 0 ? '700' : '450',
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '75%'
                    }}>
                      {chat.lastMsg?.content || (chat.lastMsg?.image_url ? (lang === 'bn' ? '📷 ছবি' : '📷 Image') : (lang === 'bn' ? 'কথোপকথন শুরু হয়েছে' : 'Conversation started'))}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span style={{
                        background: '#ef4444',
                        color: 'white',
                        borderRadius: '12px',
                        padding: '0.15rem 0.55rem',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 2px 5px rgba(239, 68, 68, 0.3)'
                      }}>
                        {chat.unreadCount} {lang === 'bn' ? 'টি নতুন' : 'new'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons: Block & Delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <button
                    type="button"
                    className={styles.deleteItemBtn}
                    style={{ color: '#d97706' }}
                    title={lang === 'bn' ? 'ব্যবহারকারীকে ব্লক করুন' : 'Block User'}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setBlockingChat(chat);
                    }}
                  >
                    <ShieldAlert size={18} />
                  </button>
                  <button
                    type="button"
                    className={styles.deleteItemBtn}
                    style={{ color: '#ef4444' }}
                    title={lang === 'bn' ? 'চ্যাট হিস্ট্রি মুছুন' : 'Delete Chat History'}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeletingChat(chat);
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })
        ) : loading ? (
          <div style={{padding: '4.5rem 2rem', textAlign: 'center', color: '#64748b'}}>
            <div style={{
              display: 'inline-block',
              width: '32px',
              height: '32px',
              border: '3px solid #e2e8f0',
              borderTopColor: '#008b5e',
              borderRadius: '50%',
              animation: 'spin 0.75s linear infinite',
              marginBottom: '1rem'
            }} />
            <div style={{fontWeight: 700, fontSize: '0.96rem', color: '#334155'}}>
              {lang === 'bn' ? 'মেসেজ লোড হচ্ছে...' : 'Loading messages...'}
            </div>
          </div>
        ) : (
          <div style={{padding: '5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: '#94a3b8'}}>
            <MessageSquare size={54} strokeWidth={1.3} color="#cbd5e1" />
            <p style={{fontSize: '1rem', color: '#64748b', margin: 0}}>{t('noMessages')}</p>
            <Link href="/ads" className="btn-primary" style={{marginTop: '0.5rem', borderRadius: '10px', padding: '0.65rem 1.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem'}}>
              <span>{t('browseAds')}</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Blocking User from Chat List */}
      {blockingChat && (
        <div 
          className={styles.modalBackdrop} 
          onClick={() => { if (!isBlockingUser) setBlockingChat(null); }}
        >
          <div 
            className={styles.modalBox} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalIconWrapper} style={{background: '#fee2e2'}}>
              <ShieldAlert size={32} color="#ef4444" />
            </div>

            <h3 className={styles.modalTitle}>
              {lang === 'bn' ? 'ব্যবহারকারীকে ব্লক করবেন?' : 'Block this user?'}
            </h3>

            <p className={styles.modalDescription}>
              {lang === 'bn' 
                ? `আপনি কি "${blockingChat.partner?.full_name || 'User'}"-কে ব্লক করতে চান? ব্লক করলে তিনি আপনাকে আর কোনো বার্তা বা গালাগালি দিতে পারবেন না।`
                : `Are you sure you want to block "${blockingChat.partner?.full_name || 'User'}"? They will not be able to send you any messages.`}
            </p>

            <div className={styles.modalChatPreview}>
              <img 
                src={blockingChat.listing?.images?.[0] || 'https://via.placeholder.com/100'} 
                alt={blockingChat.listing?.title} 
                style={{width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #e2e8f0'}}
              />
              <div style={{minWidth: 0, flex: 1}}>
                <div style={{fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  {blockingChat.partner?.full_name || 'User'}
                </div>
                <div style={{fontSize: '0.8rem', color: '#008b5e', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  {blockingChat.listing?.title || 'BikroyNow Item'}
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button 
                type="button" 
                className={styles.modalCancelBtn}
                onClick={() => setBlockingChat(null)}
                disabled={isBlockingUser}
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button 
                type="button" 
                className={styles.modalDeleteBtn}
                style={{background: '#ef4444'}}
                onClick={confirmBlockFromList}
                disabled={isBlockingUser}
              >
                <ShieldAlert size={16} />
                <span>
                  {isBlockingUser 
                    ? (lang === 'bn' ? 'ব্লক হচ্ছে...' : 'Blocking...') 
                    : (lang === 'bn' ? 'ব্লক করুন' : 'Block User')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Chat Thread */}
      {deletingChat && (
        <div 
          className={styles.modalBackdrop} 
          onClick={() => {
            if (!isDeleting) setDeletingChat(null);
          }}
        >
          <div 
            className={styles.modalBox} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalIconWrapper}>
              <Trash2 size={30} color="#ef4444" />
            </div>

            <h3 className={styles.modalTitle}>
              {lang === 'bn' ? 'চ্যাট হিস্ট্রি মুছবেন?' : 'Delete Chat History?'}
            </h3>

            <p className={styles.modalDescription}>
              {lang === 'bn' 
                ? `"${deletingChat.partner?.full_name || 'User'}"-এর সাথে এই চ্যাটটি শুধুমাত্র আপনার ইনবক্স থেকে মুছে যাবে। অন্য প্রান্তের ব্যবহারকারীর চ্যাট হিস্ট্রি অপরিবর্তিত থাকবে।`
                : `This chat will only be deleted from your inbox. The other user's conversation history will not be affected.`}
            </p>

            <div className={styles.modalChatPreview}>
              <img 
                src={deletingChat.listing?.images?.[0] || 'https://via.placeholder.com/100'} 
                alt={deletingChat.listing?.title} 
                style={{width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #e2e8f0'}}
              />
              <div style={{minWidth: 0, flex: 1}}>
                <div style={{fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  {deletingChat.partner?.full_name || 'User'}
                </div>
                <div style={{fontSize: '0.8rem', color: '#008b5e', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  {deletingChat.listing?.title || 'BikroyNow Item'}
                </div>
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '0.65rem'}}>
              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  className={styles.modalCancelBtn}
                  onClick={() => setDeletingChat(null)}
                  disabled={isDeleting}
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button 
                  type="button" 
                  className={styles.modalDeleteBtn}
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  <Trash2 size={16} />
                  <span>
                    {isDeleting 
                      ? (lang === 'bn' ? 'মুছে ফেলা হচ্ছে...' : 'Deleting...') 
                      : (lang === 'bn' ? 'আমার পাশ থেকে মুছুন' : 'Delete for Me')}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleBlockFromList}
                disabled={isDeleting}
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                  padding: '0.65rem 1rem',
                  color: '#dc2626',
                  fontSize: '0.88rem',
                  fontWeight: 750,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
              >
                <ShieldAlert size={16} color="#dc2626" />
                <span>{lang === 'bn' ? 'ব্যবহারকারীকে ব্লক ও ডিলিট করুন' : 'Block & Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
