import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, LegalSection, LegalList, ContactButton, CONTACT_EMAIL, legalLang } from '@/components/legal/LegalShell'

// Update BOTH languages and EFFECTIVE_DATE together (and CURRENT_CONSENT_VERSION if material).
const EFFECTIVE_DATE = '2026-09-30'

export const metadata: Metadata = { title: 'Terms of Service — Vetree', alternates: { canonical: '/terms' } }

export default async function TermsPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const lang = legalLang((await searchParams).lang)
  return lang === 'he' ? <TermsHe /> : <TermsEn />
}

const WARN = 'bg-amber-50 dark:bg-amber-900/20 border-s-4 border-amber-500 dark:border-amber-600 p-6 rounded-e-lg text-amber-900 dark:text-amber-200'
const LINK = 'text-[#3D7A5F] dark:text-[#4E9A78] hover:underline'

function TermsEn() {
  return (
    <LegalShell lang="en" path="/terms" title="Terms of Service" effectiveDate={EFFECTIVE_DATE}>
      <LegalSection title="1. Acceptance">
        <p>
          These Terms govern your use of Vetree (vetree.app), an evidence-based veterinary research platform
          operated by Roi Krispin, La Guardia 60, Tel Aviv, Israel (&ldquo;Vetree&rdquo;, &ldquo;we&rdquo;). By creating an account or using Vetree you agree
          to these Terms and to our <Link href="/privacy" className={LINK}>Privacy Policy</Link>. If you do not agree,
          please do not use Vetree.
        </p>
      </LegalSection>

      <LegalSection title="2. The service">
        <p>
          Vetree collects published veterinary research, presents it with AI-generated summaries and clinical bottom
          lines, and lets you search, filter, save and follow topics. With your consent we send a weekly digest of
          new research by email.
        </p>
      </LegalSection>

      <LegalSection title="3. Not veterinary advice">
        <div className={WARN}>
          <p>
            Summaries, clinical bottom lines, evidence labels and research syntheses on Vetree are generated with
            artificial intelligence. They are for <strong>information only</strong>, may contain errors or omissions,
            and are <strong>not veterinary or medical advice</strong>. Always read the original article and use your
            professional judgment before making clinical decisions.
          </p>
        </div>
      </LegalSection>

      <LegalSection title="4. Your account">
        <p>To use some features you need an account. You agree to:</p>
        <LegalList items={[
          'provide accurate information and keep it up to date;',
          'keep your sign-in details secure and not share your account;',
          `tell us promptly at ${CONTACT_EMAIL} about any unauthorized use;`,
          'be responsible for activity under your account.',
        ]} />
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <p>You agree not to:</p>
        <LegalList items={[
          'use Vetree for any unlawful purpose;',
          'try to gain unauthorized access to our systems or other users’ data;',
          'interfere with or disrupt the service;',
          'scrape, crawl or systematically download content from Vetree;',
          'upload malware or harmful code;',
          'impersonate others or misrepresent your affiliation;',
          'use the service to send spam or to harass others.',
        ]} />
      </LegalSection>

      <LegalSection title="6. Intellectual property">
        <p>
          Rights in the Vetree platform — its design, code and features — belong to Vetree or its licensors, to the
          extent those rights exist under applicable law. We do not claim ownership of third-party articles or
          guarantee that AI-generated text qualifies for copyright protection. Research articles belong to their
          publishers and authors; we link to the original and show abstracts with attribution, and their use is
          subject to the publishers&apos; terms. You keep ownership of
          content you send us (such as reports) and allow us to use it to operate and improve the service.
        </p>
      </LegalSection>

      <LegalSection title="7. Emails">
        <p>
          We send account emails you need (for example, email confirmation and password resets). The weekly digest is
          sent only if you agreed, and you can stop it at any time with the unsubscribe link or in your profile.
        </p>
      </LegalSection>

      <LegalSection title="8. Ending your use">
        <p>
          You can delete your account at any time in your profile; it is deleted immediately, as described in the
          Privacy Policy. We may suspend or close an account that breaches these Terms, is used unlawfully or abuses
          the service.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimer and limitation of liability">
        <p>
          Vetree is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent permitted by law, we give no
          warranty that the service will be uninterrupted or error-free, or that its content — including
          AI-generated content — is accurate or complete, and we are not liable for indirect or consequential
          loss, or for loss arising from reliance on the content or from service interruptions. Nothing in these
          Terms limits liability that cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to these Terms">
        <p>
          When we change these Terms we update the effective date above. If a change is material, we will ask you
          to review and accept the updated Terms when you next sign in.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing law">
        <p>
          These Terms are governed by Israeli law, subject to mandatory protections that apply to you. The courts
          of Israel have jurisdiction, except where applicable law gives you a non-waivable right to bring
          proceedings elsewhere.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>Roi Krispin, La Guardia 60, Tel Aviv, Israel · <span dir="ltr">{CONTACT_EMAIL}</span></p>
        <ContactButton lang="en" />
      </LegalSection>
    </LegalShell>
  )
}

