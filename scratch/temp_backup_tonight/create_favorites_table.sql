-- =========================================================================
-- SQL Migration: Create Favorites Table and Configure RLS Policies
-- Execute this script in your Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- Create favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, listing_id)
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view own favorites." ON public.favorites;
DROP POLICY IF EXISTS "Users can create favorites." ON public.favorites;
DROP POLICY IF EXISTS "Users can delete own favorites." ON public.favorites;

-- Create Policies
CREATE POLICY "Users can view own favorites." ON public.favorites
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create favorites." ON public.favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites." ON public.favorites
    FOR DELETE USING (auth.uid() = user_id);
