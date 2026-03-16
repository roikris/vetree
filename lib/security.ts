import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export interface SecurityHeaders {
  'Content-Security-Policy'?: string
  'X-Frame-Options'?: string
  'X-Content-Type-Options'?: string
  'Strict-Transport-Security'?: string
  'X-XSS-Protection'?: string
  'Referrer-Policy'?: string
  'Permissions-Policy'?: string
}

export const DEFAULT_SECURITY_HEADERS: SecurityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vitals.vercel-insights.com https://cdn.jsdelivr.net https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' blob:",
    "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com https://api.anthropic.com https://upload.uploadcare.com wss://*.supabase.co",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}

export function addSecurityHeaders(response: NextResponse, customHeaders?: SecurityHeaders): NextResponse {
  const headers = { ...DEFAULT_SECURITY_HEADERS, ...customHeaders }
  
  Object.entries(headers).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value)
    }
  })
  
  return response
}

export interface CSRFTokenOptions {
  secret?: string
  tokenLength?: number
  cookieName?: string
  cookieOptions?: {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
    maxAge?: number
    path?: string
  }
}

export class CSRFProtection {
  private secret: string
  private tokenLength: number
  private cookieName: string
  private cookieOptions: Required<CSRFTokenOptions['cookieOptions']>

  constructor(options: CSRFTokenOptions = {}) {
    this.secret = options.secret || process.env.CSRF_SECRET || this.generateSecret()
    this.tokenLength = options.tokenLength || 32
    this.cookieName = options.cookieName || '__csrf_token'
    this.cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
      ...options.cookieOptions
    }
  }

  private generateSecret(): string {
    return crypto.randomBytes(64).toString('hex')
  }

  generateToken(): string {
    const timestamp = Date.now().toString()
    const randomBytes = crypto.randomBytes(this.tokenLength).toString('hex')
    const payload = `${timestamp}:${randomBytes}`
    
    const hmac = crypto.createHmac('sha256', this.secret)
    hmac.update(payload)
    const signature = hmac.digest('hex')
    
    return Buffer.from(`${payload}:${signature}`).toString('base64url')
  }

  verifyToken(token: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64url').toString()
      const [timestamp, randomBytes, signature] = decoded.split(':')
      
      if (!timestamp || !randomBytes || !signature) {
        return false
      }

      // Check if token is expired (24 hours)
      const tokenAge = Date.now() - parseInt(timestamp)
      if (tokenAge > 24 * 60 * 60 * 1000) {
        return false
      }

      // Verify signature
      const payload = `${timestamp}:${randomBytes}`
      const hmac = crypto.createHmac('sha256', this.secret)
      hmac.update(payload)
      const expectedSignature = hmac.digest('hex')
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )
    } catch {
      return false
    }
  }

  setTokenCookie(response: NextResponse, token?: string): NextResponse {
    const csrfToken = token || this.generateToken()
    
    const cookieValue = [
      `${this.cookieName}=${csrfToken}`,
      `Max-Age=${this.cookieOptions.maxAge}`,
      `Path=${this.cookieOptions.path}`,
      `SameSite=${this.cookieOptions.sameSite}`
    ]
    
    if (this.cookieOptions.httpOnly) {
      cookieValue.push('HttpOnly')
    }
    
    if (this.cookieOptions.secure) {
      cookieValue.push('Secure')
    }
    
    response.headers.set('Set-Cookie', cookieValue.join('; '))
    return response
  }

  getTokenFromCookie(request: NextRequest): string | null {
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) return null
    
    const cookies = cookieHeader.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === this.cookieName) {
        return value
      }
    }
    
    return null
  }

  getTokenFromHeader(request: NextRequest): string | null {
    return request.headers.get('x-csrf-token') || 
           request.headers.get('csrf-token')
  }

  async validateRequest(request: NextRequest): Promise<boolean> {
    // Skip validation for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true
    }

    const tokenFromCookie = this.getTokenFromCookie(request)
    const tokenFromHeader = this.getTokenFromHeader(request)
    
    // For POST/PUT/DELETE requests, we need both cookie and header tokens
    if (!tokenFromCookie || !tokenFromHeader) {
      return false
    }
    
    // Both tokens must be valid and match
    return this.verifyToken(tokenFromCookie) && 
           this.verifyToken(tokenFromHeader) &&
           tokenFromCookie === tokenFromHeader
  }
}

export const csrfProtection = new CSRFProtection()

// Public API endpoints that don't require CSRF protection
const CSRF_EXEMPT_PATHS = [
  '/api/analytics/track',
  '/api/analytics/search', 
  '/api/stats/public',
  '/api/digest/send', // Protected by authorization header
  '/api/trigger-enrichment', // Protected by authorization header
  '/api/enrich-failed', // Protected by authorization header
  '/api/admin/trigger-digest' // Protected by authorization header
]

export function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some(exemptPath => pathname.startsWith(exemptPath))
}

export function createCSRFErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Invalid CSRF token' },
    { status: 403 }
  )
}