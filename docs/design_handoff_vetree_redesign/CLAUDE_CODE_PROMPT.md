# Claude Code Prompt — Vetree UI Redesign

Copy the block below into Claude Code (Sonnet) at the repo root, after placing this
handoff folder somewhere it can read (e.g. `docs/design_handoff_vetree_redesign/`).

Run it **one phase at a time** — do not paste all phases at once.

---

## Kickoff prompt (paste first)

> You're implementing a visual redesign of Vetree (the "Almanac" direction). The full
> spec is in `docs/design_handoff_vetree_redesign/README.md` and the design references
> are the HTML prototypes in that folder's `designs/`, with rendered references in
> `screenshots/`.
>
> Ground rules:
> - This is a **reskin, not a rebuild**. Keep all existing functionality, routes, data
>   fetching, auth, and the recharts admin charts. Only the presentation changes.
> - The prototypes are **design references in HTML**, not code to copy. Recreate them in
>   our existing stack: Next.js App Router + Tailwind + Supabase + recharts, using our
>   established components and patterns. Do **not** import the prototype's `support.js` or
>   `ios-frame.jsx`, and do not copy the `.dc.html` files into the app.
> - Exact colors/spacing/type live in the prototype's inline styles — read the relevant
>   `designs/*.dc.html` file for any value the README doesn't spell out, and compare your
>   output against the matching file in `screenshots/`.
> - Accent is locked: `#8FCB5E` (dark) / `#5F8C33` (light). Both themes are in scope.
>
> Start with **Phase 1 only**: read the README's "Design Tokens" and "Implementation
> Order" sections, then add the Spectral + Instrument Sans fonts via `next/font`, define
> the token tables as CSS variables / Tailwind theme entries, and wire Dark/Light to our
> existing theme mechanism. Show me the token setup and font wiring before touching any
> screen. Do not start Phase 2 until I confirm.

## Follow-up prompts (one per phase, after each is approved)

- **Phase 2 — Feed (Stream + List):** "Read `designs/Vetree - Core.dc.html` and
  `screenshots/feed-stream.png` + `feed-list.png`. Rebuild the home feed's app bar, view
  switcher, filter pills, and the Stream and List views against real article data. Skip
  the Grove view for now. Match the screenshots."
- **Phase 3 — Article detail:** "Read `designs/Vetree - Article.dc.html` +
  `screenshots/article.png`. Rebuild `app/article/[id]`. Keep the AI disclaimer copy
  verbatim."
- **Phase 4 — Library:** "Read `designs/Vetree - Library.dc.html` +
  `screenshots/library.png`. Rebuild `app/library` with the Saved / Collections /
  Reading list tabs."
- **Phase 5 — Onboarding:** "Read `designs/Vetree - Onboarding.dc.html` +
  `screenshots/onboarding-step{1,2,3}.png`. Rebuild the 4-step signup flow."
- **Phase 6 — Landing:** "Read `designs/Vetree - Landing.dc.html` +
  `screenshots/landing.png`. Rebuild the logged-out `app/page.tsx`."
- **Phase 7 — Grove view:** "Read the Grove section of `designs/Vetree - Core.dc.html` +
  `screenshots/feed-grove.png`. Add the SVG specialty-map view to the feed's view
  switcher. Ship it behind a feature flag."
- **Phase 8 — Admin reskin:** "Read `designs/Vetree - Admin.dc.html` +
  `screenshots/admin.png`. Restyle `app/admin/*`: the sidebar (drop the emoji icons, use
  dot indicators) and the analytics page. Keep recharts but retheme it per the README,
  and replace the two pie charts with the distribution-bar / stacked-segment treatments."
- **Phase 9 — Mobile + light-mode QA:** "Read `designs/Vetree - Mobile.dc.html` +
  `screenshots/mobile.png`. Verify responsive behavior of the feed and article detail,
  hit targets ≥44px, and that every screen's light-mode tokens are correct."

## Tips for the developer

- Keep each phase in its own branch/PR — they're independently shippable.
- Have Claude Code diff its rendered result against the screenshot before declaring a
  phase done; small type/spacing drift is the usual miss.
- If context gets tight, start a fresh Claude Code session per phase and re-share the
  README + that phase's design file.
