'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Filter, X, ChevronRight, ArrowLeft, Search, Check, 
  RotateCcw, MapPin, Tag, SlidersHorizontal 
} from 'lucide-react';
import { LOCATIONS, CATEGORIES, getCategoryName } from '../lib/constants';
import styles from './FilterModal.module.css';

const CAT_ICONS = {
  Electronics: '⚡',
  'Mobile Phones': '📱',
  Computers: '💻',
  Vehicles: '🚗',
  Property: '🏠',
  Jobs: '💼',
  'অন্যান্য': '📦',
};

export default function FilterModal({
  isOpen,
  onClose,
  filters = {},
  onApply,
  onReset,
  lang = 'bn',
  totalCount = null
}) {
  const [mounted, setMounted] = useState(false);

  // Temporary filter states inside the modal (until "Apply" is clicked)
  const [tempMemberFilter, setTempMemberFilter] = useState('all');
  const [tempCategory, setTempCategory] = useState('');
  const [tempLocation, setTempLocation] = useState('');
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [tempSortBy, setTempSortBy] = useState('newest');

  // Sub-view state: null | 'category' | 'location'
  const [subView, setSubView] = useState(null);

  // Sub-view specific states
  const [selectedMainCat, setSelectedMainCat] = useState(null);
  const [catSearch, setCatSearch] = useState('');
  const [locSearch, setLocSearch] = useState('');
  const [selectedDivision, setSelectedDivision] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync incoming filters whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setTempMemberFilter(filters.memberFilter || 'all');
      setTempCategory(filters.category || '');
      setTempLocation(filters.location || '');
      setTempMinPrice(filters.minPrice || '');
      setTempMaxPrice(filters.maxPrice || '');
      setTempSortBy(filters.sortBy || 'newest');
      setSubView(null);
      setSelectedMainCat(null);
      setSelectedDivision(null);
      setCatSearch('');
      setLocSearch('');

      // Lock background scroll
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, filters]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (subView) {
          setSubView(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, subView, onClose]);

  if (!isOpen || !mounted) return null;

  const handleApply = () => {
    onApply({
      memberFilter: tempMemberFilter,
      category: tempCategory,
      location: tempLocation,
      minPrice: tempMinPrice,
      maxPrice: tempMaxPrice,
      sortBy: tempSortBy,
    });
    onClose();
  };

  const handleReset = () => {
    setTempMemberFilter('all');
    setTempCategory('');
    setTempLocation('');
    setTempMinPrice('');
    setTempMaxPrice('');
    setTempSortBy('newest');
    if (onReset) onReset();
  };

  const sellerTypes = [
    {
      id: 'all',
      icon: '🌐',
      label: lang === 'bn' ? 'সকল বিজ্ঞাপন' : 'All Ads',
      desc: lang === 'bn' ? 'যেকোনো ধরনের বিজ্ঞাপন' : 'All listings feed'
    },
    {
      id: 'free',
      icon: '👤',
      label: lang === 'bn' ? 'সাধারণ/ব্যক্তিগত বিজ্ঞাপন' : 'Regular/Personal Ads',
      desc: lang === 'bn' ? 'ফ্রি ও সাধারণ ইউজারদের বিজ্ঞাপন' : 'Standard free user ads'
    },
    {
      id: 'verified',
      icon: '🛡️',
      label: lang === 'bn' ? 'ভেরিফাইড বিক্রেতা' : 'Verified Sellers',
      desc: lang === 'bn' ? 'যাচাইকৃত ও বিশ্বস্ত বিক্রেতা' : 'Verified member badge'
    },
    {
      id: 'business',
      icon: '💼',
      label: lang === 'bn' ? 'বিজনেস মেম্বার' : 'Business Members',
      desc: lang === 'bn' ? 'ভেরিফাইড শপ ও বিজনেস' : 'Official registered shops'
    },
    {
      id: 'premium_sellers',
      icon: '🥇',
      label: lang === 'bn' ? 'গোল্ড/সিলভার মেম্বার' : 'Gold/Silver Members',
      desc: lang === 'bn' ? 'প্রিমিয়াম প্রমোশনাল অ্যাকাউন্ট' : 'Gold & Silver accounts'
    }
  ];

  const sortOptions = [
    {
      id: 'newest',
      label: lang === 'bn' ? 'নতুন বিজ্ঞাপন আগে' : 'Newest First'
    },
    {
      id: 'price_asc',
      label: lang === 'bn' ? 'দাম: কম থেকে বেশি' : 'Price: Low to High'
    },
    {
      id: 'price_desc',
      label: lang === 'bn' ? 'দাম: বেশি থেকে কম' : 'Price: High to Low'
    }
  ];

  const modalContent = (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleWrapper}>
            <SlidersHorizontal size={20} className={styles.headerIcon} />
            <h3 className={styles.headerTitle}>
              {subView === 'category'
                ? (lang === 'bn' ? 'ক্যাটাগরি বাছাই করুন' : 'Select Category')
                : subView === 'location'
                ? (lang === 'bn' ? 'লোকেশন বাছাই করুন' : 'Select Location')
                : (lang === 'bn' ? 'ফিল্টার ও সাজানোর অপশন' : 'Filters & Sorting')}
            </h3>
          </div>
          <button 
            type="button" 
            className={styles.closeButton} 
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.body}>
          {/* ===================== SUBVIEW: CATEGORY PICKER ===================== */}
          {subView === 'category' && (
            <div>
              <div className={styles.subviewHeader}>
                <button 
                  type="button" 
                  className={styles.backBtn}
                  onClick={() => {
                    if (selectedMainCat) {
                      setSelectedMainCat(null);
                    } else {
                      setSubView(null);
                    }
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
                </button>
                <h4 className={styles.subviewTitle}>
                  {selectedMainCat ? getCategoryName(selectedMainCat, lang) : (lang === 'bn' ? 'ক্যাটাগরি সমূহ' : 'All Categories')}
                </h4>
              </div>

              {!selectedMainCat ? (
                <div className={styles.listGroup}>
                  {/* Option for All Categories */}
                  <div 
                    className={`${styles.listItem} ${!tempCategory ? styles.activeItem : ''}`}
                    onClick={() => {
                      setTempCategory('');
                      setSubView(null);
                    }}
                  >
                    <span className={styles.listItemName}>
                      <span>🌐</span>
                      <span>{lang === 'bn' ? 'সব ক্যাটাগরি (All)' : 'All Categories'}</span>
                    </span>
                    {!tempCategory && <Check size={16} color="#008b5e" />}
                  </div>

                  {Object.keys(CATEGORIES).map((catName) => {
                    const subCount = Object.keys(CATEGORIES[catName] || {}).length;
                    return (
                      <div 
                        key={catName}
                        className={styles.listItem}
                        onClick={() => setSelectedMainCat(catName)}
                      >
                        <span className={styles.listItemName}>
                          <span>{CAT_ICONS[catName] || '📦'}</span>
                          <span>{getCategoryName(catName, lang)}</span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span className={styles.listItemMeta}>
                            {lang === 'bn' ? `${subCount} টি বিভাগ` : `${subCount} items`}
                          </span>
                          <ChevronRight size={16} color="#94a3b8" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  {/* Select Whole Main Category */}
                  <div 
                    className={`${styles.listItem} ${tempCategory === selectedMainCat ? styles.activeItem : ''}`}
                    style={{ marginBottom: '0.6rem', border: '1.5px solid #008b5e', background: '#f0fdf9' }}
                    onClick={() => {
                      setTempCategory(selectedMainCat);
                      setSubView(null);
                      setSelectedMainCat(null);
                    }}
                  >
                    <span className={styles.listItemName} style={{ fontWeight: 800, color: '#00704c' }}>
                      <span>✓</span>
                      <span>{lang === 'bn' ? `সব ${getCategoryName(selectedMainCat, lang)}-এ খুঁজুন` : `All in ${selectedMainCat}`}</span>
                    </span>
                    {tempCategory === selectedMainCat && <Check size={16} color="#008b5e" />}
                  </div>

                  {/* Subcategories Search */}
                  <div className={styles.searchBox}>
                    <Search size={16} color="#64748b" />
                    <input 
                      type="text"
                      className={styles.searchInput}
                      placeholder={lang === 'bn' ? 'উপ-বিভাগ খুঁজুন...' : 'Search subcategories...'}
                      value={catSearch}
                      onChange={(e) => setCatSearch(e.target.value)}
                    />
                    {catSearch && (
                      <button 
                        type="button" 
                        onClick={() => setCatSearch('')}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Subcategories List */}
                  <div className={styles.listGroup}>
                    {Object.keys(CATEGORIES[selectedMainCat] || {})
                      .filter((sub) => {
                        if (!catSearch) return true;
                        const subName = getCategoryName(sub, lang);
                        return sub.toLowerCase().includes(catSearch.toLowerCase()) || 
                               subName.toLowerCase().includes(catSearch.toLowerCase());
                      })
                      .map((subKey) => (
                        <div 
                          key={subKey}
                          className={`${styles.listItem} ${tempCategory === subKey ? styles.activeItem : ''}`}
                          onClick={() => {
                            setTempCategory(subKey);
                            setSubView(null);
                            setSelectedMainCat(null);
                          }}
                        >
                          <span className={styles.listItemName}>
                            <span>•</span>
                            <span>{getCategoryName(subKey, lang)}</span>
                          </span>
                          {tempCategory === subKey && <Check size={16} color="#008b5e" />}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== SUBVIEW: LOCATION PICKER ===================== */}
          {subView === 'location' && (
            <div>
              <div className={styles.subviewHeader}>
                <button 
                  type="button" 
                  className={styles.backBtn}
                  onClick={() => {
                    if (selectedDivision) {
                      setSelectedDivision(null);
                    } else {
                      setSubView(null);
                    }
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
                </button>
                <h4 className={styles.subviewTitle}>
                  {selectedDivision ? `${selectedDivision} ${lang === 'bn' ? 'বিভাগ' : 'Division'}` : (lang === 'bn' ? 'লোকেশন নির্বাচন' : 'Select Location')}
                </h4>
              </div>

              {/* Location Search Bar */}
              <div className={styles.searchBox}>
                <Search size={16} color="#64748b" />
                <input 
                  type="text"
                  className={styles.searchInput}
                  placeholder={lang === 'bn' ? 'শহর বা জেলা খুঁজুন...' : 'Search city or district...'}
                  value={locSearch}
                  onChange={(e) => setLocSearch(e.target.value)}
                />
                {locSearch && (
                  <button 
                    type="button" 
                    onClick={() => setLocSearch('')}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* If search active, show flat list */}
              {locSearch ? (
                <div className={styles.listGroup}>
                  {Object.entries(LOCATIONS).flatMap(([div, dists]) => {
                    const matchDiv = div.toLowerCase().includes(locSearch.toLowerCase());
                    const matchedDists = dists.filter(d => d.toLowerCase().includes(locSearch.toLowerCase()));
                    let items = [];
                    if (matchDiv) {
                      items.push({ name: div, parent: null, isDiv: true });
                    }
                    matchedDists.forEach(d => items.push({ name: d, parent: div, isDiv: false }));
                    return items;
                  }).map((item, idx) => (
                    <div 
                      key={idx}
                      className={`${styles.listItem} ${tempLocation === item.name ? styles.activeItem : ''}`}
                      onClick={() => {
                        setTempLocation(item.name);
                        setSubView(null);
                        setLocSearch('');
                      }}
                    >
                      <span className={styles.listItemName}>
                        <MapPin size={15} color="#008b5e" />
                        <span>{item.name} {item.isDiv ? (lang === 'bn' ? '(বিভাগ)' : '(Division)') : ''}</span>
                      </span>
                      {item.parent && <span className={styles.listItemMeta}>{item.parent}</span>}
                    </div>
                  ))}
                </div>
              ) : !selectedDivision ? (
                <div className={styles.listGroup}>
                  {/* All Bangladesh Option */}
                  <div 
                    className={`${styles.listItem} ${!tempLocation || tempLocation === 'All of Bangladesh' ? styles.activeItem : ''}`}
                    onClick={() => {
                      setTempLocation('');
                      setSubView(null);
                    }}
                  >
                    <span className={styles.listItemName}>
                      <span>🇧🇩</span>
                      <span>{lang === 'bn' ? 'সারা বাংলাদেশ (All of Bangladesh)' : 'All of Bangladesh'}</span>
                    </span>
                    {(!tempLocation || tempLocation === 'All of Bangladesh') && <Check size={16} color="#008b5e" />}
                  </div>

                  {/* Divisions List */}
                  {Object.keys(LOCATIONS).map((div) => {
                    const count = LOCATIONS[div]?.length || 0;
                    return (
                      <div 
                        key={div}
                        className={styles.listItem}
                        onClick={() => setSelectedDivision(div)}
                      >
                        <span className={styles.listItemName}>
                          <MapPin size={15} color="#64748b" />
                          <span>{div} {lang === 'bn' ? 'বিভাগ' : 'Division'}</span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span className={styles.listItemMeta}>
                            {lang === 'bn' ? `${count} টি জেলা` : `${count} districts`}
                          </span>
                          <ChevronRight size={16} color="#94a3b8" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.listGroup}>
                  {/* Select All of this Division */}
                  <div 
                    className={`${styles.listItem} ${tempLocation === `All of ${selectedDivision} Division` || tempLocation === selectedDivision ? styles.activeItem : ''}`}
                    style={{ marginBottom: '0.6rem', border: '1.5px solid #008b5e', background: '#f0fdf9' }}
                    onClick={() => {
                      setTempLocation(selectedDivision);
                      setSubView(null);
                      setSelectedDivision(null);
                    }}
                  >
                    <span className={styles.listItemName} style={{ fontWeight: 800, color: '#00704c' }}>
                      <span>✓</span>
                      <span>{lang === 'bn' ? `${selectedDivision} বিভাগের সকল জেলা` : `All of ${selectedDivision}`}</span>
                    </span>
                    {(tempLocation === selectedDivision || tempLocation === `All of ${selectedDivision} Division`) && (
                      <Check size={16} color="#008b5e" />
                    )}
                  </div>

                  {/* Districts in this Division */}
                  {(LOCATIONS[selectedDivision] || []).map((dist) => (
                    <div 
                      key={dist}
                      className={`${styles.listItem} ${tempLocation === dist ? styles.activeItem : ''}`}
                      onClick={() => {
                        setTempLocation(dist);
                        setSubView(null);
                        setSelectedDivision(null);
                      }}
                    >
                      <span className={styles.listItemName}>
                        <MapPin size={15} color="#64748b" />
                        <span>{dist}</span>
                      </span>
                      {tempLocation === dist && <Check size={16} color="#008b5e" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===================== MAIN VIEW: ALL 3 SECTIONS ===================== */}
          {!subView && (
            <>
              {/* SECTION 1: Seller & Ad Type */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <label className={styles.sectionTitle}>
                    <span>👤</span>
                    <span>{lang === 'bn' ? 'বিজ্ঞাপনের ধরন ও মেম্বারশিপ' : 'Seller & Ad Type'}</span>
                  </label>
                  <span className={styles.sectionSubtitle}>
                    {lang === 'bn' ? 'সেলার ক্যাটাগরি বাছাই করুন' : 'Select listing category'}
                  </span>
                </div>

                <div className={styles.sellerTypeGrid}>
                  {sellerTypes.map((type) => {
                    const isActive = tempMemberFilter === type.id;
                    return (
                      <div 
                        key={type.id}
                        className={`${styles.sellerTypeCard} ${isActive ? styles.activeCard : ''}`}
                        onClick={() => setTempMemberFilter(type.id)}
                      >
                        <span className={styles.sellerCardIcon}>{type.icon}</span>
                        <div className={styles.sellerCardText}>
                          <span className={styles.sellerCardLabel}>{type.label}</span>
                          <span className={styles.sellerCardDesc}>{type.desc}</span>
                        </div>
                        {isActive && <Check size={16} className={styles.activeCheckIcon} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: Category & Location */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <label className={styles.sectionTitle}>
                    <span>📍</span>
                    <span>{lang === 'bn' ? 'ক্যাটাগরি ও অবস্থান' : 'Category & Location'}</span>
                  </label>
                </div>

                <div className={styles.pickerGrid}>
                  {/* Category Picker Tile */}
                  <div 
                    className={`${styles.pickerBox} ${tempCategory ? styles.hasValue : ''}`}
                    onClick={() => setSubView('category')}
                  >
                    <div className={styles.pickerLeft}>
                      <span className={styles.pickerLabel}>
                        {lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
                      </span>
                      <span className={styles.pickerValue}>
                        {tempCategory ? getCategoryName(tempCategory, lang) : (lang === 'bn' ? 'সব ক্যাটাগরি' : 'All Categories')}
                      </span>
                    </div>
                    <div className={styles.pickerRight}>
                      {tempCategory && (
                        <button 
                          type="button" 
                          className={styles.pickerClearBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTempCategory('');
                          }}
                          title="Clear"
                        >
                          ✕
                        </button>
                      )}
                      <ChevronRight size={16} color="#94a3b8" />
                    </div>
                  </div>

                  {/* Location Picker Tile */}
                  <div 
                    className={`${styles.pickerBox} ${tempLocation ? styles.hasValue : ''}`}
                    onClick={() => setSubView('location')}
                  >
                    <div className={styles.pickerLeft}>
                      <span className={styles.pickerLabel}>
                        {lang === 'bn' ? 'লোকেশন' : 'Location'}
                      </span>
                      <span className={styles.pickerValue}>
                        {tempLocation ? tempLocation : (lang === 'bn' ? 'সারা বাংলাদেশ' : 'All of Bangladesh')}
                      </span>
                    </div>
                    <div className={styles.pickerRight}>
                      {tempLocation && (
                        <button 
                          type="button" 
                          className={styles.pickerClearBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTempLocation('');
                          }}
                          title="Clear"
                        >
                          ✕
                        </button>
                      )}
                      <ChevronRight size={16} color="#94a3b8" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Price Range & Sort By */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <label className={styles.sectionTitle}>
                    <span>💰</span>
                    <span>{lang === 'bn' ? 'মূল্য সীমা (টাকা)' : 'Price Range (BDT)'}</span>
                  </label>
                </div>

                <div className={styles.priceRow}>
                  <div className={styles.priceInputWrapper}>
                    <span className={styles.currencySymbol}>৳</span>
                    <input 
                      type="number"
                      min="0"
                      className={styles.priceInput}
                      placeholder={lang === 'bn' ? 'সর্বনিম্ন' : 'Min Price'}
                      value={tempMinPrice}
                      onChange={(e) => setTempMinPrice(e.target.value)}
                    />
                  </div>
                  <span className={styles.priceSeparator}>—</span>
                  <div className={styles.priceInputWrapper}>
                    <span className={styles.currencySymbol}>৳</span>
                    <input 
                      type="number"
                      min="0"
                      className={styles.priceInput}
                      placeholder={lang === 'bn' ? 'সর্বোচ্চ' : 'Max Price'}
                      value={tempMaxPrice}
                      onChange={(e) => setTempMaxPrice(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Sort By Section */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <label className={styles.sectionTitle}>
                    <span>↕️</span>
                    <span>{lang === 'bn' ? 'সাজানোর ক্রম' : 'Sort By'}</span>
                  </label>
                </div>

                <div className={styles.sortGrid}>
                  {sortOptions.map((opt) => {
                    const isActive = tempSortBy === opt.id;
                    return (
                      <div 
                        key={opt.id}
                        className={`${styles.sortCard} ${isActive ? styles.activeSort : ''}`}
                        onClick={() => setTempSortBy(opt.id)}
                      >
                        <span className={styles.sortLabel}>{opt.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sticky Footer */}
        <div className={styles.footer}>
          <button 
            type="button" 
            className={styles.resetBtn}
            onClick={handleReset}
          >
            <RotateCcw size={16} />
            <span>{lang === 'bn' ? 'রিসেট' : 'Reset'}</span>
          </button>
          <button 
            type="button" 
            className={styles.applyBtn}
            onClick={handleApply}
          >
            <Filter size={16} />
            <span>
              {totalCount !== null && totalCount !== undefined
                ? (lang === 'bn' ? `ফিল্টার প্রয়োগ (${totalCount})` : `Apply Filters (${totalCount})`)
                : (lang === 'bn' ? 'ফিল্টার প্রয়োগ করুন' : 'Apply Filters')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
