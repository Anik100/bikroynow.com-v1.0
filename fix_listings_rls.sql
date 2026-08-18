-- =========================================================================
-- Supabase SQL Migration: Create Security Definer Function for Listings
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- Create a SECURITY DEFINER function to bypass RLS and return all listings
CREATE OR REPLACE FUNCTION public.get_listings_v2()
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'user_id', l.user_id,
      'title', l.title,
      'description', l.description,
      'price', l.price,
      'category_id', l.category_id,
      'location', l.location,
      'condition', l.condition,
      'contact_phone', l.contact_phone,
      'images', l.images,
      'status', l.status,
      'is_verified', COALESCE(l.is_verified, false),
      'promotion_type', l.promotion_type,
      'created_at', l.created_at,
      'profiles', CASE 
        WHEN p.id IS NOT NULL THEN jsonb_build_object(
          'membership_type', p.membership_type,
          'membership_expires_at', p.membership_expires_at
        )
        ELSE NULL
      END
    )
  ) INTO result
  FROM public.listings l
  LEFT JOIN public.profiles p ON l.user_id = p.id
  WHERE l.status != 'deleted';
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Also update all existing pending ads to active status
UPDATE public.listings 
SET status = 'active' 
WHERE status IS NULL OR status = 'pending';
