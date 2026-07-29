'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import styles from './membership.module.css';
import { CheckCircle2, Award, Briefcase, Zap, AlertCircle, Copy, Check, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { uploadToImgBB } from '../../lib/imgbb';

const ICON_MAP = {
  zap: Zap,
  award: Award,
  briefcase: Briefcase,
};

const COLOR_MAP = {
  silver: { icon: '#718096', name: '#4a5568', btn: styles.btnSilver },
  gold:   { icon: '#d69e2e', name: '#d69e2e', btn: styles.btnGold },
  business: { icon: '#2b6cb0', name: '#2b6cb0', btn: styles.btnBusiness },
};

export default function MembershipBackup() {
  const { lang } = useLanguage();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Checkout Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('bkash');
  const [bkashNumber, setBkashNumber] = useState('01700000000');
  const [nagadNumber, setNagadNumber] = useState('01800000000');
  
  // Form input states
  const [userEmail, setUserEmail] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEmailReadOnly, setIsEmailReadOnly] = useState(false);

  // Listing selection & custom gateways states
  const [userListings, setUserListings] = useState([]);
  const [selectedListingId, setSelectedListingId] = useState('');
  const [bkashType, setBkashType] = useState('Personal');
  const [nagadType, setNagadType] = useState('Personal');

  useEffect(() => {
    fetchPackagesAndSettings();
    checkUserSession();
  }, []);

  const fetchPackagesAndSettings = async () => {
    setLoading(true);
    try {
      const { data: pkgData } = await supabase
        .from('membership_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (pkgData) {
        setPackages(pkgData);
      }

      const { data: settingsData } = await supabase
        .from('admin_settings')
        .select('*');
      if (settingsData) {
        const bkash = settingsData.find(s => s.key === 'bkash_number');
        const bkType = settingsData.find(s => s.key === 'bkash_type');
        const nagad = settingsData.find(s => s.key === 'nagad_number');
        const ngType = settingsData.find(s => s.key === 'nagad_type');
        if (bkash) setBkashNumber(bkash.value);
        if (bkType) setBkashType(bkType.value);
        if (nagad) setNagadNumber(nagad.value);
        if (ngType) setNagadType(ngType.value);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
    setLoading(false);
  };

  const checkUserSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      setUserEmail(session.user.email);
      setIsEmailReadOnly(true);
      try {
        const { data: listings } = await supabase
          .from('listings')
          .select('id, title')
          .eq('user_id', session.user.id)
          .order('title', { ascending: true });
        if (listings) {
          setUserListings(listings);
          if (listings.length > 0) {
            setSelectedListingId(listings[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching user listings:', err);
      }
    }
  };

  return (
    <div className={styles.container}>
      <h2>Backup Membership Page</h2>
    </div>
  );
}
