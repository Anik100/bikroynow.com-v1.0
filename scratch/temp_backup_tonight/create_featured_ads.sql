-- =========================================================================
-- SQL Migration: Create Featured Ads Table and Configure RLS Policies
-- Execute this script in your Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- Create featured_ads table
CREATE TABLE IF NOT EXISTS public.featured_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.featured_ads ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Anyone can view active featured ads" ON public.featured_ads;
DROP POLICY IF EXISTS "Admin can perform all operations on featured ads" ON public.featured_ads;

-- Create Policies
CREATE POLICY "Anyone can view active featured ads" ON public.featured_ads
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admin can perform all operations on featured ads" ON public.featured_ads
    FOR ALL USING (
        auth.jwt() ->> 'email' = 'anikh0000@gmail.com'
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
