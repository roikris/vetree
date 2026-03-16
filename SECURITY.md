# Security Policy

## Supported Versions

We actively support the following versions of this project with security updates:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | ✅ |
| < Latest| ❌ |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please report it responsibly:

### For Critical Security Issues:
- **DO NOT** open a public GitHub issue
- Email security concerns to: [security@yourcompany.com] (replace with actual email)
- Include detailed steps to reproduce the vulnerability
- Allow up to 48 hours for initial response

### For Non-Critical Security Issues:
- Open a private security advisory on GitHub
- Use the "Security" tab → "Report a vulnerability"
- Provide clear description and reproduction steps

## Security Measures

### Automated Security Scanning
- **Daily vulnerability scans** using npm audit and Snyk
- **Dependency monitoring** with Dependabot
- **License compliance** checking
- **Automated security updates** for patch-level vulnerabilities

### Development Security
- All dependencies are scanned for known vulnerabilities
- Only approved licenses are allowed (MIT, Apache 2.0, BSD, ISC)
- Security patches are prioritized and auto-merged when safe
- Regular security reviews of third-party dependencies

### Response Timeline
- **Critical vulnerabilities**: 24-48 hours
- **High severity**: 1 week
- **Medium severity**: 2 weeks  
- **Low severity**: 1 month

## Security Best Practices

### For Contributors:
1. Keep dependencies up to date
2. Run `npm audit` before submitting PRs
3. Use `npm run security:check` to validate security policies
4. Avoid adding unnecessary dependencies
5. Review dependency licenses before adding new packages

### For Maintainers:
1. Monitor automated security alerts
2. Review and merge Dependabot security PRs promptly
3. Investigate security scan failures immediately
4. Keep this security policy updated
5. Coordinate security releases when needed

## Security Contacts

- **Security Team**: [security-team@yourcompany.com] (replace with actual contact)
- **Project Maintainer**: [maintainer@yourcompany.com] (replace with actual contact)
- **Emergency Contact**: [emergency@yourcompany.com] (replace with actual contact)

## Acknowledgments

We appreciate the security research community and responsible disclosure of vulnerabilities. Security researchers who report valid vulnerabilities will be acknowledged in our security advisories (unless they prefer to remain anonymous).

---

**Last Updated**: December 2024  
**Next Review**: March 2025