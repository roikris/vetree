import Link from 'next/link'

const SPECIALTIES: [string, string][] = [
  ['Anesthesia', '#B49AE8'], ['Behavior', '#A6B0C0'], ['Cardiology', '#E88A92'],
  ['Dentistry', '#B8B0A0'], ['Dermatology', '#E0CC6A'], ['Emergency', '#E88AA0'],
  ['Equine', '#5FCDB8'], ['Exotic', '#5FC7D8'], ['Internal Medicine', '#7FB0EC'],
  ['Neurology', '#9AA6E8'], ['Nutrition', '#5FD69A'], ['Oncology', '#C79CE8'],
  ['Ophthalmology', '#7FB0EC'], ['Orthopedics', '#E8A968'], ['Pathology', '#E88AD8'],
  ['Pharmacology', '#BFD65E'], ['Radiology', '#6FBFEC'], ['Reproduction', '#E893C0'],
  ['Soft Tissue Surgery', '#E893C0'],
]

const STEPS = [
  {
    step: 'STEP 01',
    title: 'We read the literature',
    body: 'New peer-reviewed veterinary papers are ingested and parsed the moment they publish — across every major journal.',
    iconPath: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  },
  {
    step: 'STEP 02',
    title: 'We distil the bottom line',
    body: 'Each study is reduced to one clinical takeaway, graded for evidence strength and tagged by specialty and species.',
    iconPath: 'M12 3v18M3 12h18M7 7l10 10M17 7L7 17',
  },
  {
    step: 'STEP 03',
    title: 'You act in seconds',
    body: 'Search, filter and save. Read the answer, check the tier, and get back to the patient in front of you.',
    iconPath: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  },
]

const TIERS = [
  { name: 'Gold',   kind: 'Randomised controlled trials',  desc: 'The strongest evidence — trust it under pressure.',     c: '#A9E07C', dot: '#8FD65E', fill: 96 },
  { name: 'Silver', kind: 'Cohort & comparative studies',  desc: 'Solid, directional evidence to weigh in context.',       c: '#8FBEEC', dot: '#6FA8E8', fill: 64 },
  { name: 'Bronze', kind: 'Retrospective & case series',   desc: 'Useful signal — interpret with clinical judgement.',     c: '#E8B060', dot: '#E0A040', fill: 36 },
]

const STATS = [
  { num: '23,000+', label: 'Peer-reviewed articles distilled' },
  { num: '19',      label: 'Clinical specialties covered' },
  { num: '~40s',    label: 'To read one clinical bottom line' },
  { num: '3-tier',  label: 'Evidence grading on every paper' },
]

const CHIPS = ['canine diabetes management', 'feline hypertension', 'TPLO outcomes', 'lymphoma chemotherapy']

type LandingPageProps = {
  exampleArticle?: any
}

