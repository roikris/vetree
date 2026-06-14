export function MedicalDisclaimer() {
  return (
    <div
      role="note"
      aria-label="Medical disclaimer"
      className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <span className="text-amber-600 dark:text-amber-400 text-base flex-shrink-0 mt-0.5" aria-hidden="true">
          ⚠️
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide mb-1">
            Professional Use Only
          </p>
          <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
            AI-generated summaries are for professional veterinary reference only and are{' '}
            <strong className="font-semibold">not a substitute for clinical judgment</strong>{' '}
            or direct patient evaluation. Always verify information against current clinical
            guidelines and primary literature before application. Vetree disclaims liability
            for clinical decisions based on this content.
          </p>
        </div>
      </div>
    </div>
  )
}
