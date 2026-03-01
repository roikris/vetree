export function DisclaimerBanner() {
  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg px-4 py-3 mb-6">
      <div className="flex items-start gap-3">
        <span className="text-blue-600 dark:text-blue-400 text-lg flex-shrink-0 mt-0.5">
          ℹ️
        </span>
        <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
          <strong className="font-medium">Keep in mind:</strong> Vetree uses AI to summarize complex research for you. Like any AI assistant, it can occasionally misinterpret data. Please use these summaries as a starting point and confirm critical details with the primary literature prior to clinical application.
        </p>
      </div>
    </div>
  )
}
