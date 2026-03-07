-- Seed growth_tasks with 90 days of staggered tasks
-- Start date: today
-- 9-day rotation cycle with varied content for each specialty

DO $$
DECLARE
  start_date date := CURRENT_DATE;
  task_day integer;
  cycle_day integer;
  platform_name text;
  group_name text;
  language_code text;
  post_content text;
  specialty text;
  specialties text[] := ARRAY[
    'cardiology', 'oncology', 'surgery', 'exotic', 'equine',
    'dermatology', 'neurology', 'orthopedics', 'ophthalmology', 'dentistry',
    'emergency', 'internal medicine', 'radiology', 'anesthesia', 'behavior'
  ];
BEGIN
  FOR task_day IN 1..90 LOOP
    cycle_day := ((task_day - 1) % 9) + 1;
    specialty := specialties[((task_day - 1) % array_length(specialties, 1)) + 1];

    CASE cycle_day
      WHEN 1 THEN
        platform_name := 'facebook_il';
        group_name := 'משרות ומודעות בתחום הוטרינריה';
        language_code := 'he';
        post_content := format('💡 תובנה קלינית ב%s

היום נתקלתי במקרה מעניין של %s שהזכיר לי עד כמה חשוב להישאר מעודכנים.

האם גם אתם חווים את האתגר של לעקוב אחרי כל המחקרים החדשים?

Vetree עוזרת לי לקבל תקצירים מותאמים אישית של מאמרים רלוונטיים בדיוק לתחום שלי.

🌿 vetree.app - הידע הווטרינרי שאתם צריכים, בלי הרעש', specialty, specialty);

      WHEN 2 THEN
        platform_name := 'whatsapp';
        group_name := 'וטרינרים ישראל';
        language_code := 'he';
        post_content := format('בוקר טוב קולגות! 👋

מישהו עוד מרגיש שקשה לעקוב אחרי כל הפרסומים החדשים ב%s?

גיליתי כלי שממש עוזר - Vetree מסכמת מאמרים חדשים ונותנת bottom line קליני ישירות.

שווה לבדוק: vetree.app 🌿', specialty);

      WHEN 3 THEN
        platform_name := 'reddit';
        group_name := 'r/veterinarymedicine';
        language_code := 'en';
        post_content := format('Fellow vets, how do you stay current with %s research?

I''ve been using Vetree to get AI-curated summaries of new papers with clinical bottom lines. Game-changer for evidence-based practice.

Check it out: vetree.app 🌿

What tools do you use to stay up-to-date?', specialty);

      WHEN 4 THEN
        platform_name := 'linkedin';
        group_name := 'Personal profile (Roi Krispin DVM)';
        language_code := 'en';
        post_content := format('The challenge with %s practice isn''t lack of research—it''s information overload.

I built Vetree to solve this: AI-powered clinical summaries from thousands of veterinary journals, personalized to your practice areas.

For veterinarians who want evidence-based medicine without the overwhelm.

🌿 Try it: vetree.app

#veterinarymedicine #evidencebasedmedicine #vettech', specialty);

      WHEN 5 THEN
        platform_name := 'facebook_intl';
        group_name := 'Veterinary Professionals Worldwide';
        language_code := 'en';
        post_content := format('Quick poll: How much time do you spend reading %s literature each week?

For me it was hours trying to filter signal from noise. Now I use Vetree—it gives me personalized article summaries with clinical takeaways in minutes.

If you''re drowning in research but want to stay current, check it out: vetree.app 🌿', specialty);

      WHEN 6 THEN
        platform_name := 'twitter';
        group_name := '@vetreeapp';
        language_code := 'en';
        post_content := format('New in %s this week 🩺

📚 15 new research papers
🎯 Top clinical takeaway: [insert relevant insight]
⚡ Delivered to your feed in <2 min

Evidence-based medicine, personalized.

vetree.app 🌿

#VetMed #%s', specialty, specialty);

      WHEN 7 THEN
        platform_name := 'instagram';
        group_name := '@vetreeapp';
        language_code := 'en';
        post_content := format('[VISUAL POST]

Swipe → to see this week''s top %s insights

🔬 Research updates
💡 Clinical pearls
⚡ AI-summarized for busy vets

Stay current without the overwhelm.

Link in bio → vetree.app 🌿

#veterinary #%s #vetlife #evidencebased', specialty, specialty);

      WHEN 8 THEN
        platform_name := 'telegram';
        group_name := 'Veterinary groups';
        language_code := 'en';
        post_content := format('Hey team! Sharing a tool that''s been super helpful for staying current with %s research.

Vetree uses AI to summarize new veterinary papers and delivers clinical bottom lines personalized to your interests.

Worth checking out: vetree.app 🌿', specialty);

      WHEN 9 THEN
        platform_name := 'kol';
        group_name := 'Personal outreach';
        language_code := 'en';
        post_content := format('Hi [Name],

I noticed you''re focused on %s and thought you might find this useful.

I built Vetree to help veterinarians stay current with research without information overload—AI-generated summaries with clinical takeaways from thousands of journals.

Would love your feedback as a %s specialist: vetree.app

Best,
Roi', specialty, specialty);
    END CASE;

    INSERT INTO growth_tasks (
      day_number,
      scheduled_date,
      platform,
      group_name,
      language,
      content,
      status
    ) VALUES (
      task_day,
      start_date + (task_day - 1),
      platform_name,
      group_name,
      language_code,
      post_content,
      'pending'
    );
  END LOOP;
END $$;
