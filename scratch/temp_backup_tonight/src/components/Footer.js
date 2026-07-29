'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Footer.module.css';
import { Facebook, Twitter, Instagram, Youtube } from 'lucide-react';

export default function Footer() {
  const pathname = usePathname();

  // চ্যাট পেজে footer দেখাবে না
  if (pathname?.startsWith('/chat')) return null;

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerContainer}`}>
        <div className={styles.column}>
          <h3>More from BikroyHut</h3>
          <ul>
            <li><Link href="/sell-fast">Sell Fast</Link></li>
            <li><Link href="/sell-fast">Doorstep Delivery</Link></li>
            <li><Link href="/membership">Membership</Link></li>
            <li><Link href="/about-us">Banner Ads</Link></li>
            <li><Link href="/about-us">Ad Promotions</Link></li>
          </ul>
        </div>
        <div className={styles.column}>
          <h3>Help & Support</h3>
          <ul>
            <li><Link href="/faq">FAQ</Link></li>
            <li><Link href="/stay-safe">Stay safe</Link></li>
            <li><Link href="/contact">Contact Us</Link></li>
          </ul>
        </div>
        <div className={styles.column}>
          <h3>Follow BikroyHut</h3>
          <ul>
            <li><Link href="/about-us">Blog</Link></li>
            <li>
              <div className={styles.socialIcons}>
                <Facebook size={20} />
                <Twitter size={20} />
                <Instagram size={20} />
                <Youtube size={20} />
              </div>
            </li>
          </ul>
        </div>
        <div className={styles.column}>
          <h3>About BikroyHut</h3>
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
          <p>&copy; {new Date().getFullYear()} BikroyHut.com</p>
        </div>
      </div>
    </footer>
  );
}
