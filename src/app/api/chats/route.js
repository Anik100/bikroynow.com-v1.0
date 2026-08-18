import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { listing_id, buyer_id, seller_id } = await req.json();
    if (!listing_id || !buyer_id || !seller_id) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    // Call the SECURITY DEFINER RPC on Supabase
    const { data: chatId, error } = await serverSupabase.rpc('create_chat_v2', {
      p_listing_id: listing_id,
      p_buyer_id: buyer_id,
      p_seller_id: seller_id
    });

    if (error) throw error;

    return NextResponse.json({ success: true, id: chatId });
  } catch (e) {
    console.error('Error creating chat via RPC:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
