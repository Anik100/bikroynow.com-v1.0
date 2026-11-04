import fs from 'fs';
import path from 'path';

// Server-side persistent file storage path
const STORE_DIR = path.join(process.cwd(), 'src', 'data');
const STORE_FILE = path.join(STORE_DIR, 'listings_data.json');

// Default initial sample listings (empty so only real user ads show)
const DEFAULT_SAMPLE_ADS = [];

export function getGlobalListings() {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(STORE_FILE, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading global listings store:', err);
    return [];
  }
}

export function saveGlobalListing(ad) {
  try {
    const current = getGlobalListings();
    const updated = [ad, ...current.filter(item => String(item.id) !== String(ad?.id))];
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

export function deleteGlobalListing(id) {
  try {
    const current = getGlobalListings();
    const updated = current.filter(item => String(item.id) !== String(id));
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (err) {
    console.error('Error deleting global listing:', err);
    return [];
  }
}

export function updateGlobalListing(id, updates) {
  try {
    const current = getGlobalListings();
    const updated = current.map(item => String(item.id) === String(id) ? { ...item, ...updates } : item);
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (err) {
    console.error('Error updating global listing:', err);
    return [];
  }
}
