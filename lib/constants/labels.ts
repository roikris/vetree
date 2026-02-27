export const VETERINARY_LABELS = [
  'Anesthesia',
  'Behavior',
  'Cardiology',
  'Dentistry',
  'Dermatology',
  'Emergency',
  'Equine',
  'Exotic',
  'Internal Medicine',
  'Large Animal',
  'Neurology',
  'Nutrition',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pathology',
  'Pharmacology',
  'Radiology',
  'Reproduction',
  'Small Animal',
  'Soft Tissue Surgery'
] as const

export type VeterinaryLabel = typeof VETERINARY_LABELS[number]
