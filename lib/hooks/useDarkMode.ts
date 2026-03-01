'use client'

import { useEffect, useState } from 'react'

export function useDarkMode() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('darkMode')
    setIsDark(stored === 'true')
  }, [])

  useEffect(() => {
    if (!mounted) return

    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', 'false')
    }
  }, [isDark, mounted])

  const toggle = () => setIsDark(!isDark)

  return { isDark, toggle, mounted }
}
