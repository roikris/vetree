import { createClient } from '@/lib/supabase/server'
import { SecurityClient } from './SecurityClient'

export default async function SecurityPage() {
  const supabase = await createClient()

  const { data: reports } = await supabase
    .from('security_reports')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(10)

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F] p-8">
      <SecurityClient initialReports={reports ?? []} />
    </div>
  )
}
