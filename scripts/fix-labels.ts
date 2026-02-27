import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local file
config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

function cleanLabel(label: string): string {
  // Remove leading/trailing quotes, brackets, and backslashes
  let cleaned = label.trim()

  // Remove leading brackets and quotes: ["Anesthesia" -> Anesthesia
  cleaned = cleaned.replace(/^\[?"?\\*"?/, '')

  // Remove trailing brackets and quotes: Anesthesia"] -> Anesthesia
  cleaned = cleaned.replace(/\\*"?\]?"?$/, '')

  return cleaned
}

function fixLabelsArray(labels: string[]): string[] {
  if (!labels || labels.length === 0) {
    return []
  }

  // Try to reconstruct the original array by joining and parsing
  const joined = labels.join('')

  // Check if it looks like a malformed JSON array string
  if (joined.startsWith('[') && joined.endsWith(']')) {
    try {
      // Try to parse it as JSON
      const parsed = JSON.parse(joined)
      if (Array.isArray(parsed)) {
        return parsed.map(l => String(l).trim()).filter(Boolean)
      }
    } catch {
      // If parsing fails, fall through to cleaning individual labels
    }
  }

  // Clean each label individually
  const cleaned = labels
    .map(label => cleanLabel(String(label)))
    .filter(label => label.length > 0 && label !== '[]')

  return cleaned
}

async function fixLabels() {
  console.log('🔧 Fixing malformed labels in the database...\n')

  // Fetch all articles (in batches)
  let allArticles: any[] = []
  let from = 0
  const batchSize = 1000

  while (true) {
    const { data: batch, error } = await supabase
      .from('articles')
      .select('id, title, labels')
      .range(from, from + batchSize - 1)

    if (error) {
      console.error('Error fetching articles:', error)
      break
    }

    if (!batch || batch.length === 0) {
      break
    }

    allArticles.push(...batch)
    console.log(`Fetched ${allArticles.length} articles...`)

    if (batch.length < batchSize) {
      break
    }

    from += batchSize
  }

  console.log(`\nFound ${allArticles.length} articles to fix\n`)

  let fixedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const article of allArticles) {
    try {
      if (!article.labels || article.labels.length === 0) {
        skippedCount++
        continue
      }

      const fixedLabels = fixLabelsArray(article.labels)

      // Check if labels actually changed
      const labelsChanged = JSON.stringify(article.labels) !== JSON.stringify(fixedLabels)

      if (labelsChanged && fixedLabels.length > 0) {
        console.log(`\nFixing: ${article.title}`)
        console.log(`  Before: ${JSON.stringify(article.labels)}`)
        console.log(`  After:  ${JSON.stringify(fixedLabels)}`)

        const { error: updateError } = await supabase
          .from('articles')
          .update({ labels: fixedLabels })
          .eq('id', article.id)

        if (updateError) {
          console.error(`  Error: ${updateError.message}`)
          errorCount++
        } else {
          fixedCount++
        }
      } else {
        skippedCount++
      }
    } catch (error) {
      console.error(`Error processing article ${article.id}:`, error)
      errorCount++
    }
  }

  console.log(`\n✅ Fix complete!`)
  console.log(`   Fixed: ${fixedCount}`)
  console.log(`   Skipped (already correct): ${skippedCount}`)
  console.log(`   Errors: ${errorCount}`)
}

fixLabels().catch(console.error)
