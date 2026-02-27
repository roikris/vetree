const { createClient } = require('@supabase/supabase-js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function decodeHtmlEntities(text) {
  if (!text || typeof text !== 'string') return text;

  let decoded = text;

  // Decode hex entities (&#x...)
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // Decode decimal entities (&#...)
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });

  return decoded;
}

function needsDecoding(text) {
  if (!text || typeof text !== 'string') return false;
  return /&#[x0-9]/i.test(text);
}

async function fixArticleEncoding(client, article) {
  const fieldsToFix = ['authors', 'title', 'clinical_bottom_line', 'summary'];

  const updates = {};
  let hasChanges = false;

  for (const field of fieldsToFix) {
    const original = article[field];
    if (needsDecoding(original)) {
      const decoded = decodeHtmlEntities(original);
      if (decoded !== original) {
        updates[field] = decoded;
        hasChanges = true;
      }
    }
  }

  if (!hasChanges) {
    return false;
  }

  try {
    const { error } = await client
      .from('articles')
      .update(updates)
      .eq('id', article.id);

    if (error) {
      console.error(`  Error updating article ${article.id}:`, error.message);
      return false;
    }

    console.log(`  ✓ Fixed: ${article.title?.substring(0, 60) || article.id}...`);
    Object.keys(updates).forEach(field => {
      if (updates[field] !== article[field]) {
        console.log(`    ${field}: ${article[field]?.substring(0, 40)}... → ${updates[field]?.substring(0, 40)}...`);
      }
    });

    return true;
  } catch (error) {
    console.error(`  ✗ Error fixing article ${article.id}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('Starting HTML entity decoding...');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Fetch articles with HTML entities (look for &#)
  // We'll scan all articles but only process max 50 per run
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, authors, title, clinical_bottom_line, summary')
    .or('authors.like.%&#%,title.like.%&#%,clinical_bottom_line.like.%&#%,summary.like.%&#%')
    .limit(50);

  if (error) {
    console.error('Error fetching articles:', error);
    process.exit(1);
  }

  if (!articles || articles.length === 0) {
    console.log('No articles with HTML entities found.');
    return;
  }

  console.log(`Found ${articles.length} articles with HTML entities\n`);

  let fixedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`[${i + 1}/${articles.length}] Processing...`);

    const fixed = await fixArticleEncoding(supabase, article);

    if (fixed) {
      fixedCount++;
    } else {
      skippedCount++;
    }

    // Wait 50ms between updates
    if (i < articles.length - 1) {
      await sleep(50);
    }
  }

  console.log(`\n✅ Encoding fix complete!`);
  console.log(`   Fixed: ${fixedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
