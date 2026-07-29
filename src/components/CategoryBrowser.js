'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Smartphone, Laptop, Zap, Car, Home as HomeIcon, Briefcase, Box, ChevronRight } from 'lucide-react';
import { CATEGORIES } from '../lib/constants';
import styles from './CategoryBrowser.module.css';

const CAT_CONFIG = {
  Mobiles: { icon: Smartphone, bg: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #60a5fa 100%)' },
  Electronics: { icon: Zap, bg: 'linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #fbbf24 100%)' },
  Computers: { icon: Laptop, bg: 'linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)' },
  Vehicles: { icon: Car, bg: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 50%, #f87171 100%)' },
  Property: { icon: HomeIcon, bg: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 50%, #a78bfa 100%)' },
  Jobs: { icon: Briefcase, bg: 'linear-gradient(135deg, #be185d 0%, #ec4899 50%, #f472b6 100%)' },
  'More Categories': { icon: Box, bg: 'linear-gradient(135deg, #334155 0%, #64748b 50%, #94a3b8 100%)' },
};

export default function CategoryBrowser({ translations }) {
  const [activeCategory, setActiveCategory] = useState(null);

  const mainCategories = [
    { name: 'Electronics', count: '12,345' },
    { name: 'Vehicles', count: '8,432' },
    { name: 'Property', count: '5,123' },
    { name: 'Jobs', count: '2,945' },
    { name: 'Mobiles', count: '1,245' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        {mainCategories.map((cat) => {
          const config = CAT_CONFIG[cat.name] || CAT_CONFIG['More Categories'];
          const Icon = config.icon;
          return (
            <div 
              key={cat.name} 
              className={`${styles.categoryItem} ${activeCategory === cat.name ? styles.active : ''}`}
              onMouseEnter={() => setActiveCategory(cat.name)}
            >
              <div className={styles.catLeft}>
                <div className={styles.miniIconBox} style={{ background: config.bg }}>
                  <Icon size={16} color="#ffffff" />
                </div>
                <span className={styles.catName}>{cat.name}</span>
              </div>
              <ChevronRight size={16} />
            </div>
          );
        })}
      </div>

      <div className={styles.content}>
        {activeCategory ? (
          <div className={styles.subGrid}>
            <h3>{activeCategory}</h3>
            <div className={styles.links}>
              {CATEGORIES[activeCategory] && Object.keys(CATEGORIES[activeCategory]).map(sub => (
                <div key={sub} className={styles.subGroup}>
                  <Link href={`/category/${sub.toLowerCase()}`} className={styles.subHeader}>
                    {sub}
                  </Link>
                  <div className={styles.items}>
                    {CATEGORIES[activeCategory][sub].map(item => (
                      <Link key={item} href={`/category/${item.toLowerCase()}`} className={styles.itemLink}>
                        {item}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {!CATEGORIES[activeCategory] && <p>Browse all items in {activeCategory}</p>}
            </div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <p>Hover over a category to see subcategories</p>
          </div>
        )}
      </div>
    </div>
  );
}
