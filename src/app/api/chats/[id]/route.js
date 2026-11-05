import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../lib/serverSupabase';
import { getGlobalListings } from '../../../../lib/globalListingsStore';
import { getChats, deleteChat } from '../../../../lib/chatsStore';
import { getUserLastSeen } from '../../../../lib/userPresenceStore';

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

    let chat = null;

    // 1. Check cloud persistent all_chats_list from admin_settings
    if (serverSupabase) {
      try {
        const { data: row, error: rowErr } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'all_chats_list')
          .maybeSingle();
        if (rowErr) {
          console.error('Error fetching all_chats_list in chats/[id]:', rowErr);
        }
        if (row?.value) {
          const list = JSON.parse(row.value);
          if (Array.isArray(list)) {
            chat = list.find(c => c.id === id) || null;
          }
        }
      } catch (e) {
        console.error('Exception reading all_chats_list:', e);
      }
    }

    // 2. If valid UUID, try querying Supabase DB / RPC
    if (!chat && isValidUUID && serverSupabase) {
      try {
        const { data: rpcChat, error: rpcErr } = await serverSupabase.rpc('get_chat_details_v2', {
          p_chat_id: id
        });
        if (!rpcErr && rpcChat) {
          chat = rpcChat;
        } else {
          const { data: directChat } = await serverSupabase
            .from('chats')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (directChat) chat = directChat;
        }
      } catch (sbErr) {
        console.error('Supabase get_chat error:', sbErr);
      }
    }

    // 3. Fallback to local chatsStore
    if (!chat) {
      const localChats = getChats();
      chat = localChats.find(c => c.id === id) || null;
    }

    // 4. If still not found, check if chat_msgs_${id} exists in admin_settings
    if (!chat && serverSupabase) {
      try {
        const { data: row } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'chat_msgs_' + id)
          .maybeSingle();
        if (row?.value) {
          const msgs = JSON.parse(row.value);
          if (Array.isArray(msgs) && msgs.length > 0) {
            chat = {
              id,
              listing_id: 'unknown',
              buyer_id: msgs[0].sender_id,
              seller_id: 'seller',
              created_at: msgs[0].created_at
            };
          }
        }
      } catch (e) {}
    }

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // 5. Fetch listing details
    let listing = null;
    try {
      const globalListings = getGlobalListings();
      listing = globalListings.find(l => String(l.id) === String(chat.listing_id));

      if (!listing && serverSupabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chat.listing_id)) {
        const { data } = await serverSupabase
          .from('listings')
          .select('title, images, price, location')
          .eq('id', chat.listing_id)
          .maybeSingle();
        if (data) listing = data;
      }
    } catch (e) {
      console.error('Error fetching listing details:', e);
    }
    chat.listing = listing || { title: 'BikroyNow Item', images: ['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800'] };

    // 6. Fetch buyer and seller profiles (supporting UUIDs, emails, and usernames)
    let buyer = null;
    let seller = null;

    if (serverSupabase) {
      try {
        const { data: allProfs } = await serverSupabase.from('profiles').select('id, email, full_name, avatar_url, last_seen');
        if (allProfs && allProfs.length > 0) {
          const findProf = (targetId) => {
            if (!targetId) return null;
            const cleanTarget = String(targetId).toLowerCase().trim();
            let p = allProfs.find(x => x.id === targetId || x.email?.toLowerCase() === cleanTarget);
            if (!p) {
              p = allProfs.find(x => x.email && 'user-' + x.email.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget);
            }
            return p;
          };

          buyer = findProf(chat.buyer_id);
          seller = findProf(chat.seller_id);
        }
      } catch (e) {
        console.error('Error fetching partner profiles:', e);
      }
    }

    chat.buyer = buyer || { full_name: 'ক্রেতা (Buyer)' };
    chat.seller = seller || { full_name: 'বিক্রেতা (Seller)' };

    chat.buyer.last_seen = getUserLastSeen(chat.buyer_id, chat.buyer?.email, chat.buyer?.last_seen);
    chat.seller.last_seen = getUserLastSeen(chat.seller_id, chat.seller?.email, chat.seller?.last_seen);

    return NextResponse.json({ success: true, chat }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (e) {
    console.error('Error fetching chat details:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json({ error: 'Chat ID missing' }, { status: 400 });
    }

    const serverSupabase = getServerSupabase();
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 1. Remove chat from persistent all_chats_list in admin_settings
    if (serverSupabase) {
      try {
        const { data: row } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'all_chats_list')
          .maybeSingle();

        if (row?.value) {
          try {
            const list = JSON.parse(row.value);
            if (Array.isArray(list)) {
              const updated = list.filter(c => c.id !== id);
              await serverSupabase
                .from('admin_settings')
                .upsert({ key: 'all_chats_list', value: JSON.stringify(updated) }, { onConflict: 'key' });
            }
          } catch (e) {
            console.error('Error parsing all_chats_list on delete:', e);
          }
        }
      } catch (e) {
        console.error('Error removing from all_chats_list:', e);
      }

      // 2. Remove all messages for this chat in admin_settings
      try {
        await serverSupabase
          .from('admin_settings')
          .delete()
          .eq('key', 'chat_msgs_' + id);
      } catch (e) {
        console.error('Error deleting chat_msgs in admin_settings:', e);
      }

      // 3. Add to persistent deleted_chat_ids list in admin_settings
      try {
        const { data: delRow } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'deleted_chat_ids')
          .maybeSingle();

        let deletedIds = [];
        if (delRow?.value) {
          try {
            deletedIds = JSON.parse(delRow.value);
          } catch (e) {}
        }
        if (!Array.isArray(deletedIds)) deletedIds = [];
        if (!deletedIds.includes(id)) {
          deletedIds.push(id);
          if (deletedIds.length > 2000) deletedIds = deletedIds.slice(-2000);
          await serverSupabase
            .from('admin_settings')
            .upsert({ key: 'deleted_chat_ids', value: JSON.stringify(deletedIds) }, { onConflict: 'key' });
        }
      } catch (e) {
        console.error('Error updating deleted_chat_ids:', e);
      }

      // 4. If Supabase DB table exists and valid UUID, delete from messages & chats tables
      if (isValidUUID) {
        try {
          await serverSupabase.from('messages').delete().eq('chat_id', id);
          await serverSupabase.from('chats').delete().eq('id', id);
        } catch (dbErr) {
          console.error('Error deleting from Supabase tables:', dbErr);
        }
      }
    }

    // 5. Delete from local chatsStore
    try {
      if (typeof deleteChat === 'function') {
        deleteChat(id);
      }
    } catch (e) {
      console.error('Error calling deleteChat in store:', e);
    }

    return NextResponse.json({ success: true, message: 'Chat deleted successfully' });
  } catch (err) {
    console.error('Error in DELETE /api/chats/[id]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
