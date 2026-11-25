'use client';

import { useState, useEffect } from 'react';
import { X, Download, Smartphone, Share, PlusSquare, MoreVertical, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  initPWAInstallListener,
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

  if (!mounted || !visible || isStandalone() || isPWAInstalled()) {
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
              ) : (
                <>
                  <div style={{ marginBottom: '14px', padding: '12px', background: '#ecfdf5', borderRadius: '12px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#065f46', fontWeight: 600 }}>
                      {lang === 'bn' ? 'সরাসরি মোবাইলে অফিসিয়াল অ্যাপ ইনস্টল করুন:' : 'Install the official Android app directly:'}
                    </p>
                    <a
                      href="/BikroyNow.apk"
                      download="BikroyNow.apk"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: '#059669',
                        color: 'white',
                        padding: '10px 18px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                      onClick={() => {
                        setShowManualModal(false);
                        dismissInstallPopup();
                        setVisible(false);
                      }}
                    >
                      <Download size={18} />
                      {lang === 'bn' ? 'Android APK ডাউনলোড করুন (54 MB)' : 'Download Android APK'}
                    </a>
                  </div>

                  <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: '#64748b', textAlign: 'center' }}>
                    {lang === 'bn' ? '— অথবা ব্রাউজার থেকে ইনস্টল করুন —' : '— OR Install from browser menu —'}
                  </p>
                  <div className={styles.stepList}>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>১</span>
                      <span>ব্রাউজারের উপরে/নিচে <strong>৩-ডট (⋮) <MoreVertical size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></strong> মেনুতে চাপ দিন</span>
                    </div>
                    <div className={styles.stepItem}>
                      <span className={styles.stepBadge}>২</span>
                      <span><strong>&quot;Install app&quot;</strong> অথবা <strong>&quot;Add to Home screen&quot;</strong> চাপুন</span>
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
