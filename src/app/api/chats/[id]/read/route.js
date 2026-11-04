import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../../lib/serverSupabase';
import { getMessages, saveMessages } from '../../../../../lib/chatsStore';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;

    if (!id) {
      return NextResponse.json({ error: 'Missing chat id' }, { status: 400 });
    }

    const serverSupabase = getServerSupabase();

    // 1. Mark as read in Supabase admin_settings cloud store
    if (serverSupabase) {
      try {
        const { data: row } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'chat_msgs_' + id)
          .maybeSingle();

        if (row?.value) {
          const msgs = JSON.parse(row.value);
          if (Array.isArray(msgs)) {
            let changed = false;
            msgs.forEach(m => {
              if (!m.is_read) {
                m.is_read = true;
                changed = true;
              }
            });
            if (changed) {
              await serverSupabase
                .from('admin_settings')
                .upsert({
                  key: 'chat_msgs_' + id,
                  value: JSON.stringify(msgs)
                }, { onConflict: 'key' });
            }
          }
        }
      } catch (e) {
        console.error('Error updating read status in admin_settings:', e);
      }
    }

    // 2. Mark local messages as read for this chat room
    try {
      const allMsgs = getMessages();
      let updated = false;
      allMsgs.forEach(m => {
        if (m.chat_id === id && !m.is_read) {
          m.is_read = true;
          updated = true;
        }
      });

      if (updated) {
        saveMessages(allMsgs);
      }
    } catch (e) {}

    // 3. Mark Supabase messages as read if UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isValidUUID && serverSupabase) {
      try {
        await serverSupabase
          .from('messages')
          .update({ is_read: true })
          .eq('chat_id', id);
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
