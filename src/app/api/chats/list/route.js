import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGlobalListings } from '../../../../lib/globalListingsStore';
import { getChats, getMessages } from '../../../../lib/chatsStore';
import { getUserLastSeen } from '../../../../lib/userPresenceStore';

export const dynamic = 'force-dynamic';



export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = (supabaseUrl && serviceRoleKey)
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : null;

    // Build complete set of aliases for the current user
    const userAliases = new Set([userId, String(userId).toLowerCase()]);

    let userEmail = null;
    let profilesMap = new Map();

    if (serverSupabase) {
      try {
        const { data: allProfs } = await serverSupabase.from('profiles').select('id, email, full_name, avatar_url, last_seen');
        if (allProfs) {
          allProfs.forEach(p => {
            profilesMap.set(p.id, p);
            if (p.email) {
              profilesMap.set(p.email.toLowerCase(), p);
              profilesMap.set('user-' + p.email.toLowerCase().replace(/[^a-z0-9]/g, ''), p);
            }
          });

          const currentProf = allProfs.find(p => 
            p.id === userId || 
            p.email?.toLowerCase() === String(userId).toLowerCase() || 
            (p.email && 'user-' + p.email.toLowerCase().replace(/[^a-z0-9]/g, '') === String(userId).toLowerCase())
          );

          if (currentProf?.email) {
            userEmail = currentProf.email.toLowerCase();
            userAliases.add(userEmail);
            userAliases.add('user-' + userEmail.replace(/[^a-z0-9]/g, ''));
            userAliases.add(currentProf.id);
          }


        }
      } catch (e) {}
    }

    // Also collect all listings belonging to this user
    const myListingIds = new Set();
    if (serverSupabase) {
      try {
        const uuidList = Array.from(userAliases).filter(a => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a));
        if (uuidList.length > 0) {
          const { data: myListings } = await serverSupabase
            .from('listings')
            .select('id')
            .in('user_id', uuidList);
          if (Array.isArray(myListings)) {
            myListings.forEach(l => myListingIds.add(String(l.id)));
          }
        }
      } catch (e) {}
    }

    // Gather all candidate chats from all sources
    const allCandidateChats = [];

    // 1. Supabase chats table
    if (serverSupabase) {
      try {
        const uuidList = Array.from(userAliases).filter(a => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a));
        if (uuidList.length > 0) {
          const { data: directChats } = await serverSupabase
            .from('chats')
            .select('*')
            .or(`buyer_id.in.(${uuidList.join(',')}),seller_id.in.(${uuidList.join(',')})`);
          if (Array.isArray(directChats)) {
            directChats.forEach(c => allCandidateChats.push(c));
          }
        }
      } catch (e) {}
    }

    // 2. Cloud persistent all_chats_list from admin_settings
    if (serverSupabase) {
      try {
        const { data: row } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'all_chats_list')
          .maybeSingle();
        if (row?.value) {
          const cloudList = JSON.parse(row.value);
          if (Array.isArray(cloudList)) {
            cloudList.forEach(c => allCandidateChats.push(c));
          }
        }
      } catch (e) {}
    }

    // 3. Local chatsStore
    const localChats = getChats();
    localChats.forEach(c => allCandidateChats.push(c));

    // Deduplicate candidate chats by id and filter for this user
    const seenChatIds = new Set();
    const myChats = [];

    allCandidateChats.forEach(c => {
      if (!c?.id || seenChatIds.has(c.id)) return;
      const isBuyer = userAliases.has(c.buyer_id) || userAliases.has(String(c.buyer_id).toLowerCase());
      const isSeller = userAliases.has(c.seller_id) || userAliases.has(String(c.seller_id).toLowerCase()) || myListingIds.has(String(c.listing_id));
      if (isBuyer || isSeller) {
        seenChatIds.add(c.id);
        myChats.push(c);
      }
    });

    const globalListings = getGlobalListings();
    const allLocalMsgs = getMessages();

    // Enrich chats with listing, partner profile, lastMsg, unreadCount
    const enriched = await Promise.all(myChats.map(async (chat) => {
      const isBuyer = userAliases.has(chat.buyer_id) || userAliases.has(String(chat.buyer_id).toLowerCase());
      const partnerId = isBuyer ? chat.seller_id : chat.buyer_id;

      // 1. Get listing
      let listing = globalListings.find(l => String(l.id) === String(chat.listing_id));
      if (!listing && serverSupabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chat.listing_id)) {
        try {
          const { data } = await serverSupabase
            .from('listings')
            .select('title, images, price')
            .eq('id', chat.listing_id)
            .maybeSingle();
          if (data) listing = data;
        } catch (e) {}
      }
      chat.listing = listing || { title: 'BikroyNow Item', images: ['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800'] };

      // 2. Get partner profile
      let partner = profilesMap.get(partnerId) || profilesMap.get(String(partnerId).toLowerCase()) || null;
      if (!partner && serverSupabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerId)) {
        try {
          const { data } = await serverSupabase
            .from('profiles')
            .select('full_name, avatar_url, last_seen, email')
            .eq('id', partnerId)
            .maybeSingle();
          if (data) partner = data;
        } catch (e) {}
      }
      chat.partner = partner || { full_name: isBuyer ? 'বিক্রেতা (Seller)' : 'ক্রেতা (Buyer)' };

      // 3. Get messages for this chat (from all_settings + db + local)
      let chatMsgs = [];
      const seenMsgIds = new Set();

      // Cloud messages from admin_settings
      if (serverSupabase) {
        try {
          const { data: row } = await serverSupabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'chat_msgs_' + chat.id)
            .maybeSingle();
          if (row?.value) {
            const arr = JSON.parse(row.value);
            if (Array.isArray(arr)) {
              arr.forEach(m => {
                if (m.id && !seenMsgIds.has(m.id)) {
                  seenMsgIds.add(m.id);
                  chatMsgs.push(m);
                }
              });
            }
          }
        } catch (e) {}
      }

      // Supabase messages table if UUID
      if (serverSupabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chat.id)) {
        try {
          const { data: msgs } = await serverSupabase
            .from('messages')
            .select('*')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: true });
          if (Array.isArray(msgs)) {
            msgs.forEach(m => {
              if (m.id && !seenMsgIds.has(m.id)) {
                seenMsgIds.add(m.id);
                chatMsgs.push(m);
              }
            });
          }
        } catch (e) {}
      }

      // Local store messages
      const chatLocalMsgs = allLocalMsgs.filter(m => m.chat_id === chat.id);
      chatLocalMsgs.forEach(m => {
        if (m.id && !seenMsgIds.has(m.id)) {
          seenMsgIds.add(m.id);
          chatMsgs.push(m);
        }
      });

      chatMsgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      let lastMsg = null;
      let unreadCount = 0;
      if (chatMsgs.length > 0) {
        lastMsg = chatMsgs[chatMsgs.length - 1];
        unreadCount = chatMsgs.filter(m => !m.is_read && !userAliases.has(m.sender_id) && !userAliases.has(String(m.sender_id).toLowerCase())).length;
      }

      const partnerWithLiveStatus = chat.partner ? {
        ...chat.partner,
        last_seen: getUserLastSeen(partnerId, chat.partner?.email, chat.partner?.last_seen)
      } : null;

      return {
        ...chat,
        listing: chat.listing,
        partner: partnerWithLiveStatus,
        lastMsg,
        unreadCount
      };
    }));

    // Filter out chats linked to non-existent demo ads that have no messages
    const validChats = enriched.filter(chat => {
      const isDemoId = String(chat.listing_id).startsWith('ad-1787678324480');
      if (isDemoId && !chat.lastMsg) return false;
      return true;
    });

    const sorted = validChats.sort((a, b) => {
      const tA = a.lastMsg?.created_at || a.updated_at || a.created_at;
      const tB = b.lastMsg?.created_at || b.updated_at || b.created_at;
      return new Date(tB) - new Date(tA);
    });

    return NextResponse.json({ success: true, chats: sorted }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (e) {
    console.error('Error fetching chats list:', e);
    return NextResponse.json({ error: e.message, chats: [] }, { status: 500 });
  }
}
