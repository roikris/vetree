import type { Metadata } from 'next'
import { LegalShell, LegalSection, LegalList, ContactButton, CONTACT_EMAIL, legalLang } from '@/components/legal/LegalShell'
import { CookieSettingsButton } from '@/components/consent/TrackingConsent'

// Describes what the code actually does (verified 2026-09-30; reviewed by Codex against the code
// and Israeli privacy law). When a data practice changes — a provider, tracker, field or retention
// rule — update BOTH languages and EFFECTIVE_DATE in the same PR, and bump CURRENT_CONSENT_VERSION
// (lib/constants/consent) if the change is material.
const EFFECTIVE_DATE = '2026-09-30'

export const metadata: Metadata = { title: 'Privacy Policy — Vetree', alternates: { canonical: '/privacy' } }

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const lang = legalLang((await searchParams).lang)
  return lang === 'he' ? <PrivacyHe /> : <PrivacyEn />
}

const BTN = 'text-[#3D7A5F] dark:text-[#4E9A78] underline underline-offset-4 font-medium'

function PrivacyEn() {
  return (
    <LegalShell lang="en" path="/privacy" title="Privacy Policy" effectiveDate={EFFECTIVE_DATE}>
      <LegalSection title="1. Who we are">
        <p>
          Vetree (vetree.app) is an evidence-based veterinary research platform. It is operated by{' '}
          <strong>Roi Krispin, La Guardia 60, Tel Aviv, Israel</strong> (&ldquo;Vetree&rdquo;, &ldquo;we&rdquo;), who
          controls the personal information described in this policy.
        </p>
        <p>
          This policy explains what information we collect, why, who receives it, where it is stored, how long we
          keep it and what rights you have. It applies to vetree.app and to the emails we send.
        </p>
        <ContactButton lang="en" />
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <LegalList items={[
          <><strong>Account details.</strong> Your email address and a user identifier. If you sign up with a
            password, our authentication provider stores it only as a cryptographic hash. If you sign in with
            Google, we receive the details Google shares for sign-in (email address, and name and profile picture
            if available). A profile picture you upload is private: only you can see it (and, where needed to run
            the service, its operator).</>,
          <><strong>Consent records.</strong> Your choices (accepting these terms, and whether you want the
            weekly digest), where you made them (signup, a prompt or settings), the language of the wording you
            were shown where available, and the time, IP address and browser details of the request that records
            them. For email signups, the choices are recorded after you verify your email address.</>,
          <><strong>Your activity on Vetree.</strong> Articles you save, specialties you follow, reports and
            feedback you send us, and your answer to the digest question.</>,
          <><strong>Usage information.</strong> Pages you visit and how long you stay, search text, the page that
            referred you and campaign parameters in the link, country and city inferred from network information,
            browser and device details, a session identifier and — when you are signed in — your account
            identifier, and events such as signing up, saving an article or using a research synthesis. In our
            analytics tables your IP address is stored as a hash; the other fields are not hashed, so these records
            are not necessarily anonymous.</>,
          <><strong>Error reports.</strong> When something breaks, a report with technical details of the error,
            the page address and your browser details is sent to our error-monitoring provider, so we can fix it
            (our legitimate interest). We do not record your sessions.</>,
          <><strong>Email delivery.</strong> Records of which digest emails were sent to you.</>,
        ]} />
        <p>
          To create an account you must provide an email address (and a password, unless you use Google); without
          it we cannot open an account. Everything else is optional or arises from how you use the service. Some
          technical information is processed automatically so that the website can work. No law requires you to
          provide this information.
        </p>
      </LegalSection>

      <LegalSection title="3. Why we use it">
        <LegalList items={[
          <>To provide the service and your account: sign-in, your library and followed specialties, and the
            features you use (necessary to provide the service you asked for).</>,
          <>To keep the service secure and prevent abuse, including limiting requests by IP address (our
            legitimate interest).</>,
          <>To understand how Vetree is used, fix errors and improve it (our legitimate interest).</>,
          <>To send the weekly research digest — <strong>only if you agreed</strong>. It is personalised using the
            specialties you follow and your recent activity. You can withdraw at any time (section 8).</>,
          <>To keep evidence of the consents you gave, and to comply with the law.</>,
          <>To measure our advertising — <strong>only with your consent</strong> (section 6).</>,
        ]} />
      </LegalSection>

      <LegalSection title="4. Artificial intelligence">
        <p>
          Vetree uses Anthropic&apos;s Claude models. When you search, the search text and relevant article
          material may be sent to Anthropic to generate a research synthesis. For our internal analysis we also
          send Anthropic aggregated usage statistics and search terms; we remove account identifiers before
          sending them, and summaries of that analysis may be posted to our internal Slack workspace. Search text
          can itself contain personal information, so please do not enter details that identify clients or other
          people.
        </p>
      </LegalSection>

      <LegalSection title="5. Who receives your information, and where">
        <p>
          We do <strong>not</strong> sell, rent or trade your personal information. We use the providers below.
          Most act only on our behalf; Google sign-in and the advertising platforms may also use information for
          their own purposes under their own terms and privacy notices.
        </p>
        <LegalList items={[
          <><strong>Supabase</strong> — database, authentication and file storage (European Union, Ireland).</>,
          <><strong>Vercel</strong> — website hosting and delivery, and web analytics (global network, including the United States).</>,
          <><strong>Anthropic</strong> — the AI features in section 4 (United States).</>,
          <><strong>Resend</strong> — sending our emails, including sign-in and digest emails (United States).</>,
          <><strong>Sentry</strong> — error reports (United States).</>,
          <><strong>Upstash</strong> — request limiting; it processes IP addresses or account identifiers, and keeps its request statistics for up to 90 days.</>,
          <><strong>Google</strong> — &ldquo;Continue with Google&rdquo; sign-in, if you use it.</>,
          <><strong>LinkedIn and Meta</strong> — advertising measurement, only with your consent (section 6).</>,
          <><strong>Slack</strong> — our internal alerts, which may include aggregated usage figures and search terms, without account identifiers.</>,
        ]} />
        <p>
          Your information is therefore stored and processed outside Israel, including in the European Union and
          the United States, under these providers&apos; data-processing terms. We may also disclose
          information where the law requires it or to protect our rights and users&apos; safety, and to a successor
          if Vetree is transferred — in which case this policy continues to apply.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies, storage and optional tracking">
        <LegalList items={[
          <><strong>Necessary.</strong> Sign-in session cookies; a short-lived cookie that links a Google signup to
            the choices you made on the signup page; and a cookie and browser storage entry that remember your
            cookie choice.</>,
          <><strong>Preferences.</strong> Your browser&apos;s storage keeps settings such as dark mode and whether
            you dismissed a prompt, answers you gave before verifying your email, and recent research syntheses so
            they reopen quickly. Our offline support caches only public site files.</>,
          <><strong>Analytics.</strong> Our own usage records (section 2) and Vercel Web Analytics, which does not
            use advertising cookies.</>,
          <><strong>Optional — only if you click &ldquo;Accept&rdquo;.</strong> The LinkedIn Insight Tag and the Meta
            Pixel, which let LinkedIn and Meta measure our ads and may link your visit to your account with them.
            They do not load until you accept.</>,
        ]} />
        <p>You can accept or reject optional cookies, and change your choice at any time: <CookieSettingsButton className={BTN} /></p>
      </LegalSection>

      <LegalSection title="7. How long we keep it">
        <LegalList items={[
          <><strong>Your account</strong> and what belongs to it (profile picture, saved articles, followed
            specialties, reports, preferences and consent records) are kept while your account exists.</>,
          <><strong>Logs</strong> — usage and search records, events, email-delivery records, AI feedback and
            cached syntheses, and the analyses derived from them — are kept for <strong>12 months</strong> and then
            deleted automatically.</>,
          <>Copies kept by our providers are deleted on their schedules: request-limiting statistics (Upstash)
            within 90 days; error reports (Sentry) within 90 days; AI requests (Anthropic) within 30 days under its
            standard API terms, unless flagged for a policy violation; email-delivery records (Resend) and database
            backups (Supabase) within 30 days; and our internal Slack alerts within 12 months.</>,
        ]} />
        <p>
          When you delete your account in your profile, we immediately delete from our database your account and
          the information linked to it — including the usage records, searches and events linked to your account
          and the research syntheses you generated. Copies held by our providers are then deleted on the schedules
          above. Usage records that were never linked to your account (for example, visits before you signed in)
          are kept for the 12-month period. If deletion fails, please contact us.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>Under the Israeli Protection of Privacy Law, 5741-1981, you may:</p>
        <LegalList items={[
          <><strong>Access</strong> the information we hold about you.</>,
          <><strong>Ask us to correct or delete</strong> information that is inaccurate, incomplete, unclear or out of date.</>,
          <><strong>Stop direct mailing</strong> — unsubscribe from the digest with the link in every email, by
            replying to it, or in your profile — and ask us to delete the information used for it.</>,
          <><strong>Delete your account</strong> yourself at any time from your profile.</>,
        ]} />
        <p>
          We may ask for reasonable information to verify your identity. We handle requests within the legal
          deadlines: ordinarily, access within 30 days, notice of a refusal of access within 21 days, and notice of
          a refusal to correct or delete within 30 days, subject to statutory exceptions and extensions. You may
          complain to the Privacy Protection Authority and seek relief from the courts.
        </p>
        <p>
          Where the EU General Data Protection Regulation applies, you may also request erasure, restriction and
          portability, object to processing, and withdraw consent, subject to its conditions; we respond without
          undue delay and ordinarily within one month, and you may complain to the competent supervisory
          authority.
        </p>
        <ContactButton lang="en" />
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We protect your information with encrypted connections, access controls in our database, hashing of IP
          addresses in our analytics, and restricted administrative access. No method of transmission or storage
          is completely secure, so we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="10. Age">
        <p>Vetree is intended for veterinary professionals and students aged 18 or over.</p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          We will tell you about material changes before they take effect and ask you to review and accept the
          updated policy when you next sign in. Where renewed consent is required, we will ask for it before the
          affected processing begins; an earlier consent does not cover new optional purposes.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>Roi Krispin, La Guardia 60, Tel Aviv, Israel · <span dir="ltr">{CONTACT_EMAIL}</span></p>
        <ContactButton lang="en" />
      </LegalSection>
    </LegalShell>
  )
}

