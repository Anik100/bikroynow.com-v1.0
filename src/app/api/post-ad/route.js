import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { saveGlobalListing } from '../../../lib/globalListingsStore';

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body || !body.title || !body.category_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newAd = {
      id: body.id || 'ad-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      user_id: body.user_id || 'user-' + Date.now(),
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
      status: 'active',
      created_at: new Date().toISOString()
    };

    // 1. Save to server-side global listings store (guaranteed persistence across all accounts)
    saveGlobalListing(newAd);

    // 2. Try inserting to Supabase in background
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && anonKey) {
        const serverSupabase = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false }
        });
        await serverSupabase.from('listings').insert([newAd]);
      }
    } catch (sbErr) {
      console.error('Supabase async insert error:', sbErr);
    }

    return NextResponse.json({ success: true, ad: newAd });
  } catch (err) {
    console.error('API /api/post-ad error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
