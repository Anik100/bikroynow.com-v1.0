-- =========================================================================
-- SQL Script: Wipe All Demo Ads, Chats, Messages & Payment Logs
-- Execute this script in your Supabase SQL Editor to reset the website fresh!
-- WARNING: This will delete ALL listings, messages, chats, and purchases.
-- It will NOT delete your user accounts (profiles) or admin settings.
-- =========================================================================

-- 1. Delete all messages
DELETE FROM public.messages;

-- 2. Delete all chats
DELETE FROM public.chats;

-- 3. Delete all ads (listings)
DELETE FROM public.listings;

-- 4. Delete all membership purchase requests (payment logs)
DELETE FROM public.membership_purchases;

-- 5. (Optional) Reset any user profiles back to regular members (un-verify/un-membership)
-- If you want to reset all users to basic package, uncomment the line below:
-- UPDATE public.profiles SET membership_type = 'regular', membership_expires_at = NULL;
