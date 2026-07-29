-- =============================================
-- BikroyNow: Membership Packages Table
-- Run this in Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS membership_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('boost', 'membership')),
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  price INTEGER NOT NULL,
  duration INTEGER,
  duration_unit TEXT CHECK (duration_unit IN ('days', 'month')),
  tagline_en TEXT,
  tagline_bn TEXT,
  features JSONB DEFAULT '[]',
  badge_en TEXT,
  badge_bn TEXT,
  color TEXT DEFAULT 'silver' CHECK (color IN ('silver', 'gold', 'business')),
  icon TEXT DEFAULT 'zap',
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE membership_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages"
  ON membership_packages FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admin can do everything on packages"
  ON membership_packages FOR ALL
  USING (auth.email() = 'anikh0000@gmail.com')
  WITH CHECK (auth.email() = 'anikh0000@gmail.com');

-- =============================================
-- Seed: Existing 6 Packages
-- =============================================

INSERT INTO membership_packages
  (type, name_en, name_bn, price, duration, duration_unit, tagline_en, tagline_bn, features, badge_en, badge_bn, color, icon, is_featured, sort_order)
VALUES
  -- BOOSTS
  (
    'boost', '3-Day Express Boost', '৩ দিনের এক্সপ্রেস বুস্ট',
    199, 3, 'days',
    'Perfect for quick emergency sales', 'খুব দ্রুত ইমার্জেন্সি বিক্রির জন্য সেরা',
    '[
      {"en": "Get 10x more buyer reach & views", "bn": "১০ গুণ (10x) বেশি কাস্টমার রিচ ও ভিউ"},
      {"en": "Place ad directly at the very top", "bn": "বিজ্ঞাপন সরাসরি সবার ওপরে প্রদর্শন"},
      {"en": "Express Sale badge for 3 days", "bn": "৩ দিনের জন্য এক্সপ্রেস সেল ট্যাগ"}
    ]',
    NULL, NULL, 'silver', 'zap', FALSE, 1
  ),
  (
    'boost', '7-Day Premium Boost', '৭ দিনের প্রিমিয়াম বুস্ট',
    399, 7, 'days',
    'Ensure selling within 1 week', '১ সপ্তাহের মধ্যে পণ্য বিক্রি নিশ্চিত করতে',
    '[
      {"en": "Get 20x more buyer calls & responses", "bn": "২০ গুণ (20x) বেশি ক্রেতা ও রিয়েল কল"},
      {"en": "Top position for 3 full days", "bn": "৩ দিন বিজ্ঞাপন টপ পজিশনে থাকবে"},
      {"en": "Highlighted background in Search", "bn": "সার্চ রেজাল্ট পেজে হাইলাইটেড ব্যাকগ্রাউন্ড"}
    ]',
    'Best Value', 'সেরা ভ্যালু', 'gold', 'zap', TRUE, 2
  ),
  (
    'boost', '15-Day Mega Boost', '১৫ দিনের মেগা বুস্ট',
    699, 15, 'days',
    'Best for heavy items like cars, bikes', 'গাড়ি, বাইক বা ভারী পণ্য বিক্রির জন্য সেরা',
    '[
      {"en": "Get 40x more buyer traffic & impressions", "bn": "৪০ গুণ (40x) বেশি কাস্টমার ট্রাফিক ও ভিউ"},
      {"en": "Top position for 7 full days", "bn": "৭ দিন বিজ্ঞাপন সবার ওপরে থাকবে"},
      {"en": "Mega Boost border & badge for 15 days", "bn": "১৫ দিন মেগা বুস্ট ব্যাজ ও বর্ডার"}
    ]',
    NULL, NULL, 'business', 'zap', FALSE, 3
  ),
  -- MEMBERSHIPS
  (
    'membership', 'Silver Member', 'সিলভার মেম্বার',
    999, 1, 'month',
    'Perfect for small sellers & startups', 'ছোট বিক্রেতা ও স্টার্টআপদের জন্য আদর্শ',
    '[
      {"en": "Get 30x more customer reach & sales", "bn": "৩০ গুণ (30x) বেশি কাস্টমার সেলস ও রিচ"},
      {"en": "Up to 50 active ads simultaneously", "bn": "সর্বোচ্চ ৫০টি সক্রিয় বিজ্ঞাপন"},
      {"en": "Custom Shop Page with your own logo", "bn": "কাস্টম শপ পেইজ (লোগো সহ)"},
      {"en": "Silver Member badge on profile", "bn": "প্রোফাইলে সিলভার মেম্বার ব্যাজ"}
    ]',
    NULL, NULL, 'silver', 'award', FALSE, 4
  ),
  (
    'membership', 'Gold Member', 'গোল্ড মেম্বার',
    2499, 1, 'month',
    'Best for professional & busy sellers', 'পেশাদার ও নিয়মিত বিক্রেতাদের জন্য সেরা',
    '[
      {"en": "Get 50x more customer reach & sales", "bn": "৫০ গুণ (50x) বেশি কাস্টমার সেলস ও রিচ"},
      {"en": "Unlimited active ads", "bn": "আনলিমিটেড বিজ্ঞাপন পোস্ট"},
      {"en": "Custom Shop Page with logo & banner", "bn": "কাস্টম শপ পেইজ (লোগো ও ব্যানার)"},
      {"en": "5 Free Top Ad promotions / month", "bn": "৫টি ফ্রি টপ অ্যাড প্রমোশন / মাস"},
      {"en": "Dedicated Customer Relation Manager", "bn": "ডেডিকেটেড কাস্টমার রিলেশন ম্যানেজার"}
    ]',
    'Popular', 'সবচেয়ে জনপ্রিয়', 'gold', 'zap', TRUE, 5
  ),
  (
    'membership', 'Business Member', 'বিজনেস মেম্বার',
    4999, 1, 'month',
    'Built for showrooms, dealers & companies', 'শোরুম, ডিলার ও বড় কোম্পানির জন্য',
    '[
      {"en": "Get 100x more customer reach & sales", "bn": "১০০ গুণ (100x) বেশি কাস্টমার সেলস ও রিচ"},
      {"en": "Unlimited ads & API Listing Access", "bn": "আনলিমিটেড বিজ্ঞাপন ও এপিআই অ্যাক্সেস"},
      {"en": "Multi-user shop access controls", "bn": "মাল্টি-ইউজার শপ অ্যাক্সেস"},
      {"en": "15 Free Promo & Bump Credits / month", "bn": "১৫টি ফ্রি প্রমোশন ও বাম্প ক্রেডিট"},
      {"en": "Advanced Sales Analytics Report", "bn": "Advanced Sales Analytics Report"}
    ]',
    NULL, NULL, 'business', 'briefcase', FALSE, 6
  );

