import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local file
config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugLabels() {
  console.log('🔍 Debugging article labels...\n')

  // Check total articles
  const { count: totalCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 Total articles in database: ${totalCount}\n`)

  if (totalCount === 0) {
    console.log('❌ No articles found! Please import some articles first.')
    console.log('   Run: npm run import-articles scripts/sample-articles.csv')
    return
  }

  // Get sample articles with their labels
  const { data: sampleArticles } = await supabase
    .from('articles')
    .select('id, title, labels')
    .limit(5)

  console.log('📝 Sample articles and their labels:')
  sampleArticles?.forEach(article => {
    console.log(`  - ${article.title}`)
    console.log(`    Labels: ${JSON.stringify(article.labels)}\n`)
  })

  // Check for "Small Animal" articles using overlaps
  const { data: smallAnimalArticles, count: smallAnimalCount } = await supabase
    .from('articles')
    .select('id, title, labels', { count: 'exact' })
    .overlaps('labels', ['Small Animal'])

  console.log(`🐕 Articles with "Small Animal" label (using overlaps): ${smallAnimalCount}`)
  if (smallAnimalCount && smallAnimalCount > 0) {
    smallAnimalArticles?.slice(0, 3).forEach(article => {
      console.log(`  - ${article.title}`)
      console.log(`    Labels: ${JSON.stringify(article.labels)}`)
    })
  }
  console.log()

  // Check for "Large Animal" articles using overlaps
  const { data: largeAnimalArticles, count: largeAnimalCount } = await supabase
    .from('articles')
    .select('id, title, labels', { count: 'exact' })
    .overlaps('labels', ['Large Animal'])

  console.log(`🐄 Articles with "Large Animal" label (using overlaps): ${largeAnimalCount}`)
  if (largeAnimalCount && largeAnimalCount > 0) {
    largeAnimalArticles?.slice(0, 3).forEach(article => {
      console.log(`  - ${article.title}`)
      console.log(`    Labels: ${JSON.stringify(article.labels)}`)
    })
  }
  console.log()

  // Get all unique labels
  const { data: allArticles } = await supabase
    .from('articles')
    .select('labels')

  const allLabels = new Set<string>()
  allArticles?.forEach(article => {
    if (article.labels) {
      article.labels.forEach((label: string) => allLabels.add(label))
    }
  })

  console.log('🏷️  All unique labels in database:')
  Array.from(allLabels).sort().forEach(label => {
    console.log(`  - "${label}"`)
  })
}

debugLabels().catch(console.error)
