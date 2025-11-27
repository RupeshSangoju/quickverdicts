import { ZodError, ZodSchema, ZodIssue } from 'zod';

export interface ValidationErrors {
  [key: string]: string;
}

export function validateWithSchema<T>(
  schema: ZodSchema<T>,
  data: unknown
): { isValid: boolean; errors: ValidationErrors; data?: T } {
  try {
    const validData = schema.parse(data);
    return { isValid: true, errors: {}, data: validData };
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const validationErrors: ValidationErrors = {};
      error.issues.forEach((issue: ZodIssue) => {
        const path = issue.path.join('.');
        validationErrors[path] = issue.message;
      });
      return { isValid: false, errors: validationErrors };
    }
    return { isValid: false, errors: { general: 'Validation failed' } };
  }
}

export function validatePasswordRequirements(password: string, name: string = ''): {
  hasLen: boolean;
  hasNum: boolean;
  notSameAsName: boolean;
  noTriple: boolean;
  hasUpper: boolean;
  hasSpecial: boolean;
  all: boolean;
} {
  const hasLen = password.length >= 8;
  const hasNum = /\d/.test(password);
  const notSameAsName = name.trim().length === 0 || password.toLowerCase() !== name.trim().toLowerCase();
  const noTriple = !/(.)\1{2,}/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasSpecial = /[!@#$%^&*()[\]{};:'",.<>/?\\|`~_\-+=]/.test(password);

  return {
    hasLen,
    hasNum,
    notSameAsName,
    noTriple,
    hasUpper,
    hasSpecial,
    all: hasLen && hasNum && notSameAsName && noTriple && hasUpper && hasSpecial,
  };
}