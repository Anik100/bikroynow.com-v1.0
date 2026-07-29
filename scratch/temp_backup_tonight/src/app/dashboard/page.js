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
        .order('created_at', { ascending: false });
        
      setMyAds(ads || []);
      setLoading(false);
    };

    fetchUserAndAds();
  }, [router]);

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this ad?')) {
      await supabase.from('listings').delete().eq('id', id);
      setMyAds(myAds.filter(ad => ad.id !== id));
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

        <div className={styles.adList}>
          {myAds.length === 0 ? (
            <div className={styles.emptyState}>
              <p>You haven't posted any ads yet.</p>
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
