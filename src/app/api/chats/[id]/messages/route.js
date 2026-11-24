import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../../lib/serverSupabase';
import { getMessages, saveMessages } from '../../../../../lib/chatsStore';
import { sendPushNotificationToUser } from '../../../../../lib/pushSender';

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

    let partnerId = null;
    let allChats = [];
    let msgsList = [];

    // Parallel Read: Fetch all_chats_list, blocked_users, and chat_msgs simultaneously
    if (serverSupabase) {
      try {
        const [chatsRow, blockRow, msgsRow] = await Promise.all([
          serverSupabase.from('admin_settings').select('value').eq('key', 'all_chats_list').maybeSingle(),
          serverSupabase.from('admin_settings').select('value').eq('key', 'blocked_users').maybeSingle(),
          serverSupabase.from('admin_settings').select('value').eq('key', 'chat_msgs_' + id).maybeSingle()
        ]);

        if (chatsRow?.data?.value) {
          try { allChats = JSON.parse(chatsRow.data.value); } catch (_) {}
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

        if (!partnerId) {
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          if (isValidUUID) {
            const { data: dbChat } = await serverSupabase
              .from('chats')
              .select('buyer_id, seller_id')
              .eq('id', id)
              .maybeSingle();
            if (dbChat) {
              const cleanSender = String(sender_id).toLowerCase().trim();
              const bStr = String(dbChat.buyer_id).toLowerCase().trim();
              partnerId = (cleanSender === bStr || cleanSender.includes(bStr) || bStr.includes(cleanSender))
                ? dbChat.seller_id
                : dbChat.buyer_id;
            }
          }
        }

        // Check Block Status between sender and partner
        if (partnerId && blockRow?.data?.value) {
          try {
            const blockedList = JSON.parse(blockRow.data.value);
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
          } catch (_) {}
        }

        if (msgsRow?.data?.value) {
          try { msgsList = JSON.parse(msgsRow.data.value); } catch (_) {}
        }
      } catch (err) {
        console.error('Parallel read error in messages POST:', err);
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

    if (!Array.isArray(msgsList)) msgsList = [];
    msgsList.push(newMsg);

    // Update conversation timestamp
    if (Array.isArray(allChats)) {
      const currentChat = allChats.find(c => c.id === id);
      if (currentChat) {
        currentChat.updated_at = newMsg.created_at;
        if (Array.isArray(currentChat.deleted_for) && partnerId) {
          currentChat.deleted_for = currentChat.deleted_for.filter(a => String(a).toLowerCase() !== String(partnerId).toLowerCase());
        }
      }
    }

    // Parallel Writes & Push: Write msgs, update chat list, insert to DB and fire push notification all at once
    if (serverSupabase) {
      const parallelTasks = [
        serverSupabase.from('admin_settings').upsert({
          key: 'chat_msgs_' + id,
          value: JSON.stringify(msgsList)
        }, { onConflict: 'key' }),
        serverSupabase.from('admin_settings').upsert({
          key: 'all_chats_list',
          value: JSON.stringify(allChats)
        }, { onConflict: 'key' })
      ];

      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isValidUUID) {
        parallelTasks.push(
          serverSupabase.from('messages').insert({
            chat_id: id,
            sender_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sender_id) ? sender_id : null,
            content: content || null,
            image_url: image_url || null,
            is_read: false
          }).then(() => {}).catch(() => {})
        );
      }

      if (partnerId) {
        const msgSnippet = content ? (content.length > 80 ? content.substring(0, 77) + '...' : content) : (image_url ? '📷 [ছবি]' : 'নতুন মেসেজ এসেছে');
        const unreadForPartner = Array.isArray(msgsList)
          ? Math.max(1, msgsList.filter(m => !m.is_read && m.sender_id !== partnerId).length)
          : 1;
        parallelTasks.push(
          sendPushNotificationToUser(partnerId, {
            title: 'BikroyNow: নতুন মেসেজ এসেছে 💬',
            body: msgSnippet,
            url: `/chat/${id}`,
            tag: `chat-msg-${id}-${Date.now()}`,
            unreadCount: unreadForPartner,
            badgeCount: unreadForPartner
          }).catch(err => console.warn('Background push delivery error:', err))
        );
      }

      await Promise.all(parallelTasks);
    }

    // Local fallback store
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
