import { NextResponse } from 'next/server';
import { recordUserHeartbeat, getUserLastSeen } from '../../../../lib/userPresenceStore';
import { getServerSupabase } from '../../../../lib/serverSupabase';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { userId, email } = await req.json();
    if (!userId && !email) {
      return NextResponse.json({ success: false, error: 'Missing identifiers' }, { status: 400 });
    }

    recordUserHeartbeat(userId, email);

    // Persist last_seen to profiles table via serverSupabase
    const serverSupabase = getServerSupabase();
    if (serverSupabase) {
      const nowIso = new Date().toISOString();
      try {
        if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
          await serverSupabase.from('profiles').update({ last_seen: nowIso }).eq('id', userId);
        } else if (email) {
          await serverSupabase.from('profiles').update({ last_seen: nowIso }).eq('email', email);
        }
      } catch (_) {}
    }

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const lastSeen = getUserLastSeen(userId, email);
    return NextResponse.json({ success: true, lastSeen });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
