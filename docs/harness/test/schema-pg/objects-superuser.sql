-- Sample objects that need a superuser (applied as supabase_admin after objects.sql in schema-report-test.yml).
-- On the Supabase image, `GRANT <role> TO CURRENT_USER` as postgres crashes the server (signal 11, 2026-10-12),
-- so the second grantor is set up here, where SET ROLE needs no membership.
-- The same privilege granted by two grantors must be reported once.
CREATE ROLE grantor_x NOLOGIN;
GRANT SELECT ON public.items TO grantor_x WITH GRANT OPTION;
SET ROLE grantor_x;
GRANT SELECT ON public.items TO anon;
RESET ROLE;
-- Objects owned by an extension, with what PostgreSQL creates for them (a composite type's backing relation, a
-- table's row type and index): all excluded, and the inventory still reconciles.
CREATE TYPE public.extcomp AS (a int);
ALTER EXTENSION pg_trgm ADD TYPE public.extcomp;
CREATE TABLE public.exttab (id int PRIMARY KEY);
ALTER EXTENSION pg_trgm ADD TABLE public.exttab;
