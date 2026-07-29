-- =========================================================================
-- SQL Migration: Enable Dynamic Admin & Moderator Access via RLS Policies
-- Execute this script in your Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Create a Helper Function to Check Admin & Moderator Status Dynamically
-- This function checks if the user email is the Master Admin OR exists in the admin_settings table under 'moderators'.
-- Uses SECURITY DEFINER to bypass RLS restrictions during checks.
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(user_email TEXT)
RETURNS BOOLEAN SECURITY DEFINER AS $$
DECLARE
  mods_json TEXT;
  is_mod BOOLEAN;
BEGIN
  -- Check if Master Admin
  IF user_email = 'anikh0000@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- Fetch the list of moderators from admin_settings
  SELECT value INTO mods_json FROM public.admin_settings WHERE key = 'moderators';
  
  IF mods_json IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if the given email exists inside the JSON array of moderators
  SELECT EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(mods_json::jsonb) AS elem 
    WHERE LOWER(elem->>'email') = LOWER(user_email)
  ) INTO is_mod;

  RETURN is_mod;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop Old Hardcoded 'anikh0000@gmail.com' Policies
DROP POLICY IF EXISTS "Admin can update all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all listings." ON public.listings;
DROP POLICY IF EXISTS "Admin can delete all listings." ON public.listings;
DROP POLICY IF EXISTS "Admin can do everything on purchases" ON public.membership_purchases;
DROP POLICY IF EXISTS "Admin can do everything on packages" ON public.membership_packages;
DROP POLICY IF EXISTS "Admin can modify admin settings" ON public.admin_settings;

-- 3. Create New Dynamic RLS Policies using is_admin_or_moderator()

-- Profiles
CREATE POLICY "Admin can update all profiles." ON public.profiles 
  FOR UPDATE 
  USING (public.is_admin_or_moderator(auth.jwt() ->> 'email'));

-- Listings (Ads)
CREATE POLICY "Admin can update all listings." ON public.listings 
  FOR UPDATE 
  USING (public.is_admin_or_moderator(auth.jwt() ->> 'email'));

CREATE POLICY "Admin can delete all listings." ON public.listings 
  FOR DELETE 
  USING (public.is_admin_or_moderator(auth.jwt() ->> 'email'));

-- Membership Purchases (Payment Info)
CREATE POLICY "Admin can do everything on purchases" ON public.membership_purchases 
  FOR ALL 
  USING (public.is_admin_or_moderator(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_admin_or_moderator(auth.jwt() ->> 'email'));

-- Membership Packages (Membership Offers)
CREATE POLICY "Admin can do everything on packages" ON public.membership_packages 
  FOR ALL 
  USING (public.is_admin_or_moderator(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_admin_or_moderator(auth.jwt() ->> 'email'));

-- Admin Settings (Payment Gateways & Moderator Settings)
CREATE POLICY "Admin can modify admin settings" ON public.admin_settings 
  FOR ALL 
  USING (public.is_admin_or_moderator(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_admin_or_moderator(auth.jwt() ->> 'email'));

-- Note: Ensure that "Enable Row Level Security" remains active on these tables.
-- Now, any moderator you add from your admin panel will automatically gain full database access to perform operations!
