import Link from 'next/link'

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Introduction
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Vetree ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our veterinary research platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Information We Collect
            </h2>
            <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
                  Account Information
                </h3>
                <p>When you create an account, we collect your email address and create a unique user identifier.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
                  Saved Articles
                </h3>
                <p>We store information about articles you save to your library, including the article ID and the date you saved it.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
                  Usage Data
                </h3>
                <p>We collect information about how you interact with Vetree, including search queries, filter preferences, and pages visited.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
                  Reports and Feedback
                </h3>
                <p>When you submit bug reports or article issue reports, we collect the information you provide in those submissions.</p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              How We Use Your Information
            </h2>
            <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              <p className="mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide and maintain the Vetree platform</li>
                <li>Personalize your experience (e.g., showing your saved articles)</li>
                <li>Improve our services and develop new features</li>
                <li>Respond to your reports and feedback</li>
                <li>Send important updates about the service (you can opt out of non-essential communications)</li>
                <li>Monitor and analyze usage patterns to improve performance</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Data Sharing and Disclosure
            </h2>
            <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-4">
              <p className="font-semibold text-[#3D7A5F] dark:text-[#4E9A78]">
                We do NOT sell, rent, or trade your personal information to third parties.
              </p>
              <p>We may share your information only in the following circumstances:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Service Providers:</strong> We use Supabase for authentication and database hosting. They have access to your data only to perform services on our behalf.</li>
                <li><strong>Legal Compliance:</strong> If required by law or to protect our rights and safety.</li>
                <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred.</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Data Retention
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We retain your account information and saved articles for as long as your account is active. If you delete your account, we will delete your personal information within 30 days, except where we are required to retain it for legal compliance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Your Rights and Choices
            </h2>
            <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              <p className="mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Access:</strong> View the personal information we have about you</li>
                <li><strong>Update:</strong> Correct or update your information through your profile</li>
                <li><strong>Delete:</strong> Delete your account and associated data through your profile settings</li>
                <li><strong>Export:</strong> Request a copy of your data (contact us at the email below)</li>
                <li><strong>Object:</strong> Object to certain processing of your information</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Data Security
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Changes to This Policy
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Contact Us
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:{' '}
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
