import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const defaultInfo = {
    version: '1.0.1',
    build_number: 2,
    download_url: 'https://bikroynow.com/BikroyNow.apk',
    changelog_bn: 'লগইন সমস্যা সমাধান, মাসিক ৫টি ফ্রি বিজ্ঞাপনের লিমিট এবং অ্যাপের গতি ও স্থায়িত্ব বৃদ্ধি করা হয়েছে।',
    changelog_en: 'Login fix, monthly 5 free ads quota, and overall speed & stability improvements.',
    release_date: '2026-11-18',
    file_size_mb: 54.8
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const serverSupabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
      });
      const { data } = await serverSupabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'app_update_info')
        .maybeSingle();

      if (data && data.value) {
        try {
          const parsed = JSON.parse(data.value);
          return NextResponse.json({ ...defaultInfo, ...parsed });
        } catch (_) {}
      }
    } catch (e) {}
  }

  return NextResponse.json(defaultInfo);
}
