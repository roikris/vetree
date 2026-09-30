/**
 * Consent wording in both languages. The interface is English, so consent defaults to English
 * (it used to be Hebrew-only inside English forms); a toggle shows the same wording in Hebrew.
 * Both versions say the same thing and link to the same /terms and /privacy documents.
 */
export type ConsentLang = 'en' | 'he'

export const CONSENT_COPY = {
  en: {
    dir: 'ltr' as const,
    switchTo: 'עברית',
    switchLabel: 'הצג את נוסח ההסכמה בעברית',
    termsBefore: "I have read and agree to Vetree's ",
    terms: 'Terms of Service',
    and: ' and ',
    privacy: 'Privacy Policy',
    termsAfter: '.',
    termsRequired: 'Please accept the Terms of Service and Privacy Policy to continue.',
    digestQuestion: "Get the weekly evidence digest — the week's new research, once, Fridays.",
    digestYes: 'Yes, send it',
    digestNo: 'No thanks',
    gateTitle: 'Updated terms',
    gateBody: "We've updated our Terms of Service and Privacy Policy. Please confirm to keep using Vetree.",
    gateSubmit: 'Confirm and continue',
    gateSaving: 'Saving…',
    gateSaveError: 'Could not save your consent. Please try again.',
  },
  he: {
    dir: 'rtl' as const,
    switchTo: 'English',
    switchLabel: 'Show the consent wording in English',
    termsBefore: 'קראתי ואני מסכים/ה ל',
    terms: 'תנאי השימוש',
    and: ' ול',
    privacy: 'מדיניות הפרטיות',
    termsAfter: ' של Vetree.',
    termsRequired: 'יש לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך',
    digestQuestion: 'לקבל את תקציר הראיות השבועי — המחקרים החדשים של השבוע, פעם בשבוע, בימי שישי.',
    digestYes: 'כן, שלחו לי',
    digestNo: 'לא תודה',
    gateTitle: 'עדכון תנאי שימוש',
    gateBody: 'עדכנו את תנאי השימוש ומדיניות הפרטיות שלנו. אנא אשר/י את הסכמתך כדי להמשיך להשתמש ב-Vetree.',
    gateSubmit: 'אישור והמשך',
    gateSaving: 'שומר...',
    gateSaveError: 'שגיאה בשמירת ההסכמה. נסה/י שוב.',
  },
}
