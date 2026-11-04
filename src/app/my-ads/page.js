'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';
import { getRelativeTime, formatPrice } from '../../lib/utils';
import styles from './my-ads.module.css';
import { Trash2, Edit, X, AlertTriangle, PlusCircle } from 'lucide-react';

export default function MyAds() {
  const { t, lang } = useLanguage();
  const [listings, setListings] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, title }
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }
  const router = useRouter();

  const fetchMyAds = async (targetUser) => {
    try {
      const active = targetUser || user;
      const userId = active?.id;
      const userEmail = active?.email;
      let myAdsList = [];

      let deletedIds = new Set();
      try {
        const storedDeleted = JSON.parse(localStorage.getItem('bikroynow_deleted_ad_ids') || '[]');
        deletedIds = new Set(storedDeleted.map(String));
      } catch (e) {}

      // 1. Try fetching from server listings API with user parameters & cache busting
      try {
        const params = new URLSearchParams({
          t: String(Date.now()),
          include_pending: 'true'
        });
        if (userId) params.set('user_id', String(userId));
        if (userEmail) params.set('user_email', String(userEmail));

        const apiRes = await fetch(`/api/listings?${params.toString()}`, { cache: 'no-store' });
        if (apiRes.ok) {
          const apiJson = await apiRes.json();
          if (Array.isArray(apiJson.listings)) {
            myAdsList = apiJson.listings.filter(ad => !deletedIds.has(String(ad.id)) && ad.status !== 'deleted');
          }
        }
      } catch (e) {
        console.error('Error fetching my ads from API:', e);
      }

      // 2. Direct Supabase query fallback if API returned empty
      if (myAdsList.length === 0 && userId) {
        try {
          const { data } = await supabase
            .from('listings')
            .select('*')
            .eq('user_id', userId)
            .neq('status', 'deleted')
            .order('created_at', { ascending: false });
          if (data && Array.isArray(data)) {
            myAdsList = data.filter(ad => !deletedIds.has(String(ad.id)));
          }
        } catch (e) {}
      }

      // 3. Local pending/demo ads fallback
      try {
        const publicAds = JSON.parse(localStorage.getItem('bikroynow_user_pending_ads') || '[]');
        if (publicAds.length > 0) {
          const existingIds = new Set(myAdsList.map(item => String(item.id)));
          const extraAds = publicAds.filter(ad => {
            if (!ad || !ad.id) return false;
            const idStr = String(ad.id);
            if (deletedIds.has(idStr) || ad.status === 'deleted') return false;
            if (existingIds.has(idStr)) return false;
            if (userId && ad.user_id && String(ad.user_id) !== String(userId)) return false;
            return true;
          });
          myAdsList = [...extraAds, ...myAdsList];
        }
      } catch (e) {}

      // Final deduplication and deleted filter
      const seen = new Set();
      const finalAds = [];
      for (const ad of myAdsList) {
        if (!ad || !ad.id) continue;
        const idStr = String(ad.id);
        if (deletedIds.has(idStr) || ad.status === 'deleted') continue;
        if (!seen.has(idStr)) {
          seen.add(idStr);
          finalAds.push(ad);
        }
      }

      setListings(finalAds);
    } catch (err) {
      console.error('Error fetching my ads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const checkUser = async () => {
      let activeUser = null;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        activeUser = session.user;
      } else {
        try {
          const localUser = localStorage.getItem('bikroynow_demo_user');
          if (localUser) activeUser = JSON.parse(localUser);
        } catch (e) {}
      }

      if (!activeUser) {
        // Grace period for mobile storage restoration
        await new Promise(r => setTimeout(r, 350));
        const retry = await supabase.auth.getSession();
        if (retry.data.session?.user) activeUser = retry.data.session.user;
      }

      if (!activeUser) {
        if (!isCancelled) router.push('/login');
        return;
      }

      if (!isCancelled) {
        setUser(activeUser);
        fetchMyAds(activeUser);
      }
    };

    checkUser();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const confirmDelete = (ad) => {
    setDeleteTarget({ id: ad.id, title: ad.title });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const targetId = String(deleteTarget.id);
    setDeleting(true);

    try {
      // 1. Immediately record in localStorage deleted blacklist so it NEVER resurfaces
      try {
        const deletedIds = JSON.parse(localStorage.getItem('bikroynow_deleted_ad_ids') || '[]').map(String);
        if (!deletedIds.includes(targetId)) {
          deletedIds.push(targetId);
          localStorage.setItem('bikroynow_deleted_ad_ids', JSON.stringify(deletedIds));
        }
      } catch (e) {}

      // 2. Remove permanently from bikroynow_user_pending_ads in localStorage
      try {
        const pending = JSON.parse(localStorage.getItem('bikroynow_user_pending_ads') || '[]');
        const updatedPending = pending.filter(a => a && String(a.id) !== targetId);
        localStorage.setItem('bikroynow_user_pending_ads', JSON.stringify(updatedPending));
      } catch (e) {}

      // 3. Remove permanently from bikroynow_public_ads in localStorage
      try {
        const pub = JSON.parse(localStorage.getItem('bikroynow_public_ads') || '[]');
        const updatedPub = pub.filter(a => a && String(a.id) !== targetId);
        localStorage.setItem('bikroynow_public_ads', JSON.stringify(updatedPub));
      } catch (e) {}

      // 4. Call server DELETE API (permanently removes from listings_data.json, in-memory cache, and Supabase via service role)
      try {
        await fetch(`/api/listings?id=${encodeURIComponent(targetId)}`, {
          method: 'DELETE'
        });
      } catch (apiErr) {
        console.error('API delete error:', apiErr);
      }

      // 5. Also delete directly from Supabase via client session if authorized
      try {
        await supabase
          .from('listings')
          .delete()
          .eq('id', targetId);
      } catch (sbErr) {}

      // 6. Delete from featured ads
      try {
        await fetch(`/api/admin/featured-ads?listing_id=${encodeURIComponent(targetId)}`, {
          method: 'DELETE'
        });
      } catch (e) {}

      // 7. Update UI state instantly
      setListings(prev => prev.filter(ad => String(ad.id) !== targetId));
      showToast('success', t('deleteSuccess') || 'Ad deleted successfully!');
    } catch (err) {
      console.error('Delete exception:', err);
      showToast('error', 'Error: ' + err.message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) return <div className="container" style={{padding: '5rem 0', textAlign: 'center'}}>{t('loading')}</div>;

  return (
    <div className={styles.adsWrapper}>
      <div className="container">
        {toast && (
          <div style={{
            position: 'fixed', top: '90px', right: '20px', zIndex: 9999,
            background: toast.type === 'error' ? '#ef4444' : '#10b981',
            color: 'white', padding: '0.8rem 1.2rem', borderRadius: '10px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.15)', fontWeight: 600
          }}>
            {toast.msg}
          </div>
        )}

        <div className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>{t('myAds')}</h2>
            <p style={{fontSize: '0.85rem', color: '#64748b', marginTop: '4px'}}>{t('loggedInAs')} <strong>{user?.email}</strong></p>
          </div>
          <Link href="/post-ad" className="btn-primary" style={{padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.9rem', gap: '0.4rem'}}>
            <PlusCircle size={18} />
            <span>{t('postAd')}</span>
          </Link>
        </div>

        <div className={styles.adGrid}>
          {listings.length > 0 ? (
            listings.map((ad) => (
              <div key={ad.id} className={styles.adCard} style={{ position: 'relative', zIndex: 1 }}>
                <Link href={`/ad/${ad.id}`}>
                  <div className={styles.imageBox}>
                    <img 
                      src={ad.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image'} 
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
                    {ad.is_featured ? (
                      <span style={{ background: 'linear-gradient(135deg, #10b981, #047857)', color: 'white', padding: '0.15rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                        {lang === 'bn' ? '⭐ প্রিমিয়াম স্লাইডার' : '⭐ Premium Slider'}
                      </span>
                    ) : (ad.promotion_type || ad.is_verified) ? (
                      <span style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', padding: '0.15rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                        {lang === 'bn' ? `💎 প্রিমিয়াম (${ad.promotion_type || 'বুস্টেড'})` : `💎 Premium (${ad.promotion_type || 'Boosted'})`}
                      </span>
                    ) : null}
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
              justifyContent: 'center', margin: '0 auto 1rem', color: '#dc2626'
            }}>
              <AlertTriangle size={28} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111' }}>
              {lang === 'bn' ? 'বিজ্ঞাপন ডিলিট করবেন?' : 'Delete Ad?'}
            </h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              &quot;{deleteTarget.title}&quot; {lang === 'bn' ? 'বিজ্ঞাপনটি স্থায়ীভাবে মুছে যাবে।' : 'will be permanently deleted.'}
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
                {lang === 'bn' ? 'না' : 'Cancel'}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '10px',
                  border: 'none', background: '#dc2626',
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
                  color: 'white', opacity: deleting ? 0.7 : 1
                }}
              >
                {deleting ? (lang === 'bn' ? 'মুছছে...' : 'Deleting...') : (lang === 'bn' ? 'হ্যাঁ, ডিলিট' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
