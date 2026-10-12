-- Sample objects that need a superuser (applied as supabase_admin after objects.sql in schema-report-test.yml).
-- On the Supabase image, `GRANT <role> TO CURRENT_USER` as postgres crashes the server (signal 11, 2026-10-12),
-- so the second grantor is set up here, where SET ROLE needs no membership.
-- The same privilege granted by two grantors must be reported once.
CREATE ROLE grantor_x NOLOGIN;
GRANT SELECT ON public.items TO grantor_x WITH GRANT OPTION;
SET ROLE grantor_x;
GRANT SELECT ON public.items TO anon;
RESET ROLE;
