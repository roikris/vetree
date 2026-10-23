// Meta's link-preview fetchers (perf-001, 2026-10-23). facebookexternalhit fetched the home page ~310 times a day,
// every ~2.5 min with no ad running — each one a full uncached render of the force-dynamic home page (about 2/3 of all
// home renders). For "/" only, next.config.ts rewrites these user agents to /link-preview: a prerendered page under
// the same root layout, so it carries the exact same Open Graph / Twitter tags (app/layout.tsx generateMetadata).
// Article pages are not rewritten — their tags are per article.
// Not meta-webindexer (Meta's search crawler): it indexes content, so it gets the real page.
export const META_PREVIEW_UA = '.*(facebookexternalhit|meta-externalagent|facebookcatalog).*'

export const META_PREVIEW_PATH = '/link-preview'