-- =============================================
-- BikroyNow: Payment Settings & Purchases Setup
-- =============================================

-- ১. এডমিন সেটিংস টেবিল (বিকাশ ও নগদ নাম্বার সেভ রাখার জন্য)
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ডিফল্ট নাম্বার সিড করা
INSERT INTO admin_settings (key, value)
VALUES 
  ('bkash_number', '01700000000'),
  ('nagad_number', '01800000000')
ON CONFLICT (key) DO NOTHING;

-- ২. মেম্বারশিপ এবং বুস্ট পারচেজ রিকোয়েস্ট টেবিল
CREATE TABLE IF NOT EXISTS membership_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  package_id UUID NOT NULL,
  package_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bkash', 'nagad')),
  sender_number TEXT NOT NULL,
  transaction_id TEXT NOT NULL UNIQUE,
  screenshot_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Enablement
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_purchases ENABLE ROW LEVEL SECURITY;

-- admin_settings policies
CREATE POLICY "Anyone can read admin settings"
  ON admin_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin can modify admin settings"
  ON admin_settings FOR ALL
  USING (auth.email() = 'anikh0000@gmail.com')
  WITH CHECK (auth.email() = 'anikh0000@gmail.com');

-- membership_purchases policies
CREATE POLICY "Anyone can submit a purchase request"
  ON membership_purchases FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own purchases"
  ON membership_purchases FOR SELECT
  USING (user_email = auth.email());

CREATE POLICY "Admin can do everything on purchases"
  ON membership_purchases FOR ALL
  USING (auth.email() = 'anikh0000@gmail.com')
  WITH CHECK (auth.email() = 'anikh0000@gmail.com');

-- =============================================
-- Profile Extensions for Active Memberships
-- =============================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_type TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;

-- =============================================
4. MIGRATION 2026-05-19: RESTRICTED BOOSTS & DYNAMIC SETTINGS
-- =============================================

-- Add promotion_type to listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS promotion_type TEXT;

-- Add listing_id reference to membership_purchases
ALTER TABLE public.membership_purchases ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL;

-- Dynamic payment settings additions
INSERT INTO admin_settings (key, value) VALUES 
  ('bkash_type', 'Personal'),
  ('nagad_type', 'Personal')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 5. MIGRATION 2026-05-19: ADMIN RLS POLICIES FOR MEMBERSHIPS & BOOSTS
-- =============================================
-- Admin needs permissions to update other users' profiles (for memberships) and listings (for boosts)

CREATE POLICY "Admin can update all profiles." ON public.profiles FOR UPDATE USING (auth.jwt() ->> 'email' = 'anikh0000@gmail.com');
CREATE POLICY "Admin can update all listings." ON public.listings FOR UPDATE USING (auth.jwt() ->> 'email' = 'anikh0000@gmail.com');
CREATE POLICY "Admin can delete all listings." ON public.listings FOR DELETE USING (auth.jwt() ->> 'email' = 'anikh0000@gmail.com');


