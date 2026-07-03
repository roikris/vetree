'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/pipeline', label: 'Pipeline' },
  { href: '/admin/security', label: 'Security' },
  { href: '/admin/growth', label: 'Growth OS' },
  { href: '/admin/campaign', label: 'Campaign' },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 236, flexShrink: 0,
      background: 'var(--al-card2)',
      borderRight: '1px solid rgba(var(--al-line, 62,54,36), .11)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid rgba(var(--al-line, 62,54,36), .09)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--al-accent)">
            <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
          </svg>
          <span style={{
            fontFamily: 'var(--font-spectral, serif)', fontSize: 17, fontWeight: 600,
            lineHeight: 1, color: 'var(--al-ink2)',
          }}>
            Vetree
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 10, fontWeight: 600,
          letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--al-mut4)',
          lineHeight: 1,
        }}>
          Admin Dashboard
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11,
                    padding: '9px 12px', borderRadius: 9,
                    textDecoration: 'none',
                    background: isActive ? 'rgba(var(--al-acct, 95,140,51), .10)' : 'transparent',
                    transition: 'background .13s ease',
                  }}
                >
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                    background: isActive ? 'var(--al-accent)' : 'var(--al-mut6)',
                    transition: 'background .13s ease',
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 13.5, fontWeight: isActive ? 600 : 400,
                    lineHeight: 1, whiteSpace: 'nowrap',
                    color: isActive ? 'var(--al-accent)' : 'var(--al-sub)',
                    transition: 'color .13s ease',
                  }}>
                    {item.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div style={{
        padding: '14px 12px',
        borderTop: '1px solid rgba(var(--al-line, 62,54,36), .09)',
      }}>
        <Link
          href="/"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 9,
            textDecoration: 'none',
            fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 13, fontWeight: 400,
            color: 'var(--al-mut3)',
            transition: 'color .13s ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to app
        </Link>
      </div>
    </aside>
  )
}
