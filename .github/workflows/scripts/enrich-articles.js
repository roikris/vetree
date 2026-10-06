const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const Anthropic = require('@anthropic-ai/sdk');

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS script run directly by the workflow
const { PROMPT_VERSION, AI_REFUSED, SYSTEM, buildPrompt, validateEnrichment } = require('./enrichment-prompt');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Claude refusals this run (marked ai_refused, waiting for the Codex fallback on Roi's Mac)
let refusedThisRun = 0;

// Claude summarizes `abstract` (migration 057) — ONLY that column, never `summary`.
// Before 057 the abstract lived in `summary` and this script overwrote it, so any retry
// (force_retry, admin re-queue, label edit, reset-enrichment, or the retry after a partial
// result) summarized the previous AI summary. `summary` can't be told apart from AI text
// reliably (a failed attempt stamps last_enrichment_at without writing it; CSV imports
// write prepared summaries with no timestamp), so there is no fallback: rows without an
// abstract are not enriched (see the queue query and releaseSourcelessRequeues below).

// Articles hidden this run after their 3rd failed attempt (see record_enrichment_failure)
let failedOutHidden = 0;

// A Claude refusal is recorded by ONE database call, record_enrichment_refusal (migration 073): in a single
// locked transaction it re-checks the row is still queued, then hides it as ai_refused (waiting for the
// Codex fallback) — or, under an admin / no-abstract / unknown quarantine, records a normal failed attempt.
// A row the fallback just published ('changed') is left alone. A refusal is counted only once recorded,
// so database failures still count toward the systemic-failure check. Returns false (not enriched).
async function markRefused(client, article) {
  const { data: outcome, error } = await client.rpc('record_enrichment_refusal', { p_id: article.id });
  if (error) { console.error(`  Error recording refusal:`, error.message); return false; }
  refusedThisRun++;
  if (outcome === 'hidden') failedOutHidden++;
  console.log(`  ⊘ Claude refused — ${outcome === 'refused' ? `hidden as ${AI_REFUSED}, waiting for the Codex fallback`
    : outcome === 'changed' ? 'row changed meanwhile, left as it is' : `recorded as a failed attempt (${outcome})`}`);
  return false;
}

async function enrichArticle(client, anthropic, article) {
  const system = SYSTEM;
  const prompt = buildPrompt(article);

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6'  /* keep in step with lib/ai/model.ts */,
      max_tokens: 3000,
      system: system,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // A reply cut off at max_tokens is never parsed or saved
    if (message.stop_reason === 'max_tokens') {
      throw new Error('Claude reply was cut off at max_tokens');
    }
    // A refusal is checked FIRST (any text that comes with it is never used): Claude declines some
    // livestock/poultry pathogen papers. One attempt is enough — a refusal repeats — so the article
    // is hidden as ai_refused and waits for the Codex fallback (CLAUDE.md rule 0 exception).
    if (message.stop_reason === 'refusal') {
      return await markRefused(client, article);
    }
    const textBlock = message.content?.find(block => block.type === 'text');
    if (!textBlock) {
      throw new Error(`No text content in Claude response (stop_reason: ${message.stop_reason})`);
    }
    const responseText = textBlock.text;

    // Try to extract JSON from the response
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const enrichment = JSON.parse(jsonMatch[0]);

    // Same validation as the Codex fallback (enrichment-prompt.js): BOTH fields + an allowed label
    const { validLabels, isComplete, missing } = validateEnrichment(enrichment);
    const attemptNumber = (article.enrichment_attempts || 0) + 1;

    // If enrichment is incomplete, set error and keep needs_enrichment = true
    let errorMessage = null;
    if (!isComplete) {
      errorMessage = `Enrichment incomplete - missing: ${missing.join(', ')}`;
    }

    // Update the article (an incomplete result: content only — the attempt itself is recorded by
    // record_enrichment_failure below, the same locked path as a thrown error)
    const updates = {
      // Safe even on a partial result: the source stays in `abstract`, which is never written here
      summary: enrichment.summary || article.summary,
      clinical_bottom_line: enrichment.clinical_bottom_line || null,
      labels: validLabels,
      strength_of_evidence: enrichment.strength_of_evidence || null,
      ...(isComplete ? {
        needs_enrichment: false,
        enrichment_attempts: attemptNumber,
        force_retry: false,  // Reset force_retry flag after processing
      } : {}),
      last_enrichment_at: new Date().toISOString(),
      last_enrichment_error: errorMessage,  // Set error if incomplete, null if complete
      prompt_version: PROMPT_VERSION  // Which prompt produced summary/clinical_bottom_line — enables precise rollback
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
      // Count the attempt, so a payload the database keeps rejecting can't burn AI calls forever
      const { data: outcome, error: rpcError } = await client.rpc('record_enrichment_failure', {
        p_id: article.id,
        p_error: `save failed: ${error.message}`
      });
      if (!rpcError && outcome === 'hidden') failedOutHidden++;
      return false;
    }

    if (!isComplete) {
      console.log(`  ✗ Incomplete: ${errorMessage}`);
      const { data: outcome, error: rpcError } = await client.rpc('record_enrichment_failure', {
        p_id: article.id,
        p_error: errorMessage
      });
      if (rpcError) console.error(`  Error recording failure:`, rpcError.message);
      else if (outcome === 'hidden') failedOutHidden++;
      return false;  // a failure, not a success
    }
    console.log(`  ✓ Enriched: ${article.title.substring(0, 60)}...`);
    console.log(`    Labels: ${validLabels.join(', ')}`);
    console.log(`    Evidence: ${enrichment.strength_of_evidence}`);

    return true;
  } catch (error) {
    console.error(`  ✗ Error enriching article ${article.id}:`, error.message);

    // Record the failed attempt in ONE locked database call (migration 072): the attempt that
    // reaches 3 hides the article (quarantined, quarantine_reason 'enrichment_failed') unless it is
    // already quarantined — then its quarantine and reason stay exactly as they are. It used to set
    // needs_enrichment = false, which the visibility rule reads as "done", so anything already
    // carrying text went public unenriched. Only admin "Retry failed" lifts an
    // 'enrichment_failed' quarantine (lib/enrichment/requeueFailed.ts).
    const { data: outcome, error: updateError } = await client.rpc('record_enrichment_failure', {
      p_id: article.id,
      p_error: error.message
    });
    if (!updateError && outcome === 'hidden') failedOutHidden++;
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
• Failed this run: ${stats.failCount} (hidden after 3 failed attempts: ${stats.hiddenThisRun})
• Claude refused this run: ${stats.refusedThisRun} · waiting for the Codex fallback: ${stats.waitingForFallback}${stats.waitingForFallback ? ' — run `npm run enrich:refused` on Roi\'s Mac' : ''}
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
    failedArticles: 0,
    attempted: 0,       // real AI attempts (skipped short abstracts excluded)
    hiddenThisRun: 0,
    refusedThisRun: 0,
    waitingForFallback: 0
  };

  const BATCH_SIZE = 50;
  const MAX_ARTICLES_PER_RUN = 500;

  console.log(`Safety cap: ${MAX_ARTICLES_PER_RUN} articles per run\n`);

  // Re-queued articles that are already published (have a bottom line) but have no source
  // abstract (no PubMed ID, or PubMed has none): re-enriching would summarize the existing
  // AI summary. Take them off the queue with a flag for the admin; content stays as is.
  const { data: released, error: releaseError } = await supabase
    .from('articles')
    .update({ needs_enrichment: false, force_retry: false, last_enrichment_error: 'no_source_abstract' })
    .eq('needs_enrichment', true)
    .is('abstract', null)
    .not('clinical_bottom_line', 'is', null)
    .select('id');
  if (releaseError) {
    console.error('Error releasing source-less re-queues:', releaseError);
    process.exit(1);
  }
  if (released.length > 0) {
    console.log(`⊗ Released ${released.length} published article(s) with no source abstract (no_source_abstract)`);
  }

  // Unpublished rows without an abstract stay queued, untouched, until one is backfilled
  const { count: awaitingSource } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('needs_enrichment', true)
    .is('abstract', null);
  if (awaitingSource) {
    console.log(`⏸ ${awaitingSource} queued article(s) awaiting a source abstract — not enriched`);
  }

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
      .not('abstract', 'is', null)  // only ever enrich from the source abstract
      // never ai_refused: those wait for the Codex fallback, whatever another control reset (rule 0 exception)
      .or(`and(or(enrichment_attempts.lt.3,force_retry.eq.true),or(quarantine_reason.is.null,quarantine_reason.neq.${AI_REFUSED}))`)
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

      // Check abstract has meaningful content (the queue query already requires it non-null)
      if (article.abstract.trim().length < 50) {
        console.log(`  ⊗ Skipping: No abstract (${article.title.substring(0, 60)}...)`);

        await supabase
          .from('articles')
          .update({
            needs_enrichment: false,
            quarantined: true,
            last_enrichment_error: 'no_abstract'
          })
          .eq('id', article.id);
        // Reason only where none is recorded yet (an admin's or earlier reason is kept)
        await supabase.from('articles').update({ quarantine_reason: 'no_abstract' })
          .eq('id', article.id).is('quarantine_reason', null);

        stats.failCount++;
        continue; // Skip to next article
      }

      // FIX 2: Auto-quarantine articles with no abstract after 3 failed attempts
      const enrichmentAttempts = article.enrichment_attempts || 0;
      const hasAbstract = article.abstract.trim().length > 0;
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
        await supabase.from('articles').update({ quarantine_reason: 'no_abstract' })
          .eq('id', article.id).is('quarantine_reason', null);

        stats.failCount++;
        continue; // Skip to next article
      }

      stats.attempted++;
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
    .not('abstract', 'is', null)
    // = FAILED_UNPUBLISHED_OR in lib/enrichment/requeueFailed.ts (ai_refused is counted separately below)
    .or(`quarantine_reason.eq.enrichment_failed,and(enrichment_attempts.gte.3,or(quarantine_reason.is.null,quarantine_reason.neq.${AI_REFUSED}),or(needs_enrichment.eq.true,summary.is.null,clinical_bottom_line.is.null))`)
    .not('force_retry', 'is', true);

  stats.failedArticles = failedCount || 0;

  // Refused by Claude and hidden: waiting for the Codex fallback on Roi's Mac. Decided by the marker,
  // not by `summary`: pre-057 rows still hold a copy of the abstract there (never AI text).
  const { count: waitingCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('quarantine_reason', AI_REFUSED)
    .not('abstract', 'is', null);
  stats.waitingForFallback = waitingCount || 0;

  console.log(`\n✅ Enrichment complete!`);
  console.log(`   Total processed: ${stats.totalProcessed}`);
  console.log(`   Successful: ${stats.successCount}`);
  console.log(`   Failed: ${stats.failCount}`);
  console.log(`   Remaining in queue: ${stats.remainingInQueue}`);

  stats.hiddenThisRun = failedOutHidden;
  stats.refusedThisRun = refusedThisRun;

  // Send Slack notification
  await sendSlackNotification(stats);

  // Several real AI attempts that ALL failed is a systemic problem (API key, model, database): fail
  // the workflow so it shows red in GitHub, not only in Slack. Skipped/quarantined short abstracts
  // are not attempts, and one or two failures alone are not systemic.
  // A refusal is not systemic: Claude answered (key, model and API work), it declined the topic.
  const systemicAttempts = stats.attempted - refusedThisRun;
  if (systemicAttempts >= 3 && stats.successCount === 0) {
    console.error(`✗ All ${systemicAttempts} non-refusal enrichment attempts in this run failed — exiting 1`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
