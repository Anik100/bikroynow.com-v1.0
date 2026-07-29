-- =========================================================================
-- SQL Migration: Live Chat Support Tables, RLS, and Realtime Configuration
-- Execute this script in your Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Create support_chats table
CREATE TABLE IF NOT EXISTS public.support_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. Create support_messages table with image_url column
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    support_chat_id UUID REFERENCES public.support_chats(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT,
    image_url TEXT, -- ImgBB URL for attachments
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure new columns are added if table already exists
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 4. Drop old policies if they exist
DROP POLICY IF EXISTS "Users can select own support chat" ON public.support_chats;
DROP POLICY IF EXISTS "Users can insert own support chat" ON public.support_chats;
DROP POLICY IF EXISTS "Users or admins can update support chats" ON public.support_chats;
DROP POLICY IF EXISTS "Users and admins can view support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users and admins can insert support messages" ON public.support_messages;

-- 5. Create is_admin_or_moderator helper function
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(user_email text)
RETURNS boolean AS $$
DECLARE
  mods_json jsonb;
BEGIN
  -- Master Admin check
  IF user_email = 'anikh0000@gmail.com' THEN
    RETURN true;
  END IF;

  -- Fetch moderators list from admin_settings
  SELECT value::jsonb INTO mods_json 
  FROM public.admin_settings 
  WHERE key = 'moderators';

  -- Check if user_email exists in the moderators JSON array
  IF mods_json IS NOT NULL AND mods_json @> ('[{"email": "' || user_email || '"}]')::jsonb THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create Policies
CREATE POLICY "Users can select own support chat" ON public.support_chats
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin_or_moderator(auth.jwt() ->> 'email'));

CREATE POLICY "Users can insert own support chat" ON public.support_chats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users or admins can update support chats" ON public.support_chats
    FOR UPDATE USING (auth.uid() = user_id OR public.is_admin_or_moderator(auth.jwt() ->> 'email'));

CREATE POLICY "Users and admins can view support messages" ON public.support_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.support_chats WHERE id = support_chat_id AND (user_id = auth.uid() OR public.is_admin_or_moderator(auth.jwt() ->> 'email')))
    );

CREATE POLICY "Users and admins can insert support messages" ON public.support_messages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.support_chats WHERE id = support_chat_id AND (user_id = auth.uid() OR public.is_admin_or_moderator(auth.jwt() ->> 'email')))
        AND sender_id = auth.uid()
    );

-- 6. Add Support tables to Supabase Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE support_chats;

-- 7. Automatic 24-hour cleanup scheduling (optional extension config)
-- If your Supabase instance has pg_cron enabled, this will prune rows automatically
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('delete-old-support-messages', '0 * * * *', $$
    DELETE FROM public.support_messages WHERE created_at < NOW() - INTERVAL '24 hours';
$$);
