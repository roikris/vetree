import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function verify() {
  // Count articles with Small Animal
  const { count: smallAnimalCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .overlaps('labels', ['Small Animal'])

  // Count articles with Large Animal
  const { count: largeAnimalCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .overlaps('labels', ['Large Animal'])

  // Count total
  const { count: totalCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })

  console.log('\n✅ Verification Results:')
  console.log(`   Total articles: ${totalCount}`)
  console.log(`   Small Animal articles: ${smallAnimalCount}`)
  console.log(`   Large Animal articles: ${largeAnimalCount}`)
  console.log('\n🎉 The filters should now work!')
}

verify()
