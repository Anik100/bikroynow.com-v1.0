import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createOrGetChat } from '../../../lib/chatsStore';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { listing_id, buyer_id, seller_id } = await req.json();
    if (!listing_id || !buyer_id || !seller_id) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = (supabaseUrl && serviceRoleKey)
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : null;

    if (serverSupabase && isValidUUID(listing_id) && isValidUUID(buyer_id) && isValidUUID(seller_id)) {
      try {
        // 1. Check if chat already exists in Supabase
        const { data: existingChat } = await serverSupabase
          .from('chats')
          .select('id')
          .eq('listing_id', listing_id)
          .eq('buyer_id', buyer_id)
          .eq('seller_id', seller_id)
          .maybeSingle();

        if (existingChat?.id) {
          return NextResponse.json({ success: true, id: existingChat.id });
        }

        // 2. Direct insert into chats table
        const { data: newChat, error: insertErr } = await serverSupabase
          .from('chats')
          .insert({
            listing_id,
            buyer_id,
            seller_id,
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (!insertErr && newChat?.id) {
          return NextResponse.json({ success: true, id: newChat.id });
        }
      } catch (sbErr) {
        console.error('Supabase chat create error:', sbErr);
      }
    }

    // Fallback: Guaranteed to create/retrieve chat from resilient chatsStore
    const localChatId = createOrGetChat(listing_id, buyer_id, seller_id);

    // Persist chat session centrally in admin_settings cloud store
    if (serverSupabase) {
      try {
        const { data: row } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'all_chats_list')
          .maybeSingle();
        let allChats = [];
        if (row?.value) {
          try { allChats = JSON.parse(row.value); } catch (e) {}
        }
        if (!allChats.some(c => c.id === localChatId)) {
          allChats.push({
            id: localChatId,
            listing_id,
            buyer_id,
            seller_id,
            created_at: new Date().toISOString()
          });
          await serverSupabase.from('admin_settings').upsert({
            key: 'all_chats_list',
            value: JSON.stringify(allChats)
          }, { onConflict: 'key' });
        }
      } catch (e) {}
    }

    return NextResponse.json({ success: true, id: localChatId });
  } catch (e) {
    console.error('Error creating chat:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
