const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const Anthropic = require('@anthropic-ai/sdk');

const ALLOWED_LABELS = [
  'Cardiology', 'Oncology', 'Soft Tissue Surgery', 'Orthopedics', 'Dermatology',
  'Neurology', 'Internal Medicine', 'Small Animal', 'Large Animal', 'Equine',
  'Exotic', 'Emergency', 'Anesthesia', 'Radiology', 'Pathology', 'Pharmacology',
  'Nutrition', 'Behavior', 'Reproduction', 'Ophthalmology', 'Dentistry'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function filterLabels(labels) {
  if (!Array.isArray(labels)) return [];
  return labels.filter(label => ALLOWED_LABELS.includes(label));
}

async function enrichArticle(client, anthropic, article) {
  const prompt = `You are a veterinary medicine expert. Analyze the following research article and extract the requested information.

Title: ${article.title}
Authors: ${article.authors}
Journal: ${article.source_journal}
Abstract: ${article.summary}

Return a JSON object with exactly these 5 fields:
1. summary: A comprehensive 150-250 word summary for veterinary professionals
2. clinical_bottom_line: One sentence (max 20 words) highlighting the key clinical takeaway
3. labels: Array of 3-5 strings ONLY from this list: Cardiology, Oncology, Soft Tissue Surgery, Orthopedics, Dermatology, Neurology, Internal Medicine, Small Animal, Large Animal, Equine, Exotic, Emergency, Anesthesia, Radiology, Pathology, Pharmacology, Nutrition, Behavior, Reproduction, Ophthalmology, Dentistry
4. strength_of_evidence: One of: Gold Standard/RCT, Systematic Review/Meta-Analysis, Cohort Study, Case-Control Study, Observational, Case Series, Case Report, Expert Opinion
5. authors: corrected authors string if duplicates detected, otherwise null

Return ONLY valid JSON, no markdown formatting.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;

    // Try to extract JSON from the response
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const enrichment = JSON.parse(jsonMatch[0]);

    // Filter and validate labels
    const validLabels = filterLabels(enrichment.labels);

    // Validate enrichment is complete - BOTH fields must be populated
    const hasSummary = enrichment.summary && enrichment.summary.trim().length > 0;
    const hasClinicalBottomLine = enrichment.clinical_bottom_line && enrichment.clinical_bottom_line.trim().length > 0;
    const hasValidLabels = validLabels.length > 0;

    const isComplete = hasSummary && hasClinicalBottomLine && hasValidLabels;
    const attemptNumber = (article.enrichment_attempts || 0) + 1;

    // If enrichment is incomplete, set error and keep needs_enrichment = true
    let errorMessage = null;
    if (!isComplete) {
      const missing = [];
      if (!hasSummary) missing.push('summary');
      if (!hasClinicalBottomLine) missing.push('clinical_bottom_line');
      if (!hasValidLabels) missing.push('labels');
      errorMessage = `Enrichment incomplete - missing: ${missing.join(', ')}`;
    }

    // Update the article
    const updates = {
      summary: enrichment.summary || article.summary,
      clinical_bottom_line: enrichment.clinical_bottom_line || null,
      labels: validLabels,
      strength_of_evidence: enrichment.strength_of_evidence || null,
      needs_enrichment: !isComplete,  // Only mark done if COMPLETE
      enrichment_attempts: attemptNumber,
      force_retry: false,  // Reset force_retry flag after processing
      last_enrichment_at: new Date().toISOString(),
      last_enrichment_error: errorMessage  // Set error if incomplete, null if complete
    };

    // Update authors if corrected
    if (enrichment.authors) {
      updates.authors = enrichment.authors;
    }

    const { error } = await client
      .from('articles')
      .update(updates)
      .eq('id', article.id);

    if (error) {
      console.error(`  Error updating article ${article.id}:`, error.message);
      return false;
    }

    console.log(`  ✓ Enriched: ${article.title.substring(0, 60)}...`);
    console.log(`    Labels: ${validLabels.join(', ')}`);
    console.log(`    Evidence: ${enrichment.strength_of_evidence}`);

    return true;
  } catch (error) {
    console.error(`  ✗ Error enriching article ${article.id}:`, error.message);

    // Increment attempt counter, log error, and reset force_retry
    const { error: updateError } = await client
      .from('articles')
      .update({
        enrichment_attempts: (article.enrichment_attempts || 0) + 1,
        needs_enrichment: (article.enrichment_attempts || 0) + 1 < 3,
        force_retry: false,  // Reset force_retry flag even on failure
        last_enrichment_error: error.message,
        last_enrichment_at: new Date().toISOString()
      })
      .eq('id', article.id);

    if (updateError) {
      console.error(`  Error updating attempt counter:`, updateError.message);
    }

    return false;
  }
}

async function sendSlackNotification(stats) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('No SLACK_WEBHOOK_URL configured, skipping notification');
    return;
  }

  let failedWarning = '';
  if (stats.failedArticles > 0) {
    failedWarning = `\n⚠️ *Articles requiring manual review:* ${stats.failedArticles} (failed 3+ times)`;
  }

  const message = {
    text: `🧠 *Vetree Enrichment Report*
• Total processed this run: ${stats.totalProcessed}
• Successfully enriched: ${stats.successCount}
• Failed (will retry): ${stats.failCount}
• Total remaining in queue: ${stats.remainingInQueue}${failedWarning}`
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      console.error('Failed to send Slack notification:', response.statusText);
    } else {
      console.log('✓ Slack notification sent');
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error.message);
  }
}

async function main() {
  console.log('Starting article enrichment...');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      realtime: {
        transport: ws,
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }
  );

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const stats = {
    totalProcessed: 0,
    successCount: 0,
    failCount: 0,
    remainingInQueue: 0,
    failedArticles: 0
  };

  const BATCH_SIZE = 50;
  const MAX_ARTICLES_PER_RUN = 500;

  console.log(`Safety cap: ${MAX_ARTICLES_PER_RUN} articles per run\n`);

  // Keep fetching and processing batches until no more articles or safety cap reached
  while (stats.totalProcessed < MAX_ARTICLES_PER_RUN) {
    // Calculate how many articles we can still process in this batch
    const articlesToFetch = Math.min(BATCH_SIZE, MAX_ARTICLES_PER_RUN - stats.totalProcessed);

    // Fetch next batch of articles that need enrichment
    // Include articles that EITHER:
    // 1. Have < 3 attempts (normal queue)
    // 2. Have force_retry = true (admin manual retry)
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('needs_enrichment', true)
      .or('enrichment_attempts.lt.3,force_retry.eq.true')
      .limit(articlesToFetch);

    if (error) {
      console.error('Error fetching articles:', error);
      process.exit(1);
    }

    if (!articles || articles.length === 0) {
      console.log('No more articles need enrichment.');
      break;
    }

    console.log(`\n📦 Batch starting at ${stats.totalProcessed}: ${articles.length} articles to enrich`);

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const overallIndex = stats.totalProcessed + i + 1;
      console.log(`[${overallIndex}/${Math.min(stats.totalProcessed + articles.length, MAX_ARTICLES_PER_RUN)}] Processing...`);

      // Check abstract exists and has meaningful content
      if (!article.summary || article.summary.trim().length < 50) {
        console.log(`  ⊗ Skipping: No abstract (${article.title.substring(0, 60)}...)`);

        await supabase
          .from('articles')
          .update({
            needs_enrichment: false,
            quarantined: true,
            last_enrichment_error: 'no_abstract'
          })
          .eq('id', article.id);

        stats.failCount++;
        continue; // Skip to next article
      }

      // FIX 2: Auto-quarantine articles with no abstract after 3 failed attempts
      const enrichmentAttempts = article.enrichment_attempts || 0;
      const hasAbstract = article.summary && article.summary.trim().length > 0;
      const hasLabels = article.labels && article.labels.length > 0;

      if (enrichmentAttempts >= 3 && !hasAbstract && !hasLabels) {
        console.log(`  ⊗ Auto-quarantining: No abstract available (${article.title.substring(0, 60)}...)`);

        await supabase
          .from('articles')
          .update({
            quarantined: true,
            needs_enrichment: false,
            force_retry: false,
            last_enrichment_error: 'no_abstract_available - auto_quarantined'
          })
          .eq('id', article.id);

        stats.failCount++;
        continue; // Skip to next article
      }

      const success = await enrichArticle(supabase, anthropic, article);

      if (success) {
        stats.successCount++;
      } else {
        stats.failCount++;
      }

      // Wait 1 second between articles
      if (i < articles.length - 1 || stats.totalProcessed + articles.length < MAX_ARTICLES_PER_RUN) {
        await sleep(1000);
      }
    }

    stats.totalProcessed += articles.length;

    // If we processed fewer articles than requested, we've reached the end
    if (articles.length < articlesToFetch) {
      console.log('\n✓ Processed all available articles');
      break;
    }

    // If we've hit the safety cap
    if (stats.totalProcessed >= MAX_ARTICLES_PER_RUN) {
      console.log(`\n⚠️  Safety cap reached (${MAX_ARTICLES_PER_RUN} articles)`);
      break;
    }
  }

  // Check remaining in queue after this run
  const { count } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', true);

  stats.remainingInQueue = count || 0;

  // Count articles that failed 3+ times and still need attention
  // (3+ attempts, still needs enrichment, not currently queued for retry)
  const { count: failedCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .gte('enrichment_attempts', 3)
    .eq('needs_enrichment', true)
    .neq('force_retry', true);

  stats.failedArticles = failedCount || 0;

  console.log(`\n✅ Enrichment complete!`);
  console.log(`   Total processed: ${stats.totalProcessed}`);
  console.log(`   Successful: ${stats.successCount}`);
  console.log(`   Failed: ${stats.failCount}`);
  console.log(`   Remaining in queue: ${stats.remainingInQueue}`);

  // Send Slack notification
  await sendSlackNotification(stats);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
