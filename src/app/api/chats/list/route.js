import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../lib/serverSupabase';
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

    const serverSupabase = getServerSupabase();

    // Build complete set of aliases for the current user
    const userAliases = new Set([userId, String(userId).toLowerCase()]);

    let userEmail = null;
    let profilesMap = new Map();

    if (serverSupabase) {
      try {
        const { data: allProfs, error: profsErr } = await serverSupabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, last_seen');
        if (profsErr) {
          console.error('Error fetching profiles in chats/list:', profsErr);
        }
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
      } catch (e) {
        console.error('Exception fetching profiles:', e);
      }
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

    // 1. Cloud persistent all_chats_list from admin_settings
    if (serverSupabase) {
      try {
        const { data: row, error: rowErr } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'all_chats_list')
          .maybeSingle();
        if (rowErr) {
          console.error('Error fetching all_chats_list in chats/list:', rowErr);
        }
        if (row?.value) {
          const cloudList = JSON.parse(row.value);
          if (Array.isArray(cloudList)) {
            cloudList.forEach(c => allCandidateChats.push(c));
          }
        }
      } catch (e) {
        console.error('Exception loading all_chats_list:', e);
      }
    }

    // 2. Supabase chats table (if UUID)
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

    // 3. Local chatsStore fallback
    const localChats = getChats();
    localChats.forEach(c => allCandidateChats.push(c));

    // Load per-user deleted chat IDs for this specific user
    const userDeletedChatIds = new Set();
    if (serverSupabase) {
      try {
        const { data: mapRow } = await serverSupabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'user_deleted_chats')
          .maybeSingle();

        if (mapRow?.value) {
          const userDeletedMap = JSON.parse(mapRow.value);
          if (userDeletedMap && typeof userDeletedMap === 'object') {
            userAliases.forEach(alias => {
              const list = userDeletedMap[alias];
              if (Array.isArray(list)) {
                list.forEach(cid => userDeletedChatIds.add(cid));
              }
            });
          }
        }
      } catch (e) {}
    }

    // Deduplicate candidate chats by id, filter out chats deleted for THIS user only, and filter for this user
    const seenChatIds = new Set();
    const myChats = [];

    allCandidateChats.forEach(c => {
      if (!c?.id || seenChatIds.has(c.id)) return;

      // Check if deleted for this user
      if (userDeletedChatIds.has(c.id)) return;
      if (Array.isArray(c.deleted_for) && c.deleted_for.some(a => userAliases.has(a) || userAliases.has(String(a).toLowerCase()))) {
        return;
      }

      const isBuyer = userAliases.has(c.buyer_id) || userAliases.has(String(c.buyer_id).toLowerCase());
      const isSeller = userAliases.has(c.seller_id) || userAliases.has(String(c.seller_id).toLowerCase()) || myListingIds.has(String(c.listing_id));
      if (isBuyer || isSeller) {
        seenChatIds.add(c.id);
        myChats.push(c);
      }
    });

    const globalListings = getGlobalListings();
    const allLocalMsgs = getMessages();

    // 1. Batch fetch missing listings in a single query
    const listingsMap = new Map();
    globalListings.forEach(l => listingsMap.set(String(l.id), l));

    const missingListingIds = Array.from(new Set(
      myChats
        .map(c => String(c.listing_id))
        .filter(id => !listingsMap.has(id) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    ));

    if (serverSupabase && missingListingIds.length > 0) {
      try {
        const { data: dbListings } = await serverSupabase
          .from('listings')
          .select('id, title, images, price')
          .in('id', missingListingIds);
        if (Array.isArray(dbListings)) {
          dbListings.forEach(l => listingsMap.set(String(l.id), l));
        }
      } catch (e) {}
    }

    // 2. Batch fetch admin_settings chat messages in a single query
    const adminMsgsMap = new Map();
    if (serverSupabase && myChats.length > 0) {
      try {
        const chatKeys = myChats.map(c => 'chat_msgs_' + c.id);
        const { data: msgRows } = await serverSupabase
          .from('admin_settings')
          .select('key, value')
          .in('key', chatKeys);
        if (Array.isArray(msgRows)) {
          msgRows.forEach(row => {
            if (row?.value) {
              try {
                const arr = JSON.parse(row.value);
                if (Array.isArray(arr)) adminMsgsMap.set(row.key, arr);
              } catch (_) {}
            }
          });
        }
      } catch (e) {}
    }

    // 3. Batch fetch supabase messages table in a single query
    const dbMsgsMap = new Map();
    const uuidChatIds = myChats
      .map(c => c.id)
      .filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    if (serverSupabase && uuidChatIds.length > 0) {
      try {
        const { data: dbMsgs } = await serverSupabase
          .from('messages')
          .select('*')
          .in('chat_id', uuidChatIds)
          .order('created_at', { ascending: true });
        if (Array.isArray(dbMsgs)) {
          dbMsgs.forEach(m => {
            if (!dbMsgsMap.has(m.chat_id)) dbMsgsMap.set(m.chat_id, []);
            dbMsgsMap.get(m.chat_id).push(m);
          });
        }
      } catch (e) {}
    }

    // 4. Enrich chats 100% in-memory with zero network overhead
    const enriched = myChats.map((chat) => {
      const isBuyer = userAliases.has(chat.buyer_id) || userAliases.has(String(chat.buyer_id).toLowerCase());
      const partnerId = isBuyer ? chat.seller_id : chat.buyer_id;

      // Listing resolution
      const listing = listingsMap.get(String(chat.listing_id)) || {
        title: 'BikroyNow Item',
        images: ['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800']
      };

      // Partner resolution
      const partner = profilesMap.get(partnerId) || profilesMap.get(String(partnerId).toLowerCase()) || {
        full_name: isBuyer ? 'বিক্রেতা (Seller)' : 'ক্রেতা (Buyer)'
      };

      // Messages resolution
      const chatMsgs = [];
      const seenMsgIds = new Set();

      const cloudArr = adminMsgsMap.get('chat_msgs_' + chat.id);
      if (Array.isArray(cloudArr)) {
        cloudArr.forEach(m => {
          if (m?.id && !seenMsgIds.has(m.id)) {
            seenMsgIds.add(m.id);
            chatMsgs.push(m);
          }
        });
      }

      const dbArr = dbMsgsMap.get(chat.id);
      if (Array.isArray(dbArr)) {
        dbArr.forEach(m => {
          if (m?.id && !seenMsgIds.has(m.id)) {
            seenMsgIds.add(m.id);
            chatMsgs.push(m);
          }
        });
      }

      const localArr = allLocalMsgs.filter(m => m.chat_id === chat.id);
      localArr.forEach(m => {
        if (m?.id && !seenMsgIds.has(m.id)) {
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

      const partnerWithLiveStatus = partner ? {
        ...partner,
        last_seen: getUserLastSeen(partnerId, partner?.email, partner?.last_seen)
      } : null;

      return {
        ...chat,
        listing,
        partner: partnerWithLiveStatus,
        lastMsg,
        unreadCount
      };
    });

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

    return NextResponse.json({
      success: true,
      chats: sorted
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (e) {
    console.error('Error fetching chats list:', e);
    return NextResponse.json({ error: e.message, chats: [] }, { status: 500 });
  }
}
