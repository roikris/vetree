# Vetree Security Audit Checklist

## Step 1: Run Security Audit Queries

In Supabase SQL Editor, run the queries in `security_audit.sql`

### Expected Results:

#### 1. Tables with RLS Enabled
All tables should have `rls_enabled = true`:
- ✅ `articles`
- ✅ `saved_articles`
- ✅ `user_roles`
- ✅ `reports`

#### 2. RLS Policies per Table

**articles:**
- ✅ "Articles are publicly readable" (SELECT, public)

**saved_articles:**
- ✅ "Users can view their own saved articles" (SELECT)
- ✅ "Users can save articles" (INSERT)
- ✅ "Users can unsave their own articles" (DELETE)

**user_roles:**
- ✅ "Users can read their own role" (SELECT)
- ✅ "Admins can insert roles" (INSERT)
- ✅ "Admins can update roles" (UPDATE)
- ✅ "Admins can delete roles" (DELETE)

**reports:**
- ✅ "Users can create reports" (INSERT)
- ✅ "Users can read their own reports" (SELECT)
- ✅ "Admins can read all reports" (SELECT)
- ✅ "Admins can update all reports" (UPDATE)
- ✅ "Admins can delete all reports" (DELETE)

---

## Step 2: Apply Missing Policies

If any policies are missing, run:
```sql
-- Run this file:
supabase/migrations/004_comprehensive_rls_policies.sql
```

---

## Step 3: Test RLS Policies

### Test 1: Articles (Public Read)
```sql
-- Should return articles (public access)
SET LOCAL ROLE anon;
SELECT COUNT(*) FROM articles;
RESET ROLE;
```

### Test 2: Saved Articles (User Isolation)
```sql
-- User A should NOT see User B's saved articles
-- Test in your app by logging in as different users
```

### Test 3: User Roles (Admin Check)
```sql
-- Non-admin should NOT be able to update roles
-- Test in /admin/users page as non-admin (should get unauthorized)
```

### Test 4: Reports (Admin Access)
```sql
-- Admin should see all reports
-- Regular user should only see their own
-- Test in /admin/reports page
```

---

## Security Rules Summary

### Articles Table
- **READ**: Public (anyone, even unauthenticated)
- **WRITE**: Service role only (via admin or scripts)
- **Why**: Articles are public knowledge, but only trusted sources should add them

### Saved Articles Table
- **READ**: User can only see their own
- **WRITE**: User can only save/unsave for themselves
- **Why**: Privacy - users shouldn't see what others have saved

### User Roles Table
- **READ**: User can read their own role
- **WRITE**: Only admins can change roles
- **Why**: Prevent privilege escalation

### Reports Table
- **CREATE**: Any authenticated user
- **READ**: Users see their own, admins see all
- **WRITE**: Only admins can update/delete
- **Why**: Users can report issues, admins manage them

---

## Common Security Issues to Check

### ❌ Missing RLS
```sql
-- Find tables without RLS
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
```

### ❌ Overly Permissive Policies
```sql
-- Check for policies using USING (true) for sensitive data
SELECT * FROM pg_policies WHERE qual = 'true';
```

### ❌ Missing Policies
```sql
-- Tables should have policies for all operations they allow
-- If a table allows INSERT but has no INSERT policy, it's locked down
```

---

## What to Do if Issues Found

1. **Missing RLS on table**: Run `ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;`
2. **Missing policy**: Add appropriate policy from migration 004
3. **Wrong policy**: Drop and recreate with correct logic
4. **Test failed**: Review policy USING/WITH CHECK clauses

---

## Emergency: Disable RLS (Development Only!)

**⚠️ NEVER do this in production!**

```sql
-- To temporarily disable RLS for debugging (LOCAL ONLY):
ALTER TABLE [table_name] DISABLE ROW LEVEL SECURITY;

-- Re-enable after testing:
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
```
