import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMessages, saveMessages } from '../../../../../lib/chatsStore';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const { id } = params;
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = (supabaseUrl && serviceRoleKey)
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : null;

    let dbMsgs = [];
    if (isValidUUID && serverSupabase) {
      try {
        const { data: rpcMsgs, error: rpcErr } = await serverSupabase.rpc('get_messages_for_chat_v2', {
          p_chat_id: id
        });
        if (!rpcErr && Array.isArray(rpcMsgs)) {
          dbMsgs = rpcMsgs;
        } else {
          const { data: directMsgs } = await serverSupabase
            .from('messages')
            .select('*')
            .eq('chat_id', id)
            .order('created_at', { ascending: true });
          if (Array.isArray(directMsgs)) dbMsgs = directMsgs;
        }
      } catch (e) {}
    }

    // 1. Central persistent cloud store via admin_settings (works for all chat IDs including chat-...)
    let cloudMsgs = [];
    if (serverSupabase) {
      try {
        const { data: row } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'chat_msgs_' + id)
          .maybeSingle();
        if (row?.value) {
          const parsed = JSON.parse(row.value);
          if (Array.isArray(parsed)) cloudMsgs = parsed;
        }
      } catch (e) {}
    }

    // 2. Local fallback store
    const localMsgs = getMessages().filter(m => m.chat_id === id);

    // Merge and deduplicate
    const seenIds = new Set();
    const combined = [];

    [...dbMsgs, ...cloudMsgs, ...localMsgs].forEach(m => {
      const msgKey = m.id || (m.content + '_' + m.created_at);
      if (!seenIds.has(msgKey)) {
        seenIds.add(msgKey);
        combined.push(m);
      }
    });

    combined.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    return NextResponse.json({ success: true, messages: combined }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (e) {
    console.error('Error fetching messages:', e);
    return NextResponse.json({ error: e.message, messages: [] }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { id } = params;
    const { sender_id, content, image_url } = await req.json();

    const newMsg = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      chat_id: id,
      sender_id,
      content: content || null,
      image_url: image_url || null,
      created_at: new Date().toISOString(),
      is_read: false
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = (supabaseUrl && serviceRoleKey)
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : null;

    // 1. Central persistent cloud store via admin_settings (works 100% reliably for ALL chats)
    if (serverSupabase) {
      try {
        const { data: row } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'chat_msgs_' + id)
          .maybeSingle();

        let msgsList = [];
        if (row?.value) {
          try { msgsList = JSON.parse(row.value); } catch (e) {}
        }
        msgsList.push(newMsg);

        await serverSupabase
          .from('admin_settings')
          .upsert({
            key: 'chat_msgs_' + id,
            value: JSON.stringify(msgsList)
          }, { onConflict: 'key' });
      } catch (err) {
        console.error('Error saving chat_msgs to admin_settings:', err);
      }
    }

    // 2. Try inserting to Supabase messages table if UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isValidUUID && serverSupabase) {
      try {
        await serverSupabase
          .from('messages')
          .insert({
            chat_id: id,
            sender_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sender_id) ? sender_id : null,
            content: content || null,
            image_url: image_url || null,
            is_read: false
          });
      } catch (e) {}
    }

    // 3. Save to local store fallback
    try {
      const allMsgs = getMessages();
      allMsgs.push(newMsg);
      saveMessages(allMsgs);
    } catch (e) {}

    return NextResponse.json({ success: true, message: newMsg }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (e) {
    console.error('Error inserting message:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
