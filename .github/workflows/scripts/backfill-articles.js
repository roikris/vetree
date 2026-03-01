const { createClient } = require('@supabase/supabase-js');
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
  "Vet Ophthalmol": "Veterinary Ophthalmology",
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
  'J Vet Intern Med'
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

async function searchPubMed(journal, year) {
  const query = `${journal}[Journal] AND ${year}[Date - Publication]`;
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=1000&retmode=json`;

  const response = await fetch(searchUrl, {
    headers: { 'User-Agent': 'VetResearch/1.0 (mailto:research@vetapp.com)' }
  });

  const data = await response.json();
  return data.esearchresult?.idlist || [];
}

async function fetchArticleDetails(pmids) {
  if (pmids.length === 0) return [];

  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;

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

async function sendSlackNotification(year, stats) {
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
    journalBreakdown = '\n\n📰 *Articles by journal:*\n' +
      journalsWithNew.map(([journal, count]) => `• ${journal}: ${count}`).join('\n');
  }

  const message = {
    text: `📚 *Vetree Backfill Report - Year ${year}*
• Total articles found on PubMed: ${stats.totalFound}
• Already in database: ${stats.totalExisting}
• Successfully added: ${stats.totalAdded}
• Failed to add: ${stats.totalFailed}${journalBreakdown}`
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
  const year = process.env.BACKFILL_YEAR;

  if (!year) {
    console.error('Error: BACKFILL_YEAR environment variable not set');
    process.exit(1);
  }

  console.log(`Starting backfill for year ${year}...`);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const stats = {
    totalFound: 0,
    totalExisting: 0,
    totalAdded: 0,
    totalFailed: 0,
    byJournal: {}
  };

  for (const journal of JOURNALS) {
    console.log(`\nSearching ${journal} for ${year}...`);
    stats.byJournal[journal] = 0;

    try {
      const pmids = await searchPubMed(journal, year);
      console.log(`  Found ${pmids.length} articles`);
      stats.totalFound += pmids.length;

      if (pmids.length === 0) continue;

      // Check which PMIDs already exist
      const { data: existing } = await supabase
        .from('articles')
        .select('pubmed_id')
        .in('pubmed_id', pmids);

      const existingPmids = new Set((existing || []).map(a => a.pubmed_id));
      const newPmids = pmids.filter(pmid => !existingPmids.has(pmid));

      stats.totalExisting += existingPmids.size;
      console.log(`  ${newPmids.length} new articles to fetch`);

      if (newPmids.length === 0) continue;

      // Process in batches of 20
      for (let i = 0; i < newPmids.length; i += 20) {
        const batch = newPmids.slice(i, i + 20);
        console.log(`  Fetching batch ${Math.floor(i/20) + 1} of ${Math.ceil(newPmids.length/20)}...`);

        const articles = await fetchArticleDetails(batch);

        if (articles.length > 0) {
          const { error } = await supabase
            .from('articles')
            .insert(articles);

          if (error) {
            console.error('  Error inserting articles:', error.message);
            stats.totalFailed += articles.length;
          } else {
            console.log(`  Inserted ${articles.length} articles`);
            stats.totalAdded += articles.length;
            stats.byJournal[journal] += articles.length;
          }
        }

        // Wait 2 seconds between batches
        if (i + 20 < newPmids.length) {
          await sleep(2000);
        }
      }
    } catch (error) {
      console.error(`Error processing ${journal}:`, error.message);
    }
  }

  console.log(`\n✅ Backfill complete for ${year}!`);
  console.log(`   Found: ${stats.totalFound}`);
  console.log(`   Already existed: ${stats.totalExisting}`);
  console.log(`   Added: ${stats.totalAdded}`);
  console.log(`   Failed: ${stats.totalFailed}`);

  // Send Slack notification
  await sendSlackNotification(year, stats);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
