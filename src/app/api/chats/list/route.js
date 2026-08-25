import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGlobalListings } from '../../../../lib/globalListingsStore';
import { getChats, getMessages } from '../../../../lib/chatsStore';
import { getUserLastSeen } from '../../../../lib/userPresenceStore';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = [
  'anikh0000@gmail.com',
  'anikh00000@gmail.com',
  'anikh00@gmail.com',
  'aunik008@gmail.com',
  'aunik003@gmail.com'
];

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 });
    }

    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = (supabaseUrl && serviceRoleKey)
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : null;

    // Build complete set of aliases for the current user
    const userAliases = new Set([userId]);

    let userEmail = null;
    if (serverSupabase) {
      try {
        const { data: allProfs } = await serverSupabase.from('profiles').select('id, email, full_name, avatar_url');
        if (allProfs) {
          const currentProf = allProfs.find(p => p.id === userId || (p.email && 'user-' + p.email.toLowerCase().replace(/[^a-z0-9]/g, '') === userId));
          if (currentProf?.email) {
            userEmail = currentProf.email.toLowerCase();
            userAliases.add(userEmail);
            userAliases.add('user-' + userEmail.replace(/[^a-z0-9]/g, ''));
          }

          // If the account belongs to the admin/test accounts pool, include all admin aliases so chats are never lost
          if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
            ADMIN_EMAILS.forEach(em => {
              userAliases.add(em);
              userAliases.add('user-' + em.replace(/[^a-z0-9]/g, ''));
            });
            allProfs.forEach(p => {
              if (p.email && ADMIN_EMAILS.includes(p.email.toLowerCase())) {
                userAliases.add(p.id);
              }
            });
          }
        }
      } catch (e) {}
    }

    let myChats = [];

    // 1. Query Supabase DB
    if (serverSupabase) {
      try {
        const uuidList = Array.from(userAliases).filter(a => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a));
        if (uuidList.length > 0) {
          const { data: directChats } = await serverSupabase
            .from('chats')
            .select('*')
            .or(`buyer_id.in.(${uuidList.join(',')}),seller_id.in.(${uuidList.join(',')})`)
            .order('updated_at', { ascending: false });

          if (Array.isArray(directChats)) {
            myChats = directChats;
          }
        }
      } catch (e) {}
    }

    // 2. Include chats from local chatsStore
    const localChats = getChats().filter(c => userAliases.has(c.buyer_id) || userAliases.has(c.seller_id));
    const seenChatIds = new Set(myChats.map(c => c.id));
    localChats.forEach(c => {
      if (!seenChatIds.has(c.id)) {
        seenChatIds.add(c.id);
        myChats.push(c);
      }
    });

    const globalListings = getGlobalListings();
    const allLocalMsgs = getMessages();

    // Map profiles for fast partner lookup
    let profilesMap = new Map();
    if (serverSupabase) {
      try {
        const { data: profs } = await serverSupabase.from('profiles').select('id, email, full_name, avatar_url, last_seen');
        if (profs) {
          profs.forEach(p => {
            profilesMap.set(p.id, p);
            if (p.email) {
              profilesMap.set(p.email.toLowerCase(), p);
              profilesMap.set('user-' + p.email.toLowerCase().replace(/[^a-z0-9]/g, ''), p);
            }
          });
        }
      } catch (e) {}
    }

    // Build exact identifiers for the current viewer (to distinguish messages sent by self vs partner)
    const currentViewerIds = new Set([
      userId,
      userEmail,
      userEmail ? 'user-' + userEmail.replace(/[^a-z0-9]/g, '') : null
    ].filter(Boolean));

    const enriched = await Promise.all((myChats || []).map(async (chat) => {
      const isBuyer = userAliases.has(chat.buyer_id);
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
      let partner = profilesMap.get(partnerId) || null;
      if (!partner && serverSupabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partnerId)) {
        try {
          const { data } = await serverSupabase
            .from('profiles')
            .select('full_name, avatar_url, last_seen')
            .eq('id', partnerId)
            .maybeSingle();
          if (data) partner = data;
        } catch (e) {}
      }
      chat.partner = partner || { full_name: isBuyer ? 'বিক্রেতা (Seller)' : 'ক্রেতা (Buyer)' };

      // 3. Get last message and unread count
      let lastMsg = null;
      let unreadCount = 0;

      const chatLocalMsgs = allLocalMsgs.filter(m => m.chat_id === chat.id);
      if (chatLocalMsgs.length > 0) {
        lastMsg = chatLocalMsgs[chatLocalMsgs.length - 1];
        unreadCount = chatLocalMsgs.filter(m => !m.is_read && !currentViewerIds.has(m.sender_id)).length;
      } else if (serverSupabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chat.id)) {
        try {
          const { data: msgs } = await serverSupabase
            .from('messages')
            .select('*')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: true });
          if (msgs && msgs.length > 0) {
            lastMsg = msgs[msgs.length - 1];
            unreadCount = msgs.filter(m => !m.is_read && !currentViewerIds.has(m.sender_id)).length;
          }
        } catch (e) {}
      }

      const partnerWithLiveStatus = chat.partner ? {
        ...chat.partner,
        last_seen: getUserLastSeen(partnerId, chat.partner.email, chat.partner.last_seen)
      } : null;

      return {
        ...chat,
        listing: chat.listing,
        partner: partnerWithLiveStatus,
        lastMsg,
        unreadCount
      };
    }));

    const sorted = enriched.sort((a, b) => {
      const tA = a.lastMsg?.created_at || a.updated_at || a.created_at;
      const tB = b.lastMsg?.created_at || b.updated_at || b.created_at;
      return new Date(tB) - new Date(tA);
    });

    return NextResponse.json({ success: true, chats: sorted });
  } catch (e) {
    console.error('Error fetching chats list:', e);
    return NextResponse.json({ error: e.message, chats: [] }, { status: 500 });
  }
}
