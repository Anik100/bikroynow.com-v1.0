'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  initPWAInstallListener,
  isNativeApp,
  isStandalone,
  isPWAInstalled,
  canShowInstallPopup,
  dismissInstallPopup,
  markPWAInstalled,
  promptPWAInstall,
  isAndroid
} from '../lib/pwaInstall';
import styles from './AppInstallBanner.module.css';

export default function AppInstallBanner() {
  const { lang } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    initPWAInstallListener();

    // Determine initial visibility
    if (canShowInstallPopup()) {
      // Small 800ms delay so page paints smoothly first
      const timer = setTimeout(() => {
        if (canShowInstallPopup()) {
          setVisible(true);
        }
      }, 800);
      return () => clearTimeout(timer);
    }

    // Periodic check in case 10-minute dismissal period expires while on page
    const interval = setInterval(() => {
      if (canShowInstallPopup()) {
        setVisible(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const handlePromptReady = () => {
      if (canShowInstallPopup()) {
        setVisible(true);
      }
    };

    const handleCanInstall = () => {
      if (canShowInstallPopup()) {
        setVisible(true);
      }
    };

    const handleAppInstalled = () => {
      markPWAInstalled();
      setVisible(false);
    };

    window.addEventListener('pwa_prompt_ready', handlePromptReady);
    window.addEventListener('pwa_can_install', handleCanInstall);
    window.addEventListener('pwa_installed', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa_prompt_ready', handlePromptReady);
      window.removeEventListener('pwa_can_install', handleCanInstall);
      window.removeEventListener('pwa_installed', handleAppInstalled);
    };
  }, [mounted]);

  // Corner Close (X) Click: Dismiss for 10 minutes
  const handleClose = (e) => {
    e.stopPropagation();
    dismissInstallPopup();
    setVisible(false);
  };

  // Install Button Click: DIRECT 1-click installation without ANY intermediate modal!
  const handleInstall = async () => {
    // If user is browsing on Android phone, clicking Install directly delivers the official Android APK
    if (isAndroid()) {
      markPWAInstalled();
      window.location.href = '/BikroyNow.apk';
      setVisible(false);
      return;
    }

    // On PC / Laptop / Desktop: Trigger 1-click browser install directly
    const res = await promptPWAInstall({
      onAccepted: () => {
        markPWAInstalled();
        setVisible(false);
      }
    });

    if (res?.success) {
      markPWAInstalled();
      setVisible(false);
      if (res.alreadyInstalled) {
        alert(lang === 'bn' 
          ? 'BikroyNow অ্যাপটি আপনার কম্পিউটারে ইনস্টল করা রয়েছে! ✓\nডেস্কটপ শর্টকাট অথবা ব্রাউজারের অ্যাড্রেস বার থেকে সরাসরি ওপেন করতে পারেন।' 
          : 'BikroyNow app is already installed on your computer! ✓');
      }
    }
  };

  if (!mounted || !visible || isNativeApp() || isStandalone() || isPWAInstalled()) {
    return null;
  }

  return (
    <div className={styles.bannerWrapper} role="banner" aria-label="Install App">
      {/* Corner Close Cross Button */}
      <button
        className={styles.closeBtn}
        onClick={handleClose}
        aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
        title={lang === 'bn' ? 'কেটে দিন' : 'Dismiss'}
      >
        <X size={17} strokeWidth={2.8} />
      </button>

      {/* App Icon Thumbnail */}
      <div className={styles.appIconBox}>
        <img
          src="/apple-touch-icon.png"
          alt="BikroyNow"
          className={styles.appIconImg}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/icon-192.png';
          }}
        />
      </div>

      {/* App Title & Subtitle */}
      <div className={styles.contentArea}>
        <h4 className={styles.title}>
          BikroyNow {lang === 'bn' ? 'অ্যাপ' : 'App'}
        </h4>
        <p className={styles.subtitle}>
          {lang === 'bn' ? 'সহজ ও দ্রুত ব্যবহারে ইনস্টল করুন' : 'Install for fastest experience'}
        </p>
      </div>

      {/* Install CTA Button */}
      <button className={styles.installBtn} onClick={handleInstall}>
        <Download size={14} />
        <span>{lang === 'bn' ? 'ইনস্টল' : 'Install'}</span>
      </button>
    </div>
  );
}
