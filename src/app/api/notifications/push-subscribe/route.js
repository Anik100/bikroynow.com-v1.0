import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../lib/serverSupabase';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { user_id, subscription } = await req.json();

    if (!user_id || !subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Missing user_id or subscription endpoint' }, { status: 400 });
    }

    const serverSupabase = getServerSupabase();
    if (!serverSupabase) {
      return NextResponse.json({ error: 'Database client not available' }, { status: 500 });
    }

    // Key in admin_settings for user's push subscriptions
    const settingsKey = `push_subs_${user_id}`;

    // 1. Fetch existing subscriptions for this user
    let userSubs = [];
    try {
      const { data: row } = await serverSupabase
        .from('admin_settings')
        .select('value')
        .eq('key', settingsKey)
        .maybeSingle();

      if (row?.value) {
        userSubs = JSON.parse(row.value);
        if (!Array.isArray(userSubs)) userSubs = [];
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

    // 3. Save back to admin_settings
    await serverSupabase
      .from('admin_settings')
      .upsert({
        key: settingsKey,
        value: JSON.stringify(userSubs)
      }, { onConflict: 'key' });

    return NextResponse.json({ success: true, count: userSubs.length });
  } catch (err) {
    console.error('Error saving push subscription:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