function TermsHe() {
  return (
    <LegalShell lang="he" path="/terms" title="תנאי שימוש" effectiveDate={EFFECTIVE_DATE}>
      <LegalSection title="1. הסכמה לתנאים">
        <p>
          תנאים אלו חלים על השימוש שלך ב-Vetree, בכתובת <span dir="ltr">vetree.app</span> (להלן: &quot;Vetree&quot; או
          &quot;אנחנו&quot;), פלטפורמה למחקר וטרינרי מבוסס ראיות המופעלת בידי רועי קריספין, לה גוארדיה 60, תל אביב, ישראל. ביצירת חשבון או בשימוש ב-Vetree את/ה מסכים/ה לתנאים אלו ול
          <Link href="/privacy?lang=he" className={LINK}>מדיניות הפרטיות</Link> שלנו. אם אינך מסכים/ה, אנא אל תשתמש/י
          ב-Vetree.
        </p>
      </LegalSection>

      <LegalSection title="2. השירות">
        <p>
          Vetree אוספת מחקר וטרינרי שפורסם, מציגה אותו עם סיכומים ושורות תחתונות קליניות שנוצרו בבינה מלאכותית,
          ומאפשרת לחפש, לסנן, לשמור ולעקוב אחר נושאים. בהסכמתך אנו שולחים בדוא&quot;ל תקציר שבועי של מחקרים חדשים.
        </p>
      </LegalSection>

      <LegalSection title="3. אין באמור ייעוץ וטרינרי">
        <div className={WARN}>
          <p>
            הסיכומים, השורות התחתונות הקליניות, תוויות רמת הראיות וסינתזות המחקר ב-Vetree נוצרים באמצעות בינה
            מלאכותית. הם <strong>לצורכי מידע בלבד</strong>, עשויים לכלול טעויות או השמטות, ו<strong>אינם ייעוץ
            וטרינרי או רפואי</strong>. יש תמיד לקרוא את המאמר המקורי ולהפעיל שיקול דעת מקצועי לפני קבלת החלטות
            קליניות.
          </p>
        </div>
      </LegalSection>

      <LegalSection title="4. החשבון שלך">
        <p>חלק מהתכונות מחייבות חשבון. את/ה מתחייב/ת:</p>
        <LegalList items={[
          'למסור מידע נכון ולעדכן אותו;',
          'לשמור על פרטי ההתחברות בסוד ולא לשתף את החשבון;',
          `להודיע לנו מיד בכתובת ${CONTACT_EMAIL} על כל שימוש לא מורשה;`,
          'לשאת באחריות לפעילות בחשבון שלך.',
        ]} />
      </LegalSection>

      <LegalSection title="5. שימוש מותר">
        <p>את/ה מתחייב/ת שלא:</p>
        <LegalList items={[
          'להשתמש ב-Vetree למטרה בלתי חוקית;',
          'לנסות להשיג גישה לא מורשית למערכות שלנו או למידע של משתמשים אחרים;',
          'להפריע לשירות או לשבש אותו;',
          'לגרד (scrape), לסרוק או להוריד באופן שיטתי תוכן מ-Vetree;',
          'להעלות נוזקות או קוד מזיק;',
          'להתחזות לאחרים או להציג שיוך כוזב;',
          'להשתמש בשירות לשליחת דואר זבל או להטרדת אחרים.',
        ]} />
      </LegalSection>

      <LegalSection title="6. קניין רוחני">
        <p>
          הזכויות בפלטפורמת Vetree — העיצוב, הקוד והתכונות — שייכות ל-Vetree או למעניקי הרישיון שלה, ככל שזכויות
          אלה קיימות לפי הדין החל. איננו טוענים לבעלות במאמרים של צדדים שלישיים או מבטיחים שתוכן שנוצר בבינה
          מלאכותית זכאי להגנת זכויות יוצרים. מאמרי המחקר שייכים למוציאים לאור ולמחברים; אנו מקשרים למקור ומציגים תקצירים עם ייחוס, והשימוש בהם כפוף לתנאי
          המוציאים לאור. התוכן שאת/ה שולח/ת אלינו (כמו דיווחים) נשאר בבעלותך, ואת/ה מתיר/ה לנו להשתמש בו כדי להפעיל
          ולשפר את השירות.
        </p>
      </LegalSection>

      <LegalSection title="7. הודעות דוא&quot;ל">
        <p>
          אנו שולחים הודעות חשבון נחוצות (למשל אימות כתובת דוא&quot;ל ואיפוס סיסמה). התקציר השבועי נשלח רק אם הסכמת,
          וניתן להפסיק אותו בכל עת באמצעות קישור ההסרה או בפרופיל.
        </p>
      </LegalSection>

      <LegalSection title="8. הפסקת השימוש">
        <p>
          ניתן למחוק את החשבון בכל עת בפרופיל; הוא נמחק מיד, כמתואר במדיניות הפרטיות. אנו רשאים להשעות או לסגור
          חשבון המפר תנאים אלו, המשמש שלא כדין או המנצל את השירות לרעה.
        </p>
      </LegalSection>

      <LegalSection title="9. הסתייגות והגבלת אחריות">
        <p>
          Vetree מסופקת &quot;כמות שהיא&quot; (AS IS) ו&quot;כפי שהיא זמינה&quot;. במידה המותרת בדין, איננו מתחייבים שהשירות
          יפעל ללא הפסקות או תקלות, או שתוכנו — לרבות תוכן שנוצר בבינה מלאכותית — מדויק או שלם, ואיננו אחראים לנזק
          עקיף או תוצאתי, או לנזק הנובע מהסתמכות על התוכן או מהפסקות בשירות. אין בתנאים אלו כדי להגביל אחריות שלא
          ניתן להגבילה לפי דין.
        </p>
      </LegalSection>

      <LegalSection title="10. שינויים בתנאים">
        <p>
          כאשר נשנה תנאים אלו, נעדכן את תאריך התוקף שלמעלה. אם השינוי מהותי, נבקש ממך לעיין בתנאים המעודכנים ולאשר
          אותם בהתחברות הבאה.
        </p>
      </LegalSection>

      <LegalSection title="11. הדין החל">
        <p>
          על תנאים אלו יחול הדין הישראלי, בכפוף להגנות המחייבות החלות עליך. לבתי המשפט בישראל תהיה סמכות שיפוט,
          אלא אם הדין החל מקנה לך זכות שלא ניתן להתנות עליה לנקוט הליכים במקום אחר.
        </p>
      </LegalSection>

      <LegalSection title="12. יצירת קשר">
        <p>רועי קריספין, לה גוארדיה 60, תל אביב, ישראל · <span dir="ltr">{CONTACT_EMAIL}</span></p>
        <ContactButton lang="he" />
      </LegalSection>
    </LegalShell>
  )
}
