interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export default function FormTextarea({
  label,
  error,
  className = '',
  ...props
}: FormTextareaProps) {
  return (
    <div className="w-full">
      <label className="label">{label}</label>
      <textarea
        className={`input ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
        rows={4}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
