import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGlobalListings } from '../../../../lib/globalListingsStore';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const { id } = params;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    // Call the SECURITY DEFINER RPC to get chat metadata bypassing RLS
    const { data: chat, error } = await serverSupabase.rpc('get_chat_details_v2', {
      p_chat_id: id
    });

    if (error || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // 1. Fetch listing details
    let listing = null;
    try {
      const globalListings = getGlobalListings();
      listing = globalListings.find(l => l.id === chat.listing_id);

      if (!listing) {
        const { data } = await serverSupabase
          .from('listings')
          .select('title, images')
          .eq('id', chat.listing_id)
          .single();
        listing = data;
      }
    } catch (e) {
      console.error('Error fetching listing details:', e);
    }
    chat.listing = listing || { title: 'BikroyNow Item', images: ['/placeholder.png'] };

    // 2. Fetch profiles
    let buyer = null;
    let seller = null;

    try {
      const { data: buyerData } = await serverSupabase.from('profiles').select('full_name, avatar_url, last_seen').eq('id', chat.buyer_id).single();
      buyer = buyerData;
    } catch (e) {}
    try {
      const { data: sellerData } = await serverSupabase.from('profiles').select('full_name, avatar_url, last_seen').eq('id', chat.seller_id).single();
      seller = sellerData;
    } catch (e) {}

    chat.buyer = buyer || { full_name: 'ক্রেতা (Buyer)' };
    chat.seller = seller || { full_name: 'বিক্রেতা (Seller)' };

    return NextResponse.json({ success: true, chat });
  } catch (e) {
    console.error('Error fetching chat details via RPC:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