function PrivacyHe() {
  return (
    <LegalShell lang="he" path="/privacy" title="מדיניות פרטיות" effectiveDate={EFFECTIVE_DATE}>
      <LegalSection title="1. מי אנחנו">
        <p>
          Vetree, בכתובת <span dir="ltr">vetree.app</span>, היא פלטפורמה למחקר וטרינרי מבוסס ראיות. היא מופעלת בידי{' '}
          <strong>רועי קריספין, לה גוארדיה 60, תל אביב, ישראל</strong> (להלן: &quot;Vetree&quot; או &quot;אנחנו&quot;), בעל
          השליטה במאגר המידע האישי המתואר במדיניות זו.
        </p>
        <p>
          מדיניות זו מסבירה איזה מידע אנו אוספים, לשם מה, מי מקבל אותו, היכן הוא נשמר, כמה זמן אנו שומרים אותו ומהן
          זכויותיך. היא חלה על vetree.app ועל הודעות הדוא&quot;ל שאנו שולחים.
        </p>
        <ContactButton lang="he" />
      </LegalSection>

      <LegalSection title="2. המידע שאנו אוספים">
        <LegalList items={[
          <><strong>פרטי חשבון.</strong> כתובת הדוא&quot;ל שלך ומזהה משתמש. אם נרשמת עם סיסמה, ספק האימות שלנו שומר
            אותה רק כערך גיבוב קריפטוגרפי (hash). אם התחברת באמצעות Google, אנו מקבלים את הפרטים ש-Google משתפת
            לצורך ההתחברות (כתובת דוא&quot;ל, ושם ותמונת פרופיל אם קיימים). תמונת פרופיל שהעלית היא פרטית: רק את/ה
            יכול/ה לראות אותה (ומפעיל השירות, כשהדבר נדרש לתפעולו).</>,
          <><strong>רישומי הסכמה.</strong> הבחירות שלך (הסכמה לתנאים אלו, והאם ברצונך לקבל את התקציר השבועי), היכן
            נעשו (בהרשמה, בהודעה באתר או בהגדרות), שפת הנוסח שהוצג לך ככל שהיא זמינה, וכן המועד, כתובת ה-IP ופרטי
            הדפדפן של הבקשה שבה הן נרשמות. בהרשמה בדוא&quot;ל, הבחירות נרשמות לאחר אימות כתובת הדוא&quot;ל.</>,
          <><strong>הפעילות שלך ב-Vetree.</strong> מאמרים ששמרת, תחומי התמחות שאת/ה עוקב/ת אחריהם, דיווחים ומשוב
            שנשלחו אלינו, ותשובתך לשאלת התקציר.</>,
          <><strong>נתוני שימוש.</strong> הדפים שבהם ביקרת ומשך השהייה, טקסט החיפוש, הדף שהפנה אותך ופרמטרים של
            קמפיין בקישור, מדינה ועיר המוסקות מנתוני הרשת, פרטי דפדפן ומכשיר, מזהה הפעלה (session) — ובזמן
            התחברות גם מזהה החשבון שלך — ואירועים כגון הרשמה, שמירת מאמר או שימוש בסיכום מחקר משולב. בטבלאות
            ניתוח השימוש שלנו כתובת ה-IP נשמרת כערך גיבוב; יתר השדות אינם מגובבים, ולכן רישומים אלה אינם בהכרח
            אנונימיים.</>,
          <><strong>דוחות שגיאה.</strong> כאשר מתרחשת תקלה, נשלח לספק ניטור השגיאות שלנו דוח הכולל פרטים טכניים על
            השגיאה, כתובת הדף ופרטי הדפדפן שלך, כדי שנוכל לתקן אותה (האינטרס הלגיטימי שלנו). איננו מתעדים את
            הפעלות הגלישה שלך.</>,
          <><strong>משלוח דוא&quot;ל.</strong> רישום של הודעות התקציר שנשלחו אליך.</>,
        ]} />
        <p>
          לפתיחת חשבון יש למסור כתובת דוא&quot;ל (וסיסמה, אלא אם נרשמת באמצעות Google); בלעדיה לא נוכל לפתוח חשבון.
          כל השאר הוא רשות או נובע מאופן השימוש שלך בשירות. מידע טכני מסוים מעובד אוטומטית כדי שהאתר יפעל. אין חובה
          חוקית למסור מידע זה.
        </p>
      </LegalSection>

      <LegalSection title="3. לשם מה אנו משתמשים במידע">
        <LegalList items={[
          <>כדי לספק את השירות ואת החשבון שלך: התחברות, הספרייה שלך ותחומי ההתמחות שאת/ה עוקב/ת אחריהם, והתכונות
            שבהן את/ה משתמש/ת (נדרש לצורך מתן השירות שביקשת).</>,
          <>כדי לשמור על אבטחת השירות ולמנוע שימוש לרעה, לרבות הגבלת בקשות לפי כתובת IP (האינטרס הלגיטימי שלנו).</>,
          <>כדי להבין כיצד משתמשים ב-Vetree, לתקן תקלות ולשפר אותה (האינטרס הלגיטימי שלנו).</>,
          <>כדי לשלוח את תקציר המחקרים השבועי — <strong>רק אם הסכמת</strong>. התקציר מותאם לתחומי ההתמחות שאת/ה
            עוקב/ת אחריהם ולפעילותך האחרונה. ניתן לחזור בך בכל עת (סעיף 8).</>,
          <>כדי לשמור ראיה להסכמות שנתת, ולעמוד בדרישות הדין.</>,
          <>כדי למדוד את הפרסום שלנו — <strong>רק בהסכמתך</strong> (סעיף 6).</>,
        ]} />
      </LegalSection>

      <LegalSection title="4. בינה מלאכותית">
        <p>
          Vetree משתמשת במודלי Claude של חברת Anthropic. כאשר את/ה מחפש/ת, טקסט החיפוש ותוכן רלוונטי ממאמרים עשויים
          להישלח ל-Anthropic לצורך יצירת סיכום מחקר משולב. במסגרת הניתוח הפנימי שלנו אנו שולחים ל-Anthropic גם נתוני
          שימוש מצטברים ומונחי חיפוש; אנו מסירים מזהי חשבון לפני השליחה, וסיכומים של הניתוח עשויים להתפרסם בסביבת
          ה-Slack הפנימית שלנו. טקסט החיפוש עצמו עלול להכיל מידע אישי, ולכן אנא אל תזינו פרטים המזהים לקוחות או
          אנשים אחרים.
        </p>
      </LegalSection>

      <LegalSection title="5. מי מקבל את המידע, והיכן">
        <p>
          איננו <strong>מוכרים</strong>, משכירים או סוחרים במידע האישי שלך. אנו משתמשים בספקים שלהלן. רובם פועלים
          עבורנו בלבד; שירות ההתחברות של Google ופלטפורמות הפרסום עשויים להשתמש במידע גם למטרותיהם, בהתאם לתנאיהם
          ולהודעות הפרטיות שלהם.
        </p>
        <LegalList items={[
          <><strong>Supabase</strong> — מסד נתונים, אימות ואחסון קבצים (האיחוד האירופי, אירלנד).</>,
          <><strong>Vercel</strong> — אירוח והגשת האתר, וניתוח שימוש (רשת גלובלית, כולל ארצות הברית).</>,
          <><strong>Anthropic</strong> — תכונות הבינה המלאכותית שבסעיף 4 (ארצות הברית).</>,
          <><strong>Resend</strong> — שליחת הודעות הדוא&quot;ל שלנו, לרבות הודעות התחברות ותקציר (ארצות הברית).</>,
          <><strong>Sentry</strong> — דוחות שגיאה (ארצות הברית).</>,
          <><strong>Upstash</strong> — הגבלת בקשות; מעבדת כתובות IP או מזהי חשבון, ושומרת את נתוני הבקשות עד 90 יום.</>,
          <><strong>Google</strong> — התחברות &quot;Continue with Google&quot;, אם בחרת בה.</>,
          <><strong>LinkedIn ו-Meta</strong> — מדידת פרסום, רק בהסכמתך (סעיף 6).</>,
          <><strong>Slack</strong> — התראות פנימיות שלנו, שעשויות לכלול נתוני שימוש מצטברים ומונחי חיפוש, ללא מזהי חשבון.</>,
        ]} />
        <p>
          לכן המידע שלך נשמר ומעובד מחוץ לישראל, לרבות באיחוד האירופי ובארצות הברית, בכפוף לתנאי עיבוד המידע של ספקים
          אלו. כמו כן אנו עשויים למסור מידע כאשר הדין מחייב זאת או כדי להגן על זכויותינו ועל
          בטיחות המשתמשים, וכן לגורם שיבוא במקומנו אם Vetree תועבר — ובמקרה זה מדיניות זו תמשיך לחול.
        </p>
      </LegalSection>

      <LegalSection title="6. עוגיות, אחסון בדפדפן ומעקב רשות">
        <LegalList items={[
          <><strong>הכרחיות.</strong> עוגיות של הפעלת ההתחברות; עוגייה קצרת טווח המקשרת הרשמה באמצעות Google
            לבחירות שעשית בדף ההרשמה; ועוגייה ורשומה באחסון הדפדפן השומרות את בחירתך לגבי עוגיות.</>,
          <><strong>העדפות.</strong> אחסון הדפדפן שומר הגדרות כמו מצב כהה והאם סגרת הודעה, תשובות שנתת לפני אימות
            כתובת הדוא&quot;ל, וסיכומי מחקר אחרונים כדי שייפתחו מהר. התמיכה במצב לא מקוון שומרת רק קבצים ציבוריים של
            האתר.</>,
          <><strong>ניתוח שימוש.</strong> רישומי השימוש שלנו (סעיף 2) ו-Vercel Web Analytics, שאינו משתמש בעוגיות
            פרסום.</>,
          <><strong>רשות — רק אם לחצת &quot;אישור&quot;.</strong> ה-LinkedIn Insight Tag וה-Meta Pixel, המאפשרים
            ל-LinkedIn ול-Meta למדוד את המודעות שלנו ועשויים לקשר את הביקור שלך לחשבון שלך אצלן. הם אינם נטענים
            עד שתאשר/י.</>,
        ]} />
        <p>ניתן לאשר או לדחות עוגיות רשות, ולשנות את הבחירה בכל עת: <CookieSettingsButton className={BTN} label="הגדרות עוגיות" /></p>
      </LegalSection>

      <LegalSection title="7. כמה זמן אנו שומרים את המידע">
        <LegalList items={[
          <><strong>החשבון שלך</strong> ומה ששייך לו (תמונת פרופיל, מאמרים שמורים, תחומי התמחות, דיווחים, העדפות
            ורישומי הסכמה) נשמרים כל עוד החשבון קיים.</>,
          <><strong>רישומים</strong> — רישומי שימוש וחיפוש, אירועים, רישומי משלוח דוא&quot;ל, משוב על בינה מלאכותית
            וסיכומי מחקר שמורים, והניתוחים הנגזרים מהם — נשמרים <strong>12 חודשים</strong> ואז נמחקים אוטומטית.</>,
          <>עותקים המוחזקים אצל הספקים שלנו נמחקים לפי לוחות הזמנים שלהם: נתוני הגבלת בקשות (Upstash) בתוך 90
            יום; דוחות שגיאה (Sentry) בתוך 90 יום; בקשות לבינה מלאכותית (Anthropic) בתוך 30 יום לפי תנאי ה-API
            הרגילים שלה, אלא אם סומנו בשל הפרת מדיניות; רישומי משלוח דוא&quot;ל (Resend) וגיבויי מסד הנתונים
            (Supabase) בתוך 30 יום; והתראות ה-Slack הפנימיות שלנו בתוך 12 חודשים.</>,
        ]} />
        <p>
          כאשר את/ה מוחק/ת את החשבון בפרופיל, אנו מוחקים מיד ממסד הנתונים שלנו את החשבון ואת המידע המקושר אליו —
          לרבות רישומי השימוש, החיפושים והאירועים המקושרים לחשבון וסיכומי המחקר שיצרת. עותקים המוחזקים אצל הספקים
          שלנו נמחקים לאחר מכן לפי לוחות הזמנים שלעיל. רישומי שימוש שמעולם לא קושרו לחשבון שלך (למשל ביקורים לפני
          התחברות) נשמרים למשך תקופת 12 החודשים. אם המחיקה נכשלת, אנא פנה/י אלינו.
        </p>
      </LegalSection>

      <LegalSection title="8. הזכויות שלך">
        <p>לפי חוק הגנת הפרטיות, התשמ&quot;א-1981, את/ה רשאי/ת:</p>
        <LegalList items={[
          <><strong>לעיין</strong> במידע שאנו מחזיקים עליך.</>,
          <><strong>לבקש לתקן או למחוק</strong> מידע שאינו נכון, שלם, ברור או מעודכן.</>,
          <><strong>להפסיק דיוור ישיר</strong> — להסיר את עצמך מהתקציר באמצעות הקישור שבכל הודעה, במענה להודעה או
            בפרופיל — ולבקש למחוק את המידע המשמש לכך.</>,
          <><strong>למחוק את החשבון</strong> בעצמך בכל עת, מהפרופיל.</>,
        ]} />
        <p>
          ייתכן שנבקש מידע סביר לאימות זהותך. נטפל בבקשות במועדים הקבועים בדין: ככלל, מתן עיון בתוך 30 ימים, הודעה
          על סירוב לעיון בתוך 21 ימים, והודעה על סירוב לתיקון או למחיקה בתוך 30 ימים, בכפוף לחריגים ולהארכות כדין.
          ניתן לפנות בתלונה לרשות להגנת הפרטיות ולבקש סעד מבית המשפט.
        </p>
        <p>
          כאשר חלה תקנת הגנת המידע הכללית של האיחוד האירופי (GDPR), ניתן גם לבקש מחיקה, הגבלת עיבוד וניידות מידע,
          להתנגד לעיבוד ולחזור מהסכמה, בכפוף לתנאיה; נשיב ללא דיחוי בלתי מוצדק ובדרך כלל בתוך חודש, וניתן להגיש
          תלונה לרשות הפיקוח המוסמכת.
        </p>
        <ContactButton lang="he" />
      </LegalSection>

      <LegalSection title="9. אבטחת מידע">
        <p>
          אנו מגינים על המידע שלך באמצעות חיבורים מוצפנים, בקרות גישה במסד הנתונים, גיבוב של כתובות IP בניתוח
          השימוש, והגבלת גישה ניהולית. אף שיטת העברה או אחסון אינה מאובטחת לחלוטין, ולכן איננו יכולים להבטיח אבטחה
          מוחלטת.
        </p>
      </LegalSection>

      <LegalSection title="10. גיל">
        <p>Vetree מיועדת לאנשי מקצוע ולסטודנטים בתחום הרפואה הווטרינרית בני 18 ומעלה.</p>
      </LegalSection>

      <LegalSection title="11. שינויים במדיניות">
        <p>
          נודיע לך על שינויים מהותיים לפני כניסתם לתוקף ונבקש ממך לעיין במדיניות המעודכנת ולאשר אותה בהתחברות הבאה.
          כאשר נדרשת הסכמה מחודשת, נבקש אותה לפני תחילת העיבוד הרלוונטי; הסכמה קודמת אינה חלה על מטרות רשות חדשות.
        </p>
      </LegalSection>

      <LegalSection title="12. יצירת קשר">
        <p>רועי קריספין, לה גוארדיה 60, תל אביב, ישראל · <span dir="ltr">{CONTACT_EMAIL}</span></p>
        <ContactButton lang="he" />
      </LegalSection>
    </LegalShell>
  )
}
