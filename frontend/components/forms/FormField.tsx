import React from 'react';
import { ErrorDisplay } from '../errors/ErrorDisplay';
import { ValidationErrors } from '../../types/signup.types';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  validationErrors?: ValidationErrors;
  fieldName?: string;
  children: React.ReactNode;
  description?: string;
}

export function FormField({
  label,
  required = false,
  error,
  validationErrors,
  fieldName,
  children,
  description,
}: FormFieldProps) {
  return (
    <div className="mb-4">
      <label className="block mb-2 text-base font-medium text-[#0A2342]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {description && (
        <p className="text-sm text-gray-600 mb-2">{description}</p>
      )}
      {children}
      <ErrorDisplay 
        error={error} 
        validationErrors={validationErrors} 
        fieldName={fieldName} 
      />
    </div>
  );
}

interface TextInputProps {
  type?: 'text' | 'email' | 'password' | 'tel';
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  hasError?: boolean;
}

export function TextInput({
  type = 'text',
  placeholder = '',
  value,
  onChange,
  disabled = false,
  autoComplete,
  className = '',
  hasError = false,
}: TextInputProps) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      autoComplete={autoComplete}
      className={`
        w-full border rounded-md px-4 py-3 
        focus:ring-2 focus:ring-[#0A2342] outline-none 
        text-[#0A2342] bg-white placeholder-gray-400 
        transition
        ${hasError ? 'border-red-300 focus:ring-red-200' : 'border-gray-300'}
        ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
        ${className}
      `}
    />
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[] | string[];
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  hasError = false,
  className = '',
}: SelectProps) {
  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`
        w-full border rounded-md px-4 py-3 
        text-[#0A2342] bg-white 
        focus:ring-2 focus:ring-[#0A2342] outline-none 
        transition
        ${hasError ? 'border-red-300 focus:ring-red-200' : 'border-gray-300'}
        ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <option value="">{placeholder}</option>
      {normalizedOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}