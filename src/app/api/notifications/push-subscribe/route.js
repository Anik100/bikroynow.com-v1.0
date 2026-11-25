import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../lib/serverSupabase';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { user_id, email, subscription } = await req.json();

    if (!user_id || !subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Missing user_id or subscription endpoint' }, { status: 400 });
    }

    const serverSupabase = getServerSupabase();
    if (!serverSupabase) {
      return NextResponse.json({ error: 'Database client not available' }, { status: 500 });
    }

    const keysToUpdate = new Set([`push_subs_${user_id}`, `push_subs_${String(user_id).toLowerCase()}`]);
    if (email) {
      keysToUpdate.add(`push_subs_${email.toLowerCase().trim()}`);
    }

    // Also look up profile to find associated email/id if any
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id);
      if (isUUID) {
        const { data: prof } = await serverSupabase.from('profiles').select('email').eq('id', user_id).maybeSingle();
        if (prof?.email) {
          keysToUpdate.add(`push_subs_${prof.email.toLowerCase().trim()}`);
        }
      }
    } catch (_) {}

    // 1. Fetch existing subscriptions for this user
    let userSubs = [];
    try {
      const { data: rows } = await serverSupabase
        .from('admin_settings')
        .select('value')
        .in('key', Array.from(keysToUpdate));

      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row?.value) {
            try {
              const parsed = JSON.parse(row.value);
              if (Array.isArray(parsed)) {
                for (const s of parsed) {
                  if (s?.endpoint && !userSubs.some(x => x.endpoint === s.endpoint)) {
                    userSubs.push(s);
                  }
                }
              }
            } catch (_) {}
          }
        }
      }
    } catch (_) {}

    // 2. Add or update subscription by endpoint
    const existingIndex = userSubs.findIndex(s => s.endpoint === subscription.endpoint);
    const subRecord = {
      ...subscription,
      updated_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      userSubs[existingIndex] = subRecord;
    } else {
      userSubs.push(subRecord);
    }

    // Keep up to 5 most recent active endpoints per user
    if (userSubs.length > 5) {
      userSubs = userSubs.slice(-5);
    }

    // 3. Save back to all keys in admin_settings
    const upsertTasks = Array.from(keysToUpdate).map(key => 
      serverSupabase
        .from('admin_settings')
        .upsert({
          key,
          value: JSON.stringify(userSubs)
        }, { onConflict: 'key' })
    );

    await Promise.all(upsertTasks);

    return NextResponse.json({ success: true, count: userSubs.length });
  } catch (err) {
    console.error('Error saving push subscription:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
