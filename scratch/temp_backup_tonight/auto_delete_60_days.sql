-- =========================================================================
-- SQL Script: Automatic Deletion of 60-Day Old Ads & Chats
-- Execute this script in your Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- 1. Create a Secure Cleanup Function
-- This function runs with "SECURITY DEFINER" (elevated owner privileges)
-- to bypass any Row Level Security (RLS) policies during background deletion.
CREATE OR REPLACE FUNCTION public.cleanup_old_records()
RETURNS void AS $$
DECLARE
  deleted_listings_count INTEGER;
  deleted_messages_count INTEGER;
  deleted_chats_count INTEGER;
BEGIN
  -- A. Delete Listings (Ads) older than 60 days.
  -- Note: Due to "ON DELETE CASCADE" in the schema, deleting a listing will 
  -- automatically delete all associated chats and messages in those chats!
  DELETE FROM public.listings 
  WHERE created_at < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS deleted_listings_count = ROW_COUNT;

  -- B. Delete Messages older than 60 days (for ads that are still active but have old messages).
  DELETE FROM public.messages 
  WHERE created_at < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS deleted_messages_count = ROW_COUNT;

  -- C. Delete Chats that are older than 60 days AND have no messages left (empty chats).
  DELETE FROM public.chats 
  WHERE updated_at < NOW() - INTERVAL '60 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.messages WHERE chat_id = chats.id
    );
  GET DIAGNOSTICS deleted_chats_count = ROW_COUNT;

  RAISE NOTICE 'Cleanup completed. Deleted % listings, % messages, and % empty chats.', 
    deleted_listings_count, deleted_messages_count, deleted_chats_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Enable pg_cron Extension in Supabase (if not already enabled)
-- Supabase has pg_cron built-in to schedule periodic tasks directly in the database.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 3. Schedule the Cleanup Job to Run Automatically Every Day at Midnight (00:00 UTC)
-- This registers a cron job that executes the cleanup_old_records() function daily.
SELECT cron.schedule(
  'daily-cleanup-60-days-ads-chats', -- Job unique identifier
  '0 0 * * *',                       -- Cron syntax: Minute=0, Hour=0, Day=*, Month=*, Weekday=* (Daily at midnight)
  'SELECT public.cleanup_old_records();'
);

-- =========================================================================
-- OPTIONAL: HOW TO RUN MANUALLY ANYTIME
-- =========================================================================
-- If you want to force-delete all listings and chats older than 60 days right now, 
-- just run the following SQL command in your Supabase Editor:
--
-- SELECT public.cleanup_old_records();
-- =========================================================================
