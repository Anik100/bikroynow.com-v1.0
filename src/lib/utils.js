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
  return new Promise((resolve, reject) => {
    // If it's not an image (e.g. video), or very small, just return it
    if (!file.type.startsWith('image/') || file.size < 200 * 1024) {
      resolve(file);
      return;
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Create a new File object with the compressed blob
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
      img.onerror = (error) => resolve(file); // fallback on error
    };
    reader.onerror = (error) => resolve(file); // fallback on error
  });
};

export const getPromotionBadgeText = (promoType, lang = 'en') => {
  if (!promoType) return lang === 'bn' ? 'প্রিমিয়াম' : 'Premium';
  
  const text = promoType.toLowerCase();
  
  if (text.includes('express')) {
    return lang === 'bn' ? 'এক্সপ্রেস বুস্ট' : 'Express Boost';
  } else if (text.includes('mega')) {
    return lang === 'bn' ? 'মেগা বুস্ট' : 'Mega Boost';
  } else if (text.includes('premium')) {
    return lang === 'bn' ? 'প্রিমিয়াম বুস্ট' : 'Premium Boost';
  }
  
  return lang === 'bn' ? 'প্রিমিয়াম' : 'Premium';
};

export const sortPremiumListings = (dataArr) => {
  if (!Array.isArray(dataArr)) return [];
  return [...dataArr].sort((a, b) => {
    const isAPremium = Boolean(
      a.is_featured ||
      a.promotion_type || 
      a.is_verified || 
      (a.profiles && a.profiles.membership_type && a.profiles.membership_type.toLowerCase() !== 'free' && (!a.profiles.membership_expires_at || new Date() < new Date(a.profiles.membership_expires_at)))
    );
    const isBPremium = Boolean(
      b.is_featured ||
      b.promotion_type || 
      b.is_verified || 
      (b.profiles && b.profiles.membership_type && b.profiles.membership_type.toLowerCase() !== 'free' && (!b.profiles.membership_expires_at || new Date() < new Date(b.profiles.membership_expires_at)))
    );

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
