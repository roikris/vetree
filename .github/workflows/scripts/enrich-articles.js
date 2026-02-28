const { createClient } = require('@supabase/supabase-js');
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

    // Determine if enrichment succeeded
    const hasValidContent = enrichment.summary &&
                           enrichment.clinical_bottom_line &&
                           validLabels.length > 0;

    // Update the article
    const updates = {
      summary: enrichment.summary || article.summary,
      clinical_bottom_line: enrichment.clinical_bottom_line || null,
      labels: validLabels,
      strength_of_evidence: enrichment.strength_of_evidence || null,
      needs_enrichment: !hasValidContent,
      enrichment_attempts: (article.enrichment_attempts || 0) + 1
    };

    // Update authors if corrected
    if (enrichment.authors) {
      updates.authors = enrichment.authors;
    }

    // After 3 attempts, give up
    if (updates.enrichment_attempts >= 3) {
      updates.needs_enrichment = false;
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

    // Increment attempt counter
    const { error: updateError } = await client
      .from('articles')
      .update({
        enrichment_attempts: (article.enrichment_attempts || 0) + 1,
        needs_enrichment: (article.enrichment_attempts || 0) + 1 < 3
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

  const message = {
    text: `🧠 *Vetree Enrichment Report*
• Articles found needing enrichment: ${stats.totalFound}
• Successfully enriched: ${stats.successCount}
• Failed (will retry): ${stats.failCount}
• Still in queue after this run: ${stats.remainingInQueue}`
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
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  // Fetch articles that need enrichment (max 50)
  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .eq('needs_enrichment', true)
    .lt('enrichment_attempts', 3)
    .limit(50);

  if (error) {
    console.error('Error fetching articles:', error);
    process.exit(1);
  }

  const stats = {
    totalFound: articles?.length || 0,
    successCount: 0,
    failCount: 0,
    remainingInQueue: 0
  };

  if (!articles || articles.length === 0) {
    console.log('No articles need enrichment.');

    // Check remaining in queue
    const { count } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('needs_enrichment', true);

    stats.remainingInQueue = count || 0;

    // Send notification even with 0 articles
    await sendSlackNotification(stats);
    return;
  }

  console.log(`Found ${articles.length} articles to enrich\n`);

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`[${i + 1}/${articles.length}] Processing...`);

    const success = await enrichArticle(supabase, anthropic, article);

    if (success) {
      stats.successCount++;
    } else {
      stats.failCount++;
    }

    // Wait 1 second between articles
    if (i < articles.length - 1) {
      await sleep(1000);
    }
  }

  // Check remaining in queue after this run
  const { count } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', true);

  stats.remainingInQueue = count || 0;

  console.log(`\n✅ Enrichment complete!`);
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