export function LandingPage({ exampleArticle }: LandingPageProps) {
  const cardTitle   = exampleArticle?.title               || 'Pimobendan in Preclinical Myxomatous Mitral Valve Disease'
  const cardBLine   = exampleArticle?.clinical_bottom_line || 'Pimobendan delayed the onset of congestive heart failure in preclinical MMVD dogs by roughly 15 months.'
  const cardJournal = exampleArticle?.source_journal      || 'J Vet Intern Med'
  const cardLabel   = exampleArticle?.labels?.[0]         || 'Cardiology'

  return (
    <div style={{ background: 'var(--al-bg)', minHeight: '100vh' }}>

      {/* ─── NAV ─── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(var(--al-bar), 0.82)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(var(--al-line), 0.08)',
      }}>
        <div
          className="px-5 py-[13px] md:px-10 md:py-4"
          style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--al-accent)">
              <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
            </svg>
            <span style={{ font: "600 21px/1 var(--font-spectral, serif)", color: 'var(--al-ink2)' }}>Vetree</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
            {/* Center links — hidden on mobile */}
            <div className="hidden md:flex items-center gap-7">
              <a href="#how-it-works" style={{ font: "500 14px/1 var(--font-instrument, sans-serif)", color: 'var(--al-sub)', textDecoration: 'none' }}>How it works</a>
              <a href="#evidence" style={{ font: "500 14px/1 var(--font-instrument, sans-serif)", color: 'var(--al-sub)', textDecoration: 'none' }}>Evidence</a>
              <a href="#specialties" style={{ font: "500 14px/1 var(--font-instrument, sans-serif)", color: 'var(--al-sub)', textDecoration: 'none' }}>For teams</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Link href="/login" style={{ font: "500 14px/1 var(--font-instrument, sans-serif)", color: 'var(--al-ink3)', textDecoration: 'none' }}>Sign in</Link>
              <Link
                href="/signup"
                className="px-[14px] py-[10px] md:px-[18px] md:py-[11px]"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--al-accent)', color: 'var(--al-on-accent)', font: "600 14px/1 var(--font-instrument, sans-serif)", borderRadius: 10, textDecoration: 'none' }}
              >Create free account</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(720px 420px at 78% -6%, rgba(var(--al-acct), .14), transparent 62%), radial-gradient(560px 380px at 8% 40%, rgba(var(--al-acct2), .10), transparent 60%)', pointerEvents: 'none' }} />
        <div
          className="grid grid-cols-1 md:grid-cols-[1.05fr_.95fr] gap-8 md:gap-[64px] px-5 pt-[44px] pb-[44px] md:px-10 md:pt-[78px] md:pb-10 items-center"
          style={{ position: 'relative', maxWidth: 1200, margin: '0 auto' }}
        >
          {/* Left */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderRadius: 999, background: 'rgba(var(--al-acct), .1)', border: '1px solid rgba(var(--al-acct), .28)', marginBottom: 26 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--al-accent)', display: 'inline-block' }} />
              <span style={{ font: "600 12px/1 var(--font-instrument, sans-serif)", letterSpacing: '.06em', color: 'var(--al-accent)' }}>The veterinary evidence engine</span>
            </div>
            <h1
              className="text-[38px] md:text-[60px]"
              style={{ margin: '0 0 22px', fontWeight: 500, lineHeight: 1.04, fontFamily: 'var(--font-spectral, serif)', letterSpacing: '-.02em', color: 'var(--al-ink1)' }}
            >
              Evidence-based veterinary research,{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--al-accent)' }}>distilled.</em>
            </h1>
            <p
              className="text-[16.5px] md:text-[19px]"
              style={{ margin: '0 0 34px', fontWeight: 400, lineHeight: 1.6, fontFamily: 'var(--font-instrument, sans-serif)', color: 'var(--al-sub)', maxWidth: 500 }}
            >
              Clinical bottom lines from <strong style={{ color: 'var(--al-ink3)', fontWeight: 600 }}>23,000+</strong> peer-reviewed articles — so you spend less time searching and more time treating.
            </p>
            <div className="flex flex-wrap items-center gap-[14px] mb-[22px]">
              <Link
                href="/signup"
                className="text-[14.5px] md:text-[15.5px] px-5 py-[14px] md:px-[26px] md:py-[15px]"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--al-accent)', color: 'var(--al-on-accent)', fontWeight: 600, lineHeight: 1, fontFamily: 'var(--font-instrument, sans-serif)', borderRadius: 12, textDecoration: 'none' }}
              >
                Create free account
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>
              </Link>
              <Link
                href="/?browse=1"
                className="text-[14.5px] md:text-[15.5px] px-5 py-[14px] md:px-[24px] md:py-[15px]"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'var(--al-ink3)', fontWeight: 600, lineHeight: 1, fontFamily: 'var(--font-instrument, sans-serif)', borderRadius: 12, border: '1px solid rgba(var(--al-line), .2)', textDecoration: 'none' }}
              >
                Browse articles
              </Link>
            </div>
            <p style={{ margin: '0 0 26px', font: "400 13.5px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)' }}>Free forever · No credit card · Built by a DVM</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ font: "italic 400 13.5px/1 var(--font-spectral, serif)", color: 'var(--al-mut6)', marginRight: 2 }}>Try —</span>
              {CHIPS.map(chip => (
                <Link key={chip} href={`/?search=${encodeURIComponent(chip)}`} style={{ padding: '7px 13px', borderRadius: 999, background: 'rgba(var(--al-line), .05)', border: '1px solid rgba(var(--al-line), .12)', font: "500 12.5px/1 var(--font-instrument, sans-serif)", color: 'var(--al-body)', textDecoration: 'none' }}>
                  {chip}
                </Link>
              ))}
            </div>
          </div>
          {/* Right: article card mock */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: '-14px 26px -18px -8px', background: 'var(--al-card)', border: '1px solid rgba(var(--al-line), .06)', borderRadius: 8, transform: 'rotate(-2.4deg)' }} />
            <div
              className="px-5 py-[22px] md:px-8 md:py-[30px]"
              style={{ position: 'relative', background: 'var(--al-card3)', border: '1px solid rgba(var(--al-line), .12)', borderRadius: 8, boxShadow: '0 30px 70px rgba(0,0,0,.3)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(var(--al-line), .14)', paddingBottom: 14, marginBottom: 18 }}>
                <span style={{ font: "600 11px/1 var(--font-instrument, sans-serif)", letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--al-sub)' }}>{cardLabel}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(var(--al-acct), .1)', border: '1px solid rgba(var(--al-acct), .25)', font: "500 11px/1 var(--font-instrument, sans-serif)", color: 'var(--al-accent)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--al-accent)', display: 'inline-block', flexShrink: 0 }} />
                  RCT / Meta-analysis
                </span>
              </div>
              <h3
                className="text-[20px] md:text-[24px]"
                style={{ margin: '0 0 20px', fontWeight: 500, lineHeight: 1.28, fontFamily: 'var(--font-spectral, serif)', color: 'var(--al-ink2)', letterSpacing: '-.008em' }}
              >{cardTitle}</h3>
              <div style={{ borderLeft: '2px solid var(--al-accent)', paddingLeft: 16, marginBottom: 22 }}>
                <div style={{ font: "600 10px/1 var(--font-instrument, sans-serif)", letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--al-accent)', marginBottom: 8 }}>Clinical bottom line</div>
                <p style={{ margin: 0, font: "italic 400 16.5px/1.55 var(--font-spectral, serif)", color: 'var(--al-ink5)' }}>{cardBLine}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: "italic 400 13px/1 var(--font-spectral, serif)", color: 'var(--al-mut3)' }}>{cardJournal}</span>
                <span style={{ font: "500 12px/1 var(--font-instrument, sans-serif)", color: 'var(--al-accent)' }}>40-sec read</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── STAT BAND ─── */}
      <div style={{ borderTop: '1px solid rgba(var(--al-line), .08)', borderBottom: '1px solid rgba(var(--al-line), .08)', marginTop: 36 }}>
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-y-[26px] md:gap-y-0 px-5 py-[34px] md:px-10"
          style={{ maxWidth: 1200, margin: '0 auto' }}
        >
          {STATS.map((s, i) => (
            <div
              key={s.num}
              className={`px-[34px] py-[6px]${i > 0 ? ' max-md:!border-l-0' : ''}`}
              style={{ borderLeft: i > 0 ? '1px solid rgba(var(--al-line), .1)' : undefined }}
            >
              <div style={{ font: "500 34px/1 var(--font-spectral, serif)", color: 'var(--al-ink2)', letterSpacing: '-.01em' }}>{s.num}</div>
              <div style={{ font: "400 13.5px/1.4 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)', marginTop: 8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── HOW IT WORKS ─── */}
      <div
        id="how-it-works"
        className="px-5 pt-16 pb-5 md:px-10 md:pt-[100px] md:pb-5"
        style={{ maxWidth: 1200, margin: '0 auto' }}
      >
        <div style={{ maxWidth: 640, marginBottom: 52 }}>
          <div style={{ font: "600 12px/1 var(--font-instrument, sans-serif)", letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--al-accent)', marginBottom: 16 }}>How it works</div>
          <h2 style={{ margin: '0 0 16px', font: "500 40px/1.12 var(--font-spectral, serif)", color: 'var(--al-ink2)', letterSpacing: '-.015em' }}>The paper is read for you. You get the part that changes the case.</h2>
          <p style={{ margin: 0, font: "400 17px/1.6 var(--font-instrument, sans-serif)", color: 'var(--al-mut3)' }}>Every article is distilled into a single clinical bottom line, graded for evidence strength, and tagged by specialty — so you can trust it at a glance and act on it in seconds.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
          {STEPS.map(st => (
            <div key={st.step} style={{ background: 'var(--al-card)', border: '1px solid rgba(var(--al-line), .09)', borderRadius: 16, padding: '30px 28px' }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(var(--al-acct), .1)', border: '1px solid rgba(var(--al-acct), .24)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--al-accent)', marginBottom: 20 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={st.iconPath}/></svg>
              </div>
              <div style={{ font: "600 11px/1 var(--font-instrument, sans-serif)", letterSpacing: '.12em', color: 'var(--al-mut6)', marginBottom: 10 }}>{st.step}</div>
              <h3 style={{ margin: '0 0 10px', font: "600 20px/1.25 var(--font-spectral, serif)", color: 'var(--al-ink2)' }}>{st.title}</h3>
              <p style={{ margin: 0, font: "400 14.5px/1.6 var(--font-instrument, sans-serif)", color: 'var(--al-mut3)' }}>{st.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── EVIDENCE TIERS ─── */}
      <div
        id="evidence"
        className="px-5 pt-16 pb-5 md:px-10 md:pt-24 md:pb-5"
        style={{ maxWidth: 1200, margin: '0 auto' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[.85fr_1.15fr] gap-[64px] md:items-center">
          <div>
            <div style={{ font: "600 12px/1 var(--font-instrument, sans-serif)", letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--al-accent)', marginBottom: 16 }}>Graded evidence</div>
            <h2 style={{ margin: '0 0 16px', font: "500 38px/1.14 var(--font-spectral, serif)", color: 'var(--al-ink2)', letterSpacing: '-.015em' }}>Know how much weight to give it — before you read a word.</h2>
            <p style={{ margin: '0 0 22px', font: "400 16.5px/1.62 var(--font-instrument, sans-serif)", color: 'var(--al-mut3)' }}>Not all evidence is equal. Every article carries a tier so you can tell a randomised trial from a single-centre chart review at a glance.</p>
            <p style={{ margin: 0, font: "italic 400 15px/1.55 var(--font-spectral, serif)", color: 'var(--al-mut6)' }}>Filter your whole feed to gold-tier only when the stakes are high.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TIERS.map(t => (
              <div
                key={t.name}
                className="flex flex-wrap items-start gap-5 p-[18px] md:flex-nowrap md:items-center md:px-6 md:py-5"
                style={{ background: 'var(--al-card)', border: '1px solid rgba(var(--al-line), .09)', borderRadius: 14 }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, width: 104, padding: '7px 12px', borderRadius: 999, font: "600 12px/1 var(--font-instrument, sans-serif)", background: `${t.c}1A`, border: `1px solid ${t.c}40`, color: `color-mix(in oklab, ${t.c} var(--al-chipmix, 52%), #241B0C)` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.dot, display: 'inline-block', flexShrink: 0 }} />
                  {t.name}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 15px/1.2 var(--font-spectral, serif)", color: 'var(--al-ink2)', marginBottom: 3 }}>{t.kind}</div>
                  <div style={{ font: "400 13px/1.45 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)' }}>{t.desc}</div>
                </div>
                <div style={{ width: 64, height: 5, borderRadius: 999, background: 'rgba(var(--al-line), .09)', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ width: `${t.fill}%`, height: '100%', borderRadius: 999, background: t.c }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SPECIALTIES ─── */}
      <div
        id="specialties"
        className="px-5 pt-16 pb-5 md:px-10 md:pt-24 md:pb-5"
        style={{ maxWidth: 1200, margin: '0 auto' }}
      >
        <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 44px' }}>
          <div style={{ font: "600 12px/1 var(--font-instrument, sans-serif)", letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--al-accent)', marginBottom: 16 }}>Every corner of the clinic</div>
          <h2 style={{ margin: 0, font: "500 36px/1.16 var(--font-spectral, serif)", color: 'var(--al-ink2)', letterSpacing: '-.015em' }}>Tuned to your specialty — and your species.</h2>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11, justifyContent: 'center', maxWidth: 840, margin: '0 auto' }}>
          {SPECIALTIES.map(([name, c]) => (
            <Link key={name} href={`/?labels=${encodeURIComponent(name)}`} style={{ padding: '9px 16px', borderRadius: 999, background: `${c}12`, border: `1px solid ${c}33`, font: "500 13.5px/1 var(--font-instrument, sans-serif)", color: `color-mix(in oklab, ${c} var(--al-chipmix, 52%), #241B0C)`, textDecoration: 'none' }}>
              {name}
            </Link>
          ))}
        </div>
      </div>

      {/* ─── BUILT BY A DVM ─── */}
      <div
        className="px-5 pt-16 pb-5 md:px-10 md:pt-24 md:pb-5"
        style={{ maxWidth: 1200, margin: '0 auto' }}
      >
        <div
          className="grid grid-cols-1 md:grid-cols-[auto_1fr] px-[26px] py-8 md:px-14 md:py-[52px] gap-10 items-start md:items-center"
          style={{ background: 'linear-gradient(135deg, rgba(var(--al-acct), .08), rgba(var(--al-acct2), .04))', border: '1px solid rgba(var(--al-acct), .18)', borderRadius: 24 }}
        >
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(150deg, var(--al-card4), var(--al-card))', border: '1px solid rgba(var(--al-line), .14)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 30px/1 var(--font-spectral, serif)", color: 'var(--al-accent)' }}>DVM</div>
          <div>
            <div style={{ font: "600 11px/1 var(--font-instrument, sans-serif)", letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--al-accent)', marginBottom: 16 }}>Built by a clinician</div>
            <p
              className="text-[19px] md:text-[24px]"
              style={{ margin: '0 0 18px', fontWeight: 400, lineHeight: 1.5, fontFamily: 'var(--font-spectral, serif)', color: 'var(--al-ink3)', letterSpacing: '-.005em' }}
            >"I built Vetree because I was drowning in papers between appointments. I wanted the answer, graded and trustworthy, in the ninety seconds I actually had."</p>
            <div style={{ font: "500 14px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut3)' }}>A practising veterinarian · Founder, Vetree</div>
          </div>
        </div>
      </div>

      {/* ─── FINAL CTA ─── */}
      <div
        className="px-5 pt-16 pb-[72px] md:px-10 md:pt-[100px] md:pb-[110px]"
        style={{ maxWidth: 1200, margin: '0 auto' }}
      >
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <h2
            className="text-[32px] md:text-[46px]"
            style={{ margin: '0 0 18px', fontWeight: 500, lineHeight: 1.08, fontFamily: 'var(--font-spectral, serif)', color: 'var(--al-ink1)', letterSpacing: '-.02em' }}
          >Stay current in the time you actually have.</h2>
          <p style={{ margin: '0 0 32px', font: "400 18px/1.6 var(--font-instrument, sans-serif)", color: 'var(--al-mut3)' }}>Join the veterinary professionals reading smarter. Free forever, no credit card.</p>
          <div className="flex flex-wrap items-center justify-center gap-[14px]">
            <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--al-accent)', color: 'var(--al-on-accent)', font: "600 16px/1 var(--font-instrument, sans-serif)", padding: '16px 30px', borderRadius: 12, textDecoration: 'none' }}>
              Create free account
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>
            </Link>
            <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', font: "600 16px/1 var(--font-instrument, sans-serif)", color: 'var(--al-ink3)', padding: '16px 24px', borderRadius: 12, border: '1px solid rgba(var(--al-line), .2)', textDecoration: 'none' }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>

      {/* ─── FOOTER ─── */}
      <div style={{ borderTop: '1px solid rgba(var(--al-line), .08)' }}>
        <div
          className="px-5 py-[34px] md:px-10"
          style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--al-accent)"><path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/></svg>
            <span style={{ font: "600 15px/1 var(--font-spectral, serif)", color: 'var(--al-body)' }}>Vetree</span>
            <span style={{ font: "400 13px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut6)', marginLeft: 8 }}>Evidence-based veterinary research, distilled.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Link href="/privacy" style={{ font: "400 13px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" style={{ font: "400 13px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)', textDecoration: 'none' }}>Terms</Link>
            <a href="mailto:contact@vetree.app" style={{ font: "400 13px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)', textDecoration: 'none' }}>Contact</a>
          </div>
        </div>
      </div>

    </div>
  )
}
