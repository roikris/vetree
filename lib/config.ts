/**
 * Centralized configuration management with validation
 * Ensures all secrets are loaded securely from environment variables
 */

interface Config {
  // Supabase
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  
  // Site
  site: {
    url: string
    nodeEnv: string
  }
  
  // External APIs
  apis: {
    resend: string
    anthropic: string
    ncbi?: string
    github?: string
    slackWebhook?: string
  }
  
  // Security
  security: {
    csrfSecret: string
    ipHashSalt: string
    digestSecret?: string
  }
  
  // Optional services
  sentry?: {
    dsn?: string
    org?: string
    project?: string
    authToken?: string
  }
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

function getEnvVar(key: string, required: boolean = true, fallback?: string): string {
  const value = process.env[key] || fallback
  
  if (required && !value) {
    throw new ConfigurationError(`Required environment variable ${key} is not set`)
  }
  
  return value || ''
}

function validateUrl(url: string, name: string): void {
  try {
    new URL(url)
  } catch {
    throw new ConfigurationError(`Invalid URL for ${name}: ${url}`)
  }
}

function validateApiKey(key: string, name: string, minLength: number = 32): void {
  if (!key || key.length < minLength) {
    throw new ConfigurationError(`Invalid ${name}: must be at least ${minLength} characters`)
  }
}

function generateSecureSecret(): string {
  const crypto = require('crypto')
  return crypto.randomBytes(64).toString('hex')
}

function loadConfig(): Config {
  // Validate required Supabase configuration
  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
  
  validateUrl(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL')
  validateApiKey(supabaseAnonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  validateApiKey(supabaseServiceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY')
  
  // Site configuration
  const siteUrl = getEnvVar('NEXT_PUBLIC_SITE_URL')
  validateUrl(siteUrl, 'NEXT_PUBLIC_SITE_URL')
  
  // Required API keys
  const resendApiKey = getEnvVar('RESEND_API_KEY')
  const anthropicApiKey = getEnvVar('ANTHROPIC_API_KEY')
  
  validateApiKey(resendApiKey, 'RESEND_API_KEY')
  validateApiKey(anthropicApiKey, 'ANTHROPIC_API_KEY')
  
  // Security secrets
  const csrfSecret = getEnvVar('CSRF_SECRET', true, generateSecureSecret())
  const ipHashSalt = getEnvVar('IP_HASH_SALT', true, 'vetree-default-salt')
  
  if (csrfSecret.length < 64) {
    throw new ConfigurationError('CSRF_SECRET must be at least 64 characters long')
  }
  
  // Optional configuration
  const ncbiApiKey = getEnvVar('NCBI_API_KEY', false)
  const githubPat = getEnvVar('GITHUB_PAT', false)
  const slackWebhook = getEnvVar('SLACK_WEBHOOK_URL', false)
  const digestSecret = getEnvVar('DIGEST_SECRET', false)
  
  // Validate optional URLs
  if (slackWebhook) {
    validateUrl(slackWebhook, 'SLACK_WEBHOOK_URL')
  }
  
  return {
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      serviceRoleKey: supabaseServiceRoleKey
    },
    site: {
      url: siteUrl,
      nodeEnv: process.env.NODE_ENV || 'development'
    },
    apis: {
      resend: resendApiKey,
      anthropic: anthropicApiKey,
      ncbi: ncbiApiKey,
      github: githubPat,
      slackWebhook: slackWebhook
    },
    security: {
      csrfSecret,
      ipHashSalt,
      digestSecret
    },
    sentry: {
      dsn: getEnvVar('SENTRY_DSN', false),
      org: getEnvVar('SENTRY_ORG', false),
      project: getEnvVar('SENTRY_PROJECT', false),
      authToken: getEnvVar('SENTRY_AUTH_TOKEN', false)
    }
  }
}

let config: Config | null = null

export function getConfig(): Config {
  if (!config) {
    try {
      config = loadConfig()
    } catch (error) {
      if (error instanceof ConfigurationError) {
        console.error(`Configuration Error: ${error.message}`)
        console.error('Please check your environment variables and try again.')
        process.exit(1)
      }
      throw error
    }
  }
  return config
}

// Validate configuration on module load in production
if (process.env.NODE_ENV === 'production') {
  getConfig()
}