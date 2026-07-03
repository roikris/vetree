import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from './AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    redirect('/')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--al-bg)' }}>
      <AdminSidebar />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
