-- =====================================================================
-- AUTO-CLEANUP: Delete chats where admin replied but user didn't read
-- within 60 minutes.
--
-- Logic:
--   - Admin sends a message (sender_id != chat owner's user_id)
--   - User does NOT mark it as read within 60 minutes
--   - The entire chat room (+ messages via CASCADE) gets deleted
--
-- Run this ONCE in your Supabase SQL Editor:
-- https://supabase.com/dashboard → SQL Editor → New Query
-- =====================================================================

-- Step 1: Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Remove old schedule if it exists (safe to re-run)
SELECT cron.unschedule('cleanup-unread-support-chats')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-unread-support-chats'
  );

-- Step 3: Create the cron job — runs every 5 minutes
SELECT cron.schedule(
  'cleanup-unread-support-chats',
  '*/5 * * * *',
  $$
    DELETE FROM public.support_chats
    WHERE id IN (
      SELECT DISTINCT sc.id
      FROM public.support_chats sc
      JOIN public.support_messages sm
        ON sm.support_chat_id = sc.id
      WHERE
        sm.sender_id != sc.user_id   -- message was sent by admin (not the user)
        AND sm.is_read = false        -- user has NOT read it
        AND sm.created_at < NOW() - INTERVAL '60 minutes'  -- older than 60 min
    );
  $$
);

-- ✅ Done. The job will run every 5 minutes and auto-delete stale chats.
-- Note: ON DELETE CASCADE on support_messages ensures all messages are
-- also deleted when the support_chat row is removed.
