'use client';

import { useState, useEffect } from 'react';
import { X, Download, Smartphone, Share, PlusSquare, MoreVertical, CheckCircle2 } from 'lucide-react';
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
  isIOS,
  isAndroid
} from '../lib/pwaInstall';
import styles from './AppInstallBanner.module.css';

export default function AppInstallBanner() {
  const { lang } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

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
      setVisible(false);
      setShowManualModal(false);
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

  // Install Button Click
  const handleInstall = async () => {
    // If user is browsing on Android, clicking Install directly delivers the official Android APK
    if (isAndroid()) {
      window.location.href = '/BikroyNow.apk';
      setVisible(false);
      return;
    }

    const res = await promptPWAInstall({
      onAccepted: () => {
        setVisible(false);
      },
      onFallback: () => {
        setShowManualModal(true);
      }
    });

    if (res?.success && res.outcome === 'accepted') {
      setVisible(false);
    }
  };

  if (!mounted || !visible || isNativeApp() || isStandalone() || isPWAInstalled()) {
    return null;
  }

  const isApple = typeof window !== 'undefined' && isIOS();

  return (
    <>
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

      {/* Manual Instructions Modal if browser cannot auto-prompt (e.g. iOS or older browsers) */}
      {showManualModal && (
        <div className={styles.modalOverlay} onClick={() => setShowManualModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.modalCloseBtn}
              onClick={() => setShowManualModal(false)}
            >
              <X size={20} />
            </button>

            <div className={styles.modalHeader}>
              <div className={styles.appIconBox} style={{ width: 40, height: 40 }}>
                <img src="/apple-touch-icon.png" alt="BikroyNow" className={styles.appIconImg} />
              </div>
              <h3 className={styles.modalTitle}>
                {lang === 'bn' ? 'অ্যাপটি ইনস্টল করুন' : 'Install BikroyNow'}
              </h3>
            </div>

            <div className={styles.modalBody}>
              {isApple ? (
                <>
                  <p style={{ margin: '0 0 10px 0' }}>
                    {lang === 'bn'
                      ? 'আইফোন বা আইপ্যাডে সহজেই অ্যাপটি হোম স্ক্রিনে যোগ করুন:'
                      : 'To install on iPhone / iPad, follow these simple steps:'}
                  </p>
                  <div className={styles.stepList}>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>১</span>
                      <span>Safari ব্রাউজারের নিচে <strong>Share <Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></strong> বাটনে চাপ দিন</span>
                    </div>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>২</span>
                      <span>মেনু স্ক্রোল করে <strong>&quot;Add to Home Screen&quot; <PlusSquare size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></strong> নির্বাচন করুন</span>
                    </div>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>৩</span>
                      <span>উপরে ডানপাশে <strong>&quot;Add&quot;</strong> বাটনে ট্যাপ করুন</span>
                    </div>
                  </div>
                </>
              ) : isAndroid() ? (
                <>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: '#1e293b', fontWeight: 600 }}>
                    {lang === 'bn'
                      ? 'ব্রাউজার মেনু থেকে সরাসরি অ্যাপ ইনস্টল করুন:'
                      : 'Install app directly from your browser menu:'}
                  </p>
                  <div className={styles.stepList}>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>১</span>
                      <span>ব্রাউজারের উপরে ডানপাশে <strong>৩-ডট (⋮) <MoreVertical size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></strong> মেনুতে চাপ দিন</span>
                    </div>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>২</span>
                      <span>মেনুর তালিকা থেকে <strong>&quot;Install app&quot;</strong> (বা <strong>&quot;Add to Home screen&quot;</strong>) চাপুন</span>
                    </div>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>৩</span>
                      <span><strong>&quot;Install&quot;</strong> ট্যাপ করলেই BikroyNow অ্যাপটি ফোনে ইনস্টল হয়ে যাবে</span>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed #cbd5e1', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.82rem', color: '#64748b' }}>
                      {lang === 'bn' ? 'অথবা সরাসরি অফিসিয়াল অ্যান্ড্রয়েড অ্যাপ ডাউনলোড করুন:' : 'Or download the official Android APK directly:'}
                    </p>
                    <a
                      href="/BikroyNow.apk"
                      download="BikroyNow.apk"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#0284c7',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        padding: '9px 18px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      <Download size={15} />
                      <span>{lang === 'bn' ? 'BikroyNow.apk ডাউনলোড করুন (অফিসিয়াল অ্যাপ)' : 'Download BikroyNow.apk (Official App)'}</span>
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: '#1e293b', fontWeight: 600 }}>
                    {lang === 'bn'
                      ? 'কম্পিউটারে আলাদা উইন্ডো অ্যাপ হিসেবে ইনস্টল করুন:'
                      : 'Install as standalone desktop app window:'}
                  </p>
                  <div className={styles.stepList}>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>১</span>
                      <span>ব্রাউজারের অ্যাড্রেস বারের ডানপাশে থাকা <strong>ইনস্টল আইকন <Download size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></strong> এ ক্লিক করুন</span>
                    </div>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>২</span>
                      <span>অথবা ৩-ডট <strong>(⋮) <MoreVertical size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></strong> মেনু থেকে <strong>&quot;Install BikroyNow&quot;</strong> বেছে নিন</span>
                    </div>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>৩</span>
                      <span><strong>&quot;Install&quot;</strong> বাটনে চাপলেই ডেস্কটপ ও টাস্কবারে আলাদা কম্পিউটার অ্যাপ তৈরি হয়ে যাবে</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              className={styles.modalDoneBtn}
              onClick={() => {
                setShowManualModal(false);
                dismissInstallPopup();
                setVisible(false);
              }}
            >
              {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
