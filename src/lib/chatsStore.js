import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const CHATS_FILE = path.join(DATA_DIR, 'chats_data.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages_data.json');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serverSupabase = (supabaseUrl && anonKey) 
  ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } }) 
  : null;

function ensureDirExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getChats() {
  try {
    ensureDirExists();
    if (!fs.existsSync(CHATS_FILE)) {
      fs.writeFileSync(CHATS_FILE, '[]', 'utf8');
      return [];
    }
    return JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8') || '[]');
  } catch (e) {
    console.error('Error reading chats store:', e);
    return [];
  }
}

export function saveChats(chats) {
  try {
    ensureDirExists();
    fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving chats store:', e);
  }
}

export function getMessages() {
  try {
    ensureDirExists();
    if (!fs.existsSync(MESSAGES_FILE)) {
      fs.writeFileSync(MESSAGES_FILE, '[]', 'utf8');
      return [];
    }
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8') || '[]');
  } catch (e) {
    console.error('Error reading messages store:', e);
    return [];
  }
}

export function saveMessages(messages) {
  try {
    ensureDirExists();
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving messages store:', e);
  }
}

export function createOrGetChat(listingId, buyerId, sellerId) {
  const chats = getChats();
  let existing = chats.find(c => c.listing_id === listingId && c.buyer_id === buyerId);
  if (existing) {
    return existing.id;
  }
  const newChatId = 'chat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  const newChat = {
    id: newChatId,
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: sellerId,
    created_at: new Date().toISOString()
  };
  chats.push(newChat);
  saveChats(chats);
  return newChatId;
}

export async function resolveUserId(id) {
  if (!id) return id;
  
  // If it's already a clean email-based ID, return it
  if (id.startsWith('user-') && !id.includes('-') && isNaN(id.substr(5))) {
    return id;
  }
  
  // Check if it is a UUID (UUIDs have 36 chars with hyphens)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isUuid && serverSupabase) {
    try {
      const { data, error } = await serverSupabase
        .from('profiles')
        .select('email')
        .eq('id', id)
        .maybeSingle();
      if (data && data.email) {
        return 'user-' + data.email.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    } catch (e) {
      console.error('Error resolving UUID to email:', e);
    }
  }
  
  return id;
}
