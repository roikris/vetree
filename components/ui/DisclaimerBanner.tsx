export function DisclaimerBanner() {
  return (
    <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-lg px-4 py-3 mb-6">
      <div className="flex items-start gap-3">
        <span className="text-amber-600 dark:text-amber-400 text-lg flex-shrink-0 mt-0.5">
          ℹ️
        </span>
        <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
          <strong className="font-semibold">Keep in mind:</strong> Vetree uses AI to summarize complex research for you. Like any AI assistant, it can occasionally misinterpret data. Please use these summaries as a starting point and confirm critical details with the primary literature prior to clinical application.
        </p>
      </div>
    </div>
  )
}
