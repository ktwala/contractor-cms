interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export default function FormInput({
  label,
  error,
  helperText,
  className = '',
  ...props
}: FormInputProps) {
  return (
    <div className="w-full">
      <label className="label">{label}</label>
      <input
        className={`input ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-gray-500">{helperText}</p>}
    </div>
  );
}
