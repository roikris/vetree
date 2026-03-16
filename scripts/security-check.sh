#!/bin/bash

# Local Security Check Script
# Run this script before committing to ensure security compliance

set -e

echo "🔒 Running local security checks..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install Node.js and npm."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm ci
fi

# Run npm audit
print_status "Running npm security audit..."
if npm audit --audit-level=moderate; then
    print_success "No moderate or higher security vulnerabilities found"
else
    print_error "Security vulnerabilities detected!"
    echo ""
    echo "Run 'npm audit fix' to automatically fix vulnerabilities"
    echo "Review the audit report above for manual fixes needed"
    exit 1
fi

# Check for outdated packages
print_status "Checking for outdated packages..."
if npm outdated > /dev/null 2>&1; then
    print_success "All packages are up to date"
else
    print_warning "Some packages may be outdated"
    echo "Run 'npm outdated' to see which packages can be updated"
fi

# License check (if license-checker is available)
if command -v license-checker &> /dev/null || npm list license-checker --depth=0 &> /dev/null; then
    print_status "Checking package licenses..."
    if npm run license:check > /dev/null 2>&1; then
        print_success "All package licenses are approved"
    else
        print_error "Unapproved licenses found!"
        echo "Run 'npm run license:check' to see details"
        exit 1
    fi
else
    print_warning "license-checker not available, skipping license check"
    echo "Install with: npm install -g license-checker"
fi

# Check for common security patterns in code
print_status "Scanning for potential security issues in code..."

# Check for hardcoded secrets (basic patterns)
if grep -r -i -E "(password|secret|token|key)\s*=\s*['\"][^'\"]{8,}" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" . > /dev/null 2>&1; then
    print_error "Potential hardcoded secrets found!"
    echo "Review code for hardcoded passwords, tokens, or API keys"
    echo "Use environment variables instead"
    grep -r -i -E "(password|secret|token|key)\s*=\s*['\"][^'\"]{8,}" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" . | head -5
    exit 1
fi

# Check for console.log statements that might leak sensitive data
LOG_COUNT=$(grep -r -E "console\.(log|info|debug|warn)" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" . | grep -v node_modules | grep -v ".github" | wc -l || echo "0")
if [ "$LOG_COUNT" -gt 0 ]; then
    print_warning "Found $LOG_COUNT console.log statements"
    echo "Review console statements to ensure no sensitive data is logged"
fi

# Check for TODO/FIXME comments related to security
SECURITY_TODOS=$(grep -r -i -E "(TODO|FIXME|HACK).*security" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" . | grep -v node_modules | wc -l || echo "0")
if [ "$SECURITY_TODOS" -gt 0 ]; then
    print_warning "Found $SECURITY_TODOS security-related TODO/FIXME comments"
    echo "Review and address security-related TODOs before committing"
fi

# Check if .env.example exists but .env doesn't (security best practice)
if [ -f ".env.example" ] && [ ! -f ".env" ]; then
    print_warning ".env.example exists but .env not found"
    echo "Copy .env.example to .env and configure your environment variables"
fi

# Final summary
echo ""
echo "=================================="
print_success "🎉 Local security checks completed successfully!"
echo ""
echo "Additional security commands:"
echo "  npm audit fix          - Fix automatically fixable vulnerabilities"
echo "  npm outdated          - Show outdated packages"
echo "  npm run security:check - Run full security validation"
echo ""
echo "Before committing, also consider:"
echo "  - Review your changes for sensitive data"
echo "  - Ensure environment variables are properly configured"
echo "  - Test your changes in a secure environment"