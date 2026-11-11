'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Footer.module.css';
import { Facebook, Twitter, Instagram, Youtube, MapPin, Phone, Mail } from 'lucide-react';

export default function Footer() {
  const pathname = usePathname();

  // চ্যাট পেজে footer দেখাবে না
  if (pathname?.startsWith('/chat')) return null;

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerContainer}`}>
        <div className={styles.column}>
          <h3>More from BikroyNow</h3>
          <ul>
            <li><Link href="/sell-fast">Sell Fast</Link></li>
            <li><Link href="/sell-fast">Doorstep Delivery</Link></li>
            <li><Link href="/membership">Membership</Link></li>
            <li><Link href="/about-us">Banner Ads</Link></li>
            <li><Link href="/about-us">Ad Promotions</Link></li>
          </ul>
        </div>
        <div className={styles.column}>
          <h3>Help &amp; Support</h3>
          <ul>
            <li><Link href="/faq">FAQ</Link></li>
            <li><Link href="/stay-safe">Stay safe</Link></li>
            <li><Link href="/contact">Contact Us</Link></li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', color: 'var(--text-light)', fontSize: '0.88rem', lineHeight: 1.4 }}>
              <MapPin size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary-orange)' }} />
              <span>Nagarpur, Tangail, Bangladesh</span>
            </li>
            <li>
              <a href="tel:+8809612488488" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <Phone size={15} style={{ flexShrink: 0, color: 'var(--primary-orange)' }} />
                <span>+880 9612-488488</span>
              </a>
            </li>
            <li>
              <a href="mailto:support@bikroynow.com" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <Mail size={15} style={{ flexShrink: 0, color: 'var(--primary-orange)' }} />
                <span>support@bikroynow.com</span>
              </a>
            </li>
          </ul>
        </div>
        <div className={styles.column}>
          <h3>Follow BikroyNow</h3>
          <ul>
            <li><Link href="/about-us">Blog</Link></li>
            <li>
              <div className={styles.socialIcons}>
                <a href="https://www.facebook.com/profile.php?id=61592653021446" target="_blank" rel="noopener noreferrer" title="Facebook Page" className={styles.socialLink}>
                  <Facebook size={20} />
                </a>
                <Twitter size={20} />
                <Instagram size={20} />
                <Youtube size={20} />
              </div>
            </li>
          </ul>
        </div>
        <div className={styles.column}>
          <h3>About BikroyNow</h3>
          <ul>
            <li><Link href="/about-us">About Us</Link></li>
            <li><Link href="/about-us">Careers</Link></li>
            <li><Link href="/terms">Terms and Conditions</Link></li>
            <li><Link href="/privacy">Privacy policy</Link></li>
            <li><Link href="/about-us">Sitemap</Link></li>
          </ul>
        </div>
      </div>
      <div className={styles.bottomBar}>
        <div className="container">
          <p>&copy; {new Date().getFullYear()} BikroyNow.com &bull; Nagarpur, Tangail, Bangladesh &bull; support@bikroynow.com</p>
        </div>
      </div>
    </footer>
  );
}
