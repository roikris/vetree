-- Uncovered kinds that need a superuser to create (applied as supabase_admin in schema-report-test.yml).
CREATE TEXT SEARCH TEMPLATE public.tmpl (INIT = dsimple_init, LEXIZE = dsimple_lexize);
CREATE TEXT SEARCH PARSER public.prs (START = prsd_start, GETTOKEN = prsd_nexttoken, END = prsd_end, LEXTYPES = prsd_lextype);
