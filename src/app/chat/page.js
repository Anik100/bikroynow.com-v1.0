'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { getRelativeTime, formatLastSeen } from '../../lib/utils';
import styles from './chat.module.css';
import { MessageSquare, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ChatListPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const fetchChatsForUser = async (userId) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      // 1. Try server API
      const res = await fetch(`/api/chats/list?user_id=${userId}&t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.chats)) {
          setChats(json.chats);
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

          setChats(enriched);
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

  useEffect(() => {
    let isCancelled = false;
    let activeUserId = null;

    // Safety fallback: Never keep screen stuck on loading for more than 2 seconds
    const safetyTimer = setTimeout(() => {
      if (!isCancelled) setLoading(false);
    }, 2000);

    const checkSessionAndFetch = async () => {
      let activeUser = null;

      // 1. Check getSession
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        activeUser = session.user;
      } else {
        try {
          const localUser = localStorage.getItem('bikroynow_demo_user');
          if (localUser) activeUser = JSON.parse(localUser);
        } catch (e) {}
      }

      // 2. If session not found immediately on mobile, give a 250ms grace period for Supabase to restore from storage
      if (!activeUser) {
        await new Promise(r => setTimeout(r, 250));
        const retry = await supabase.auth.getSession();
        if (retry.data.session?.user) {
          activeUser = retry.data.session.user;
        }
      }

      if (!activeUser) {
        if (!isCancelled) {
          setLoading(false);
          router.push('/login');
        }
        return;
      }

      if (!isCancelled) {
        activeUserId = activeUser.id;
        setUser(activeUser);
        await fetchChatsForUser(activeUser.id);
      }
    };

    checkSessionAndFetch();

    const interval = setInterval(() => {
      if (!isCancelled && activeUserId) {
        fetchChatsForUser(activeUserId);
      }
    }, 4000); // 4s live polling

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimer);
      clearInterval(interval);
    };
  }, [router]);

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
            return (
              <Link 
                href={`/chat/${chat.id}`} 
                key={chat.id} 
                className={styles.chatItem} 
                style={{
                  display: 'flex',
                  padding: '1.1rem 1.3rem',
                  gap: '1rem',
                  borderBottom: '1px solid #f1f5f9',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.2s ease',
                  background: chat.unreadCount > 0 ? '#fff5f5' : 'transparent'
                }}
              >
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
              </Link>
            );
          })
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
    </div>
  );
}
