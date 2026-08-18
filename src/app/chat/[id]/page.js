'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { uploadToImgBB } from '../../../lib/imgbb';
import { useLanguage } from '../../../context/LanguageContext';
import { getRelativeTime, compressImage, getUserId } from '../../../lib/utils';
import styles from '../chat.module.css';
import { Send, Camera, ChevronLeft, Loader2, User as UserIcon } from 'lucide-react';

export default function ChatWindow({ params }) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const touchStartRef = useRef({ distance: 0, x: 0, y: 0 });
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

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

  const closeLightbox = () => {
    setPreviewImage(null);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const setupChat = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      try {
        const chatRes = await fetch(`/api/chats/${params.id}`);
        if (chatRes.ok) {
          const chatJson = await chatRes.json();
          if (chatJson.chat) {
            setChat(chatJson.chat);
            fetchMessages();
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Error fetching chat session:', err);
      }
      router.push('/chat');
      setLoading(false);
    };

    setupChat();

    // Poll for new messages every 3 seconds
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [params.id]);

  useEffect(() => {
    scrollToBottom();
    if (chat && user) {
      markAsRead();
    }
  }, [messages, chat, user]);

  const markAsRead = async () => {
    // Local read marking
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chats/${params.id}/messages`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.messages)) {
          setMessages(json.messages);
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e, imageUrl = null) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !imageUrl) return;

    setSending(true);
    const content = newMessage;
    setNewMessage(''); // Clear input immediately for UX

    // Focus back on the input box immediately so user can continue typing
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 30);

    try {
      const res = await fetch(`/api/chats/${params.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: user.id,
          content: content || null,
          image_url: imageUrl || null
        })
      });
      if (res.ok) {
        fetchMessages();
      }
    } catch (err) {
      alert('Error sending message: ' + err.message);
    }
    setSending(false);

    // Keep focus after status changes complete
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 30);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSending(true);
    try {
      const compressed = await compressImage(file);
      const url = await uploadToImgBB(compressed);
      await handleSend(null, url);
    } catch (err) {
      alert('Image upload failed');
    }
    setSending(false);
  };

  if (loading || !user || !chat) return <div className="container" style={{padding: '5rem 0', textAlign: 'center'}}>Loading...</div>;

  try {
    const isBuyer = chat.buyer_id === user?.id;
    const partner = isBuyer ? chat.seller : chat.buyer;

    const isOnline = (lastSeen) => {
      if (!lastSeen) return false;
      const lastSeenDate = new Date(lastSeen);
      const now = new Date();
      return (now - lastSeenDate) < 120000; // 2 mins threshold
    };

    return (
      <div className={styles.chatLayout}>
        <div className={styles.chatWindow}>
          {/* Header */}
          <div className={styles.windowHeader}>
            <div className={styles.headerLeft}>
              <button className={styles.backBtn} onClick={() => router.push('/chat')}>
                <ChevronLeft />
              </button>
              <div className={styles.headerPartner}>
                <div style={{fontWeight: '700', color: '#1c2b38'}}>{partner?.full_name || 'User'}</div>
                <div style={{fontSize: '0.75rem', color: isOnline(partner?.last_seen) ? '#008b5e' : '#666', fontWeight: '600'}}>
                  {partner?.last_seen 
                    ? (isOnline(partner?.last_seen) 
                      ? t('online') 
                      : `${t('active')} ${getRelativeTime(partner?.last_seen, lang)}`)
                    : t('offline')}
                </div>
              </div>
            </div>
            <div style={{width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: '#eee'}}>
              <img src={chat.listing?.images?.[0]} alt="Listing" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
            </div>
          </div>

          {/* Messages area */}
          <div className={styles.messages}>
            {messages.map((msg, i) => (
              <div key={i} className={`${styles.messageRow} ${msg.sender_id === user?.id ? styles.sent : styles.received}`}>
                <div className={styles.bubble}>
                  {msg.image_url && (
                    <div className={styles.imageMessageWrapper}>
                      <img src={msg.image_url} alt="Shared" className={styles.msgImg} onClick={() => setPreviewImage(msg.image_url)} />
                    </div>
                  )}
                  {msg.content && <p className={styles.bubbleText}>{msg.content}</p>}
                  <span className={styles.msgTime}>{getRelativeTime(msg.created_at, lang)}</span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form className={styles.inputArea} onSubmit={handleSend}>
            <label className={styles.uploadBtn}>
              <input type="file" hidden accept=".jpg,.jpeg,.png,.webp" onChange={handleImageUpload} disabled={sending} />
              <Camera size={22} />
            </label>
            <div className={styles.inputWrapper}>
              <input 
                ref={chatInputRef}
                type="text" 
                className={styles.input} 
                placeholder={t('typeMessage')}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
              />
            </div>
            <button type="submit" className={styles.sendBtn} disabled={sending || (!newMessage.trim())}>
              {sending ? <Loader2 className="spinner" size={18} /> : <Send size={20} />}
            </button>
          </form>
        </div>

        {/* Image Preview Modal */}
        {previewImage && (
          <div className={styles.lightbox} onClick={closeLightbox}>
            <div className={styles.lightboxContent} onClick={e => e.stopPropagation()}>
              <img 
                src={previewImage} 
                alt="Preview" 
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                  transition: zoomScale === 1 ? 'transform 0.2s ease' : 'none',
                  touchAction: zoomScale > 1 ? 'none' : 'auto',
                  maxHeight: '85vh',
                  maxWidth: '95vw',
                  objectFit: 'contain'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
              <button className={styles.closeLightbox} onClick={closeLightbox}>×</button>
            </div>
          </div>
        )}
      </div>
    );
  } catch (err) {
    return (
      <div className="container" style={{ padding: '5rem 1rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', marginTop: '2rem' }}>
        <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Render Error in Chat Page:</h3>
        <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{err.stack || err.message}</pre>
      </div>
    );
  }
}
