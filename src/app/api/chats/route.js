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

    // 1. Check if chat already exists in Supabase admin_settings cloud store
    let allChats = [];
    if (serverSupabase) {
      try {
        const { data: row } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'all_chats_list')
          .maybeSingle();
        if (row?.value) {
          try { allChats = JSON.parse(row.value); } catch (e) {}
        }
        if (Array.isArray(allChats)) {
          const existing = allChats.find(c => 
            String(c.listing_id) === String(listing_id) &&
            ((c.buyer_id === buyer_id && c.seller_id === seller_id) ||
             (c.buyer_id === seller_id && c.seller_id === buyer_id))
          );
          if (existing?.id) {
            return NextResponse.json({ success: true, id: existing.id });
          }
        }
      } catch (e) {}
    }

    // 2. Check if chat already exists in Supabase chats table (if UUIDs)
    if (serverSupabase && isValidUUID(listing_id) && isValidUUID(buyer_id) && isValidUUID(seller_id)) {
      try {
        const { data: existingChat } = await serverSupabase
          .from('chats')
          .select('id')
          .eq('listing_id', listing_id)
          .or(`and(buyer_id.eq.${buyer_id},seller_id.eq.${seller_id}),and(buyer_id.eq.${seller_id},seller_id.eq.${buyer_id})`)
          .maybeSingle();

        if (existingChat?.id) {
          return NextResponse.json({ success: true, id: existingChat.id });
        }
      } catch (sbErr) {
        console.error('Supabase chat lookup error:', sbErr);
      }
    }

    // 3. Fallback: Check local chatsStore
    const localChatId = createOrGetChat(listing_id, buyer_id, seller_id);

    // 4. Persist newly created chat session to admin_settings cloud store
    if (serverSupabase) {
      try {
        if (!allChats.some(c => c.id === localChatId)) {
          allChats.push({
            id: localChatId,
            listing_id,
            buyer_id,
            seller_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          await serverSupabase.from('admin_settings').upsert({
            key: 'all_chats_list',
            value: JSON.stringify(allChats)
          }, { onConflict: 'key' });
        }

        // Try direct insert into chats table if valid UUIDs
        if (isValidUUID(listing_id) && isValidUUID(buyer_id) && isValidUUID(seller_id)) {
          await serverSupabase
            .from('chats')
            .insert({
              listing_id,
              buyer_id,
              seller_id,
              updated_at: new Date().toISOString()
            })
            .catch(() => {});
        }
      } catch (e) {}
    }

    return NextResponse.json({ success: true, id: localChatId });
  } catch (e) {
    console.error('Error creating chat:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
