import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pingIndexNow, CANONICAL_BASE } from '../../../../lib/seoPinger';
import { buildSitemapData } from '../../../sitemap';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for full database maintenance scan

/**
 * Daily Automated SEO Maintenance & Self-Healing Cron Pipeline
 * Scheduled to run daily at 21:00 UTC (03:00 AM Bangladesh Time BST / Off-peak)
 */
export async function GET(req) {
  return await handleMaintenance(req);
}

export async function POST(req) {
  return await handleMaintenance(req);
}

async function handleMaintenance(req) {
  const startTime = Date.now();
  const { searchParams } = new URL(req.url);

  // 1. Authorization check
  const cronSecret = process.env.CRON_SECRET || 'bikroynow_cron_secret_2026';
  const authHeader = req.headers.get('authorization');
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const querySecret = searchParams.get('secret');

  const isAuthorized =
    isVercelCron ||
    querySecret === cronSecret ||
    authHeader === `Bearer ${cronSecret}` ||
    process.env.NODE_ENV !== 'production';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const report = {
    success: false,
    timestamp: new Date().toISOString(),
    schedule: '21:00 UTC (03:00 AM Bangladesh Time BST - Off-peak)',
    scannedListings: 0,
    healedListings: 0,
    healedDetails: [],
    prunedBlacklisted: 0,
    sitemapTotalUrls: 0,
    indexNowSubmitted: 0,
    durationMs: 0,
  };

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase credentials not configured in environment.');
    }

    const serverSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 2. Fetch deleted blacklist from admin_settings
    let deletedBlacklist = new Set();
    try {
      const { data: setRow } = await serverSupabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'deleted_listing_ids')
        .maybeSingle();

      if (setRow?.value) {
        const parsed = JSON.parse(setRow.value);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => deletedBlacklist.add(String(id)));
          report.prunedBlacklisted = deletedBlacklist.size;
        }
      }
    } catch (e) {
      console.warn('[Cron SEO] Blacklist check warning:', e.message);
    }

    // 3. Scan active listings for Metadata & Alt-Text Self-Healing
    const { data: listings, error: fetchErr } = await serverSupabase
      .from('listings')
      .select('*')
      .or('status.eq.active,status.eq.approved');

    if (fetchErr) throw fetchErr;

    const activeAds = Array.isArray(listings) ? listings : [];
    report.scannedListings = activeAds.length;

    for (const ad of activeAds) {
      // If ad was deleted/blacklisted, ensure it is pruned
      if (deletedBlacklist.has(String(ad.id))) {
        await serverSupabase
          .from('listings')
          .update({ status: 'deleted' })
          .eq('id', ad.id);
        continue;
      }

      const updates = {};
      let needsHeal = false;

      const titleRaw = (ad.title || '').trim();
      const city = (ad.location || ad.district || 'Bangladesh').trim();

      // Check Title: if empty or corrupted (< 4 chars)
      if (!titleRaw || titleRaw.length < 4) {
        const fallbackName = ad.category_id ? `${ad.category_id} Item` : 'Product';
        updates.title = `${fallbackName} - Price & Details in ${city} | BikroyNow`;
        needsHeal = true;
      }

      // Check Description: if missing or excessively short (< 15 chars)
      const descRaw = (ad.description || '').trim();
      if (!descRaw || descRaw.length < 15) {
        const productName = titleRaw || ad.category_id || 'Product';
        updates.description = `Buy or sell ${productName} in ${city}. Contact verified sellers directly on BikroyNow.`;
        needsHeal = true;
      }

      // Check Images: ensure at least one valid image array
      if (!Array.isArray(ad.images) || ad.images.length === 0) {
        updates.images = ['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80'];
        needsHeal = true;
      }

      // Apply self-healing backfill to database
      if (needsHeal) {
        try {
          await serverSupabase
            .from('listings')
            .update(updates)
            .eq('id', ad.id);

          report.healedListings++;
          report.healedDetails.push({
            id: ad.id,
            repairedFields: Object.keys(updates),
            generatedTitle: updates.title || titleRaw,
            imageAltFormula: `Used ${titleRaw || 'Product'} for sale in ${city}`,
          });
        } catch (updateErr) {
          console.error(`[Cron SEO] Failed to heal ad ${ad.id}:`, updateErr.message);
        }
      }
    }

    // 4. Dynamic Sitemap Sync & Rebuild
    const sitemapItems = await buildSitemapData();
    report.sitemapTotalUrls = sitemapItems.length;

    // 5. IndexNow Batch Sync for all valid active ad URLs
    const activeAdUrls = sitemapItems
      .filter((item) => item.url.includes('/ad/'))
      .map((item) => item.url);

    if (activeAdUrls.length > 0) {
      try {
        const indexNowResult = await pingIndexNow(activeAdUrls.slice(0, 500));
        report.indexNowSubmitted = activeAdUrls.length;
      } catch (indexErr) {
        console.warn('[Cron SEO] IndexNow batch ping error:', indexErr.message);
      }
    }

    // 6. Ping Sitemaps
    try {
      const sitemapUrl = `${CANONICAL_BASE}/sitemap.xml`;
      await Promise.allSettled([
        fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, { cache: 'no-store' }),
        fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, { cache: 'no-store' }),
      ]);
    } catch (e) {}

    report.success = true;
  } catch (err) {
    console.error('[Cron SEO Maintenance Exception]:', err);
    report.error = err.message;
  } finally {
    report.durationMs = Date.now() - startTime;
  }

  return NextResponse.json(report, {
    status: report.success ? 200 : 500,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
