'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Smartphone, Monitor, Car, Home as HomeIcon, Briefcase, MoreHorizontal, ChevronRight } from 'lucide-react';
import { CATEGORIES } from '../lib/constants';
import styles from './CategoryBrowser.module.css';

const ICON_MAP = {
  Mobiles: Smartphone,
  Electronics: Monitor,
  Vehicles: Car,
  Property: HomeIcon,
  Jobs: Briefcase,
  'More Categories': MoreHorizontal
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
          const Icon = ICON_MAP[cat.name] || MoreHorizontal;
          return (
            <div 
              key={cat.name} 
              className={`${styles.categoryItem} ${activeCategory === cat.name ? styles.active : ''}`}
              onMouseEnter={() => setActiveCategory(cat.name)}
            >
              <div className={styles.catLeft}>
                <Icon size={20} />
                <span>{cat.name}</span>
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
