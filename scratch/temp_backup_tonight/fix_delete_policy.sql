-- =====================================================================
-- FIX: Add DELETE permissions so users can delete their own chat & msgs
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard
-- =====================================================================

-- Allow users to delete their own support chat room
DROP POLICY IF EXISTS "Users and admins can delete support chats" ON public.support_chats;
CREATE POLICY "Users and admins can delete support chats" ON public.support_chats
    FOR DELETE USING (
        auth.uid() = user_id
        OR public.is_admin_or_moderator(auth.jwt() ->> 'email')
    );

-- Allow users to delete their own messages (or admin deletes any)
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
