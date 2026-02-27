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

    if (ids.length === 0) {
      console.log('  No IDs to update, skipping batch.');
      break;
    }

    console.log(`  Updating ${ids.length} articles in chunks...`);

    // Split into smaller chunks of 100 to avoid Supabase limits
    const chunkSize = 100;
    let chunkUpdated = 0;

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);

      const { error: updateError, count } = await supabase
        .from('articles')
        .update({ needs_enrichment: false })
        .in('id', chunk);

      if (updateError) {
        console.error(`Error updating chunk ${i / chunkSize + 1}:`, updateError);
        console.error('Error details:', JSON.stringify(updateError, null, 2));
        break;
      }

      const updated = count || chunk.length;
      chunkUpdated += updated;
      console.log(`    Chunk ${i / chunkSize + 1}: updated ${updated} articles`);
    }

    totalUpdated += chunkUpdated;
    console.log(`  Batch complete: ${chunkUpdated} articles (total: ${totalUpdated})`);

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
