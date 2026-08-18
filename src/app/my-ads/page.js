'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { getRelativeTime, formatPrice } from '../../lib/utils';
import styles from './my-ads.module.css';
import { Trash2, Edit, X, AlertTriangle } from 'lucide-react';

export default function MyAds() {
  const { t, lang } = useLanguage();
  const [listings, setListings] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, title }
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      fetchMyAds(session.user.id);
    };
    checkUser();
  }, [router]);

  const fetchMyAds = async (userId) => {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });
    
    let dbAds = data || [];
    let myAdsList = dbAds.filter(ad => ad.user_id === userId);

    try {
      const publicAds = JSON.parse(localStorage.getItem('bikroynow_public_ads') || '[]');
      if (publicAds.length > 0) {
        const existingIds = new Set(myAdsList.map(item => item.id));
        const extraAds = publicAds.filter(ad => !existingIds.has(ad.id) && ad.status !== 'deleted');
        myAdsList = [...extraAds, ...myAdsList];
      }
    } catch (e) {
      console.error(e);
    }

    setListings(myAdsList);
    setLoading(false);
  };

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const confirmDelete = (ad) => {
    setDeleteTarget({ id: ad.id, title: ad.title });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setDeleting(false); return; }

      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('user_id', session.user.id);

      if (error) {
        console.error('Delete error:', error);
        showToast('error', 'Delete failed: ' + error.message);
      } else {
        setListings(prev => prev.filter(ad => ad.id !== deleteTarget.id));
        showToast('success', t('deleteSuccess') || 'Ad deleted successfully!');
      }
    } catch (err) {
      console.error('Delete exception:', err);
      showToast('error', 'Error: ' + err.message);
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  if (loading) return <div className="container" style={{padding: '5rem 0', textAlign: 'center'}}>{t('loading')}</div>;

  return (
    <div className={styles.adsWrapper}>
      <div className="container">
        <div className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>{t('myAds')}</h2>
            <p style={{fontSize: '0.8rem', color: '#666'}}>{t('loggedInAs')} {user?.email}</p>
          </div>
          <Link href="/post-ad" className="btn-primary" style={{padding: '0.6rem 1.2rem', borderRadius: '8px', fontSize: '0.9rem'}}>
            {t('postAd')}
          </Link>
        </div>

        <div className={styles.adGrid}>
          {listings.length > 0 ? (
            listings.map((ad) => (
              <div key={ad.id} className={styles.adCard} style={{ position: 'relative', zIndex: 1 }}>
                <Link href={`/ad/${ad.id}`}>
                  <div className={styles.imageBox}>
                    <img 
                      src={ad.images[0] || 'https://via.placeholder.com/300x200?text=No+Image'} 
                      alt={ad.title} 
                    />
                  </div>
                </Link>
                <div className={styles.adInfo}>
                  <Link href={`/ad/${ad.id}`}>
                    <h3 className={styles.adTitle}>{ad.title}</h3>
                  </Link>
                  <div className={styles.adPrice}>{formatPrice(ad.price, lang)}</div>
                  
                  <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{getRelativeTime(ad.created_at, lang)}</div>
                    {ad.status === 'pending' ? (
                      <span style={{ background: '#fef3c7', color: '#d97706', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                        {lang === 'bn' ? 'পেন্ডিং' : 'Pending'}
                      </span>
                    ) : (
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                        {lang === 'bn' ? 'অ্যাক্টিভ' : 'Active'}
                      </span>
                    )}
                  </div>
                  <div className={styles.actions} style={{ position: 'relative', zIndex: 50 }}>
                    <Link href={`/edit-ad/${ad.id}`} className={styles.editBtn}>
                      <Edit size={16} /> {t('edit')}
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        confirmDelete(ad);
                      }}
                      className={styles.deleteBtn}
                      style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
                    >
                      <Trash2 size={16} /> {t('delete')}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.noAds}>{t('noAdsPosted')}</div>
          )}
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '2rem',
            maxWidth: '360px', width: '100%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: '#fee2e2', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 1rem'
            }}>
              <AlertTriangle size={28} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111' }}>
              {lang === 'bn' ? 'ডিলিট করবেন?' : 'Delete Ad?'}
            </h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              <strong>"{deleteTarget.title}"</strong><br/>
              {lang === 'bn' ? 'এই বিজ্ঞাপনটি স্থায়ীভাবে মুছে যাবে।' : 'This ad will be permanently deleted.'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '10px',
                  border: '1px solid #e5e7eb', background: 'white',
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
                  color: '#4b5563'
                }}
              >
                {lang === 'bn' ? 'না' : 'No'}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '10px',
                  border: 'none', background: deleting ? '#fca5a5' : '#dc2626',
                  color: 'white', fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem', transition: 'background 0.2s'
                }}
              >
                {deleting ? '...' : (lang === 'bn' ? 'হ্যাঁ' : 'Yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '5rem', left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#16a34a' : '#dc2626',
          color: 'white', padding: '0.75rem 1.5rem', borderRadius: '10px',
          fontWeight: 600, fontSize: '0.95rem', zIndex: 10000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)', whiteSpace: 'nowrap'
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
