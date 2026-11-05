import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../../lib/serverSupabase';
import { getMessages, saveMessages } from '../../../../../lib/chatsStore';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json({ error: 'Chat ID missing' }, { status: 400 });
    }

    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const serverSupabase = getServerSupabase();

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
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json({ error: 'Chat ID missing' }, { status: 400 });
    }

    const { sender_id, content, image_url } = await req.json();

    if (!content && !image_url) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    const serverSupabase = getServerSupabase();

    // 0. Check Block Status between sender and partner
    let partnerId = null;
    if (serverSupabase) {
      try {
        const { data: chatsRow } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'all_chats_list')
          .maybeSingle();

        if (chatsRow?.value) {
          const allChats = JSON.parse(chatsRow.value);
          if (Array.isArray(allChats)) {
            const currentChat = allChats.find(c => c.id === id);
            if (currentChat) {
              const cleanSender = String(sender_id).toLowerCase().trim();
              const bStr = String(currentChat.buyer_id).toLowerCase().trim();
              const sStr = String(currentChat.seller_id).toLowerCase().trim();
              const isSenderBuyer = (cleanSender === bStr || cleanSender.includes(bStr) || bStr.includes(cleanSender));
              partnerId = isSenderBuyer ? currentChat.seller_id : currentChat.buyer_id;
            }
          }
        }

        if (partnerId) {
          const { data: blockRow } = await serverSupabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'blocked_users')
            .maybeSingle();

          if (blockRow?.value) {
            const blockedList = JSON.parse(blockRow.value);
            if (Array.isArray(blockedList)) {
              const cleanSender = String(sender_id).toLowerCase().trim();
              const cleanPartner = String(partnerId).toLowerCase().trim();

              const blockedByPartner = blockedList.some(item => {
                const b1 = String(item.blocker_id || '').toLowerCase().trim();
                const b2 = String(item.blocked_id || '').toLowerCase().trim();
                return (b1 === cleanPartner || cleanPartner.includes(b1)) && (b2 === cleanSender || cleanSender.includes(b2));
              });

              if (blockedByPartner) {
                return NextResponse.json({ 
                  error: 'এই ব্যবহারকারী আপনাকে ব্লক করেছেন। আপনি আর কোনো বার্তা পাঠাতে পারবেন না।' 
                }, { status: 403 });
              }

              const senderBlockedPartner = blockedList.some(item => {
                const b1 = String(item.blocker_id || '').toLowerCase().trim();
                const b2 = String(item.blocked_id || '').toLowerCase().trim();
                return (b1 === cleanSender || cleanSender.includes(b1)) && (b2 === cleanPartner || cleanPartner.includes(b2));
              });

              if (senderBlockedPartner) {
                return NextResponse.json({ 
                  error: 'আপনি এই ব্যবহারকারীকে ব্লক করেছেন। বার্তা পাঠাতে আগে আনব্লক করুন।' 
                }, { status: 400 });
              }
            }
          }
        }
      } catch (err) {
        console.error('Error in block status check:', err);
      }
    }

    const newMsg = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      chat_id: id,
      sender_id,
      content: content || null,
      image_url: image_url || null,
      created_at: new Date().toISOString(),
      is_read: false
    };

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

        // Update updated_at in all_chats_list to bump conversation to top
        const { data: chatsRow } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'all_chats_list')
          .maybeSingle();

        if (chatsRow?.value) {
          const allChats = JSON.parse(chatsRow.value);
          if (Array.isArray(allChats)) {
            const currentChat = allChats.find(c => c.id === id);
            if (currentChat) {
              currentChat.updated_at = newMsg.created_at;
              // If receiver had deleted chat previously, un-hide it upon incoming message
              if (Array.isArray(currentChat.deleted_for) && partnerId) {
                currentChat.deleted_for = currentChat.deleted_for.filter(a => String(a).toLowerCase() !== String(partnerId).toLowerCase());
              }
              await serverSupabase
                .from('admin_settings')
                .upsert({
                  key: 'all_chats_list',
                  value: JSON.stringify(allChats)
                }, { onConflict: 'key' });
            }
          }
        }
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
