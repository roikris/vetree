/**
 * Consent wording in both languages. The interface is English, so consent defaults to English
 * (it used to be Hebrew-only inside English forms); a toggle shows the same wording in Hebrew.
 * Both versions say the same thing and link to the Terms and Privacy Policy in the same language.
 */
export type ConsentLang = 'en' | 'he'
export const isConsentLang = (v: unknown): v is ConsentLang => v === 'en' || v === 'he'

export const CONSENT_COPY = {
  en: {
    dir: 'ltr' as const,
    termsHref: '/terms',
    privacyHref: '/privacy',
    switchTo: 'עברית',
    switchLabel: 'הצג את נוסח ההסכמה בעברית',
    termsBefore: "I agree to Vetree's ",
    terms: 'Terms of Service',
    and: ' and acknowledge its ',
    privacy: 'Privacy Policy',
    termsAfter: '.',
    termsRequired: 'Please accept the Terms of Service and Privacy Policy to continue.',
    digestQuestion: "Email me Vetree's weekly research digest on Fridays? It may be personalised using the specialties I follow and my recent activity. Optional — unsubscribe any time.",
    digestYes: 'Yes, send it',
    digestNo: 'No thanks',
    gateTitle: 'Updated terms',
    gateBody: "We've updated our Terms of Service and Privacy Policy. Please confirm to keep using Vetree.",
    gateSubmit: 'Confirm and continue',
    gateSaving: 'Saving…',
    gateSaveError: 'Could not save your consent. Please try again.',
    gateStale: 'The terms have been updated since this page opened. Please reload to review the new version.',
  },
  he: {
    dir: 'rtl' as const,
    termsHref: '/terms?lang=he',
    privacyHref: '/privacy?lang=he',
    switchTo: 'English',
    switchLabel: 'Show the consent wording in English',
    termsBefore: 'אני מסכים/ה ל',
    terms: 'תנאי השימוש',
    and: ' של Vetree ומאשר/ת שעיינתי ב',
    privacy: 'מדיניות הפרטיות',
    termsAfter: '.',
    termsRequired: 'יש לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך',
    digestQuestion: 'לקבל בדוא"ל את תקציר המחקרים השבועי של Vetree בימי שישי? התקציר עשוי להיות מותאם לתחומי ההתמחות שבחרתי ולפעילותי האחרונה. רשות — ניתן לבטל בכל עת.',
    digestYes: 'כן, שלחו לי',
    digestNo: 'לא תודה',
    gateTitle: 'עדכון תנאי שימוש',
    gateBody: 'עדכנו את תנאי השימוש ומדיניות הפרטיות שלנו. אנא אשר/י את הסכמתך כדי להמשיך להשתמש ב-Vetree.',
    gateSubmit: 'אישור והמשך',
    gateSaving: 'שומר...',
    gateSaveError: 'שגיאה בשמירת ההסכמה. נסה/י שוב.',
    gateStale: 'התנאים עודכנו מאז שהדף נפתח. יש לרענן את הדף כדי לעיין בגרסה החדשה.',
  },
}
