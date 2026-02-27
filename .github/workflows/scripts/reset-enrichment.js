const { createClient } = require('@supabase/supabase-js');

async function main() {
  console.log('Resetting enrichment flags for all articles...');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let totalUpdated = 0;
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    console.log(`\nProcessing batch starting at offset ${offset}...`);

    // Get articles in batches
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id')
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error('Error fetching articles:', fetchError);
      break;
    }

    if (!articles || articles.length === 0) {
      console.log('No more articles to process.');
      break;
    }

    // Update all articles in this batch
    const ids = articles.map(a => a.id);

    const { error: updateError, count } = await supabase
      .from('articles')
      .update({ needs_enrichment: false })
      .in('id', ids);

    if (updateError) {
      console.error('Error updating articles:', updateError);
      break;
    }

    const updated = count || articles.length;
    totalUpdated += updated;
    console.log(`  Updated ${updated} articles (total: ${totalUpdated})`);

    // If we got less than a full batch, we're done
    if (articles.length < batchSize) {
      break;
    }

    offset += batchSize;
  }

  console.log(`\n✅ Reset complete! Updated ${totalUpdated} articles.`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
