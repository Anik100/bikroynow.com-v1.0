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

    let dbMsgs = [];
    if (isValidUUID && supabaseUrl && serviceRoleKey) {
      try {
        const serverSupabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
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

    const localMsgs = getMessages().filter(m => m.chat_id === id);
    const seenIds = new Set(dbMsgs.map(m => m.id));
    const combined = [...dbMsgs];
    localMsgs.forEach(m => {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
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
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      chat_id: id,
      sender_id,
      content: content || null,
      image_url: image_url || null,
      created_at: new Date().toISOString(),
      is_read: false
    };

    // 1. Save to local store
    const allMsgs = getMessages();
    allMsgs.push(newMsg);
    saveMessages(allMsgs);

    // 2. Try inserting to Supabase if valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (isValidUUID && supabaseUrl && serviceRoleKey) {
      try {
        const serverSupabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
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
