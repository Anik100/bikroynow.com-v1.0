'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import Link from 'next/link';
import styles from './dashboard.module.css';
import { Edit, Trash2, Eye } from 'lucide-react';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [myAds, setMyAds] = useState([]);
  const [monthlyQuotaUsed, setMonthlyQuotaUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUserAndAds = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      const { data: ads } = await supabase
        .from('listings')
        .select('*')
        .eq('user_id', session.user.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });
        
      setMyAds(ads || []);

      // Calculate monthly quota used (including deleted ads)
      try {
        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
        const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

        const { data: monthAds } = await supabase
          .from('listings')
          .select('id, created_at, status')
          .eq('user_id', session.user.id)
          .gte('created_at', startOfMonth);

        const listCount = Array.isArray(monthAds) ? monthAds.length : 0;

        const { data: auditData } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', `ad_usage_${monthKey}_${session.user.id}`)
          .maybeSingle();

        let auditCount = 0;
        if (auditData?.value) {
          try {
            const parsed = JSON.parse(auditData.value);
            auditCount = parseInt(parsed.count || 0, 10) || 0;
          } catch (_) {
            auditCount = parseInt(auditData.value || 0, 10) || 0;
          }
        }
        setMonthlyQuotaUsed(Math.max(listCount, auditCount));
      } catch (e) {}

      setLoading(false);
    };

    fetchUserAndAds();
  }, [router]);

  const handleDelete = async (id) => {
    if (confirm('বিজ্ঞাপন ডিলিট করবেন?\n\n⚠️ মনে রাখবেন: বিজ্ঞাপন ডিলিট করলেও আপনার চলতি মাসের ৫টি ফ্রি বিজ্ঞাপনের কোটা পুনরুদ্ধার হবে না।')) {
      const targetId = String(id);
      try {
        const deletedIds = JSON.parse(localStorage.getItem('bikroynow_deleted_ad_ids') || '[]').map(String);
        if (!deletedIds.includes(targetId)) {
          deletedIds.push(targetId);
          localStorage.setItem('bikroynow_deleted_ad_ids', JSON.stringify(deletedIds));
        }
        const pending = JSON.parse(localStorage.getItem('bikroynow_user_pending_ads') || '[]');
        localStorage.setItem('bikroynow_user_pending_ads', JSON.stringify(pending.filter(a => a && String(a.id) !== targetId)));
        const pub = JSON.parse(localStorage.getItem('bikroynow_public_ads') || '[]');
        localStorage.setItem('bikroynow_public_ads', JSON.stringify(pub.filter(a => a && String(a.id) !== targetId)));
      } catch (e) {}

      try {
        await fetch(`/api/listings?id=${encodeURIComponent(targetId)}`, { method: 'DELETE' });
      } catch (e) {}

      try {
        await supabase.from('listings').update({ status: 'deleted' }).eq('id', targetId);
      } catch (e) {}

      setMyAds(prev => prev.filter(ad => String(ad.id) !== targetId));
    }
  };

  if (loading) return <div className="container" style={{padding: '5rem 0', textAlign: 'center'}}>Loading dashboard...</div>;

  return (
    <div className={`container ${styles.dashboardContainer}`}>
      <div className={styles.sidebar}>
        <div className={styles.userCard}>
          <h3>My Account</h3>
          <p>{user?.email}</p>
        </div>
        <nav className={styles.navMenu}>
          <a href="#" className={styles.active}>My Ads</a>
          <a href="#">Settings</a>
        </nav>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.header}>
          <div>
            <h2>My Ads ({myAds.length})</h2>
            <p style={{fontSize: '0.8rem', color: '#666', marginTop: '4px'}}>Showing ads for: {user?.email}</p>
          </div>
          <Link href="/post-ad" className="btn-primary">Post New Ad</Link>
        </div>

        {/* Free Monthly Ads Quota Card */}
        <div style={{
          background: monthlyQuotaUsed >= 5 ? '#fef2f2' : '#f0fdf4',
          border: `1.5px solid ${monthlyQuotaUsed >= 5 ? '#fca5a5' : '#bbf7d0'}`,
          borderRadius: '12px',
          padding: '0.9rem 1.2rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: monthlyQuotaUsed >= 5 ? '#991b1b' : '#166534' }}>
              💡 চলতি মাসের ফ্রি বিজ্ঞাপন কোটা: {monthlyQuotaUsed}/৫ ব্যবহৃত
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              ⚠️ বিজ্ঞাপন ডিলিট করলেও মাসিক ফ্রি কোটা পুনরুদ্ধার হয় না।
            </div>
          </div>
          {monthlyQuotaUsed >= 5 ? (
            <Link
              href="/membership"
              style={{
                background: '#dc2626',
                color: '#fff',
                padding: '0.4rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 700,
                textDecoration: 'none'
              }}
            >
              মেম্বারশিপ আপগ্রেড করুন
            </Link>
          ) : (
            <span style={{
              background: '#008b5e',
              color: '#fff',
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: 800
            }}>
              বাকি আছে {5 - monthlyQuotaUsed}টি
            </span>
          )}
        </div>

        <div className={styles.adList}>
          {myAds.length === 0 ? (
            <div className={styles.emptyState}>
              <p>You haven&apos;t posted any ads yet.</p>
            </div>
          ) : (
            myAds.map(ad => (
              <div key={ad.id} className={styles.adItem}>
                <div className={styles.adImage}>
                  <img src={ad.images[0] || 'https://via.placeholder.com/150'} alt={ad.title} />
                </div>
                <div className={styles.adInfo}>
                  <h3>{ad.title}</h3>
                  <p className={styles.price}>Tk {ad.price.toLocaleString()}</p>
                  <p className={styles.meta}>Status: <span className={styles[ad.status]}>{ad.status}</span></p>
                </div>
                <div className={styles.adActions}>
                  <Link href={`/ad/${ad.id}`} className={styles.actionBtn} title="View">
                    <Eye size={18} />
                  </Link>
                  <button className={styles.actionBtn} title="Edit">
                    <Edit size={18} />
                  </button>
                  <button className={styles.actionBtnDelete} onClick={() => handleDelete(ad.id)} title="Delete">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
