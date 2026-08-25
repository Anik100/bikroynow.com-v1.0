import fs from 'fs';
import path from 'path';

const STORE_DIR = path.join(process.cwd(), 'src', 'data');
const STORE_FILE = path.join(STORE_DIR, 'featured_ads_data.json');

// Initial defaults matching database sample
const DEFAULT_FEATURED_ADS = [
  {
    id: '8a7cdb5d-e184-4225-8ae5-aed10b67164a',
    listing_id: '7805152b-27f2-4ead-b292-83fcd5ae7e15',
    is_active: true,
    sort_order: 0,
    created_at: '2026-07-30T01:07:15.935049+00:00'
  },
  {
    id: '850bddf8-7e2d-4705-9984-f807859578eb',
    listing_id: 'f068e58e-12a5-473e-8271-24f2807cde2d',
    is_active: true,
    sort_order: 1,
    created_at: '2026-07-30T01:11:17.033668+00:00'
  },
  {
    id: '87644f06-2d0f-44d6-a9b1-796f8b01307f',
    listing_id: '539a03b7-f530-4bf5-9469-8203ab994faf',
    is_active: true,
    sort_order: 2,
    created_at: '2026-07-30T01:14:56.89596+00:00'
  }
];

export function getGlobalFeaturedAds() {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(STORE_FILE, JSON.stringify(DEFAULT_FEATURED_ADS, null, 2), 'utf8');
      return DEFAULT_FEATURED_ADS;
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_FEATURED_ADS;
  } catch (err) {
    console.error('Error reading global featured ads store:', err);
    return DEFAULT_FEATURED_ADS;
  }
}

export function saveGlobalFeaturedAds(items) {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(items, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing global featured ads store:', err);
    return false;
  }
}
