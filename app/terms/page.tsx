import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors mb-8"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-medium">Back to Vetree</span>
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            Terms of Service
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Acceptance of Terms
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              By accessing and using Vetree, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Service Description
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Vetree is a platform that aggregates and presents veterinary research articles with AI-generated summaries and clinical insights. We provide tools to search, filter, save, and organize veterinary research literature.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              User Accounts
            </h2>
            <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-4">
              <p>To access certain features, you must create an account. You agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Be responsible for all activities under your account</li>
                <li>Not share your account with others</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              User Responsibilities
            </h2>
            <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-4">
              <p>You agree NOT to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use Vetree for any illegal or unauthorized purpose</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with or disrupt the service or servers</li>
                <li>Scrape, crawl, or systematically collect data from Vetree</li>
                <li>Transmit viruses, malware, or harmful code</li>
                <li>Impersonate others or misrepresent your affiliation</li>
                <li>Use the service to spam or harass others</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              AI-Generated Content Disclaimer
            </h2>
            <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 dark:border-amber-600 p-6 rounded-r-lg">
              <p className="text-amber-900 dark:text-amber-200 font-semibold mb-2">
                ⚠️ Important Notice
              </p>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                Vetree uses artificial intelligence to generate article summaries and clinical bottom lines. This content is for <strong>informational purposes only</strong> and should NOT be considered medical or veterinary advice. Always consult the original research article and qualified veterinary professionals before making clinical decisions. We make no warranties about the accuracy, completeness, or reliability of AI-generated content.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Intellectual Property
            </h2>
            <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
                  Vetree Content
                </h3>
                <p>
                  The Vetree platform, including its design, code, features, and AI-generated summaries, is owned by Vetree and protected by copyright and other intellectual property laws.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
                  Research Articles
                </h3>
                <p>
                  The original research articles displayed on Vetree are owned by their respective publishers and authors. Links to original articles are provided for your convenience. Use of those articles is subject to the publishers' terms.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
                  User Content
                </h3>
                <p>
                  You retain ownership of any content you submit (e.g., bug reports). By submitting content, you grant us a license to use it to improve our service.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Account Termination
            </h2>
            <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-4">
              <p>We reserve the right to suspend or terminate your account if you:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violate these Terms of Service</li>
                <li>Engage in fraudulent or illegal activities</li>
                <li>Abuse or misuse the service</li>
                <li>Fail to comply with our policies</li>
              </ul>
              <p>You may delete your account at any time through your profile settings.</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Disclaimer of Warranties
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Vetree is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, either express or implied. We do not warrant that the service will be uninterrupted, secure, or error-free. We make no warranties about the accuracy or completeness of content, including AI-generated summaries.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Limitation of Liability
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              To the maximum extent permitted by law, Vetree and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-300 mt-4">
              <li>Your use or inability to use the service</li>
              <li>Any unauthorized access to or use of our servers</li>
              <li>Any interruption or cessation of the service</li>
              <li>Any errors or inaccuracies in content, including AI-generated content</li>
              <li>Any reliance on information provided through the service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Indemnification
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              You agree to indemnify and hold harmless Vetree and its operators from any claims, damages, losses, liabilities, and expenses arising from your use of the service or violation of these terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Changes to Terms
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. We will notify users of any material changes by updating the "Last updated" date. Your continued use of Vetree after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Governing Law
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              These Terms of Service shall be governed by and construed in accordance with applicable laws, without regard to conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Contact Information
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              If you have questions about these Terms of Service, please contact us at:{' '}
              <a
                href="mailto:privacy@vetree.app"
                className="text-[#3D7A5F] dark:text-[#4E9A78] hover:underline font-medium"
              >
                privacy@vetree.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
