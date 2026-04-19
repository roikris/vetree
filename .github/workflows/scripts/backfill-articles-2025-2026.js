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

async function searchPubMed(journal, yearMonth) {
  // Format: YYYY/MM for monthly search
  const query = `${journal}[Journal] AND ${yearMonth}[Date - Publication]`;
  const apiKey = process.env.NCBI_API_KEY || '';
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=1000&retmode=json&api_key=${apiKey}`;

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

function generateMonths(startYear, startMonth, endYear, endMonth) {
  const months = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

async function processMonth(supabase, yearMonth, blacklistedIds) {
  const { year, month } = yearMonth;
  const monthStr = month.toString().padStart(2, '0');
  const yearMonthStr = `${year}-${monthStr}`;
  const pubmedDateFormat = `${year}/${monthStr}`;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📅 Processing ${yearMonthStr}...`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const monthStats = {
    fetched: 0,
    inserted: 0,
    skipped: 0,
    blacklisted: 0,
    failed: 0
  };

  for (const journal of JOURNALS) {
    try {
      const pmids = await searchPubMed(journal, pubmedDateFormat);

      if (pmids.length === 0) continue;

      monthStats.fetched += pmids.length;

      // Filter out blacklisted articles
      const nonBlacklistedPmids = pmids.filter(pmid => !blacklistedIds.has(pmid));
      const blacklistedCount = pmids.length - nonBlacklistedPmids.length;
      if (blacklistedCount > 0) {
        monthStats.blacklisted += blacklistedCount;
      }

      if (nonBlacklistedPmids.length === 0) continue;

      // Check which PMIDs already exist
      const { data: existing } = await supabase
        .from('articles')
        .select('pubmed_id')
        .in('pubmed_id', nonBlacklistedPmids);

      const existingPmids = new Set((existing || []).map(a => a.pubmed_id));
      const newPmids = nonBlacklistedPmids.filter(pmid => !existingPmids.has(pmid));

      monthStats.skipped += existingPmids.size;

      if (newPmids.length === 0) continue;

      // Process in batches of 20
      for (let i = 0; i < newPmids.length; i += 20) {
        const batch = newPmids.slice(i, i + 20);

        const articles = await fetchArticleDetails(batch);

        if (articles.length > 0) {
          // Upsert to handle conflicts gracefully
          const { error } = await supabase
            .from('articles')
            .upsert(articles, { onConflict: 'pubmed_id', ignoreDuplicates: false });

          if (error) {
            console.error(`  ✗ Error inserting batch: ${error.message}`);
            monthStats.failed += articles.length;
          } else {
            monthStats.inserted += articles.length;
          }
        }

        // Respect rate limits: 100ms between batches (10 req/sec with API key)
        if (i + 20 < newPmids.length) {
          await sleep(100);
        }
      }
    } catch (error) {
      console.error(`  ✗ Error processing ${journal}:`, error.message);
    }
  }

  console.log(`${yearMonthStr}: fetched ${monthStats.fetched}, inserted ${monthStats.inserted}, skipped ${monthStats.skipped} (already exists)${monthStats.blacklisted > 0 ? `, blacklisted ${monthStats.blacklisted}` : ''}${monthStats.failed > 0 ? `, failed ${monthStats.failed}` : ''}`);

  return monthStats;
}

async function main() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-based
  const currentMonthStr = currentMonth.toString().padStart(2, '0');

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Vetree Backfill: 2025-01 → ${currentYear}-${currentMonthStr} (Month-by-Month)  ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Load blacklist
  console.log('\n🔒 Loading blacklist...');
  const { data: blacklist } = await supabase
    .from('articles_blacklist')
    .select('pubmed_id');

  const blacklistedIds = new Set(blacklist?.map(b => b.pubmed_id) || []);
  console.log(`   Blacklisted articles: ${blacklistedIds.size}`);

  // Generate months from Jan 2025 up to and including the current month
  const months = generateMonths(2025, 1, currentYear, currentMonth);
  console.log(`\n📆 Processing ${months.length} months: 2025-01 to ${currentYear}-${currentMonthStr}`);

  const globalStats = {
    monthsProcessed: 0,
    totalFetched: 0,
    totalInserted: 0,
    totalSkipped: 0,
    totalBlacklisted: 0,
    totalFailed: 0
  };

  for (const yearMonth of months) {
    const monthStats = await processMonth(supabase, yearMonth, blacklistedIds);

    globalStats.monthsProcessed++;
    globalStats.totalFetched += monthStats.fetched;
    globalStats.totalInserted += monthStats.inserted;
    globalStats.totalSkipped += monthStats.skipped;
    globalStats.totalBlacklisted += monthStats.blacklisted;
    globalStats.totalFailed += monthStats.failed;

    // Wait 1 second between months to respect rate limits
    if (globalStats.monthsProcessed < months.length) {
      await sleep(1000);
    }
  }

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  BACKFILL COMPLETE                                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`✓ Months processed: ${globalStats.monthsProcessed}`);
  console.log(`✓ Articles fetched: ${globalStats.totalFetched}`);
  console.log(`✓ Articles added: ${globalStats.totalInserted}`);
  console.log(`✓ Skipped (already exists): ${globalStats.totalSkipped}`);
  if (globalStats.totalBlacklisted > 0) {
    console.log(`⊗ Skipped (blacklisted): ${globalStats.totalBlacklisted}`);
  }
  if (globalStats.totalFailed > 0) {
    console.log(`✗ Failed: ${globalStats.totalFailed}`);
  }
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
