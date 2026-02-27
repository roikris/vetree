import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface ArticleCSVRow {
  id: string
  title: string
  summary: string
  clinical_bottom_line: string
  strength_of_evidence: string
  labels: string
  source_journal: string
  article_url: string
  doi: string
  authors: string
  pubmed_id: string
  publication_date: string
}

async function importArticles(csvFilePath: string) {
  try {
    console.log(`Reading CSV file: ${csvFilePath}`)

    const fileContent = fs.readFileSync(csvFilePath, 'utf-8')

    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as ArticleCSVRow[]

    console.log(`Found ${records.length} articles to import`)

    let successCount = 0
    let errorCount = 0

    for (const record of records) {
      try {
        // Parse labels - handle both JSON array strings and comma-separated strings
        let labelsArray: string[] = []
        if (record.labels) {
          const labelsStr = record.labels.trim()
          if (labelsStr.startsWith('[') && labelsStr.endsWith(']')) {
            // Try to parse as JSON array
            try {
              const parsed = JSON.parse(labelsStr)
              labelsArray = Array.isArray(parsed) ? parsed : []
            } catch {
              // If JSON parsing fails, fall back to comma-separated
              labelsArray = labelsStr.split(',').map(l => l.trim())
            }
          } else {
            // Comma-separated string
            labelsArray = labelsStr.split(',').map(l => l.trim())
          }
        }

        const article = {
          id: record.id,
          title: record.title,
          summary: record.summary || null,
          clinical_bottom_line: record.clinical_bottom_line || null,
          strength_of_evidence: record.strength_of_evidence || null,
          labels: labelsArray,
          source_journal: record.source_journal || null,
          article_url: record.article_url || null,
          doi: record.doi || null,
          authors: record.authors || null,
          pubmed_id: record.pubmed_id || null,
          publication_date: record.publication_date || null,
        }

        const { error } = await supabase
          .from('articles')
          .upsert(article, { onConflict: 'id' })

        if (error) {
          console.error(`Error importing article ${article.id}:`, error.message)
          errorCount++
        } else {
          successCount++
          if (successCount % 10 === 0) {
            console.log(`Imported ${successCount} articles...`)
          }
        }
      } catch (error) {
        console.error(`Error processing article:`, error)
        errorCount++
      }
    }

    console.log(`\nImport complete!`)
    console.log(`✓ Successfully imported: ${successCount}`)
    console.log(`✗ Errors: ${errorCount}`)
  } catch (error) {
    console.error('Error reading or parsing CSV file:', error)
    process.exit(1)
  }
}

const csvFilePath = process.argv[2]

if (!csvFilePath) {
  console.error('Usage: npm run import-articles <path-to-csv-file>')
  process.exit(1)
}

if (!fs.existsSync(csvFilePath)) {
  console.error(`File not found: ${csvFilePath}`)
  process.exit(1)
}

importArticles(csvFilePath)
