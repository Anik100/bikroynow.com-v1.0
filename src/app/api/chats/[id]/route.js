import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGlobalListings } from '../../../../lib/globalListingsStore';
import { getChats } from '../../../../lib/chatsStore';
import { getUserLastSeen } from '../../../../lib/userPresenceStore';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Chat ID missing' }, { status: 400 });
    }

    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = (supabaseUrl && anonKey) 
      ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } }) 
      : null;

    let chat = null;

    // 1. If valid UUID, try querying Supabase DB / RPC
    if (isValidUUID && serverSupabase) {
      try {
        const { data: rpcChat, error: rpcErr } = await serverSupabase.rpc('get_chat_details_v2', {
          p_chat_id: id
        });
        if (!rpcErr && rpcChat) {
          chat = rpcChat;
        } else {
          const { data: directChat } = await serverSupabase
            .from('chats')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (directChat) chat = directChat;
        }
      } catch (sbErr) {
        console.error('Supabase get_chat error:', sbErr);
      }
    }

    // 2. Fallback to local chatsStore
    if (!chat) {
      const localChats = getChats();
      chat = localChats.find(c => c.id === id) || null;
    }

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // 3. Fetch listing details
    let listing = null;
    try {
      const globalListings = getGlobalListings();
      listing = globalListings.find(l => String(l.id) === String(chat.listing_id));

      if (!listing && serverSupabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chat.listing_id)) {
        const { data } = await serverSupabase
          .from('listings')
          .select('title, images, price, location')
          .eq('id', chat.listing_id)
          .maybeSingle();
        if (data) listing = data;
      }
    } catch (e) {
      console.error('Error fetching listing details:', e);
    }
    chat.listing = listing || { title: 'BikroyNow Item', images: ['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800'] };

    // 4. Fetch buyer and seller profiles (supporting UUIDs, emails, and usernames)
    let buyer = null;
    let seller = null;

    if (serverSupabase) {
      try {
        const { data: allProfs } = await serverSupabase.from('profiles').select('id, email, full_name, avatar_url, last_seen');
        if (allProfs && allProfs.length > 0) {
          const findProf = (targetId) => {
            if (!targetId) return null;
            const cleanTarget = String(targetId).toLowerCase().trim();
            let p = allProfs.find(x => x.id === targetId || x.email?.toLowerCase() === cleanTarget);
            if (!p) {
              p = allProfs.find(x => x.email && 'user-' + x.email.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget);
            }
            return p;
          };

          buyer = findProf(chat.buyer_id);
          seller = findProf(chat.seller_id);
        }
      } catch (e) {
        console.error('Error fetching partner profiles:', e);
      }
    }

    chat.buyer = buyer || { full_name: 'ক্রেতা (Buyer)' };
    chat.seller = seller || { full_name: 'বিক্রেতা (Seller)' };

    chat.buyer.last_seen = getUserLastSeen(chat.buyer_id, chat.buyer.email, chat.buyer.last_seen);
    chat.seller.last_seen = getUserLastSeen(chat.seller_id, chat.seller.email, chat.seller.last_seen);

    return NextResponse.json({ success: true, chat });
  } catch (e) {
    console.error('Error fetching chat details:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
