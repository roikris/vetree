# Vetree Security Audit

This directory contains security audit scripts and documentation for Vetree's database.

## Quick Start

### 1. Run the Audit
```bash
# Copy the contents of security_audit.sql
# Paste into Supabase SQL Editor
# Run all queries
```

### 2. Review Results
- Check `SECURITY_CHECKLIST.md` for expected results
- Compare your results with the checklist
- Identify any missing RLS policies or disabled RLS

### 3. Fix Issues
```bash
# If issues found, run the comprehensive RLS migration:
# supabase/migrations/004_comprehensive_rls_policies.sql
```

### 4. Re-audit
```bash
# Run security_audit.sql again
# Verify all issues are resolved
```

## Files

- `security_audit.sql` - SQL queries to check RLS status and policies
- `SECURITY_CHECKLIST.md` - Expected results and security rules
- `../migrations/004_comprehensive_rls_policies.sql` - Fix script for missing policies

## Security Principles

1. **Least Privilege**: Users only access what they need
2. **Defense in Depth**: Multiple layers of security (RLS + app logic)
3. **Fail Secure**: If RLS missing, deny access by default
4. **Audit Trail**: Regular security audits to catch issues

## When to Audit

- ✅ Before deploying to production
- ✅ After schema changes
- ✅ Monthly security review
- ✅ After adding new tables
- ✅ If suspicious activity detected

## Support

For questions about RLS policies or security:
1. Review Supabase RLS docs: https://supabase.com/docs/guides/auth/row-level-security
2. Check this repository's security guidelines
3. Run the audit and review results
