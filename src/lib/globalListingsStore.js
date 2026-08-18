import fs from 'fs';
import path from 'path';

// Server-side persistent file storage path
const STORE_DIR = path.join(process.cwd(), 'src', 'data');
const STORE_FILE = path.join(STORE_DIR, 'listings_data.json');

// Default initial sample listings so website is never empty
const DEFAULT_SAMPLE_ADS = [
  {
    id: 'sample-ad-1',
    user_id: 'sample-user-1',
    title: 'TP-Link wdr6500 Dualband china used',
    description: 'High speed dualband router in great working condition. 4 external antennas, 1750Mbps speed.',
    price: 1650,
    category_id: 'Routers',
    location: 'Tangail',
    condition: 'Used',
    contact_phone: '01700000000',
    images: ['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80'],
    status: 'active',
    is_featured: true,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    profiles: { membership_type: 'business', membership_expires_at: '2030-01-01' }
  },
  {
    id: 'sample-ad-2',
    user_id: 'sample-user-2',
    title: 'China mobile pt939g Gigabit xpon onu+router',
    description: 'Gigabit XPON ONU router with Wi-Fi support. Excellent signal range and fiber connectivity.',
    price: 1950,
    category_id: 'Routers',
    location: 'Tangail',
    condition: 'Used',
    contact_phone: '01700000000',
    images: ['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80'],
    status: 'active',
    is_featured: true,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    profiles: { membership_type: 'business', membership_expires_at: '2030-01-01' }
  }
];

export function getGlobalListings() {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(STORE_FILE, JSON.stringify(DEFAULT_SAMPLE_ADS, null, 2), 'utf8');
      return DEFAULT_SAMPLE_ADS;
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SAMPLE_ADS;
  } catch (err) {
    console.error('Error reading global listings store:', err);
    return DEFAULT_SAMPLE_ADS;
  }
}

export function saveGlobalListing(newAd) {
  try {
    const current = getGlobalListings();
    // Filter duplicates
    const filtered = current.filter(item => item.id !== newAd.id && item.title !== newAd.title);
    const updated = [newAd, ...filtered];

    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (err) {
    console.error('Error saving global listing:', err);
    return [];
  }
}
