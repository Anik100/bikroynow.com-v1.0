import { CATEGORIES, CATEGORY_TRANSLATIONS } from './constants';

export const LEGACY_MAP = {
  // Electronics
  'lithium battery': { main: 'Electronics', sub: 'batteries' },
  'camera lights & softboxes': { main: 'Electronics', sub: 'lighting_emergency' },
  'ইলেকট্রিক হিটার জগ': { main: 'Electronics', sub: 'kitchen_appliances' },

  // Computers
  'routers': { main: 'Computers', sub: 'wifi_routers' },
  'router': { main: 'Computers', sub: 'wifi_routers' },
  'ups': { main: 'Computers', sub: 'mini_ups_backup' },
  'mini ups': { main: 'Computers', sub: 'mini_ups_backup' },

  // Vehicles
  'second-hand used registered motorcycles': { main: 'Vehicles', sub: 'motorcycles' },
  'motorcycles': { main: 'Vehicles', sub: 'motorcycles' },
  'motorcycle': { main: 'Vehicles', sub: 'motorcycles' }
};

const cleanText = (s) => (s ? String(s).toLowerCase().trim() : '');

export const isCategoryMatch = (adOrCat, filterKey) => {
  if (!adOrCat || !filterKey) return false;

  const rawCat = typeof adOrCat === 'object' ? (adOrCat.category_id || '') : adOrCat;
  const rawTitle = typeof adOrCat === 'object' ? (adOrCat.title || '') : '';

  const adCat = cleanText(rawCat);
  const filter = cleanText(filterKey);
  const title = cleanText(rawTitle);

  if (!adCat && !title) return false;

  // 1. Direct match (e.g. 'mobile_phones' === 'mobile_phones')
  if (adCat === filter) return true;

  // 2. Bilingual translation check (if ad saved with Bengali or English label)
  const bnName = cleanText(CATEGORY_TRANSLATIONS.bn?.[filterKey]);
  const enName = cleanText(CATEGORY_TRANSLATIONS.en?.[filterKey]);
  if (bnName && adCat === bnName) return true;
  if (enName && adCat === enName) return true;

  // 3. Known Legacy Map Check
  if (LEGACY_MAP[adCat]) {
    const mapped = LEGACY_MAP[adCat];
    if (filter === cleanText(mapped.main) || filter === cleanText(mapped.sub)) return true;
  }

  // 4. If filterKey is a main category, match all its subcategories and brands
  if (CATEGORIES[filterKey]) {
    // Smart keyword matching for legacy ads under main categories
    if (filter === 'electronics' && (adCat.includes('ইলেকট্রিক') || adCat.includes('electronic') || adCat.includes('battery') || adCat.includes('ব্যাটারি') || adCat.includes('light') || adCat.includes('লাইট'))) {
      return true;
    }
    if (filter === 'computers' && (adCat.includes('router') || adCat.includes('রাউটার') || adCat.includes('computer') || adCat.includes('কম্পিউটার') || adCat === 'ups')) {
      return true;
    }
    if (filter === 'vehicles' && (adCat.includes('motorcycle') || adCat.includes('মোটরসাইকেল') || adCat.includes('car') || adCat.includes('গাড়ি') || adCat.includes('bike'))) {
      return true;
    }
    if (filter === 'mobile phones' && (adCat.includes('mobile') || adCat.includes('মোবাইল') || adCat.includes('phone') || adCat.includes('ফোন'))) {
      return true;
    }

    const subcategories = CATEGORIES[filterKey];
    for (const [subKey, subData] of Object.entries(subcategories)) {
      if (isCategoryMatch(adOrCat, subKey)) return true;
      const brands = Array.isArray(subData) ? subData : (subData?.brands || []);
      for (const b of brands) {
        const cleanBrand = cleanText(b);
        if (cleanBrand && (cleanBrand === adCat || cleanBrand.includes(adCat) || adCat.includes(cleanBrand))) return true;
      }
    }
  }

  // 5. If filterKey is a subcategory, match brand items & word stems under it
  for (const mainCatObj of Object.values(CATEGORIES)) {
    if (mainCatObj[filterKey]) {
      // Direct word stem check (e.g. filterKey: "batteries", adCat: "Lithium battery" -> both contain "batter")
      const stem = filter.replace(/ies$/, 'y').replace(/s$/, '').replace(/_/g, ' ');
      if (stem.length >= 3 && adCat.includes(stem)) return true;

      // Subcategory translations stem match
      const subBn = cleanText(CATEGORY_TRANSLATIONS.bn?.[filterKey]);
      const subEn = cleanText(CATEGORY_TRANSLATIONS.en?.[filterKey]);
      if (subBn && (adCat.includes(subBn) || subBn.includes(adCat))) return true;
      if (subEn && (adCat.includes(subEn) || subEn.includes(adCat))) return true;

      const brands = Array.isArray(mainCatObj[filterKey]) ? mainCatObj[filterKey] : (mainCatObj[filterKey]?.brands || []);
      for (const b of brands) {
        const cleanBrand = cleanText(b);
        if (cleanBrand && (cleanBrand === adCat || cleanBrand.includes(adCat) || adCat.includes(cleanBrand))) return true;
      }
    }
  }

  return false;
};
