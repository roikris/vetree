-- Objects of kinds the 080 contract does not cover: each must be listed under "unsupported" (fail closed).
CREATE AGGREGATE public.mysum (int) (SFUNC = int4pl, STYPE = int);
CREATE TYPE public.rng AS RANGE (subtype = int4);
CREATE TABLE public.ruled (x int);
CREATE RULE r1 AS ON INSERT TO public.ruled DO INSTEAD NOTHING;
CREATE STATISTICS public.st1 ON id, name FROM public.items;
CREATE OPERATOR public.=== (LEFTARG = int, RIGHTARG = int, FUNCTION = int4eq);
