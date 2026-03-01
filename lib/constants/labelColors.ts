export const LABEL_COLORS: Record<string, { light: string; dark: string }> = {
  'Cardiology': {
    light: 'bg-red-50 text-red-700 border-red-100',
    dark: 'dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50'
  },
  'Oncology': {
    light: 'bg-purple-50 text-purple-700 border-purple-100',
    dark: 'dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/50'
  },
  'Soft Tissue Surgery': {
    light: 'bg-pink-50 text-pink-700 border-pink-100',
    dark: 'dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-900/50'
  },
  'Orthopedics': {
    light: 'bg-orange-50 text-orange-700 border-orange-100',
    dark: 'dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50'
  },
  'Dermatology': {
    light: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    dark: 'dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-900/50'
  },
  'Neurology': {
    light: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    dark: 'dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/50'
  },
  'Internal Medicine': {
    light: 'bg-blue-50 text-blue-700 border-blue-100',
    dark: 'dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50'
  },
  'Small Animal': {
    light: 'bg-green-50 text-green-700 border-green-100',
    dark: 'dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/50'
  },
  'Large Animal': {
    light: 'bg-amber-50 text-amber-700 border-amber-100',
    dark: 'dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'
  },
  'Equine': {
    light: 'bg-teal-50 text-teal-700 border-teal-100',
    dark: 'dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900/50'
  },
  'Exotic': {
    light: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    dark: 'dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900/50'
  },
  'Emergency': {
    light: 'bg-rose-50 text-rose-700 border-rose-100',
    dark: 'dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50'
  },
  'Anesthesia': {
    light: 'bg-violet-50 text-violet-700 border-violet-100',
    dark: 'dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900/50'
  },
  'Radiology': {
    light: 'bg-sky-50 text-sky-700 border-sky-100',
    dark: 'dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/50'
  },
  'Pathology': {
    light: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
    dark: 'dark:bg-fuchsia-950/40 dark:text-fuchsia-400 dark:border-fuchsia-900/50'
  },
  'Pharmacology': {
    light: 'bg-lime-50 text-lime-700 border-lime-100',
    dark: 'dark:bg-lime-950/40 dark:text-lime-400 dark:border-lime-900/50'
  },
  'Nutrition': {
    light: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    dark: 'dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50'
  },
  'Behavior': {
    light: 'bg-slate-50 text-slate-700 border-slate-100',
    dark: 'dark:bg-slate-950/40 dark:text-slate-400 dark:border-slate-900/50'
  },
  'Reproduction': {
    light: 'bg-pink-50 text-pink-700 border-pink-100',
    dark: 'dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-900/50'
  },
  'Ophthalmology': {
    light: 'bg-blue-50 text-blue-700 border-blue-100',
    dark: 'dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50'
  },
  'Dentistry': {
    light: 'bg-gray-50 text-gray-700 border-gray-100',
    dark: 'dark:bg-gray-950/40 dark:text-gray-400 dark:border-gray-900/50'
  },
}

export function getLabelColor(label: string): string {
  const colors = LABEL_COLORS[label]
  if (!colors) {
    return 'bg-zinc-50 text-zinc-700 border-zinc-100 dark:bg-zinc-950/40 dark:text-zinc-400 dark:border-zinc-900/50'
  }
  return `${colors.light} ${colors.dark}`
}
