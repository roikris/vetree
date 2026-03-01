interface FormInputProps {
  label: string
  type: 'email' | 'password' | 'text'
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

export function FormInput({
  label,
  type,
  value,
  onChange,
  placeholder,
  required = true,
}: FormInputProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-[#3D7A5F] dark:focus:ring-[#4E9A78] focus:border-transparent bg-white dark:bg-[#1A1A1A] text-[#1A1A1A] dark:text-[#E8E8E8] px-4 py-3 text-base outline-none transition-colors"
      />
    </div>
  )
}
