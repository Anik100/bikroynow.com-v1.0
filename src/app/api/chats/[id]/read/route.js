import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMessages, saveMessages } from '../../../../../lib/chatsStore';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  try {
    const { id } = params;
    const { user_id } = await req.json();

    if (!id || !user_id) {
      return NextResponse.json({ error: 'Missing chat id or user_id' }, { status: 400 });
    }

    // 1. Mark local messages as read
    const allMsgs = getMessages();
    let updated = false;
    allMsgs.forEach(m => {
      if (m.chat_id === id && m.sender_id !== user_id && !m.is_read) {
        m.is_read = true;
        updated = true;
      }
    });

    if (updated) {
      saveMessages(allMsgs);
    }

    // 2. Mark Supabase messages as read if UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (isValidUUID && supabaseUrl && serviceRoleKey) {
      try {
        const serverSupabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
        await serverSupabase
          .from('messages')
          .update({ is_read: true })
          .eq('chat_id', id)
          .neq('sender_id', user_id);
      } catch (e) {
        console.error('Error marking messages as read in DB:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Error in mark as read API:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
