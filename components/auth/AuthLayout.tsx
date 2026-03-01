import Link from 'next/link'
import { DarkModeToggle } from '@/components/ui/DarkModeToggle'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F] transition-colors">
      {/* Header */}
      <header className="border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-[#3D7A5F] dark:bg-[#4E9A78] flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Vetree
            </span>
          </Link>
          <DarkModeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-md mx-auto px-6 py-12">
        <div className="bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-8 shadow-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {subtitle}
              </p>
            )}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
