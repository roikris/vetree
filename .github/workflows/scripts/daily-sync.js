const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { parseStringPromise } = require('xml2js');

const JOURNAL_MAP = {
  "Veterinary journal (London, England : 1997)": "Veterinary Journal",
  "JAVMA": "Journal of the American Veterinary Medical Association",
  "American Journal of Veterinary Research (AJVR)": "American Journal of Veterinary Research",
  "American journal of veterinary research": "American Journal of Veterinary Research",
  "J Am Vet Med Assoc": "Journal of the American Veterinary Medical Association",
  "Journal of the American Veterinary Medical Association (JAVMA)": "Journal of the American Veterinary Medical Association",
  "Am J Vet Res": "American Journal of Veterinary Research",
  "Vet Surg": "Veterinary Surgery",
  "Veterinary surgery : VS": "Veterinary Surgery",
  "J Vet Intern Med": "Journal of Veterinary Internal Medicine",
  "JVIM": "Journal of Veterinary Internal Medicine",
  "Journal of veterinary internal medicine": "Journal of Veterinary Internal Medicine",
  "J Feline Med Surg": "Journal of Feline Medicine and Surgery",
  "Journal of Feline Medicine and Surgery (JFMS)": "Journal of Feline Medicine and Surgery",
  "Journal of feline medicine and surgery": "Journal of Feline Medicine and Surgery",
  "Vet Pathol": "Veterinary Pathology",
  "Veterinary dermatology": "Veterinary Dermatology",
  "Vet Radiol Ultrasound": "Veterinary Radiology & Ultrasound",
  "J Small Anim Pract": "Journal of Small Animal Practice",
  "J of Small Animal Practice": "Journal of Small Animal Practice",
  "Journal of Small Animal Practice (JSAP)": "Journal of Small Animal Practice",
  "The Journal of small animal practice": "Journal of Small Animal Practice",
  "Vet Dermatol": "Veterinary Dermatology",
  "Veterinary ophthalmology": "Veterinary Ophthalmology",
  "Vet Ophthalmol": "Veterinary Ophthalmology",
  "Vet Ophthalmol.": "Veterinary Ophthalmology",
  "J Vet Cardiol": "Journal of Veterinary Cardiology",
  "Journal of veterinary cardiology : the official journal of the European Society of Veterinary Cardiology": "Journal of Veterinary Cardiology",
  "Front Vet Sci": "Frontiers in Veterinary Science",
  "Vet Comp Orthop Traumatol": "Veterinary and Comparative Orthopaedics and Traumatology",
  "Veterinary and Comparative Orthopaedics and Traumatology (VCOT)": "Veterinary and Comparative Orthopaedics and Traumatology",
  "VCOT": "Veterinary and Comparative Orthopaedics and Traumatology",
  "Frontiers in veterinary science": "Frontiers in Veterinary Science",
  "Veterinary and comparative orthopaedics and traumatology : V.C.O.T": "Veterinary and Comparative Orthopaedics and Traumatology",
  "J Vet Emerg Crit Care (San Antonio)": "Journal of Veterinary Emergency and Critical Care",
  "J Vet Emerg Crit Care": "Journal of Veterinary Emergency and Critical Care",
  "Journal of veterinary emergency and critical care": "Journal of Veterinary Emergency and Critical Care",
  "Journal of veterinary emergency and critical care (San Antonio, Tex. : 2001)": "Journal of Veterinary Emergency and Critical Care"
};

