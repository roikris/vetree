-- Seed growth_tasks with 90 days using REAL articles from the database
-- Each post references an actual article with clinical_bottom_line

DO $$
DECLARE
  start_date date := CURRENT_DATE;
  task_day integer;
  cycle_day integer;
  platform_name text;
  group_name text;
  language_code text;
  post_content text;
  hook_line text;
  article_record record;
  article_ids text[] := '{}';
  used_articles text[] := '{}';
  hook_index integer;

  -- Hook lines for Hebrew posts (rotate through these)
  hebrew_hooks text[] := ARRAY[
    'כמה פעמים השבוע חיפשתם מחקר ולא מצאתם זמן לקרוא?',
    'מה הייתם עושים אחרת אם ידעתם את זה?',
    'הממצא הזה שינה את הגישה שלי לחלוטין:',
    'שאלה ששאלו אותי בקליניקה אתמול:',
    'לא כל הגרסאות של הפרוטוקול הזה שוות:',
    'מחקר חדש הפתיע אותי השבוע:',
    'התשובה לשאלה הזו לא מה שחשבתם:',
    'עדכון קליני שחשוב לדעת:',
    'הפרוטוקול שלי השתנה אחרי שקראתי את זה:',
    'ראיתם את המחקר החדש על זה?',
    'משהו שלמדתי השבוע ורציתי לשתף:',
    'מקרה מאתגר? הנה מה שהספרות אומרת:',
    'זה לא מה שלימדו אותנו בפקולטה:',
    'עדכון על נושא שנתקלנו בו השבוע:',
    'המחקר הזה ענה על שאלה שהייתה לי:'
  ];

  -- Hook lines for English posts (rotate through these)
  english_hooks text[] := ARRAY[
    'This changed how I approach this case type:',
    'Worth 2 minutes of your time:',
    'Evidence just shifted on this one:',
    'Question I got asked in clinic today:',
    'Not all protocols are created equal:',
    'New data on something we see every week:',
    'The answer might surprise you:',
    'Clinical update you should know about:',
    'My protocol changed after reading this:',
    'Have you seen this new research?',
    'Something I learned this week worth sharing:',
    'Challenging case? Here''s what the evidence says:',
    'This isn''t what we learned in school:',
    'Update on a common scenario:',
    'This study answered a question I had:'
  ];

