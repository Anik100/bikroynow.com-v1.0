import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const { id } = params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    // Call the SECURITY DEFINER RPC to get messages bypassing RLS
    const { data: messages, error } = await serverSupabase.rpc('get_messages_for_chat_v2', {
      p_chat_id: id
    });

    if (error) throw error;

    return NextResponse.json({ success: true, messages: messages || [] });
  } catch (e) {
    console.error('Error fetching messages via RPC:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { id } = params;
    const { sender_id, content, image_url } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serverSupabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    // Call the SECURITY DEFINER RPC to insert message bypassing RLS
    const { data: msgId, error } = await serverSupabase.rpc('insert_message_v2', {
      p_chat_id: id,
      p_sender_id: sender_id,
      p_content: content,
      p_image_url: image_url
    });

    if (error) throw error;

    const newMessage = {
      id: msgId,
      chat_id: id,
      sender_id,
      content: content || null,
      image_url: image_url || null,
      created_at: new Date().toISOString(),
      is_read: false
    };

    return NextResponse.json({ success: true, message: newMessage });
  } catch (e) {
    console.error('Error inserting message via RPC:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
