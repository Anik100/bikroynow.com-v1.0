'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { getRelativeTime } from '../../lib/utils';
import styles from './chat.module.css';
import { MessageSquare, Search, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function ChatListPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchChats = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      // Step 1: Fetch basic chats (no joins that can fail)
      const { data, error } = await supabase
        .from('chats')
        .select('id, created_at, listing_id, buyer_id, seller_id')
        .or(`buyer_id.eq.${session.user.id},seller_id.eq.${session.user.id}`)
        .order('created_at', { ascending: false });

      if (error || !data) {
        console.error('Chat list error:', error);
        setLoading(false);
        return;
      }

      // Step 2: Enrich each chat with listing, partner profile, and last message
      const enriched = await Promise.all(data.map(async (chat) => {
        const isBuyer = chat.buyer_id === session.user.id;
        const partnerId = isBuyer ? chat.seller_id : chat.buyer_id;

        const [{ data: listing }, { data: partner }, { data: messages }, { count: unreadCount }] = await Promise.all([
          supabase.from('listings').select('title, images').eq('id', chat.listing_id).single(),
          supabase.from('profiles').select('full_name, avatar_url').eq('id', partnerId).single(),
          supabase.from('messages').select('content, image_url, created_at').eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(1),
          supabase.from('messages').select('*', { count: 'exact', head: true })
            .eq('chat_id', chat.id)
            .eq('is_read', false)
            .neq('sender_id', session.user.id), // আমার পাঠানো মেসেজ বাদে, অপর জনের পাঠানো অপঠিত মেসেজ
        ]);

        const lastMsg = messages?.[0] || null;
        return {
          ...chat,
          listing: listing || null,
          partner: partner || { full_name: isBuyer ? 'Seller' : 'Buyer' },
          lastMsg,
          unreadCount: unreadCount || 0,
        };
      }));

      // Only show chats that have at least one message
      const withMessages = enriched.filter(chat => chat.lastMsg !== null);

      // Sort by last message time
      withMessages.sort((a, b) => {
        const tA = a.lastMsg?.created_at || a.created_at;
        const tB = b.lastMsg?.created_at || b.created_at;
        return new Date(tB) - new Date(tA);
      });

      setChats(withMessages);
      setLoading(false);
    };

    fetchChats();

    const subscription = supabase
      .channel('chat-list-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages' 
      }, () => {
        fetchChats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [router, lang]);

  if (loading) return <div className="container" style={{padding: '5rem 0', textAlign: 'center'}}>{t('loading')}</div>;

  return (
    <div className="container" style={{maxWidth: '800px', padding: '2rem 1rem'}}>
      <div className={styles.listHeader} style={{border: 'none', padding: '0 0 2rem 0'}}>
        <h2 style={{fontSize: '1.8rem', fontWeight: '800', color: '#1c2b38'}}>
          {t('myMessages')}
        </h2>
      </div>

      <div className={styles.chatList} style={{width: '100%', border: '1px solid #eee', borderRadius: '16px', overflow: 'hidden'}}>
        {chats.length > 0 ? (
          chats.map((chat) => {
            return (
              <Link href={`/chat/${chat.id}`} key={chat.id} className={styles.chatItem} style={{position: 'relative'}}>
                <img 
                  src={chat.listing?.images?.[0] || 'https://via.placeholder.com/100'} 
                  alt={chat.listing?.title} 
                  className={styles.adImage}
                />
                <div className={styles.itemInfo}>
                  <div className={styles.itemHeader}>
                    <span className={styles.partnerName} style={{fontWeight: chat.unreadCount > 0 ? '800' : '700'}}>
                      {chat.partner?.full_name || 'User'}
                    </span>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span className={styles.time}>{getRelativeTime(chat.lastMsg?.created_at || chat.created_at, lang)}</span>
                      {chat.unreadCount > 0 && (
                        <span style={{
                          background: '#008b5e',
                          color: 'white',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          flexShrink: 0,
                        }}>
                          {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{fontSize: '0.85rem', color: '#008b5e', fontWeight: '600', marginBottom: '2px'}}>
                    {chat.listing?.title}
                  </div>
                  <p className={styles.lastMsg} style={{fontWeight: chat.unreadCount > 0 ? '600' : '400', color: chat.unreadCount > 0 ? '#1c2b38' : '#666'}}>
                    {chat.lastMsg?.content || (chat.lastMsg?.image_url ? (lang === 'bn' ? 'ছবি পাঠানো হয়েছে' : 'Sent an image') : '')}
                  </p>
                </div>
              </Link>
            );
          })
        ) : (
          <div className={styles.emptyState} style={{padding: '5rem 0'}}>
            <MessageSquare size={60} strokeWidth={1} />
            <p>{t('noMessages')}</p>
            <Link href="/ads" className="btn-primary" style={{marginTop: '1rem'}}>
              {t('browseAds')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
