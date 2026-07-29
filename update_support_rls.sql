-- =========================================================================
-- SQL Migration: Robust Admin & Moderator Helper and Support Policies
-- Execute this script in your Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 0. Ensure the is_read column exists in support_messages table
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- 1. Re-create the is_admin_or_moderator helper function with multiple email resolution fallbacks
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(user_email TEXT)
RETURNS BOOLEAN SECURITY DEFINER AS $$
DECLARE
  mods_json TEXT;
  resolved_email TEXT;
  is_mod BOOLEAN;
BEGIN
  -- Resolve email from passed argument, JWT claims, metadata or direct auth.users table lookup
  resolved_email := COALESCE(
    user_email,
    auth.jwt() ->> 'email',
    auth.jwt() -> 'user_metadata' ->> 'email',
    (SELECT email FROM auth.users WHERE id = auth.uid())
  );

  -- 1. Check if Master Admin
  IF LOWER(resolved_email) = 'anikh0000@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- 2. Fetch the list of moderators from admin_settings
  SELECT value INTO mods_json FROM public.admin_settings WHERE key = 'moderators';
  
  IF mods_json IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 3. Check if the resolved email exists inside the JSON array of moderators
  SELECT EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(mods_json::jsonb) AS elem 
    WHERE LOWER(elem->>'email') = LOWER(resolved_email)
  ) INTO is_mod;

  RETURN is_mod;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop and Re-create RLS policies for support_chats to ensure the updated function is used
DROP POLICY IF EXISTS "Users can select own support chat" ON public.support_chats;
DROP POLICY IF EXISTS "Users can insert own support chat" ON public.support_chats;
DROP POLICY IF EXISTS "Users or admins can update support chats" ON public.support_chats;

CREATE POLICY "Users can select own support chat" ON public.support_chats
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin_or_moderator(auth.jwt() ->> 'email'));

CREATE POLICY "Users can insert own support chat" ON public.support_chats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users or admins can update support chats" ON public.support_chats
    FOR UPDATE USING (auth.uid() = user_id OR public.is_admin_or_moderator(auth.jwt() ->> 'email'));

-- 3. Drop and Re-create RLS policies for support_messages to ensure the updated function is used
DROP POLICY IF EXISTS "Users and admins can view support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users and admins can insert support messages" ON public.support_messages;

CREATE POLICY "Users and admins can view support messages" ON public.support_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM public.support_chats 
            WHERE id = support_chat_id 
              AND (user_id = auth.uid() OR public.is_admin_or_moderator(auth.jwt() ->> 'email'))
        )
    );

CREATE POLICY "Users and admins can insert support messages" ON public.support_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM public.support_chats 
            WHERE id = support_chat_id 
              AND (user_id = auth.uid() OR public.is_admin_or_moderator(auth.jwt() ->> 'email'))
        )
        AND sender_id = auth.uid()
    );

-- Add UPDATE policy for marking messages as read
DROP POLICY IF EXISTS "Users and admins can update support messages" ON public.support_messages;
CREATE POLICY "Users and admins can update support messages" ON public.support_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 
            FROM public.support_chats 
            WHERE id = support_chat_id 
              AND (user_id = auth.uid() OR public.is_admin_or_moderator(auth.jwt() ->> 'email'))
        )
    );

-- Add DELETE policies for ending chat and auto-inactivity cleanup
DROP POLICY IF EXISTS "Users and admins can delete support chats" ON public.support_chats;
CREATE POLICY "Users and admins can delete support chats" ON public.support_chats
    FOR DELETE USING (auth.uid() = user_id OR public.is_admin_or_moderator(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Users and admins can delete support messages" ON public.support_messages;
CREATE POLICY "Users and admins can delete support messages" ON public.support_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 
            FROM public.support_chats 
            WHERE id = support_chat_id 
              AND (user_id = auth.uid() OR public.is_admin_or_moderator(auth.jwt() ->> 'email'))
        )
    );

-- 4. Add the missing offer_price column to the membership_packages table
ALTER TABLE public.membership_packages ADD COLUMN IF NOT EXISTS offer_price INTEGER;
