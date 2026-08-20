-- =========================================================================
-- SQL Helper: Enable RLS on All Public Tables
-- Execute this script in your Supabase SQL Editor (https://supabase.com)
-- =========================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' AND rowsecurity = false
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        RAISE NOTICE 'Enabled Row-Level Security (RLS) on table: %', r.tablename;
    END LOOP;
END $$;

-- =========================================================================
-- How to verify:
-- Run the query below to make sure all tables have rowsecurity = true
-- =========================================================================
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
