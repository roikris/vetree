// Manual remediation for the "PubMed truncation warning" line in the daily
// sync Slack report: esearch caps results at retmax (100) per journal per
// run in daily-sync.js. When a journal has more EDAT matches than that in
// the lookback window, the excess is silently dropped by the daily script.
// Run this for the named journal to paginate through ALL matches in the
// window and insert whatever daily-sync.js missed.
//
// Usage: set JOURNAL and DAYS_BACK env vars (see fetch-truncated-journal.yml
// workflow_dispatch inputs) and run `node scripts/fetch-truncated-journal.js`.

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

// Safety cap on total records paginated for one journal in one run —
// generous enough for any realistic truncation gap, small enough to bound
// worst-case runtime/API usage if a bad journal name matches too broadly.
const MAX_RECORDS = 2000;
const PAGE_SIZE = 200;

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

async function searchPubMedPaginated(journal, daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/');

  const query = `${journal}[Journal]`;
  const apiKey = process.env.NCBI_API_KEY || '';

  const pmids = [];
  let retstart = 0;
  let totalCount = Infinity;

  while (retstart < totalCount && pmids.length < MAX_RECORDS) {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${PAGE_SIZE}&retstart=${retstart}&retmode=json&datetype=edat&mindate=${dateStr}&maxdate=3000&api_key=${apiKey}`;

    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'VetResearch/1.0 (mailto:research@vetapp.com)' }
    });

    const data = await response.json();
    const page = data.esearchresult?.idlist || [];
    totalCount = parseInt(data.esearchresult?.count, 10) || page.length;

    pmids.push(...page);
    retstart += PAGE_SIZE;

    if (page.length === 0) break;
    if (retstart < totalCount) await sleep(400);
  }

  return { pmids, totalCount };
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
      const titleRaw = articleData?.ArticleTitle?.[0] || '';
      const title = typeof titleRaw === 'string' ? titleRaw : (titleRaw._ || '');
      const abstractTexts = articleData?.Abstract?.[0]?.AbstractText || [];
      const abstract = abstractTexts.map(t => typeof t === 'string' ? t : t._).join(' ');

      const authorList = articleData?.AuthorList?.[0]?.Author || [];
      const authors = formatAuthors(authorList);

      const journal = articleData?.Journal?.[0]?.Title?.[0] || '';
      const normalizedJournal = normalizeJournal(journal);

      let doi = '';
      const articleIds = article.PubmedData?.[0]?.ArticleIdList?.[0]?.ArticleId || [];
      for (const id of articleIds) {
        if (id.$?.IdType === 'doi') {
          doi = id._;
          break;
        }
      }

      let pubDate = '';
      const pubDateData = articleData?.Journal?.[0]?.JournalIssue?.[0]?.PubDate?.[0];
      const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      if (pubDateData?.Year?.[0]) {
        const year = pubDateData.Year[0];
        const month = pubDateData.Month?.[0] || '01';
        const day = pubDateData.Day?.[0] || '01';
        const monthNum = monthMap[month] || month.padStart(2, '0');

        pubDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
      } else if (pubDateData?.MedlineDate?.[0]) {
        const medlineDate = pubDateData.MedlineDate[0];
        const yearMatch = medlineDate.match(/(19|20)\d{2}/);
        if (yearMatch) {
          const monthMatch = medlineDate.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
          const monthNum = monthMatch ? monthMap[monthMatch[0]] : '01';
          pubDate = `${yearMatch[0]}-${monthNum}-01`;
        }
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

async function sendSlackNotification(journal, daysAgo, stats) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('No SLACK_WEBHOOK_URL configured, skipping notification');
    return;
  }

  const message = {
    text: `🔧 *Vetree Truncation Remediation Report*
Journal: ${journal}
Window: last ${daysAgo} days (EDAT)
• Total matches on PubMed: ${stats.totalFound}
• Already in database: ${stats.totalExisting}
• Skipped (blacklisted): ${stats.totalBlacklisted}
• Skipped (no abstract): ${stats.totalNoAbstract}
• Successfully added: ${stats.totalAdded}
• Failed to add: ${stats.totalFailed}`
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
  const journal = process.env.JOURNAL;
  const daysAgo = parseInt(process.env.DAYS_BACK, 10);

  if (!journal) {
    console.error('Error: JOURNAL environment variable not set');
    process.exit(1);
  }
  if (!daysAgo || daysAgo <= 0) {
    console.error('Error: DAYS_BACK environment variable not set to a positive number');
    process.exit(1);
  }

  console.log(`Fetching all EDAT matches for "${journal}" in the last ${daysAgo} days...`);

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

  const stats = {
    totalFound: 0,
    totalExisting: 0,
    totalAdded: 0,
    totalFailed: 0,
    totalBlacklisted: 0,
    totalNoAbstract: 0,
  };

  const { pmids, totalCount } = await searchPubMedPaginated(journal, daysAgo);
  stats.totalFound = pmids.length;
  console.log(`  PubMed reports ${totalCount} total matches; paginated ${pmids.length}`);
  if (pmids.length >= MAX_RECORDS) {
    console.log(`  ⚠️ Hit MAX_RECORDS safety cap (${MAX_RECORDS}) — narrow the window or check the journal name`);
  }

  if (pmids.length === 0) {
    console.log('Nothing found — nothing to do.');
    await sendSlackNotification(journal, daysAgo, stats);
    return;
  }

  const { data: existing } = await supabase
    .from('articles')
    .select('pubmed_id')
    .in('pubmed_id', pmids);
  const existingPmids = new Set((existing || []).map(a => a.pubmed_id));

  const { data: blacklisted } = await supabase
    .from('articles_blacklist')
    .select('pubmed_id')
    .in('pubmed_id', pmids);
  const blacklistedPmids = new Set((blacklisted || []).map(b => b.pubmed_id));

  stats.totalExisting = existingPmids.size;
  stats.totalBlacklisted = blacklistedPmids.size;

  const newPmids = pmids.filter(pmid => !existingPmids.has(pmid) && !blacklistedPmids.has(pmid));
  console.log(`  ${newPmids.length} genuinely new articles to insert`);

  for (let i = 0; i < newPmids.length; i += 20) {
    const batch = newPmids.slice(i, i + 20);
    console.log(`  Fetching batch ${Math.floor(i / 20) + 1} of ${Math.ceil(newPmids.length / 20)}...`);

    const articles = await fetchArticleDetails(batch);

    const articlesToInsert = articles.filter(a => a.summary && a.summary.trim().length >= 50);
    const skippedCount = articles.length - articlesToInsert.length;
    if (skippedCount > 0) {
      console.log(`  Skipped ${skippedCount} articles with no abstract`);
      stats.totalNoAbstract += skippedCount;
    }

    if (articlesToInsert.length > 0) {
      const { error } = await supabase.from('articles').insert(articlesToInsert);

      if (error) {
        if (error.code === '23505') {
          console.log(`  ${articlesToInsert.length} articles skipped (duplicate key at insert time)`);
        } else {
          console.error('  Error inserting articles:', error.message);
          stats.totalFailed += articlesToInsert.length;
        }
      } else {
        console.log(`  Inserted ${articlesToInsert.length} articles`);
        stats.totalAdded += articlesToInsert.length;
      }
    }

    if (i + 20 < newPmids.length) {
      await sleep(500);
    }
  }

  console.log(`\n✅ Remediation complete for "${journal}"!`);
  console.log(`   Found: ${stats.totalFound}`);
  console.log(`   Already in DB: ${stats.totalExisting}`);
  console.log(`   Blacklisted: ${stats.totalBlacklisted}`);
  console.log(`   No abstract: ${stats.totalNoAbstract}`);
  console.log(`   Added: ${stats.totalAdded}`);
  console.log(`   Failed: ${stats.totalFailed}`);

  await sendSlackNotification(journal, daysAgo, stats);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
