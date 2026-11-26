'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Reply, ChevronDown } from 'lucide-react';
import styles from './InAppNotificationBanner.module.css';

export default function InAppNotificationBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const handleIncomingMsg = (e) => {
      const data = e.detail;
      if (!data) return;

      // Do not display banner if user is currently inside this exact conversation
      if (data.chatId && pathname === `/chat/${data.chatId}`) {
        return;
      }

      setNotification({
        senderName: data.senderName || 'BikroyNow',
        content: data.content || 'রিপ্লাই...',
        chatId: data.chatId || null,
        unreadCount: data.unreadCount || 1,
        timestamp: Date.now()
      });
    };

    window.addEventListener('bikroynow_incoming_msg', handleIncomingMsg);
    return () => {
      window.removeEventListener('bikroynow_incoming_msg', handleIncomingMsg);
    };
  }, [pathname]);

  // Auto-dismiss after 6.5 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 6500);
    return () => clearTimeout(timer);
  }, [notification]);

  if (!notification) return null;

  const handleClick = () => {
    const targetUrl = notification.chatId ? `/chat/${notification.chatId}` : '/chat';
    setNotification(null);
    router.push(targetUrl);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    setNotification(null);
  };

  const initial = notification.senderName ? notification.senderName.charAt(0).toUpperCase() : 'B';

  return (
    <div className={styles.cardWrapper} onClick={handleClick} role="alert" aria-live="assertive">
      {/* Decorative Bottom-Left Orange Gradient Curve matching design */}
      <div className={styles.orangeWaveAccent} />

      {/* 1. App Icon with Red Count Badge */}
      <div className={styles.appIconWrap}>
        <div className={styles.appIcon}>
          <svg className={styles.smileyFace} viewBox="0 0 24 12" xmlns="http://www.w3.org/2000/svg">
            <circle cx="5" cy="3" r="1.5" fill="#ffffff" />
            <circle cx="19" cy="3" r="1.5" fill="#ffffff" />
            <path d="M 4 7 Q 12 14 20 7" stroke="#ffffff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </svg>
          <span className={styles.nowText}>NOW</span>
        </div>
        {notification.unreadCount > 0 && (
          <div className={styles.badgeCircle}>
            {notification.unreadCount > 99 ? '99+' : notification.unreadCount}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* 2. Center Content */}
      <div className={styles.centerInfo}>
        <div className={styles.brandRow}>
          <span className={styles.brandName}>
            Bikroy<span className={styles.brandNow}>Now</span>
          </span>
          <span className={styles.timeSnippet}>• now</span>
        </div>

        <div className={styles.senderRow}>
          <div className={styles.avatarCircle}>{initial}</div>
          <span className={styles.senderName}>{notification.senderName}</span>
        </div>

        <p className={styles.messageBody}>{notification.content}</p>
      </div>

      {/* 3. Right Side: Dismiss Arrow & Orange Reply Capsule */}
      <div className={styles.rightSide}>
        <div className={styles.topIconsRow}>
          <span className={styles.sparksIcon}>\|/</span>
          <button className={styles.closeBtn} onClick={handleDismiss} title="Dismiss">
            <ChevronDown size={14} />
          </button>
        </div>

        <div className={styles.replyCapsule} title="রিপ্লাই">
          <div className={styles.replyCircle}>
            <Reply size={16} strokeWidth={2.8} />
          </div>
        </div>
      </div>
    </div>
  );
}
