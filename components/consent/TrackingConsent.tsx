'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import {
  readTrackingChoice, writeTrackingChoice, TRACKING_CONSENT_EVENT, TRACKING_SETTINGS_EVENT, type TrackingChoice,
} from '@/lib/consent/tracking'

const COPY = {
  en: {
    dir: 'ltr' as const,
    text: 'With your permission, Vetree uses LinkedIn and Meta cookies to measure its ads. Optional — the site works the same either way.',
    policy: 'Privacy Policy',
    policyHref: '/privacy',
    accept: 'Accept',
    reject: 'Reject',
    switchTo: 'עברית',
  },
  he: {
    dir: 'rtl' as const,
    text: 'בהסכמתך, Vetree משתמשת בעוגיות של LinkedIn ו-Meta למדידת המודעות שלה. רשות — האתר פועל באותו אופן בכל מקרה.',
    policy: 'מדיניות הפרטיות',
    policyHref: '/privacy?lang=he',
    accept: 'אישור',
    reject: 'דחייה',
    switchTo: 'English',
  },
}

/**
 * Consent bar for optional tracking. Until the visitor accepts, the LinkedIn Insight Tag and the Meta
 * Pixel are NOT loaded. Automated browsers (smoke tests) never see the
 * bar and never load them. Changing an earlier "accept" to "reject" reloads the page, because
 * scripts that already ran can't be unloaded.
 */
// The stored choice as an external store: 'ssr' on the server (render nothing), 'none' when the
// visitor hasn't chosen yet. Automated browsers (smoke tests) count as 'rejected'.
type Snapshot = TrackingChoice | 'none' | 'ssr'
function subscribe(onChange: () => void) {
  window.addEventListener(TRACKING_CONSENT_EVENT, onChange)
  window.addEventListener('storage', onChange)   // another tab changed it
  return () => {
    window.removeEventListener(TRACKING_CONSENT_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
const getSnapshot = (): Snapshot => (navigator.webdriver ? 'rejected' : readTrackingChoice() ?? 'none')
const getServerSnapshot = (): Snapshot => 'ssr'

export function TrackingConsent({ linkedinPartnerId, fbPixelId }: { linkedinPartnerId?: string; fbPixelId?: string }) {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [lang, setLang] = useState<'en' | 'he'>('en')
  const open = choice === 'none' || (settingsOpen && choice !== 'ssr' && !navigator.webdriver)

  useEffect(() => {
    const onSettings = () => setSettingsOpen(true)
    window.addEventListener(TRACKING_SETTINGS_EVENT, onSettings)
    return () => window.removeEventListener(TRACKING_SETTINGS_EVENT, onSettings)
  }, [])

  // Leaving "accepted" — here or in another tab — reloads: pixels that already ran can't be unloaded,
  // and a fresh page starts without them (the rejection survives the reload even if storage fails)
  const prevChoice = useRef<Snapshot>(choice)
  useEffect(() => {
    if (prevChoice.current === 'accepted' && choice !== 'accepted') window.location.reload()
    prevChoice.current = choice
  }, [choice])

  const decide = (c: TrackingChoice) => {
    writeTrackingChoice(c)
    setSettingsOpen(false)
  }

  const copy = COPY[lang]
  return (
    <>
      {choice === 'accepted' && linkedinPartnerId && (
        <Script id="linkedin-insight-tag" strategy="afterInteractive">
          {`
            _linkedin_partner_id = "${linkedinPartnerId}";
            window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
            window._linkedin_data_partner_ids.push(_linkedin_partner_id);
            (function(l) {
              if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
              window.lintrk.q=[]}
              var s = document.getElementsByTagName("script")[0];
              var b = document.createElement("script");
              b.type = "text/javascript";b.async = true;
              b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
              s.parentNode.insertBefore(b, s);
            })(window.lintrk);
          `}
        </Script>
      )}
      {choice === 'accepted' && fbPixelId && (
        <Script id="facebook-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${fbPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {open && (
        <div
          role="region"
          aria-label={lang === 'en' ? 'Cookie choices' : 'בחירת עוגיות'}
          data-testid="tracking-consent"
          className="tracking-consent"
          dir={copy.dir}
          lang={lang}
          style={{
            position: 'fixed', left: 12, right: 12, zIndex: 45,   // below full-screen prompts (ConsentGate, PWA: 50)
            maxWidth: 640, margin: '0 auto',
            background: 'var(--al-card, #fff)', color: 'var(--al-ink3, #1a1a1a)',
            border: '1px solid rgba(var(--al-line, 62,54,36), .16)', borderRadius: 14,
            boxShadow: '0 8px 30px rgba(0,0,0,.14)', padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            font: '400 13.5px/1.5 var(--font-instrument, sans-serif)',
          }}
        >
          <style>{`
            .tracking-consent { bottom: 16px; }
            @media (max-width: 767px) { .tracking-consent { bottom: calc(72px + env(safe-area-inset-bottom)); } }
          `}</style>
          <p style={{ margin: 0, flex: '1 1 260px' }}>
            {copy.text}{' '}
            <Link href={copy.policyHref} style={{ color: 'var(--al-accent, #3D7A5F)', textDecoration: 'underline' }}>{copy.policy}</Link>
            {' · '}
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
              lang={lang === 'en' ? 'he' : 'en'}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--al-accent, #3D7A5F)', textDecoration: 'underline', font: 'inherit' }}
            >
              {copy.switchTo}
            </button>
          </p>
          {/* Equal weight: rejecting is as easy as accepting */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['rejected', 'accepted'] as const).map(c => (
              <button
                key={c}
                type="button"
                data-testid={`tracking-${c === 'accepted' ? 'accept' : 'reject'}`}
                onClick={() => decide(c)}
                style={{
                  padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
                  font: '600 13.5px/1 var(--font-instrument, sans-serif)',
                  background: 'var(--al-card, #fff)', color: 'var(--al-ink3, #1a1a1a)',
                  border: '1.5px solid rgba(var(--al-line, 62,54,36), .3)',
                }}
              >
                {c === 'accepted' ? copy.accept : copy.reject}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/** "Cookie settings" link — re-opens the bar */
export function CookieSettingsButton({ className, style, label = 'Cookie settings' }: { className?: string; style?: React.CSSProperties; label?: string }) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => window.dispatchEvent(new Event(TRACKING_SETTINGS_EVENT))}
    >
      {label}
    </button>
  )
}
