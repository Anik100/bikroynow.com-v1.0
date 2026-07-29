const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://avuvqvjhppbnprdgkfmx.supabase.co';
const supabaseAnonKey = 'sb_publishable_l3l3_VTQ_UgEMTyYBukybQ_tMzmfDVV';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const userId = '5cb1a712-ad07-4f28-8c33-739c2ecfe1db';
  console.log(`--- Checking Listings for User ${userId} ---`);
  const { data: listings, error: listErr } = await supabase
    .from('listings')
    .select('id, title, status, is_verified, promotion_type, created_at')
    .eq('user_id', userId);

  if (listErr) {
    console.error('Error fetching listings:', listErr);
  } else {
    console.log(JSON.stringify(listings, null, 2));
  }
}

main();
