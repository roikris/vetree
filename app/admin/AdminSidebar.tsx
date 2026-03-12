'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/admin', label: 'Overview', icon: '📊' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
  { href: '/admin/reports', label: 'Reports', icon: '🐛' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/pipeline', label: 'Pipeline', icon: '⚙️' },
  { href: '/admin/growth', label: 'Growth OS', icon: '🌿' },
]

export function AdminSidebar() {
  const pathname = usePathname()

  // Load collapsed state from localStorage
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('admin_sidebar_collapsed') === 'true'
  })

  // Save to localStorage when toggled
  useEffect(() => {
    localStorage.setItem('admin_sidebar_collapsed', String(collapsed))
  }, [collapsed])

  const toggleCollapse = () => {
    setCollapsed(!collapsed)
  }

  return (
    <aside
      className={`bg-white dark:bg-[#1A1A1A] border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all duration-200 ease-in-out relative ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors z-10 text-zinc-500 dark:text-zinc-400 hover:text-[#3D7A5F] dark:hover:text-[#4E9A78]"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className="text-xs font-bold">
          {collapsed ? '»' : '«'}
        </span>
      </button>

      {/* Header */}
      <div className={`border-b border-zinc-200 dark:border-zinc-800 ${collapsed ? 'p-3' : 'p-6'}`}>
        <Link
          href="/"
          className="flex items-center gap-2 text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors"
          title={collapsed ? 'Vetree' : undefined}
        >
          <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
          </svg>
          <span
            className={`font-semibold text-lg transition-opacity duration-200 whitespace-nowrap ${
              collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            }`}
          >
            Vetree
          </span>
        </Link>
        {!collapsed && (
          <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 transition-opacity duration-200">
            Admin Dashboard
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'}`}>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all ${
                    collapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3'
                  } ${
                    isActive
                      ? 'bg-[#3D7A5F]/10 dark:bg-[#4E9A78]/10 text-[#3D7A5F] dark:text-[#4E9A78]'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <span
                    className={`transition-opacity duration-200 whitespace-nowrap ${
                      collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className={`border-t border-zinc-200 dark:border-zinc-800 ${collapsed ? 'p-2' : 'p-4'}`}>
        <Link
          href="/"
          className={`flex items-center gap-2 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-[#3D7A5F] dark:hover:text-[#4E9A78] transition-colors ${
            collapsed ? 'px-3 justify-center' : 'px-4'
          }`}
          title={collapsed ? 'Back to App' : undefined}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span
            className={`transition-opacity duration-200 whitespace-nowrap ${
              collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            }`}
          >
            Back to App
          </span>
        </Link>
      </div>
    </aside>
  )
}
