import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { saveGlobalListing } from '../../../lib/globalListingsStore';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body || !body.title || !body.category_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = (supabaseUrl && anonKey) 
      ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
      : null;

    let validUserId = body.user_id;
    if (serverSupabase) {
      try {
        const { data: allProfs } = await serverSupabase.from('profiles').select('id, email');
        if (allProfs && allProfs.length > 0) {
          const cleanUser = String(body.user_id || '').toLowerCase().trim();
          let matched = allProfs.find(p => p.id === body.user_id || p.email?.toLowerCase() === cleanUser);
          if (!matched) {
            matched = allProfs.find(p => p.email && 'user-' + p.email.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanUser);
          }
          validUserId = matched ? matched.id : allProfs[0].id;
        }
      } catch (e) {}
    }

    const adId = isValidUUID(body.id) ? body.id : crypto.randomUUID();

    const newAd = {
      id: adId,
      user_id: validUserId,
      title: body.title.trim(),
      description: body.description || '',
      price: parseFloat(body.price) || 0,
      category_id: body.category_id,
      location: body.location || 'Dhaka',
      condition: body.condition || 'Used',
      contact_phone: body.contact_phone || '01700000000',
      images: Array.isArray(body.images) && body.images.length > 0 
        ? body.images 
        : ['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80'],
      status: body.status || 'pending',
      created_at: new Date().toISOString()
    };

    // 1. Save to server-side global listings store
    saveGlobalListing(newAd);

    // 2. Insert to Supabase DB
    if (serverSupabase) {
      try {
        const { data: inserted, error: sbErr } = await serverSupabase.from('listings').insert([newAd]).select();
        if (sbErr) {
          console.error('Supabase listings insert error:', sbErr);
        } else if (inserted && inserted.length > 0) {
          return NextResponse.json({ success: true, ad: inserted[0] });
        }
      } catch (sbErr) {
        console.error('Supabase async insert error:', sbErr);
      }
    }

    return NextResponse.json({ success: true, ad: newAd });
  } catch (err) {
    console.error('API /api/post-ad error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
