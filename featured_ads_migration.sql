-- =========================================================================
-- SQL Migration: Create Featured Ads Table and Configure RLS Policies
-- Execute this script in your Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- Step 1: Create featured_ads table
CREATE TABLE IF NOT EXISTS public.featured_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Enable RLS (Row Level Security)
ALTER TABLE public.featured_ads ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop old policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "Anyone can view active featured ads" ON public.featured_ads;
DROP POLICY IF EXISTS "Admin can perform all operations on featured ads" ON public.featured_ads;

-- Step 4: Create Policies
-- Public: Anyone can view active featured ads (needed for homepage slider)
CREATE POLICY "Anyone can view active featured ads" ON public.featured_ads
    FOR SELECT USING (true);

-- Admin: Full control
CREATE POLICY "Admin can perform all operations on featured ads" ON public.featured_ads
    FOR ALL USING (
        auth.jwt() ->> 'email' = 'anikh0000@gmail.com'
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =========================================================================
-- Step 5: Seed all existing Business Member's active listings into featured_ads
-- This fixes the current Business Member account (anikh00@gmail.com)
-- =========================================================================
INSERT INTO public.featured_ads (listing_id, is_active, sort_order)
SELECT 
    l.id AS listing_id,
    true AS is_active,
    ROW_NUMBER() OVER (ORDER BY l.created_at DESC) - 1 AS sort_order
FROM public.listings l
INNER JOIN public.profiles p ON p.id = l.user_id
WHERE 
    l.status = 'active'
    AND p.membership_type ILIKE '%business%'
    AND (p.membership_expires_at IS NULL OR p.membership_expires_at > NOW())
ON CONFLICT (listing_id) DO UPDATE SET
    is_active = true;
