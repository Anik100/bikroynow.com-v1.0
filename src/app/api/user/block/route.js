import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../lib/serverSupabase';

export const dynamic = 'force-dynamic';

/**
 * Helper to get all aliases for a user (ID, email, user-email)
 */
async function getUserAliases(userId, serverSupabase) {
  const aliases = new Set();
  if (!userId) return aliases;

  const raw = String(userId).trim();
  aliases.add(raw);
  aliases.add(raw.toLowerCase());

  if (raw.startsWith('user-')) {
    aliases.add(raw.substring(5).toLowerCase());
  }

  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

  if (serverSupabase) {
    try {
      let query = serverSupabase.from('profiles').select('id, email');
      if (isValidUUID) {
        query = query.eq('id', raw);
      } else if (raw.includes('@')) {
        query = query.ilike('email', raw);
      } else {
        query = query.ilike('email', `%${raw.replace(/^user-/, '')}%`);
      }

      const { data: prof } = await query.maybeSingle();

      if (prof) {
        if (prof.id) {
          aliases.add(prof.id);
          aliases.add(String(prof.id).toLowerCase());
        }
        if (prof.email) {
          const em = prof.email.toLowerCase().trim();
          aliases.add(em);
          aliases.add('user-' + em.replace(/[^a-z0-9]/g, ''));
        }
      }
    } catch (e) {
      console.error('Error resolving user aliases in block:', e);
    }
  }

  return aliases;
}

/**
 * GET /api/user/block?user_id=...&partner_id=...
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const partnerId = searchParams.get('partner_id');

    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const serverSupabase = getServerSupabase();
    if (!serverSupabase) {
      return NextResponse.json({ is_blocked_by_me: false, is_blocked_by_them: false });
    }

    const [myAliases, partnerAliases] = await Promise.all([
      getUserAliases(userId, serverSupabase),
      partnerId ? getUserAliases(partnerId, serverSupabase) : Promise.resolve(new Set())
    ]);

    let blockedList = [];
    try {
      const { data: row } = await serverSupabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'blocked_users')
        .maybeSingle();

      if (row?.value) {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) blockedList = parsed;
      }
    } catch (e) {
      console.error('Error fetching blocked_users:', e);
    }

    let isBlockedByMe = false;
    let isBlockedByThem = false;

    if (partnerId) {
      for (const item of blockedList) {
        const itemBlocker = String(item.blocker_id || item.blocker || '').toLowerCase().trim();
        const itemBlocked = String(item.blocked_id || item.blocked || '').toLowerCase().trim();

        if (myAliases.has(itemBlocker) && partnerAliases.has(itemBlocked)) {
          isBlockedByMe = true;
        }

        if (partnerAliases.has(itemBlocker) && myAliases.has(itemBlocked)) {
          isBlockedByThem = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      is_blocked_by_me: isBlockedByMe,
      is_blocked_by_them: isBlockedByThem
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (err) {
    console.error('Error in GET /api/user/block:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/user/block
 * Body: { action: 'block' | 'unblock', blocker_id, blocked_id }
 */
export async function POST(req) {
  try {
    const { action, blocker_id, blocked_id } = await req.json();

    if (!blocker_id || !blocked_id) {
      return NextResponse.json({ error: 'Missing blocker_id or blocked_id' }, { status: 400 });
    }

    const serverSupabase = getServerSupabase();
    if (!serverSupabase) {
      return NextResponse.json({ error: 'Database client unavailable' }, { status: 500 });
    }

    const [blockerAliases, blockedAliases] = await Promise.all([
      getUserAliases(blocker_id, serverSupabase),
      getUserAliases(blocked_id, serverSupabase)
    ]);

    let blockedList = [];
    try {
      const { data: row } = await serverSupabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'blocked_users')
        .maybeSingle();

      if (row?.value) {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) blockedList = parsed;
      }
    } catch (e) {}

    const cleanBlocker = String(blocker_id).trim();
    const cleanBlocked = String(blocked_id).trim();

    if (action === 'block') {
      const alreadyBlocked = blockedList.some(item => {
        const b1 = String(item.blocker_id || '').toLowerCase().trim();
        const b2 = String(item.blocked_id || '').toLowerCase().trim();
        return blockerAliases.has(b1) && blockedAliases.has(b2);
      });

      if (!alreadyBlocked) {
        blockedList.push({
          blocker_id: cleanBlocker,
          blocked_id: cleanBlocked,
          created_at: new Date().toISOString()
        });
      }
    } else if (action === 'unblock') {
      blockedList = blockedList.filter(item => {
        const b1 = String(item.blocker_id || '').toLowerCase().trim();
        const b2 = String(item.blocked_id || '').toLowerCase().trim();
        return !(blockerAliases.has(b1) && blockedAliases.has(b2));
      });
    }

    await serverSupabase.from('admin_settings').upsert({
      key: 'blocked_users',
      value: JSON.stringify(blockedList)
    }, { onConflict: 'key' });

    return NextResponse.json({
      success: true,
      action,
      is_blocked: action === 'block'
    });
  } catch (err) {
    console.error('Error in POST /api/user/block:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
