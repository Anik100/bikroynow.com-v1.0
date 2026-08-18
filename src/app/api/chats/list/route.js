import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGlobalListings } from '../../../../lib/globalListingsStore';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    // Call the SECURITY DEFINER RPC to fetch chats bypassing RLS
    const { data: myChats, error: chatsErr } = await serverSupabase.rpc('get_chats_for_user_v2', {
      p_user_id: userId
    });

    if (chatsErr) throw chatsErr;

    const globalListings = getGlobalListings();

    const enriched = await Promise.all((myChats || []).map(async (chat) => {
      const isBuyer = chat.buyer_id === userId;
      const partnerId = isBuyer ? chat.seller_id : chat.buyer_id;

      // 1. Get listing
      let listing = globalListings.find(l => l.id === chat.listing_id);
      if (!listing) {
        try {
          const { data } = await serverSupabase.from('listings').select('title, images').eq('id', chat.listing_id).single();
          listing = data;
        } catch (e) {}
      }
      chat.listing = listing || { title: 'BikroyNow Item', images: ['/placeholder.png'] };

      // 2. Get partner profile
      let partner = null;
      try {
        const { data } = await serverSupabase.from('profiles').select('full_name, avatar_url').eq('id', partnerId).single();
        partner = data;
      } catch (e) {}
      chat.partner = partner || { full_name: isBuyer ? 'বিক্রেতা (Seller)' : 'ক্রেতা (Buyer)' };

      // 3. Get last message and unread count directly from database
      let lastMsg = null;
      let unreadCount = 0;
      try {
        const { data: msgs } = await serverSupabase.rpc('get_messages_for_chat_v2', {
          p_chat_id: chat.id
        });
        if (msgs && msgs.length > 0) {
          lastMsg = msgs[msgs.length - 1];
          unreadCount = msgs.filter(m => !m.is_read && m.sender_id !== userId).length;
        }
      } catch (e) {}

      return {
        ...chat,
        listing: chat.listing,
        partner: chat.partner,
        lastMsg,
        unreadCount
      };
    }));

    // Sort by last message time
    const sorted = enriched.sort((a, b) => {
      const tA = a.lastMsg?.created_at || a.created_at;
      const tB = b.lastMsg?.created_at || b.created_at;
      return new Date(tB) - new Date(tA);
    });

    return NextResponse.json({ success: true, chats: sorted });
  } catch (e) {
    console.error('Error fetching chats list via RPC:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
