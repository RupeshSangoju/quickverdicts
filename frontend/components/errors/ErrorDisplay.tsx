import React from 'react';
import { ValidationErrors } from '../../types/signup.types';

interface ErrorDisplayProps {
  error?: string | null;
  validationErrors?: ValidationErrors;
  fieldName?: string;
}

export function ErrorDisplay({ error, validationErrors, fieldName }: ErrorDisplayProps) {
  const fieldError = fieldName && validationErrors?.[fieldName];
  const displayError = fieldError || error;

  if (!displayError) return null;

  return (
    <div className="flex items-start gap-2 text-red-600 text-sm mt-1">
      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <span>{displayError}</span>
    </div>
  );
}

interface FormErrorSummaryProps {
  errors: ValidationErrors;
  className?: string;
}

export function FormErrorSummary({ errors, className = '' }: FormErrorSummaryProps) {
  const errorMessages = Object.values(errors).filter(Boolean);
  
  if (errorMessages.length === 0) return null;

  return (
    <div className={`bg-red-50 border border-red-200 rounded-md p-4 ${className}`}>
      <div className="flex">
        <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <div>
          <h3 className="text-sm font-medium text-red-800">
            Please correct the following errors:
          </h3>
          <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
            {errorMessages.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}