const JOURNALS = [
  'Journal of feline medicine and surgery',
  'The Journal of small animal practice',
  'Journal of veterinary internal medicine',
  'Journal of the American Veterinary Medical Association',
  'Journal of veterinary emergency and critical care',
  'J Vet Cardiol',
  'J Vet Emerg Crit Care',
  'The Veterinary record',
  'Veterinary dermatology',
  'Vet J',
  'Vet Surg',
  'Vet Comp Orthop Traumatol',
  'Vet Anaesth Analg',
  'J Vet Emerg Crit Care (San Antonio)',
  'Front Vet Sci',
  'J Vet Intern Med',
  'Veterinary ophthalmology'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeJournal(journal) {
  return JOURNAL_MAP[journal] || journal;
}

function formatAuthors(authorList) {
  if (!authorList || !Array.isArray(authorList)) return '';

  return authorList.map(author => {
    const lastName = author.LastName?.[0] || '';
    const initials = author.Initials?.[0] || '';
    return `${lastName} ${initials}`;
  }).join(', ');
}

async function searchPubMed(journal, daysAgo = 5) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/');

  const query = `${journal}[Journal] AND ("${dateStr}"[Date - Publication] : "3000"[Date - Publication])`;
  const apiKey = process.env.NCBI_API_KEY || '';
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=100&retmode=json&api_key=${apiKey}`;

  const response = await fetch(searchUrl, {
    headers: { 'User-Agent': 'VetResearch/1.0 (mailto:research@vetapp.com)' }
  });

  const data = await response.json();
  return data.esearchresult?.idlist || [];
}

async function fetchArticleDetails(pmids) {
  if (pmids.length === 0) return [];

  const apiKey = process.env.NCBI_API_KEY || '';
  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml&api_key=${apiKey}`;

  const response = await fetch(fetchUrl, {
    headers: { 'User-Agent': 'VetResearch/1.0 (mailto:research@vetapp.com)' }
  });

  const xml = await response.text();
  const parsed = await parseStringPromise(xml);

  const articles = [];
  const pubmedArticles = parsed.PubmedArticleSet?.PubmedArticle || [];

  for (const article of pubmedArticles) {
    try {
      const medlineCitation = article.MedlineCitation?.[0];
      const articleData = medlineCitation?.Article?.[0];

      const pmid = medlineCitation?.PMID?.[0]?._ || medlineCitation?.PMID?.[0];
      const title = articleData?.ArticleTitle?.[0] || '';
      const abstractTexts = articleData?.Abstract?.[0]?.AbstractText || [];
      const abstract = abstractTexts.map(t => typeof t === 'string' ? t : t._).join(' ');

      const authorList = articleData?.AuthorList?.[0]?.Author || [];
      const authors = formatAuthors(authorList);

      const journal = articleData?.Journal?.[0]?.Title?.[0] || '';
      const normalizedJournal = normalizeJournal(journal);

      // Extract DOI
      let doi = '';
      const articleIds = article.PubmedData?.[0]?.ArticleIdList?.[0]?.ArticleId || [];
      for (const id of articleIds) {
        if (id.$?.IdType === 'doi') {
          doi = id._;
          break;
        }
      }

      // Get publication date
      let pubDate = '';
      const pubDateData = articleData?.Journal?.[0]?.JournalIssue?.[0]?.PubDate?.[0];
      if (pubDateData) {
        const year = pubDateData.Year?.[0] || '';
        const month = pubDateData.Month?.[0] || '01';
        const day = pubDateData.Day?.[0] || '01';

        // Convert month name to number
        const monthMap = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
          'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
          'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        const monthNum = monthMap[month] || month.padStart(2, '0');

        pubDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
      }

      const articleUrl = doi
        ? `https://doi.org/${doi}`
        : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

      articles.push({
        id: `pubmed-${pmid}`,
        pubmed_id: pmid,
        title,
        summary: abstract,
        authors,
        source_journal: normalizedJournal,
        doi: doi || null,
        article_url: articleUrl,
        publication_date: pubDate || null,
        needs_enrichment: true,
        clinical_bottom_line: null,
        strength_of_evidence: null,
        labels: []
      });
    } catch (error) {
      console.error('Error parsing article:', error);
    }
  }

  return articles;
}

