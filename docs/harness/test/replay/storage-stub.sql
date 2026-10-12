-- Replay environment (infra-003), applied as supabase_admin BEFORE any migration: a minimal stand-in for the
-- storage schema, which Supabase's storage service creates (not the database image). Migrations 007 / 033 / 068
-- insert the avatars bucket, update it and create / drop policies on storage.objects, so these objects must exist.
-- Storage itself is a listed gap of the replay (Roi, 2026-10-12): nothing about it is compared — the audits only
-- cover the public schema. Never applied to production.
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean DEFAULT false,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
-- migrations run as postgres, which must own the tables to create policies on them
ALTER TABLE storage.buckets OWNER TO postgres;
ALTER TABLE storage.objects OWNER TO postgres;
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;
