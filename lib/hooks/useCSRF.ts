import { useEffect, useState } from 'react'

export function useCSRFToken(): string | null {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const csrfToken = getCSRFToken()
    setToken(csrfToken)
  }, [])

  return token
}

export function getCSRFToken(): string | null {
  if (typeof document === 'undefined') return null
  
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === '__csrf_token') {
      return value
    }
  }
  return null
}

export function addCSRFTokenToHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const token = getCSRFToken()
  if (token) {
    headers['x-csrf-token'] = token
  }
  return headers
}

export async function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = addCSRFTokenToHeaders(
    options.headers ? { ...(options.headers as Record<string, string>) } : {}
  )
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  })
}