async function sendSlackNotification(stats, skippedBlacklistDetails, skippedNoAbstractDetails) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('No SLACK_WEBHOOK_URL configured, skipping notification');
    return;
  }

  // Build journal breakdown text
  let journalBreakdown = '';
  const journalsWithNew = Object.entries(stats.byJournal)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (journalsWithNew.length > 0) {
    journalBreakdown = '\n\n📰 *New articles by journal:*\n' +
      journalsWithNew.map(([journal, count]) => `• ${journal}: ${count}`).join('\n');
  }

  const totalAccounted = stats.totalExisting + stats.totalAdded + stats.totalFailed +
    stats.totalBlacklisted + stats.totalNoAbstract + stats.totalDuplicate;
  const unaccounted = stats.totalFound - totalAccounted;
  const balanceCheck = unaccounted === 0
    ? `✅ All ${stats.totalFound} accounted for`
    : `⚠️ ${Math.abs(unaccounted)} article${Math.abs(unaccounted) !== 1 ? 's' : ''} unaccounted for`;

  const skippedLines = [
    stats.totalBlacklisted > 0 ? `• Skipped (blacklisted): ${stats.totalBlacklisted}` : '',
    stats.totalNoAbstract > 0  ? `• Skipped (no abstract): ${stats.totalNoAbstract}` : '',
    stats.totalDuplicate > 0   ? `• Skipped (duplicate at insert): ${stats.totalDuplicate}` : '',
    stats.totalFailed > 0      ? `• Failed to add: ${stats.totalFailed}` : '',
  ].filter(Boolean).join('\n');

  // Sample sections for skipped articles
  let blacklistSamples = '';
  if (skippedBlacklistDetails.length > 0) {
    const samples = skippedBlacklistDetails.slice(0, 3)
      .map(a => `• <${a.url}|${a.title || 'PMID: ' + a.pubmed_id}>`)
      .join('\n');
    const more = skippedBlacklistDetails.length > 3
      ? `\n_...and ${skippedBlacklistDetails.length - 3} more_` : '';
    blacklistSamples = `\n\n🚫 *Blacklisted samples:*\n${samples}${more}`;
  }

  let noAbstractSamples = '';
  if (skippedNoAbstractDetails.length > 0) {
    const samples = skippedNoAbstractDetails.slice(0, 3)
      .map(a => `• <${a.url}|${a.title}>`)
      .join('\n');
    const more = skippedNoAbstractDetails.length > 3
      ? `\n_...and ${skippedNoAbstractDetails.length - 3} more_` : '';
    noAbstractSamples = `\n\n📭 *No abstract samples:*\n${samples}${more}`;
  }

  const message = {
    text: `🌿 *Vetree Daily Sync Report*
• New articles found on PubMed: ${stats.totalFound}
• Already in database: ${stats.totalExisting}
• Successfully added: ${stats.totalAdded}
${skippedLines ? skippedLines + '\n' : ''}${balanceCheck}${journalBreakdown}${blacklistSamples}${noAbstractSamples}`
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
  console.log('Starting PubMed sync...');

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

  const runStartTime = new Date().toISOString();

  const stats = {
    totalFound: 0,
    totalExisting: 0,     // already in DB (pre-insert check)
    totalAdded: 0,
    totalFailed: 0,
    totalBlacklisted: 0,  // in articles_blacklist
    totalNoAbstract: 0,   // abstract missing or < 50 chars
    totalDuplicate: 0,    // 23505 conflicts at insert time (not caught by pre-check)
    byJournal: {}
  };

  const skippedBlacklistDetails = [];  // { pubmed_id, title, url }
  const skippedNoAbstractDetails = []; // { pubmed_id, title, url }

  for (const journal of JOURNALS) {
    console.log(`\nSearching ${journal}...`);
    stats.byJournal[journal] = 0;

    try {
      const pmids = await searchPubMed(journal);
      console.log(`  Found ${pmids.length} articles`);
      stats.totalFound += pmids.length;

      if (pmids.length === 0) continue;

      // Check which PMIDs already exist
      const { data: existing } = await supabase
        .from('articles')
        .select('pubmed_id')
        .in('pubmed_id', pmids);

      const existingPmids = new Set((existing || []).map(a => a.pubmed_id));

      // Check blacklist
      const { data: blacklisted } = await supabase
        .from('articles_blacklist')
        .select('pubmed_id')
        .in('pubmed_id', pmids);

      const blacklistedPmids = new Set((blacklisted || []).map(b => b.pubmed_id));

      // Filter out both existing and blacklisted
      const newPmids = pmids.filter(pmid => !existingPmids.has(pmid) && !blacklistedPmids.has(pmid));

      stats.totalExisting += existingPmids.size;
      stats.totalBlacklisted += blacklistedPmids.size;

      if (blacklistedPmids.size > 0) {
        console.log(`  ${blacklistedPmids.size} blacklisted articles skipped`);
        // Log blacklisted to DB and collect for Slack samples
        const blacklistRows = [...blacklistedPmids].map(pmid => ({
          sync_run_at: runStartTime,
          pubmed_id: pmid,
          title: null,
          article_url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          reason: 'blacklisted',
          journal,
        }));
        await supabase.from('sync_skipped_articles').insert(blacklistRows);
        for (const pmid of blacklistedPmids) {
          skippedBlacklistDetails.push({
            pubmed_id: pmid,
            title: null,
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          });
        }
      }

      console.log(`  ${newPmids.length} new articles to fetch`);

      if (newPmids.length === 0) continue;

      // Process in batches of 20
      for (let i = 0; i < newPmids.length; i += 20) {
        const batch = newPmids.slice(i, i + 20);
        console.log(`  Fetching batch ${Math.floor(i/20) + 1}...`);

        const articles = await fetchArticleDetails(batch);

        // Filter out articles with no abstract
        const articlesToInsert = articles.filter(a =>
          a.summary && a.summary.trim().length >= 50
        );

        const noAbstractArticles = articles.filter(a =>
          !a.summary || a.summary.trim().length < 50
        );
        const skippedCount = noAbstractArticles.length;
        if (skippedCount > 0) {
          console.log(`  Skipped ${skippedCount} articles with no abstract`);
          stats.totalNoAbstract += skippedCount;
          // Log to DB and collect for Slack samples
          const noAbstractRows = noAbstractArticles.map(a => ({
            sync_run_at: runStartTime,
            pubmed_id: a.pubmed_id,
            title: a.title?.slice(0, 500) || null,
            article_url: a.article_url || `https://pubmed.ncbi.nlm.nih.gov/${a.pubmed_id}/`,
            reason: 'no_abstract',
            journal: a.source_journal || journal,
          }));
          await supabase.from('sync_skipped_articles').insert(noAbstractRows);
          for (const a of noAbstractArticles) {
            skippedNoAbstractDetails.push({
              pubmed_id: a.pubmed_id,
              title: (a.title || 'Untitled').slice(0, 80),
              url: a.article_url || `https://pubmed.ncbi.nlm.nih.gov/${a.pubmed_id}/`,
            });
          }
        }

        if (articlesToInsert.length > 0) {
          const { error } = await supabase
            .from('articles')
            .insert(articlesToInsert);

          if (error) {
            // 23505 = unique constraint — at least one article in the batch already exists
            if (error.code === '23505') {
              console.log(`  ${articlesToInsert.length} articles skipped (duplicate key at insert time)`);
              stats.totalDuplicate += articlesToInsert.length;
            } else {
              console.error('  Error inserting articles:', error.message);
              stats.totalFailed += articlesToInsert.length;
            }
          } else {
            console.log(`  Inserted ${articlesToInsert.length} articles`);
            stats.totalAdded += articlesToInsert.length;
            stats.byJournal[journal] += articlesToInsert.length;
          }
        }

        // Wait 500ms between batches (safe with API key)
        if (i + 20 < newPmids.length) {
          await sleep(500);
        }
      }
    } catch (error) {
      console.error(`Error processing ${journal}:`, error.message);
    }
  }

  const totalAccounted = stats.totalExisting + stats.totalAdded + stats.totalFailed +
    stats.totalBlacklisted + stats.totalNoAbstract + stats.totalDuplicate;
  const unaccounted = stats.totalFound - totalAccounted;

  console.log(`\n✅ Sync complete!`);
  console.log(`   Found: ${stats.totalFound}`);
  console.log(`   Already in DB: ${stats.totalExisting}`);
  console.log(`   Added: ${stats.totalAdded}`);
  console.log(`   Blacklisted: ${stats.totalBlacklisted}`);
  console.log(`   No abstract: ${stats.totalNoAbstract}`);
  console.log(`   Duplicate at insert: ${stats.totalDuplicate}`);
  console.log(`   Failed: ${stats.totalFailed}`);
  if (unaccounted !== 0) {
    console.log(`   ⚠️ Unaccounted: ${unaccounted}`);
  }

  // Auto-cleanup: delete sync_skipped_articles older than 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: cleanupError } = await supabase
    .from('sync_skipped_articles')
    .delete()
    .lt('sync_run_at', thirtyDaysAgo);
  if (!cleanupError) {
    console.log('✓ Old skipped-article records cleaned up');
  }

  // Send Slack notification
  await sendSlackNotification(stats, skippedBlacklistDetails, skippedNoAbstractDetails);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