BEGIN
  -- Try to get articles with relevant labels first
  SELECT array_agg(id) INTO article_ids
  FROM (
    SELECT id FROM articles
    WHERE clinical_bottom_line IS NOT NULL
      AND clinical_bottom_line != ''
      AND length(clinical_bottom_line) > 50
      AND (
        labels && ARRAY['cardiology', 'Cardiology', 'CARDIOLOGY'] OR
        labels && ARRAY['oncology', 'Oncology', 'ONCOLOGY', 'cancer', 'Cancer'] OR
        labels && ARRAY['pain', 'Pain', 'analgesia', 'Analgesia'] OR
        labels && ARRAY['dermatology', 'Dermatology', 'DERMATOLOGY'] OR
        labels && ARRAY['internal medicine', 'Internal Medicine', 'INTERNAL MEDICINE'] OR
        labels && ARRAY['surgery', 'Surgery', 'SURGERY', 'surgical', 'Surgical'] OR
        labels && ARRAY['anesthesia', 'Anesthesia', 'ANESTHESIA', 'anesthesiology'] OR
        labels && ARRAY['emergency', 'Emergency', 'EMERGENCY', 'critical care'] OR
        labels && ARRAY['gastroenterology', 'Gastroenterology', 'GI'] OR
        labels && ARRAY['neurology', 'Neurology', 'NEUROLOGY', 'neurological'] OR
        labels && ARRAY['nephrology', 'Nephrology', 'renal', 'Renal', 'kidney'] OR
        labels && ARRAY['endocrine', 'Endocrine', 'ENDOCRINE', 'diabetes', 'thyroid'] OR
        labels && ARRAY['respiratory', 'Respiratory', 'pulmonary', 'Pulmonary'] OR
        labels && ARRAY['infectious', 'Infectious', 'infection', 'Infection'] OR
        labels && ARRAY['pharmacology', 'Pharmacology', 'drug', 'Drug', 'medication']
      )
    ORDER BY publication_date DESC
    LIMIT 90
  ) filtered_articles;

  -- If not enough articles with specific labels, get any articles with clinical_bottom_line
  IF array_length(article_ids, 1) IS NULL OR array_length(article_ids, 1) < 90 THEN
    RAISE NOTICE 'Only found % articles with specific labels, fetching any articles with clinical_bottom_line',
      COALESCE(array_length(article_ids, 1), 0);

    SELECT array_agg(id) INTO article_ids
    FROM (
      SELECT id FROM articles
      WHERE clinical_bottom_line IS NOT NULL
        AND clinical_bottom_line != ''
        AND length(clinical_bottom_line) > 50
      ORDER BY publication_date DESC
      LIMIT 90
    ) all_articles;
  END IF;

  -- Final check
  IF array_length(article_ids, 1) IS NULL OR array_length(article_ids, 1) < 90 THEN
    RAISE EXCEPTION 'Not enough articles with clinical_bottom_line found. Need 90, found %',
      COALESCE(array_length(article_ids, 1), 0);
  END IF;

  -- Generate 90 tasks
  FOR task_day IN 1..90 LOOP
    cycle_day := ((task_day - 1) % 9) + 1;

    -- Get an article for this task (cycle through available articles)
    SELECT * INTO article_record
    FROM articles
    WHERE id = article_ids[((task_day - 1) % array_length(article_ids, 1)) + 1];

    -- Determine platform and language
    CASE cycle_day
      WHEN 1 THEN
        platform_name := 'facebook_il';
        group_name := 'משרות ומודעות בתחום הוטרינריה';
        language_code := 'he';
        hook_index := ((task_day - 1) % array_length(hebrew_hooks, 1)) + 1;
        hook_line := hebrew_hooks[hook_index];
        post_content := format('%s

%s

%s
🔗 vetree.app/article/%s

🌿 עוד תקצירים קליניים על vetree.app',
          hook_line,
          article_record.clinical_bottom_line,
          CASE
            WHEN length(article_record.title) > 80
            THEN substring(article_record.title from 1 for 77) || '...'
            ELSE article_record.title
          END,
          article_record.id
        );

      WHEN 2 THEN
        platform_name := 'whatsapp';
        group_name := 'וטרינרים ישראל';
        language_code := 'he';
        hook_index := ((task_day - 1) % array_length(hebrew_hooks, 1)) + 1;
        hook_line := hebrew_hooks[hook_index];
        post_content := format('%s

%s

📄 %s
🔗 vetree.app/article/%s

🌿 עוד ב-vetree.app',
          hook_line,
          article_record.clinical_bottom_line,
          CASE
            WHEN length(article_record.title) > 80
            THEN substring(article_record.title from 1 for 77) || '...'
            ELSE article_record.title
          END,
          article_record.id
        );

      WHEN 3 THEN
        platform_name := 'reddit';
        group_name := 'r/veterinarymedicine';
        language_code := 'en';
        hook_index := ((task_day - 1) % array_length(english_hooks, 1)) + 1;
        hook_line := english_hooks[hook_index];
        post_content := format('%s

%s

📄 %s
🔗 vetree.app/article/%s

🌿 More evidence-based summaries at vetree.app',
          hook_line,
          article_record.clinical_bottom_line,
          CASE
            WHEN length(article_record.title) > 80
            THEN substring(article_record.title from 1 for 77) || '...'
            ELSE article_record.title
          END,
          article_record.id
        );

      WHEN 4 THEN
        platform_name := 'linkedin';
        group_name := 'Personal profile (Roi Krispin DVM)';
        language_code := 'en';
        hook_index := ((task_day - 1) % array_length(english_hooks, 1)) + 1;
        hook_line := english_hooks[hook_index];
        post_content := format('%s

%s

Full article summary: vetree.app/article/%s

This is why I built Vetree - to make evidence-based medicine accessible without the information overload.

🌿 Get personalized clinical summaries at vetree.app

#veterinarymedicine #evidencebasedmedicine #vetlife',
          hook_line,
          article_record.clinical_bottom_line,
          article_record.id
        );

      WHEN 5 THEN
        platform_name := 'facebook_intl';
        group_name := 'Veterinary Professionals Worldwide';
        language_code := 'en';
        hook_index := ((task_day - 1) % array_length(english_hooks, 1)) + 1;
        hook_line := english_hooks[hook_index];
        post_content := format('%s

%s

📄 %s
🔗 vetree.app/article/%s

🌿 More evidence-based summaries at vetree.app',
          hook_line,
          article_record.clinical_bottom_line,
          CASE
            WHEN length(article_record.title) > 80
            THEN substring(article_record.title from 1 for 77) || '...'
            ELSE article_record.title
          END,
          article_record.id
        );

      WHEN 6 THEN
        platform_name := 'twitter';
        group_name := '@vetreeapp';
        language_code := 'en';
        -- Twitter needs shorter content
        post_content := format('%s

📄 %s
🔗 vetree.app/article/%s

🌿 Evidence-based summaries for busy vets',
          substring(article_record.clinical_bottom_line from 1 for 180),
          CASE
            WHEN length(article_record.title) > 50
            THEN substring(article_record.title from 1 for 47) || '...'
            ELSE article_record.title
          END,
          article_record.id
        );

      WHEN 7 THEN
        platform_name := 'instagram';
        group_name := '@vetreeapp';
        language_code := 'en';
        hook_index := ((task_day - 1) % array_length(english_hooks, 1)) + 1;
        hook_line := english_hooks[hook_index];
        post_content := format('[CAROUSEL POST - Slide 1: Hook + Key visual]
%s

[Slide 2: Clinical Bottom Line]
%s

[Slide 3: Article Details]
📄 %s
🔗 Link in bio → vetree.app/article/%s

[Caption:]
%s

Full summary at the link in bio 👆

🌿 Follow for evidence-based veterinary updates

#veterinary #vetmed #evidencebased #vetlife',
          hook_line,
          article_record.clinical_bottom_line,
          CASE
            WHEN length(article_record.title) > 60
            THEN substring(article_record.title from 1 for 57) || '...'
            ELSE article_record.title
          END,
          article_record.id,
          substring(article_record.clinical_bottom_line from 1 for 100)
        );

      WHEN 8 THEN
        platform_name := 'telegram';
        group_name := 'Veterinary groups';
        language_code := 'en';
        hook_index := ((task_day - 1) % array_length(english_hooks, 1)) + 1;
        hook_line := english_hooks[hook_index];
        post_content := format('%s

%s

📄 %s
🔗 vetree.app/article/%s

🌿 Get more evidence-based summaries at vetree.app',
          hook_line,
          article_record.clinical_bottom_line,
          CASE
            WHEN length(article_record.title) > 80
            THEN substring(article_record.title from 1 for 77) || '...'
            ELSE article_record.title
          END,
          article_record.id
        );

      WHEN 9 THEN
        platform_name := 'kol';
        group_name := 'Personal outreach';
        language_code := 'en';
        post_content := format('Hi [Name],

Thought this might be relevant to your practice:

%s

%s

Full summary: vetree.app/article/%s

I built Vetree to solve exactly this - getting evidence-based insights without spending hours searching literature.

Would value your thoughts: vetree.app

Best,
Roi',
          article_record.title,
          article_record.clinical_bottom_line,
          article_record.id
        );
    END CASE;

    -- Insert the task
    INSERT INTO growth_tasks (
      day_number,
      scheduled_date,
      platform,
      group_name,
      language,
      content,
      article_id,
      status
    ) VALUES (
      task_day,
      start_date + (task_day - 1),
      platform_name,
      group_name,
      language_code,
      post_content,
      article_record.id,
      'pending'
    );

  END LOOP;

  RAISE NOTICE 'Successfully created 90 growth tasks with real article references';
END $$;
