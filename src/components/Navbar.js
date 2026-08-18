'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, MessageCircle, User, PlusCircle, Globe, MapPin, X, Home as HomeIcon, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../context/LanguageContext';
import { LOCATIONS } from '../lib/constants';
import ProfileMenu from './ProfileMenu';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [currentLocation, setCurrentLocation] = useState('All of Bangladesh');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationType, setLocationType] = useState('division'); // 'division' or 'district'

  useEffect(() => {
    if (!showLocationModal) {
      setSelectedDivision(null);
      setLocationType('division');
      setLocationSearch('');
    }
  }, [showLocationModal]);

  const { lang, toggleLanguage, t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);

  // Update last seen
  useEffect(() => {
    if (!user) return;

    const updateLastSeen = async () => {
      try {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', user.id);
      } catch (err) {
        console.error('Error updating last seen:', err);
      }
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  // Fetch unread count and subscribe
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const res = await fetch(`/api/chats/list?user_id=${user.id}&t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.chats)) {
            // Sum unreadCount from all active chat sessions
            const totalUnread = json.chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
            setUnreadCount(totalUnread);
          }
        }
      } catch (err) {
        console.error('Error fetching unread count:', err);
      }
    };

    fetchUnreadCount();

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [user]);

  // Fetch unread support messages count and subscribe
  useEffect(() => {
    if (!user) {
      setUnreadSupportCount(0);
      return;
    }

    const fetchUnreadSupport = async () => {
      try {
        const { data: chat } = await supabase
          .from('support_chats')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (chat) {
          const { count } = await supabase
            .from('support_messages')
            .select('*', { count: 'exact', head: true })
            .eq('support_chat_id', chat.id)
            .neq('sender_id', user.id)
            .eq('is_read', false);

          setUnreadSupportCount(count || 0);
        } else {
          setUnreadSupportCount(0);
        }
      } catch (err) {
        console.error('Error fetching support unread count:', err);
      }
    };

    fetchUnreadSupport();

    const subscription = supabase
      .channel('navbar-support-messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_messages'
      }, () => {
        fetchUnreadSupport();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);


  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        const localUser = localStorage.getItem('bikroynow_demo_user');
        if (localUser) {
          setUser(JSON.parse(localUser));
        } else {
          setUser(null);
        }
      }
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          const localUser = localStorage.getItem('bikroynow_demo_user');
          if (localUser) {
            setUser(JSON.parse(localUser));
          } else {
            setUser(null);
          }
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        setHasAdminAccess(false);
        return;
      }
      if (user.email === 'anikh0000@gmail.com') {
        setHasAdminAccess(true);
        return;
      }
      try {
        const { data } = await supabase.from('admin_settings').select('value').eq('key', 'moderators').single();
        if (data && data.value) {
          const modsList = JSON.parse(data.value);
          if (modsList.some(m => m.email === user.email)) {
            setHasAdminAccess(true);
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
      setHasAdminAccess(false);
    };

    checkAdminAccess();
  }, [user]);

  // Lock body scroll when profile menu is open
  useEffect(() => {
    if (showProfileMenu) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.paddingRight = '0px';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.paddingRight = '';
    };
  }, [showProfileMenu]);

  const handleLocationSelect = (district) => {
    setCurrentLocation(district);
    setShowLocationModal(false);
    setSelectedDivision(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('bikroynow_demo_user');
    setUser(null);
    router.push('/');
    router.refresh();
  };

  return (
    <header className={styles.navbar}>
      <div className={`container ${styles.navContainer}`}>
        <div className={styles.left}>
          <Link href="/" className={styles.logo}>
            Bikroy
            <span className={styles.logoBox}>
              <svg className={styles.logoFace} viewBox="0 0 44 30" xmlns="http://www.w3.org/2000/svg">
                <circle cx="14" cy="8" r="3" fill="white"/>
                <circle cx="30" cy="8" r="3" fill="white"/>
                <path d="M 7 17 Q 22 30 37 17" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
              </svg>
              <span className={styles.logoHut}>NOW</span>
            </span>
            <span className={styles.dotCom}>.com</span>
          </Link>
        </div>

        <div className={styles.right}>
          {hasAdminAccess && (
            <Link href="/admin-dashboard" className={`${styles.postAdBtn} ${styles.adminPanelBtn}`}>
              {lang === 'bn' ? 'অ্যাডমিন প্যানেল' : 'Admin Panel'}
            </Link>
          )}
          <Link href="/post-ad" className={styles.postAdBtn}>
            {t('postAd')}
          </Link>
        </div>
      </div>

      {/* Search section - shown on home page only */}
      {isHomePage && <div className={styles.searchSection}>
          <div className={`container ${styles.searchWrapper}`}>
            <div className={styles.searchRow}>
              <div className={styles.locationSelector} onClick={() => setShowLocationModal(true)}>
                <MapPin size={16} color="#dc2626" />
                <span className={styles.locationText}>{currentLocation === 'All of Bangladesh' ? t('allLocations') : t(currentLocation)}</span>
                <span className={styles.arrowDown}>▼</span>
              </div>
              <div className={styles.searchBar}>
                <input type="text" placeholder={t('searchPlaceholder')} className={styles.searchInput} />
                <button className={styles.searchBtn}>
                  {t('searchBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>}



      {showLocationModal && (
        <div className={styles.darkModalOverlay} onClick={() => setShowLocationModal(false)}>
          <div className={styles.darkModal} onClick={e => e.stopPropagation()}>
            <div className={styles.darkModalHeader}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem'}}>
                <h3 style={{margin: 0, fontSize: '1.2rem', fontWeight: 850}}>{t('selectLocation')}</h3>
                <X style={{cursor: 'pointer'}} onClick={() => setShowLocationModal(false)} />
              </div>
              <input 
                type="text" placeholder={t('searchLoc')} 
                className={styles.darkModalSearch}
                value={locationSearch} onChange={e => setLocationSearch(e.target.value)}
              />
            </div>
            
            <div className={styles.radioList}>
              {locationSearch ? (
                // FLAT SEARCH RESULTS
                Object.entries(LOCATIONS).flatMap(([div, dists]) => {
                  const isDivMatch = div.toLowerCase().includes(locationSearch.toLowerCase());
                  const filtered = dists.filter(d => d.toLowerCase().includes(locationSearch.toLowerCase()));
                  let res = [];
                  if (isDivMatch || filtered.length > 0) {
                    res.push({name: div, type: 'division'});
                    res.push({name: `All of ${div} Division`, type: 'district', parent: div});
                    filtered.forEach(d => res.push({name: d, type: 'district', parent: div}));
                  }
                  return res;
                }).slice(0, 50).map((loc, i) => (
                  <label key={i} className={styles.radioItem}>
                    <div className={styles.locInfo}>
                      <span className={styles.locName}>
                        {t(loc.name)} {loc.type === 'division' ? (lang === 'bn' ? 'বিভাগ' : 'Division') : ''}
                      </span>
                      {loc.parent && <span className={styles.locParent}>{t(loc.parent)}</span>}
                    </div>
                    <input 
                      type="radio" 
                      name="loc" 
                      onChange={() => {
                        handleLocationSelect(loc.name);
                        setLocationSearch('');
                      }} 
                      checked={currentLocation === loc.name} 
                    />
                    <span className={styles.radioCircle}></span>
                  </label>
                ))
              ) : (
                // HIERARCHICAL ACCORDION/TAB VIEW
                <>
                  {/* Always show "All of Bangladesh" at the top */}
                  <label className={styles.radioItem}>
                    <span>{t('allLocations')}</span>
                    <input 
                      type="radio" 
                      name="loc" 
                      onChange={() => handleLocationSelect('All of Bangladesh')} 
                      checked={currentLocation === '' || currentLocation === 'All of Bangladesh'} 
                    />
                    <span className={styles.radioCircle}></span>
                  </label>

                  {locationType === 'division' ? (
                    // DIVISION LIST VIEW
                    Object.keys(LOCATIONS).map(div => (
                      <label key={div} className={styles.radioItem}>
                        <div className={styles.locInfo}>
                          <span className={styles.locName}>
                            {t(div)} {lang === 'bn' ? 'বিভাগ' : 'Division'}
                          </span>
                        </div>
                        <input 
                          type="radio" 
                          name="loc" 
                          onChange={() => {
                            setSelectedDivision(div);
                            setLocationType('district');
                          }}
                          checked={currentLocation === div || (currentLocation.startsWith('All of ') && currentLocation.includes(div))}
                        />
                        <span className={styles.radioCircle}></span>
                      </label>
                    ))
                  ) : (
                    // DISTRICT LIST VIEW FOR SELECTED DIVISION
                    <>
                      <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button 
                          type="button"
                          onClick={() => {
                            setLocationType('division');
                            setSelectedDivision(null);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#008b5e',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.9rem',
                            padding: 0
                          }}
                        >
                          ← {lang === 'bn' ? 'বিভাগসমূহে ফিরে যান' : 'Back to Divisions'}
                        </button>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                          {t(selectedDivision)}
                        </span>
                      </div>

                      {[`All of ${selectedDivision} Division`, ...LOCATIONS[selectedDivision]].map(dist => (
                        <label key={dist} className={styles.radioItem}>
                          <div className={styles.locInfo}>
                            <span className={styles.locName}>{t(dist)}</span>
                          </div>
                          <input 
                            type="radio" 
                            name="loc" 
                            onChange={() => handleLocationSelect(dist)}
                            checked={currentLocation === dist}
                          />
                          <span className={styles.radioCircle}></span>
                        </label>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation for Mobile */}
      {!(pathname.startsWith('/chat/') || pathname === '/chat') && (
        <nav className={styles.bottomNav}>
        <Link href="/" className={`${styles.bottomNavItem} ${pathname === '/' ? styles.activeHome : ''}`}>
          <HomeIcon size={22} className={styles.iconHome} />
          <span>{t('home')}</span>
        </Link>
        <Link href="/chat" className={`${styles.bottomNavItem} ${pathname.startsWith('/chat') ? styles.activeChat : ''}`}>
          <div className={styles.iconWrapper}>
            <MessageCircle size={22} className={styles.iconChat} />
            {unreadCount > 0 && (
              <span className={styles.badge}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span>{t('messages')}</span>
        </Link>
        <Link href="/post-ad" className={`${styles.bottomNavItem} ${styles.postItem} ${pathname === '/post-ad' ? styles.activePost : ''}`}>
          <div className={styles.postIconCircle}>
            <PlusCircle size={22} />
          </div>
          <span className={styles.postText}>{t('post')}</span>
        </Link>
         <button className={`${styles.bottomNavItem} ${showProfileMenu ? styles.activeProfile : ''}`} onClick={() => setShowProfileMenu(true)}>
          <div className={styles.iconWrapper}>
            <User size={22} className={styles.iconProfile} />
            {unreadSupportCount > 0 && (
              <span className={styles.badge} style={{ background: '#ef4444' }}>
                {unreadSupportCount}
              </span>
            )}
          </div>
          <span>{t('profile')}</span>
        </button>
      </nav>
      )}

      {showProfileMenu && (
        <ProfileMenu 
          user={user} 
          hasAdminAccess={hasAdminAccess}
          onClose={() => setShowProfileMenu(false)} 
          onLogout={handleLogout}
        />
      )}
    </header>
  );
}
