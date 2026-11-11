export const getRelativeTime = (dateString, lang = 'en') => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now - past;
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMins < 1) return lang === 'bn' ? 'এইমাত্র' : 'Just now';
  if (diffInMins < 60) return lang === 'bn' ? `${diffInMins} মিনিট আগে` : `${diffInMins} mins ago`;
  if (diffInHours < 24) return lang === 'bn' ? `${diffInHours} ঘণ্টা আগে` : `${diffInHours} hours ago`;
  if (diffInDays < 30) return lang === 'bn' ? `${diffInDays} দিন আগে` : `${diffInDays} days ago`;
  
  return new Date(dateString).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export const formatLastSeen = (dateString, lang = 'en', short = false) => {
  if (!dateString) return lang === 'bn' ? 'অফলাইন' : 'Offline';
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now - past;
  if (isNaN(diffInMs)) return lang === 'bn' ? 'অফলাইন' : 'Offline';

  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMins < 3) return lang === 'bn' ? 'অ্যাক্টিভ' : 'Active';
  if (diffInMins < 60) return lang === 'bn' ? `${diffInMins} মিনিট আগে ${short ? 'অফলাইন' : 'অফলাইন ছিল'}` : `Offline ${diffInMins}m ago`;
  if (diffInHours < 24) return lang === 'bn' ? `${diffInHours} ঘণ্টা আগে ${short ? 'অফলাইন' : 'অফলাইন ছিল'}` : `Offline ${diffInHours}h ago`;
  if (diffInDays < 30) return lang === 'bn' ? `${diffInDays} দিন আগে ${short ? 'অফলাইন' : 'অফলাইন ছিল'}` : `Offline ${diffInDays}d ago`;

  const formatted = past.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    day: 'numeric',
    month: 'short'
  });
  return lang === 'bn' ? `${formatted} ${short ? 'অফলাইন' : 'অফলাইন ছিল'}` : `Offline on ${formatted}`;
};

export const formatFullDate = (dateString, lang = 'en') => {
  return new Date(dateString).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
};

export const formatPrice = (price, lang = 'en') => {
  if (price == null) return lang === 'bn' ? '৳ ০' : 'Tk 0';
  const formattedPrice = Number(price).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US');
  return lang === 'bn' ? `৳ ${formattedPrice}` : `Tk ${formattedPrice}`;
};

export const compressImage = (file, maxWidth = 1280, maxHeight = 1280, quality = 0.8) => {
  return new Promise((resolve) => {
    // If running in non-browser environment or not a valid image file, return original
    if (typeof window === 'undefined' || !file || !file.type || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    
    // If already compressed JPEG under 100KB, no need to re-encode
    if (file.type === 'image/jpeg' && file.size < 100 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Proportional resizing to fit within 1280x1280 box
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && (blob.size < file.size || width < img.width || height < img.height)) {
              // Create a new File object with the compressed blob (~100-150KB)
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file); // fallback to original
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file); // fallback on error
    };
    reader.onerror = () => resolve(file); // fallback on error
  });
};

export const getPromotionBadgeText = (promoType, lang = 'en') => {
  if (!promoType) return lang === 'bn' ? 'প্রিমিয়াম' : 'Premium';
  
  const text = promoType.toLowerCase();
  
  if (text.includes('mega')) {
    return lang === 'bn' ? 'মেগা বুস্ট (প্রিমিয়াম)' : 'Mega Boost (Premium)';
  } else if (text.includes('super')) {
    return lang === 'bn' ? 'সুপার বুস্ট (প্রিমিয়াম)' : 'Super Boost (Premium)';
  } else if (text.includes('express') || text.includes('quick')) {
    return lang === 'bn' ? 'কুইক বুস্ট (প্রিমিয়াম)' : 'Quick Boost (Premium)';
  } else if (text.includes('gold')) {
    return lang === 'bn' ? 'গোল্ড মেম্বার (প্রিমিয়াম)' : 'Gold Member (Premium)';
  } else if (text.includes('business')) {
    return lang === 'bn' ? 'বিজনেস মেম্বার (প্রিমিয়াম)' : 'Business Member (Premium)';
  } else if (text.includes('silver')) {
    return lang === 'bn' ? 'সিলভার মেম্বার (প্রিমিয়াম)' : 'Silver Member (Premium)';
  } else if (text.includes('featured')) {
    return lang === 'bn' ? 'প্রিমিয়াম ফিচার্ড' : 'Premium Featured';
  }
  
  return lang === 'bn' ? `প্রিমিয়াম (${promoType})` : `Premium (${promoType})`;
};

export const sortPremiumListings = (dataArr) => {
  if (!Array.isArray(dataArr)) return [];
  const now = new Date();

  const checkPremium = (item) => {
    if (!item) return false;
    const expiresAt = item.profiles?.membership_expires_at;
    if (expiresAt && new Date(expiresAt) <= now) {
      return false; // Expired, not premium!
    }
    return Boolean(
      item.is_featured ||
      item.promotion_type || 
      item.is_verified || 
      (item.profiles && item.profiles.membership_type && item.profiles.membership_type.toLowerCase() !== 'free')
    );
  };

  return [...dataArr].sort((a, b) => {
    const isAPremium = checkPremium(a);
    const isBPremium = checkPremium(b);

    if (isAPremium && !isBPremium) return -1;
    if (!isAPremium && isBPremium) return 1;

    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeB - timeA;
  });
};

export const getUserId = (user) => {
  if (!user) return null;
  if (user.email) {
    return 'user-' + user.email.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  return user.id;
};

/**
 * Deterministic sorter for Featured Ads.
 * Guarantees identical order across SSR, Client API, and React state,
 * preventing slides from swapping positions on reload or rehydration.
 */
export const sortFeaturedAds = (ads) => {
  if (!Array.isArray(ads)) return [];
  return [...ads].sort((a, b) => {
    // 1. Primary: sort_order ascending
    const orderA = a.sort_order !== undefined && a.sort_order !== null ? a.sort_order : 999;
    const orderB = b.sort_order !== undefined && b.sort_order !== null ? b.sort_order : 999;
    if (orderA !== orderB) return orderA - orderB;

    // 2. Secondary: created_at descending (newest first)
    const timeA = new Date(a.created_at || a.listing?.created_at || 0).getTime();
    const timeB = new Date(b.created_at || b.listing?.created_at || 0).getTime();
    if (timeA !== timeB) return timeB - timeA;

    // 3. Deterministic fallback: id or listing_id
    const idA = String(a.id || a.listing_id || a.listing?.id || '');
    const idB = String(b.id || b.listing_id || b.listing?.id || '');
    return idA.localeCompare(idB);
  });
};
