-- =========================================================================
-- Supabase SQL Migration: Complete Chat & Messages RLS & RPC Fix
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- =========================================================================

-- 0. Drop old functions to avoid return type mismatch
DROP FUNCTION IF EXISTS public.get_messages_for_chat_v2(uuid);
DROP FUNCTION IF EXISTS public.insert_message_v2(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.get_chats_for_user_v2(uuid);
DROP FUNCTION IF EXISTS public.create_chat_v2(uuid, uuid, uuid);

-- 1. Create get_messages_for_chat_v2 (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_messages_for_chat_v2(p_chat_id UUID)
RETURNS TABLE (
    id UUID,
    chat_id UUID,
    sender_id UUID,
    content TEXT,
    image_url TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT m.id, m.chat_id, m.sender_id, m.content, m.image_url, m.is_read, m.created_at
    FROM public.messages m
    WHERE m.chat_id = p_chat_id
    ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 2. Create insert_message_v2 (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.insert_message_v2(
    p_chat_id UUID,
    p_sender_id UUID,
    p_content TEXT,
    p_image_url TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO public.messages (chat_id, sender_id, content, image_url, is_read, created_at)
    VALUES (p_chat_id, p_sender_id, p_content, p_image_url, false, NOW())
    RETURNING id INTO new_id;

    UPDATE public.chats 
    SET updated_at = NOW() 
    WHERE id = p_chat_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Create get_chats_for_user_v2 (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_chats_for_user_v2(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    listing_id UUID,
    buyer_id UUID,
    seller_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.listing_id, c.buyer_id, c.seller_id, c.created_at, c.updated_at
    FROM public.chats c
    WHERE c.buyer_id = p_user_id OR c.seller_id = p_user_id
    ORDER BY c.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Create create_chat_v2 (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.create_chat_v2(
    p_listing_id UUID,
    p_buyer_id UUID,
    p_seller_id UUID
)
RETURNS UUID
SECURITY DEFINER
AS $$
DECLARE
    existing_id UUID;
    new_id UUID;
BEGIN
    SELECT id INTO existing_id
    FROM public.chats
    WHERE listing_id = p_listing_id AND buyer_id = p_buyer_id AND seller_id = p_seller_id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
        RETURN existing_id;
    END IF;

    INSERT INTO public.chats (listing_id, buyer_id, seller_id, created_at, updated_at)
    VALUES (p_listing_id, p_buyer_id, p_seller_id, NOW(), NOW())
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Fix Policies on CHATS Table
DROP POLICY IF EXISTS "Users can view their chats." ON public.chats;
CREATE POLICY "Users can view their chats." ON public.chats 
FOR SELECT 
USING (
    auth.uid() = buyer_id OR auth.uid() = seller_id OR auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Buyers can create chats." ON public.chats;
CREATE POLICY "Buyers can create chats." ON public.chats 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their chats." ON public.chats;
CREATE POLICY "Users can update their chats." ON public.chats 
FOR UPDATE 
USING (true);

-- 6. Fix Policies on MESSAGES Table
DROP POLICY IF EXISTS "Users can insert messages to their chats." ON public.messages;
CREATE POLICY "Users can insert messages to their chats." ON public.messages 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view messages in their chats." ON public.messages;
CREATE POLICY "Users can view messages in their chats." ON public.messages 
FOR SELECT 
USING (
    EXISTS (SELECT 1 FROM public.chats WHERE id = messages.chat_id AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
    OR auth.uid() IS NULL
);
