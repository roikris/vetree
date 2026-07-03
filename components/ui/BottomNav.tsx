'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function BottomNav() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(path)
  }

  const navItems = [
    {
      name: 'Home',
      path: '/',
      icon: (active: boolean) => (
        <svg
          className={`w-6 h-6 ${active ? 'fill-current' : 'fill-none'}`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Search',
      path: '/',
      icon: (active: boolean) => (
        <svg
          className={`w-6 h-6 ${active ? 'fill-current' : 'fill-none'}`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      name: 'Saved',
      path: '/library',
      icon: (active: boolean) => (
        <svg
          className={`w-6 h-6 ${active ? 'fill-current' : 'fill-none'}`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
    {
      name: 'Profile',
      path: '/profile',
      icon: (active: boolean) => (
        <svg
          className={`w-6 h-6 ${active ? 'fill-current' : 'fill-none'}`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ]

  return (
    <nav className="md:hidden safe-area-inset-bottom" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(var(--al-bar, 247,243,232), .94)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderTop: '1px solid rgba(var(--al-line, 232,224,204), .1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 60 }}>
        {navItems.map((item) => {
          const active = isActive(item.path)
          return (
            <Link
              key={item.path + item.name}
              href={item.path}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 4, flex: 1, height: '100%',
                textDecoration: 'none',
                color: active ? 'var(--al-accent)' : 'var(--al-mut4)',
              }}
            >
              {item.icon(active)}
              <span style={{
                fontFamily: 'var(--font-instrument, sans-serif)',
                fontSize: 10.5, fontWeight: active ? 600 : 400, lineHeight: 1,
              }}>{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
